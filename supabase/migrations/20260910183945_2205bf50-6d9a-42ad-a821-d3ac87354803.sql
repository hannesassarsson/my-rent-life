-- ROLES
create type public.app_role as enum ('super_admin','org_admin','property_manager','board_member','staff','contractor','resident');
create type public.tenure_type as enum ('owned','rented');
create type public.request_status as enum ('new','received','assigned','booked','in_progress','resolved','closed');
create type public.request_priority as enum ('low','normal','high','urgent');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  org_type text not null default 'brf',
  created_at timestamptz not null default now()
);
grant select on public.organizations to authenticated;
grant all on public.organizations to service_role;
alter table public.organizations enable row level security;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role, organization_id)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- HELPERS
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.current_org(_user_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from public.profiles where id = _user_id;
$$;

create or replace function public.is_org_member(_user_id uuid, _org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _org is not null and exists (
    select 1 from public.profiles where id = _user_id and organization_id = _org
  );
$$;

create or replace function public.is_org_staff(_user_id uuid, _org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _user_id
      and r.role in ('super_admin','org_admin','property_manager','board_member','staff')
      and (r.role = 'super_admin' or r.organization_id = _org)
  );
$$;

create policy "org members read org" on public.organizations for select to authenticated
using (public.is_org_member(auth.uid(), id));
create policy "org admins update org" on public.organizations for update to authenticated
using (public.is_org_staff(auth.uid(), id));

create policy "read own profile" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_org_staff(auth.uid(), organization_id));
create policy "update own profile" on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy "read own roles" on public.user_roles for select to authenticated
using (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id));

-- PROPERTY HIERARCHY
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  address text not null,
  postal_code text,
  city text,
  build_year int,
  created_at timestamptz not null default now()
);
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  floors int
);
create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  unit_number text not null,
  object_number text,
  address text not null,
  size_sqm numeric,
  rooms numeric,
  floor int,
  tenure public.tenure_type not null default 'owned',
  monthly_amount numeric,
  storage text,
  parking text,
  balcony boolean not null default false,
  key_count int not null default 0,
  status text not null default 'active'
);
create table public.residencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  resident_name text not null,
  email text,
  phone text,
  move_in_date date,
  tenure public.tenure_type not null default 'owned',
  status text not null default 'active',
  is_primary boolean not null default true
);

grant select on public.properties, public.buildings, public.units, public.residencies to authenticated;
grant insert, update, delete on public.properties, public.buildings, public.units, public.residencies to authenticated;
grant all on public.properties, public.buildings, public.units, public.residencies to service_role;
alter table public.properties enable row level security;
alter table public.buildings enable row level security;
alter table public.units enable row level security;
alter table public.residencies enable row level security;

create or replace function public.my_unit_ids(_user_id uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select unit_id from public.residencies where user_id = _user_id and status = 'active';
$$;

create policy "org read properties" on public.properties for select to authenticated using (public.is_org_member(auth.uid(), organization_id));
create policy "staff write properties" on public.properties for all to authenticated using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));
create policy "org read buildings" on public.buildings for select to authenticated using (public.is_org_member(auth.uid(), organization_id));
create policy "staff write buildings" on public.buildings for all to authenticated using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));
create policy "read units" on public.units for select to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or id in (select public.my_unit_ids(auth.uid())));
create policy "staff write units" on public.units for all to authenticated using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));
create policy "read residencies" on public.residencies for select to authenticated
using (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id));
create policy "staff write residencies" on public.residencies for all to authenticated using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));

-- CONTRACTORS
create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company text not null,
  contact_name text,
  phone text,
  email text,
  category text,
  agreement_note text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.contractors to authenticated;
grant all on public.contractors to service_role;
alter table public.contractors enable row level security;
create policy "staff manage contractors" on public.contractors for all to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or user_id = auth.uid())
with check (public.is_org_staff(auth.uid(), organization_id));

-- MAINTENANCE
create sequence public.request_number_seq start 1827;
create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  ticket_number int not null default nextval('public.request_number_seq'),
  reported_by uuid references auth.users(id) on delete set null,
  reporter_name text,
  category text not null,
  title text not null,
  description text,
  room text,
  is_urgent boolean not null default false,
  priority public.request_priority not null default 'normal',
  status public.request_status not null default 'new',
  assignee_name text,
  contractor_id uuid references public.contractors(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.maintenance_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);
