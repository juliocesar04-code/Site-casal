-- Each block below runs in its own connection (see scripts/test-db.sh). PL/pgSQL
-- caches plans per session, so trigger permission problems only show up when a
-- role touches these tables before any other role has in the same session.
-- session: service_role
set role service_role;
insert into public.memories (id, owner_id, title)
values ('f0000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sessão limpa');
insert into public.memory_sections (memory_id, title) values ('f0000000-0000-4000-8000-000000000001', 'Capítulo');
update public.memories set title = 'Editado' where id = 'f0000000-0000-4000-8000-000000000001';
insert into public.memory_media (memory_id, kind, storage_path)
values ('f0000000-0000-4000-8000-000000000001', 'image',
        'f0000000-0000-4000-8000-000000000001/f0000000-0000-4000-8000-000000000002/source');
update public.memory_media set status = 'ready' where memory_id = 'f0000000-0000-4000-8000-000000000001';
select tests.expect_equal('service role runs triggers in a fresh session',
  (select title from public.memories where id = 'f0000000-0000-4000-8000-000000000001'), 'Editado');
-- session: authenticated
set role authenticated;
select tests.login('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.memories (owner_id, title) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sessão limpa');
select tests.expect_equal('authenticated runs triggers in a fresh session',
  (select count(*)::int from public.memories where title = 'Sessão limpa'), 1);
-- session: supabase_auth_admin
insert into auth.users (id, email) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c@example.test');
insert into public.memories (id, owner_id, title)
values ('f0000000-0000-4000-8000-000000000003', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Conta a excluir');
insert into public.memory_sections (memory_id, title) values ('f0000000-0000-4000-8000-000000000003', 'Capítulo');
set role supabase_auth_admin;
delete from auth.users where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
reset role;
select tests.expect_equal('account deletion cascades through triggers',
  (select count(*)::int from public.memories where id = 'f0000000-0000-4000-8000-000000000003'), 0);
