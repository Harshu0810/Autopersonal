-- === PROFILES (public fields) ===
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  is_admin boolean not null default false,
  display_name text,
  public_handle text unique,
  bio text,
  avatar_url text,
  is_public boolean not null default true,
  created_at timestamp with time zone default now()
);
alter table public.profiles enable row level security;

-- User-level policies
create policy if not exists "Self can view own profile"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy if not exists "User can update own profile"
on public.profiles for update to authenticated
using (auth.uid() = id);

-- Admin policies
create policy if not exists "Admins can read profiles"
on public.profiles for select to authenticated
using ((select is_admin from public.profiles p where p.id = auth.uid()));

create policy if not exists "Admins can update profiles"
on public.profiles for update to authenticated
using ((select is_admin from public.profiles p where p.id = auth.uid()));

-- PUBLIC read of limited profiles (only rows marked is_public = true)
create policy if not exists "Anon can read public profiles"
on public.profiles for select to anon
using (is_public = true);

-- Trigger to sync profiles on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- === PREDICTIONS (shareable) ===
create extension if not exists pgcrypto;

create table if not exists public.predictions (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  input_type text check (input_type in ('text','survey')) not null,
  input_content text,
  scores jsonb not null,
  label text not null,
  percentiles jsonb not null,
  public_id text unique default encode(gen_random_bytes(9), 'base64'),
  share boolean not null default false,
  created_at timestamp with time zone default now()
);
alter table public.predictions enable row level security;

-- Users can see own predictions (and admins can see all)
create policy if not exists "Users can read their predictions"
on public.predictions for select to authenticated
using (user_id = auth.uid()
    or (select is_admin from public.profiles p where p.id = auth.uid()));

create policy if not exists "Insert via authenticated users"
on public.predictions for insert to authenticated
with check (user_id = auth.uid());

create policy if not exists "Admins can do all on predictions"
on public.predictions for all to authenticated
using ((select is_admin from public.profiles p where p.id = auth.uid()));

-- PUBLIC read of shared predictions only
create policy if not exists "Anon can read shared predictions"
on public.predictions for select to anon
using (share = true);

-- Helpful index
create index if not exists idx_predictions_user on public.predictions(user_id);
create index if not exists idx_predictions_public_id on public.predictions(public_id);