create table public.maintenance_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  author_role text not null default 'resident',
  body text not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.maintenance_requests, public.maintenance_events, public.maintenance_comments to authenticated;
grant all on public.maintenance_requests, public.maintenance_events, public.maintenance_comments to service_role;
alter table public.maintenance_requests enable row level security;
alter table public.maintenance_events enable row level security;
alter table public.maintenance_comments enable row level security;

create or replace function public.can_see_request(_user_id uuid, _request_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.maintenance_requests r
    left join public.contractors c on c.id = r.contractor_id
    where r.id = _request_id
      and (
        r.reported_by = _user_id
        or r.unit_id in (select public.my_unit_ids(_user_id))
        or public.is_org_staff(_user_id, r.organization_id)
        or c.user_id = _user_id
      )
  );
$$;

create policy "read requests" on public.maintenance_requests for select to authenticated
using (
  reported_by = auth.uid()
  or unit_id in (select public.my_unit_ids(auth.uid()))
  or public.is_org_staff(auth.uid(), organization_id)
  or contractor_id in (select id from public.contractors where user_id = auth.uid())
);
create policy "residents create requests" on public.maintenance_requests for insert to authenticated
with check (public.is_org_member(auth.uid(), organization_id) and (unit_id in (select public.my_unit_ids(auth.uid())) or public.is_org_staff(auth.uid(), organization_id)));
create policy "update requests" on public.maintenance_requests for update to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or reported_by = auth.uid() or contractor_id in (select id from public.contractors where user_id = auth.uid()));
create policy "staff delete requests" on public.maintenance_requests for delete to authenticated
using (public.is_org_staff(auth.uid(), organization_id));

create policy "read events" on public.maintenance_events for select to authenticated using (public.can_see_request(auth.uid(), request_id));
create policy "write events" on public.maintenance_events for insert to authenticated with check (public.can_see_request(auth.uid(), request_id));
create policy "read comments" on public.maintenance_comments for select to authenticated using (public.can_see_request(auth.uid(), request_id));
create policy "write comments" on public.maintenance_comments for insert to authenticated with check (public.can_see_request(auth.uid(), request_id) and (author_user_id = auth.uid() or author_user_id is null));

-- RESOURCES AND BOOKINGS
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  name text not null,
  kind text not null default 'laundry',
  icon text,
  location text,
  slot_minutes int not null default 120,
  open_from time not null default '06:00',
  open_to time not null default '22:00',
  max_active_bookings int not null default 2,
  days_ahead int not null default 14,
  cancel_hours int not null default 2,
  is_active boolean not null default true
);
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  booked_by_name text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed',
  created_at timestamptz not null default now(),
  unique (resource_id, starts_at)
);
grant select, insert, update, delete on public.resources, public.bookings to authenticated;
grant all on public.resources, public.bookings to service_role;
alter table public.resources enable row level security;
alter table public.bookings enable row level security;
create policy "org read resources" on public.resources for select to authenticated using (public.is_org_member(auth.uid(), organization_id));
create policy "staff write resources" on public.resources for all to authenticated using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));
create policy "org read bookings" on public.bookings for select to authenticated using (public.is_org_member(auth.uid(), organization_id));
create policy "create own bookings" on public.bookings for insert to authenticated
with check (public.is_org_member(auth.uid(), organization_id) and (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id)));
create policy "manage own bookings" on public.bookings for delete to authenticated
using (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id));
create policy "update own bookings" on public.bookings for update to authenticated
using (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id));

-- ANNOUNCEMENTS
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  body text not null,
  category text not null default 'news',
  audience_scope text not null default 'organization',
  property_id uuid references public.properties(id) on delete set null,
  building_id uuid references public.buildings(id) on delete set null,
  unit_ids uuid[],
  is_published boolean not null default false,
  is_pinned boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.announcements to authenticated;
grant all on public.announcements to service_role;
alter table public.announcements enable row level security;
create policy "read announcements" on public.announcements for select to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or (is_published and public.is_org_member(auth.uid(), organization_id)));
create policy "staff write announcements" on public.announcements for all to authenticated
using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));

