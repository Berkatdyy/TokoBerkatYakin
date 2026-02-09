
const SUPABASE_URL = "https://biagisibwjkgpdfxyhxg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpYWdpc2lid2prZ3BkZnh5aHhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0NDg3NzYsImV4cCI6MjA4NjAyNDc3Nn0.bAFsKmyOh3XME-Fdop3VKRltc8gThZydaeIdOiSiztI";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STORAGE_URL = 
"https://biagisibwjkgpdfxyhxg.supabase.co/storage/v1/object/public/product-images/";

async function loadProducts(){

  const { data, error } = await supabaseClient
    .from("products")
    .select("*")
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    return;
  }

  renderProducts(data);
}

function renderProducts(products){

  const grid = document.getElementById("productGrid");
  if(!grid) return;

  grid.innerHTML = "";

  products.forEach(p=>{

    const card = document.createElement("div");
    card.className = "product-card";

    card.innerHTML = `
      <div class="product-image">
        <img src="${STORAGE_URL + p.image}">
      </div>
      <div class="product-info">
        <h3>${p.name}</h3>
        <p>${p.desc}</p>
        <div class="product-price">${p.price}</div>
      </div>
    `;

    grid.appendChild(card);
  });
}

async function loginAdmin(){

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,password
  });

  if(error){
    alert("Login gagal");
  }else{
    alert("Login berhasil");
  }
}

loadProducts();
