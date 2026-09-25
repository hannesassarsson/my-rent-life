-- ROLES
-- 1. Entreprenörer får läsa lägenheter som hör till ärenden de är tilldelade,
--    så att de ser adressen i sina uppdrag.
-- 2. reset_demo_all() är nattens återställning: den behåller kopplingen mellan
--    entreprenörskonton och entreprenörer (contractors.user_id), som
--    reset_demo() annars nollställer, och återställer demokontonas profiler.

drop policy if exists "contractor reads assigned units" on public.units;
create policy "contractor reads assigned units" on public.units for select to authenticated
using (
  id in (
    select r.unit_id from public.maintenance_requests r
    join public.contractors c on c.id = r.contractor_id
    where c.user_id = auth.uid()
  )
);

create or replace function public.reset_demo_all() returns void
language plpgsql security definer set search_path = public as $$
declare
  links jsonb;
begin
  select coalesce(jsonb_object_agg(id, user_id), '{}') into links
  from contractors
  where organization_id = '11111111-1111-1111-1111-111111111111' and user_id is not null;

  perform reset_demo();

  update contractors c set user_id = (links->>c.id::text)::uuid
  where links ? c.id::text;

  perform reset_demo_profiles();
end; $$;
revoke all on function public.reset_demo_all() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'reset-demo';
    perform cron.schedule('reset-demo', '0 3 * * *', 'select public.reset_demo_all()');
  end if;
end $$;
