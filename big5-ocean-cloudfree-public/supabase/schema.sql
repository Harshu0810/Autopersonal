-- ====== EXTENSIONS (needed for random ids) ======
create extension if not exists pgcrypto with schema extensions;

-- ====== PROFILES (public fields) ======
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

-- make sure new columns exist if table already created
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists public_handle text unique;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists is_public boolean not null default true;
alter table public.profiles add column if not exists created_at timestamp with time zone default now();

alter table public.profiles enable row level security;

-- policies (drop-then-create to avoid duplicates)
drop policy if exists "Self can view own profile" on public.profiles;
create policy "Self can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "User can update own profile" on public.profiles;
create policy "User can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
  on public.profiles for select
  to authenticated
  using ((select is_admin from public.profiles p where p.id = auth.uid()));

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  to authenticated
  using ((select is_admin from public.profiles p where p.id = auth.uid()));

drop policy if exists "Anon can read public profiles" on public.profiles;
create policy "Anon can read public profiles"
  on public.profiles for select
  to anon
  using (is_public = true);

-- trigger: create a profile row on signup
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

-- ====== PREDICTIONS (shareable) ======
create table if not exists public.predictions (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete set null,
  input_type text check (input_type in ('text','survey')) not null,
  input_content text,
  scores jsonb not null,
  label text not null,
  percentiles jsonb not null,
  public_id text unique default encode(extensions.gen_random_bytes(9), 'base64'),
  share boolean not null default false,
  created_at timestamp with time zone default now()
);

-- ensure all columns exist (safe re-run)
alter table public.predictions add column if not exists user_id uuid references public.profiles(id) on delete set null;
alter table public.predictions add column if not exists input_type text;
alter table public.predictions add column if not exists input_content text;
alter table public.predictions add column if not exists scores jsonb;
alter table public.predictions add column if not exists label text;
alter table public.predictions add column if not exists percentiles jsonb;
alter table public.predictions add column if not exists public_id text unique default encode(extensions.gen_random_bytes(9), 'base64');
alter table public.predictions add column if not exists share boolean not null default false;
alter table public.predictions add column if not exists created_at timestamp with time zone default now();

alter table public.predictions enable row level security;

-- prediction policies
drop policy if exists "Users can read their predictions" on public.predictions;
create policy "Users can read their predictions"
  on public.predictions for select
  to authenticated
  using (user_id = auth.uid()
     or (select is_admin from public.profiles p where p.id = auth.uid()));

drop policy if exists "Insert via authenticated users" on public.predictions;
create policy "Insert via authenticated users"
  on public.predictions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Admins can do all on predictions" on public.predictions;
create policy "Admins can do all on predictions"
  on public.predictions for all
  to authenticated
  using ((select is_admin from public.profiles p where p.id = auth.uid()));

drop policy if exists "Anon can read shared predictions" on public.predictions;
create policy "Anon can read shared predictions"
  on public.predictions for select
  to anon
  using (share = true);

-- helpful indexes
create index if not exists idx_predictions_user on public.predictions(user_id);
create index if not exists idx_predictions_public_id on public.predictions(public_id);
-- create profile rows for any auth.users missing in public.profiles
insert into public.profiles (id, email, display_name, is_public)
select u.id, u.email, split_part(u.email,'@',1), true
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

