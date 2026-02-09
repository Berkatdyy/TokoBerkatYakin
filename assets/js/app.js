// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYWdpc2lid2prZ3BkZnh5aHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDg3NzYsImV4cCI6MjA4NjAyNDc3Nn0.bAFsKmyOh3XME-Fdop3VKRltc8gThZydaeIdOiSiztI';
const STORAGE_BASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co/storage/v1/object/public/product-images/';

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
let currentUser = null;

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
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        const userId = data.user.id;
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
        
        if (profileError || !profile || profile.role !== 'admin') {
            throw new Error('Anda bukan admin');
        }
        
        currentUser = {
            id: userId,
            email: email,
            role: profile.role
        };
        
        hideLoading();
        closeLoginModal();
        openAdminModal();
        showNotification('success', 'Login Berhasil', `Selamat datang, ${email}`);
        
        await loadProducts();
        renderAdminProductList();
    } catch (error) {
        hideLoading();
        console.error('Login error:', error);
        document.getElementById('loginError').textContent = error.message || 'Login gagal. Periksa email dan password Anda.';
        document.getElementById('loginError').classList.add('show');
    }
}

async function checkAdminLogin() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (session?.user) {
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('role')
                .eq('id', session.user.id)
                .single();
            
            if (profile?.role === 'admin') {
                currentUser = {
                    id: session.user.id,
                    email: session.user.email,
                    role: profile.role
                };
                document.getElementById('adminBtn').style.display = 'inline-flex';
                return true;
            }
        }
        
        currentUser = null;
        return false;
    } catch (error) {
        console.error('Check admin login error:', error);
        currentUser = null;
        return false;
    }
}

async function logoutAdmin() {
    const confirm = window.confirm('Apakah Anda yakin ingin logout?');
    if (!confirm) return;
    
    showLoading('Logout...');
    
    try {
        await supabaseClient.auth.signOut();
        currentUser = null;
        hideLoading();
        closeAdminModal();
        resetForm();
        showNotification('success', 'Logout Berhasil', 'Anda telah logout');
        location.reload();
    } catch (error) {
        hideLoading();
        showNotification('error', 'Logout Gagal', error.message);
    }
}

function openLoginModal() {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('loginError').textContent = '';
    document.getElementById('loginError').classList.remove('show');
}

function closeLoginModal() {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('adminPassword').value = '';
    document.getElementById('loginError').textContent = '';
}

function openAdminModal() {
    if (!currentUser) {
        openLoginModal();
        return;
    }
    
    document.getElementById('adminModal').classList.add('active');
    resetForm();
    renderAdminProductList();
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
    resetForm();
}

// ===== DATABASE OPERATIONS =====
async function loadProducts() {
    try {
        console.log('🔍 Loading products from Supabase...');
        
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Supabase error:', error);
            throw error;
        }
        
        console.log('✅ Products loaded:', data?.length || 0);
        
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
    
    if (!imageUrl && !imageInput.files.length && !productId) {
        showValidationError('imageError', 'Gambar produk harus diupload');
        isValid = false;
    }
    
    if (!isValid) {
        showNotification('warning', 'Validasi Gagal', 'Mohon lengkapi semua field yang wajib diisi');
        return;
    }
    
    showLoading(productId ? 'Mengupdate produk...' : 'Menyimpan produk...');
    
    try {
        let finalImageName = imageUrl;
        
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
            // UPDATE PRODUK
            const { error } = await supabaseClient
                .from('products')
                .update(productData)
                .eq('id', productId);
            
            if (error) throw error;
            
            showNotification('success', 'Produk Berhasil Diupdate', `${name} telah diperbarui.`);
        } else {
            // INSERT PRODUK BARU
            const { error } = await supabaseClient
                .from('products')
                .insert([productData]);
            
            if (error) throw error;
            
            showNotification('success', 'Produk Berhasil Ditambahkan', `${name} telah ditambahkan ke katalog.`);
        }
        
        // RELOAD DATA DAN REFRESH UI
        await loadProducts();
        renderAdminProductList();
        filterProducts(currentFilter);
        resetForm();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Save product error:', error);
        showNotification('error', 'Gagal Menyimpan Produk', error.message);
    }
}

