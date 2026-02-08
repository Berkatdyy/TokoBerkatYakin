// ===== SUPABASE CONFIGURATION =====
const SUPABASE_URL = 'https://biagisibwjkgpdfxyhxg.supabase.co';
// ✅ PUBLISHABLE KEY dari Supabase Dashboard (Format baru Supabase)
const SUPABASE_ANON_KEY = 'sb_publishable_k_Tjf3ZGz2qsyR6pSfrtdg_FpM3k4qT';

// Inisialisasi Supabase client dengan ANON KEY
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
        
        if (profileError) {
            console.error('Error fetching profile:', profileError);
            throw new Error('Gagal memverifikasi role admin');
        }
        
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
        // ✅ QUERY PUBLIC SELECT dengan ANON KEY
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
        
        // ✅ ERROR HANDLING: cegah JS crash
        if (error) {
            console.error('Error loading products:', error);
            showNotification('error', 'Error', 'Gagal memuat data produk: ' + error.message);
            allProducts = [];
            filteredProducts = [];
            hideLoading();
            return; // ✅ STOP eksekusi jika error
        }
        
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
    let hasError = false;
    
    if (!name) {
        document.getElementById('nameError').textContent = 'Nama produk wajib diisi';
        document.getElementById('nameGroup').classList.add('error');
        hasError = true;
    } else {
        document.getElementById('nameError').textContent = '';
        document.getElementById('nameGroup').classList.remove('error');
    }
    
    if (!category) {
        document.getElementById('categoryError').textContent = 'Kategori wajib diisi';
        document.getElementById('categoryGroup').classList.add('error');
        hasError = true;
    } else {
        document.getElementById('categoryError').textContent = '';
        document.getElementById('categoryGroup').classList.remove('error');
    }
    
    if (!price) {
        document.getElementById('priceError').textContent = 'Harga wajib diisi';
        document.getElementById('priceGroup').classList.add('error');
        hasError = true;
    } else {
        document.getElementById('priceError').textContent = '';
        document.getElementById('priceGroup').classList.remove('error');
    }
    
    if (hasError) {
        showNotification('warning', 'Validasi Gagal', 'Harap isi semua field yang wajib');
        return;
    }
    
    showLoading(id ? 'Memperbarui produk...' : 'Menambahkan produk...');
    
    try {
        const productData = {
            name,
            category,
            price,
            description: desc,
            stock: parseInt(stock) || 0,
            rating: rating || 5.0,
            badge: badge || '',
            image_url: imageUrl
        };
        
        let result;
        if (id) {
            // Update
            result = await supabaseClient
                .from('products')
                .update(productData)
                .eq('id', id);
        } else {
            // Insert
            result = await supabaseClient
                .from('products')
                .insert([productData]);
        }
        
        if (result.error) throw result.error;
        
        showNotification('success', 'Berhasil', id ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
        resetForm();
        await loadProducts();
    } catch (error) {
        console.error('Error saving product:', error);
        showNotification('error', 'Gagal', 'Gagal menyimpan produk: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function deleteProduct(productId) {
    if (!confirm('Yakin ingin menghapus produk ini?')) {
        return;
    }
    
    showLoading('Menghapus produk...');
    
    try {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', productId);
        
        if (error) throw error;
        
        showNotification('success', 'Berhasil', 'Produk berhasil dihapus');
        await loadProducts();
    } catch (error) {
        console.error('Error deleting product:', error);
        showNotification('error', 'Gagal', 'Gagal menghapus produk: ' + error.message);
    } finally {
        hideLoading();
    }
}

function editProduct(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    editingProductId = productId;
    document.getElementById('formTitle').textContent = 'Edit Produk';
    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productDesc').value = product.description || '';
    document.getElementById('productStock').value = product.stock || 0;
    document.getElementById('productRating').value = product.rating || 5.0;
    document.getElementById('productBadge').value = product.badge || '';
    document.getElementById('productImageUrl').value = product.image_url || '';
    
    document.querySelector('.form-actions').scrollIntoView({ behavior: 'smooth' });
}

function resetForm() {
    editingProductId = null;
    document.getElementById('formTitle').textContent = 'Tambah Produk Baru';
    document.getElementById('productId').value = '';
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productDesc').value = '';
    document.getElementById('productStock').value = '0';
    document.getElementById('productRating').value = '5.0';
    document.getElementById('productBadge').value = '';
    document.getElementById('productImageUrl').value = '';
    
    document.querySelectorAll('.form-group').forEach(group => group.classList.remove('error'));
    document.querySelectorAll('.validation-error').forEach(error => error.textContent = '');
}

// ===== CATEGORY MANAGEMENT =====
function addNewCategory() {
    const input = document.getElementById('newCategoryInput');
    const newCategory = input.value.trim().toLowerCase();
    
    if (!newCategory) {
        showNotification('warning', 'Perhatian', 'Nama kategori tidak boleh kosong');
        return;
    }
    
    if (allCategories.includes(newCategory)) {
        showNotification('warning', 'Perhatian', 'Kategori sudah ada');
        return;
    }
    
    allCategories.push(newCategory);
    updateCategoryLists();
    input.value = '';
    showNotification('success', 'Berhasil', `Kategori "${newCategory}" ditambahkan`);
}

function removeCategory(category) {
    if (!confirm(`Hapus kategori "${category}"? Produk dengan kategori ini tidak akan dihapus.`)) {
        return;
    }
    
    allCategories = allCategories.filter(c => c !== category);
    updateCategoryLists();
    showNotification('info', 'Berhasil', `Kategori "${category}" dihapus`);
}

function updateCategoryLists() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = allCategories.map(cat => `
        <div class="category-item">
            <span>${cat}</span>
            <button class="btn-small btn-danger" onclick="removeCategory('${cat}')">×</button>
        </div>
    `).join('');
    
    const datalist = document.getElementById('categoryOptions');
    datalist.innerHTML = allCategories.map(cat => `<option value="${cat}">`).join('');
}

// ===== RENDER FUNCTIONS =====
function renderProducts(append = false) {
    const productGrid = document.getElementById('productGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    
    if (!append) {
        productGrid.innerHTML = '';
        currentPage = 1;
    }
    
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const endIndex = currentPage * PRODUCTS_PER_PAGE;
    const productsToShow = filteredProducts.slice(startIndex, endIndex);
    
    if (productsToShow.length === 0 && !append) {
        productGrid.innerHTML = '<div style="text-align: center; padding: 3rem; color: var(--text-secondary); grid-column: 1 / -1;">Tidak ada produk ditemukan</div>';
        loadMoreBtn.style.display = 'none';
        return;
    }
    
    productsToShow.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card animate-on-scroll';
        card.innerHTML = `
            ${product.badge ? `<div class="product-badge ${product.badge}">${product.badge === 'best-seller' ? 'Terlaris' : product.badge === 'new' ? 'Baru' : 'Promo'}</div>` : ''}
            <div class="product-image">
                <img src="${product.image_url || 'assets/images/placeholder.jpg'}" alt="${product.name}" onerror="this.src='assets/images/placeholder.jpg'">
            </div>
            <div class="product-info">
                <div class="product-category">${product.category}</div>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-desc">${product.description || ''}</p>
                <div class="product-rating">
                    ${'★'.repeat(Math.floor(product.rating || 5))}${'☆'.repeat(5 - Math.floor(product.rating || 5))}
                    <span>${(product.rating || 5).toFixed(1)}</span>
                </div>
                <div class="product-footer">
                    <div class="product-price">Rp ${product.price}</div>
                    <div class="product-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}">
                        ${product.stock > 0 ? `Stok: ${product.stock}` : 'Habis'}
                    </div>
                </div>
            </div>
        `;
        productGrid.appendChild(card);
    });
    
    if (endIndex >= filteredProducts.length) {
        loadMoreBtn.style.display = 'none';
    } else {
        loadMoreBtn.style.display = 'flex';
    }
    
    setTimeout(() => {
        document.querySelectorAll('.product-card:not(.visible)').forEach(card => {
            card.classList.add('visible');
        });
    }, 50);
}

