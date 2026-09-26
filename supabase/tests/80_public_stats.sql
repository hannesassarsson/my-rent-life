-- Nyckeltalen för startsidan går att läsa utan inloggning.
begin;
set local role anon;
do $$
declare s json := public.public_demo_stats();
begin
  if (s->>'units')::int < 1 then
    raise exception 'public_demo_stats: inga lägenheter (%)', s;
  end if;
end $$;
rollback;
select 'Nyckeltalstesterna gick igenom' as result;
