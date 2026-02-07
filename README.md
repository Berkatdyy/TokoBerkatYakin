# 🏪 Berkat Yakin - Website Toko

Website profesional untuk Toko Berkat Yakin dengan struktur modern dan optimized untuk deployment.

## 📂 Struktur Folder

```
berkat-yakin/
├── index.html              # Halaman utama
├── vercel.json            # Konfigurasi Vercel (deployment)
├── .gitignore             # Git ignore rules
└── assets/
    ├── css/
    │   └── style.css      # Styling (1,926 baris)
    ├── js/
    │   └── app.js         # JavaScript (878 baris)
    └── images/            # Folder untuk gambar produk
```

## ✨ Fitur Website

### 🎨 Frontend
- ✅ Design modern & responsive
- ✅ Animasi smooth scroll
- ✅ Search produk real-time
- ✅ Filter kategori dinamis
- ✅ Pagination produk
- ✅ Mobile-friendly navigation

### ⚙️ Backend Integration
- ✅ Supabase database
- ✅ Admin panel lengkap
- ✅ CRUD produk
- ✅ Kategori dinamis
- ✅ Authentication admin

### 🔒 Security
- ✅ XSS Protection
- ✅ Content Security Headers
- ✅ Secure authentication

## 🚀 Deployment ke Vercel

### Cara 1: Deploy via Git (Recommended)

1. **Push ke GitHub/GitLab:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Connect ke Vercel:**
   - Buka [vercel.com](https://vercel.com)
   - Login dengan GitHub/GitLab
   - Klik "New Project"
   - Import repository Anda
   - Klik "Deploy"

3. **Done!** Website otomatis live ✨

### Cara 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Production deploy
vercel --prod
```

### Cara 3: Deploy Drag & Drop

1. Buka [vercel.com/new](https://vercel.com/new)
2. Drag folder project ke browser
3. Klik "Deploy"
4. Done! ✨

## 🔧 Konfigurasi

### 1. Supabase Setup

Edit `assets/js/app.js` baris 1-2:

```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

**Cara dapat Supabase credentials:**
1. Buka [supabase.com](https://supabase.com)
2. Login → Project Settings → API
3. Copy `URL` dan `anon/public` key

### 2. Database Schema

Buat tabel di Supabase SQL Editor:

```sql
-- Tabel produk
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

-- Enable RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy untuk read (semua orang bisa lihat)
CREATE POLICY "Enable read access for all users" ON products
  FOR SELECT USING (true);

-- Policy untuk insert/update/delete (hanya admin)
CREATE POLICY "Enable insert for authenticated users only" ON products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON products
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON products
  FOR DELETE USING (auth.role() = 'authenticated');
```

### 3. Admin Account

Buat admin user di Supabase Authentication:
1. Buka Supabase → Authentication → Users
2. Klik "Add User"
3. Masukkan email & password
4. Gunakan untuk login admin di website

## 📱 Testing Lokal

### Menggunakan Live Server (VS Code):
1. Install extension "Live Server"
2. Klik kanan `index.html` → Open with Live Server
3. Browser otomatis buka `http://localhost:5500`

### Menggunakan Python:
```bash
python -m http.server 8000
# Buka: http://localhost:8000
```

### Menggunakan Node.js:
```bash
npx http-server -p 8000
# Buka: http://localhost:8000
```

## 🖼️ Menambah Gambar Produk

### Opsi 1: Upload ke Supabase Storage (Recommended)

1. **Buat Storage Bucket:**
   - Buka Supabase → Storage → Create Bucket
   - Nama: `product-images`
   - Public: Yes

2. **Upload gambar:**
   - Drag & drop gambar ke bucket
   - Copy public URL

3. **Gunakan URL di database:**
   ```
   https://your-project.supabase.co/storage/v1/object/public/product-images/nama-gambar.jpg
   ```

### Opsi 2: Simpan di assets/images/

1. Simpan gambar di folder `assets/images/`
2. Gunakan path relatif:
   ```
   assets/images/nama-gambar.jpg
   ```

### Opsi 3: Gunakan CDN Eksternal

Gunakan URL dari:
- Cloudinary
- ImgBB
- Imgur
- AWS S3

## 🎯 Custom Domain

### Di Vercel:
1. Buka project di Vercel
2. Settings → Domains
3. Add domain Anda
4. Update DNS di domain registrar:
   ```
   A Record: 76.76.21.21
   CNAME: cname.vercel-dns.com
   ```

## 📊 Performance

### Optimasi Sudah Include:
- ✅ Asset caching (1 tahun)
- ✅ Clean URLs
- ✅ Security headers
- ✅ Lazy loading images
- ✅ Minified code ready

### Cara Test Performance:
1. Buka [PageSpeed Insights](https://pagespeed.web.dev/)
2. Masukkan URL website
3. Klik "Analyze"

Target: 90+ score ✨

## 🐛 Troubleshooting

### Problem: 404 Not Found
**Solusi:**
- Pastikan `index.html` ada di root folder
- Cek `vercel.json` sudah ada
- Redeploy project

### Problem: CSS/JS tidak load
**Solusi:**
- Cek path di `index.html`:
  ```html
  <link rel="stylesheet" href="assets/css/style.css">
  <script src="assets/js/app.js"></script>
  ```
- Pastikan struktur folder benar
- Clear cache browser (Ctrl+Shift+R)

### Problem: Supabase connection error
**Solusi:**
- Cek credentials di `assets/js/app.js`
- Pastikan RLS policy sudah diset
- Cek browser console (F12) untuk error detail

### Problem: Admin tidak bisa login
**Solusi:**
- Pastikan user sudah dibuat di Supabase Auth
- Cek email/password benar
- Cek browser console untuk error

## 📞 Support

Butuh bantuan? Contact:
- Email: berkatdyy@gmail.com
- WhatsApp: +62 812-3456-789

## 📝 License

© 2025 Berkat Yakin. All rights reserved.

---

**Built with ❤️ in Banjarmasin**

Made by professional web developers for modern web standards.

## 🎉 Next Steps

1. ✅ Download/Clone project ini
2. ✅ Setup Supabase (5 menit)
3. ✅ Deploy ke Vercel (2 menit)
4. ✅ Add your products
5. ✅ Share dengan customers!

**Ready to launch? Let's go! 🚀**
