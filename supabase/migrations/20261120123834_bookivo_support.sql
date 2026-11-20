create table public.bv_tickets(
  id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,
  contact_name text not null,contact_email text not null,subject text not null,topic text not null,
  status text not null default 'Open' check(status in ('Open','Replied','Closed')),
  created_at timestamptz not null default now()
);
create index bv_tickets_owner on public.bv_tickets(user_id,created_at desc);
create table public.bv_ticket_messages(
  id bigint generated always as identity primary key,ticket_id uuid not null references public.bv_tickets on delete cascade,
  sender text not null,body text not null check(length(trim(body)) between 1 and 1000),created_at timestamptz not null default now()
);
create index bv_messages_ticket on public.bv_ticket_messages(ticket_id,created_at);
alter table public.bv_tickets enable row level security;
alter table public.bv_ticket_messages enable row level security;
revoke all on public.bv_tickets,public.bv_ticket_messages from public,anon,authenticated;
grant select on public.bv_tickets,public.bv_ticket_messages to authenticated;
grant all on public.bv_tickets,public.bv_ticket_messages to service_role;
create policy read_own_tickets on public.bv_tickets for select to authenticated using(user_id=(select auth.uid()));
create policy read_ticket_thread on public.bv_ticket_messages for select to authenticated using(exists(select 1 from public.bv_tickets t where t.id=ticket_id and t.user_id=(select auth.uid())));
create function public.bv_ticket(p_user uuid,p_id uuid,p_name text,p_email text,p_title text,p_topic text,p_message text)
returns uuid language plpgsql set search_path='' as $$
declare ticket uuid;
begin
  perform 1 from public.bv_profiles where id=p_user for update;
  if p_id is null then
    if (select count(*) from public.bv_tickets where user_id=p_user and created_at>now()-interval '1 hour')>=5 then raise exception 'Please use your existing support ticket.';end if;
    insert into public.bv_tickets(user_id,contact_name,contact_email,subject,topic) values(p_user,p_name,p_email,p_title,p_topic) returning id into ticket;
  else
    select id into ticket from public.bv_tickets where id=p_id and user_id=p_user and status<>'Closed' for update;
    if ticket is null then raise exception 'Ticket unavailable.';end if;
    if (select count(*) from public.bv_ticket_messages where ticket_id=ticket and created_at>now()-interval '1 hour')>=20 then raise exception 'Please wait before replying again.';end if;
  end if;
  insert into public.bv_ticket_messages(ticket_id,sender,body) values(ticket,p_name,p_message);
  return ticket;
end $$;
revoke all on function public.bv_ticket(uuid,uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.bv_ticket(uuid,uuid,text,text,text,text,text) to service_role;

