-- Home search-hero media: an admin-set background video (+ poster image) for the
-- signed-in home. The URL lives in platform_settings (public read like other
-- flags); admins may paste a hosted MP4 link OR upload a clip to the home-media
-- bucket.

-- Settings keys (empty string = use the built-in gradient fallback).
insert into public.platform_settings (key, value) values
  ('home_hero_video_url',  '""'::jsonb),
  ('home_hero_poster_url', '""'::jsonb)
on conflict (key) do nothing;

-- Public bucket for admin-uploaded hero media. Public so <video>/<img> render
-- without signed URLs; only admins write.
insert into storage.buckets (id, name, public)
values ('home-media', 'home-media', true)
on conflict (id) do nothing;

drop policy if exists "home-media admin write" on storage.objects;
create policy "home-media admin write" on storage.objects for all to authenticated
  using (bucket_id = 'home-media' and public.is_admin())
  with check (bucket_id = 'home-media' and public.is_admin());
