with dups as (
  select id, created_at,
         row_number() over (partition by ticket_number order by created_at) as rn
  from public.maintenance_requests
), mx as (select coalesce(max(ticket_number),0) as m from public.maintenance_requests),
ren as (
  select d.id, (select m from mx) + row_number() over (order by d.created_at) as newnum
  from dups d where d.rn > 1
)
update public.maintenance_requests r
set ticket_number = ren.newnum
from ren
where r.id = ren.id;