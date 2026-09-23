-- User A tries every way to reach or change user B's data.
\set a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set b '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''

-- Fixtures owned by B, created as B through RLS.
set role authenticated;
select tests.login(:b);
insert into public.memories (id, owner_id, title, recipient_name)
values ('b0000000-0000-4000-8000-000000000001', :b, 'Memória de B', 'Destinatário');
insert into public.memory_sections (id, memory_id, title)
values ('b0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Capítulo');
insert into public.collaboration_links (memory_id, token_hash)
values ('b0000000-0000-4000-8000-000000000001', extensions.digest('token-b', 'sha256'));
reset role;

insert into public.memory_media (id, memory_id, kind, status, storage_path)
values ('b0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'image', 'ready',
        'b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000003/image.webp');
insert into public.memory_contributions (id, memory_id, author_name, body)
values ('b0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'Amiga', 'Oi');
insert into public.payments (id, memory_id, owner_id, provider, product_id, amount_cents)
values ('b0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', :b, 'mercadopago', 'memory_standard', 999);

set role authenticated;
select tests.login(:a);

select tests.expect_equal('A cannot list B memories',
  (select count(*) from public.memories)::int, 0);
select tests.expect_equal('A cannot read B sections',
  (select count(*) from public.memory_sections)::int, 0);
select tests.expect_equal('A cannot read B media',
  (select count(*) from public.memory_media)::int, 0);
select tests.expect_equal('A cannot read B contributions',
  (select count(*) from public.memory_contributions)::int, 0);
select tests.expect_equal('A cannot read B links',
  (select count(*) from public.collaboration_links)::int, 0);
select tests.expect_equal('A cannot read B payments',
  (select count(*) from public.payments)::int, 0);

select tests.expect_blocked('A cannot update B memory',
  $$update public.memories set title = 'x' where id = 'b0000000-0000-4000-8000-000000000001'$$);
select tests.expect_blocked('A cannot update B section',
  $$update public.memory_sections set title = 'x' where id = 'b0000000-0000-4000-8000-000000000002'$$);
select tests.expect_blocked('A cannot delete B section',
  $$delete from public.memory_sections where id = 'b0000000-0000-4000-8000-000000000002'$$);
select tests.expect_blocked('A cannot delete B media',
  $$delete from public.memory_media where id = 'b0000000-0000-4000-8000-000000000003'$$);
select tests.expect_blocked('A cannot approve B contribution',
  $$update public.memory_contributions set status = 'approved' where id = 'b0000000-0000-4000-8000-000000000004'$$);
select tests.expect_blocked('A cannot revoke B link',
  $$update public.collaboration_links set revoked_at = now()$$);
select tests.expect_error('A cannot delete B memory through RPC',
  $$select public.delete_memory('b0000000-0000-4000-8000-000000000001')$$, 'not_found');
select tests.expect_error('A cannot submit B memory for payment',
  $$select public.submit_for_payment('b0000000-0000-4000-8000-000000000001')$$, 'not_found');
select tests.expect_error('A cannot create memory owned by B',
  format($$insert into public.memories (owner_id, title) values (%L, 'x')$$, :b));
select tests.expect_error('A cannot add section to B memory',
  $$insert into public.memory_sections (memory_id, title) values ('b0000000-0000-4000-8000-000000000001', 'x')$$);
select tests.expect_error('A cannot add link to B memory',
  $$insert into public.collaboration_links (memory_id, token_hash)
    values ('b0000000-0000-4000-8000-000000000001', extensions.digest('x', 'sha256'))$$);

-- A's own memory, used to test cross-memory references and protected columns.
insert into public.memories (id, owner_id, title, recipient_name)
values ('a0000000-0000-4000-8000-000000000001', :a, 'Memória de A', 'Alguém');
insert into public.memory_sections (id, memory_id, title)
values ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Capítulo A');

select tests.expect_error('A cannot point timeline at B media',
  $$insert into public.memory_timeline (memory_id, media_id)
    values ('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000003')$$, 'media_mismatch');
select tests.expect_error('A cannot move section into B memory',
  $$update public.memory_sections set memory_id = 'b0000000-0000-4000-8000-000000000001'
    where id = 'a0000000-0000-4000-8000-000000000002'$$);
select tests.expect_error('A cannot insert media rows directly',
  $$insert into public.memory_media (memory_id, kind, storage_path)
    values ('a0000000-0000-4000-8000-000000000001', 'image',
            'b0000000-0000-4000-8000-000000000001/b0000000-0000-4000-8000-000000000003/image.webp')$$);
select tests.expect_error('A cannot set status directly',
  $$update public.memories set status = 'published' where id = 'a0000000-0000-4000-8000-000000000001'$$);
select tests.expect_error('A cannot set content hash',
  $$update public.memories set content_hash = repeat('a', 64) where id = 'a0000000-0000-4000-8000-000000000001'$$);
select tests.expect_error('A cannot change public slug',
  $$update public.memories set public_slug = 'AAAAAAAAAAAAAA' where id = 'a0000000-0000-4000-8000-000000000001'$$);
select tests.expect_error('A cannot change owner',
  format($$update public.memories set owner_id = %L where id = 'a0000000-0000-4000-8000-000000000001'$$, :b));
select tests.expect_error('A cannot insert a published memory',
  format($$insert into public.memories (owner_id, title, status) values (%L, 'x', 'published')$$, :a));
select tests.expect_equal('insert ignores forged control columns',
  (select status::text from public.memories where id = 'a0000000-0000-4000-8000-000000000001'), 'draft');

select tests.expect_error('A cannot call publish_memory',
  $$select public.publish_memory('a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000005')$$);
select tests.expect_error('A cannot approve payments',
  $$select public.record_payment_approval('b0000000-0000-4000-8000-000000000005', '1', 999, 'BRL', 'pix')$$);
select tests.expect_error('A cannot read public memory function directly',
  $$select public.get_public_memory('AAAAAAAAAAAAAA')$$);
select tests.expect_error('A cannot touch rate limits',
  $$select public.rate_limit_hit('x', 1, 60)$$);
select tests.expect_error('A cannot submit contributions without the server',
  $$select public.submit_contribution(extensions.digest('token-b', 'sha256'), 'x', 'y')$$);
select tests.expect_error('A cannot read security events', $$select * from public.security_events$$);
select tests.expect_error('A cannot read payment events', $$select * from public.payment_events$$);
select tests.expect_error('A cannot read event logs', $$select * from public.event_logs$$);
select tests.expect_error('A cannot read storage deletions', $$select * from public.storage_deletions$$);
select tests.expect_error('A cannot write analytics directly',
  $$insert into public.analytics_events (name) values ('landing_view')$$);
select tests.expect_error('A cannot read link token hashes',
  $$select token_hash from public.collaboration_links$$);
select tests.expect_error('A cannot read raw provider ids',
  $$select provider_payment_id from public.payments$$);
select tests.expect_error('A cannot call private helpers through SQL',
  $$select private.build_memory_snapshot('b0000000-0000-4000-8000-000000000001')$$);

reset role;
set role anon;
select tests.login(null);
select tests.expect_error('anon cannot read memories', $$select * from public.memories$$);
select tests.expect_error('anon cannot read profiles', $$select * from public.profiles$$);
select tests.expect_error('anon cannot call owner RPCs',
  $$select public.delete_memory('b0000000-0000-4000-8000-000000000001')$$);
select tests.expect_error('anon cannot call public memory function',
  $$select public.get_public_memory('AAAAAAAAAAAAAA')$$);
reset role;

-- Profile row created from auth metadata.
select tests.expect_equal('profile created for new user',
  (select display_name from public.profiles where id = :a), 'Usuária A');
