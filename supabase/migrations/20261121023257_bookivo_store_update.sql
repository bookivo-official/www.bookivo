create or replace function public.bv_prepare(p_user uuid,p_id uuid,p_books text[],p_coupon text,p_bits integer,p_expected integer)
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
  rate:=case p_coupon when '' then 0 when 'BOOKIVO' then 2 when 'WELCOME10' then 10 when 'NEWYEAR15' then 15 when 'FESTIVE20' then 20
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
    discount:=discount*100+case when p_coupon='BOOKIVO' then case when item.price_paise>10000 then round(item.price_paise*.02)::int else 0 end else floor(item.price_paise*rate/10000.0)::int*100 end;
    insert into public.bv_order_items values(p_id,item.id,item.price_paise,discount);
    total:=total+item.price_paise-discount;
  end loop;
  if used<>p_bits then raise exception 'Bits balance or redemption limit has changed'; end if;
  if total is distinct from p_expected then raise exception 'The total changed. Refresh checkout.'; end if;
  update public.bv_orders set amount=total,bits_used=used where id=p_id returning * into result;
  return result;
end $$;

create table public.bv_latest_session(user_id uuid primary key references auth.users on delete cascade,session_id uuid not null,started timestamptz not null);
alter table public.bv_latest_session enable row level security;
revoke all on public.bv_latest_session from public, anon, authenticated;
create function public.bv_record_session() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.bv_latest_session values(new.user_id,new.id,new.created_at)
 on conflict(user_id) do update set session_id=excluded.session_id,started=excluded.started where excluded.started>=public.bv_latest_session.started;
 return new;
end $$;
revoke all on function public.bv_record_session() from public,anon,authenticated;
create trigger bv_new_session after insert on auth.sessions for each row execute function public.bv_record_session();
insert into public.bv_latest_session select distinct on(user_id) user_id,id,created_at from auth.sessions order by user_id,created_at desc on conflict do nothing;
create function public.bv_session_current() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select from public.bv_latest_session where user_id=auth.uid() and session_id::text=auth.jwt()->>'session_id')
$$;
revoke all on function public.bv_session_current() from public,anon;
grant execute on function public.bv_session_current() to authenticated;
do $$ declare t text; begin
 foreach t in array array['bv_library','bv_profiles','bv_orders','bv_order_items','bv_bit_history','bv_tickets','bv_ticket_messages'] loop
 execute format('create policy bv_current_device on public.%I as restrictive for all to authenticated using ((select public.bv_session_current()))',t);
 end loop;
end $$;
create policy bv_current_reader on storage.objects as restrictive for select to authenticated using(bucket_id <> 'bookivo-private-books' or (select public.bv_session_current()));

create table public.bv_limits(k text primary key, since timestamptz not null,n int not null);
create table public.bv_email_checks(id uuid primary key,email text not null,digest text not null,expires timestamptz not null,tries int not null default 0,proof text);
alter table public.bv_limits enable row level security;
alter table public.bv_email_checks enable row level security;
revoke all on public.bv_limits,public.bv_email_checks from public,anon,authenticated;
grant all on public.bv_limits,public.bv_email_checks to service_role;
create function public.bv_limit(k1 text, maximum int, seconds int) returns boolean language plpgsql as $$
declare hits int;begin
 insert into public.bv_limits values(k1,now(),1) on conflict(k) do update set
 n=case when bv_limits.since+make_interval(secs=>seconds)<=now() then 1 else least(maximum+1,bv_limits.n+1) end,
 since=case when bv_limits.since+make_interval(secs=>seconds)<=now() then now() else bv_limits.since end returning n into hits;
 return hits<=maximum;end $$;
create function public.bv_verify_email(challenge uuid,guess text,new_proof text) returns boolean language plpgsql as $$
declare ok boolean;begin
 update public.bv_email_checks set tries=tries+1,proof=case when digest=guess then new_proof end,
 expires=case when digest=guess then now()+interval '2 hours' else expires end
 where id=challenge and proof is null and expires>now() and tries<5 returning proof is not null into ok;
 return coalesce(ok,false);end $$;
revoke all on function public.bv_limit(text,int,int),public.bv_verify_email(uuid,text,text) from public,anon,authenticated;
grant execute on function public.bv_limit(text,int,int),public.bv_verify_email(uuid,text,text) to service_role;

create function public.bv_guest_owner(address text) returns uuid language sql stable security definer set search_path='' as $$
 select id from auth.users where lower(email)=address and deleted_at is null limit 1
$$;
revoke all on function public.bv_guest_owner(text) from public,anon,authenticated;
grant execute on function public.bv_guest_owner(text) to service_role;
create table public.bv_contact_inbox(id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),name text not null,email text not null,topic text not null,message text not null);
alter table public.bv_contact_inbox enable row level security;
revoke all on public.bv_contact_inbox from public,anon,authenticated;
grant all on public.bv_contact_inbox to service_role;
