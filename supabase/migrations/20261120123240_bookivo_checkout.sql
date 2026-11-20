create function public.bv_prepare(p_user uuid,p_id uuid,p_books text[],p_coupon text,p_bits integer,p_expected integer)
returns public.bv_orders language plpgsql set search_path='' as $$
declare result public.bv_orders; balance integer; rate integer; total integer; used integer:=0;
  item public.bv_books; discount integer; eligible integer; ordered text[];
begin
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
  rate:=case p_coupon when '' then 0 when 'WELCOME10' then 10 when 'NEWYEAR15' then 15 when 'FESTIVE20' then 20
    when 'TODAY_IS_19' then case when extract(day from now() at time zone 'Asia/Kolkata')=19 then 19 end
    else case when p_coupon ~ '^BOOKIVO[0-9]{3,}$' then 5 end end;
  if rate is null then raise exception 'Coupon is unavailable'; end if;
  select balance-coalesce(sum(bits_used),0) into balance from public.bv_orders where user_id=p_user and status in ('pending','failed');
  insert into public.bv_orders(id,user_id,amount,requested_bits,coupon) values(p_id,p_user,100,p_bits,p_coupon);
  total:=0;
  for item in select * from public.bv_books where id=any(ordered) order by id loop
    eligible:=case when item.price_paise>9900 then floor(item.price_paise*.19/100)::int else 0 end;
    discount:=least(eligible,greatest(0,least(balance,p_bits)-used));
    used:=used+discount;
    discount:=discount*100+floor(item.price_paise*rate/10000.0)::int*100;
    insert into public.bv_order_items values(p_id,item.id,item.price_paise,discount);
    total:=total+item.price_paise-discount;
  end loop;
  if used<>p_bits then raise exception 'Bits balance or redemption limit has changed'; end if;
  if total is distinct from p_expected then raise exception 'The total changed. Refresh checkout.'; end if;
  update public.bv_orders set amount=total,bits_used=used where id=p_id returning * into result;
  return result;
end $$;

revoke all on function public.bv_prepare(uuid,uuid,text[],text,integer,integer) from public,anon,authenticated;
grant execute on function public.bv_prepare(uuid,uuid,text[],text,integer,integer) to service_role;
drop function public.bv_prepare(uuid,uuid,text[],text,integer);
alter table public.bv_events add column received_at timestamptz not null default now(),
  add column processing_status text not null default 'processed', add column error_detail text;
