-- Add device_id to profiles for trial abuse prevention
alter table profiles
  add column if not exists device_id text;

create index if not exists profiles_device_id_idx on profiles (device_id);

-- Returns true if this device already has a profile older than 4 weeks
-- (meaning a trial was already used on this device under a different account)
create or replace function check_device_trial_used(p_device_id text, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles
    where device_id = p_device_id
      and id != p_user_id
      and created_at < now() - interval '28 days'
  );
$$;
