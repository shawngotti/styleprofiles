-- Admin-configurable featured media for the marketing landing hero (image OR
-- video). Reuses the home-media bucket for uploads. Public read like other flags.
insert into public.platform_settings (key, value) values
  ('landing_media_url',        '""'::jsonb),
  ('landing_media_poster_url', '""'::jsonb)
on conflict (key) do nothing;
