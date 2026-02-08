// ===== SUPABASE CONFIGURATION =====
        const SUPABASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYWdpc2lid2prZ3BkZnh5aHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDg3NzYsImV4cCI6MjA4NjAyNDc3Nn0.bAFsKmyOh3XME-Fdop3VKRltc8gThZydaeIdOiSiztI';
        
        // Inisialisasi Supabase client
        const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false
            }
        });

        // ===== STATE VARIABLES =====
        const PRODUCTS_PER_PAGE = 6;
        let currentPage = 1;
        let currentFilter = 'all';
        let currentSearch = '';
        let filteredProducts = [];
        let allProducts = [];
        let allCategories = ['mie', 'rokok', 'sembako', 'minuman', 'snack', 'lainnya'];
        let editingProductId = null;

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

        // ===== AUTHENTICATION =====
        async function loginAdmin() {
            const email = document.getElementById('adminEmail').value.trim();
            const password = document.getElementById('adminPassword').value.trim();
            
            if (!email || !password) {
                document.getElementById('loginError').textContent = 'Email dan password harus diisi';
                document.getElementById('loginError').classList.add('show');
                return;
            }
            
            showLoading('Memverifikasi login...');
            
            try {
                // Login dengan Supabase Auth
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) throw error;
                
                // Cek role admin di tabel profiles
                const userId = data.user.id;
                const { data: profile, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('role')
                    .eq('id', userId)
                    .single();
                
                if (profileError) throw profileError;
                
                if (!profile || profile.role !== 'admin') {
                    // Jika bukan admin, logout dan alert
                    await supabaseClient.auth.signOut();
                    showNotification('error', 'Akses Ditolak', 'Anda bukan admin!');
                    return;
                }
                
                // Login berhasil
                closeLoginModal();
                openAdminModal();
                updateAdminMenu(true);
                showNotification('success', 'Login Berhasil', 'Selamat datang di panel admin!');
            } catch (error) {
                console.error('Login error:', error);
                document.getElementById('loginError').textContent = 'Email atau password salah';
                document.getElementById('loginError').classList.add('show');
                showNotification('error', 'Login Gagal', error.message);
            } finally {
                hideLoading();
            }
        }

        async function checkAdminLogin() {
            try {
                const { data: { session } } = await supabaseClient.auth.getSession();
                
                if (session) {
                    const userId = session.user.id;
                    const { data: profile } = await supabaseClient
                        .from('profiles')
                        .select('role')
                        .eq('id', userId)
                        .single();
                    
                    if (profile && profile.role === 'admin') {
                        updateAdminMenu(true);
                        return true;
                    } else {
                        logoutAdmin();
                        return false;
                    }
                }
                return false;
            } catch (error) {
                console.error('Check login error:', error);
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
                showNotification('error', 'Logout Gagal', error.message);
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
            document.getElementById('adminEmail').value = 'berkatdyy@gmail.com';
            document.getElementById('adminPassword').value = '';
            document.getElementById('loginError').classList.remove('show');
        }

        async function openAdminModal() {
            const isLoggedIn = await checkAdminLogin();
            
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

        // ===== DATABASE OPERATIONS =====
        async function loadProducts() {
            showLoading('Memuat data produk...');
            
            try {
                // Load products dari Supabase
                const { data: products, error } = await supabaseClient
                    .from('products')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (error) throw error;
                
                allProducts = products || [];
                filteredProducts = [...allProducts];
                
                // Extract unique categories dari products
                const uniqueCategories = [...new Set(allProducts.map(p => p.category))].filter(c => c);
                allCategories = [...new Set([...allCategories, ...uniqueCategories])];
                
                renderProducts();
                renderAdminProductList();
                updateCategoryLists();
                
                showNotification('success', 'Berhasil', `${allProducts.length} produk berhasil dimuat`);
            } catch (error) {
                console.error('Error loading products:', error);
                showNotification('error', 'Error', 'Gagal memuat data produk: ' + error.message);
                allProducts = [];
                filteredProducts = [];
            } finally {
                hideLoading();
            }
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
            const imageUrl = document.getElementById('productImageUrl').value;
            
            // Validasi
            if (!name || !category || !price || !desc || !stock || !imageUrl) {
                showNotification('error', 'Validasi Gagal', 'Harap isi semua field yang wajib diisi');
                return;
            }
            
            const badgeText = badge === 'bestseller' ? '🏆 BEST SELLER' : 
                             badge === 'new' ? '✨ PILIHAN HEMAT' :
                             badge === 'promo' ? '🔥 ECERAN' : '';
            
            showLoading('Menyimpan produk...');
            
            try {
                const productData = {
                    name,
                    category,
                    price,
                    desc,
                    stock,
                    rating: rating || 4.5,
                    badge,
                    badge_text: badgeText,
                    image: imageUrl,
                    wa: encodeURIComponent(name)
                };
                
                if (id) {
                    // Update existing product
                    const { error } = await supabaseClient
                        .from('products')
                        .update(productData)
                        .eq('id', id);
                    
                    if (error) throw error;
                    
                    showNotification('success', 'Berhasil', 'Produk berhasil diupdate!');
                } else {
                    // Add new product
                    const { error } = await supabaseClient
                        .from('products')
                        .insert([productData]);
                    
                    if (error) throw error;
                    
                    showNotification('success', 'Berhasil', 'Produk berhasil ditambahkan!');
                }
                
                await loadProducts();
                resetForm();
            } catch (error) {
                console.error('Error saving product:', error);
                showNotification('error', 'Error', 'Gagal menyimpan produk: ' + error.message);
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
                showNotification('error', 'Error', 'Gagal menghapus produk: ' + error.message);
            } finally {
                hideLoading();
            }
        }

        // ===== IMAGE UPLOAD =====
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
                
                // Generate unique filename
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                
                // Upload ke Supabase Storage bucket 'product-images'
                const { data, error } = await supabaseClient.storage
                    .from('product-images')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (error) throw error;
                
                // Dapatkan public URL
                const { data: { publicUrl } } = supabaseClient.storage
                    .from('product-images')
                    .getPublicUrl(fileName);
                
                document.getElementById('productImageUrl').value = publicUrl;
                
                // Tampilkan preview
                const preview = document.getElementById('imagePreview');
                preview.src = publicUrl;
                preview.classList.add('show');
                
                showNotification('success', 'Berhasil', 'Gambar berhasil diupload');
            } catch (error) {
                console.error('Error uploading image:', error);
                showNotification('error', 'Error', 'Gagal mengupload gambar: ' + error.message);
            } finally {
                hideLoading();
            }
        });

        // ===== CATEGORY MANAGEMENT =====
        function addNewCategory() {
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
            
            allCategories.push(categoryName);
            updateCategoryLists();
            input.value = '';
            showNotification('success', 'Berhasil', `Kategori "${categoryName}" berhasil ditambahkan!`);
        }

        function deleteCategory(categoryName) {
            if (!confirm(`Yakin ingin menghapus kategori "${categoryName}"?`)) {
                return;
            }
            
            allCategories = allCategories.filter(cat => cat !== categoryName);
            updateCategoryLists();
            showNotification('success', 'Berhasil', `Kategori "${categoryName}" berhasil dihapus!`);
        }

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

        // ===== PRODUCT RENDERING =====
        function generateProductCard(product) {
            const stars = '★'.repeat(Math.floor(product.rating || 4.5));
            const badgeHTML = product.badge ? `<div class="product-badge badge-${product.badge}">${product.badge_text || ''}</div>` : '';
            
            return `
                <div class="product-card animate-on-scroll visible" data-category="${product.category}">
                    ${badgeHTML}
                    <div class="product-image">
                        <img src="${product.image || 'https://via.placeholder.com/400x400/0071e3/ffffff?text=Produk'}" alt="${product.name}" loading="lazy">
                    </div>
                    <div class="product-info">
                        <div class="product-category">${product.category ? product.category.charAt(0).toUpperCase() + product.category.slice(1) : 'Produk'}</div>
                        <h3 class="product-name">${product.name}</h3>
                        <p class="product-desc">${product.desc}</p>
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
                    (product.desc && product.desc.toLowerCase().includes(searchTerm)) ||
                    (product.category && product.category.toLowerCase().includes(searchTerm))
                );
                
                searchResultsInfo.textContent = `Menampilkan ${productsToShow.length} hasil untuk "${currentSearch}"`;
            } else {
                searchResultsInfo.textContent = '';
            }
            
            const start = 0;
            const end = currentPage * PRODUCTS_PER_PAGE;
            const productsToDisplay = productsToShow.slice(start, end);
            
            if (!append) {
                productGrid.innerHTML = '';
                
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
            
            if (end >= productsToShow.length) {
                loadMoreBtn.style.display = 'none';
            } else {
                loadMoreBtn.style.display = 'inline-flex';
            }
        }

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
                    <img src="${product.image || 'https://via.placeholder.com/60x60/0071e3/ffffff?text=Img'}" class="admin-product-image" alt="${product.name}">
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
            document.getElementById('productImageUrl').value = product.image;
            
            // Set image preview
            const preview = document.getElementById('imagePreview');
            if (product.image) {
                preview.src = product.image;
                preview.classList.add('show');
            } else {
                preview.src = '';
                preview.classList.remove('show');
            }
            
            // Update form title
            document.getElementById('formTitle').textContent = 'Edit Produk';
            document.getElementById('saveProductBtn').textContent = 'Update Produk';
            document.getElementById('deleteProductBtn').style.display = 'block';
            
            document.querySelector('.modal-content').scrollTop = 0;
        }

        function confirmDeleteProduct(id) {
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
            document.getElementById('productRating').value = '4.5';
            document.getElementById('productBadge').value = '';
            document.getElementById('productImageUrl').value = '';
            
            const preview = document.getElementById('imagePreview');
            preview.src = '';
            preview.classList.remove('show');
            
            document.getElementById('productImageInput').value = '';
            
            document.getElementById('formTitle').textContent = 'Tambah Produk Baru';
            document.getElementById('saveProductBtn').textContent = 'Simpan Produk';
            document.getElementById('deleteProductBtn').style.display = 'none';
        }

        // ===== SEARCH AND FILTER =====
        function setupSearch() {
            const searchInput = document.getElementById('searchInput');
            let searchTimeout;
            
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                
                searchTimeout = setTimeout(() => {
                    currentSearch = e.target.value.trim();
                    currentPage = 1;
                    renderProducts(false);
                    
                    if (currentSearch) {
                        document.querySelectorAll('.filter-tab').forEach(tab => {
                            tab.classList.remove('active');
                        });
                        document.querySelector('.filter-tab[data-filter="all"]').classList.add('active');
                    }
                }, 300);
            });
            
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    currentSearch = '';
                    renderProducts(false);
                    document.getElementById('searchResultsInfo').textContent = '';
                }
            });
        }

        function filterProducts(filter) {
            currentFilter = filter;
            currentPage = 1;
            
            if (filter === 'all') {
                filteredProducts = [...allProducts];
            } else {
                filteredProducts = allProducts.filter(p => p.category === filter);
            }
            
            document.getElementById('searchInput').value = '';
            currentSearch = '';
            document.getElementById('searchResultsInfo').textContent = '';
            
            renderProducts(false);
        }

        // ===== EVENT LISTENERS =====
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

        const filterTabs = document.querySelectorAll('.filter-tab');
        filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                filterTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const filterValue = tab.getAttribute('data-filter');
                filterProducts(filterValue);
            });
        });

        // ===== DROPDOWN HANDLING =====
        const dropdowns = document.querySelectorAll('.dropdown');
        const dropdownOverlay = document.getElementById('dropdownOverlay');
        let activeDropdown = null;

        function closeAllDropdowns() {
            dropdowns.forEach(dropdown => {
                dropdown.classList.remove('active');
            });
            dropdownOverlay.classList.remove('active');
            activeDropdown = null;
            
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
                        if (activeDropdown === dropdown) {
                            closeAllDropdowns();
                        } else {
                            closeAllDropdowns();
                            dropdown.classList.add('active');
                            activeDropdown = dropdown;
                        }
                    }
                });
                
                const links = content.querySelectorAll('a');
                links.forEach(link => {
                    link.addEventListener('click', () => {
                        closeAllDropdowns();
                    });
                });
            }
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.dropdown')) {
                closeAllDropdowns();
            }
        });

        dropdownOverlay.addEventListener('click', closeAllDropdowns);

        // ===== NAVIGATION =====
        const navbar = document.getElementById('navbar');
        window.addEventListener('scroll', () => {
            if (window.pageYOffset > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        closeAllDropdowns();
                        
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

        // ===== ADMIN MENU CLICK =====
        document.getElementById('navAdmin').addEventListener('click', function(e) {
            e.preventDefault();
            openAdminModal();
        });

        // ===== INITIALIZATION =====
        window.addEventListener('DOMContentLoaded', async () => {
            const productGrid = document.getElementById('productGrid');
            productGrid.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary)">Memuat data...</div>';
            
            await checkAdminLogin();
            await loadProducts();
            
            filterProducts('all');
            setupSearch();
            
            // Auto login check
            setInterval(checkAdminLogin, 30000);
            
            // Supabase auth state change
            supabaseClient.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    logoutAdmin();
                } else if (event === 'SIGNED_IN') {
                    checkAdminLogin();
                }
            });
        });
