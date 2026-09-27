-- Additive singleton site settings table. This file is not applied automatically.
create table if not exists public.site_settings (
  id boolean primary key default true,
  favicon_url text,
  favicon_storage_key text,
  favicon_mime_type text,
  favicon_size_bytes bigint,
  favicon_width integer,
  favicon_height integer,
  favicon_updated_at timestamptz,
  updated_by_profile_id uuid,
  created_at timestamptz not null default now(),
  constraint site_settings_singleton_check check (id = true),
  constraint site_settings_favicon_size_check check (favicon_size_bytes is null or favicon_size_bytes >= 0),
  constraint site_settings_favicon_width_check check (favicon_width is null or favicon_width > 0),
  constraint site_settings_favicon_height_check check (favicon_height is null or favicon_height > 0),
  constraint site_settings_updated_by_profile_fk foreign key (updated_by_profile_id)
    references public.character_profiles(id) on delete set null
);

alter table public.site_settings enable row level security;

-- Browser roles have no direct access. Server code uses service_role only after
-- independently resolving a DB-fresh ADMIN character.
revoke all privileges on table public.site_settings from anon, authenticated;
grant select, insert, update, delete on table public.site_settings to service_role;