-- DOCUMENTS
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  doc_type text not null default 'other',
  file_kind text not null default 'pdf',
  file_size text,
  unit_id uuid references public.units(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  storage_path text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "read documents" on public.documents for select to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or (public.is_org_member(auth.uid(), organization_id) and (unit_id is null or unit_id in (select public.my_unit_ids(auth.uid())))));
create policy "staff write documents" on public.documents for all to authenticated
using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));

-- MEETINGS
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  meeting_type text not null default 'annual',
  starts_at timestamptz not null,
  location text,
  agenda text,
  protocol_url text,
  motions text,
  created_at timestamptz not null default now()
);
create table public.meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  attendee_name text,
  status text not null default 'attending',
  created_at timestamptz not null default now(),
  unique (meeting_id, user_id)
);
grant select, insert, update, delete on public.meetings, public.meeting_attendance to authenticated;
grant all on public.meetings, public.meeting_attendance to service_role;
alter table public.meetings enable row level security;
alter table public.meeting_attendance enable row level security;
create policy "org read meetings" on public.meetings for select to authenticated using (public.is_org_member(auth.uid(), organization_id));
create policy "staff write meetings" on public.meetings for all to authenticated using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));
create policy "read attendance" on public.meeting_attendance for select to authenticated
using (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id));
create policy "manage own attendance" on public.meeting_attendance for all to authenticated
using (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id))
with check (user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id));

-- PAYMENTS
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  kind text not null default 'fee',
  period date not null,
  amount numeric not null,
  due_date date not null,
  status text not null default 'unpaid',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (unit_id, period, kind)
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "read payments" on public.payments for select to authenticated
using (public.is_org_staff(auth.uid(), organization_id) or unit_id in (select public.my_unit_ids(auth.uid())));
create policy "staff write payments" on public.payments for all to authenticated
using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));

-- MAINTENANCE PROJECTS
create table public.maintenance_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  title text not null,
  year int not null,
  status text not null default 'planned',
  budget numeric,
  note text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.maintenance_projects to authenticated;
grant all on public.maintenance_projects to service_role;
alter table public.maintenance_projects enable row level security;
create policy "org read projects" on public.maintenance_projects for select to authenticated using (public.is_org_member(auth.uid(), organization_id));
create policy "staff write projects" on public.maintenance_projects for all to authenticated using (public.is_org_staff(auth.uid(), organization_id)) with check (public.is_org_staff(auth.uid(), organization_id));

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  thread_key text not null,
  subject text,
  request_id uuid references public.maintenance_requests(id) on delete cascade,
  resident_user_id uuid references auth.users(id) on delete set null,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_name text not null,
  sender_role text not null default 'resident',
  body text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "read messages" on public.messages for select to authenticated
using (resident_user_id = auth.uid() or sender_user_id = auth.uid() or public.is_org_staff(auth.uid(), organization_id));
create policy "send messages" on public.messages for insert to authenticated
with check (public.is_org_member(auth.uid(), organization_id) and sender_user_id = auth.uid());

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;
create trigger touch_requests before update on public.maintenance_requests
for each row execute function public.touch_updated_at();

-- NEW USER HANDLING (demo org onboarding)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  demo_org uuid;
  wanted_role text;
  seat uuid;
begin
  select id into demo_org from public.organizations order by created_at limit 1;
  wanted_role := coalesce(new.raw_user_meta_data->>'demo_role', 'resident');

  insert into public.profiles (id, organization_id, full_name, email)
  values (new.id, demo_org,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email);

  if wanted_role = 'admin' then
    insert into public.user_roles (user_id, organization_id, role) values (new.id, demo_org, 'org_admin');
  else
    insert into public.user_roles (user_id, organization_id, role) values (new.id, demo_org, 'resident');
    select id into seat from public.residencies
      where organization_id = demo_org and user_id is null and status = 'active'
      order by created_at nulls last limit 1;
    if seat is not null then
      update public.residencies
        set user_id = new.id,
            resident_name = coalesce(new.raw_user_meta_data->>'full_name', resident_name),
            email = new.email
        where id = seat;
    end if;
  end if;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();