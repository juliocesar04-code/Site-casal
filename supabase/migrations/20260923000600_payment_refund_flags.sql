-- Approved payments that did not buy anything (a second checkout for a memory
-- that was already paid, or a payment for a memory deleted meanwhile) are now
-- reported for refund review instead of passing silently.

create or replace function public.record_payment_approval(
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
    insert into public.security_events (type, severity, meta)
    values ('payment_needs_refund', 'warning', jsonb_build_object(
      'payment_id', p.id, 'reason', 'second_charge_same_checkout'
    ));
    return jsonb_build_object('outcome', 'duplicate_charge');
  end if;

  -- Replays of an already processed approval end here without side effects.
  if p.status = 'approved' then
    select * into m from public.memories where id = p.memory_id;
    if found and m.status in ('scheduled', 'published') then
      return jsonb_build_object('outcome', 'already_published');
    end if;
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
    insert into public.security_events (type, severity, meta)
    values ('payment_needs_refund', 'warning', jsonb_build_object('payment_id', p.id, 'reason', 'memory_removed'));
    return jsonb_build_object('outcome', 'approved_without_memory');
  end if;

  select * into m from public.memories where id = p.memory_id for update;

  if not found or m.status = 'deleted' then
    insert into public.security_events (type, severity, meta)
    values ('payment_needs_refund', 'warning', jsonb_build_object('payment_id', p.id, 'reason', 'memory_deleted'));
    return jsonb_build_object('outcome', 'approved_memory_deleted');
  end if;

  if m.paid_payment_id is not null and m.paid_payment_id <> p.id then
    -- Another payment already covers this memory (two checkouts paid).
    insert into public.security_events (type, severity, meta)
    values ('payment_needs_refund', 'warning', jsonb_build_object(
      'payment_id', p.id, 'reason', 'memory_already_paid', 'memory_id', m.id
    ));
    return jsonb_build_object('outcome', 'duplicate_charge');
  end if;

  if m.status in ('scheduled', 'published') then
    return jsonb_build_object('outcome', 'already_published');
  end if;

  if m.status = 'draft' then
    -- The owner went back to editing; keep the payment as credit for the
    -- next publish instead of publishing content they have not re-reviewed.
    update public.memories set paid_payment_id = p.id where id = m.id;
    return jsonb_build_object('outcome', 'credited');
  end if;

  result := public.publish_memory(m.id, p.id);
  return jsonb_build_object('outcome', 'published', 'publish', result);
end;
$$;

revoke execute on function public.record_payment_approval(uuid, text, int, text, text) from public, anon, authenticated;
grant execute on function public.record_payment_approval(uuid, text, int, text, text) to service_role;
