create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.login(p_user uuid)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    case when p_user is null then '' else json_build_object('sub', p_user, 'role', 'authenticated')::text end,
    false
  );
$$;

-- Passes when the statement raises. Optionally checks the message.
create function tests.expect_error(p_label text, p_sql text, p_pattern text default null)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception when others then
    if p_pattern is not null and sqlerrm !~ p_pattern then
      raise exception 'FAIL [%]: wrong error "%"', p_label, sqlerrm;
    end if;
    raise notice 'ok   %', p_label;
    return;
  end;
  raise exception 'FAIL [%]: statement succeeded', p_label;
end;
$$;

-- Passes when the statement raises or touches zero rows (RLS hides the target).
create function tests.expect_blocked(p_label text, p_sql text)
returns void
language plpgsql
as $$
declare
  affected int;
begin
  begin
    execute p_sql;
    get diagnostics affected = row_count;
  exception when others then
    raise notice 'ok   % (%)', p_label, sqlerrm;
    return;
  end;
  if affected > 0 then
    raise exception 'FAIL [%]: % row(s) affected', p_label, affected;
  end if;
  raise notice 'ok   % (0 rows)', p_label;
end;
$$;

create function tests.expect_ok(p_label text, p_sql text)
returns void
language plpgsql
as $$
begin
  execute p_sql;
  raise notice 'ok   %', p_label;
exception when others then
  raise exception 'FAIL [%]: %', p_label, sqlerrm;
end;
$$;

create function tests.expect_equal(p_label text, p_actual anyelement, p_expected anyelement)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL [%]: expected %, got %', p_label, p_expected, p_actual;
  end if;
  raise notice 'ok   %', p_label;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'a@example.test', '{"full_name": "Usuária A"}'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'b@example.test', '{"name": "Usuário B"}');
