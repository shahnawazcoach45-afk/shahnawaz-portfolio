-- 2026-11-04 — Database, storage bucket and security rules for the coach portfolio.
-- 2026-11-17 — Added 'awards' and 'certificates' categories (safe to re-run on an existing database).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Admin allow-list: only these emails can change content.
create table if not exists public.admins (
  email text primary key
);

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where email = auth.jwt() ->> 'email');
$$;

-- Photos and videos
create table if not exists public.media (
  id             uuid primary key default gen_random_uuid(),
  file_path      text not null,
  thumb_path     text,
  type           text not null default 'photo' check (type in ('photo', 'video')),
  category       text not null default 'coaching' check (category in ('coaching', 'kids', 'venues', 'events', 'awards', 'certificates', 'bts')),
  caption        text not null default '',
  is_featured    boolean not null default false,
  is_celebrity   boolean not null default false,
  celebrity_name text not null default '',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists media_sort_idx on public.media (sort_order);
-- For databases created before 2026-11-17: widen the category list
alter table public.media drop constraint if exists media_category_check;
alter table public.media add constraint media_category_check
  check (category in ('coaching', 'kids', 'venues', 'events', 'awards', 'certificates', 'bts'));

-- All editable website text lives in one JSON row (id = 1)
create table if not exists public.profile (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Row Level Security: everyone can read, only admins can write
alter table public.media   enable row level security;
alter table public.profile enable row level security;
alter table public.admins  enable row level security;

drop policy if exists "media read"    on public.media;
drop policy if exists "media write"   on public.media;
drop policy if exists "profile read"  on public.profile;
drop policy if exists "profile write" on public.profile;

create policy "media read"    on public.media   for select using (true);
create policy "media write"   on public.media   for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profile read"  on public.profile for select using (true);
create policy "profile write" on public.profile for all to authenticated using (public.is_admin()) with check (public.is_admin());
-- admins table: no policies = nobody can read/write it through the API (edit it in the dashboard only)

-- Storage bucket "media": public read, admin write
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media bucket read"   on storage.objects;
drop policy if exists "media bucket insert" on storage.objects;
drop policy if exists "media bucket update" on storage.objects;
drop policy if exists "media bucket delete" on storage.objects;

create policy "media bucket read"   on storage.objects for select using (bucket_id = 'media');
create policy "media bucket insert" on storage.objects for insert to authenticated with check (bucket_id = 'media' and public.is_admin());
create policy "media bucket update" on storage.objects for update to authenticated using (bucket_id = 'media' and public.is_admin());
create policy "media bucket delete" on storage.objects for delete to authenticated using (bucket_id = 'media' and public.is_admin());

-- >>> CHANGE THIS to the admin login email, then run the whole file <<<
insert into public.admins (email) values ('admin@example.com') on conflict do nothing;
