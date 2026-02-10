
        // ===== SUPABASE CONFIGURATION =====
        const SUPABASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_k_Tjf3ZGz2qsyR6pSfrtdg_FpM3k4qT';
        
        // Inisialisasi Supabase client
        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false
            }
        });

        // ===== PRODUCT DATABASE (DEFAULT) =====
        // HAPUS SEMUA DEFAULT PRODUCTS YANG MENGGUNAKAN FILE LOKAL
        const defaultProducts = [];

        // ===== CATEGORIES DATABASE =====
        const defaultCategories = ['mie', 'rokok', 'sembako', 'minuman', 'snack', 'lainnya'];

        // ===== PAGINATION =====
        const PRODUCTS_PER_PAGE = 6;
        let currentPage = 1;
        let currentFilter = 'all';
        let currentSearch = '';
        let filteredProducts = [];
        let allProducts = [];
        let allCategories = [];

        // ===== ADMIN CREDENTIALS (UNTUK REFERENSI USER) =====
        const ADMIN_USERNAME = 'berkatdyy';

        // Admin utama (wajib dianggap admin)
        const MASTER_ADMIN_EMAIL = 'berkatdyy@gmail.com';

        // ===== NOTIFICATION SYSTEM =====
        function showNotification(type, title, message, duration = 5000) {
            const container = document.getElementById('notificationContainer');
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <div class="notification-icon">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️'}
                </div>
                <div class="notification-content">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close" onclick="this.parentElement.remove()">×</button>
            `;
            
            container.appendChild(notification);
            
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }, duration);
        }

        // ===== LOADING OVERLAY =====
        function showLoading(message = 'Menyimpan data...') {
            const overlay = document.getElementById('loadingOverlay');
            const text = document.getElementById('loadingText');
            text.textContent = message;
            overlay.classList.add('active');
        }

        function hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.remove('active');
        }


        // ===== VALIDATION FUNCTIONS =====
        function validateProductData(data) {
            const errors = {};
            
            // Nama produk validation
            if (!data.name || data.name.trim().length < 3) {
                errors.name = 'Nama produk harus minimal 3 karakter';
            }
            
            // Kategori validation
            if (!data.category || data.category.trim().length < 2) {
                errors.category = 'Kategori harus minimal 2 karakter';
            }
            
            // Harga validation
            if (!data.price || !data.price.includes('Rp')) {
                errors.price = 'Harga harus dalam format Rp (contoh: Rp 3.000)';
            }
            
            // Deskripsi validation (field input tetap bernama "desc" untuk UI, tapi database pakai "description")
            if (!data.desc || data.desc.trim().length < 10) {
                errors.desc = 'Deskripsi harus minimal 10 karakter';
            }
            
            // Stok validation
            if (!data.stock || data.stock.trim().length < 2) {
                errors.stock = 'Status stok harus diisi';
            }
            
            // Rating validation
            if (typeof data.rating === 'number' && (data.rating < 1 || data.rating > 5)) {
                errors.rating = 'Rating harus antara 1-5';
            }
            
            // Image validation: database menyimpan filename saja (atau URL lama yang masih ada)
            if (!data.image || String(data.image).trim() === '') {
                errors.image = 'Gambar produk wajib diisi';
            } else {
                const img = String(data.image).trim();
                const isUrl = img.startsWith('http://') || img.startsWith('https://');
                const isFilename = img.includes('.');
                if (!isUrl && !isFilename) {
                    errors.image = 'Gambar tidak valid (gunakan file gambar)';
                }
            }
            
            return errors;
        }

        function isValidUrl(string) {
            try {
                new URL(string);
                return true;
            } catch (_) {
                return false;
            }
        }

        function showValidationErrors(errors) {
            // Reset semua error
            document.querySelectorAll('.validation-error').forEach(el => {
                el.classList.remove('show');
                el.textContent = '';
            });
            
            document.querySelectorAll('.form-group').forEach(el => {
                el.classList.remove('error');
            });
            
            // Tampilkan error yang ada
            Object.keys(errors).forEach(field => {
                const errorEl = document.getElementById(`${field}Error`);
                const groupEl = document.getElementById(`${field}Group`);
                
                if (errorEl && groupEl) {
                    errorEl.textContent = errors[field];
                    errorEl.classList.add('show');
                    groupEl.classList.add('error');
                }
            });
            
            return Object.keys(errors).length === 0;
        }

        // ===== SUPABASE AUTHENTICATION FUNCTIONS =====
        function resolveLoginEmail(identifier) {
            const v = (identifier || '').trim();
            if (!v) return '';
            // Jika user memasukkan email, pakai langsung
            if (v.includes('@')) return v.toLowerCase();
            // Username alias khusus untuk admin utama
            if (v.toLowerCase() === 'berkatdyy') return MASTER_ADMIN_EMAIL;
            // Selain itu, butuh email karena profiles tidak menyimpan email
            return '';
        }

        async function ensureAdminRoleBySession(session) {
            if (!session || !session.user) return { ok: false, reason: 'Belum login' };

            const email = (session.user.email || '').toLowerCase();
            // Admin utama: selalu dianggap admin
            if (email === MASTER_ADMIN_EMAIL) return { ok: true, role: 'admin', email };

            // Admin lain: cek table profiles by id (auth.uid)
            const { data: profile, error } = await supabaseClient
                .from('profiles')
                .select('role, username')
                .eq('id', session.user.id)
                .single();

            if (error || !profile) {
                return { ok: false, reason: 'Profil admin tidak ditemukan' };
            }

            if (profile.role !== 'admin') {
                return { ok: false, reason: 'Akses ditolak. Bukan admin.' };
            }

            return { ok: true, role: profile.role, email, username: profile.username };
        }

        async function loginAdmin() {
            const identifier = document.getElementById('adminUsername').value.trim();
            const password = document.getElementById('adminPassword').value.trim();

            // Reset error
            const loginErrEl = document.getElementById('loginError');
            loginErrEl.classList.remove('show');
            loginErrEl.textContent = '';

            if (!identifier || !password) {
                loginErrEl.textContent = 'Email/Username dan password harus diisi';
                loginErrEl.classList.add('show');
                return;
            }

            const email = resolveLoginEmail(identifier);
            if (!email) {
                loginErrEl.textContent = 'Masukkan email admin (atau username: berkatdyy)';
                loginErrEl.classList.add('show');
                return;
            }

            showLoading('Memverifikasi login...');

            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                // Pastikan role admin
                const check = await ensureAdminRoleBySession(data.session);
                if (!check.ok) {
                    await supabaseClient.auth.signOut();
                    loginErrEl.textContent = check.reason || 'Akses ditolak';
                    loginErrEl.classList.add('show');
                    showNotification('error', 'Akses Ditolak', check.reason || 'Bukan admin');
                    return;
                }

                closeLoginModal();
                updateAdminMenu(true);
                openAdminModal(true);
                showNotification('success', 'Login Berhasil', 'Selamat datang di panel admin!');
            } catch (error) {
                console.error('Login error:', error);
                loginErrEl.textContent = 'Login gagal. Periksa email/username dan password.';
                loginErrEl.classList.add('show');
                showNotification('error', 'Login Gagal', (error && error.message) ? error.message : 'Terjadi kesalahan saat login');
            } finally {
                hideLoading();
            }
        }

        async function checkAdminLogin() {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                if (!session) {
                    updateAdminMenu(false);
                    return false;
                }

                const check = await ensureAdminRoleBySession(session);
                if (!check.ok) {
                    await supabaseClient.auth.signOut();
                    updateAdminMenu(false);
                    return false;
                }

                updateAdminMenu(true);
                return true;
            } catch (error) {
                console.error('Check login error:', error);
                updateAdminMenu(false);
                return false;
            }
        }

        async function logoutAdmin() {
            try {
                await supabaseClient.auth.signOut();
                closeAdminModal();
                updateAdminMenu(false);
                showNotification('info', 'Logout Berhasil', 'Anda telah logout dari admin panel.');
            } catch (error) {
                console.error('Logout error:', error);
                showNotification('error', 'Logout Gagal', 'Terjadi kesalahan saat logout');
            }
        }

        function updateAdminMenu(isLoggedIn) {
            const adminMenu = document.getElementById('navAdmin');
            if (isLoggedIn) {
                adminMenu.innerHTML = '⚙️ Admin';
                adminMenu.title = 'Kelola Produk';
            } else {
                adminMenu.innerHTML = '🔑 Admin';
                adminMenu.title = 'Login Admin';
            }
        }

        function openLoginModal() {
            closeAllDropdowns();
            document.getElementById('loginModal').classList.add('active');
            document.getElementById('loginError').classList.remove('show');
        }

        function closeLoginModal() {
            document.getElementById('loginModal').classList.remove('active');
            document.getElementById('adminUsername').value = '';
            document.getElementById('adminPassword').value = '';
            document.getElementById('loginError').classList.remove('show');
        }

        async function openAdminModal(skipCheck = false) {
            const ok = skipCheck ? true : await checkAdminLogin();
            if (ok) {
                closeAllDropdowns();
                document.getElementById('adminModal').classList.add('active');
                renderAdminProductList();
                updateCategoryLists();
            } else {
                openLoginModal();
            }
        }

        function closeAdminModal() {
            document.getElementById('adminModal').classList.remove('active');
            resetForm();
        }

        // ===== SUPABASE DATABASE FUNCTIONS =====
        async function loadProducts() {
            showLoading('Memuat data produk...');
            
            try {
                // Load products dari Supabase
                const { data: products, error } = await supabaseClient
                    .from('products')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (error) {
                    console.error('Error loading products:', error);
                    allProducts = [...defaultProducts];
                } else {
                    // FIX: Pastikan URL gambar benar dengan format Supabase Storage
                    allProducts = (products || []).map(product => ({
                        ...product,
                        // Fix URL gambar jika masih menggunakan path lokal
                        image: fixImageUrl(product.image)
                    }));
                }
                
                // Load categories dari tabel categories atau extract dari products
                const { data: categories, error: categoriesError } = await supabaseClient
                    .from('categories')
                    .select('name');
                
                if (categoriesError || !categories || categories.length === 0) {
                    // Extract unique categories dari products
                    const uniqueCategories = [...new Set(allProducts.map(p => p.category))].filter(c => c);
                    allCategories = [...new Set([...defaultCategories, ...uniqueCategories])];
                } else {
                    allCategories = categories.map(c => c.name);
                }
                
                filteredProducts = [...allProducts];
                renderProducts();
                renderAdminProductList();
                updateCategoryLists();
                
                if (allProducts.length === 0) {
                    showNotification('info', 'Info', 'Belum ada produk. Silakan tambah produk baru.');
                } else {
                    showNotification('success', 'Berhasil', `${allProducts.length} produk berhasil dimuat`);
                }
            } catch (error) {
                console.error('Error loading data:', error);
                showNotification('error', 'Error', 'Gagal memuat data produk');
            } finally {
                hideLoading();
            }
        }

        function normalizeImageFilename(value) {
            if (!value) return '';
            const v = String(value).trim();
            // Jika sudah filename
            if (!v.startsWith('http') && v.includes('.')) return v;
            // Jika URL supabase storage public, ambil nama file setelah /product-images/
            const marker = '/product-images/';
            if (v.includes(marker)) {
                const part = v.split(marker).pop();
                // Hapus query string jika ada
                return part.split('?')[0];
            }
            // URL lain: biarkan apa adanya
            return v;
        }

        function buildPublicImageUrl(filenameOrUrl) {
            if (!filenameOrUrl) return 'https://via.placeholder.com/400x400/0071e3/ffffff?text=Produk';
            const v = String(filenameOrUrl).trim();
            if (v.startsWith('http')) return v;
            if (v.includes('.')) return `${SUPABASE_URL}/storage/v1/object/public/product-images/${v}`;
            return 'https://via.placeholder.com/400x400/0071e3/ffffff?text=Produk';
        }

        function fixImageUrl(imageUrl) {
            if (!imageUrl) return 'https://via.placeholder.com/400x400/0071e3/ffffff?text=Produk';
            
            // Jika URL sudah lengkap, return as is
            if (imageUrl.startsWith('http')) return imageUrl;
            
            // Jika hanya nama file, tambahkan base URL Supabase Storage
            if (imageUrl.includes('.')) {
                return `${SUPABASE_URL}/storage/v1/object/public/product-images/${imageUrl}`;
            }
            
            // Default placeholder
            return 'https://via.placeholder.com/400x400/0071e3/ffffff?text=Produk';
        }

        async function saveProduct() {
            const id = document.getElementById('productId').value;
            const name = document.getElementById('productName').value.trim();
            const category = document.getElementById('productCategory').value.trim().toLowerCase();
            const price = document.getElementById('productPrice').value.trim();
            const desc = document.getElementById('productDesc').value.trim();
            const stock = document.getElementById('productStock').value.trim();
            const rating = parseFloat(document.getElementById('productRating').value);
            const badge = document.getElementById('productBadge').value;
            const imageRaw = document.getElementById('productImageData').value;

            // DB menyimpan filename saja (legacy URL tetap didukung)
            const image = normalizeImageFilename(imageRaw);

            // Untuk validasi UI, field tetap bernama desc
            const validationData = {
                name,
                category,
                price,
                desc,
                stock,
                rating,
                badge,
                image
            };

            // Validasi data
            const errors = validateProductData(validationData);
            if (!showValidationErrors(errors)) {
                showNotification('error', 'Validasi Gagal', 'Harap perbaiki field yang error');
                return;
            }

            showLoading('Menyimpan produk...');

            try {
                const badgeText = badge === 'bestseller' ? '🏆 BEST SELLER' :
                                 badge === 'new' ? '✨ PILIHAN HEMAT' :
                                 badge === 'promo' ? '🔥 ECERAN' : '';

                const productDataForDb = {
                    name,
                    category,
                    price,
                    description: desc,
                    stock,
                    rating,
                    badge,
                    badge_text: badgeText,
                    image,
                    updated_at: new Date().toISOString()
                };

                if (id) {
                    // Update existing product
                    const { error } = await supabaseClient
                        .from('products')
                        .update(productDataForDb)
                        .eq('id', id);

                    if (error) throw error;

                    // Jika ganti gambar saat edit, hapus gambar lama di storage
                    if (editingOriginalImageFilename && editingOriginalImageFilename !== image) {
                        const oldFile = normalizeImageFilename(editingOriginalImageFilename);
                        const newFile = normalizeImageFilename(image);
                        if (oldFile && oldFile.includes('.') && oldFile !== newFile) {
                            await supabaseClient.storage
                                .from('product-images')
                                .remove([oldFile]);
                        }
                    }

                    showNotification('success', 'Berhasil', 'Produk berhasil diupdate!');
                } else {
                    // Add new product
                    const { error } = await supabaseClient
                        .from('products')
                        .insert([{
                            ...productDataForDb,
                            created_at: new Date().toISOString()
                        }]);

                    if (error) throw error;

                    showNotification('success', 'Berhasil', 'Produk berhasil ditambahkan!');
                }

                // Reload data
                await loadProducts();
                resetForm();
            } catch (error) {
                console.error('Error saving product:', error);
                showNotification('error', 'Error', 'Gagal menyimpan produk: ' + (error.message || error));
            } finally {
                hideLoading();
            }
        }

        async function deleteProduct(id = null) {
            if (!id) {
                id = document.getElementById('productId').value;
            }
            
            if (!id) return;
            
            if (!confirm('Yakin ingin menghapus produk ini? Tindakan ini tidak bisa dibatalkan.')) {
                return;
            }
            
            showLoading('Menghapus produk...');
            
            try {
                // Ambil data produk dulu (untuk tahu filename gambar)
                const { data: prod, error: fetchErr } = await supabaseClient
                    .from('products')
                    .select('id,image')
                    .eq('id', id)
                    .single();
                if (fetchErr) throw fetchErr;

                const filename = normalizeImageFilename(prod?.image);

                // Hapus row produk
                const { error } = await supabaseClient
                    .from('products')
                    .delete()
                    .eq('id', id);
                if (error) throw error;

                // Hapus file storage (jika filename valid)
                if (filename && !filename.startsWith('http') && filename.includes('.')) {
                    const { error: storageErr } = await supabaseClient.storage
                        .from('product-images')
                        .remove([filename]);
                    // Jangan gagalkan delete produk kalau file sudah tidak ada
                    if (storageErr) console.warn('Storage remove warning:', storageErr.message || storageErr);
                }

                await loadProducts();
                resetForm();
                showNotification('success', "Berhasil", "Produk berhasil dihapus!");
            } catch (error) {
                console.error('Error deleting product:', error);
                showNotification('error', "Error", "Gagal menghapus produk");
            } finally {
                hideLoading();
            }
        }

        async function addNewCategory() {
            const input = document.getElementById('newCategoryInput');
            const categoryName = input.value.trim().toLowerCase();
            
            if (!categoryName) {
                showNotification('error', 'Error', 'Nama kategori tidak boleh kosong!');
                return;
            }
            
            if (allCategories.includes(categoryName)) {
                showNotification('warning', 'Peringatan', 'Kategori sudah ada!');
                return;
            }
            
            showLoading('Menambahkan kategori...');
            
            try {
                // Coba simpan ke tabel categories
                const { data, error } = await supabaseClient
                    .from('categories')
                    .insert([{ name: categoryName }]);
                
                if (error && !error.message.includes('duplicate key')) {
                    console.log('Categories table not available, using local array');
                }
                
                allCategories.push(categoryName);
                updateCategoryLists();
                input.value = '';
                showNotification('success', 'Berhasil', `Kategori "${categoryName}" berhasil ditambahkan!`);
            } catch (error) {
                console.error('Error adding category:', error);
                showNotification('error', 'Error', 'Gagal menambahkan kategori');
            } finally {
                hideLoading();
            }
        }

        async function deleteCategory(categoryName) {
            if (!confirm(`Yakin ingin menghapus kategori "${categoryName}"?`)) {
                return;
            }
            
            showLoading('Menghapus kategori...');
            
            try {
                // Hapus dari tabel categories
                const { error } = await supabaseClient
                    .from('categories')
                    .delete()
                    .eq('name', categoryName);
                
                if (error) {
                    console.log('Categories table not available, deleting from local array');
                }
                
                allCategories = allCategories.filter(cat => cat !== categoryName);
                updateCategoryLists();
                showNotification('success', 'Berhasil', `Kategori "${categoryName}" berhasil dihapus!`);
            } catch (error) {
                console.error('Error deleting category:', error);
                showNotification('error', 'Error', 'Gagal menghapus kategori');
            } finally {
                hideLoading();
            }
        }

        // ===== IMAGE UPLOAD AND COMPRESSION =====
        document.getElementById('productImageInput').addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            // Check file type
            if (!file.type.match('image/jpeg') && !file.type.match('image/jpg') && !file.type.match('image/png')) {
                showNotification('error', 'Format Error', 'Hanya format JPG/PNG yang diperbolehkan!');
                this.value = '';
                return;
            }
            
            // Check file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('error', 'Ukuran Error', 'Ukuran file maksimal 5MB!');
                this.value = '';
                return;
            }
            
            try {
                showLoading('Mengupload gambar...');
                
                // Upload ke Supabase Storage
                const fileName = `product_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                const { data, error } = await supabaseClient.storage
                    .from('product-images')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (error) throw error;
                
                // Simpan filename saja ke hidden input (sesuai struktur database)
                document.getElementById('productImageData').value = fileName;

                // Preview pakai URL public
                const { data: { publicUrl } } = supabaseClient.storage
                    .from('product-images')
                    .getPublicUrl(fileName);

                const preview = document.getElementById('imagePreview');
                preview.src = publicUrl;
                preview.classList.add('show');
                
                // Clear image error
                document.getElementById('imageError').classList.remove('show');
                
                showNotification('success', 'Berhasil', 'Gambar berhasil diupload');
            } catch (error) {
                console.error('Error uploading image:', error);
                showNotification('error', 'Error', 'Gagal mengupload gambar. Silakan coba lagi.');
            } finally {
                hideLoading();
            }
        });

        // ===== LAZY LOADING =====
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.onload = () => {
                            img.classList.add('loaded');
                        };
                        img.onerror = () => {
                            // Fallback ke placeholder jika gambar error
                            img.src = `https://via.placeholder.com/400x400/0071e3/ffffff?text=${encodeURIComponent(img.alt || 'Produk')}`;
                            img.classList.add('loaded');
                        };
                        img.removeAttribute('data-src');
                        observer.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });

        // ===== GENERATE PRODUCT CARD =====
        function generateProductCard(product) {
            const stars = '★'.repeat(Math.floor(product.rating || 4.5));
            const badgeHTML = product.badge ? `<div class="product-badge badge-${product.badge}">${product.badge_text || ''}</div>` : '';
            
            // Gunakan data-src untuk lazy loading
            const imageUrl = fixImageUrl(product.image);
            
            return `
                <div class="product-card animate-on-scroll visible" data-category="${product.category}" data-search="${product.name.toLowerCase()} ${product.description.toLowerCase()} ${product.category.toLowerCase()}">
                    ${badgeHTML}
                    <div class="product-image">
                        <img data-src="${imageUrl}" alt="${product.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x400/0071e3/ffffff?text=${encodeURIComponent(product.name)}'">
                    </div>
                    <div class="product-info">
                        <div class="product-category">${product.category ? product.category.charAt(0).toUpperCase() + product.category.slice(1) : 'Produk'}</div>
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-desc">${product.description}</p>
                        <div class="product-rating">
                            <div class="stars">
                                ${stars.split('').map(s => `<span class="star">${s}</span>`).join('')}
                            </div>
                            <span class="rating-text">(${product.rating || 4.5}/5)</span>
                        </div>
                        <div class="product-price-wrapper">
                            <div class="product-price">${product.price}</div>
                        </div>
                        <div class="product-stock">
                            <div class="stock-indicator"></div>
                            <span class="stock-text">${product.stock}</span>
                        </div>
                        <a href="https://wa.me/6281253680904?text=Halo,%20saya%20mau%20pesan%20${encodeURIComponent(product.name)}" class="btn-buy" target="_blank" rel="noopener">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                            </svg>
                            <span>Pesan Sekarang</span>
                        </a>
                    </div>
                </div>
            `;
        }

        // ===== RENDER PRODUCTS WITH SEARCH =====
        function renderProducts(append = false) {
            const productGrid = document.getElementById('productGrid');
            const loadMoreBtn = document.getElementById('loadMoreBtn');
            const searchResultsInfo = document.getElementById('searchResultsInfo');
            
            let productsToShow = filteredProducts;
            
            // Apply search filter
            if (currentSearch) {
                const searchTerm = currentSearch.toLowerCase();
                productsToShow = productsToShow.filter(product => 
                    (product.name && product.name.toLowerCase().includes(searchTerm)) ||
                    (product.description && product.description.toLowerCase().includes(searchTerm)) ||
                    (product.category && product.category.toLowerCase().includes(searchTerm))
                );
                
                // Update search results info
                searchResultsInfo.textContent = `Menampilkan ${productsToShow.length} hasil untuk "${currentSearch}"`;
            } else {
                searchResultsInfo.textContent = '';
            }
            
            const start = 0;
            const end = currentPage * PRODUCTS_PER_PAGE;
            const productsToDisplay = productsToShow.slice(start, end);
            
            if (!append) {
                productGrid.innerHTML = '';
                
                // Show no results message
                if (productsToShow.length === 0) {
                    productGrid.innerHTML = `
                        <div class="no-results">
                            <div style="font-size: 4rem; margin-bottom: 1rem;">🔍</div>
                            <h3 style="margin-bottom: 0.5rem;">Produk tidak ditemukan</h3>
                            <p>Coba kata kunci lain atau lihat semua produk</p>
                        </div>
                    `;
                    loadMoreBtn.style.display = 'none';
                    return;
                }
            }
            
            const newProductsStart = append ? (currentPage - 1) * PRODUCTS_PER_PAGE : 0;
            const newProducts = productsToShow.slice(newProductsStart, end);
            
            newProducts.forEach(product => {
                productGrid.insertAdjacentHTML('beforeend', generateProductCard(product));
            });
            
            // Apply lazy loading to images
            const images = productGrid.querySelectorAll('img[data-src]');
            images.forEach(img => imageObserver.observe(img));
            
            if (end >= productsToShow.length) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'inline-flex';
            }
        }

        // ===== SEARCH FUNCTIONALITY =====
        function setupSearch() {
            const searchInput = document.getElementById('searchInput');
            let searchTimeout;
            
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                
                searchTimeout = setTimeout(() => {
                    currentSearch = e.target.value.trim();
                    currentPage = 1;
                    renderProducts(false);
                    
                    // Update filter tabs to show "All" when searching
                    if (currentSearch) {
                        document.querySelectorAll('.filter-tab').forEach(tab => {
                            tab.classList.remove('active');
                        });
                        document.querySelector('.filter-tab[data-filter="all"]').classList.add('active');
                    }
                }, 300);
            });
            
            // Clear search button
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    currentSearch = '';
                    renderProducts(false);
                    searchResultsInfo.textContent = '';
                }
            });
        }

        // ===== FILTER =====
        function filterProducts(filter) {
            currentFilter = filter;
            currentPage = 1;
            
            if (filter === 'all') {
                filteredProducts = [...allProducts];
            } else {
                filteredProducts = allProducts.filter(p => p.category === filter);
            }
            
            // Clear search when changing filter
            document.getElementById('searchInput').value = '';
            currentSearch = '';
            document.getElementById('searchResultsInfo').textContent = '';
            
            renderProducts(false);
        }

        // ===== LOAD MORE =====
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            currentPage++;
            renderProducts(true);
            
            setTimeout(() => {
                const firstNewProduct = document.querySelector('.product-grid').children[(currentPage - 1) * PRODUCTS_PER_PAGE];
                if (firstNewProduct) {
                    firstNewProduct.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }, 100);
        });

        // ===== FILTER TABS =====
        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const filterValue = tab.getAttribute('data-filter');
                filterProducts(filterValue);
            });
        });

        // ===== NAVBAR SCROLL EFFECT =====
        const navbar = document.getElementById('navbar');
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });

        // ===== IMPROVED DROPDOWN FOR MOBILE =====
        const dropdowns = document.querySelectorAll('.dropdown');
        const dropdownOverlay = document.getElementById('dropdownOverlay');
        let activeDropdown = null;

        function closeAllDropdowns() {
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
            dropdownOverlay.classList.remove('active');
            activeDropdown = null;
            
            // Reset dropdown content position for desktop
            if (window.innerWidth > 768) {
                dropdowns.forEach(dropdown => {
                    const content = dropdown.querySelector('.dropdown-content');
                    if (content) {
                        content.style.position = 'absolute';
                        content.style.bottom = '';
                        content.style.left = '';
                        content.style.right = '';
                        content.style.width = '';
                        content.style.maxHeight = '';
                        content.style.borderRadius = '';
                    }
                });
            }
        }

        dropdowns.forEach(dropdown => {
            const toggle = dropdown.querySelector('.dropdown-toggle');
            const content = dropdown.querySelector('.dropdown-content');
            
            if (toggle && content) {
                // Desktop hover
                dropdown.addEventListener('mouseenter', () => {
                    if (window.innerWidth > 768) {
                        closeAllDropdowns();
                        dropdown.classList.add('active');
                        activeDropdown = dropdown;
                    }
                });
                
                dropdown.addEventListener('mouseleave', () => {
                    if (window.innerWidth > 768) {
                        setTimeout(() => {
                            if (activeDropdown === dropdown) {
                                closeAllDropdowns();
                            }
                        }, 300);
                    }
                });
                
                // Mobile click
                toggle.addEventListener('click', (e) => {
                    e.stopPropagation();
                    
                    if (window.innerWidth <= 768) {
                        if (activeDropdown === dropdown) {
                            closeAllDropdowns();
                        } else {
                            closeAllDropdowns();
                            dropdown.classList.add('active');
                            activeDropdown = dropdown;
                            dropdownOverlay.classList.add('active');
                        }
                    } else {
                        // Desktop click fallback
                        if (activeDropdown === dropdown) {
                            closeAllDropdowns();
                        } else {
                            closeAllDropdowns();
                            dropdown.classList.add('active');
                            activeDropdown = dropdown;
                        }
                    }
                });
                
                // Close dropdown when clicking on links
                const links = content.querySelectorAll('a');
                links.forEach(link => {
                    link.addEventListener('click', () => {
                        closeAllDropdowns();
                    });
                });
            }
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                closeAllDropdowns();
            }
        });

        // Close dropdown overlay when clicked
        dropdownOverlay.addEventListener('click', closeAllDropdowns);

        // ===== IMPROVED SMOOTH SCROLL =====
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        // Close any open dropdowns
                        closeAllDropdowns();
                        
                        // Calculate scroll position with offset
                        const navbarHeight = navbar.offsetHeight;
                        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
                        const offsetPosition = targetPosition - navbarHeight - 20;
                        
                        window.scrollTo({
                            top: offsetPosition,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        });

        // ===== SCROLL ANIMATION =====
        const scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });

        document.querySelectorAll('.animate-on-scroll').forEach(el => {
            scrollObserver.observe(el);
        });

        // ===== ADMIN PRODUCT MANAGEMENT =====
        let editingProductId = null;
        let editingOriginalImageFilename = '';


        function renderAdminProductList() {
            const container = document.getElementById('productListAdmin');
            container.innerHTML = '';
            
            if (allProducts.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary)">Belum ada produk. Silakan tambah produk baru.</div>';
                return;
            }
            
            allProducts.forEach(product => {
                const div = document.createElement('div');
                div.className = 'admin-product-item';
                div.innerHTML = `
                    <img src="${fixImageUrl(product.image)}" class="admin-product-image" alt="${product.name}" onerror="this.src='https://via.placeholder.com/60x60/0071e3/ffffff?text=Img'">
                    <div class="admin-product-info">
                        <div class="admin-product-name">${product.name}</div>
                        <div class="admin-product-price">${product.price}</div>
                    </div>
                    <div class="admin-product-actions">
                        <button class="action-btn edit-btn" onclick="editProduct('${product.id}')">Edit</button>
                        <button class="action-btn delete-btn" onclick="confirmDeleteProduct('${product.id}')">Hapus</button>
                    </div>
                `;
                container.appendChild(div);
            });
        }

        function editProduct(id) {
            const product = allProducts.find(p => p.id === id);
            if (!product) return;
            
            editingProductId = id;
            
            document.getElementById('productId').value = id;
            document.getElementById('productName').value = product.name;
            document.getElementById('productCategory').value = product.category;
            document.getElementById('productPrice').value = product.price;
            document.getElementById('productDesc').value = product.description;
            document.getElementById('productStock').value = product.stock;
            document.getElementById('productRating').value = product.rating || 4.5;
            document.getElementById('productBadge').value = product.badge || '';
            
            // Set image preview
            const filename = normalizeImageFilename(product.image);
            editingOriginalImageFilename = filename;

            const preview = document.getElementById('imagePreview');
            preview.src = fixImageUrl(filename);
            preview.classList.add('show');
            document.getElementById('productImageData').value = filename;
            
            // Update form title
            document.getElementById('formTitle').textContent = 'Edit Produk';
            document.getElementById('saveProductBtn').textContent = 'Update Produk';
            document.getElementById('deleteProductBtn').style.display = 'block';
            
            // Clear validation errors
            showValidationErrors({});
            
            // Scroll to form
            document.querySelector('.modal-content').scrollTop = 0;
        }

        function confirmDeleteProduct(id) {
            if (confirm('Yakin ingin menghapus produk ini? Tindakan ini tidak bisa dibatalkan.')) {
                deleteProduct(id);
            }
        }

        function resetForm() {
            editingProductId = null;
            editingOriginalImageFilename = '';
            
            document.getElementById('productId').value = '';
            document.getElementById('productName').value = '';
            document.getElementById('productCategory').value = '';
            document.getElementById('productPrice').value = '';
            document.getElementById('productDesc').value = '';
            document.getElementById('productStock').value = '';
            document.getElementById('productRating').value = '4.5';
            document.getElementById('productBadge').value = '';
            document.getElementById('productImageData').value = '';
            
            const preview = document.getElementById('imagePreview');
            preview.src = '';
            preview.classList.remove('show');
            
            document.getElementById('productImageInput').value = '';
            
            document.getElementById('formTitle').textContent = 'Tambah Produk Baru';
            document.getElementById('saveProductBtn').textContent = 'Simpan Produk';
            document.getElementById('deleteProductBtn').style.display = 'none';
            
            // Clear validation errors
            showValidationErrors({});
        }

        // ===== UPDATE CATEGORY LISTS =====
        function updateCategoryLists() {
            // Update datalist in admin form
            const datalist = document.getElementById('categoryOptions');
            datalist.innerHTML = '';
            
            allCategories.forEach(category => {
                const option = document.createElement('option');
                option.value = category;
                option.textContent = category;
                datalist.appendChild(option);
            });
            
            // Update category tags in admin panel
            renderCategoryTags();
            
            // Update filter tabs based on categories
            updateFilterTabs();
        }

        function renderCategoryTags() {
            const container = document.getElementById('categoryList');
            container.innerHTML = '';
            
            allCategories.forEach(category => {
                const tag = document.createElement('div');
                tag.className = 'category-tag';
                tag.innerHTML = `
                    ${category}
                    <button class="delete-category" onclick="deleteCategory('${category}')">×</button>
                `;
                container.appendChild(tag);
            });
        }

        function updateFilterTabs() {
            const tabsContainer = document.querySelector('.filter-tabs');
            if (!tabsContainer) return;
            
            // Keep existing tabs but update based on categories
            const existingTabs = tabsContainer.querySelectorAll('.filter-tab');
            const existingFilters = Array.from(existingTabs).map(tab => tab.dataset.filter);
            
            // Add new categories as tabs if they don't exist
            allCategories.forEach(category => {
                if (!existingFilters.includes(category) && category !== 'all') {
                    const tab = document.createElement('button');
                    tab.className = 'filter-tab';
                    tab.dataset.filter = category;
                    tab.textContent = category.charAt(0).toUpperCase() + category.slice(1);
                    tab.addEventListener('click', () => {
                        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        filterProducts(category);
                    });
                    tabsContainer.appendChild(tab);
                }
            });
        }

        // ===== NAVBAR ADMIN MENU CLICK =====
        document.getElementById('navAdmin').addEventListener('click', function(e) {
            e.preventDefault();
            openAdminModal();
        });

        // ===== RESPONSIVE ADJUSTMENTS =====
        function handleResize() {
            // Close dropdowns when switching between mobile/desktop
            if (window.innerWidth > 768 && activeDropdown) {
                closeAllDropdowns();
            }
        }

        window.addEventListener('resize', handleResize);

        // ===== INITIALIZE =====
        window.addEventListener('DOMContentLoaded', async () => {
            // Tampilkan loading state
            const productGrid = document.getElementById('productGrid');
            productGrid.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary)">Memuat data...</div>';
            
            // Cek login status
            await checkAdminLogin();
            
            // Load data dari Supabase
            await loadProducts();
            
            // Setup filter default
            filterProducts('all');
            setupSearch();
            
            // Inisialisasi event listener untuk admin
            document.getElementById('navAdmin').addEventListener('click', function(e) {
                e.preventDefault();
                openAdminModal();
            });
            
            // Auto refresh session
            setInterval(checkAdminLogin, 30000); // Cek setiap 30 detik
            
            // Check session on page load
            supabaseClient.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    // Update UI saja (hindari loop signOut)
                    closeAdminModal();
                    updateAdminMenu(false);
                } else if (event === 'SIGNED_IN') {
                    checkAdminLogin();
                }
            });
        });
    
