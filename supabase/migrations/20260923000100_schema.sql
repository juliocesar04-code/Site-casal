create extension if not exists pgcrypto with schema extensions;

-- Helpers that must never be reachable through the REST API live here.
create schema if not exists private;
revoke all on schema private from public;
-- Postgres grants EXECUTE to PUBLIC on every new function. Per-schema default
-- privileges cannot remove that, so it is revoked globally for this role.
alter default privileges revoke execute on functions from public;

create type public.memory_status as enum (
  'draft', 'awaiting_payment', 'paid', 'scheduled', 'published', 'deleted'
);
create type public.media_kind as enum ('image', 'video');
create type public.media_status as enum ('pending', 'ready', 'rejected');
create type public.contribution_status as enum ('pending', 'approved', 'rejected', 'locked');
create type public.payment_status as enum (
  'created', 'pending', 'approved', 'rejected', 'cancelled', 'refunded'
);

-- Unbiased base62 via rejection sampling (248 = 62 * 4).
create function private.random_base62(n int)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  result text := '';
  buf bytea;
  b int;
begin
  while length(result) < n loop
    buf := extensions.gen_random_bytes(32);
    for i in 0..31 loop
      b := get_byte(buf, i);
      if b < 248 then
        result := result || substr(alphabet, (b % 62) + 1, 1);
        exit when length(result) = n;
      end if;
    end loop;
  end loop;
  return result;
end;
$$;

