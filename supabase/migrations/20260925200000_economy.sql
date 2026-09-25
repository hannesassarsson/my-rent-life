-- ECONOMY
-- 1. Betalsätt och påminnelsedatum på betalningar.
-- 2. pay_my_payment(): boende betalar sin egen avi i demon (kort, Swish eller
--    bank). Ingen riktig betalning görs; betalningen markeras som betald.
-- 3. Personal får skapa notiser till användare i sin organisation
--    (påminnelser, svar i ärenden m.m.). Användare läser och markerar sina
--    egna notiser som lästa (policyn "own notifications" finns sedan tidigare).

alter table public.payments add column if not exists paid_via text
  check (paid_via in ('card', 'swish', 'bank', 'manual'));
alter table public.payments add column if not exists reminded_at timestamptz;

create or replace function public.pay_my_payment(_payment_id uuid, _method text) returns void
language plpgsql security definer set search_path = public as $$
declare
  pay public.payments%rowtype;
begin
  if _method not in ('card', 'swish', 'bank') then
    raise exception 'Okänt betalsätt' using errcode = 'P0001';
  end if;
  select * into pay from payments where id = _payment_id;
  if not found or pay.unit_id not in (select my_unit_ids(auth.uid())) then
    raise exception 'Betalningen hittades inte' using errcode = 'P0001';
  end if;
  if pay.status = 'paid' then
    raise exception 'Betalningen är redan betald' using errcode = 'P0001';
  end if;
  update payments set status = 'paid', paid_at = now(), paid_via = _method where id = _payment_id;
end; $$;
revoke all on function public.pay_my_payment(uuid, text) from public, anon;
grant execute on function public.pay_my_payment(uuid, text) to authenticated;

drop policy if exists "staff create notifications" on public.notifications;
create policy "staff create notifications" on public.notifications for insert to authenticated
with check (
  public.is_org_staff(auth.uid(), organization_id)
  and user_id in (select id from public.profiles where organization_id = notifications.organization_id)
);
