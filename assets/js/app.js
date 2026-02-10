
// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYWdpc2lid2prZ3BkZnh5aHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzg2NjI3MDEsImV4cCI6MjA1NDIzODcwMX0.yG9_7cBmGD8g2-9CACRrAXVS8v62I6Qw5rlRvTlRWbg';

// Inisialisasi Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false
    }
});

// ===== CONSTANTS =====
const STORAGE_BUCKET = 'product-images';
const ADMIN_EMAIL = 'berkatdyy@gmail.com';

// ===== PRODUCT DATABASE (DEFAULT) =====
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
let editingProductId = null;

// ===== DROPDOWN MANAGEMENT =====
let activeDropdown = null;

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
    
    // Deskripsi validation (menggunakan description, bukan desc)
    if (!data.description || data.description.trim().length < 10) {
        errors.description = 'Deskripsi harus minimal 10 karakter';
    }
    
    // Stok validation
    if (!data.stock || data.stock.trim().length < 2) {
        errors.stock = 'Status stok harus diisi';
    }
    
    // Rating validation
    if (data.rating < 1 || data.rating > 5) {
        errors.rating = 'Rating harus antara 1-5';
    }
    
    // Image validation
    if (!data.image) {
        errors.image = 'Gambar produk harus diisi';
    }
    
    return errors;
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
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value.trim();
    
    // Validasi input
    if (!email || !password) {
        document.getElementById('loginError').textContent = 'Email dan password harus diisi';
        document.getElementById('loginError').classList.add('show');
        return;
    }
    
    showLoading('Memverifikasi login...');
    
    try {
        // 1. Login menggunakan Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (authError) {
            hideLoading();
            document.getElementById('loginError').textContent = 'Email atau password salah';
            document.getElementById('loginError').classList.add('show');
            console.error('Auth error:', authError);
            return;
        }
        
        // 2. Jika email adalah admin utama, langsung berikan akses
        if (email === ADMIN_EMAIL) {
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('adminEmail', email);
            hideLoading();
            closeLoginModal();
            showNotification('success', 'Login Berhasil', 'Selamat datang, Admin!');
            updateAdminUI();
            return;
        }
        
        // 3. Untuk email lain, cek role di table profiles
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', authData.user.id)
            .single();
        
        if (profileError || !profile) {
            // Logout jika profile tidak ditemukan
            await supabaseClient.auth.signOut();
            hideLoading();
            document.getElementById('loginError').textContent = 'Akses ditolak. Profile tidak ditemukan.';
            document.getElementById('loginError').classList.add('show');
            return;
        }
        
        // 4. Verifikasi role admin
        if (profile.role !== 'admin') {
            // Logout jika bukan admin
            await supabaseClient.auth.signOut();
            hideLoading();
            document.getElementById('loginError').textContent = 'Akses ditolak. Anda bukan admin.';
            document.getElementById('loginError').classList.add('show');
            return;
        }
        
        // 5. Login berhasil sebagai admin
        localStorage.setItem('adminLoggedIn', 'true');
        localStorage.setItem('adminEmail', email);
        hideLoading();
        closeLoginModal();
        showNotification('success', 'Login Berhasil', 'Selamat datang, Admin!');
        updateAdminUI();
        
    } catch (error) {
        hideLoading();
        console.error('Login error:', error);
        document.getElementById('loginError').textContent = 'Terjadi kesalahan saat login';
        document.getElementById('loginError').classList.add('show');
    }
}

async function logoutAdmin() {
    try {
        await supabaseClient.auth.signOut();
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminEmail');
        closeAdminModal();
        showNotification('info', 'Logout Berhasil', 'Anda telah keluar dari sistem admin');
        updateAdminUI();
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('error', 'Logout Gagal', 'Terjadi kesalahan saat logout');
    }
}

