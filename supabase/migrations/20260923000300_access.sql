-- Deny by default: strip the broad grants Supabase gives anon/authenticated,
-- then hand back exactly what each table needs.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.templates enable row level security;
alter table public.memories enable row level security;
alter table public.memory_sections enable row level security;
alter table public.memory_media enable row level security;
alter table public.memory_timeline enable row level security;
alter table public.collaboration_links enable row level security;
alter table public.memory_contributions enable row level security;
alter table public.recipient_responses enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.notifications enable row level security;
alter table public.storage_deletions enable row level security;
alter table public.event_logs enable row level security;
alter table public.security_events enable row level security;
alter table public.analytics_events enable row level security;
alter table public.rate_limits enable row level security;

-- Policy helpers run as definer to avoid recursive RLS on memories.
create function private.owns_memory(p_memory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memories
    where id = p_memory_id
      and owner_id = (select auth.uid())
      and status <> 'deleted'
  );
$$;

create function private.owns_draft(p_memory_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memories
    where id = p_memory_id
      and owner_id = (select auth.uid())
      and status = 'draft'
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.owns_memory(uuid) to authenticated;
grant execute on function private.owns_draft(uuid) to authenticated;
-- Column default for public_slug is evaluated with the inserting role.
grant execute on function private.random_base62(int) to authenticated;
-- Helpers invoked from triggers are privilege-checked against whoever runs the
-- statement: API users, the service role, and Supabase Auth when an account
-- deletion cascades.
do $$
declare
  grantee text;
begin
  foreach grantee in array array['authenticated', 'service_role', 'supabase_auth_admin'] loop
    if exists (select 1 from pg_roles where rolname = grantee) then
      execute format('grant usage on schema private to %I', grantee);
      execute format('grant execute on function private.is_client_role() to %I', grantee);
      execute format('grant execute on function private.memory_transition_allowed(public.memory_status, public.memory_status) to %I', grantee);
      execute format('grant execute on function private.memory_status_of(uuid) to %I', grantee);
      execute format('grant execute on function private.random_base62(int) to %I', grantee);
    end if;
  end loop;
end;
$$;

-- profiles
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- templates
grant select on public.templates to authenticated;

create policy templates_select_active on public.templates
  for select to authenticated using (is_active);

-- memories
grant select on public.memories to authenticated;
grant insert (
  id, owner_id, template_id, theme, occasion, title, recipient_name, sender_name,
  opening_line, message, closing_line, release_at
) on public.memories to authenticated;
grant update (
  template_id, theme, occasion, title, recipient_name, sender_name,
  opening_line, message, closing_line, release_at
) on public.memories to authenticated;

create policy memories_select_own on public.memories
  for select to authenticated
  using (owner_id = (select auth.uid()) and status <> 'deleted');
create policy memories_insert_own on public.memories
  for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy memories_update_own_draft on public.memories
  for update to authenticated
  using (owner_id = (select auth.uid()) and status = 'draft')
  with check (owner_id = (select auth.uid()) and status = 'draft');

-- sections and timeline: full CRUD while draft
grant select, delete on public.memory_sections to authenticated;
grant insert (id, memory_id, title, body, event_date, transition, position) on public.memory_sections to authenticated;
grant update (title, body, event_date, transition, position) on public.memory_sections to authenticated;

create policy sections_select on public.memory_sections
  for select to authenticated using (private.owns_memory(memory_id));
create policy sections_insert on public.memory_sections
  for insert to authenticated with check (private.owns_draft(memory_id));
create policy sections_update on public.memory_sections
  for update to authenticated
  using (private.owns_draft(memory_id)) with check (private.owns_draft(memory_id));
create policy sections_delete on public.memory_sections
  for delete to authenticated using (private.owns_draft(memory_id));

grant select, delete on public.memory_timeline to authenticated;
grant insert (id, memory_id, event_date, title, body, media_id, position) on public.memory_timeline to authenticated;
grant update (event_date, title, body, media_id, position) on public.memory_timeline to authenticated;

create policy timeline_select on public.memory_timeline
  for select to authenticated using (private.owns_memory(memory_id));
create policy timeline_insert on public.memory_timeline
  for insert to authenticated with check (private.owns_draft(memory_id));
create policy timeline_update on public.memory_timeline
  for update to authenticated
  using (private.owns_draft(memory_id)) with check (private.owns_draft(memory_id));
create policy timeline_delete on public.memory_timeline
  for delete to authenticated using (private.owns_draft(memory_id));

-- media: rows are created only by the server, which picks the storage path.
grant select, delete on public.memory_media to authenticated;
grant update (section_id, alt, position) on public.memory_media to authenticated;

create policy media_select on public.memory_media
  for select to authenticated using (private.owns_memory(memory_id));
create policy media_update on public.memory_media
  for update to authenticated
  using (private.owns_draft(memory_id)) with check (private.owns_draft(memory_id));
create policy media_delete on public.memory_media
  for delete to authenticated using (private.owns_draft(memory_id));

-- collaboration links: the token hash never leaves the database.
grant select (id, memory_id, label, expires_at, revoked_at, created_at)
  on public.collaboration_links to authenticated;
grant insert (id, memory_id, token_hash, label, expires_at, revoked_at) on public.collaboration_links to authenticated;
grant update (revoked_at) on public.collaboration_links to authenticated;

create policy links_select on public.collaboration_links
  for select to authenticated using (private.owns_memory(memory_id));
create policy links_insert on public.collaboration_links
  for insert to authenticated with check (private.owns_draft(memory_id));
create policy links_update on public.collaboration_links
  for update to authenticated
  using (private.owns_memory(memory_id)) with check (private.owns_memory(memory_id));

-- contributions: inserted through submit_contribution only
grant select, delete on public.memory_contributions to authenticated;
grant update (status) on public.memory_contributions to authenticated;

create policy contributions_select on public.memory_contributions
  for select to authenticated using (private.owns_memory(memory_id));
create policy contributions_update on public.memory_contributions
  for update to authenticated
  using (private.owns_draft(memory_id)) with check (private.owns_draft(memory_id));
create policy contributions_delete on public.memory_contributions
  for delete to authenticated using (private.owns_draft(memory_id));

-- recipient responses: inserted through submit_response only
grant select on public.recipient_responses to authenticated;
grant update (read_at) on public.recipient_responses to authenticated;

create policy responses_select on public.recipient_responses
  for select to authenticated using (private.owns_memory(memory_id));
create policy responses_update on public.recipient_responses
  for update to authenticated
  using (private.owns_memory(memory_id)) with check (private.owns_memory(memory_id));

-- payments: read-only for the payer
grant select (id, memory_id, product_id, amount_cents, currency, status, method, approved_at, created_at)
  on public.payments to authenticated;

create policy payments_select_own on public.payments
  for select to authenticated using (owner_id = (select auth.uid()));

-- notifications
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- payment_events, storage_deletions, event_logs, security_events, analytics_events
-- and rate_limits have RLS enabled and no policies: only the service role reaches them.
