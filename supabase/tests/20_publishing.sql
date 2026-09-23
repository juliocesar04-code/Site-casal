-- Publication, payment rules and immutability after publishing.
\set a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set mem '''c0000000-0000-4000-8000-000000000001'''

set role authenticated;
select tests.login(:a);
insert into public.memories (id, owner_id, title, recipient_name, sender_name, message)
values (:mem, :a, 'Dez anos', 'Marina', 'Pedro', 'Obrigado por tudo.');
insert into public.memory_sections (id, memory_id, title, body, position)
values ('c0000000-0000-4000-8000-000000000002', :mem, 'Como tudo começou', 'Foi numa terça.', 0);
reset role;

insert into public.memory_media (id, memory_id, section_id, kind, status, storage_path, checksum)
values ('c0000000-0000-4000-8000-000000000003', :mem, 'c0000000-0000-4000-8000-000000000002', 'image', 'ready',
        'c0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000003/image.webp', repeat('0', 64));
insert into public.memory_contributions (id, memory_id, author_name, body, status)
values ('c0000000-0000-4000-8000-000000000004', :mem, 'Ana', 'Parabéns!', 'approved'),
       ('c0000000-0000-4000-8000-000000000005', :mem, 'João', 'Sem revisão', 'pending');
insert into public.payments (id, memory_id, owner_id, provider, product_id, amount_cents)
values ('c0000000-0000-4000-8000-000000000006', :mem, :a, 'mercadopago', 'memory_standard', 999);

set role service_role;
select tests.expect_error('cannot publish a draft',
  format('select public.publish_memory(%L, %L)', :mem, 'c0000000-0000-4000-8000-000000000006'), 'not_ready');
reset role;

set role authenticated;
select tests.login(:a);
select tests.expect_ok('owner submits for payment', format('select public.submit_for_payment(%L)', :mem));
select tests.expect_blocked('owner cannot edit while awaiting payment',
  format($$update public.memories set title = 'outro' where id = %L$$, :mem));
select tests.expect_error('owner cannot add section while awaiting payment',
  format($$insert into public.memory_sections (memory_id, title) values (%L, 'x')$$, :mem));
reset role;

set role service_role;
select tests.expect_error('service role cannot edit content awaiting payment',
  format($$update public.memories set title = 'outro' where id = %L$$, :mem), 'memory_frozen');
select tests.expect_error('publish requires an approved payment',
  format('select public.publish_memory(%L, %L)', :mem, 'c0000000-0000-4000-8000-000000000006'), 'payment_not_approved');
select tests.expect_error('provider amount must match server price',
  $$select public.record_payment_approval('c0000000-0000-4000-8000-000000000006', 'mp-1', 1, 'BRL', 'pix')$$,
  'amount_mismatch');
select tests.expect_equal('amount mismatch leaves payment unapproved',
  (select status::text from public.payments where id = 'c0000000-0000-4000-8000-000000000006'), 'created');

select tests.expect_equal('approval publishes the memory',
  public.record_payment_approval('c0000000-0000-4000-8000-000000000006', 'mp-1', 999, 'BRL', 'pix') ->> 'outcome',
  'published');
select tests.expect_equal('replayed approval is idempotent',
  public.record_payment_approval('c0000000-0000-4000-8000-000000000006', 'mp-1', 999, 'BRL', 'pix') ->> 'outcome',
  'already_published');
select tests.expect_equal('second provider charge is flagged, not applied',
  public.record_payment_approval('c0000000-0000-4000-8000-000000000006', 'mp-2', 999, 'BRL', 'pix') ->> 'outcome',
  'duplicate_charge');
select public.record_payment_status('c0000000-0000-4000-8000-000000000006', 'rejected', 'mp-1');
select tests.expect_equal('late rejection cannot downgrade approval',
  (select status::text from public.payments where id = 'c0000000-0000-4000-8000-000000000006'), 'approved');
select tests.expect_equal('publish twice returns the first result',
  public.publish_memory(:mem, 'c0000000-0000-4000-8000-000000000006') ->> 'already', 'true');
reset role;

select tests.expect_equal('status is published',
  (select status::text from public.memories where id = :mem), 'published');
select tests.expect_equal('hash is sha256 of snapshot',
  (select private.sha256_hex(content_snapshot::text) = content_hash from public.memories where id = :mem), true);
select tests.expect_equal('integrity check passes',
  (public.verify_memory_integrity(:mem) ->> 'rows_match_snapshot'), 'true');
select tests.expect_equal('pending contribution locked on publish',
  (select status::text from public.memory_contributions where id = 'c0000000-0000-4000-8000-000000000005'), 'locked');
select tests.expect_equal('snapshot has only approved contributions',
  (select jsonb_array_length(content_snapshot -> 'contributions') from public.memories where id = :mem), 1);
