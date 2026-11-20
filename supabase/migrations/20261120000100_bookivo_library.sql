create schema if not exists bookivo_internal;
revoke all on schema bookivo_internal from public, anon, authenticated;

create table public.bv_profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text, avatar_url text,
  bits integer not null default 0 check(bits >= 0),
  welcome_state text not null default 'eligible' check(welcome_state in ('eligible','claimed','dismissed')),
  created_at timestamptz not null default now()
);
create function bookivo_internal.new_reader() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.bv_profiles(id,display_name,avatar_url)
  values(new.id,left(new.raw_user_meta_data->>'username',100),new.raw_user_meta_data->>'avatar_url');
  return new;
end $$;
create trigger bookivo_new_reader after insert on auth.users
for each row execute function bookivo_internal.new_reader();
insert into public.bv_profiles(id,display_name,welcome_state)
select id,left(raw_user_meta_data->>'username',100),'dismissed' from auth.users on conflict do nothing;

create table public.bv_books (
  id text primary key, slug text unique not null, title text not null, subtitle text not null,
  category text not null, cover text not null, price_paise integer not null check(price_paise>=100),
  pages integer not null check(pages between 1 and 9999), storage_prefix text unique not null check(storage_prefix ~ '^[a-z0-9-]+$'),
  active boolean not null default false
);
insert into public.bv_books values
('cookbook','bachelor-99-survival-cookbook','Bachelor 99 Survival Cookbook','99 budget Indian recipes for everyday cooking','Self Care','images/Ebook1.png',9900,99,'bachelor-cookbook',true),
('book-2','cinematic-portrait-prompts','Turn Your Photos Into Cinematic Masterpieces','25 Ready-to-Use AI Portrait Prompts for Girls','Self Growth','BOOK-2/images/portrait-prompts-3d-cover.png',2500,30,'cinematic-prompts',true);

create table public.bv_orders(
  id uuid primary key, user_id uuid not null references auth.users,
  amount integer not null check(amount>=100), coupon text not null default '',
  bits_used integer not null default 0 check(bits_used>=0), requested_bits integer not null,
  status text not null default 'pending' check(status in ('pending','paid','failed','expired','cancelled')),
  created_at timestamptz not null default now(), paid_at timestamptz
);
create index bv_orders_owner on public.bv_orders(user_id,created_at desc);
create table public.bv_order_items(
  order_id uuid references public.bv_orders, book_id text references public.bv_books,
  price integer not null check(price>=100), discount integer not null check(discount between 0 and price),
  primary key(order_id,book_id)
);
create index bv_item_book on public.bv_order_items(book_id);
create table public.bv_library(
  user_id uuid references auth.users on delete cascade, book_id text references public.bv_books,
  order_id uuid not null references public.bv_orders, purchased_at timestamptz not null default now(),
  revoked_at timestamptz, last_page integer not null default 1 check(last_page>=1),
  reading_status text not null default 'next_up' check(reading_status in ('next_up','currently_reading','finished')),
  last_opened_at timestamptz, completed_at timestamptz, revision integer not null default 0,
  primary key(user_id,book_id)
);
create index bv_library_order on public.bv_library(order_id);
create index bv_library_book on public.bv_library(book_id);
create table public.bv_events(
  event_id text primary key, order_id uuid not null references public.bv_orders,
  kind text not null, processed_at timestamptz not null default now()
);
create index bv_events_order on public.bv_events(order_id);
create table public.bv_bit_history(
  id bigint generated always as identity primary key, user_id uuid not null references auth.users on delete cascade,
  amount integer not null, reason text not null, created_at timestamptz not null default now()
);
create index bv_bits_owner on public.bv_bit_history(user_id,created_at desc);

do $$ declare tab text; begin
  foreach tab in array array['bv_profiles','bv_books','bv_orders','bv_order_items','bv_library','bv_events','bv_bit_history'] loop
    execute format('alter table public.%I enable row level security',tab);
    execute format('revoke all on public.%I from public,anon,authenticated',tab);
    execute format('grant all on public.%I to service_role',tab);
  end loop;
