// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co';
// Gunakan Anon Public Key (JWT format)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYWdpc2lid2prZ3BkZnh5aHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDg3NzYsImV4cCI6MjA4NjAyNDc3Nn0.bAFsKmyOh3XME-Fdop3VKRltc8gThZydaeIdOiSiztI';
const STORAGE_BASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co/storage/v1/object/public/product-images/';

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
let currentProductImage = ''; // Tambah state untuk melacak image saat edit

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
    try {
        console.log('🔍 Loading products from Supabase...');
        console.log('URL:', SUPABASE_URL);
        console.log('Key format:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
        
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Supabase error:', error);
            console.error('Error details:', {
                message: error.message,
                hint: error.hint,
                code: error.code,
                details: error.details
            });
            throw error;
        }
        
        console.log('✅ Products loaded:', data?.length || 0);
        
        // Debug: Log sample image paths
        if (data && data.length > 0) {
            console.log('Sample product image:', data[0].image);
            console.log('Full image URL would be:', STORAGE_BASE_URL + data[0].image);
        }
        
        allProducts = data || [];
        
        const categories = new Set(allProducts.map(p => p.category));
        allCategories = ['mie', 'rokok', 'sembako', 'minuman', 'snack', 'lainnya'];
        categories.forEach(cat => {
            if (!allCategories.includes(cat)) {
                allCategories.push(cat);
            }
        });
        
        updateCategoryLists();
    } catch (error) {
        console.error('Load products error:', error);
        showNotification('error', 'Gagal Memuat Produk', error.message || 'Periksa koneksi internet dan API key Supabase');
    }
}

async function saveProduct() {
    clearValidationErrors();
    
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value.trim();
    const price = document.getElementById('productPrice').value.trim();
    const description = document.getElementById('productDesc').value.trim();
    const stock = document.getElementById('productStock').value.trim();
    const rating = parseFloat(document.getElementById('productRating').value) || 4.5;
    const badge = document.getElementById('productBadge').value;
    const imageInput = document.getElementById('productImageInput');
    const imageUrl = document.getElementById('productImageUrl').value;
    const productId = document.getElementById('productId').value;
    
    let isValid = true;
    
    if (!name) {
        showValidationError('nameError', 'Nama produk harus diisi');
        isValid = false;
    }
    
    if (!category) {
        showValidationError('categoryError', 'Kategori harus diisi');
        isValid = false;
    }
    
    if (!price) {
        showValidationError('priceError', 'Harga harus diisi');
        isValid = false;
    }
    
    if (!description) {
        showValidationError('descError', 'Deskripsi harus diisi');
        isValid = false;
    }
    
    if (!stock) {
        showValidationError('stockError', 'Status stok harus diisi');
        isValid = false;
    }
    
    // Validasi gambar: jika mode tambah produk baru, wajib ada gambar
    if (!productId && !imageUrl && !imageInput.files.length) {
        showValidationError('imageError', 'Gambar produk harus diupload');
        isValid = false;
    }
    
    if (!isValid) {
        showNotification('warning', 'Validasi Gagal', 'Mohon lengkapi semua field yang wajib diisi');
        return;
    }
    
    showLoading(productId ? 'Mengupdate produk...' : 'Menyimpan produk...');
    
    try {
        let finalImageName = currentProductImage; // Default ke image yang sudah ada
        
        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const fileExt = file.name.split('.').pop();
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2, 15);
            const fileName = `${timestamp}_${random}.${fileExt}`;
            
            const { error: uploadError } = await supabaseClient.storage
                .from('product-images')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });
            
            if (uploadError) throw uploadError;
            
            finalImageName = fileName;
        } else if (imageUrl) {
            // Jika ada URL gambar manual, simpan hanya nama filenya
            if (imageUrl.startsWith(STORAGE_BASE_URL)) {
                finalImageName = imageUrl.replace(STORAGE_BASE_URL, '');
            } else if (imageUrl.includes('/')) {
                finalImageName = imageUrl.split('/').pop();
            } else {
                finalImageName = imageUrl;
            }
        }
        
        // Pastikan kita punya image untuk produk baru
        if (!productId && !finalImageName) {
            throw new Error('Gambar produk diperlukan untuk produk baru');
        }
        
        const productData = {
            name,
            category,
            price,
            desc: description,
            stock: stock,
            rating,
            badge: badge || null,
            image: finalImageName
        };
        
        if (productId) {
            // UPDATE produk yang sudah ada
            const { error } = await supabaseClient
                .from('products')
                .update(productData)
                .eq('id', productId);
            
            if (error) throw error;
            
            showNotification('success', 'Produk Berhasil Diupdate', `${name} telah diperbarui.`);
        } else {
            // INSERT produk baru
            const { error } = await supabaseClient
                .from('products')
                .insert([productData]);
            
            if (error) throw error;
            
            showNotification('success', 'Produk Berhasil Disimpan', `${name} telah ditambahkan ke katalog.`);
        }
        
        await loadProducts();
        renderAdminProductList();
        renderProducts(false);
        resetForm();
        
    } catch (error) {
        console.error('Save product error:', error);
        showNotification('error', 'Gagal Menyimpan Produk', error.message);
    } finally {
        hideLoading();
    }
}

