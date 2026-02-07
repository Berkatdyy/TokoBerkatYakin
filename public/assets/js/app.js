// ===== SUPABASE CONFIGURATION =====
// GANTI DENGAN CONFIG SUPABASE ANDA
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== GLOBAL VARIABLES =====
let allProducts = [];
let filteredProducts = [];
let currentFilter = 'all';
let currentSearch = '';
let currentPage = 1;
let isAdminLoggedIn = false;
const PRODUCTS_PER_PAGE = 12;

// Default categories
const defaultCategories = ['sembako', 'snack', 'minuman'];
let availableCategories = [...defaultCategories];

// ===== LOAD PRODUCTS FROM SUPABASE =====
async function loadProducts() {
    try {
        console.log('Loading products from Supabase...');
        
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error loading products:', error);
            throw error;
        }

        console.log('Products loaded:', data);
        allProducts = data || [];
        filteredProducts = [...allProducts];

        // Extract unique categories from products
        const productCategories = [...new Set(allProducts.map(p => p.category))];
        availableCategories = [...new Set([...defaultCategories, ...productCategories])];

        renderProducts(false);
        updateCategoryDropdown();
        updateCategoryList();

    } catch (error) {
        console.error('Failed to load products:', error);
        document.getElementById('productGrid').innerHTML = 
            '<div class="no-results">Gagal memuat produk. Periksa koneksi Supabase Anda.</div>';
    }
}

// ===== RENDER PRODUCTS TO GRID =====
function renderProducts(append = false) {
    const productGrid = document.getElementById('productGrid');
    const loadMoreBtn = document.getElementById('loadMoreBtn');

    // Apply search filter
    let productsToShow = currentSearch 
        ? allProducts.filter(p => 
            p.name?.toLowerCase().includes(currentSearch.toLowerCase()) ||
            p.description?.toLowerCase().includes(currentSearch.toLowerCase()) ||
            p.category?.toLowerCase().includes(currentSearch.toLowerCase())
          )
        : filteredProducts;

    // Pagination
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
    const endIndex = startIndex + PRODUCTS_PER_PAGE;
    const paginatedProducts = productsToShow.slice(0, endIndex);

    if (!append) {
        productGrid.innerHTML = '';
    }

    if (paginatedProducts.length === 0) {
        productGrid.innerHTML = '<div class="no-results">Tidak ada produk ditemukan</div>';
        loadMoreBtn.style.display = 'none';
        return;
    }

    // Render products
    const productsToRender = append 
        ? productsToShow.slice(startIndex, endIndex)
        : paginatedProducts;

    productsToRender.forEach(product => {
        const productCard = createProductCard(product);
        productGrid.insertAdjacentHTML('beforeend', productCard);
    });

    // Show/hide load more button
    loadMoreBtn.style.display = endIndex < productsToShow.length ? 'block' : 'none';

    // Update search results info
    if (currentSearch) {
        document.getElementById('searchResultsInfo').textContent = 
            `Menampilkan ${paginatedProducts.length} dari ${productsToShow.length} hasil`;
    }
}

// ===== CREATE PRODUCT CARD HTML =====
function createProductCard(product) {
    const badgeHtml = product.badge 
        ? `<div class="product-badge">${product.badge}</div>` 
        : '';

    const stockColor = product.stock === 'Tersedia' 
        ? 'var(--accent-green)' 
        : product.stock === 'Stok Terbatas' 
        ? 'var(--accent-orange)' 
        : 'var(--accent-red)';

    const stars = '★'.repeat(Math.floor(product.rating || 4.5)) + 
                  '☆'.repeat(5 - Math.floor(product.rating || 4.5));

    return `
        <div class="product-card animate-on-scroll">
            ${badgeHtml}
            <div class="product-image">
                <img src="${product.image_url || 'https://via.placeholder.com/300'}" 
                     alt="${product.name}" 
                     onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
            </div>
            <div class="product-info">
                <div class="product-category">${product.category || 'Produk'}</div>
                <h3 class="product-name">${product.name}</h3>
                <p class="product-desc">${product.description || ''}</p>
                <div class="product-rating">
                    <div class="stars">${stars}</div>
                    <span class="rating-text">${(product.rating || 4.5).toFixed(1)}</span>
                </div>
                <div class="product-price">Rp ${formatPrice(product.price)}</div>
                <div class="product-stock">
                    <span class="stock-indicator" style="background: ${stockColor}"></span>
                    <span class="stock-text">${product.stock || 'Tersedia'}</span>
                </div>
                <a href="https://wa.me/6281234567890?text=Halo, saya tertarik dengan ${product.name}" 
                   class="btn-buy" target="_blank">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    Beli Sekarang
                </a>
            </div>
        </div>
    `;
}

