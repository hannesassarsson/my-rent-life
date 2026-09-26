-- DEMO VACANCIES
-- Tre lediga lägenheter i demoföreningen så att inflyttning går att visa.

do $$
declare
  vacant uuid[];
begin
  select array_agg(u.id) into vacant
  from public.units u
  where u.organization_id = '11111111-1111-1111-1111-111111111111'
    and (u.address, u.unit_number) in (('Storgatan 10', '5F'), ('Storgatan 14', '5F'), ('Storgatan 16', '4J'));

  if vacant is null then
    return;
  end if;

  delete from public.residencies where unit_id = any (vacant);
  update public.units set status = 'vacant' where id = any (vacant);

  if to_regclass('demo.units') is not null then
    delete from demo.residencies where unit_id = any (vacant);
    update demo.units set status = 'vacant' where id = any (vacant);
  end if;
end $$;