async function checkAdminLogin() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session && session.user) {
        // Cek apakah email adalah admin utama
        if (session.user.email === ADMIN_EMAIL) {
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('adminEmail', session.user.email);
            updateAdminUI();
            return true;
        }
        
        // Cek role di profiles untuk email lain
        const { data: profile } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
        
        if (profile && profile.role === 'admin') {
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('adminEmail', session.user.email);
            updateAdminUI();
            return true;
        } else {
            // Bukan admin, logout
            await supabaseClient.auth.signOut();
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminEmail');
            updateAdminUI();
            return false;
        }
    } else {
        localStorage.removeItem('adminLoggedIn');
        localStorage.removeItem('adminEmail');
        updateAdminUI();
        return false;
    }
}

function updateAdminUI() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    const adminMenu = document.getElementById('navAdmin');
    
    if (isLoggedIn) {
        adminMenu.textContent = '👤 Admin Panel';
        adminMenu.style.background = 'var(--accent-green)';
    } else {
        adminMenu.textContent = 'Admin';
        adminMenu.style.background = '';
    }
}

// ===== MODAL FUNCTIONS =====
function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminPassword').value = '';
    document.getElementById('loginError').classList.remove('show');
    document.getElementById('emailError').classList.remove('show');
    document.getElementById('passwordError').classList.remove('show');
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
}

async function openAdminModal() {
    const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
    
    if (!isLoggedIn) {
        openLoginModal();
        return;
    }
    
    document.getElementById('adminModal').classList.add('active');
    await loadProductsForAdmin();
    await loadCategories();
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
    resetForm();
}