create function private.sha256_hex(input text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(input, 'UTF8'), 'sha256'), 'hex');
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  locale text not null default 'pt-BR' check (locale in ('pt-BR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.templates (
  id text primary key check (id ~ '^[a-z_]{2,32}$'),
  name text not null,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.templates (id, name, position) values
  ('classico', 'Clássico', 1),
  ('carta', 'Carta', 2),
  ('historia', 'Nossa História', 3),
  ('cinematico', 'Cinemático', 4),
  ('capitulos', 'Capítulos', 5),
  ('colaborativo', 'Colaborativo', 6);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  public_slug text not null unique default private.random_base62(14)
    check (public_slug ~ '^[0-9A-Za-z]{14}$'),
  status public.memory_status not null default 'draft',
  template_id text not null default 'classico' references public.templates (id),
  theme text not null default 'marfim'
    check (theme in ('marfim', 'noite', 'sepia', 'bruma', 'musgo')),
  occasion text check (occasion in (
    'namoro', 'casamento', 'amizade', 'familia', 'aniversario', 'pedido', 'formatura',
    'nascimento', 'homenagem', 'agradecimento', 'despedida', 'dia_das_maes', 'dia_dos_pais',
    'viagem', 'grupo', 'professor', 'outro'
  )),
  title text check (char_length(title) <= 120),
  recipient_name text check (char_length(recipient_name) <= 80),
  sender_name text check (char_length(sender_name) <= 80),
  opening_line text check (char_length(opening_line) <= 140),
  message text check (char_length(message) <= 6000),
  closing_line text check (char_length(closing_line) <= 280),
  release_at timestamptz,
  paid_payment_id uuid,
  content_snapshot jsonb,
  content_hash text check (content_hash ~ '^[0-9a-f]{64}$'),
  published_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memories_owner_idx on public.memories (owner_id, created_at desc);
create index memories_release_idx on public.memories (release_at) where status = 'scheduled';

create table public.memory_sections (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 6000),
  event_date date,
  transition text not null default 'fade' check (transition in ('fade', 'slide', 'zoom', 'none')),
  position int not null default 0 check (position between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memory_sections_memory_idx on public.memory_sections (memory_id, position);

create table public.collaboration_links (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  label text check (char_length(label) <= 60),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index collaboration_links_memory_idx on public.collaboration_links (memory_id);

create table public.memory_contributions (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  link_id uuid references public.collaboration_links (id) on delete set null,
  author_name text not null check (char_length(author_name) between 1 and 80),
  body text not null default '' check (char_length(body) <= 2000),
  status public.contribution_status not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index memory_contributions_memory_idx on public.memory_contributions (memory_id, created_at);

create table public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  section_id uuid references public.memory_sections (id) on delete set null,
  contribution_id uuid references public.memory_contributions (id) on delete cascade,
  kind public.media_kind not null,
  status public.media_status not null default 'pending',
  storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-z]+(\.[a-z0-9]+)?$'),
  poster_path text,
  thumb_path text,
  mime text,
  bytes bigint check (bytes is null or bytes > 0),
  width int check (width is null or width > 0),
  height int check (height is null or height > 0),
  duration_ms int check (duration_ms is null or duration_ms > 0),
  checksum text check (checksum is null or checksum ~ '^[0-9a-f]{64}$'),
  alt text not null default '' check (char_length(alt) <= 200),
  position int not null default 0 check (position between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memory_media_memory_idx on public.memory_media (memory_id, position);
create index memory_media_section_idx on public.memory_media (section_id);

create table public.memory_timeline (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  event_date date,
  title text not null default '' check (char_length(title) <= 120),
  body text not null default '' check (char_length(body) <= 1200),
  media_id uuid references public.memory_media (id) on delete set null,
  position int not null default 0 check (position between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index memory_timeline_memory_idx on public.memory_timeline (memory_id, position);

create table public.recipient_responses (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories (id) on delete cascade,
  author_name text check (char_length(author_name) <= 80),
  body text not null check (char_length(body) between 1 and 2000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index recipient_responses_memory_idx on public.recipient_responses (memory_id, created_at);

-- Payments outlive the memory they paid for (fiscal records), so the link is nullable.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid references public.memories (id) on delete set null,
  owner_id uuid references auth.users (id) on delete set null,
  provider text not null check (provider in ('mercadopago')),
  product_id text not null check (product_id ~ '^[a-z_]{2,40}$'),
  amount_cents int not null check (amount_cents > 0),
  currency char(3) not null default 'BRL',
  status public.payment_status not null default 'created',
  provider_checkout_id text,
  provider_payment_id text,
  method text check (method is null or char_length(method) <= 40),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_payment_id)
);

create index payments_memory_idx on public.payments (memory_id);
create index payments_owner_idx on public.payments (owner_id, created_at desc);

alter table public.memories
  add constraint memories_paid_payment_fk
  foreign key (paid_payment_id) references public.payments (id) on delete set null;

create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  event_key text not null check (char_length(event_key) <= 200),
  provider_payment_id text,
  outcome text,
  received_at timestamptz not null default now(),
  unique (provider, event_key)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  memory_id uuid references public.memories (id) on delete cascade,
  type text not null check (type in (
    'payment_confirmed', 'memory_published', 'memory_scheduled', 'memory_released',
    'contribution_received', 'response_received'
  )),
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_outbox_idx on public.notifications (created_at) where emailed_at is null;

create table public.storage_deletions (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);

create table public.event_logs (
  id bigint generated always as identity primary key,
  action text not null check (char_length(action) <= 60),
  actor_id uuid,
  memory_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index event_logs_memory_idx on public.event_logs (memory_id, created_at);

create table public.security_events (
  id bigint generated always as identity primary key,
  type text not null check (char_length(type) <= 60),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  user_id uuid,
  ip_hash text,
  path text check (char_length(path) <= 200),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index security_events_type_idx on public.security_events (type, created_at desc);

create table public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null check (name in (
    'landing_view', 'create_started', 'draft_created', 'template_selected', 'photo_uploaded',
    'preview_opened', 'checkout_started', 'payment_success', 'memory_published',
    'memory_opened', 'experience_completed', 'share_clicked'
  )),
  props jsonb not null default '{}'::jsonb check (octet_length(props::text) <= 1024),
  created_at timestamptz not null default now()
);

create index analytics_events_name_idx on public.analytics_events (name, created_at);

create table public.rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (bucket, window_start)
);
