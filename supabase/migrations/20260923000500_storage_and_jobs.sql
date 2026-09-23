-- Private bucket. No storage.objects policies exist for anon/authenticated,
-- so the only ways in are server-issued signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  false,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    perform cron.schedule('release-due-memories', '* * * * *', 'select public.release_due_memories()');
    perform cron.schedule('sweep-integrity', '17 4 * * *', 'select public.sweep_integrity()');
    perform cron.schedule('purge-rate-limits', '7 * * * *', 'select public.purge_rate_limits()');
  end if;
end;
$$;
