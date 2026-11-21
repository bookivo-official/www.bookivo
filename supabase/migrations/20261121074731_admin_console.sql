create table public.bv_controls(id int primary key check(id=1), disabled boolean not null default false, banner text not null default '🔥 KNOWLEDGE THAT MOVES YOU FORWARD — EXPLORE BOOKIVO! 🔥');
insert into public.bv_controls(id) values(1);
create table public.bv_offers(code text primary key check(code ~ '^[A-Z0-9_-]{1,32}$'), percent int not null check(percent between 1 and 100), minimum int not null default 0 check(minimum>=0), cap int check(cap>0), starts timestamptz,expires timestamptz,enabled boolean not null default true,auto boolean not null default false,listed boolean not null default false,description text not null default '',day19 boolean not null default false,check(starts is null or expires is null or starts<expires));
insert into public.bv_offers(code,percent,minimum,auto,listed,day19,description) values
('BOOKIVO',2,10000,false,true,false,'Save on ebooks priced above ₹100.'),('TODAY_IS_19',19,0,true,false,true,'Available on the 19th of the month.'),('FESTIVE20',20,0,false,false,false,''),('WELCOME10',10,0,false,false,false,''),('NEWYEAR15',15,0,false,false,false,''),('PARTNER_PATTERN',5,0,false,false,false,'Existing BOOKIVO partner codes with three or more digits.');
create table public.bv_visits(day date not null, visitor uuid not null, stage text not null,primary key(day,visitor,stage));
create table public.bv_funnel(day date not null, visitor uuid not null,stage text not null,book text not null,device text not null,source text not null,primary key(day,visitor,stage,book,device,source));
create table public.bv_attribution(order_id uuid primary key references public.bv_orders,day date not null, visitor uuid not null, device text not null, source text not null);
create table public.bv_admin_sessions(hash text primary key,expires timestamptz not null,step int default 0,after_time timestamptz);
create table public.bv_admin_replies(id uuid primary key,contact uuid references public.bv_contact_inbox,body text not null,created_at timestamptz default now());
do $$ declare t text;begin foreach t in array array['bv_controls','bv_offers','bv_visits','bv_funnel','bv_attribution','bv_admin_sessions','bv_admin_replies'] loop
execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end $$;
create function public.bv_public_settings() returns jsonb language sql stable security definer set search_path='' as $$
select to_jsonb(c)||jsonb_build_object('offers',(select coalesce(jsonb_agg(to_jsonb(o) order by o.percent desc,o.code),'[]') from public.bv_offers o where enabled and (starts is null or starts<=now()) and (expires is null or expires>now()) and (not day19 or extract(day from now() at time zone 'Asia/Kolkata')=19))) from public.bv_controls c where id=1
$$;
grant execute on function public.bv_public_settings() to anon,authenticated;
create function public.bv_prune_metrics() returns void language sql as $$
delete from public.bv_visits where day<(now() at time zone 'Asia/Kolkata')::date-case when stage in ('Visit','InitiateCheckout') then 29 else 6 end;
delete from public.bv_funnel where day<(now() at time zone 'Asia/Kolkata')::date-6;
delete from public.bv_attribution where day<(now() at time zone 'Asia/Kolkata')::date-6;
delete from public.bv_admin_sessions where expires<now();
$$;
revoke all on function public.bv_prune_metrics() from public,anon,authenticated;
grant execute on function public.bv_prune_metrics() to service_role;
create policy bv_store_open_reader on storage.objects as restrictive for select to authenticated using(bucket_id<>'bookivo-private-books' or not ((select public.bv_public_settings())->>'disabled')::boolean);
create function public.bv_metrics() returns jsonb language sql stable as $$
select jsonb_build_object('activity',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from (select n, stage,count(distinct visitor) as count from (values(1),(7),(30)) as periods(n) join public.bv_visits on day >= (now() at time zone 'Asia/Kolkata')::date-n+1 group by n,stage)m),
'sales',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from (select (o.paid_at at time zone 'Asia/Kolkata')::date as day,i.book_id,count(*) as copies,sum(i.price-i.discount) as revenue from public.bv_orders o join public.bv_order_items i on o.id=i.order_id where o.status='paid' group by 1,2)m),
'outcomes',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from (select (created_at at time zone 'Asia/Kolkata')::date as day,status,count(*) as count from public.bv_orders group by 1,2)m),
'buyers',(select jsonb_object_agg(n,c) from (select n,count(distinct o.user_id)c from (values(1),(7),(30))p(n) left join public.bv_orders o on o.status='paid' and (o.paid_at at time zone 'Asia/Kolkata')::date >= (now() at time zone 'Asia/Kolkata')::date-n+1 group by n)m))
$$;
revoke all on function public.bv_metrics() from public,anon,authenticated;grant execute on function public.bv_metrics() to service_role;
create or replace function public.bv_prepare(p_user uuid,p_id uuid,p_books text[],p_coupon text,p_bits integer,p_expected integer)
returns public.bv_orders language plpgsql set search_path='' as $$
declare result public.bv_orders; balance integer; rate integer; total integer; used integer:=0;
  offer public.bv_offers; remaining int; item public.bv_books; discount integer; eligible integer; ordered text[];
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
    if p_coupon<>'' and item.price_paise>offer.minimum then
      discount:=least(remaining,round(item.price_paise::numeric*offer.percent/100)::int);
      remaining:=remaining-discount;
    end if;
    insert into public.bv_order_items values(p_id,item.id,item.price_paise,discount);
    total:=total+item.price_paise-discount;
  end loop;
  if used<>p_bits then raise exception 'Bits balance or redemption limit has changed'; end if;
  if total is distinct from p_expected then raise exception 'The total changed. Refresh checkout.'; end if;
  update public.bv_orders set amount=total,bits_used=used where id=p_id returning * into result;
  return result;
end $$;

create function public.bv_funnel_report(p_book text,p_device text,p_source text) returns jsonb language sql stable as $$
with events as (
select visitor,stage,book,device,source from public.bv_funnel where day>=(now() at time zone 'Asia/Kolkata')::date-6
union all select a.visitor,'Paid',i.book_id,a.device,a.source from public.bv_attribution a join public.bv_orders o on o.id=a.order_id join public.bv_order_items i on i.order_id=o.id where o.status='paid' and (o.paid_at at time zone 'Asia/Kolkata')::date>=(now() at time zone 'Asia/Kolkata')::date-6)
select jsonb_build_object('counts',(select coalesce(jsonb_object_agg(stage,n),'{}') from (select stage,count(distinct visitor)n from events where (p_book='' or book=p_book) and (p_device='' or device=p_device) and (p_source='' or source=p_source) group by stage)t),'sources',(select coalesce(jsonb_agg(s),'[]') from (select distinct source s from events limit 200)t))
$$;
revoke all on function public.bv_funnel_report(text,text,text) from public,anon,authenticated;grant execute on function public.bv_funnel_report(text,text,text) to service_role;

do $$ begin
 if exists(select from pg_available_extensions where name='pg_cron') then
 create extension if not exists pg_cron;
 perform cron.schedule('bookivo-analytics-retention','30 18 * * *','select public.bv_prune_metrics()');
 end if;
end $$;
