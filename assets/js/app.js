        // ===== SUPABASE CONFIGURATION =====
        // NOTE: Jangan ubah flow UI / fitur. Bagian ini hanya hardening untuk production (Vercel + browser tracking prevention).
        const SUPABASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co';
        const SUPABASE_ANON_KEY = 'sb_publishable_k_Tjf3ZGz2qsyR6pSfrtdg_FpM3k4qT';

        // Storage fallback untuk kasus Tracking Prevention / Storage blocked (Safari/Firefox/Brave, dll.)
        function createMemoryStorage() {
            const store = Object.create(null);
            return {
                getItem: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
                setItem: (key, value) => { store[key] = String(value); },
                removeItem: (key) => { delete store[key]; }
            };
        }

        function getSafeBrowserStorage() {
            // Default: localStorage
            try {
                const k = '__sb_test__';
                window.localStorage.setItem(k, '1');
                window.localStorage.removeItem(k);
                return window.localStorage;
            } catch (e) {
                console.warn('[Supabase] localStorage blocked, fallback to in-memory storage (session may not persist across reload).', e);
                return createMemoryStorage();
            }
        }

        // Inisialisasi Supabase client (global + reuse)
        // CDN v2 exposes global `supabase` with `createClient`.
        window.createClient = (window.supabase && window.supabase.createClient) ? window.supabase.createClient : undefined;

        const supabaseClient = window.supabaseClient || supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                storage: getSafeBrowserStorage()
            }
        });

        window.supabaseClient = supabaseClient;

        // localStorage wrapper agar tidak crash jika diblokir Tracking Prevention
        const __memoryKV = Object.create(null);
        function localStorageSafeGet(key) {
            try { return window.localStorage.getItem(key); } catch (_) { return Object.prototype.hasOwnProperty.call(__memoryKV, key) ? __memoryKV[key] : null; }
        }
        function localStorageSafeSet(key, value) {
            try { window.localStorage.setItem(key, String(value)); } catch (_) { __memoryKV[key] = String(value); }
        }
        function localStorageSafeRemove(key) {
            try { window.localStorage.removeItem(key); } catch (_) { delete __memoryKV[key]; }
        }

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

        // ===== LOADING SYSTEM =====
        function showLoading(text = 'Memproses...') {
            const overlay = document.getElementById('loadingOverlay');
            const loadingText = document.getElementById('loadingText');
            loadingText.textContent = text;
            overlay.classList.add('show');
        }

        function hideLoading() {
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.remove('show');
        }

        // ===== UTILITY FUNCTIONS =====
        function formatRupiah(number) {
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(number);
        }

        function truncateText(text, maxLength = 100) {
            if (!text) return '';
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
        async function loginAdmin() {
            const identifier = document.getElementById('adminUsername').value.trim();
            const password = document.getElementById('adminPassword').value.trim();

            // Validasi input
            if (!identifier || !password) {
                document.getElementById('loginError').textContent = 'Username/Email dan password harus diisi';
                document.getElementById('loginError').classList.add('show');
                return;
            }

            // Debug helpers
            console.groupCollapsed('[Auth] loginAdmin');
            console.log('identifier:', identifier);

            showLoading('Memverifikasi login...');

            try {
                let emailToLogin = null;
                let username = null;

                // 1) Jika input mengandung "@", anggap email
                if (identifier.includes('@')) {
                    emailToLogin = identifier.toLowerCase();
                    username = emailToLogin.split('@')[0] || null;
                } else {
                    // 2) Jika username: lookup ke profiles (tanpa kolom email)
                    username = identifier.toLowerCase();

                    const { data: profile, error: profileError } = await supabaseClient
                        .from('profiles')
                        .select('id, username, role')
                        .eq('username', username)
                        .maybeSingle();

                    if (profileError) {
                        console.warn('[Profiles] lookup username error:', profileError);
                    }

                    if (!profile) {
                        document.getElementById('loginError').textContent = 'User tidak ditemukan di profiles';
                        document.getElementById('loginError').classList.add('show');
                        throw new Error('Profile not found');
                    }

                    if (profile.role !== 'admin') {
                        document.getElementById('loginError').textContent = 'Akses ditolak. Bukan admin.';
                        document.getElementById('loginError').classList.add('show');
                        throw new Error('Not admin');
                    }

                    // Karena tabel profiles tidak menyimpan email, kita pakai mapping email berbasis username (existing flow)
                    emailToLogin = `${username}@berkatyakin.com`;
                }

                console.log('emailToLogin:', emailToLogin);

                // 3) Sign in (email/password)
                const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
                    email: emailToLogin,
                    password
                });

                if (authError) {
                    console.warn('[Auth] signInWithPassword error:', authError);

                    // Optional: auto signUp untuk admin (existing behaviour) - tetap dijaga tapi dibuat aman
                    if (String(authError.message || '').toLowerCase().includes('invalid login credentials')) {
                        console.warn('[Auth] Invalid credentials. Attempting signUp (if enabled).');
                        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
                            email: emailToLogin,
                            password,
                            options: {
                                data: { username, role: 'admin' }
                            }
                        });

                        if (signUpError) throw signUpError;

                        // Retry login setelah signUp
                        const { data: retryData, error: retryErr } = await supabaseClient.auth.signInWithPassword({
                            email: emailToLogin,
                            password
                        });

                        if (retryErr) throw retryErr;

                        // Continue with retryData
                        await afterAdminLoginSuccess(retryData?.session, username);
                    } else {
                        throw authError;
                    }
                } else {
                    await afterAdminLoginSuccess(authData?.session, username);
                }

                closeLoginModal();
                openAdminModal();
                updateAdminMenu(true);
                showNotification('success', 'Login Berhasil', 'Selamat datang di panel admin!');
            } catch (error) {
                console.error('Login error:', error);
                if (!document.getElementById('loginError').classList.contains('show')) {
                    document.getElementById('loginError').textContent = 'Username/email atau password salah';
                    document.getElementById('loginError').classList.add('show');
                }
                showNotification('error', 'Login Gagal', 'Terjadi kesalahan saat login');
            } finally {
                console.groupEnd();
                hideLoading();
            }
        }

        async function afterAdminLoginSuccess(session, username) {
            // Session persist handled by Supabase, tapi kita simpan flag UI (safe storage)
            if (session) {
                try {
                    // optional legacy token usage (tidak mengubah flow existing)
                    localStorageSafeSet('supabase.auth.token', JSON.stringify(session));
                } catch (_) {}
            }

            localStorageSafeSet('admin_logged_in', 'true');
            if (username) localStorageSafeSet('admin_username', username);

            // Pastikan role admin terdeteksi dari profiles.id = auth.user.id
            try {
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (user?.id) {
                    const { data: profile, error } = await supabaseClient
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .maybeSingle();

                    if (error) console.warn('[Profiles] post-login role check error:', error);

                    // Jika profile belum ada tapi username diketahui, coba upsert (aman: kalau ditolak RLS, cuma warn)
                    if (!profile && username) {
                        const { error: upsertErr } = await supabaseClient
                            .from('profiles')
                            .upsert({ id: user.id, username, role: 'admin' }, { onConflict: 'id' });

                        if (upsertErr) console.warn('[Profiles] upsert skipped/denied:', upsertErr);
                    }
                }
            } catch (e) {
                console.warn('[Auth] afterAdminLoginSuccess warning:', e);
            }

            await checkAdminLogin();
        }

        async function checkAdminLogin() {
            try {
                const { data: { session }, error: sessErr } = await supabaseClient.auth.getSession();

                if (sessErr) {
                    console.warn('[Auth] getSession error:', sessErr);
                }

                if (!session || !session.user) {
                    // Tidak ada session aktif
                    updateAdminMenu(false);
                    document.body.classList.remove('admin-logged');
                    localStorageSafeRemove('admin_logged_in');
                    localStorageSafeRemove('admin_username');
                    return false;
                }

                const user = session.user;

                // Ambil role dari profiles berdasarkan id (FK ke auth.users)
                const { data: profile, error: profErr } = await supabaseClient
                    .from('profiles')
                    .select('username, role')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profErr) {
                    console.warn('[Profiles] role check error:', profErr);
                }

                const role = profile?.role || user.user_metadata?.role || null;
                const username = profile?.username || user.user_metadata?.username || (user.email ? user.email.split('@')[0] : null);

                if (role === 'admin') {
                    updateAdminMenu(true);
                    document.body.classList.add('admin-logged');

                    localStorageSafeSet('admin_logged_in', 'true');
                    if (username) localStorageSafeSet('admin_username', username);

                    return true;
                }

                // Bukan admin / profile tidak ditemukan
                updateAdminMenu(false);
                document.body.classList.remove('admin-logged');
                localStorageSafeRemove('admin_logged_in');
                localStorageSafeRemove('admin_username');
                return false;
            } catch (error) {
                console.error('[Auth] checkAdminLogin error:', error);
                updateAdminMenu(false);
                document.body.classList.remove('admin-logged');
                return false;
            }
        }

        async function logoutAdmin() {
            try {
                await supabaseClient.auth.signOut();
                localStorageSafeRemove('admin_logged_in');
                localStorageSafeRemove('admin_username');
                localStorageSafeRemove('supabase.auth.token');
                
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

        function openAdminModal() {
            // Cek login status
            const isLoggedIn = localStorageSafeGet('admin_logged_in') === 'true';
            
            if (isLoggedIn) {
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

        // ===== DROPDOWN / NAV LOGIC (existing) =====
        const dropdownOverlay = document.getElementById('dropdownOverlay');
        let activeDropdown = null;

        function closeAllDropdowns() {
            document.querySelectorAll('.dropdown').forEach(dd => dd.classList.remove('active'));
            activeDropdown = null;
            dropdownOverlay.classList.remove('active');
        }

        // Dropdown toggle handlers
        document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
            const dropdown = toggle.closest('.dropdown');
            const content = dropdown.querySelector('.dropdown-content');

            toggle.addEventListener('click', (e) => {
                e.preventDefault();
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
        const navbar = document.getElementById('navbar');
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

                if (categoriesError) {
                    // Categories table bisa saja tidak ada. Jangan bikin console merah di production.
                    console.warn('[Categories] Table missing / not accessible. Fallback to categories dari products.', categoriesError);
                }

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

        function fixImageUrl(imageUrl) {
            // Fallback image lokal (production-safe)
            const fallback = '/assets/img/no-image.png';

            if (!imageUrl) return fallback;

            // Jika URL sudah lengkap / absolute, pakai apa adanya
            if (typeof imageUrl === 'string' && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
                return imageUrl;
            }

            // Jika sudah format Supabase public object, pakai apa adanya
            if (typeof imageUrl === 'string' && imageUrl.includes('/storage/v1/object/public/')) {
                return imageUrl;
            }

            // Jika path absolute lokal
            if (typeof imageUrl === 'string' && imageUrl.startsWith('/')) {
                return imageUrl;
            }

            // Jika hanya nama file (mis: product_123.jpg)
            if (typeof imageUrl === 'string' && imageUrl.includes('.')) {
                const fileName = encodeURIComponent(imageUrl);
                return `${SUPABASE_URL}/storage/v1/object/public/product-images/${fileName}`;
            }

            return fallback;
        }

        function handleImageError(img) {
            try { img.onerror = null; } catch (_) {}
            img.src = '/assets/img/no-image.png';
        }

        // ===== RENDER PRODUCTS (existing) =====
        function renderProducts() {
            const productGrid = document.getElementById('productGrid');
            productGrid.innerHTML = '';
            
            if (!filteredProducts || filteredProducts.length === 0) {
                productGrid.innerHTML = '<div class="no-results">Tidak ada produk yang ditemukan.</div>';
                document.getElementById('loadMoreBtn').style.display = 'none';
                return;
            }
            
            const startIndex = 0;
            const endIndex = currentPage * PRODUCTS_PER_PAGE;
            const productsToShow = filteredProducts.slice(startIndex, endIndex);
            
            productsToShow.forEach(product => {
                const card = document.createElement('div');
                card.className = 'product-card';
                
                const badgeClass = product.badge === 'bestseller' ? 'badge-bestseller' :
                                  product.badge === 'new' ? 'badge-new' :
                                  product.badge === 'promo' ? 'badge-promo' : '';
                
                const badgeHTML = product.badge ? `
                    <div class="product-badge ${badgeClass}">
                        ${product.badge_text || ''}
                    </div>
                ` : '';
                
                const imageUrl = fixImageUrl(product.image);

                card.innerHTML = `
                    ${badgeHTML}
                    <div class="product-image">
                        <img data-src="${imageUrl}" alt="${product.name}" loading="lazy" onerror="handleImageError(this)">
                    </div>
                    <div class="product-info">
                        <div class="product-category">${(product.category || '').toUpperCase()}</div>
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-desc">${truncateText(product.desc, 80)}</p>
                        <div class="product-meta">
                            <div class="product-price">${product.price}</div>
                            <div class="product-rating">
                                ⭐ ${product.rating || 4.5}
                            </div>
                        </div>
                        <div class="product-stock ${product.stock && String(product.stock).toLowerCase().includes('habis') ? 'out-of-stock' : 'in-stock'}">
                            ${product.stock || 'Stok Tersedia'}
                        </div>
                        <a class="btn btn-primary btn-buy" href="https://wa.me/6281253680904?text=Saya%20mau%20pesan%20${encodeURIComponent(product.name)}" target="_blank" rel="noopener">
                            Pesan via WhatsApp
                        </a>
                    </div>
                `;
                
                productGrid.appendChild(card);
            });
            
            // Show/hide load more button
            if (filteredProducts.length > endIndex) {
                document.getElementById('loadMoreBtn').style.display = 'inline-flex';
            } else {
                document.getElementById('loadMoreBtn').style.display = 'none';
            }
            
            // Observe images for lazy loading
            observeImages();
        }

        // ===== LAZY LOADING =====
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.onload = () => {
                        img.classList.add('loaded');
                    };
                    observer.unobserve(img);
                }
            });
        }, { threshold: 0.1 });

        function observeImages() {
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }

        // ===== FILTER + SEARCH =====
        function filterProducts(category) {
            currentFilter = category;
            currentPage = 1;
            
            let products = [...allProducts];
            
            // Apply category filter
            if (category !== 'all') {
                products = products.filter(p => p.category === category);
            }
            
            // Apply search filter
            if (currentSearch) {
                const searchLower = currentSearch.toLowerCase();
                products = products.filter(p =>
                    (p.name && p.name.toLowerCase().includes(searchLower)) ||
                    (p.category && p.category.toLowerCase().includes(searchLower)) ||
                    (p.desc && p.desc.toLowerCase().includes(searchLower))
                );
            }
            
            filteredProducts = products;
            renderProducts();
        }

        function setupSearch() {
            const searchInput = document.getElementById('searchInput');
            const info = document.getElementById('searchResultsInfo');

            if (!searchInput) return;

            searchInput.addEventListener('input', () => {
                currentSearch = searchInput.value.trim();
                currentPage = 1;
                filterProducts(currentFilter);

                if (currentSearch) {
                    info.textContent = `Hasil pencarian "${currentSearch}" : ${filteredProducts.length} produk`;
                } else {
                    info.textContent = '';
                }
            });
        }

        // Load more button
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            currentPage++;
            renderProducts();
        });

        // ===== ADMIN PRODUCT MANAGEMENT =====
        let editingProductId = null;

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
                    <img src="${fixImageUrl(product.image)}" class="admin-product-image" alt="${product.name}" onerror="handleImageError(this)">
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
            document.getElementById('productDesc').value = product.desc;
            document.getElementById('productStock').value = product.stock;
            document.getElementById('productRating').value = product.rating || 4.5;
            document.getElementById('productBadge').value = product.badge || '';
            
            // Set image preview
            const preview = document.getElementById('imagePreview');
            preview.src = fixImageUrl(product.image);
            preview.classList.add('show');
            document.getElementById('productImageData').value = product.image;
            
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
            if (!id) return;
            if (confirm('Yakin ingin menghapus produk ini? Tindakan ini tidak bisa dibatalkan.')) {
                deleteProduct(id);
            }
        }

        function resetForm() {
            editingProductId = null;
            document.getElementById('productId').value = '';
            document.getElementById('productName').value = '';
            document.getElementById('productCategory').value = '';
            document.getElementById('productPrice').value = '';
            document.getElementById('productDesc').value = '';
            document.getElementById('productStock').value = '';
            document.getElementById('productRating').value = 4.5;
            document.getElementById('productBadge').value = '';
            document.getElementById('productImageData').value = '';

            const preview = document.getElementById('imagePreview');
            preview.src = '';
            preview.classList.remove('show');
            
            document.getElementById('formTitle').textContent = 'Tambah Produk Baru';
            document.getElementById('saveProductBtn').textContent = 'Simpan Produk';
            document.getElementById('deleteProductBtn').style.display = 'none';
            
            showValidationErrors({});
        }

        function validateProductData(productData) {
            const errors = {};
            if (!productData.name) errors.name = 'Nama produk wajib diisi';
            if (!productData.category) errors.category = 'Kategori wajib diisi';
            if (!productData.price) errors.price = 'Harga wajib diisi';
            if (!productData.desc) errors.desc = 'Deskripsi wajib diisi';
            if (!productData.stock) errors.stock = 'Status stok wajib diisi';
            if (!productData.image) errors.image = 'Gambar produk wajib diupload';
            if (Number.isNaN(productData.rating) || productData.rating < 1 || productData.rating > 5) errors.rating = 'Rating harus antara 1 - 5';
            return errors;
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
            const imageData = document.getElementById('productImageData').value;
            
            const productData = {
                name,
                category,
                price,
                desc,
                stock,
                rating,
                badge,
                image: imageData,
                wa: encodeURIComponent(name)
            };
            
            // Validasi data
            const errors = validateProductData(productData);
            if (!showValidationErrors(errors)) {
                showNotification('error', 'Validasi Gagal', 'Harap perbaiki field yang error');
                return;
            }
            
            showLoading('Menyimpan produk...');
            
            try {
                const badgeText = badge === 'bestseller' ? '🏆 BEST SELLER' : 
                                 badge === 'new' ? '✨ PILIHAN HEMAT' :
                                 badge === 'promo' ? '🔥 ECERAN' : '';
                
                if (id) {
                    // Update existing product
                    const { data, error } = await supabaseClient
                        .from('products')
                        .update({
                            ...productData,
                            badge_text: badgeText,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', id);
                    
                    if (error) throw error;
                    
                    showNotification('success', 'Berhasil', 'Produk berhasil diupdate!');
                } else {
                    // Add new product
                    const { data, error } = await supabaseClient
                        .from('products')
                        .insert([{
                            ...productData,
                            badge_text: badgeText,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }])
                        .select();
                    
                    if (error) throw error;
                    
                    showNotification('success', 'Berhasil', 'Produk berhasil ditambahkan!');
                }
                
                // Reload data
                await loadProducts();
                resetForm();
            } catch (error) {
                console.error('Error saving product:', error);
                showNotification('error', 'Error', 'Gagal menyimpan produk: ' + (error?.message || 'Unknown error'));
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
                const { error } = await supabaseClient
                    .from('products')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;
                
                await loadProducts();
                resetForm();
                showNotification('success', 'Berhasil', 'Produk berhasil dihapus!');
            } catch (error) {
                console.error('Error deleting product:', error);
                showNotification('error', 'Error', 'Gagal menghapus produk');
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
            
            showLoading('Menambahkan kategori.');
            
            try {
                // Coba simpan ke tabel categories
                const { data, error } = await supabaseClient
                    .from('categories')
                    .insert([{ name: categoryName }]);
                
                if (error && !String(error.message || '').includes('duplicate key')) {
                    console.warn('[Categories] table not available, using local array');
                }
                
                allCategories.push(categoryName);
                updateCategoryLists();
                input.value = '';
                showNotification('success', 'Berhasil', `Kategori "${categoryName}" berhasil ditambahkan!`);
            } catch (error) {
                console.warn('Error adding category:', error);
                showNotification('error', 'Error', 'Gagal menambahkan kategori');
            } finally {
                hideLoading();
            }
        }

        async function deleteCategory(categoryName) {
            if (!confirm(`Yakin ingin menghapus kategori "${categoryName}"?`)) {
                return;
            }
            
            showLoading('Menghapus kategori.');
            
            try {
                // Hapus dari tabel categories
                const { error } = await supabaseClient
                    .from('categories')
                    .delete()
                    .eq('name', categoryName);
                
                if (error) {
                    console.warn('[Categories] table not available, deleting from local array');
                }
                
                allCategories = allCategories.filter(cat => cat !== categoryName);
                updateCategoryLists();
                showNotification('success', 'Berhasil', `Kategori "${categoryName}" berhasil dihapus!`);
            } catch (error) {
                console.warn('Error deleting category:', error);
                showNotification('error', 'Error', 'Gagal menghapus kategori');
            } finally {
                hideLoading();
            }
        }

        function updateCategoryLists() {
            const categoryList = document.getElementById('categoryList');
            const categoryOptions = document.getElementById('categoryOptions');
            
            if (!categoryList || !categoryOptions) return;
            
            categoryList.innerHTML = '';
            categoryOptions.innerHTML = '';
            
            // Add default "all"
            const allOpt = document.createElement('option');
            allOpt.value = 'all';
            categoryOptions.appendChild(allOpt);
            
            // Render categories
            allCategories.forEach(category => {
                if (!category) return;

                // Admin category tags
                const tag = document.createElement('div');
                tag.className = 'category-tag';
                tag.innerHTML = `
                    <span>${category}</span>
                    <button class="delete-category" onclick="deleteCategory('${category}')">×</button>
                `;
                categoryList.appendChild(tag);

                // Datalist options
                const opt = document.createElement('option');
                opt.value = category;
                categoryOptions.appendChild(opt);
            });

            // Keep existing tabs but update based on categories
            const tabsContainer = document.querySelector('.filter-tabs');
            if (!tabsContainer) return;

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
                showLoading('Mengupload gambar.');
                
                // Upload ke Supabase Storage
                const fileName = `product_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
                const { data, error } = await supabaseClient.storage
                    .from('product-images')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (error) throw error;
                
                // Dapatkan URL public
                const { data: { publicUrl } } = supabaseClient.storage
                    .from('product-images')
                    .getPublicUrl(fileName);
                
                document.getElementById('productImageData').value = publicUrl;
                
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
                    logoutAdmin();
                } else if (event === 'SIGNED_IN') {
                    checkAdminLogin();
                }
            });
        });

        // ===== GLOBAL SCOPE EXPORTS (agar onclick tidak undefined) =====
        window.loginAdmin = loginAdmin;
        window.checkAdminLogin = checkAdminLogin;
        window.logoutAdmin = logoutAdmin;
        window.openLoginModal = openLoginModal;
        window.closeLoginModal = closeLoginModal;
        window.openAdminModal = openAdminModal;
        window.closeAdminModal = closeAdminModal;
        window.saveProduct = saveProduct;
        window.deleteProduct = deleteProduct;
        window.resetForm = resetForm;
        window.addNewCategory = addNewCategory;
        window.deleteCategory = deleteCategory;
        window.handleImageError = handleImageError;
