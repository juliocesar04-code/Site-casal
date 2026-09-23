-- Runs outside a wrapping transaction: now() must advance between statements.
\set a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set mem '''e0000000-0000-4000-8000-000000000001'''
\set pay '''e0000000-0000-4000-8000-000000000002'''

set role authenticated;
select tests.login(:a);
insert into public.memories (id, owner_id, title, recipient_name, message, release_at)
values (:mem, :a, 'Para abrir depois', 'Lia', 'Conteúdo secreto', clock_timestamp() + interval '3 seconds');
select public.submit_for_payment(:mem);
reset role;

insert into public.payments (id, memory_id, owner_id, provider, product_id, amount_cents)
values (:pay, :mem, :a, 'mercadopago', 'memory_standard', 999);

set role service_role;
select tests.expect_equal('future release is scheduled',
  public.record_payment_approval(:pay, 'mp-sched', 999, 'BRL', 'pix') -> 'publish' ->> 'status', 'scheduled');
select tests.expect_equal('before release only the countdown is returned',
  (select public.get_public_memory(public_slug) ->> 'state' from public.memories where id = :mem), 'scheduled');
select tests.expect_equal('before release no content leaves the database',
  (select (public.get_public_memory(public_slug) ? 'snapshot')
       or (public.get_public_memory(public_slug)::text like '%Conteúdo secreto%')
   from public.memories where id = :mem), false);
select tests.expect_error('cannot respond before release',
  format($$select public.submit_response((select public_slug from public.memories where id = %L), null, 'x')$$, :mem),
  'not_found');
select tests.expect_equal('cron does not release early', public.release_due_memories(), 0);
reset role;

select pg_sleep(3.5);

set role service_role;
select tests.expect_equal('after release the snapshot is returned',
  (select public.get_public_memory(public_slug) ->> 'state' from public.memories where id = :mem), 'open');
select tests.expect_equal('cron releases due memory', public.release_due_memories(), 1);
reset role;

select tests.expect_equal('released memory is published',
  (select status::text from public.memories where id = :mem), 'published');
select tests.expect_equal('owner notified of release',
  (select count(*)::int from public.notifications where memory_id = :mem and type = 'memory_released'), 1);

set role service_role;
select tests.expect_equal('rate limit allows up to the limit',
  public.rate_limit_hit('test:bucket', 2, 60) and public.rate_limit_hit('test:bucket', 2, 60), true);
select tests.expect_equal('rate limit blocks after the limit',
  public.rate_limit_hit('test:bucket', 2, 60), false);
reset role;
