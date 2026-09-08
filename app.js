
(() => {
  "use strict";

  const TAX_RATE = 0.0825;
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
    const taxable=Math.max(0,subtotal-disc),tax=taxable*TAX_RATE;
    return {subtotal,disc,tax,total:taxable+tax};
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
    $("taxValue").textContent=money(t.tax);$("totalValue").textContent=money(t.total);
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
      saveProducts();renderAllProductViews();closeModal();showToast("Inventory item updated.");
    });
    $("receiveStockBtn").addEventListener("click",()=>openReceiveInventory(p.id));
    $("adjustStockBtn").addEventListener("click",()=>openAdjustInventory(p.id));
  }

  function addMovement(productId,delta,reason,note){
    state.movements.unshift({id:uid("move"),productId,delta,reason,note:note||"",timestamp:new Date().toISOString(),employee:"Owner"});
    saveMovements();
  }

  function renderMovementHistory(productId){
    const host=$("movementHistory");if(!host)return;
    const list=state.movements.filter(m=>m.productId===productId).slice(0,15);
    host.innerHTML=`<div class="section-head" style="margin-bottom:6px"><h2>Inventory History</h2></div><div class="history-list">${list.length?list.map(m=>`<div class="history-item"><div><strong>${m.delta>0?"+":""}${m.delta}</strong> ${esc(m.reason)}<br><span>${esc(m.note||"")}</span></div><span>${new Date(m.timestamp).toLocaleString()}</span></div>`).join(""):`<div class="muted">No inventory movements recorded yet.</div>`}</div>`;
  }

  function openReceiveInventory(productId){
    const p=state.products.find(x=>x.id===productId);if(!p)return;
    openModal("Add Received Inventory",`<form id="receiveForm"><div class="form-grid">
      <div class="field"><label>Product</label><input value="${esc(p.name)}" disabled></div>
      <div class="field"><label>Quantity Received *</label><input id="receiveQty" type="number" min="1" step="1" required></div>
      <div class="field"><label>Unit Cost</label><input id="receiveCost" type="number" min="0" step="0.01" value="${Number(p.cost||0).toFixed(2)}"></div>
      <div class="field"><label>Supplier</label><input id="receiveSupplier" value="${esc(p.supplier==="None"?"":p.supplier)}"></div>
      <div class="field full"><label>PO / Reference / Note</label><input id="receiveNote"></div>
    </div><div class="modal-actions"><button class="secondary-btn" data-close-modal type="button">Cancel</button><button class="primary-btn" type="submit">Add Inventory</button></div></form>`);
    $("receiveForm").addEventListener("submit",e=>{
      e.preventDefault();const qty=Math.max(1,Math.floor(Number($("receiveQty").value||0)));p.inventory=Number(p.inventory||0)+qty;
      const cost=Number($("receiveCost").value||0);if(Number.isFinite(cost)&&cost>=0)p.cost=cost;
      const sup=$("receiveSupplier").value.trim();if(sup)p.supplier=sup;
      addMovement(p.id,qty,"Received Inventory",$("receiveNote").value.trim());saveProducts();renderAllProductViews();closeModal();showToast(`${qty} added to ${p.name}.`);
    });
  }

  function openAdjustInventory(productId){
    const p=state.products.find(x=>x.id===productId);if(!p)return;
    openModal("Adjust Inventory Count",`<form id="adjustForm"><div class="form-grid">
      <div class="field"><label>Current Count</label><input value="${Number(p.inventory||0)}" disabled></div>
      <div class="field"><label>New Count *</label><input id="newCount" type="number" min="0" step="1" required value="${Number(p.inventory||0)}"></div>
      <div class="field full"><label>Reason *</label><select id="adjustReason" required><option value="">Select reason</option><option>Physical Count Correction</option><option>Damaged</option><option>Missing / Shrink</option><option>Expired / Discarded</option><option>Return to Vendor</option><option>Other</option></select></div>
      <div class="field full"><label>Note</label><textarea id="adjustNote" rows="3"></textarea></div>
    </div><div class="modal-actions"><button class="secondary-btn" data-close-modal type="button">Cancel</button><button class="primary-btn" type="submit">Save Count</button></div></form>`);
    $("adjustForm").addEventListener("submit",e=>{
      e.preventDefault();const next=Math.max(0,Math.floor(Number($("newCount").value||0))),old=Number(p.inventory||0),delta=next-old,reason=$("adjustReason").value;if(!reason)return;
      p.inventory=next;addMovement(p.id,delta,reason,$("adjustNote").value.trim());saveProducts();renderAllProductViews();closeModal();showToast(`Inventory count set to ${next}.`);
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

  function openLineEditor(lineId){
    const l=state.cart.find(x=>x.lineId===lineId);if(!l)return;
    openModal("Edit Line Item",`<form id="lineEditForm"><div class="muted">${esc(l.name)} • Original price ${money(l.price)}</div><div class="form-grid" style="margin-top:12px">
      <div class="field"><label>Change price to</label><input id="linePrice" type="number" min="0" step="0.01"></div>
      <div class="field"><label>Discount type</label><select id="lineDiscountType"><option value="">None</option><option value="percent">Percentage</option><option value="dollar">Dollar amount</option></select></div>
      <div class="field"><label>Discount value</label><input id="lineDiscountValue" type="number" min="0" step="0.01"></div>
      <div class="field"><label>Reason *</label><select id="lineReason" required><option value="">Select reason</option><option>Damaged Item</option><option>Manager Discount</option><option>Price Match</option><option>Promotion</option><option>Customer Courtesy</option><option>Clearance</option><option>Employee Discount</option><option>Other</option></select></div>
      <div class="field full"><label>Note</label><textarea id="lineNote" rows="3"></textarea></div>
    </div><div class="modal-actions"><button id="clearLineAdj" class="secondary-btn" type="button">Remove Adjustment</button><button class="secondary-btn" data-close-modal type="button">Cancel</button><button class="primary-btn" type="submit">Apply</button></div></form>`);
    if(l.adjustment){$("lineReason").value=l.adjustment.reason||"";$("lineNote").value=l.adjustment.note||"";if(l.adjustment.type==="price")$("linePrice").value=l.adjustment.value;else{$("lineDiscountType").value=l.adjustment.type;$("lineDiscountValue").value=l.adjustment.value;}}
    $("clearLineAdj").addEventListener("click",()=>{l.adjustment=null;renderCart();closeModal();});
    $("lineEditForm").addEventListener("submit",e=>{
      e.preventDefault();const reason=$("lineReason").value;if(!reason)return;const price=$("linePrice").value.trim(),type=$("lineDiscountType").value,val=Number($("lineDiscountValue").value||0),note=$("lineNote").value.trim();
      if(price!==""){const v=Math.max(0,Number(price));l.adjustment={type:"price",value:v,reason,note,label:`Price ${money(v)}`};}
      else if(type&&val>0){const v=type==="percent"?clamp(val,0,100):Math.max(0,val);l.adjustment={type,value:v,reason,note,label:type==="percent"?`${v}% off`:`${money(v)} off`};}
      else l.adjustment=null;renderCart();closeModal();
    });
  }

  function openDiscountMenu(){
    openModal("Discount",`<div class="choice-list">
      <button class="choice-btn" data-discount-choice="employee" type="button"><strong>Employee Discount</strong><span>Standard 25% off the transaction.</span></button>
      <button class="choice-btn" data-discount-choice="percent" type="button"><strong>Miscellaneous Discount Percentage</strong><span>Enter a custom percentage.</span></button>
      <button class="choice-btn" data-discount-choice="dollar" type="button"><strong>Miscellaneous Discount Dollar Amount</strong><span>Enter a custom dollar amount.</span></button>
    </div>${state.transactionDiscount?`<div class="modal-actions"><button id="removeTxnDiscount" class="secondary-btn" type="button">Remove Current Discount</button></div>`:""}`);
    document.querySelectorAll("[data-discount-choice]").forEach(b=>b.addEventListener("click",()=>{
      const choice=b.dataset.discountChoice;if(choice==="employee"){state.transactionDiscount={type:"percent",value:25,label:"Employee Discount (25%)"};renderCart();closeModal();return;}
      openMiscDiscount(choice);
    }));
    $("removeTxnDiscount")?.addEventListener("click",()=>{state.transactionDiscount=null;renderCart();closeModal();});
  }

  function openMiscDiscount(type){
    const pct=type==="percent";
    openModal(pct?"Miscellaneous Discount Percentage":"Miscellaneous Discount Dollar Amount",`<form id="miscDiscountForm"><div class="field"><label>${pct?"Percentage":"Dollar amount"}</label><input id="miscVal" type="number" min="0" ${pct?'max="100"':""} step="0.01" required></div><div class="modal-actions"><button class="secondary-btn" data-close-modal type="button">Cancel</button><button class="primary-btn" type="submit">Apply</button></div></form>`);
    $("miscDiscountForm").addEventListener("submit",e=>{e.preventDefault();let v=Number($("miscVal").value||0);if(v<=0)return;if(pct)v=clamp(v,0,100);state.transactionDiscount={type,value:v,label:pct?`Misc. Discount (${v}%)`:`Misc. Discount (${money(v)})`};renderCart();closeModal();});
  }

  function openNewCustomer(){
    openModal("New Customer",`<form id="customerForm"><div class="form-grid">
      <div class="field"><label>Name *</label><input id="cfName" required></div><div class="field"><label>Birth Date *</label><input id="cfDob" type="date" required></div>
      <div class="field"><label>Phone</label><input id="cfPhone" type="tel"></div><div class="field"><label>Email</label><input id="cfEmail" type="email"></div>
    </div><p class="muted">Phone and email are optional. Without at least one, the customer is not eligible for electronic marketing. Saving the record confirms the first ID check and marks age verification OK for future sales.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal type="button">Cancel</button><button class="primary-btn" type="submit">Save Customer</button></div></form>`);
    $("customerForm").addEventListener("submit",e=>{e.preventDefault();const c={id:uid("cust"),name:$("cfName").value.trim(),birthDate:$("cfDob").value,phone:$("cfPhone").value.trim(),email:$("cfEmail").value.trim(),ageVerified:true,points:0,reward:0};if(!c.name||!c.birthDate)return;state.customers.push(c);saveCustomers();state.customer=c;renderCustomer();closeModal();});
  }

  function renderCustomer(){
    const c=state.customer;if(!c){$("selectedCustomer").classList.add("hidden");return;}
    $("selectedCustomer").classList.remove("hidden");$("selectedCustomer").innerHTML=`<div><strong>${esc(c.name)} <span class="verified">✓</span></strong><div class="verified">✓ Age Verified</div></div><div class="loyalty"><strong>${c.points||0} pts</strong><br>${c.reward?`${money(c.reward)} Reward`:"No reward"}</div>`;
  }

  function searchCustomers(q){
    q=q.trim().toLowerCase();if(!q){$("customerResults").classList.add("hidden");return;}
    const list=state.customers.filter(c=>`${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(q)).slice(0,8);
    $("customerResults").innerHTML=list.map(c=>`<button class="customer-result" data-customer-id="${esc(c.id)}" type="button"><strong>${esc(c.name)} ${c.ageVerified?"✓":""}</strong><br><span class="muted">${esc(c.phone||c.email||"No marketing contact")}</span></button>`).join("")||`<div class="customer-result">No matches.</div>`;
    $("customerResults").classList.remove("hidden");
  }

  function openSplitPayment(){
    const t=calcTotals();if(t.total<=0){showToast("Add items first.");return;}
    openModal("Split Payment",`<form id="splitForm"><div class="form-grid"><div class="field"><label>First payment amount</label><input id="splitAmount" type="number" min="0" max="${t.total.toFixed(2)}" step="0.01" required></div><div class="field"><label>First payment type</label><select id="splitType"><option>Cash</option><option>Card</option></select></div></div><div class="stock-card" style="margin-top:10px"><div>Total due <strong style="float:right">${money(t.total)}</strong></div><div style="margin-top:7px">Remaining <strong id="splitRemain" style="float:right">${money(t.total)}</strong></div></div><div class="modal-actions"><button class="secondary-btn" data-close-modal type="button">Cancel</button><button class="primary-btn" type="submit">Continue</button></div></form>`);
    $("splitAmount").addEventListener("input",()=>{const a=clamp(Number($("splitAmount").value||0),0,t.total);$("splitRemain").textContent=money(t.total-a);});
    $("splitForm").addEventListener("submit",e=>{e.preventDefault();const a=clamp(Number($("splitAmount").value||0),0,t.total);if(a<=0||a>=t.total){showToast("Enter an amount between $0 and the total.");return;}closeModal();showToast(`${$("splitType").value} ${money(a)} + remaining ${money(t.total-a)} ready.`);});
  }

  function completeSale(method){
    const t=calcTotals();if(!state.cart.length){showToast("Add items first.");return;}
    // Prototype inventory decrement for tracked stock greater than zero.
    state.cart.forEach(line=>{const p=state.products.find(x=>x.id===line.productId);if(p&&Number(p.inventory||0)>0){const dec=Math.min(line.qty,p.inventory);p.inventory-=dec;if(dec)addMovement(p.id,-dec,"Sale",method);}});
    saveProducts();state.cart=[];state.transactionDiscount=null;state.saleNote="";state.customer=null;renderCustomer();renderCart();renderInventory();showToast(`${method} sale ${money(t.total)} completed (prototype).`);
  }

  function switchView(view){
    document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
    $("saleView").classList.add("hidden");$("inventoryView").classList.add("hidden");$("placeholderView").classList.add("hidden");
    // Cart remains visible for every module on desktop, matching the permanent transaction panel design.
    if(view==="sale")$("saleView").classList.remove("hidden");
    else if(view==="inventory"){$("inventoryView").classList.remove("hidden");renderInventory();}
    else{$("placeholderTitle").textContent=document.querySelector(`.nav-btn[data-view="${CSS.escape(view)}"] span`)?.textContent||"Module";$("placeholderView").classList.remove("hidden");}
  }

  document.addEventListener("click",e=>{
    const nav=e.target.closest(".nav-btn");if(nav){switchView(nav.dataset.view);return;}
    const prod=e.target.closest("[data-product-id]");if(prod){addProductToCart(prod.dataset.productId);return;}
    const cat=e.target.closest("[data-category]");if(cat){openCategory(cat.dataset.category);return;}
    const inv=e.target.closest("[data-edit-product]");if(inv){openEditProduct(inv.dataset.editProduct);return;}
    const customer=e.target.closest("[data-customer-id]");if(customer){state.customer=state.customers.find(c=>c.id===customer.dataset.customerId)||null;renderCustomer();$("customerResults").classList.add("hidden");$("customerSearch").value="";return;}
    const act=e.target.closest("[data-cart-act]");if(act){e.stopPropagation();const i=Number(act.dataset.i),l=state.cart[i];if(!l)return;if(act.dataset.cartAct==="plus")l.qty++;if(act.dataset.cartAct==="minus"){l.qty--;if(l.qty<=0)state.cart.splice(i,1);}if(act.dataset.cartAct==="remove")state.cart.splice(i,1);renderCart();return;}
    const line=e.target.closest(".cart-line");if(line){openLineEditor(line.dataset.lineId);return;}
    if(e.target.closest("[data-close-modal]")||e.target===$("modalBackdrop"))closeModal();
  });

  $("productSearch").addEventListener("keydown",e=>{
    if(e.key!=="Enter")return;e.preventDefault();const q=e.currentTarget.value.trim();if(!q)return;
    const exact=findBarcode(q);if(exact){addProductToCart(exact.id);e.currentTarget.value="";return;}
    const match=state.products.find(p=>`${p.name} ${p.category} ${p.supplier}`.toLowerCase().includes(q.toLowerCase()));
    if(match){addProductToCart(match.id);e.currentTarget.value="";}else showToast("No matching product or barcode.");
  });

  $("closeCategoryBtn").addEventListener("click",()=>$("categoryResults").classList.add("hidden"));
  $("inventorySearch").addEventListener("input",renderInventory);
  $("inventoryCategoryFilter").addEventListener("change",renderInventory);
  $("quickPickOnly").addEventListener("change",renderInventory);
  $("addProductBtn").addEventListener("click",openAddProduct);
  $("customerSearch").addEventListener("input",e=>searchCustomers(e.currentTarget.value));
  $("newCustomerBtn").addEventListener("click",openNewCustomer);
  $("discountBtn").addEventListener("click",openDiscountMenu);
  $("splitPaymentBtn").addEventListener("click",openSplitPayment);
  $("cashBtn").addEventListener("click",()=>completeSale("Cash"));
  $("cardBtn").addEventListener("click",()=>completeSale("Card"));
  $("clearSaleBtn").addEventListener("click",()=>{if(!state.cart.length||confirm("Clear current sale?")){state.cart=[];state.transactionDiscount=null;renderCart();}});
  $("holdSaleBtn").addEventListener("click",()=>showToast("Hold Sale is reserved for the next transaction-storage batch."));
  $("saleNoteBtn").addEventListener("click",()=>{openModal("Sale Note",`<div class="field"><label>Note</label><textarea id="saleNoteText" rows="5">${esc(state.saleNote)}</textarea></div><div class="modal-actions"><button class="secondary-btn" data-close-modal type="button">Cancel</button><button id="saveSaleNote" class="primary-btn" type="button">Save</button></div>`);$("saveSaleNote").addEventListener("click",()=>{state.saleNote=$("saleNoteText").value.trim();closeModal();});});

  renderAllProductViews();renderCart();renderCustomer();updateClock();setInterval(updateClock,30000);
})();