select tests.expect_equal('snapshot keeps section media',
  (select jsonb_array_length(content_snapshot -> 'sections' -> 0 -> 'media') from public.memories where id = :mem), 1);

-- Immutability: every writer, every column.
set role authenticated;
select tests.login(:a);
select tests.expect_blocked('owner cannot edit published title',
  format($$update public.memories set title = 'x' where id = %L$$, :mem));
select tests.expect_blocked('owner cannot edit published section',
  $$update public.memory_sections set body = 'x' where id = 'c0000000-0000-4000-8000-000000000002'$$);
select tests.expect_blocked('owner cannot reorder published media',
  $$update public.memory_media set position = 5 where id = 'c0000000-0000-4000-8000-000000000003'$$);
select tests.expect_blocked('owner cannot delete published media',
  $$delete from public.memory_media where id = 'c0000000-0000-4000-8000-000000000003'$$);
select tests.expect_blocked('owner cannot change contribution after publish',
  $$update public.memory_contributions set status = 'rejected' where id = 'c0000000-0000-4000-8000-000000000004'$$);
select tests.expect_error('owner cannot return published memory to draft',
  format('select public.return_to_draft(%L)', :mem), 'not_found');
reset role;

set role service_role;
select tests.expect_error('service role cannot change message',
  format($$update public.memories set message = 'x' where id = %L$$, :mem), 'memory_frozen');
select tests.expect_error('service role cannot change release date',
  format($$update public.memories set release_at = now() + interval '1 day' where id = %L$$, :mem), 'memory_frozen');
select tests.expect_error('service role cannot change theme',
  format($$update public.memories set theme = 'noite' where id = %L$$, :mem), 'memory_frozen');
select tests.expect_error('service role cannot rewrite snapshot',
  format($$update public.memories set content_snapshot = '{}' where id = %L$$, :mem), 'write_once');
select tests.expect_error('service role cannot rewrite hash',
  format($$update public.memories set content_hash = repeat('f', 64) where id = %L$$, :mem), 'write_once');
select tests.expect_error('service role cannot unpublish',
  format($$update public.memories set status = 'draft' where id = %L$$, :mem), 'invalid_transition');
select tests.expect_error('service role cannot edit section',
  $$update public.memory_sections set body = 'x' where id = 'c0000000-0000-4000-8000-000000000002'$$, 'memory_frozen');
select tests.expect_error('service role cannot add section',
  format($$insert into public.memory_sections (memory_id) values (%L)$$, :mem), 'memory_frozen');
select tests.expect_error('service role cannot swap media file',
  $$update public.memory_media set storage_path = 'c0000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000003/other.webp'
    where id = 'c0000000-0000-4000-8000-000000000003'$$, 'memory_frozen');
select tests.expect_error('service role cannot delete ready media',
  $$delete from public.memory_media where id = 'c0000000-0000-4000-8000-000000000003'$$, 'memory_frozen');
select tests.expect_error('service role cannot add contribution',
  format($$insert into public.memory_contributions (memory_id, author_name) values (%L, 'x')$$, :mem), 'memory_frozen');
select tests.expect_error('service role cannot unlock contribution',
  $$update public.memory_contributions set status = 'approved' where id = 'c0000000-0000-4000-8000-000000000005'$$, 'memory_frozen');

select tests.expect_equal('public read returns snapshot',
  (select public.get_public_memory(public_slug) ->> 'state' from public.memories where id = :mem), 'open');
select tests.expect_equal('public read reports integrity',
  (select public.get_public_memory(public_slug) ->> 'intact' from public.memories where id = :mem), 'true');
select tests.expect_equal('malformed slug is not found',
  public.get_public_memory('../../etc/passwd') ->> 'state', 'not_found');
select tests.expect_equal('unknown slug is not found',
  public.get_public_memory('ZZZZZZZZZZZZZZ') ->> 'state', 'not_found');
reset role;

-- Draft memories never leak through the public path.
insert into public.memories (id, owner_id, title) values ('c0000000-0000-4000-8000-000000000009', :a, 'Rascunho');
select tests.expect_equal('draft memory is not public',
  (select public.get_public_memory(public_slug) ->> 'state' from public.memories
   where id = 'c0000000-0000-4000-8000-000000000009'), 'not_found');

-- Tampering with rows underneath a published memory is detected.
alter table public.memory_sections disable trigger memory_sections_freeze;
update public.memory_sections set body = 'adulterado' where id = 'c0000000-0000-4000-8000-000000000002';
alter table public.memory_sections enable trigger memory_sections_freeze;
select tests.expect_equal('tampered rows are detected',
  (public.verify_memory_integrity(:mem) ->> 'rows_match_snapshot'), 'false');
select tests.expect_equal('integrity sweep reports mismatch', public.sweep_integrity(), 1);
