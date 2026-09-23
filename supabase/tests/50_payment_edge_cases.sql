-- Payments that arrive after the memory no longer needs them must be flagged
-- for refund review instead of disappearing into an "already published" outcome.
\set a '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set mem '''e1000000-0000-4000-8000-000000000001'''

set role authenticated;
select tests.login(:a);
insert into public.memories (id, owner_id, title, recipient_name) values (:mem, :a, 'Duas abas', 'Lia');
select public.submit_for_payment(:mem);
reset role;

insert into public.payments (id, memory_id, owner_id, provider, product_id, amount_cents) values
  ('e1000000-0000-4000-8000-000000000002', :mem, :a, 'mercadopago', 'memory_standard', 999),
  ('e1000000-0000-4000-8000-000000000003', :mem, :a, 'mercadopago', 'memory_standard', 999);

set role service_role;
select tests.expect_equal('first checkout publishes',
  public.record_payment_approval('e1000000-0000-4000-8000-000000000002', 'mp-a', 999, 'BRL', 'pix') ->> 'outcome', 'published');
select tests.expect_equal('second checkout for the same memory is reported as a duplicate charge',
  public.record_payment_approval('e1000000-0000-4000-8000-000000000003', 'mp-b', 999, 'BRL', 'pix') ->> 'outcome', 'duplicate_charge');
reset role;
select tests.expect_equal('duplicate charge raises a security event',
  (select count(*)::int from public.security_events
   where type = 'payment_needs_refund' and meta ->> 'payment_id' = 'e1000000-0000-4000-8000-000000000003'), 1);

-- Paid after the owner deleted the memory.
\set gone '''e1000000-0000-4000-8000-000000000011'''
set role authenticated;
select tests.login(:a);
insert into public.memories (id, owner_id, title, recipient_name) values (:gone, :a, 'Excluída', 'Lia');
select public.submit_for_payment(:gone);
reset role;
insert into public.payments (id, memory_id, owner_id, provider, product_id, amount_cents)
values ('e1000000-0000-4000-8000-000000000012', :gone, :a, 'mercadopago', 'memory_standard', 999);
set role authenticated;
select tests.login(:a);
select public.delete_memory(:gone);
reset role;
set role service_role;
select tests.expect_equal('payment for a deleted memory is approved but flagged',
  public.record_payment_approval('e1000000-0000-4000-8000-000000000012', 'mp-c', 999, 'BRL', 'pix') ->> 'outcome',
  'approved_memory_deleted');
reset role;
select tests.expect_equal('deleted-memory payment raises a security event',
  (select count(*)::int from public.security_events
   where type = 'payment_needs_refund' and meta ->> 'payment_id' = 'e1000000-0000-4000-8000-000000000012'), 1);