end $$;
grant select on public.bv_books to anon, authenticated;
grant select on public.bv_profiles, public.bv_orders,public.bv_order_items,public.bv_library,public.bv_bit_history to authenticated;
create policy titles on public.bv_books for select to anon,authenticated using(true);
create policy own_profile on public.bv_profiles for select to authenticated using(id=(select auth.uid()));
create policy own_orders on public.bv_orders for select to authenticated using(user_id=(select auth.uid()));
create policy own_items on public.bv_order_items for select to authenticated using(exists(select 1 from public.bv_orders o where o.id=order_id and o.user_id=(select auth.uid())));
create policy own_library on public.bv_library for select to authenticated using(user_id=(select auth.uid()) and revoked_at is null);
create policy own_bits on public.bv_bit_history for select to authenticated using(user_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('bookivo-private-books','bookivo-private-books',false,52428800,array['image/png','application/json']);
create policy bookivo_read_owned_files on storage.objects for select to authenticated
using(bucket_id='bookivo-private-books' and exists(
  select 1 from public.bv_library l join public.bv_books b on b.id=l.book_id
  where l.user_id=(select auth.uid()) and l.revoked_at is null and
  split_part(name,'/',1)=b.storage_prefix and
  (name=b.storage_prefix||'/prompts.json' or
   case when name ~ '^[a-z0-9-]+/images/page[1-9][0-9]{0,3}\.png$'
   then substring(name from '/page([0-9]+)\.png$')::integer<=b.pages else false end)
));

create function public.bv_prepare(p_user uuid,p_id uuid,p_books text[],p_coupon text,p_bits integer)
returns public.bv_orders language plpgsql set search_path='' as $$
declare result public.bv_orders; balance integer; rate integer; total integer; used integer:=0;
  item public.bv_books; discount integer; eligible integer; ordered text[];
begin
  select bits into strict balance from public.bv_profiles where id=p_user for update;
  select array_agg(s order by s) into ordered from unnest(p_books) s;
  if cardinality(ordered) is null or cardinality(ordered) not between 1 and 20 or p_bits<0 or (p_bits>0 and p_coupon<>'') then raise exception 'Invalid selection'; end if;
  select * into result from public.bv_orders where id=p_id;
  if found then
    if result.user_id<>p_user or result.coupon<>p_coupon or result.requested_bits<>p_bits or ordered is distinct from
      (select array_agg(book_id order by book_id) from public.bv_order_items where order_id=p_id)
    then raise exception 'Checkout details changed'; end if;
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
  update public.bv_orders set amount=total,bits_used=used where id=p_id returning * into result;
  return result;
end $$;

create function public.bv_settle(p_id uuid,p_status text,p_amount integer,p_currency text,p_event text,p_kind text)
returns void language plpgsql set search_path='' as $$
declare ord public.bv_orders; earned integer;
begin
  select * into strict ord from public.bv_orders where id=p_id for update;
  if ord.amount<>p_amount or p_currency<>'INR' or p_status not in ('paid','failed','pending','expired','cancelled') then raise exception 'Payment mismatch'; end if;
  insert into public.bv_events(event_id,order_id,kind) values(p_event,p_id,p_kind) on conflict do nothing;
  if ord.status='paid' then return; end if;
  if p_status='paid' then
    insert into public.bv_library(user_id,book_id,order_id)
      select ord.user_id,book_id,ord.id from public.bv_order_items where order_id=p_id on conflict do nothing;
    select count(*)*50 into earned from public.bv_order_items where order_id=p_id and price>24900;
    update public.bv_profiles set bits=bits+earned-ord.bits_used where id=ord.user_id;
    if earned>0 then insert into public.bv_bit_history(user_id,amount,reason) values(ord.user_id,earned,'Order reward'); end if;
    if ord.bits_used>0 then insert into public.bv_bit_history(user_id,amount,reason) values(ord.user_id,-ord.bits_used,'Checkout discount'); end if;
    update public.bv_orders set status='paid',paid_at=now() where id=p_id;
  elsif ord.status not in ('expired','cancelled') then
    update public.bv_orders set status=p_status where id=p_id;
  end if;
end $$;

create function public.bv_progress(p_user uuid,p_book text,p_page int,p_state text,p_revision int)
returns integer language plpgsql set search_path='' as $$
declare version integer;
begin
 update public.bv_library l set last_page=p_page, reading_status=p_state,revision=l.revision+1,
 last_opened_at=case when p_state='next_up' then null else now() end,completed_at=case when p_state='finished' then now() end
 from public.bv_books b where b.id=l.book_id and l.book_id=p_book and l.user_id=p_user and l.revoked_at is null
 and l.revision=p_revision and p_page between 1 and b.pages and
 (p_state='currently_reading' or (p_state='finished' and p_page=b.pages) or (p_state='next_up' and p_page=1))
 returning l.revision into version;
 if version is null then raise exception 'Reading progress changed. Reopen the book to resume.'; end if;
 return version;
end $$;
create function public.bv_welcome(p_user uuid,p_claim boolean) returns text language plpgsql set search_path='' as $$
declare state text;
begin
  update public.bv_profiles set welcome_state=case when p_claim then 'claimed' else 'dismissed' end,
  bits=bits+case when p_claim then 10 else 0 end where id=p_user and welcome_state='eligible' returning welcome_state into state;
  if state='claimed' then insert into public.bv_bit_history(user_id,amount,reason) values(p_user,10,'BOOKIVO Welcome Card'); end if;
  return coalesce(state,'already_used');
end $$;
do $$ declare fn regprocedure; begin
 for fn in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('bv_prepare','bv_settle','bv_progress','bv_welcome') loop
   execute format('revoke all on function %s from public,anon,authenticated',fn);
   execute format('grant execute on function %s to service_role',fn);
 end loop;
end $$;

