(() => {
  "use strict";

  const PRODUCT_STORAGE_KEY = "sspos_products_v2";
  const MAX_QUICK_PICKS = 12;
  const searchInput = document.getElementById("productSearch");
  const searchbar = document.querySelector(".searchbar");
  const toast = document.getElementById("toast");
  if (!searchInput || !searchbar) return;

  const style = document.createElement("style");
  style.textContent = `
    .searchbar{position:sticky}
    .product-search-results{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:30;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:0 14px 34px rgba(0,0,0,.13);max-height:420px;overflow:auto}
    .product-search-result{width:100%;border:0;border-bottom:1px solid var(--border);background:#fff;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;gap:14px;text-align:left}
    .product-search-result:last-child{border-bottom:0}
    .product-search-result:hover,.product-search-result:focus{background:#f2f7f1;outline:none}
    .product-search-result span{font-size:15px;font-weight:850;line-height:1.2}
    .product-search-result strong{white-space:nowrap;font-size:14px}
    .product-search-empty{padding:13px;color:var(--muted);font-size:13px}
    .inventory-table .barcode-col{min-width:150px;max-width:240px}
    .inventory-table .barcode-list{font-size:11px;line-height:1.3;word-break:break-word}
    .inventory-table .barcode-list span{display:block;white-space:nowrap}
    .inventory-table .home-cell{text-align:center}
    .inventory-table .home-checkbox{width:18px;height:18px;accent-color:var(--green);cursor:pointer}
    .inventory-table .delete-cell{text-align:center;width:42px}
    .inventory-table .delete-item-btn{border:0;background:transparent;color:#b72b2b;font-size:20px;line-height:1;padding:4px 7px;border-radius:6px}
    .inventory-table .delete-item-btn:hover{background:#fff0f0}
  `;
  document.head.appendChild(style);

  function money(n){ return `$${Number(n || 0).toFixed(2)}`; }
  function esc(s){ return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
  function products(){
    try{
      const raw = localStorage.getItem(PRODUCT_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }catch{}
    return Array.isArray(window.SMOKE_SIGNALS_IMPORTED_PRODUCTS) ? window.SMOKE_SIGNALS_IMPORTED_PRODUCTS : [];
  }
  function saveProducts(list){
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(list));
  }
  function showMessage(message){
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(showMessage.timer);
    showMessage.timer = setTimeout(()=>toast.classList.add("hidden"), 2400);
  }
  function findBarcode(barcode){
    const b = String(barcode || "").trim();
    return products().find(p => Array.isArray(p.barcodes) && p.barcodes.some(x => String(x) === b));
  }
  function matches(query){
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return products().filter(p => {
      const name = String(p.name || "").toLowerCase();
      const category = String(p.category || "").toLowerCase();
      const supplier = String(p.supplier || "").toLowerCase();
      const barcodeMatch = (p.barcodes || []).some(b => String(b).toLowerCase().includes(q));
      return name.includes(q) || category.includes(q) || supplier.includes(q) || barcodeMatch;
    }).sort((a,b) => {
      const an = String(a.name || "").toLowerCase();
      const bn = String(b.name || "").toLowerCase();
      const ap = an.startsWith(q) ? 0 : 1;
      const bp = bn.startsWith(q) ? 0 : 1;
      return ap - bp || an.localeCompare(bn);
    }).slice(0,12);
  }

  let resultHost = document.getElementById("productSearchResults");
  if (!resultHost){
    resultHost = document.createElement("div");
    resultHost.id = "productSearchResults";
    resultHost.className = "product-search-results hidden";
    searchbar.appendChild(resultHost);
  }

  function renderResults(){
    const q = searchInput.value.trim();
    if (!q){ resultHost.classList.add("hidden"); resultHost.innerHTML = ""; return; }
    const list = matches(q);
    resultHost.innerHTML = list.length
      ? list.map(p => `<button class="product-search-result" type="button" data-search-product-id="${esc(p.id)}"><span>${esc(p.name)}</span><strong>${money(p.price)}</strong></button>`).join("")
      : `<div class="product-search-empty">No matching products.</div>`;
    resultHost.classList.remove("hidden");
  }

  function addExactProduct(product){
    if (!product) return false;
    const temp = document.createElement("button");
    temp.type = "button";
    temp.dataset.productId = product.id;
    temp.style.display = "none";
    document.body.appendChild(temp);
    temp.click();
    temp.remove();
    return true;
  }

  function finishScan(barcode){
    const product = findBarcode(barcode);
    if (product){
      addExactProduct(product);
      searchInput.value = "";
      resultHost.classList.add("hidden");
      showMessage(`${product.name} added.`);
    } else {
      showMessage("Item not found.");
    }
    setTimeout(()=>searchInput.focus(), 0);
  }

  searchInput.addEventListener("input", renderResults);
  searchInput.addEventListener("focus", renderResults);
  resultHost.addEventListener("click", e => {
    const btn = e.target.closest("[data-search-product-id]");
    if (!btn) return;
    const product = products().find(p => String(p.id) === String(btn.dataset.searchProductId));
    if (product) addExactProduct(product);
    searchInput.value = "";
    resultHost.classList.add("hidden");
    searchInput.focus();
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".searchbar")) resultHost.classList.add("hidden");
  });

  const scanner = {
    buffer: "",
    startedAt: 0,
    lastAt: 0,
    active: false,
    target: null,
    originalValue: "",
    originalStart: null,
    originalEnd: null,
    resetTimer: null
  };

  function resetScanner(){
    scanner.buffer = "";
    scanner.startedAt = 0;
    scanner.lastAt = 0;
    scanner.active = false;
    scanner.target = null;
    scanner.originalValue = "";
    scanner.originalStart = null;
    scanner.originalEnd = null;
    clearTimeout(scanner.resetTimer);
  }

  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const target = e.target;
    if (target && target.id === "barcodeEntry") return;
    const tag = String(target?.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "select" || target?.isContentEditable) return;

    const now = performance.now();

    if (e.key === "Enter"){
      const elapsed = scanner.startedAt ? now - scanner.startedAt : Infinity;
      const looksLikeScan = scanner.buffer.length >= 4 && elapsed <= 1600 && (scanner.active || scanner.buffer.length >= 8);
      if (looksLikeScan){
        e.preventDefault();
        e.stopImmediatePropagation();
        const code = scanner.buffer;
        resetScanner();
        finishScan(code);
      }
      return;
    }

    if (e.key.length !== 1) return;

    const gap = scanner.lastAt ? now - scanner.lastAt : 0;
    if (!scanner.startedAt || gap > 160){
      resetScanner();
      scanner.startedAt = now;
      scanner.target = target;
      if (target && typeof target.value === "string"){
        scanner.originalValue = target.value;
        scanner.originalStart = target.selectionStart;
        scanner.originalEnd = target.selectionEnd;
      }
    }

    scanner.buffer += e.key;

    if (!scanner.active && scanner.buffer.length >= 2 && gap > 0 && gap <= 80){
      scanner.active = true;
      if (scanner.target && scanner.target !== searchInput && typeof scanner.target.value === "string"){
        scanner.target.value = scanner.originalValue;
        try{ scanner.target.setSelectionRange(scanner.originalStart, scanner.originalEnd); }catch{}
      }
    }

    if (scanner.active && target !== searchInput){
      e.preventDefault();
      e.stopImmediatePropagation();
    }

    scanner.lastAt = now;
    clearTimeout(scanner.resetTimer);
    scanner.resetTimer = setTimeout(resetScanner, 220);
  }, true);

  const inventoryTable = document.querySelector(".inventory-table");
  const inventoryBody = document.getElementById("inventoryTableBody");

  function ensureInventoryHeaders(){
    if (!inventoryTable) return;
    const row = inventoryTable.querySelector("thead tr");
    if (!row) return;
    const headers = [...row.children];
    if (!row.querySelector('[data-extra-header="barcode"]')){
      const barcodeTh = document.createElement("th");
      barcodeTh.textContent = "Barcode(s)";
      barcodeTh.dataset.extraHeader = "barcode";
      const costTh = headers.find(th => th.textContent.trim().toLowerCase() === "cost");
      row.insertBefore(barcodeTh, costTh || null);
    }
    if (!row.querySelector('[data-extra-header="delete"]')){
      const deleteTh = document.createElement("th");
      deleteTh.textContent = "";
      deleteTh.dataset.extraHeader = "delete";
      row.appendChild(deleteTh);
    }
  }

  function enhanceInventoryRows(){
    if (!inventoryBody) return;
    ensureInventoryHeaders();
    const list = products();
    const byId = new Map(list.map(p => [String(p.id), p]));

    inventoryBody.querySelectorAll("tr[data-edit-product]").forEach(row => {
      const id = String(row.dataset.editProduct);
      const p = byId.get(id);
      if (!p) return;

      if (!row.querySelector('[data-extra-cell="barcode"]')){
        const td = document.createElement("td");
        td.dataset.extraCell = "barcode";
        td.className = "barcode-col";
        td.innerHTML = (p.barcodes || []).length
          ? `<div class="barcode-list">${p.barcodes.map(b=>`<span>${esc(b)}</span>`).join("")}</div>`
          : `<span class="muted">No barcode</span>`;
        const originalCostCell = row.children[3];
        row.insertBefore(td, originalCostCell || null);
      }

      const cells = row.children;
      const homeCell = cells[cells.length - 1];
      if (homeCell && !homeCell.querySelector(".home-checkbox") && !homeCell.dataset.extraCell){
        homeCell.classList.add("home-cell");
        homeCell.innerHTML = `<input class="home-checkbox" type="checkbox" ${p.quickPick ? "checked" : ""} aria-label="Add ${esc(p.name)} to home screen">`;
      }

      if (!row.querySelector('[data-extra-cell="delete"]')){
        const del = document.createElement("td");
        del.dataset.extraCell = "delete";
        del.className = "delete-cell";
        del.innerHTML = `<button class="delete-item-btn" type="button" aria-label="Delete ${esc(p.name)}" title="Delete item">×</button>`;
        row.appendChild(del);
      }
    });
  }

  function toggleQuickPick(row, checked){
    const id = String(row.dataset.editProduct);
    const list = products();
    const p = list.find(x => String(x.id) === id);
    if (!p) return;

    const currentCount = list.filter(x => x.quickPick).length;
    if (checked && !p.quickPick && currentCount >= MAX_QUICK_PICKS){
      const box = row.querySelector(".home-checkbox");
      if (box) box.checked = false;
      showMessage("Home screen is full. Remove another item before adding a new one.");
      return;
    }

    row.click();
    const modalBox = document.getElementById("pfQuickPick");
    const form = document.getElementById("productForm");
    if (modalBox && form){
      modalBox.checked = checked;
      if (typeof form.requestSubmit === "function") form.requestSubmit();
      else form.dispatchEvent(new Event("submit", {bubbles:true,cancelable:true}));
      showMessage(checked ? `${p.name} added to Home Screen.` : `${p.name} removed from Home Screen.`);
    }
  }

  function deleteInventoryItem(row){
    const id = String(row.dataset.editProduct);
    const list = products();
    const p = list.find(x => String(x.id) === id);
    if (!p) return;
    if (!window.confirm(`Delete "${p.name}" from inventory?`)) return;

    const next = list.filter(x => String(x.id) !== id);
    saveProducts(next);
    sessionStorage.setItem("sspos_return_inventory", "1");
    location.reload();
  }

  inventoryBody?.addEventListener("click", e => {
    const checkbox = e.target.closest(".home-checkbox");
    if (checkbox){
      e.preventDefault();
      e.stopPropagation();
      const row = checkbox.closest("tr[data-edit-product]");
      toggleQuickPick(row, checkbox.checked);
      return;
    }
    const del = e.target.closest(".delete-item-btn");
    if (del){
      e.preventDefault();
      e.stopPropagation();
      const row = del.closest("tr[data-edit-product]");
      deleteInventoryItem(row);
    }
  }, true);

  if (inventoryBody){
    const observer = new MutationObserver(()=>enhanceInventoryRows());
    observer.observe(inventoryBody, {childList:true});
    enhanceInventoryRows();
  }

  if (sessionStorage.getItem("sspos_return_inventory") === "1"){
    sessionStorage.removeItem("sspos_return_inventory");
    setTimeout(()=>{
      document.querySelector('.nav-btn[data-view="inventory"]')?.click();
    }, 0);
  }

  setTimeout(()=>searchInput.focus(), 0);
})();