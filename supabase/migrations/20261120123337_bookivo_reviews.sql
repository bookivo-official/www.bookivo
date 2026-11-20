create table public.bv_reviews (
  id uuid primary key default gen_random_uuid(),
  book_id text not null references public.bv_books,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null check(length(display_name) between 1 and 100),
  rating integer not null check(rating between 1 and 5),
  title text not null check(length(trim(title)) between 1 and 150),
  body text not null check(length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  unique(user_id,book_id)
);
create index bv_reviews_by_book on public.bv_reviews(book_id,created_at desc);
alter table public.bv_reviews enable row level security;
revoke all on public.bv_reviews from public,anon,authenticated;
grant select(id,book_id,display_name,rating,title,body,created_at) on public.bv_reviews to anon,authenticated;
grant all on public.bv_reviews to service_role;
create policy read_reviews on public.bv_reviews for select to anon,authenticated using(true);
create function public.bv_review(p_user uuid,p_book text,p_name text,p_rating integer,p_title text,p_body text)
returns void language plpgsql set search_path='' as $$
begin
  perform 1 from public.bv_library where user_id=p_user and book_id=p_book and revoked_at is null for share;
  if not found then raise exception 'You must buy this book before you can review it.'; end if;
  insert into public.bv_reviews(user_id,book_id,display_name,rating,title,body)
    values(p_user,p_book,p_name,p_rating,p_title,p_body)
    on conflict(user_id,book_id) do update set rating=excluded.rating,title=excluded.title,body=excluded.body;
end $$;
revoke all on function public.bv_review(uuid,text,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.bv_review(uuid,text,text,integer,text,text) to service_role;

