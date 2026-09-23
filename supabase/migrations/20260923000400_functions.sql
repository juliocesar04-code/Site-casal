-- Owner-facing operations (callable by authenticated users through the API).
-- Each one resolves the caller with auth.uid() and never trusts arguments for identity.

create function public.submit_for_payment(p_memory_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.memories;
begin
  select * into m from public.memories
  where id = p_memory_id and owner_id = auth.uid()
  for update;

  if not found or m.status <> 'draft' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if coalesce(btrim(m.title), '') = '' or coalesce(btrim(m.recipient_name), '') = '' then
    raise exception 'incomplete' using errcode = 'P0001';
  end if;

  if m.release_at is not null and m.release_at > now() + interval '5 years' then
    raise exception 'release_too_far' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.memory_media where memory_id = m.id and status = 'pending') then
    raise exception 'uploads_in_progress' using errcode = 'P0001';
  end if;

  update public.memories set status = 'awaiting_payment' where id = m.id;

  insert into public.event_logs (action, actor_id, memory_id)
  values ('memory_submitted', auth.uid(), m.id);
end;
$$;

create function public.return_to_draft(p_memory_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.memories;
begin
  select * into m from public.memories
  where id = p_memory_id and owner_id = auth.uid()
  for update;

  if not found or m.status <> 'awaiting_payment' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.memories set status = 'draft' where id = m.id;

  insert into public.event_logs (action, actor_id, memory_id)
  values ('memory_returned_to_draft', auth.uid(), m.id);
end;
$$;

-- Content is removed at once; storage objects are queued by the media trigger.
-- Payments stay (without content) because they are financial records.
create function public.delete_memory(p_memory_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.memories;
begin
  select * into m from public.memories
  where id = p_memory_id and owner_id = auth.uid()
  for update;

  if not found or m.status = 'deleted' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  update public.memories set
    status = 'deleted',
    deleted_at = now(),
    title = null,
    recipient_name = null,
    sender_name = null,
    opening_line = null,
    message = null,
    closing_line = null,
    occasion = null,
    release_at = null,
    content_snapshot = null
  where id = m.id;

  delete from public.memory_timeline where memory_id = m.id;
  delete from public.memory_media where memory_id = m.id;
  delete from public.memory_sections where memory_id = m.id;
  delete from public.memory_contributions where memory_id = m.id;
  delete from public.collaboration_links where memory_id = m.id;
  delete from public.recipient_responses where memory_id = m.id;
  delete from public.notifications where memory_id = m.id;

  insert into public.event_logs (action, actor_id, memory_id)
  values ('memory_deleted', auth.uid(), m.id);
end;
$$;

-- Canonical snapshot. jsonb normalises key order, so snapshot::text is a
-- stable serialisation for hashing.
create function private.media_json(md public.memory_media)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', md.id,
    'kind', md.kind,
    'path', md.storage_path,
    'poster', md.poster_path,
    'thumb', md.thumb_path,
    'width', md.width,
    'height', md.height,
    'duration_ms', md.duration_ms,
    'checksum', md.checksum,
    'alt', md.alt
  );
$$;

create function private.build_memory_snapshot(p_memory_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 1,
    'slug', m.public_slug,
    'template', m.template_id,
    'theme', m.theme,
    'occasion', m.occasion,
    'title', m.title,
    'recipient', m.recipient_name,
    'sender', m.sender_name,
    'opening', m.opening_line,
    'message', m.message,
    'closing', m.closing_line,
    'release_at', m.release_at,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'title', s.title,
        'body', s.body,
        'date', s.event_date,
        'transition', s.transition,
        'media', coalesce((
          select jsonb_agg(private.media_json(md) order by md.position, md.id)
          from public.memory_media md
          where md.section_id = s.id and md.status = 'ready' and md.contribution_id is null
        ), '[]'::jsonb)
      ) order by s.position, s.id)
      from public.memory_sections s where s.memory_id = m.id
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'date', t.event_date,
        'title', t.title,
        'body', t.body,
        'media', (
          select private.media_json(md) from public.memory_media md
          where md.id = t.media_id and md.status = 'ready'
        )
      ) order by t.position, t.id)
      from public.memory_timeline t where t.memory_id = m.id
    ), '[]'::jsonb),
    'gallery', coalesce((
      select jsonb_agg(private.media_json(md) order by md.position, md.id)
      from public.memory_media md
      where md.memory_id = m.id and md.status = 'ready'
        and md.section_id is null and md.contribution_id is null
        and not exists (select 1 from public.memory_timeline t where t.media_id = md.id)
    ), '[]'::jsonb),
    'contributions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id,
        'author', c.author_name,
        'body', c.body,
        'media', coalesce((
          select jsonb_agg(private.media_json(md) order by md.position, md.id)
          from public.memory_media md
          where md.contribution_id = c.id and md.status = 'ready'
        ), '[]'::jsonb)
      ) order by c.created_at, c.id)
      from public.memory_contributions c
      where c.memory_id = m.id and c.status = 'approved'
    ), '[]'::jsonb)
  )
  from public.memories m
  where m.id = p_memory_id;