async function deleteProduct() {
    const productId = document.getElementById('productId').value;
    const productName = document.getElementById('productName').value;
    
    if (!productId) {
        showNotification('error', 'Error', 'ID produk tidak ditemukan');
        return;
    }
    
    const confirm = window.confirm(`Apakah Anda yakin ingin menghapus produk "${productName}"?`);
    if (!confirm) return;
    
    showLoading('Menghapus produk...');
    
    try {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', productId);
        
        if (error) throw error;
        
        showNotification('success', 'Produk Berhasil Dihapus', `${productName} telah dihapus dari katalog.`);
        
        // RELOAD DATA DAN REFRESH UI
        await loadProducts();
        renderAdminProductList();
        filterProducts(currentFilter);
        resetForm();
        
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error('Delete product error:', error);
        showNotification('error', 'Gagal Menghapus Produk', error.message);
    }
}

function editProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        showNotification('error', 'Error', 'Produk tidak ditemukan');
        return;
    }
    
    editingProductId = productId;
    
    document.getElementById('formTitle').textContent = 'Edit Produk';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productDesc').value = product.desc;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productRating').value = product.rating;
    document.getElementById('productBadge').value = product.badge || '';
    document.getElementById('productImageUrl').value = product.image;
    
    const preview = document.getElementById('imagePreview');
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
    document.getElementById('cancelEditBtn').style.display = 'inline-block';
    document.getElementById('saveProductBtn').textContent = 'Update Produk';
    
    document.getElementById('productName').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
    editingProductId = null;
    resetForm();
    renderAdminProductList();
}

function resetForm() {
    editingProductId = null;
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
    document.getElementById('cancelEditBtn').style.display = 'none';
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
document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('productImageInput');
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
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
        
        // Smart image URL
        let imageUrl;
        if (product.image && product.image.startsWith('http')) {
            imageUrl = product.image;
        } else if (product.image) {
            imageUrl = STORAGE_BASE_URL + product.image;
        } else {
            imageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22 font-family=%22Arial%22 font-size=%2216%22%3EGambar tidak tersedia%3C/text%3E%3C/svg%3E';
        }
        
        productCard.innerHTML = `
            ${product.badge ? `<div class="badge badge-${product.badge}">${product.badge === 'bestseller' ? 'Bestseller' : product.badge === 'new' ? 'Baru' : 'Promo'}</div>` : ''}
            <img src="${imageUrl}" alt="${product.name}" loading="lazy" class="product-image" onerror="this.onerror=null; this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22300%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22400%22 height=%22300%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 fill=%22%23999%22 font-family=%22Arial%22%3EGambar tidak tersedia%3C/text%3E%3C/svg%3E';">
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
        let imageUrl;
        if (product.image && product.image.startsWith('http')) {
            imageUrl = product.image;
        } else if (product.image) {
            imageUrl = STORAGE_BASE_URL + product.image;
        } else {
            imageUrl = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22100%22 height=%22100%22/%3E%3C/svg%3E';
        }
        
        return `
            <div class="admin-product-item">
                <img src="${imageUrl}" alt="${product.name}" onerror="this.style.opacity='0.3';">
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
        filterProducts(currentFilter);
        clearBtn.style.display = 'none';
        searchResults.textContent = '';
    });
}

// ===== FILTER FUNCTIONALITY =====
function filterProducts(filter) {
    currentFilter = filter;
    currentSearch = '';
    currentPage = 1;
    
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    document.getElementById('clearSearchBtn').style.display = 'none';
    document.getElementById('searchResultsInfo').textContent = '';
    
    if (filter === 'all') {
        filteredProducts = allProducts;
    } else {
        filteredProducts = allProducts.filter(p => p.category === filter);
    }
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderProducts(false);
}

function loadMore() {
    currentPage++;
    renderProducts(true);
}

// ===== SMOOTH SCROLL =====
document.addEventListener('DOMContentLoaded', function() {
    const navbar = document.querySelector('.navbar');
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    const navbarHeight = navbar ? navbar.offsetHeight : 0;
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
    
    // ===== INITIALIZATION =====
    const productGrid = document.getElementById('productGrid');
    if (productGrid) {
        productGrid.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary)">Memuat data...</div>';
    }
    
    (async () => {
        try {
            await checkAdminLogin();
            await loadProducts();
            
            filterProducts('all');
            setupSearch();
            
            // Auto login check
            setInterval(checkAdminLogin, 30000);
            
            // Supabase auth state change
            supabaseClient.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    currentUser = null;
                } else if (event === 'SIGNED_IN') {
                    checkAdminLogin();
                }
            });
        } catch (error) {
            console.error('Initialization error:', error);
        }
    })();
});
