/*********************************
 * 1. SUPABASE CONFIG
 *********************************/
const SUPABASE_URL = "https://biagisibwjkgpdfxyhxg.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYWdpc2lid2prZ3BkZnh5aHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDg3NzYsImV4cCI6MjA4NjAyNDc3Nn0.bAFsKmyOh3XME-Fdop3VKRltc8gThZydaeIdOiSiztI";

const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

/*********************************
 * 2. STATE
 *********************************/
let currentUser = null;
let isAdmin = false;

/*********************************
 * 3. AUTH CHECK ON LOAD
 *********************************/
document.addEventListener("DOMContentLoaded", async () => {
  await checkSession();
  await loadProducts();
});

/*********************************
 * 4. SESSION & ROLE CHECK
 *********************************/
async function checkSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    currentUser = null;
    isAdmin = false;
    return;
  }

  currentUser = session.user;

  // cek role dari table profiles
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (!error && profile?.role === "admin") {
    isAdmin = true;
    document.getElementById("navAdmin").style.display = "block";
  } else {
    isAdmin = false;
  }
}

/*********************************
 * 5. LOGIN ADMIN
 *********************************/
async function loginAdmin() {
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert("Login gagal: " + error.message);
    return;
  }

  currentUser = data.user;

  // cek role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", currentUser.id)
    .single();

  if (profile?.role !== "admin") {
    alert("Akun ini bukan admin");
    await supabase.auth.signOut();
    return;
  }

  isAdmin = true;
  closeLoginModal();
  openAdminModal();
  loadProductsAdmin();
}

/*********************************
 * 6. LOGOUT
 *********************************/
async function logoutAdmin() {
  await supabase.auth.signOut();
  location.reload();
}

/*********************************
 * 7. LOAD PRODUCTS (PUBLIC)
 *********************************/
async function loadProducts() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  data.forEach((p) => {
    grid.innerHTML += `
      <div class="product-card">
        <img src="${p.image_url}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <strong>Rp ${p.price}</strong>
      </div>
    `;
  });
}

/*********************************
 * 8. LOAD PRODUCTS (ADMIN)
 *********************************/
async function loadProductsAdmin() {
  if (!isAdmin) return;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    alert(error.message);
    return;
  }

  const list = document.getElementById("productListAdmin");
  list.innerHTML = "";

  data.forEach((p) => {
    list.innerHTML += `
      <div class="admin-product-item">
        <strong>${p.name}</strong>
        <button onclick="editProduct('${p.id}')">Edit</button>
      </div>
    `;
  });
}

/*********************************
 * 9. SAVE PRODUCT (ADMIN)
 *********************************/
async function saveProduct() {
  if (!isAdmin) {
    alert("Tidak punya izin");
    return;
  }

  const product = {
    name: document.getElementById("productName").value,
    category: document.getElementById("productCategory").value,
    price: document.getElementById("productPrice").value,
    description: document.getElementById("productDesc").value,
    stock_status: document.getElementById("productStock").value,
    rating: document.getElementById("productRating").value,
    badge: document.getElementById("productBadge").value,
    image_url: document.getElementById("productImageUrl").value,
  };

  const id = document.getElementById("productId").value;

  let result;
  if (id) {
    result = await supabase.from("products").update(product).eq("id", id);
  } else {
    result = await supabase.from("products").insert(product);
  }

  if (result.error) {
    alert(result.error.message);
    return;
  }

  resetForm();
  loadProducts();
  loadProductsAdmin();
}

/*********************************
 * 10. DELETE PRODUCT
 *********************************/
async function deleteProduct() {
  const id = document.getElementById("productId").value;
  if (!id || !isAdmin) return;

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    alert(error.message);
    return;
  }

  resetForm();
  loadProducts();
  loadProductsAdmin();
}

/*********************************
 * 11. UI HELPERS
 *********************************/
function openAdminModal() {
  document.getElementById("adminModal").style.display = "block";
}

function closeAdminModal() {
  document.getElementById("adminModal").style.display = "none";
}

function closeLoginModal() {
  document.getElementById("loginModal").style.display = "none";
}

function resetForm() {
  document.getElementById("productId").value = "";
  document.querySelector("form")?.reset();
}
