-- BANK INTEGRATION
-- Riktiga OCR-nummer på avierna (med kontrollsiffra enligt Luhn/modulus 10,
-- som Bankgirot kontrollerar) och organisationens bankgironummer. Med dem
-- kan inbetalningar från bankens fil (BgMax eller camt.054) matchas mot rätt
-- avi.

alter table public.organizations
  add column if not exists bankgiro text,
  add column if not exists org_number text;

create or replace function public.ocr_check_digit(_base text)
returns int language plpgsql immutable as $$
declare
  total int := 0;
  d int;
  i int;
  pos int := 0;
begin
  -- Från höger: varannan siffra dubbleras, med början på den sista.
  for i in reverse length(_base)..1 loop
    d := substr(_base, i, 1)::int;
    if pos % 2 = 0 then
      d := d * 2;
      if d > 9 then d := d - 9; end if;
    end if;
    total := total + d;
    pos := pos + 1;
  end loop;
  return (10 - total % 10) % 10;
end; $$;

create sequence if not exists public.payment_ocr_seq start 1000001;

alter table public.payments add column if not exists ocr text;

create or replace function public.set_payment_ocr() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
begin
  if new.ocr is null then
    base := nextval('public.payment_ocr_seq')::text;
    new.ocr := base || public.ocr_check_digit(base);
  end if;
  return new;
end; $$;
drop trigger if exists set_payment_ocr on public.payments;
create trigger set_payment_ocr before insert on public.payments
for each row execute function public.set_payment_ocr();

-- Befintliga avier får OCR-nummer.
do $$
declare
  p record;
  base text;
begin
  for p in select id from public.payments where ocr is null order by created_at, id loop
    base := nextval('public.payment_ocr_seq')::text;
    update public.payments set ocr = base || public.ocr_check_digit(base) where id = p.id;
  end loop;
end $$;

create unique index if not exists payments_org_ocr_idx on public.payments (organization_id, ocr);

-- Demoföreningens bankgiro (fiktivt nummer).
update public.organizations
set bankgiro = coalesce(bankgiro, '5555-1234'), org_number = coalesce(org_number, '769600-1234')
where id = '11111111-1111-1111-1111-111111111111';

-- Inbetalningar som läses in från Bankgirots fil.
alter table public.payments drop constraint if exists payments_paid_via_check;
alter table public.payments add constraint payments_paid_via_check
  check (paid_via in ('card', 'swish', 'bank', 'bankgiro', 'manual'));
