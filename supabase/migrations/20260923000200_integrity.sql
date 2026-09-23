-- Integrity rules enforced by the database regardless of the calling role.
-- The application layer checks the same things, but these triggers are the
-- guarantee: a published memory cannot change even with the service role.

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger memories_touch before update on public.memories
  for each row execute function private.touch_updated_at();
create trigger memory_sections_touch before update on public.memory_sections
  for each row execute function private.touch_updated_at();
create trigger memory_media_touch before update on public.memory_media
  for each row execute function private.touch_updated_at();
create trigger memory_timeline_touch before update on public.memory_timeline
  for each row execute function private.touch_updated_at();
create trigger payments_touch before update on public.payments
  for each row execute function private.touch_updated_at();

create function private.is_client_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;

create function private.memory_transition_allowed(from_status public.memory_status, to_status public.memory_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (from_status::text || '>' || to_status::text) = any (array[
    'draft>awaiting_payment', 'draft>deleted',
    'awaiting_payment>draft', 'awaiting_payment>paid', 'awaiting_payment>scheduled',
    'awaiting_payment>published', 'awaiting_payment>deleted',
    'paid>scheduled', 'paid>published', 'paid>deleted',
    'scheduled>published', 'scheduled>deleted',
    'published>deleted'
  ]);
$$;

create function private.memories_before_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.status := 'draft';
  new.content_snapshot := null;
  new.content_hash := null;
  new.published_at := null;
  new.paid_payment_id := null;
  new.deleted_at := null;
  new.created_at := now();
  new.updated_at := now();

  if (
    select count(*) from public.memories
    where owner_id = new.owner_id and status = 'draft'
  ) >= 50 then
    raise exception 'draft_limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger memories_before_insert before insert on public.memories
  for each row execute function private.memories_before_insert();

create function private.memories_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'deleted' then
    raise exception 'memory_deleted' using errcode = '42501';
  end if;

  if new.id <> old.id or new.owner_id <> old.owner_id
     or new.public_slug <> old.public_slug or new.created_at <> old.created_at then
    raise exception 'immutable_column' using errcode = '42501';
  end if;

  if new.status <> old.status
     and not private.memory_transition_allowed(old.status, new.status) then
    raise exception 'invalid_transition % -> %', old.status, new.status using errcode = '42501';
  end if;

  -- Deletion turns the row into a tombstone; nothing else about it matters.
  if new.status = 'deleted' then
    return new;
  end if;

  -- Write-once publication fields.
  if (old.content_snapshot is not null and new.content_snapshot is distinct from old.content_snapshot)
     or (old.content_hash is not null and new.content_hash is distinct from old.content_hash)
     or (old.published_at is not null and new.published_at is distinct from old.published_at)
     or (old.paid_payment_id is not null and new.paid_payment_id is distinct from old.paid_payment_id) then
    raise exception 'write_once_column' using errcode = '42501';
  end if;

  if old.status <> 'draft' and (
       new.template_id is distinct from old.template_id
    or new.theme is distinct from old.theme
    or new.occasion is distinct from old.occasion
    or new.title is distinct from old.title
    or new.recipient_name is distinct from old.recipient_name
    or new.sender_name is distinct from old.sender_name
    or new.opening_line is distinct from old.opening_line
    or new.message is distinct from old.message
    or new.closing_line is distinct from old.closing_line
    or new.release_at is distinct from old.release_at
  ) then
    raise exception 'memory_frozen' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger memories_before_update before update on public.memories
  for each row execute function private.memories_before_update();

-- Rows are never hard-deleted from the client side; the tombstone keeps the
-- slug reserved so an old link can never point at new content.
create function private.memories_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    raise exception 'use_delete_memory' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger memories_before_delete before delete on public.memories
  for each row execute function private.memories_before_delete();

create function private.memory_status_of(p_memory_id uuid)
returns public.memory_status
language sql
stable
security definer
set search_path = ''
as $$
  select status from public.memories where id = p_memory_id;
$$;

-- Shared freeze rule for every table that belongs to a memory.
create function private.children_freeze()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_status public.memory_status;
  target_memory uuid;
begin
  if tg_op = 'UPDATE' and new.memory_id <> old.memory_id then
    raise exception 'immutable_column' using errcode = '42501';
  end if;

  target_memory := case when tg_op = 'DELETE' then old.memory_id else new.memory_id end;
  parent_status := private.memory_status_of(target_memory);

  -- Parent already gone: this is a cascade from an account deletion.
  if parent_status is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if parent_status = 'draft' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if parent_status = 'deleted' and tg_op = 'DELETE' then
    return old;
  end if;

  -- PL/pgSQL does not short-circuit AND, so table-specific fields are only
  -- read inside the branch for that table.
  if tg_table_name = 'memory_contributions' and tg_op = 'UPDATE' then
    -- Publishing locks contributions that were never reviewed.
    if old.status = 'pending' and new.status = 'locked'
       and new.author_name = old.author_name and new.body = old.body
       and parent_status in ('awaiting_payment', 'paid') then
      return new;
    end if;
  elsif tg_table_name = 'memory_media' and tg_op = 'DELETE' then
    -- Unfinished uploads never make it into a snapshot and can be swept anytime.
    if old.status <> 'ready' then
      return old;
    end if;
  elsif tg_table_name = 'collaboration_links' and tg_op = 'UPDATE' then
    -- Revoking a collaboration link does not touch content.
    if new.token_hash = old.token_hash and new.revoked_at is not null then
      return new;
    end if;
  end if;

  raise exception 'memory_frozen' using errcode = '42501';
end;
$$;

create trigger memory_sections_freeze before insert or update or delete on public.memory_sections
  for each row execute function private.children_freeze();
create trigger memory_media_freeze before insert or update or delete on public.memory_media
  for each row execute function private.children_freeze();
create trigger memory_timeline_freeze before insert or update or delete on public.memory_timeline
  for each row execute function private.children_freeze();
create trigger memory_contributions_freeze before insert or update or delete on public.memory_contributions
  for each row execute function private.children_freeze();
create trigger collaboration_links_freeze before insert or update or delete on public.collaboration_links
  for each row execute function private.children_freeze();

-- Per-memory quotas against storage and spam abuse.
create function private.enforce_child_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  current_count int;
  max_count int;
begin
  max_count := case tg_table_name
    when 'memory_sections' then 12
    when 'memory_timeline' then 40
    when 'memory_media' then 60
    when 'memory_contributions' then 100
    when 'collaboration_links' then 10
  end;

  execute format('select count(*) from public.%I where memory_id = $1', tg_table_name)
    into current_count using new.memory_id;

  if current_count >= max_count then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger memory_sections_limit before insert on public.memory_sections
  for each row execute function private.enforce_child_limits();
create trigger memory_media_limit before insert on public.memory_media
  for each row execute function private.enforce_child_limits();
create trigger memory_timeline_limit before insert on public.memory_timeline
  for each row execute function private.enforce_child_limits();
create trigger memory_contributions_limit before insert on public.memory_contributions
  for each row execute function private.enforce_child_limits();
create trigger collaboration_links_limit before insert on public.collaboration_links
  for each row execute function private.enforce_child_limits();

-- Cross-references must stay inside the same memory, otherwise a crafted id
-- could pull someone else's media into a snapshot.
create function private.media_same_memory()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.section_id is not null and not exists (
    select 1 from public.memory_sections where id = new.section_id and memory_id = new.memory_id
  ) then
    raise exception 'section_mismatch' using errcode = '42501';
  end if;

  if new.contribution_id is not null and not exists (
    select 1 from public.memory_contributions where id = new.contribution_id and memory_id = new.memory_id
  ) then
    raise exception 'contribution_mismatch' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and private.is_client_role() and (
       new.storage_path <> old.storage_path
    or new.poster_path is distinct from old.poster_path
    or new.thumb_path is distinct from old.thumb_path
    or new.status <> old.status
    or new.kind <> old.kind
    or new.checksum is distinct from old.checksum
    or new.contribution_id is distinct from old.contribution_id
  ) then
    raise exception 'immutable_column' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger memory_media_same_memory before insert or update on public.memory_media
  for each row execute function private.media_same_memory();

create function private.timeline_same_memory()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.media_id is not null and not exists (
    select 1 from public.memory_media where id = new.media_id and memory_id = new.memory_id
  ) then
    raise exception 'media_mismatch' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger memory_timeline_same_memory before insert or update on public.memory_timeline
  for each row execute function private.timeline_same_memory();

create function private.contributions_client_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_client_role() then
    if new.author_name <> old.author_name or new.body <> old.body
       or new.link_id is distinct from old.link_id
       or new.status not in ('pending', 'approved', 'rejected') then
      raise exception 'immutable_column' using errcode = '42501';
    end if;
    new.reviewed_at := case when new.status = 'pending' then null else now() end;
  end if;
  return new;
end;
$$;

create trigger memory_contributions_client_update before update on public.memory_contributions
  for each row execute function private.contributions_client_update();

-- Any removed media row schedules its objects for deletion, whatever caused it.
create function private.media_enqueue_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.storage_deletions (bucket, path)
  select 'media', p
  from unnest(array[old.storage_path, old.poster_path, old.thumb_path]) as p
  where p is not null;
  return old;
end;
$$;

create trigger memory_media_enqueue_deletion after delete on public.memory_media
  for each row execute function private.media_enqueue_deletion();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )), 80), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
