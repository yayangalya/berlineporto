-- ================================================================
-- BERLINE'S PORTOFOLIOO — SUPABASE STORAGE SETUP (TANPA DATABASE)
-- Jalankan satu kali melalui Supabase > SQL Editor.
-- ================================================================

-- Bucket galeri publik: gambar karya + catalog.json.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'portfolio',
  'portfolio',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'application/json']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bucket PDF privat: tidak dapat dibuka tanpa sesi admin.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'portfolio-private',
  'portfolio-private',
  false,
  26214400,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Hapus policy lama dengan nama yang sama agar file ini aman dijalankan ulang.
drop policy if exists "Portfolio dapat dilihat publik" on storage.objects;
drop policy if exists "Admin dapat upload karya" on storage.objects;
drop policy if exists "Admin dapat memperbarui karya" on storage.objects;
drop policy if exists "Admin dapat menghapus karya" on storage.objects;
drop policy if exists "Admin dapat melihat PDF privat" on storage.objects;
drop policy if exists "Admin dapat upload PDF privat" on storage.objects;
drop policy if exists "Admin dapat memperbarui PDF privat" on storage.objects;
drop policy if exists "Admin dapat menghapus PDF privat" on storage.objects;

-- Frontend boleh membaca isi bucket karya.
create policy "Portfolio dapat dilihat publik"
on storage.objects
for select
to public
using (bucket_id = 'portfolio');

-- Hanya akun yang sudah login yang boleh mengubah karya dan catalog.json.
create policy "Admin dapat upload karya"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'portfolio');

create policy "Admin dapat memperbarui karya"
on storage.objects
for update
to authenticated
using (bucket_id = 'portfolio')
with check (bucket_id = 'portfolio');

create policy "Admin dapat menghapus karya"
on storage.objects
for delete
to authenticated
using (bucket_id = 'portfolio');

-- PDF sama sekali tidak mempunyai policy publik.
create policy "Admin dapat melihat PDF privat"
on storage.objects
for select
to authenticated
using (bucket_id = 'portfolio-private');

create policy "Admin dapat upload PDF privat"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'portfolio-private');

create policy "Admin dapat memperbarui PDF privat"
on storage.objects
for update
to authenticated
using (bucket_id = 'portfolio-private')
with check (bucket_id = 'portfolio-private');

create policy "Admin dapat menghapus PDF privat"
on storage.objects
for delete
to authenticated
using (bucket_id = 'portfolio-private');
