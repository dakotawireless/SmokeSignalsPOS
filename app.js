
(() => {
  "use strict";

  const TAX_RATE = 0;
  const MAX_QUICK_PICKS = 12;
  const STORAGE_KEYS = {
    products: "sspos_products_v2",
    customers: "sspos_customers_v1",
    movements: "sspos_inventory_movements_v2"
  };

  const imported = Array.isArray(window.SMOKE_SIGNALS_IMPORTED_PRODUCTS)
    ? window.SMOKE_SIGNALS_IMPORTED_PRODUCTS
    : [];

  const seedCustomers = [
    {id:"c1",name:"Sarah Johnson",email:"sarah@example.com",phone:"406-555-0101",birthDate:"1991-04-12",ageVerified:true,points:320,reward:5},
    {id:"c2",name:"Michael Azure",email:"",phone:"406-555-0185",birthDate:"1987-09-22",ageVerified:true,points:185,reward:0}
  ];

  const state = {
    products: loadJson(STORAGE_KEYS.products, imported),
    customers: loadJson(STORAGE_KEYS.customers, seedCustomers),
    movements: loadJson(STORAGE_KEYS.movements, []),
    cart: [],
    customer: null,
    transactionDiscount: null,
    saleNote: ""
  };

  const categoryIcons = {
    "Smoking Accessories":"🔥","Papers Wraps Cones":"▭","Stickers,Pins,Keychains":"★","Incense":"♨",
    "Novelty":"👽","Custom Shirt Printing":"👕","Kratom":"🌿","Vapes":"▥","Glass":"⚗","Pipes":"⌁",
    "Torches & Lighters":"🔥","Accessories":"◉","Body Jewelry":"◌","Rolling Papers & Cones":"▭",
    "Beverages":"🥤","Mushroom":"🍄","Clothing":"👕","Other":"•••"
  };

  const $ = id => document.getElementById(id);
  const money = n => `$${Number(n || 0).toFixed(2)}`;
  const clamp = (n,min,max) => Math.min(max,Math.max(min,n));

  function loadJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : structuredCopy(fallback);
    }catch{ return structuredCopy(fallback); }
  }
  function saveProducts(){ localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products)); }
  function saveCustomers(){ localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(state.customers)); }
  function saveMovements(){ localStorage.setItem(STORAGE_KEYS.movements, JSON.stringify(state.movements)); }
  function structuredCopy(v){ return window.structuredClone ? structuredClone(v) : JSON.parse(JSON.stringify(v)); }
  function uid(prefix="id"){ return window.crypto?.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`; }
  function esc(s){ return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function showToast(msg){ const t=$("toast"); t.textContent=msg;t.classList.remove("hidden");clearTimeout(showToast._t);showToast._t=setTimeout(()=>t.classList.add("hidden"),2200); }

  function updateClock(){
    const d=new Date();
    $("clockTime").textContent=d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
    $("clockDate").textContent=d.toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"});
  }

  function quickPicks(){ return state.products.filter(p=>p.quickPick).slice(0,MAX_QUICK_PICKS); }

  function productTile(p){
    return `<button class="product-tile" type="button" data-product-id="${esc(p.id)}">
      <div class="product-name">${esc(p.name)}</div>
      <div class="price">${money(p.price)}</div>
    </button>`;
  }

  function renderQuickPicks(){
    const list=quickPicks();
    $("quickPickCount").textContent=`${list.length} / ${MAX_QUICK_PICKS}`;
    $("quickPickGrid").innerHTML=list.length
      ? list.map(productTile).join("")
      : `<div class="empty-quick"><strong>No Quick Picks selected yet.</strong><br>Open Inventory, select a product, and check <b>Add to Home Screen</b>.</div>`;
  }

  function renderCategories(){
    const cats=[...new Set(state.products.map(p=>p.category || "Other"))].sort((a,b)=>a.localeCompare(b));
    $("categoryGrid").innerHTML=cats.map(c=>`<button class="category-tile" type="button" data-category="${esc(c)}">
      <span class="category-icon">${categoryIcons[c] || "◫"}</span><span>${esc(c)}</span>
    </button>`).join("");
    const sel=$("inventoryCategoryFilter");
    const current=sel.value;
    sel.innerHTML=`<option value="">All categories</option>`+cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
    sel.value=current;
  }

  function openCategory(cat){
    const list=state.products.filter(p=>p.category===cat);
    $("categoryTitle").textContent=cat.toUpperCase();
    $("categoryProductGrid").innerHTML=list.map(productTile).join("");
    $("categoryResults").classList.remove("hidden");
    $("categoryResults").scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function findBarcode(barcode){
    const b=String(barcode||"").trim();
    return state.products.find(p=>Array.isArray(p.barcodes)&&p.barcodes.some(x=>String(x)===b));
  }

  function addProductToCart(productId){
    const p=state.products.find(x=>x.id===productId); if(!p)return;
    const existing=state.cart.find(l=>l.productId===p.id && !l.adjustment);
    if(existing) existing.qty++;
    else state.cart.push({lineId:uid("line"),productId:p.id,name:p.name,price:Number(p.price||0),cost:Number(p.cost||0),qty:1,adjustment:null});
    renderCart();
  }

  function effectiveUnit(line){
    const a=line.adjustment;if(!a)return line.price;
    if(a.type==="price")return Math.max(0,a.value);
    if(a.type==="percent")return Math.max(0,line.price*(1-a.value/100));
    if(a.type==="dollar")return Math.max(0,line.price-a.value);
    return line.price;
  }

  function calcTotals(){
    const subtotal=state.cart.reduce((s,l)=>s+effectiveUnit(l)*l.qty,0);
    let disc=0;
    const d=state.transactionDiscount;
    if(d?.type==="percent")disc=clamp(subtotal*d.value/100,0,subtotal);
    if(d?.type==="dollar")disc=clamp(d.value,0,subtotal);
    const total=Math.max(0,subtotal-disc);
    return {subtotal,disc,tax:0,total};
  }

  function renderCart(){
    $("cartLines").innerHTML=state.cart.length?state.cart.map((l,i)=>`<div class="cart-line" data-line-id="${esc(l.lineId)}">
      <div class="cart-product"><strong>${esc(l.name)}</strong>${l.adjustment?`<div class="line-adjustment">${esc(l.adjustment.label)} • ${esc(l.adjustment.reason)}</div>`:""}</div>
      <div class="qty"><button data-cart-act="minus" data-i="${i}" type="button">−</button><span>${l.qty}</span><button data-cart-act="plus" data-i="${i}" type="button">+</button></div>
      <div class="line-total">${money(effectiveUnit(l)*l.qty)}</div>
      <button class="remove-line" data-cart-act="remove" data-i="${i}" type="button" aria-label="Remove item">×</button>
    </div>`).join(""):`<div class="empty-cart"><strong>No items in current sale.</strong><span>Scan or tap a product to begin.</span></div>`;
    const t=calcTotals();
    $("subtotalValue").textContent=money(t.subtotal);
    if(state.transactionDiscount&&t.disc>0){
      $("discountRow").classList.remove("hidden");$("discountLabel").textContent=state.transactionDiscount.label;$("discountValue").textContent=`-${money(t.disc)}`;
    } else $("discountRow").classList.add("hidden");
    $("totalValue").textContent=money(t.total);
  }

  function openModal(title,body){
    $("modalCard").innerHTML=`<div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" data-close-modal type="button">×</button></div>${body}`;
    $("modalBackdrop").classList.remove("hidden");
    setTimeout(()=>$("modalCard").querySelector("input,select,textarea,button:not([data-close-modal])")?.focus(),0);
  }
  function closeModal(){$("modalBackdrop").classList.add("hidden");$("modalCard").innerHTML="";}

  function barcodeFieldHtml(initial=[]){
    return `<div class="barcode-builder">
      <div class="barcode-entry"><input id="barcodeEntry" type="text" inputmode="numeric" autocomplete="off" placeholder="Scan a barcode and press Enter"><button id="addBarcodeBtn" class="secondary-btn" type="button">Add</button></div>
      <div class="helper">Scan one barcode after another. Each scan is added automatically—no commas needed.</div>
      <div id="barcodeChips" class="barcode-chips"></div>
    </div>`;
  }

  function wireBarcodeBuilder(initial, editingProductId=null){
    let barcodes=[...new Set((initial||[]).map(x=>String(x).trim()).filter(Boolean))];
    const input=$("barcodeEntry"),chips=$("barcodeChips");

    function render(){
      chips.innerHTML=barcodes.map((b,i)=>`<span class="barcode-chip">${esc(b)}<button data-remove-barcode="${i}" type="button">×</button></span>`).join("")||`<span class="muted">No barcodes added.</span>`;
    }
    function add(){
      const b=input.value.trim();if(!b)return;
      if(barcodes.includes(b)){showToast("Barcode already added to this product.");input.select();return;}
      const owner=state.products.find(p=>p.id!==editingProductId&&(p.barcodes||[]).includes(b));
      if(owner){showToast(`Barcode already belongs to ${owner.name}.`);input.select();return;}
      barcodes.push(b);input.value="";render();input.focus();
    }
    input.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();add();}});
    $("addBarcodeBtn").addEventListener("click",add);
    chips.addEventListener("click",e=>{const b=e.target.closest("[data-remove-barcode]");if(!b)return;barcodes.splice(Number(b.dataset.removeBarcode),1);render();});
    render();
    return ()=>barcodes.slice();
  }

  function productFormFields(p,isNew){
    return `<form id="productForm">
      <div class="form-grid">
        <div class="field"><label>Product Name *</label><input id="pfName" required value="${esc(p?.name||"")}"></div>
        <div class="field"><label>Category *</label><input id="pfCategory" required value="${esc(p?.category||"")}"></div>
        <div class="field"><label>Supplier</label><input id="pfSupplier" value="${esc((p?.supplier==="None"?"":p?.supplier)||"")}"></div>
        <div class="field"><label>Cost</label><input id="pfCost" type="number" step="0.01" min="0" value="${Number(p?.cost||0).toFixed(2)}"></div>
        <div class="field"><label>Sale Price *</label><input id="pfPrice" type="number" step="0.01" min="0" required value="${Number(p?.price||0).toFixed(2)}"></div>
        ${isNew?`<div class="field"><label>Initial Inventory Count</label><input id="pfInitialInventory" type="number" step="1" min="0" value="0"></div>`:`<div class="field"><label>Current Inventory</label><input value="${Number(p?.inventory||0)}" disabled></div>`}
        <div class="field full"><label>Description</label><textarea id="pfDescription" rows="3">${esc(p?.description||"")}</textarea></div>
        <div class="field full"><label>Barcodes</label>${barcodeFieldHtml(p?.barcodes||[])}</div>
        <div class="field full"><label class="home-toggle"><input id="pfQuickPick" type="checkbox" ${p?.quickPick?"checked":""}><span><strong>Add to Home Screen</strong><br><span class="muted">Quick Picks are limited to ${MAX_QUICK_PICKS} products.</span></span></label></div>
      </div>
      <div class="modal-actions">
        <button class="secondary-btn" type="button" data-close-modal>Cancel</button>
        <button class="primary-btn" type="submit">${isNew?"Create Product":"Save Changes"}</button>
      </div>
    </form>`;
  }

  function openAddProduct(){
    openModal("Add New Product",productFormFields(null,true));
    const getBarcodes=wireBarcodeBuilder([],null);
    $("productForm").addEventListener("submit",e=>{
      e.preventDefault();
      const quick=$("pfQuickPick").checked;
      if(quick&&quickPicks().length>=MAX_QUICK_PICKS){showToast(`Home screen is full (${MAX_QUICK_PICKS} items).`);return;}
      const p={id:uid("product"),name:$("pfName").value.trim(),category:$("pfCategory").value.trim(),supplier:$("pfSupplier").value.trim()||"None",cost:Number($("pfCost").value||0),price:Number($("pfPrice").value||0),description:$("pfDescription").value.trim(),barcodes:getBarcodes(),inventory:Math.max(0,Math.floor(Number($("pfInitialInventory").value||0))),quickPick:quick,source:"Created in Smoke Signals POS"};
      if(!p.name||!p.category||!Number.isFinite(p.price))return;
      state.products.push(p);
      if(p.inventory>0)addMovement(p.id,p.inventory,"Initial Inventory","New product setup");
      saveProducts();renderAllProductViews();closeModal();showToast(`${p.name} created.`);
    });
  }

  function openEditProduct(productId){
    const p=state.products.find(x=>x.id===productId);if(!p)return;
    openModal("Inventory Item",productFormFields(p,false)+`
      <div class="stock-card" style="margin-top:14px">
        <div class="muted">Current inventory</div><strong>${Number(p.inventory||0)}</strong>
        <div class="stock-actions">
          <button id="receiveStockBtn" class="secondary-btn" type="button">+ Add Received Inventory</button>
          <button id="adjustStockBtn" class="secondary-btn" type="button">± Adjust Inventory Count</button>
        </div>
      </div>
      <div id="movementHistory"></div>`);
    const getBarcodes=wireBarcodeBuilder(p.barcodes||[],p.id);
    renderMovementHistory(p.id);
    $("productForm").addEventListener("submit",e=>{
      e.preventDefault();
      const wantsQuick=$("pfQuickPick").checked;
      if(wantsQuick&&!p.quickPick&&quickPicks().length>=MAX_QUICK_PICKS){showToast(`Home screen is full (${MAX_QUICK_PICKS} items).`);$("pfQuickPick").checked=false;return;}
      p.name=$("pfName").value.trim();p.category=$("pfCategory").value.trim();p.supplier=$("pfSupplier").value.trim()||"None";p.cost=Number($("pfCost").value||0);p.price=Number($("pfPrice").value||0);p.description=$("pfDescription").value.trim();p.barcodes=getBarcodes();p.quickPick=wantsQuick;
      saveProducts();renderAllProductViews();closeModal();showToast(`${p.name} updated.`);
    });
    $("receiveStockBtn").addEventListener("click",()=>openStockModal(p,"receive"));
    $("adjustStockBtn").addEventListener("click",()=>openStockModal(p,"adjust"));
  }

  function addMovement(productId,delta,type,note){state.movements.unshift({id:uid("move"),productId,delta:Number(delta),type,note:note||"",at:new Date().toISOString()});saveMovements();}
  function renderMovementHistory(productId){
    const host=$("movementHistory");if(!host)return;
    const rows=state.movements.filter(m=>m.productId===productId).slice(0,8);
    host.innerHTML=rows.length?`<div class="movement-title">Recent Inventory Changes</div>${rows.map(m=>`<div class="movement-row"><span>${esc(m.type)}${m.note?` — ${esc(m.note)}`:""}</span><strong class="${m.delta>=0?"move-in":"move-out"}">${m.delta>=0?"+":""}${m.delta}</strong></div>`).join("")}`:"";
  }

  function openStockModal(p,mode){
    const title=mode==="receive"?`Receive Inventory — ${p.name}`:`Adjust Inventory — ${p.name}`;
    openModal(title,`<form id="stockForm"><div class="field"><label>${mode==="receive"?"Quantity Received":"New Physical Count"}</label><input id="stockQty" type="number" min="0" step="1" required autofocus></div><div class="field"><label>Note / Reference</label><input id="stockNote" placeholder="PO, correction reason, etc."></div><div class="modal-actions"><button class="secondary-btn" type="button" data-close-modal>Cancel</button><button class="primary-btn" type="submit">Save Inventory</button></div></form>`);
    $("stockForm").addEventListener("submit",e=>{
      e.preventDefault();const n=Math.max(0,Math.floor(Number($("stockQty").value||0))),old=Number(p.inventory||0);
      if(mode==="receive"){p.inventory=old+n;addMovement(p.id,n,"Received",$("stockNote").value.trim());}
      else {p.inventory=n;addMovement(p.id,n-old,"Count Adjustment",$("stockNote").value.trim());}
      saveProducts();renderInventory();closeModal();showToast(`${p.name} inventory is now ${p.inventory}.`);
    });
  }

  function renderInventory(){
    const q=$("inventorySearch").value.trim().toLowerCase(),cat=$("inventoryCategoryFilter").value,only=$("quickPickOnly").checked;
    const list=state.products.filter(p=>{
      if(cat&&p.category!==cat)return false;if(only&&!p.quickPick)return false;
      if(!q)return true;
      return `${p.name} ${p.category} ${p.supplier} ${(p.barcodes||[]).join(" ")}`.toLowerCase().includes(q);
    });
    $("inventoryTableBody").innerHTML=list.map(p=>`<tr class="inventory-row" data-edit-product="${esc(p.id)}">
      <td><strong>${esc(p.name)}</strong>${p.description?`<br><span class="muted">${esc(p.description.slice(0,70))}${p.description.length>70?"…":""}</span>`:""}</td>
      <td>${esc(p.category)}</td><td>${esc(p.supplier==="None"?"":p.supplier)}</td><td>${money(p.cost)}</td><td>${money(p.price)}</td>
      <td class="${Number(p.inventory||0)===0?"stock-zero":""}">${Number(p.inventory||0)}</td><td>${p.quickPick?'<span class="home-check">✓</span>':""}</td>
    </tr>`).join("");
    $("inventorySummary").textContent=`${state.products.length} products in catalog • ${quickPicks().length}/${MAX_QUICK_PICKS} Quick Picks • stock counts can be updated before rollout`;
  }

  function renderAllProductViews(){renderQuickPicks();renderCategories();renderInventory();}

  function openLineAdjustment(line){
    openModal(`Edit ${line.name}`,`<form id="lineForm">
      <div class="field"><label>Action</label><select id="lineAction"><option value="price">Change Price</option><option value="percent">Discount %</option><option value="dollar">Discount $</option></select></div>
      <div class="field"><label>Value</label><input id="lineValue" type="number" min="0" step="0.01" required></div>
      <div class="field"><label>Reason</label><select id="lineReason"><option>Customer Service</option><option>Damaged Packaging</option><option>Price Match</option><option>Promotion</option><option>Manager Override</option><option>Other</option></select></div>
      <div class="modal-actions"><button id="clearLineAdj" class="secondary-btn" type="button">Clear Adjustment</button><button class="primary-btn" type="submit">Apply</button></div>
    </form>`);
    $("lineForm").addEventListener("submit",e=>{e.preventDefault();const type=$("lineAction").value,value=Number($("lineValue").value||0),reason=$("lineReason").value;line.adjustment={type,value,reason,label:type==="price"?`Price ${money(value)}`:type==="percent"?`${value}% off`:`${money(value)} off`};renderCart();closeModal();});
    $("clearLineAdj").addEventListener("click",()=>{line.adjustment=null;renderCart();closeModal();});
  }

  function openTransactionDiscount(){
    openModal("Discount",`<div class="discount-options">
      <button class="discount-option" data-disc="employee" type="button"><strong>Employee Discount</strong><span>25%</span></button>
      <button class="discount-option" data-disc="percent" type="button"><strong>Miscellaneous Discount Percentage</strong><span>Enter %</span></button>
      <button class="discount-option" data-disc="dollar" type="button"><strong>Miscellaneous Discount Dollar Amount</strong><span>Enter $</span></button>
    </div>`);
  }

  function selectCustomer(c){state.customer=c;$("customerSearch").classList.add("hidden");$("customerResults").classList.add("hidden");$("selectedCustomer").classList.remove("hidden");$("selectedCustomer").innerHTML=`<div><strong>${esc(c.name)} <span class="verified">✓</span></strong><span>${esc(c.phone||c.email||"Customer")}</span></div><button id="clearCustomer" type="button">×</button>`;$("clearCustomer").addEventListener("click",()=>{state.customer=null;$("selectedCustomer").classList.add("hidden");$("customerSearch").classList.remove("hidden");$("customerSearch").value="";});}

  function openCustomerForm(){
    openModal("Add Customer",`<form id="customerForm"><div class="form-grid"><div class="field full"><label>Name *</label><input id="cfName" required></div><div class="field"><label>Email</label><input id="cfEmail" type="email"></div><div class="field"><label>Phone</label><input id="cfPhone"></div><div class="field"><label>Birth Date *</label><input id="cfDob" type="date" required></div></div><div class="helper">Birth date is required. Once entered after checking ID, the customer is treated as age verified on future visits. Email or phone is required to participate in marketing promotions.</div><div class="modal-actions"><button class="secondary-btn" type="button" data-close-modal>Cancel</button><button class="primary-btn" type="submit">Save Customer</button></div></form>`);
    $("customerForm").addEventListener("submit",e=>{e.preventDefault();const c={id:uid("cust"),name:$("cfName").value.trim(),email:$("cfEmail").value.trim(),phone:$("cfPhone").value.trim(),birthDate:$("cfDob").value,ageVerified:true,points:0,reward:0};if(!c.name||!c.birthDate)return;state.customers.push(c);saveCustomers();closeModal();selectCustomer(c);showToast("Customer added and age verified.");});
  }

  function completePayment(type){
    const t=calcTotals();if(!state.cart.length){showToast("Add an item before taking payment.");return;}
    openModal(`${type} Payment`,`<div class="payment-summary"><span>Amount Due</span><strong>${money(t.total)}</strong></div><div class="helper">Payment hardware integration will be connected in a later implementation phase.</div><div class="modal-actions"><button class="secondary-btn" type="button" data-close-modal>Cancel</button><button id="finishPay" class="primary-btn" type="button">Complete ${type} Sale</button></div>`);
    $("finishPay").addEventListener("click",()=>{state.cart=[];state.transactionDiscount=null;state.saleNote="";renderCart();closeModal();showToast("Sale completed.");});
  }

  document.addEventListener("click",e=>{
    const nav=e.target.closest(".nav-btn");if(nav){document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));nav.classList.add("active");const v=nav.dataset.view;$("saleView").classList.toggle("hidden",v!=="sale");$("inventoryView").classList.toggle("hidden",v!=="inventory");$("placeholderView").classList.toggle("hidden",v==="sale"||v==="inventory");if(v!=="sale"&&v!=="inventory")$("placeholderTitle").textContent=nav.innerText.trim();return;}
    const prod=e.target.closest("[data-product-id]");if(prod){addProductToCart(prod.dataset.productId);return;}
    const cat=e.target.closest("[data-category]");if(cat){openCategory(cat.dataset.category);return;}
    const inv=e.target.closest("[data-edit-product]");if(inv){openEditProduct(inv.dataset.editProduct);return;}
    const ca=e.target.closest("[data-cart-act]");if(ca){const i=Number(ca.dataset.i),l=state.cart[i];if(!l)return;e.stopPropagation();if(ca.dataset.cartAct==="plus")l.qty++;if(ca.dataset.cartAct==="minus"){l.qty--;if(l.qty<=0)state.cart.splice(i,1);}if(ca.dataset.cartAct==="remove")state.cart.splice(i,1);renderCart();return;}
    const line=e.target.closest(".cart-line");if(line){const l=state.cart.find(x=>x.lineId===line.dataset.lineId);if(l)openLineAdjustment(l);return;}
    if(e.target.closest("[data-close-modal]")){closeModal();return;}
    const disc=e.target.closest("[data-disc]");if(disc){const kind=disc.dataset.disc;if(kind==="employee"){state.transactionDiscount={type:"percent",value:25,label:"Employee Discount"};renderCart();closeModal();return;}const label=kind==="percent"?"Miscellaneous Discount %":"Miscellaneous Discount $";openModal(label,`<form id="miscDiscForm"><div class="field"><label>${kind==="percent"?"Percentage":"Dollar Amount"}</label><input id="miscDiscValue" type="number" min="0" step="0.01" required></div><div class="modal-actions"><button class="secondary-btn" type="button" data-close-modal>Cancel</button><button class="primary-btn" type="submit">Apply Discount</button></div></form>`);$("miscDiscForm").addEventListener("submit",ev=>{ev.preventDefault();state.transactionDiscount={type:kind,value:Number($("miscDiscValue").value||0),label};renderCart();closeModal();});return;}
  });

  $("closeCategoryBtn").addEventListener("click",()=>$("categoryResults").classList.add("hidden"));
  $("addProductBtn").addEventListener("click",openAddProduct);
  $("inventorySearch").addEventListener("input",renderInventory);$("inventoryCategoryFilter").addEventListener("change",renderInventory);$("quickPickOnly").addEventListener("change",renderInventory);
  $("discountBtn").addEventListener("click",openTransactionDiscount);
  $("clearSaleBtn").addEventListener("click",()=>{if(!state.cart.length)return;if(confirm("Clear this sale?")){state.cart=[];state.transactionDiscount=null;state.saleNote="";renderCart();}});
  $("cashBtn").addEventListener("click",()=>completePayment("Cash"));$("cardBtn").addEventListener("click",()=>completePayment("Card"));
  $("splitPaymentBtn").addEventListener("click",()=>{if(!state.cart.length){showToast("Add items before splitting payment.");return;}openModal("Split Payment",`<div class="payment-summary"><span>Total Due</span><strong>${money(calcTotals().total)}</strong></div><div class="field"><label>First Payment Amount</label><input type="number" step="0.01" min="0"></div><div class="field"><label>First Payment Type</label><select><option>Cash</option><option>Card</option></select></div><div class="helper">Second payment will automatically use the remaining balance.</div>`);});
  $("holdSaleBtn").addEventListener("click",()=>showToast("Sale held locally. Cloud hold queue will be added later."));
  $("saleNoteBtn").addEventListener("click",()=>openModal("Sale Note",`<div class="field"><label>Note</label><textarea id="saleNoteText" rows="5">${esc(state.saleNote)}</textarea></div><div class="modal-actions"><button id="saveSaleNote" class="primary-btn" type="button">Save Note</button></div>`));
  document.addEventListener("click",e=>{if(e.target.id==="saveSaleNote"){state.saleNote=$("saleNoteText").value;closeModal();showToast("Sale note saved.");}});
  $("newCustomerBtn").addEventListener("click",openCustomerForm);
  $("customerSearch").addEventListener("input",()=>{const q=$("customerSearch").value.trim().toLowerCase();if(!q){$("customerResults").classList.add("hidden");return;}const rows=state.customers.filter(c=>`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)).slice(0,8);$("customerResults").innerHTML=rows.map(c=>`<button type="button" data-customer-id="${esc(c.id)}"><strong>${esc(c.name)}</strong><span>${esc(c.phone||c.email||"")}</span></button>`).join("")||`<div class="no-results">No customers found.</div>`;$("customerResults").classList.remove("hidden");});
  $("customerResults").addEventListener("click",e=>{const b=e.target.closest("[data-customer-id]");if(!b)return;const c=state.customers.find(x=>x.id===b.dataset.customerId);if(c)selectCustomer(c);});

  updateClock();setInterval(updateClock,1000);renderAllProductViews();renderCart();
})();