// ===== UTILITY FUNCTIONS =====
function formatPrice(price) {
    return new Intl.NumberFormat('id-ID').format(price || 0);
}

// ===== SEARCH FUNCTIONALITY =====
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
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

// ===== FILTER PRODUCTS =====
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

// ===== ADMIN AUTHENTICATION =====
async function checkAdminLogin() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    isAdminLoggedIn = !!session;

    if (isAdminLoggedIn) {
        document.getElementById('navAdmin').textContent = '● Admin';
        document.getElementById('navAdmin').style.color = 'var(--accent-green)';
    } else {
        document.getElementById('navAdmin').textContent = 'Admin';
        document.getElementById('navAdmin').style.color = '';
    }

    return isAdminLoggedIn;
}

async function loginAdmin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!email || !password) {
        errorDiv.textContent = 'Email dan password harus diisi';
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        isAdminLoggedIn = true;
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('modalTitle').textContent = 'Admin Panel';
        errorDiv.style.display = 'none';

        await checkAdminLogin();
        await loadAdminProducts();
        updateCategoryList();

    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Login gagal: ' + error.message;
        errorDiv.style.display = 'block';
    }
}

function logoutAdmin() {
    supabaseClient.auth.signOut();
    isAdminLoggedIn = false;
    closeAdminModal();
    checkAdminLogin();
}

// ===== ADMIN MODAL =====
function openAdminModal() {
    const modal = document.getElementById('adminModal');
    modal.classList.add('active');

    if (isAdminLoggedIn) {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('modalTitle').textContent = 'Admin Panel';
        loadAdminProducts();
        updateCategoryList();
    } else {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('modalTitle').textContent = 'Admin Login';
    }
}

function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
    resetForm();
}

// ===== CATEGORY MANAGEMENT =====
function updateCategoryDropdown() {
    const select = document.getElementById('productCategory');
    if (!select) return;

    select.innerHTML = availableCategories.map(cat => 
        `<option value="${cat}">${cat}</option>`
    ).join('');
}

function updateCategoryList() {
    const categoryList = document.getElementById('categoryList');
    if (!categoryList) return;

    categoryList.innerHTML = availableCategories.map(cat => `
        <div class="category-tag">
            ${cat}
            ${!defaultCategories.includes(cat) ? `
                <button class="delete-category" onclick="deleteCategory('${cat}')" title="Hapus kategori">×</button>
            ` : ''}
        </div>
    `).join('');
}

function toggleCategoryForm() {
    const form = document.getElementById('categoryForm');
    const isHidden = form.style.display === 'none';
    form.style.display = isHidden ? 'block' : 'none';
    if (isHidden) {
        document.getElementById('newCategoryName').focus();
    }
}

function addCategory() {
    const input = document.getElementById('newCategoryName');
    const newCategory = input.value.trim().toLowerCase();

    if (!newCategory) {
        alert('Nama kategori tidak boleh kosong');
        return;
    }

    if (availableCategories.includes(newCategory)) {
        alert('Kategori sudah ada');
        return;
    }

    availableCategories.push(newCategory);
    updateCategoryDropdown();
    updateCategoryList();
    input.value = '';
    toggleCategoryForm();
}

async function deleteCategory(category) {
    if (defaultCategories.includes(category)) {
        alert('Kategori default tidak bisa dihapus');
        return;
    }

    const hasProducts = allProducts.some(p => p.category === category);
    if (hasProducts) {
        alert('Kategori ini masih digunakan oleh beberapa produk');
        return;
    }

    if (!confirm(`Hapus kategori "${category}"?`)) return;

    availableCategories = availableCategories.filter(c => c !== category);
    updateCategoryDropdown();
    updateCategoryList();
}

