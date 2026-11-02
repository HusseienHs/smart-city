-- =============================================================================
-- Notifications (in-app inbox, the source of truth) and Expo push tokens.
-- Notifications store a type + structured data, not rendered text: both the app and the
-- push Edge Function render them with the shared translations in the user's locale.
-- =============================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  municipality_id uuid references public.municipalities (id),
  type public.notification_type not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique check (expo_push_token ~ '^Expo(nent)?PushToken\[.+\]$'),
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

revoke all on public.notifications, public.push_tokens from anon, authenticated;

-- Users read their notifications and can only mark them read. Inserts happen exclusively
-- inside SECURITY DEFINER functions (e.g. report status changes).
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users read their own notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users mark their own notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, delete on public.push_tokens to authenticated;

create policy "Users read their own push tokens"
  on public.push_tokens for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users delete their own push tokens"
  on public.push_tokens for delete to authenticated
  using (user_id = (select auth.uid()));

-- Registers (or moves) a device token to the calling user. A token identifies a device,
-- so when another account signs in on the same device the token moves to that account.
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  insert into public.push_tokens (user_id, expo_push_token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        last_seen_at = now();
end;
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;

-- Realtime: the app subscribes to its own notifications (RLS applies to Realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
