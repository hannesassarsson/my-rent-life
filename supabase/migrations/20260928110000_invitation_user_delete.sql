-- Konton ska gå att radera även om de har skapat eller tagit emot en
-- inbjudan. Främmande nycklarna sätter då created_by/accepted_by till null,
-- vilket skyddstriggern tidigare stoppade. Att tömma fälten är ofarligt:
-- accepted_at ligger kvar, så en använd länk förblir använd, och
-- historiken finns i audit_events.
create or replace function public.check_invitation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from units where id = new.unit_id and organization_id = new.organization_id
    ) then
      raise exception 'Lägenheten hör inte till föreningen' using errcode = 'P0001';
    end if;
    if new.residency_id is not null and not exists (
      select 1 from residencies
      where id = new.residency_id and unit_id = new.unit_id and status = 'active' and user_id is null
    ) then
      raise exception 'Personen bor inte i lägenheten eller har redan ett konto' using errcode = 'P0001';
    end if;
    return new;
  end if;
  -- Uppdatering: bara återkallelse och utskickstid får ändras av förvaltningen.
  if current_setting('app.accepting_invitation', true) = 'on' then
    return new;
  end if;
  if new.organization_id <> old.organization_id or new.unit_id <> old.unit_id
     or new.residency_id is distinct from old.residency_id
     or new.token_hash <> old.token_hash or new.expires_at <> old.expires_at
     or new.accepted_at is distinct from old.accepted_at
     or (new.accepted_by is distinct from old.accepted_by and new.accepted_by is not null)
     or (new.created_by is distinct from old.created_by and new.created_by is not null)
     or new.invitee_name is distinct from old.invitee_name
     or new.invitee_email is distinct from old.invitee_email
     or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at) then
    raise exception 'Inbjudan kan inte ändras' using errcode = 'P0001';
  end if;
  return new;
end; $$;
revoke all on function public.check_invitation() from public, anon, authenticated;
