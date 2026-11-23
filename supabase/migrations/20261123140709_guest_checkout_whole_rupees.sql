create table public.bv_guest_checkout(order_id uuid primary key,user_id uuid not null references auth.users(id),email text not null,proof text not null unique,expires timestamptz not null);
alter table public.bv_guest_checkout enable row level security;
revoke all on public.bv_guest_checkout from public,anon,authenticated;
grant all on public.bv_guest_checkout to service_role;
create or replace function public.bv_prepare(p_user uuid,p_id uuid,p_books text[],p_coupon text,p_bits integer,p_expected integer)
returns public.bv_orders language plpgsql set search_path='' as $$
declare result public.bv_orders; balance integer; rate integer; total integer; used integer:=0;
  offer public.bv_offers; remaining int; item public.bv_books; discount integer; eligible integer; ordered text[]; remainder integer; line record; take integer;
begin
  if (select disabled from public.bv_controls where id=1) then raise exception 'BOOKIVO is temporarily unavailable';end if;
  select bits into strict balance from public.bv_profiles where id=p_user for update;
  select array_agg(s order by s) into ordered from unnest(p_books) s;
  if cardinality(ordered) is null or cardinality(ordered) not between 1 and 20 or p_bits<0 or (p_bits>0 and p_coupon<>'') then raise exception 'Invalid selection'; end if;
  select * into result from public.bv_orders where id=p_id;
  if not found then
    select o.* into result from public.bv_orders o where o.user_id=p_user and o.status in ('pending','failed')
      and exists(select 1 from public.bv_order_items i where i.order_id=o.id and i.book_id=any(ordered))
      order by o.created_at desc limit 1;
  end if;
  if found then
    if result.user_id<>p_user or result.coupon<>p_coupon or result.requested_bits<>p_bits or ordered is distinct from
      (select array_agg(book_id order by book_id) from public.bv_order_items where order_id=result.id)
    then raise exception 'An open order contains this ebook. Open Order History to check its status.'; end if;
    if result.amount is distinct from p_expected then raise exception 'The total changed. Refresh checkout.'; end if;
    return result;
  end if;
  if (select count(*) from public.bv_orders where user_id=p_user and created_at>now()-interval '10 minutes')>=12 then raise exception 'Please wait before starting another order'; end if;
  if (select count(*) from public.bv_books where active and id=any(ordered))<>cardinality(ordered) then raise exception 'An ebook is unavailable for purchase'; end if;
  if exists(select 1 from public.bv_library where user_id=p_user and book_id=any(ordered) and revoked_at is null) then raise exception 'An ebook is already on your shelf'; end if;
  if p_coupon<>'' then
    select * into offer from public.bv_offers where (code=p_coupon and code<>'PARTNER_PATTERN' or code='PARTNER_PATTERN' and p_coupon ~ '^BOOKIVO[0-9]{3,}$') and enabled and (starts is null or starts<=now()) and (expires is null or expires>now()) and (not day19 or extract(day from now() at time zone 'Asia/Kolkata')=19) order by (code=p_coupon) desc limit 1;
    if not found then raise exception 'Coupon unavailable';end if;
    if not exists(select 1 from public.bv_books where id=any(ordered) and price_paise>offer.minimum and (offer.book_ids is null or id=any(offer.book_ids))) then raise exception 'Coupon does not apply to these ebooks';end if;
    select least(coalesce(offer.cap,2147483647),sum(price_paise)-100) into remaining from public.bv_books where id=any(ordered);
  end if;
  select balance-coalesce(sum(bits_used),0) into balance from public.bv_orders where user_id=p_user and status in ('pending','failed');
  insert into public.bv_orders(id,user_id,amount,requested_bits,coupon) values(p_id,p_user,100,p_bits,p_coupon);
  total:=0;
  for item in select * from public.bv_books where id=any(ordered) order by id loop
    eligible:=case when item.price_paise>9900 then floor(item.price_paise*.19/100)::int else 0 end;
    discount:=least(eligible,greatest(0,least(balance,p_bits)-used));
    used:=used+discount;
    discount:=discount*100;
    if p_coupon<>'' and item.price_paise>offer.minimum and (offer.book_ids is null or item.id=any(offer.book_ids)) then
      discount:=least(remaining,round(item.price_paise::numeric*offer.percent/100)::int);
      remaining:=remaining-discount;
    end if;
    insert into public.bv_order_items values(p_id,item.id,item.price_paise,discount);
    total:=total+item.price_paise-discount;
  end loop;
  remainder:=total%100;
  for line in select oi.book_id,oi.price-oi.discount as payable from public.bv_order_items oi where oi.order_id=p_id order by oi.discount desc, oi.book_id desc loop
    take:=least(remainder,line.payable);update public.bv_order_items set discount=bv_order_items.discount+take where order_id=p_id and book_id=line.book_id;remainder:=remainder-take;
    exit when remainder=0;
  end loop;
  total:=total-total%100;
  if used<>p_bits then raise exception 'Bits balance or redemption limit has changed'; end if;
  if total is distinct from p_expected then raise exception 'The total changed. Refresh checkout.'; end if;
  update public.bv_orders set amount=total,bits_used=used where id=p_id returning * into result;
  return result;
end $$;
-- Pin the schema lookup for server-only helper functions.
alter function public.bv_metrics() set search_path = '';
alter function public.bv_funnel_report(text,text,text) set search_path = '';
alter function public.bv_limit(text,integer,integer) set search_path = '';
alter function public.bv_verify_email(uuid,text,text) set search_path = '';
alter function public.bv_prune_metrics() set search_path = '';
