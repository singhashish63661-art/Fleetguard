create table if not exists public.tampering_incidents (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  vehicle_number text not null,
  driver_name text not null,
  driver_contact_number text not null,
  tampering_details text not null,
  address text not null,
  technician_name text not null,
  technician_contact_number text not null,
  tampering_repair_charge numeric(10,2),
  tampering_image_url text not null,
  repair_device_image_url text not null,
  status text not null default 'Pending Approval' check (status in ('Pending Approval', 'Approved', 'Rejected')),
  rejection_reason text,
  created_by text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.tampering_incidents add column if not exists client_name text;
alter table public.tampering_incidents add column if not exists vehicle_number text;
alter table public.tampering_incidents add column if not exists driver_name text;
alter table public.tampering_incidents add column if not exists driver_contact_number text;
alter table public.tampering_incidents add column if not exists tampering_details text;
alter table public.tampering_incidents add column if not exists address text;
alter table public.tampering_incidents add column if not exists technician_name text;
alter table public.tampering_incidents add column if not exists technician_contact_number text;
alter table public.tampering_incidents add column if not exists tampering_repair_charge numeric(10,2);
alter table public.tampering_incidents add column if not exists tampering_image_url text;
alter table public.tampering_incidents add column if not exists repair_device_image_url text;
alter table public.tampering_incidents add column if not exists status text default 'Pending Approval';
alter table public.tampering_incidents add column if not exists rejection_reason text;
alter table public.tampering_incidents add column if not exists created_by text;
alter table public.tampering_incidents add column if not exists created_at timestamptz default timezone('utc', now());
alter table public.tampering_incidents add column if not exists updated_at timestamptz default timezone('utc', now());

update public.tampering_incidents
set status = 'Pending Approval'
where status is null;

notify pgrst, 'reload schema';

create index if not exists tampering_incidents_client_name_idx on public.tampering_incidents (client_name);
create index if not exists tampering_incidents_vehicle_number_idx on public.tampering_incidents (vehicle_number);
create index if not exists tampering_incidents_status_idx on public.tampering_incidents (status);
create index if not exists tampering_incidents_created_at_idx on public.tampering_incidents (created_at desc);

create or replace function public.set_tampering_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists tampering_incidents_set_updated_at on public.tampering_incidents;
create trigger tampering_incidents_set_updated_at
before update on public.tampering_incidents
for each row
execute function public.set_tampering_updated_at();