$$;

-- Service role only. Idempotent: publishing twice returns the first result.
create function public.publish_memory(p_memory_id uuid, p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.memories;
  p public.payments;
  snap jsonb;
  target public.memory_status;
begin
  select * into m from public.memories where id = p_memory_id for update;

  if not found or m.status = 'deleted' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if m.status in ('scheduled', 'published') then
    return jsonb_build_object('status', m.status, 'hash', m.content_hash, 'already', true);
  end if;

  if m.status not in ('awaiting_payment', 'paid') then
    raise exception 'not_ready' using errcode = 'P0001';
  end if;

  select * into p from public.payments where id = p_payment_id for update;

  if not found or p.status <> 'approved' or p.memory_id is distinct from m.id then
    raise exception 'payment_not_approved' using errcode = 'P0001';
  end if;

  update public.memory_contributions
  set status = 'locked', reviewed_at = now()
  where memory_id = m.id and status = 'pending';

  snap := private.build_memory_snapshot(m.id);
  target := case when m.release_at is not null and m.release_at > now() then 'scheduled' else 'published' end;

  update public.memories set
    status = target,
    paid_payment_id = coalesce(m.paid_payment_id, p.id),
    content_snapshot = snap,
    content_hash = private.sha256_hex(snap::text),
    published_at = now()
  where id = m.id
  returning * into m;

  insert into public.event_logs (action, actor_id, memory_id, meta)
  values ('memory_published', m.owner_id, m.id, jsonb_build_object('status', target, 'payment_id', p.id));

  insert into public.notifications (user_id, memory_id, type)
  values (m.owner_id, m.id, case when target = 'scheduled' then 'memory_scheduled' else 'memory_published' end);

  return jsonb_build_object('status', m.status, 'hash', m.content_hash, 'already', false);
end;
$$;

-- Called by the webhook after the provider confirmed the payment. One
-- transaction covers approval and publication, so a crash cannot leave a paid
-- memory unpublished without a retry path (the webhook is retried by the provider).
create function public.record_payment_approval(
  p_payment_id uuid,
  p_provider_payment_id text,
  p_amount_cents int,
  p_currency text,
  p_method text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.payments;
  m public.memories;
  result jsonb;
begin
  select * into p from public.payments where id = p_payment_id for update;

  if not found then
    raise exception 'payment_not_found' using errcode = 'P0002';
  end if;

  if p.amount_cents <> p_amount_cents or p.currency <> p_currency then
    insert into public.security_events (type, severity, meta)
    values ('payment_amount_mismatch', 'critical', jsonb_build_object(
      'payment_id', p.id, 'expected', p.amount_cents, 'received', p_amount_cents, 'currency', p_currency
    ));
    raise exception 'amount_mismatch' using errcode = 'P0001';
  end if;

  if p.provider_payment_id is not null and p.provider_payment_id <> p_provider_payment_id then
    -- A second approved charge for the same checkout. Keep the first as the
    -- source of truth and flag for manual refund review.
    insert into public.security_events (type, severity, meta)
    values ('payment_duplicate_charge', 'warning', jsonb_build_object('payment_id', p.id));
    return jsonb_build_object('outcome', 'duplicate_charge');
  end if;

  if p.status <> 'approved' then
    update public.payments set
      status = 'approved',
      provider_payment_id = p_provider_payment_id,
      method = left(p_method, 40),
      approved_at = now()
    where id = p.id;

    if p.owner_id is not null then
      insert into public.notifications (user_id, memory_id, type)
      values (p.owner_id, p.memory_id, 'payment_confirmed');
    end if;
  end if;

  if p.memory_id is null then
    return jsonb_build_object('outcome', 'approved_without_memory');
  end if;

  select * into m from public.memories where id = p.memory_id for update;

  if not found or m.status = 'deleted' then
    return jsonb_build_object('outcome', 'approved_memory_deleted');
  end if;

  if m.status in ('scheduled', 'published') then
    return jsonb_build_object('outcome', 'already_published');
  end if;

  if m.status = 'draft' then
    -- The owner went back to editing; keep the payment as credit for the
    -- next publish instead of publishing content they have not re-reviewed.
    update public.memories set paid_payment_id = p.id
    where id = m.id and paid_payment_id is null;
    return jsonb_build_object('outcome', 'credited');
  end if;

  result := public.publish_memory(m.id, p.id);
  return jsonb_build_object('outcome', 'published', 'publish', result);
end;
$$;

create function public.record_payment_status(
  p_payment_id uuid,
  p_status public.payment_status,
  p_provider_payment_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status = 'approved' then
    raise exception 'use_record_payment_approval' using errcode = 'P0001';
  end if;

  -- Never downgrade an approved payment from an out-of-order notification.
  update public.payments set
    status = p_status,
    provider_payment_id = coalesce(provider_payment_id, p_provider_payment_id)
  where id = p_payment_id and status not in ('approved', 'refunded');
end;
$$;

-- Owner already holds a paid credit (paid, then went back to edit).
create function public.publish_with_credit(p_memory_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.memories;
begin
  select * into m from public.memories where id = p_memory_id for update;

  if not found or m.paid_payment_id is null or m.status <> 'awaiting_payment' then
    raise exception 'not_ready' using errcode = 'P0001';
  end if;

  return public.publish_memory(m.id, m.paid_payment_id);
end;
$$;

-- Public read path. Returns only what the current moment allows: nothing for
-- unknown/draft/deleted, a countdown before release, the snapshot after.
create function public.get_public_memory(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.memories;
begin
  if p_slug is null or p_slug !~ '^[0-9A-Za-z]{14}$' then
    return jsonb_build_object('state', 'not_found');
  end if;

  select * into m from public.memories where public_slug = p_slug;

  if not found or m.status not in ('scheduled', 'published') then
    return jsonb_build_object('state', 'not_found');
  end if;

  if m.release_at is not null and m.release_at > now() then
    return jsonb_build_object(
      'state', 'scheduled',
      'release_at', m.release_at,
      'recipient', m.content_snapshot ->> 'recipient',
      'server_now', now()
    );
  end if;

  return jsonb_build_object(
    'state', 'open',
    'memory_id', m.id,
    'snapshot', m.content_snapshot,
    'hash', m.content_hash,
    'published_at', m.published_at,
    'intact', private.sha256_hex(m.content_snapshot::text) = m.content_hash,
    'server_now', now()
  );
end;
$$;

-- Full check: stored snapshot vs its hash, and live rows vs the snapshot.
create function public.verify_memory_integrity(p_memory_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  m public.memories;
  rebuilt jsonb;
begin
  select * into m from public.memories where id = p_memory_id;

  if not found or m.content_hash is null then
    return jsonb_build_object('checked', false);
  end if;

  rebuilt := private.build_memory_snapshot(m.id);

  return jsonb_build_object(
    'checked', true,
    'snapshot_matches_hash', private.sha256_hex(m.content_snapshot::text) = m.content_hash,
    'rows_match_snapshot', private.sha256_hex(rebuilt::text) = m.content_hash
  );
end;
$$;

create function public.contribution_context(p_token_hash bytea)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  l public.collaboration_links;
  m public.memories;
begin
  select * into l from public.collaboration_links where token_hash = p_token_hash;

  if not found or l.revoked_at is not null or (l.expires_at is not null and l.expires_at <= now()) then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into m from public.memories where id = l.memory_id;

  if m.status <> 'draft' then
    return jsonb_build_object('state', 'closed');
  end if;

  return jsonb_build_object(
    'state', 'open',
    'link_id', l.id,
    'memory_id', m.id,
    'recipient', m.recipient_name,
    'sender', m.sender_name
  );
end;
$$;

create function public.submit_contribution(p_token_hash bytea, p_author text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l public.collaboration_links;
  m public.memories;
  new_id uuid;
begin
  select * into l from public.collaboration_links where token_hash = p_token_hash;

  if not found or l.revoked_at is not null or (l.expires_at is not null and l.expires_at <= now()) then
    raise exception 'invalid_link' using errcode = 'P0002';
  end if;

  select * into m from public.memories where id = l.memory_id for update;

  if m.status <> 'draft' then
    raise exception 'closed' using errcode = 'P0001';
  end if;

  insert into public.memory_contributions (memory_id, link_id, author_name, body)
  values (m.id, l.id, btrim(p_author), coalesce(btrim(p_body), ''))
  returning id into new_id;

  insert into public.notifications (user_id, memory_id, type)
  values (m.owner_id, m.id, 'contribution_received');

  return jsonb_build_object('contribution_id', new_id, 'memory_id', m.id);
end;
$$;

create function public.submit_response(p_slug text, p_author text, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.memories;
begin
  select * into m from public.memories where public_slug = p_slug for update;

  if not found or m.status not in ('scheduled', 'published')
     or (m.release_at is not null and m.release_at > now()) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if (select count(*) from public.recipient_responses where memory_id = m.id) >= 20 then
    raise exception 'limit_reached' using errcode = 'P0001';
  end if;

  insert into public.recipient_responses (memory_id, author_name, body)
  values (m.id, nullif(btrim(p_author), ''), btrim(p_body));

  insert into public.notifications (user_id, memory_id, type)
  values (m.owner_id, m.id, 'response_received');
end;
$$;

-- Fixed-window counter. Returns true while the caller is under the limit.
create function public.rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits int;
begin
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

create function public.release_due_memories()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  released int;
begin
  with due as (
    update public.memories set status = 'published'
    where status = 'scheduled' and release_at <= now()
    returning id, owner_id
  ), notified as (
    insert into public.notifications (user_id, memory_id, type)
    select owner_id, id, 'memory_released' from due
    returning 1
  )
  select count(*) into released from notified;

  return released;
end;
$$;

create function public.sweep_integrity()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  broken int;
begin
  with checked as (
    select m.id, public.verify_memory_integrity(m.id) as result
    from public.memories m
    where m.status in ('scheduled', 'published')
  ), failed as (
    insert into public.security_events (type, severity, meta)
    select 'integrity_mismatch', 'critical', jsonb_build_object('memory_id', id, 'result', result)
    from checked
    where not (result ->> 'snapshot_matches_hash')::boolean
       or not (result ->> 'rows_match_snapshot')::boolean
    returning 1
  )
  select count(*) into broken from failed;

  return broken;
end;
$$;

create function public.purge_rate_limits()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.submit_for_payment(uuid) to authenticated;
grant execute on function public.return_to_draft(uuid) to authenticated;
grant execute on function public.delete_memory(uuid) to authenticated;

grant execute on function public.publish_memory(uuid, uuid) to service_role;
grant execute on function public.record_payment_approval(uuid, text, int, text, text) to service_role;
grant execute on function public.record_payment_status(uuid, public.payment_status, text) to service_role;
grant execute on function public.publish_with_credit(uuid) to service_role;
grant execute on function public.get_public_memory(text) to service_role;
grant execute on function public.verify_memory_integrity(uuid) to service_role;
grant execute on function public.contribution_context(bytea) to service_role;
grant execute on function public.submit_contribution(bytea, text, text) to service_role;
grant execute on function public.submit_response(text, text, text) to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.release_due_memories() to service_role;
grant execute on function public.sweep_integrity() to service_role;
grant execute on function public.purge_rate_limits() to service_role;
