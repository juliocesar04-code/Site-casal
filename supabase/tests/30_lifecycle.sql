-- Credit flow, collaboration, recipient responses and deletion.
\set a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
insert into public.memories (owner_id, title) values (:a, 'Outro rascunho');
\set mem '''d0000000-0000-4000-8000-000000000001'''
\set pay '''d0000000-0000-4000-8000-000000000002'''

set role authenticated;
select tests.login(:a);
insert into public.memories (id, owner_id, title, recipient_name, template_id)
values (:mem, :a, 'Surpresa coletiva', 'Clara', 'colaborativo');
insert into public.collaboration_links (id, memory_id, token_hash)
values ('d0000000-0000-4000-8000-000000000003', :mem, extensions.digest('token-valido', 'sha256'));
insert into public.collaboration_links (id, memory_id, token_hash, revoked_at)
values ('d0000000-0000-4000-8000-000000000004', :mem, extensions.digest('token-revogado', 'sha256'), now());
insert into public.collaboration_links (id, memory_id, token_hash, expires_at)
values ('d0000000-0000-4000-8000-000000000005', :mem, extensions.digest('token-expirado', 'sha256'), now() - interval '1 minute');
reset role;

insert into public.memory_media (memory_id, kind, status, storage_path, poster_path)
values (:mem, 'video', 'ready',
        'd0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000009/video.mp4',
        'd0000000-0000-4000-8000-000000000001/d0000000-0000-4000-8000-000000000009/poster.webp');

set role service_role;
select tests.expect_equal('valid token opens contribution form',
  public.contribution_context(extensions.digest('token-valido', 'sha256')) ->> 'state', 'open');
select tests.expect_equal('revoked token is invalid',
  public.contribution_context(extensions.digest('token-revogado', 'sha256')) ->> 'state', 'invalid');
select tests.expect_equal('expired token is invalid',
  public.contribution_context(extensions.digest('token-expirado', 'sha256')) ->> 'state', 'invalid');
select tests.expect_equal('unknown token is invalid',
  public.contribution_context(extensions.digest('chute', 'sha256')) ->> 'state', 'invalid');
select tests.expect_ok('contribution accepted with valid token',
  $$select public.submit_contribution(extensions.digest('token-valido', 'sha256'), ' Rafa ', 'Feliz aniversário!')$$);
select tests.expect_error('revoked token rejected',
  $$select public.submit_contribution(extensions.digest('token-revogado', 'sha256'), 'x', 'y')$$, 'invalid_link');
select tests.expect_error('oversized contribution rejected',
  $$select public.submit_contribution(extensions.digest('token-valido', 'sha256'), 'x', repeat('a', 2001))$$);
select tests.expect_error('empty author rejected',
  $$select public.submit_contribution(extensions.digest('token-valido', 'sha256'), '   ', 'y')$$);
reset role;

select tests.expect_equal('contribution stored trimmed and pending',
  (select author_name || ':' || status from public.memory_contributions where memory_id = :mem), 'Rafa:pending');
select tests.expect_equal('owner notified of contribution',
  (select count(*)::int from public.notifications where memory_id = :mem and type = 'contribution_received'), 1);

set role authenticated;
select tests.login(:a);
select tests.expect_ok('owner approves contribution',
  format($$update public.memory_contributions set status = 'approved' where memory_id = %L$$, :mem));
select tests.expect_error('owner cannot rewrite contributor text',
  format($$update public.memory_contributions set body = 'outro' where memory_id = %L$$, :mem));

-- Pay, go back to edit before the webhook arrives: payment becomes credit.
select public.submit_for_payment(:mem);
reset role;
insert into public.payments (id, memory_id, owner_id, provider, product_id, amount_cents)
values (:pay, :mem, :a, 'mercadopago', 'memory_standard', 999);
set role authenticated;
select tests.login(:a);
select public.return_to_draft(:mem);
select tests.expect_ok('owner edits again after returning to draft',
  format($$update public.memories set title = 'Surpresa coletiva!' where id = %L$$, :mem));
reset role;

set role service_role;
select tests.expect_equal('approval during edit becomes credit',
  public.record_payment_approval(:pay, 'mp-9', 999, 'BRL', 'pix') ->> 'outcome', 'credited');
reset role;
select tests.expect_equal('memory stays draft after credit',
  (select status::text from public.memories where id = :mem), 'draft');

set role authenticated;
select tests.login(:a);
select public.submit_for_payment(:mem);
reset role;
set role service_role;
select tests.expect_equal('credit publishes without a new payment',
  public.publish_with_credit(:mem) ->> 'status', 'published');
select tests.expect_equal('contribution link closes after publish',
  public.contribution_context(extensions.digest('token-valido', 'sha256')) ->> 'state', 'closed');
select tests.expect_error('contributions rejected after publish',
  $$select public.submit_contribution(extensions.digest('token-valido', 'sha256'), 'x', 'y')$$, 'closed');
reset role;

select tests.expect_equal('snapshot reflects edited title',
  (select content_snapshot ->> 'title' from public.memories where id = :mem), 'Surpresa coletiva!');

-- Recipient responses live outside the snapshot.
set role service_role;
select tests.expect_ok('recipient can respond',
  format($$select public.submit_response((select public_slug from public.memories where id = %L), 'Clara', 'Chorei!')$$, :mem));
select tests.expect_error('empty response rejected',
  format($$select public.submit_response((select public_slug from public.memories where id = %L), null, '')$$, :mem));
select tests.expect_error('cannot respond to a draft',
  $$select public.submit_response((select public_slug from public.memories where status = 'draft' limit 1), null, 'x')$$,
  'not_found');
reset role;
select tests.expect_equal('response does not change hash',
  (public.verify_memory_integrity(:mem) ->> 'rows_match_snapshot'), 'true');

set role service_role;
do $$
begin
  for i in 1..19 loop
    perform public.submit_response(
      (select public_slug from public.memories where id = 'd0000000-0000-4000-8000-000000000001'), null, 'resposta ' || i);
  end loop;
end;
$$;
select tests.expect_error('response limit per memory',
  format($$select public.submit_response((select public_slug from public.memories where id = %L), null, 'x')$$, :mem),
  'limit_reached');
reset role;

-- Deletion.

set role authenticated;
select tests.login(:a);
select tests.expect_ok('owner deletes published memory', format('select public.delete_memory(%L)', :mem));
select tests.expect_equal('deleted memory disappears from owner list',
  (select count(*)::int from public.memories where id = :mem), 0);
select tests.expect_error('deleting twice fails', format('select public.delete_memory(%L)', :mem), 'not_found');
reset role;

select tests.expect_equal('tombstone keeps no content',
  (select coalesce(title, message, recipient_name, content_snapshot::text) is null from public.memories where id = :mem), true);
select tests.expect_equal('children removed',
  (select count(*)::int from public.memory_contributions where memory_id = :mem)
  + (select count(*)::int from public.recipient_responses where memory_id = :mem)
  + (select count(*)::int from public.memory_media where memory_id = :mem), 0);
select tests.expect_equal('storage objects queued for deletion',
  (select count(*)::int from public.storage_deletions where path like 'd0000000-0000-4000-8000-000000000001/%'), 2);
select tests.expect_equal('payment kept as financial record',
  (select status::text from public.payments where id = :pay), 'approved');

set role service_role;
select tests.expect_equal('deleted link answers like an unknown one',
  (select public.get_public_memory(public_slug) ->> 'state' from public.memories where id = :mem), 'not_found');
select tests.expect_error('deleted memory cannot be revived',
  format($$update public.memories set status = 'published' where id = %L$$, :mem), 'memory_deleted');
reset role;