// ===== PRODUCT CRUD =====
async function saveProduct(event) {
    event.preventDefault();

    if (!isAdminLoggedIn) {
        alert('Silakan login terlebih dahulu');
        return;
    }

    const productId = document.getElementById('editProductId').value;
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const price = parseFloat(document.getElementById('productPrice').value);
    const description = document.getElementById('productDescription').value.trim();
    const stock = document.getElementById('productStock').value;
    const rating = parseFloat(document.getElementById('productRating').value);
    const badge = document.getElementById('productBadge').value;
    const imageFile = document.getElementById('productImage').files[0];
    const currentImageUrl = document.getElementById('currentImageUrl').value;

    if (!name || !category || !price) {
        alert('Nama, kategori, dan harga harus diisi');
        return;
    }

    try {
        let image_url = currentImageUrl;

        // Upload image if new file selected
        if (imageFile) {
            image_url = await uploadImage(imageFile);
        }

        const productData = {
            name,
            category,
            price,
            description,
            stock,
            rating,
            badge,
            image_url
        };

        if (productId) {
            // UPDATE existing product
            const { data, error } = await supabaseClient
                .from('products')
                .update(productData)
                .eq('id', productId)
                .select();

            if (error) throw error;

            console.log('Product updated:', data);
            alert('Produk berhasil diupdate!');
        } else {
            // INSERT new product
            const { data, error } = await supabaseClient
                .from('products')
                .insert([productData])
                .select();

            if (error) throw error;

            console.log('Product created:', data);
            alert('Produk berhasil ditambahkan!');
        }

        await loadProducts();
        await loadAdminProducts();
        resetForm();

    } catch (error) {
        console.error('Error saving product:', error);
        alert('Gagal menyimpan produk: ' + error.message);
    }
}

async function editProduct(id) {
    const product = allProducts.find(p => p.id === id);
    if (!product) return;

    document.getElementById('editProductId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productCategory').value = product.category;
    document.getElementById('productPrice').value = product.price;
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('productStock').value = product.stock || 'Tersedia';
    document.getElementById('productRating').value = product.rating || 4.5;
    document.getElementById('productBadge').value = product.badge || '';
    document.getElementById('currentImageUrl').value = product.image_url || '';

    // Show image preview
    if (product.image_url) {
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('previewImg').src = product.image_url;
    }

    // Scroll to form
    document.getElementById('productForm').scrollIntoView({ behavior: 'smooth' });
}

async function deleteProduct(id) {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;

    try {
        const { error } = await supabaseClient
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;

        console.log('Product deleted');
        alert('Produk berhasil dihapus!');

        await loadProducts();
        await loadAdminProducts();

    } catch (error) {
        console.error('Error deleting product:', error);
        alert('Gagal menghapus produk: ' + error.message);
    }
}

function resetForm() {
    document.getElementById('productForm').reset();
    document.getElementById('editProductId').value = '';
    document.getElementById('currentImageUrl').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('productImage').value = '';
}

// ===== IMAGE HANDLING =====
async function uploadImage(file) {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { data, error } = await supabaseClient.storage
            .from('products')
            .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabaseClient.storage
            .from('products')
            .getPublicUrl(filePath);

        return publicUrl;

    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('imagePreview').style.display = 'block';
            document.getElementById('previewImg').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

// ===== LOAD ADMIN PRODUCT LIST =====
async function loadAdminProducts() {
    const adminList = document.getElementById('adminProductList');
    if (!adminList) return;

    if (allProducts.length === 0) {
        adminList.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Belum ada produk</p>';
        return;
    }

    adminList.innerHTML = allProducts.map(product => `
        <div class="admin-product-item">
            <img src="${product.image_url || 'https://via.placeholder.com/80'}" 
                 alt="${product.name}" 
                 style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;">
            <div style="flex: 1;">
                <strong>${product.name}</strong><br>
                <small style="color: var(--text-secondary);">${product.category} - Rp ${formatPrice(product.price)}</small>
            </div>
            <div class="admin-product-actions">
                <button onclick="editProduct('${product.id}')" class="btn btn-secondary btn-sm">Edit</button>
                <button onclick="deleteProduct('${product.id}')" class="btn btn-secondary btn-sm" style="background: var(--accent-red); color: white;">Hapus</button>
            </div>
        </div>
    `).join('');
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
