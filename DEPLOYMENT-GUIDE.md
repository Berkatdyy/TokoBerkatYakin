# 🚀 Panduan Deploy Cepat ke Vercel

## ⚡ Quick Start (5 Menit)

### Step 1: Download Project ✅
Anda sudah punya file ini!

### Step 2: Setup Supabase (2 menit)

1. **Buka** [supabase.com](https://supabase.com) → Sign Up/Login
2. **Buat Project Baru** → Tunggu setup selesai
3. **Buka SQL Editor** → Paste query ini:

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  category TEXT NOT NULL,
  stock INTEGER DEFAULT 0,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON products
  FOR SELECT USING (true);

CREATE POLICY "Enable all for authenticated users" ON products
  FOR ALL USING (auth.role() = 'authenticated');
```

4. **Buka Settings → API**
   - Copy `Project URL` dan `anon public` key

5. **Edit file `assets/js/app.js` baris 1-2:**
   ```javascript
   const SUPABASE_URL = 'PASTE_URL_DISINI';
   const SUPABASE_ANON_KEY = 'PASTE_KEY_DISINI';
   ```

6. **Buat Admin User:**
   - Buka Authentication → Users → Add User
   - Masukkan email & password untuk admin

### Step 3: Deploy ke Vercel (2 menit)

#### Opsi A: Via Website (Paling Mudah)
1. Buka [vercel.com/new](https://vercel.com/new)
2. **Login** dengan GitHub/Google
3. **Drag & Drop** folder project ini ke browser
4. Klik **"Deploy"**
5. ✨ **DONE!** Website live dalam 30 detik

#### Opsi B: Via GitHub (Lebih Profesional)
1. Upload project ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```

2. Buka [vercel.com](https://vercel.com)
3. Klik **"Import Project"**
4. Pilih repository GitHub Anda
5. Klik **"Deploy"**

### Step 4: Test Website ✅

1. Buka URL yang diberikan Vercel (contoh: `your-site.vercel.app`)
2. Test fitur:
   - ✅ Homepage load
   - ✅ Navigasi menu
   - ✅ Search produk
   - ✅ Filter kategori
3. Login admin:
   - Klik menu **"Admin"**
   - Login dengan email/password yang dibuat di Supabase
   - Tambah produk pertama!

---

## 🎯 Checklist Sukses

- [ ] Supabase project dibuat
- [ ] Database table sudah dibuat
- [ ] Credentials sudah diupdate di `assets/js/app.js`
- [ ] Admin user sudah dibuat
- [ ] Project sudah di-deploy ke Vercel
- [ ] Website bisa diakses
- [ ] Admin bisa login
- [ ] Produk bisa ditambahkan

---

## 📸 Upload Gambar Produk (Bonus)

### Cara Termudah: Gunakan URL Gambar dari Internet
Saat tambah produk, paste URL gambar dari Google Images atau website lain.

### Cara Pro: Upload ke Supabase Storage

1. **Buat Storage Bucket:**
   - Buka Supabase → Storage
   - Klik "New Bucket"
   - Nama: `product-images`
   - Public: **ON**

2. **Upload Gambar:**
   - Klik bucket → Upload
   - Pilih gambar produk
   - Klik gambar → Copy URL

3. **Gunakan URL di Admin Panel:**
   - Paste URL saat tambah/edit produk

---

## 🔥 Tips Pro

### Custom Domain (Opsional)
1. Buka Vercel project → Settings → Domains
2. Add domain Anda (contoh: `tokoberkatyakin.com`)
3. Update DNS di registrar domain Anda
4. Done! Website pakai domain sendiri

### Performance Optimization
- Gambar produk sebaiknya ukuran < 500KB
- Format JPG atau WebP lebih cepat dari PNG
- Compress gambar di [tinypng.com](https://tinypng.com)

### SEO Tips
- Update `<title>` di `index.html` dengan keyword toko Anda
- Ganti konten `<meta description>` dengan deskripsi yang SEO-friendly
- Upload logo toko sebagai `favicon.ico`

---

## ❗ Troubleshooting Cepat

### Website blank/putih?
→ Buka Console browser (F12), lihat error
→ Biasanya salah credentials Supabase

### Admin tidak bisa login?
→ Cek user sudah dibuat di Supabase Authentication
→ Pastikan email/password benar

### Gambar produk tidak muncul?
→ Cek URL gambar bisa diakses
→ Pastikan URL dimulai dengan `https://`

### CSS tidak load?
→ Hard refresh: Ctrl+Shift+R (Windows) atau Cmd+Shift+R (Mac)
→ Clear cache browser

---

## 🎉 Selamat!

Website toko Anda sudah online dan siap digunakan!

**Next Steps:**
1. Tambah semua produk Anda
2. Share link ke customer
3. Terima pesanan! 💰

**Butuh bantuan?**
- Baca `README.md` untuk panduan lengkap
- Hubungi: berkatdyy@gmail.com

---

**Made with ❤️ for Berkat Yakin**