// ===== IMAGE HANDLING =====
function fixImageUrl(imageUrl) {
    if (!imageUrl) return 'https://via.placeholder.com/400x400/0071e3/ffffff?text=No+Image';
    
    // Jika sudah full URL, return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }
    
    // Jika hanya filename, build URL dari Supabase storage
    return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${imageUrl}`;
}

async function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validasi ukuran file (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('error', 'File Terlalu Besar', 'Ukuran file maksimal 5MB');
        event.target.value = '';
        return;
    }
    
    // Validasi tipe file
    if (!file.type.startsWith('image/')) {
        showNotification('error', 'Format Tidak Valid', 'Hanya file gambar yang diperbolehkan');
        event.target.value = '';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('imagePreview');
        preview.src = e.target.result;
        preview.classList.add('show');
        document.getElementById('productImageData').value = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function uploadImageToSupabase(file) {
    try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop();
        const filename = `${timestamp}-${randomStr}.${ext}`;
        
        // Upload ke Supabase Storage
        const { data, error } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(filename, file);
        
        if (error) {
            console.error('Upload error:', error);
            throw error;
        }
        
        // Return filename saja (bukan full URL)
        return filename;
        
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

async function deleteImageFromSupabase(filename) {
    try {
        // Jika filename adalah full URL, extract filename
        if (filename.includes('/')) {
            filename = filename.split('/').pop();
        }
        
        const { error } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .remove([filename]);
        
        if (error) {
            console.error('Delete error:', error);
        }
    } catch (error) {
        console.error('Error deleting image:', error);
    }
}

// ===== PRODUCT CRUD FUNCTIONS =====
async function loadProducts() {
    try {
        showLoading('Memuat produk...');
        
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allProducts = products || [];
        
        // Load kategori unik dari produk
        const categories = [...new Set(allProducts.map(p => p.category))];
        allCategories = [...new Set([...defaultCategories, ...categories])];
        
        updateCategoryLists();
        hideLoading();
        
    } catch (error) {
        console.error('Error loading products:', error);
        hideLoading();
        showNotification('error', 'Gagal Memuat Produk', error.message);
    }
}

async function loadCategories() {
    // Kategori sudah di-load dari products
    // Function ini untuk backward compatibility
    renderCategoryTags();
}

async function saveProduct() {
    try {
        const name = document.getElementById('productName').value.trim();
        const category = document.getElementById('productCategory').value.trim();
        const price = document.getElementById('productPrice').value.trim();
        const description = document.getElementById('productDescription').value.trim(); // Gunakan description
        const stock = document.getElementById('productStock').value.trim();
        const rating = parseFloat(document.getElementById('productRating').value) || 4.5;
        const badge = document.getElementById('productBadge').value;
        const productId = document.getElementById('productId').value;
        
        // Validasi data
        const validationData = {
            name,
            category,
            price,
            description, // Gunakan description
            stock,
            rating,
            image: document.getElementById('productImageData').value
        };
        
        const errors = validateProductData(validationData);
        if (!showValidationErrors(errors)) {
            showNotification('warning', 'Data Tidak Valid', 'Periksa kembali form Anda');
            return;
        }
        
        showLoading('Menyimpan produk...');
        
        let imagePath = '';
        const fileInput = document.getElementById('productImageInput');
        
        // Handle image upload
        if (fileInput.files && fileInput.files[0]) {
            // Upload gambar baru
            imagePath = await uploadImageToSupabase(fileInput.files[0]);
            
            // Jika edit, hapus gambar lama
            if (productId) {
                const oldProduct = allProducts.find(p => p.id === productId);
                if (oldProduct && oldProduct.image) {
                    await deleteImageFromSupabase(oldProduct.image);
                }
            }
        } else if (productId) {
            // Jika edit dan tidak upload gambar baru, gunakan gambar lama
            const oldProduct = allProducts.find(p => p.id === productId);
            imagePath = oldProduct ? oldProduct.image : '';
        }
        
        if (!imagePath) {
            hideLoading();
            showNotification('error', 'Gambar Diperlukan', 'Silakan upload gambar produk');
            return;
        }
        
        // Persiapkan data produk (gunakan description, BUKAN desc)
        const productData = {
            name,
            category,
            price,
            description, // Gunakan description
            stock,
            rating,
            image: imagePath, // Simpan filename saja
            badge: badge || null,
            badge_text: badge ? (badge === 'bestseller' ? 'Bestseller' : badge === 'new' ? 'Baru' : 'Promo') : null,
            updated_at: new Date().toISOString()
        };
        
        let result;
        if (productId) {
            // Update produk
            const { data, error } = await supabaseClient
                .from('products')
                .update(productData)
                .eq('id', productId)
                .select();
            
            if (error) throw error;
            result = data;
            showNotification('success', 'Produk Diupdate', `${name} berhasil diperbarui`);
        } else {
            // Insert produk baru
            productData.created_at = new Date().toISOString();
            
            const { data, error } = await supabaseClient
                .from('products')
                .insert([productData])
                .select();
            
            if (error) throw error;
            result = data;
            showNotification('success', 'Produk Ditambahkan', `${name} berhasil ditambahkan`);
        }
        
        // Reload produk dan reset form
        await loadProducts();
        await loadProductsForAdmin();
        resetForm();
        filterProducts(currentFilter);
        hideLoading();
        
    } catch (error) {
        console.error('Error saving product:', error);
        hideLoading();
        showNotification('error', 'Gagal Menyimpan', error.message);
    }
}

async function deleteProduct(id) {
    // Jika dipanggil dari tombol delete di form
    if (!id) {
        id = document.getElementById('productId').value;
    }
    
    if (!id) return;
    
    if (!confirm('Yakin ingin menghapus produk ini? Tindakan ini tidak bisa dibatalkan.')) {
        return;
    }
    
    try {
        showLoading('Menghapus produk...');
        
        // Ambil data produk untuk mendapatkan image filename
        const product = allProducts.find(p => p.id === id);
        
        // Hapus dari database
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        // Hapus gambar dari storage
        if (product && product.image) {
            await deleteImageFromSupabase(product.image);
        }
        
        showNotification('success', 'Produk Dihapus', 'Produk berhasil dihapus');
        
        // Reload produk dan reset form
        await loadProducts();
        await loadProductsForAdmin();
        resetForm();
        filterProducts(currentFilter);
        hideLoading();
        
    } catch (error) {
        console.error('Error deleting product:', error);
        hideLoading();
        showNotification('error', 'Gagal Menghapus', error.message);
    }
}

// ===== CATEGORY MANAGEMENT =====
async function addNewCategory() {
    const input = document.getElementById('newCategoryInput');
    const newCategory = input.value.trim().toLowerCase();
    
    if (!newCategory) {
        showNotification('warning', 'Kategori Kosong', 'Masukkan nama kategori');
        return;
    }
    
    if (allCategories.includes(newCategory)) {
        showNotification('warning', 'Kategori Sudah Ada', 'Kategori ini sudah terdaftar');
        return;
    }
    
    allCategories.push(newCategory);
    updateCategoryLists();
    input.value = '';
    showNotification('success', 'Kategori Ditambahkan', `Kategori "${newCategory}" berhasil ditambahkan`);
}

function deleteCategory(category) {
    // Cek apakah ada produk dengan kategori ini
    const productsWithCategory = allProducts.filter(p => p.category === category);
    
    if (productsWithCategory.length > 0) {
        showNotification('warning', 'Tidak Bisa Dihapus', `Masih ada ${productsWithCategory.length} produk dengan kategori ini`);
        return;
    }
    
    if (!confirm(`Yakin ingin menghapus kategori "${category}"?`)) {
        return;
    }
    
    allCategories = allCategories.filter(c => c !== category);
    updateCategoryLists();
    showNotification('success', 'Kategori Dihapus', `Kategori "${category}" berhasil dihapus`);
}

// ===== PRODUCT DISPLAY FUNCTIONS =====
function renderProducts() {
    const productGrid = document.getElementById('productGrid');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    
    if (filteredProducts.length === 0) {
        productGrid.innerHTML = `
            <div class="no-results">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🔍</div>
                <div style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem;">Produk tidak ditemukan</div>
                <div style="color: var(--text-secondary);">Coba kata kunci lain atau pilih kategori berbeda</div>
            </div>
        `;
        loadMoreContainer.style.display = 'none';
        return;
    }
    
    const startIndex = 0;
    const endIndex = currentPage * PRODUCTS_PER_PAGE;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);
    
    productGrid.innerHTML = productsToShow.map(product => {
        const badgeHtml = product.badge ? `
            <div class="product-badge ${product.badge}">
                ${product.badge_text || product.badge}
            </div>
        ` : '';
        
        return `
            <div class="product-card animate-on-scroll">
                ${badgeHtml}
                <div class="product-image">
                    <img src="${fixImageUrl(product.image)}" 
                         alt="${product.name}" 
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/400x400/0071e3/ffffff?text=No+Image'">
                </div>
                <div class="product-info">
                    <div class="product-category">${product.category}</div>
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-rating">
                        ${'⭐'.repeat(Math.round(product.rating || 4.5))}
                        <span class="rating-text">${(product.rating || 4.5).toFixed(1)}</span>
                    </div>
                    <div class="product-price">${product.price}</div>
                    <div class="product-stock ${product.stock.toLowerCase().includes('habis') ? 'out-of-stock' : ''}">
                        <span class="stock-icon">${product.stock.toLowerCase().includes('habis') ? '❌' : '✅'}</span>
                        <span class="stock-text">${product.stock}</span>
                    </div>
                    <a href="https://wa.me/6281253680904?text=Halo%20Berkat%20Yakin,%20saya%20mau%20pesan%20${encodeURIComponent(product.name)}" 
                       class="btn btn-buy" 
                       target="_blank" 
                       rel="noopener">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                        Pesan via WhatsApp
                    </a>
                </div>
            </div>
        `;
    }).join('');
    
    // Show/hide load more button
    if (endIndex < filteredProducts.length) {
        loadMoreContainer.style.display = 'block';
    } else {
        loadMoreContainer.style.display = 'none';
    }
    
    // Update search results info
    updateSearchInfo();
    
    // Trigger scroll animations
    observeElements();
}

function filterProducts(filter) {
    currentFilter = filter;
    currentPage = 1;
    
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.filter === filter) {
            tab.classList.add('active');
        }
    });
    
    // Filter products
    if (filter === 'all') {
        filteredProducts = allProducts;
    } else {
        filteredProducts = allProducts.filter(p => p.category === filter);
    }
    
    // Apply search if active
    if (currentSearch) {
        applySearch();
    } else {
        renderProducts();
    }
}

function loadMore() {
    currentPage++;
    renderProducts();
}

// ===== SEARCH FUNCTIONS =====
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value.trim().toLowerCase();
        currentPage = 1;
        applySearch();
    });
}

function applySearch() {
    if (!currentSearch) {
        filterProducts(currentFilter);
        return;
    }
    
    filteredProducts = allProducts.filter(product => {
        const matchesFilter = currentFilter === 'all' || product.category === currentFilter;
        const matchesSearch = product.name.toLowerCase().includes(currentSearch) ||
                            product.category.toLowerCase().includes(currentSearch) ||
                            (product.description && product.description.toLowerCase().includes(currentSearch));
        
        return matchesFilter && matchesSearch;
    });
    
    renderProducts();
}

function updateSearchInfo() {
    const info = document.getElementById('searchResultsInfo');
    
    if (currentSearch) {
        info.textContent = `Ditemukan ${filteredProducts.length} produk untuk "${currentSearch}"`;
        info.style.display = 'block';
    } else {
        info.style.display = 'none';
    }
}

// ===== ADMIN PRODUCT LIST =====
async function loadProductsForAdmin() {
    const container = document.getElementById('productListAdmin');
    
    if (allProducts.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Belum ada produk</div>';
        return;
    }
    
    container.innerHTML = '';
    
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
                <button class="action-btn delete-btn" onclick="deleteProduct('${product.id}')">Hapus</button>
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
    document.getElementById('productDescription').value = product.description || ''; // Gunakan description
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

function resetForm() {
    editingProductId = null;
    
    document.getElementById('productId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productDescription').value = ''; // Gunakan description
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
    
    // Keep "Semua" tab and add category tabs
    const existingTabs = tabsContainer.querySelectorAll('.filter-tab');
    const existingFilters = Array.from(existingTabs).map(tab => tab.dataset.filter);
    
    // Remove tabs for categories that no longer exist (except 'all')
    existingTabs.forEach(tab => {
        const filter = tab.dataset.filter;
        if (filter !== 'all' && !allCategories.includes(filter)) {
            tab.remove();
        }
    });
    
    // Add new category tabs
    allCategories.forEach(category => {
        if (!existingFilters.includes(category)) {
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

// ===== DROPDOWN NAVIGATION =====
function toggleDropdown(event) {
    event.stopPropagation();
    const dropdown = event.currentTarget.parentElement;
    const overlay = document.getElementById('dropdownOverlay');
    
    if (activeDropdown && activeDropdown !== dropdown) {
        activeDropdown.classList.remove('active');
    }
    
    dropdown.classList.toggle('active');
    
    if (dropdown.classList.contains('active')) {
        activeDropdown = dropdown;
        overlay.classList.add('active');
    } else {
        activeDropdown = null;
        overlay.classList.remove('active');
    }
}

function closeAllDropdowns() {
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        dropdown.classList.remove('active');
    });
    document.getElementById('dropdownOverlay').classList.remove('active');
    activeDropdown = null;
}

// Close dropdown when clicking overlay
document.getElementById('dropdownOverlay').addEventListener('click', closeAllDropdowns);

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.dropdown')) {
        closeAllDropdowns();
    }
});

// ===== SCROLL ANIMATIONS =====
function observeElements() {
    const observer = new IntersectionObserver((entries) => {
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
        observer.observe(el);
    });
}

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
    
    // Auth state listener
    supabaseClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            localStorage.removeItem('adminLoggedIn');
            localStorage.removeItem('adminEmail');
            updateAdminUI();
        } else if (event === 'SIGNED_IN') {
            checkAdminLogin();
        }
    });
    
    // Initialize scroll animations
    observeElements();
});