async function deleteProduct() {
    const productId = editingProductId || document.getElementById('productId').value;
    
    if (!productId) {
        showNotification('warning', 'Tidak Ada Produk', 'Tidak ada produk yang dipilih untuk dihapus');
        return;
    }
    
    const productName = document.getElementById('productName').value || 'produk ini';
    
    if (!confirm(`Apakah Anda yakin ingin menghapus produk "${productName}"?`)) {
        return;
    }
    
    showLoading('Menghapus produk...');
    
    try {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', productId);
        
        if (error) throw error;
        
        showNotification('success', 'Produk Berhasil Dihapus', `${productName} telah dihapus dari katalog.`);
        
        await loadProducts();
        renderAdminProductList();
        renderProducts(false);
        resetForm();
        
    } catch (error) {
        console.error('Delete product error:', error);
        showNotification('error', 'Gagal Menghapus Produk', error.message);
    } finally {
        hideLoading();
    }
}

function editProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    editingProductId = productId;
    currentProductImage = product.image; // Simpan image produk yang sedang diedit
    
    document.getElementById('formTitle').textContent = 'Edit Produk';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productDesc').value = product.desc;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productRating').value = product.rating;
    document.getElementById('productBadge').value = product.badge || '';
    
    // Untuk image URL: simpan hanya nama file
    let imageDisplayName = product.image;
    if (product.image && product.image.startsWith('http')) {
        // Jika sudah full URL, ambil hanya nama filenya
        imageDisplayName = product.image.split('/').pop();
    }
    document.getElementById('productImageUrl').value = imageDisplayName;
    
    const preview = document.getElementById('imagePreview');
    // Smart image URL untuk preview
    if (product.image) {
        if (product.image.startsWith('http')) {
            preview.src = product.image;
        } else {
            preview.src = STORAGE_BASE_URL + product.image;
        }
        preview.style.display = 'block';
    } else {
        preview.style.display = 'none';
    }
    
    document.getElementById('deleteProductBtn').style.display = 'inline-block';
    document.getElementById('saveProductBtn').textContent = 'Update Produk';
    
    document.getElementById('productName').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetForm() {
    editingProductId = null;
    currentProductImage = '';
    
    document.getElementById('formTitle').textContent = 'Tambah Produk Baru';
    document.getElementById('productId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productDesc').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productRating').value = '4.5';
    document.getElementById('productBadge').value = '';
    document.getElementById('productImageUrl').value = '';
    document.getElementById('productImageInput').value = '';
    
    const preview = document.getElementById('imagePreview');
    preview.style.display = 'none';
    preview.src = '';
    
    document.getElementById('deleteProductBtn').style.display = 'none';
    document.getElementById('saveProductBtn').textContent = 'Simpan Produk';
    
    clearValidationErrors();
}

function showValidationError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

function clearValidationErrors() {
    const errorElements = document.querySelectorAll('.validation-error');
    errorElements.forEach(el => {
        el.textContent = '';
        el.classList.remove('show');
    });
}

// ===== CATEGORY MANAGEMENT =====
function updateCategoryLists() {
    const categoryOptions = document.getElementById('categoryOptions');
    categoryOptions.innerHTML = allCategories.map(cat => `<option value="${cat}">`).join('');
    
    renderCategoryList();
}

function renderCategoryList() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = allCategories.map(cat => `
        <div class="category-item">
            <span>${cat}</span>
            <button class="btn-small btn-danger" onclick="deleteCategory('${cat}')">Hapus</button>
        </div>
    `).join('');
}

function addNewCategory() {
    const input = document.getElementById('newCategoryInput');
    const newCategory = input.value.trim().toLowerCase();
    
    if (!newCategory) {
        showNotification('warning', 'Kategori Kosong', 'Silakan masukkan nama kategori');
        return;
    }
    
    if (allCategories.includes(newCategory)) {
        showNotification('warning', 'Kategori Sudah Ada', `Kategori "${newCategory}" sudah terdaftar`);
        return;
    }
    
    allCategories.push(newCategory);
    updateCategoryLists();
    input.value = '';
    showNotification('success', 'Kategori Ditambahkan', `Kategori "${newCategory}" berhasil ditambahkan`);
}

function deleteCategory(category) {
    const hasProducts = allProducts.some(p => p.category === category);
    
    if (hasProducts) {
        showNotification('error', 'Kategori Tidak Bisa Dihapus', `Masih ada produk dengan kategori "${category}"`);
        return;
    }
    
    if (['mie', 'rokok', 'sembako', 'minuman', 'snack', 'lainnya'].includes(category)) {
        showNotification('error', 'Kategori Tidak Bisa Dihapus', 'Kategori default tidak bisa dihapus');
        return;
    }
    
    allCategories = allCategories.filter(c => c !== category);
    updateCategoryLists();
    showNotification('success', 'Kategori Dihapus', `Kategori "${category}" telah dihapus`);
}

