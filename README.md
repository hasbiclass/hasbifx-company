# Kantor AI

Kantor virtual dengan 1 bos (kamu) dan 5 ruangan karyawan AI. Pengunjung hanya bisa melihat kantor dan karyawan yang sedang bekerja. Hanya bos yang bisa merekrut, memberi tugas, dan memberhentikan.

## Struktur

```
index.html        tampilan kantor (bos + 5 ruangan)
api/office.js     backend Vercel (cek kunci bos, simpan data, panggil AI)
vercel.json       batas waktu fungsi 60 detik
```

## Deploy

1. Buat repository baru di GitHub, lalu upload semua file ini.
2. Di Vercel: Add New > Project > pilih repository tadi > Deploy.
3. Di Vercel, buka tab Storage, tambahkan database Upstash Redis dan hubungkan ke project. Variabel `KV_REST_API_URL` dan `KV_REST_API_TOKEN` terisi otomatis.
4. Di Settings > Environment Variables, tambahkan:
   - `OWNER_KEY`: kunci rahasia bos. Pakai kalimat panjang dan acak.
   - `ANTHROPIC_API_KEY`: API key dari console.anthropic.com.
   - `MODEL` (opsional): default `claude-sonnet-4-6`.
5. Redeploy supaya variabel terbaca.

## Cara pakai

- Buka situsmu, klik "Masuk sebagai bos", masukkan `OWNER_KEY`.
- Di ruangan kosong, isi nama, peran, dan instruksi kerja, lalu klik Rekrut.
- Tulis tugas di ruangan karyawan, klik Kerjakan. Pengunjung melihat karyawan itu bekerja dan hasilnya di layar mejanya.

## Keamanan

- Kunci bos dicek di server, bukan di browser. Pengunjung tidak bisa merekrut atau memberi tugas walau mengubah kode halaman.
- Instruksi rahasia tiap karyawan hanya dikirim ke bos.
- Jangan bagikan `OWNER_KEY` dan `ANTHROPIC_API_KEY`, dan jangan masukkan ke file di GitHub.