function renderAdminProductList() {
    const container = document.getElementById('productListAdmin');
    if (!container) return;
    
    if (allProducts.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Belum ada produk</div>';
        return;
    }
    
    container.innerHTML = allProducts.map(product => `
        <div class="admin-product-item">
            <div class="admin-product-image">
                <img src="${product.image_url || 'assets/images/placeholder.jpg'}" alt="${product.name}" onerror="this.src='assets/images/placeholder.jpg'">
            </div>
            <div class="admin-product-info">
                <div class="admin-product-name">${product.name}</div>
                <div class="admin-product-category">${product.category}</div>
                <div class="admin-product-price">Rp ${product.price}</div>
            </div>
            <div class="admin-product-actions">
                <button class="btn-small btn-primary" onclick="editProduct(${product.id})">Edit</button>
                <button class="btn-small btn-danger" onclick="deleteProduct(${product.id})">Hapus</button>
            </div>
        </div>
    `).join('');
}

// ===== SEARCH FUNCTIONALITY =====
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearch');
    
    searchBtn.addEventListener('click', performSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

function performSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    
    if (!searchTerm) {
        showNotification('warning', 'Perhatian', 'Masukkan kata kunci pencarian');
        return;
    }
    
    currentSearch = searchTerm;
    
    filteredProducts = allProducts.filter(product => {
        return product.name.toLowerCase().includes(searchTerm) ||
               product.category.toLowerCase().includes(searchTerm) ||
               (product.description && product.description.toLowerCase().includes(searchTerm));
    });
    
    document.getElementById('searchResultsInfo').textContent = 
        `Menampilkan ${filteredProducts.length} hasil untuk "${searchTerm}"`;
    
    renderProducts(false);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentSearch = '';
    document.getElementById('searchResultsInfo').textContent = '';
    filterProducts(currentFilter);
}

function filterProducts(filter) {
    currentFilter = filter;
    
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
