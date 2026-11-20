create or replace function public.bv_settle(p_id uuid,p_status text,p_amount integer,p_currency text,p_event text,p_kind text)
returns void language plpgsql set search_path='' as $$
declare ord public.bv_orders; earned integer;
begin
  select * into strict ord from public.bv_orders where id=p_id for update;
  if ord.amount<>p_amount or p_currency<>'INR' or p_status not in ('paid','failed','pending','expired','cancelled') then raise exception 'Payment mismatch'; end if;
  insert into public.bv_events(event_id,order_id,kind) values(p_event,p_id,p_kind) on conflict(event_id) do update set processing_status='processed',processed_at=now(),error_detail=null;
  if ord.status='paid' then return; end if;
  if p_status='paid' then
    insert into public.bv_library(user_id,book_id,order_id)
      select ord.user_id,book_id,ord.id from public.bv_order_items where order_id=p_id on conflict(user_id,book_id) do update set order_id=excluded.order_id,purchased_at=now(),revoked_at=null,
      reading_status='next_up',last_page=1,completed_at=null,last_opened_at=null,revision=public.bv_library.revision+1
      where public.bv_library.revoked_at is not null;
    select count(*)*50 into earned from public.bv_order_items where order_id=p_id and price>24900;
    update public.bv_profiles set bits=bits+earned-ord.bits_used where id=ord.user_id;
    if earned>0 then insert into public.bv_bit_history(user_id,amount,reason) values(ord.user_id,earned,'Order reward'); end if;
    if ord.bits_used>0 then insert into public.bv_bit_history(user_id,amount,reason) values(ord.user_id,-ord.bits_used,'Checkout discount'); end if;
    update public.bv_orders set status='paid',paid_at=now() where id=p_id;
  elsif ord.status not in ('expired','cancelled') then
    update public.bv_orders set status=p_status where id=p_id;
  end if;
end $$;

create function public.bv_event_error(p_event text,p_id uuid,p_kind text,p_detail text) returns void language sql set search_path='' as $$
  insert into public.bv_events(event_id,order_id,kind,processing_status,error_detail)
  values(p_event,p_id,p_kind,'retry',left(p_detail,200)) on conflict(event_id) do update set error_detail=excluded.error_detail
  where public.bv_events.processing_status='retry';
$$;
revoke all on function public.bv_event_error(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.bv_event_error(text,uuid,text,text) to service_role;
