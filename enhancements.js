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
    .inventory-table .select-cell{text-align:center;width:42px}
    .inventory-table .row-select,.inventory-table .select-all{width:18px;height:18px;accent-color:var(--green);cursor:pointer}
    .bulk-inventory-bar{display:flex;align-items:center;gap:8px;margin:10px 0;padding:9px 10px;background:#fff;border:1px solid var(--border);border-radius:10px}
    .bulk-inventory-bar .bulk-count{font-size:12px;font-weight:800;color:var(--muted);margin-right:auto}
    .bulk-inventory-bar button{border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 11px;font-size:12px;font-weight:850}
    .bulk-inventory-bar .bulk-archive-btn{color:#7b5a00}
    .bulk-inventory-bar .bulk-delete-btn{color:var(--danger)}
    .bulk-inventory-bar button:disabled{opacity:.45;cursor:not-allowed}
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
    return products().find(p => !p.archived && Array.isArray(p.barcodes) && p.barcodes.some(x => String(x) === b));
  }
  function matches(query){
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    return products().filter(p => !p.archived).filter(p => {
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
  let selectedInventoryIds = new Set();

  function ensureBulkInventoryBar(){
    if (!inventoryTable || document.getElementById("bulkInventoryBar")) return;
    const wrap = inventoryTable.closest(".inventory-table-wrap");
    if (!wrap) return;
    const bar = document.createElement("div");
    bar.id = "bulkInventoryBar";
    bar.className = "bulk-inventory-bar";
    bar.innerHTML = `<span class="bulk-count" id="bulkInventoryCount">0 selected</span>
      <button class="bulk-archive-btn" id="bulkArchiveBtn" type="button" disabled>Archive Selected</button>
      <button class="bulk-delete-btn" id="bulkDeleteBtn" type="button" disabled>Delete Selected</button>`;
    wrap.parentNode.insertBefore(bar, wrap);

    document.getElementById("bulkArchiveBtn").addEventListener("click", bulkArchiveSelected);
    document.getElementById("bulkDeleteBtn").addEventListener("click", bulkDeleteSelected);
  }

  function updateBulkInventoryBar(){
    const count = selectedInventoryIds.size;
    const label = document.getElementById("bulkInventoryCount");
    const archiveBtn = document.getElementById("bulkArchiveBtn");
    const deleteBtn = document.getElementById("bulkDeleteBtn");
    if (label) label.textContent = `${count} selected`;
    if (archiveBtn) archiveBtn.disabled = count === 0;
    if (deleteBtn) deleteBtn.disabled = count === 0;
    const selectAll = inventoryTable?.querySelector(".select-all");
    const visible = [...(inventoryBody?.querySelectorAll("tr[data-edit-product]") || [])].filter(r=>r.style.display!=="none");
    if (selectAll){
      const checkedVisible = visible.filter(r=>selectedInventoryIds.has(String(r.dataset.editProduct))).length;
      selectAll.checked = visible.length > 0 && checkedVisible === visible.length;
      selectAll.indeterminate = checkedVisible > 0 && checkedVisible < visible.length;
    }
  }

  function bulkArchiveSelected(){
    const ids = [...selectedInventoryIds];
    if (!ids.length) return;
    if (!window.confirm(`Archive ${ids.length} selected inventory item${ids.length===1?"":"s"}?`)) return;
    const list = products();
    list.forEach(p=>{ if(ids.includes(String(p.id))){ p.archived = true; p.quickPick = false; } });
    saveProducts(list);
    selectedInventoryIds.clear();
    sessionStorage.setItem("sspos_return_inventory", "1");
    location.reload();
  }

  function bulkDeleteSelected(){
    const ids = [...selectedInventoryIds];
    if (!ids.length) return;
    if (!window.confirm(`Permanently delete ${ids.length} selected inventory item${ids.length===1?"":"s"}? This cannot be undone.`)) return;
    const idSet = new Set(ids);
    saveProducts(products().filter(p=>!idSet.has(String(p.id))));
    selectedInventoryIds.clear();
    sessionStorage.setItem("sspos_return_inventory", "1");
    location.reload();
  }

  function ensureInventoryHeaders(){
    if (!inventoryTable) return;
    const row = inventoryTable.querySelector("thead tr");
    if (!row) return;
    const headers = [...row.children];
    if (!row.querySelector('[data-extra-header="select"]')){
      const selectTh = document.createElement("th");
      selectTh.dataset.extraHeader = "select";
      selectTh.className = "select-cell";
      selectTh.innerHTML = '<input class="select-all" type="checkbox" aria-label="Select all visible inventory items">';
      row.insertBefore(selectTh, row.firstChild);
      selectTh.querySelector(".select-all").addEventListener("click", e=>{
        e.stopPropagation();
        const checked = e.currentTarget.checked;
        [...inventoryBody.querySelectorAll("tr[data-edit-product]")].forEach(r=>{
          if (r.style.display === "none") return;
          const id = String(r.dataset.editProduct);
          if (checked) selectedInventoryIds.add(id); else selectedInventoryIds.delete(id);
          const box = r.querySelector(".row-select"); if (box) box.checked = checked;
        });
        updateBulkInventoryBar();
      });
    }
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
      if (p.archived){ row.style.display = "none"; return; }
      row.style.display = "";

      if (!row.querySelector('[data-extra-cell="select"]')){
        const td = document.createElement("td");
        td.dataset.extraCell = "select";
        td.className = "select-cell";
        td.innerHTML = `<input class="row-select" type="checkbox" ${selectedInventoryIds.has(id)?"checked":""} aria-label="Select ${esc(p.name)}">`;
        row.insertBefore(td, row.firstChild);
      }

      if (!row.querySelector('[data-extra-cell="barcode"]')){
        const td = document.createElement("td");
        td.dataset.extraCell = "barcode";
        td.className = "barcode-col";
        td.innerHTML = (p.barcodes || []).length
          ? `<div class="barcode-list">${p.barcodes.map(b=>`<span>${esc(b)}</span>`).join("")}</div>`
          : `<span class="muted">No barcode</span>`;
        const originalCostCell = row.children[4];
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
    ensureBulkInventoryBar();
    updateBulkInventoryBar();
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
    const rowSelect = e.target.closest(".row-select");
    if (rowSelect){
      e.preventDefault();
      e.stopPropagation();
      const row = rowSelect.closest("tr[data-edit-product]");
      const id = String(row.dataset.editProduct);
      if (rowSelect.checked) selectedInventoryIds.add(id); else selectedInventoryIds.delete(id);
      rowSelect.checked = selectedInventoryIds.has(id);
      updateBulkInventoryBar();
      return;
    }
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

  function removeArchivedProductTiles(){
    const archived = new Set(products().filter(p=>p.archived).map(p=>String(p.id)));
    if (!archived.size) return;
    document.querySelectorAll("[data-product-id]").forEach(el=>{ if(archived.has(String(el.dataset.productId))) el.remove(); });
  }

  if (inventoryBody){
    const observer = new MutationObserver(()=>enhanceInventoryRows());
    observer.observe(inventoryBody, {childList:true});
    enhanceInventoryRows();
  }

  const productObserver = new MutationObserver(removeArchivedProductTiles);
  productObserver.observe(document.body, {childList:true,subtree:true});
  removeArchivedProductTiles();

  if (sessionStorage.getItem("sspos_return_inventory") === "1"){
    sessionStorage.removeItem("sspos_return_inventory");
    setTimeout(()=>{
      document.querySelector('.nav-btn[data-view="inventory"]')?.click();
    }, 0);
  }

  setTimeout(()=>searchInput.focus(), 0);
})();