// ===== IMAGE PREVIEW =====
document.getElementById('productImageInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            showNotification('error', 'File Terlalu Besar', 'Ukuran maksimal adalah 5MB');
            e.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('imagePreview');
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

// ===== RENDER PRODUCTS =====
function renderProducts(append = false) {
    const productGrid = document.getElementById('productGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (!append) {
        productGrid.innerHTML = '';
        currentPage = 1;
    }
    
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);
    
    if (productsToShow.length === 0 && !append) {
        productGrid.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary)">Tidak ada produk yang ditemukan.</div>';
        loadMoreBtn.style.display = 'none';
        return;
    }
    
    productsToShow.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card animate-on-scroll';
        
        // Smart image URL: SELALU bangun dari nama file
        let imageUrl;
        if (product.image) {
            if (product.image.startsWith('http')) {
                // Jika sudah full URL, gunakan langsung
                imageUrl = product.image;
            } else {
                // Jika hanya nama file, tambahkan base URL
                imageUrl = STORAGE_BASE_URL + product.image;
            }
        } else {
            // Tidak ada image
            imageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EGambar tidak tersedia%3C/text%3E%3C/svg%3E';
        }
        
        productCard.innerHTML = `
            ${product.badge ? `<div class="badge badge-${product.badge}">${product.badge === 'bestseller' ? 'Bestseller' : product.badge === 'new' ? 'Baru' : 'Promo'}</div>` : ''}
            <img src="${imageUrl}" alt="${product.name}" loading="lazy" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22%3EGambar tidak tersedia%3C/text%3E%3C/svg%3E';">
            <div class="product-content">
                <div class="product-category">${product.category}</div>
                <h3 class="product-title">${product.name}</h3>
                <p class="product-description">${product.desc}</p>
                <div class="product-meta">
                    <span class="product-price">${product.price}</span>
                    <span class="product-stock">${product.stock}</span>
                </div>
                <div class="product-rating">
                    ${'★'.repeat(Math.floor(product.rating))}${'☆'.repeat(5 - Math.floor(product.rating))}
                    <span>${product.rating}</span>
                </div>
            </div>
        `;
        productGrid.appendChild(productCard);
        
        setTimeout(() => {
            productCard.classList.add('visible');
        }, 50);
    });
    
    if (endIndex >= filteredProducts.length) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'block';
    }
}

function renderAdminProductList() {
    const adminList = document.getElementById('productListAdmin');
    
    if (allProducts.length === 0) {
        adminList.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary)">Belum ada produk. Tambahkan produk baru di bawah.</div>';
        return;
    }
    
    adminList.innerHTML = allProducts.map(product => {
        // Smart image URL: SELALU bangun dari nama file
        let imageUrl;
        if (product.image) {
            if (product.image.startsWith('http')) {
                imageUrl = product.image;
            } else {
                imageUrl = STORAGE_BASE_URL + product.image;
            }
        } else {
            imageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E';
        }
        
        return `
        <div class="admin-product-item">
            <img src="${imageUrl}" alt="${product.name}" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E';">
            <div class="admin-product-info">
                <h4>${product.name}</h4>
                <div style="font-size: 0.875rem; color: var(--text-secondary);">${product.category} • ${product.price}</div>
            </div>
            <button class="btn-small btn-primary" onclick="editProduct('${product.id}')">Edit</button>
        </div>
    `;
    }).join('');
}

// ===== SEARCH FUNCTIONALITY =====
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearBtn = document.getElementById('clearSearchBtn');
    const searchResults = document.getElementById('searchResultsInfo');
    
    function performSearch() {
        const query = searchInput.value.trim().toLowerCase();
        
        if (!query) {
            filterProducts(currentFilter);
            clearBtn.style.display = 'none';
            searchResults.textContent = '';
            return;
        }
        
        currentSearch = query;
        
        if (currentFilter === 'all') {
            filteredProducts = allProducts.filter(p => 
                p.name.toLowerCase().includes(query) ||
                p.desc.toLowerCase().includes(query) ||
                p.category.toLowerCase().includes(query)
            );
        } else {
            filteredProducts = allProducts.filter(p => 
                p.category === currentFilter &&
                (p.name.toLowerCase().includes(query) ||
                 p.desc.toLowerCase().includes(query) ||
                 p.category.toLowerCase().includes(query))
            );
        }
        
        renderProducts(false);
        clearBtn.style.display = 'flex';
        searchResults.textContent = `Menampilkan ${filteredProducts.length} hasil untuk "${query}"`;
    }
    
    searchBtn.addEventListener('click', performSearch);
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearch = '';
        filterProducts(currentFilter);
        clearBtn.style.display = 'none';
        searchResults.textContent = '';
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
