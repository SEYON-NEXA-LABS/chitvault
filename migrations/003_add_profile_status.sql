-- Add status column to profiles
alter table public.profiles add column if not exists status text default 'active';

-- Add check constraint for status
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_status_chk') then
    alter table public.profiles add constraint profiles_status_chk
      check (status in ('active', 'inactive'));
  end if;
end $$;

-- Comment for clarity
comment on column public.profiles.status is 'Account status of the user: active or inactive. Inactive users cannot access firm data.';
