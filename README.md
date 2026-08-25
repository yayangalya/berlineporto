# Berline's Portofolioo

Website portfolio satu halaman dengan frontend publik dan halaman admin privat. Data karya disimpan menggunakan Supabase Storage, jadi tidak membutuhkan tabel database tambahan.

## Isi folder

- `index.html` — halaman portfolio publik.
- `style.css` — seluruh desain frontend pink kawaii retro/Y2K.
- `script.js` — kategori, galeri, modal detail, dan koneksi katalog.
- `admin.html`, `admin.css`, `admin.js` — login, upload, hapus karya, serta PDF privat.
- `supabase-config.js` — tempat mengisi Project URL, anon key, dan kontak.
- `supabase-setup.sql` — bucket dan policy keamanan Supabase.

## Pengaturan pertama

1. Buka `supabase-config.js`.
2. Isi `supabaseUrl` dan `supabaseAnonKey` dari **Supabase → Project Settings → API**. Gunakan anon/public key, bukan `service_role`.
3. Isi WhatsApp, Instagram, dan email pada bagian `contacts` bila ingin mengaktifkan tombol kontak.
4. Jalankan `supabase-setup.sql` melalui **Supabase → SQL Editor**. File ini mempertahankan bucket publik `portfolio` dan membuat bucket privat `portfolio-private`.
5. Pastikan akun admin sudah ada di **Authentication → Users**.

## Menjalankan di komputer

Dari folder project jalankan:

```powershell
py -m http.server 5500
```

Kemudian buka:

- Frontend: `http://localhost:5500`
- Admin: `http://localhost:5500/admin.html`

Jangan membuka project hanya dengan klik dua kali `index.html`, karena beberapa fitur browser dan Supabase membutuhkan server lokal.

## Keamanan PDF

Tombol download PDF tidak terdapat di frontend. PDF disimpan di bucket privat dan link unduh sementara hanya dibuat setelah akun admin berhasil login.

## Hosting

Semua file dapat langsung dipasang di Vercel sebagai static site. Jangan memasukkan `service_role` key atau password admin ke dalam file project.
