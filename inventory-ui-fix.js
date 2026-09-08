(() => {
  "use strict";

  const PRODUCT_STORAGE_KEY = "sspos_products_v2";
  const inventoryBody = document.getElementById("inventoryTableBody");
  const inventoryTable = document.querySelector(".inventory-table");
  if (!inventoryBody || !inventoryTable) return;

  const selected = new Set();
  const bar = document.createElement("div");
  bar.id = "bulkInventoryBar";
  bar.className = "bulk-inventory-bar";
  bar.setAttribute("role", "region");
  bar.setAttribute("aria-label", "Inventory bulk actions");
  bar.innerHTML = '<span class="bulk-count" id="bulkInventoryCount" aria-live="polite">0 selected</span><button class="bulk-archive-btn" id="bulkArchiveBtn" type="button" disabled>Archive Selected</button><button class="bulk-delete-btn" id="bulkDeleteBtn" type="button" disabled>Delete Selected</button>';
  const slot = document.createElement("div");
  slot.className = "inventory-bulk-slot";
  inventoryTable.closest(".inventory-table-wrap").before(slot);
  slot.appendChild(bar);

  // One real toolbar, positioned against the viewport. The slot reserves its
  // normal height so selecting a row cannot move the table under the pointer.
  const main = document.querySelector(".main");
  function sizeToolbar(){
    const rect = slot.getBoundingClientRect();
    bar.style.setProperty("--bulk-left", rect.left + "px");
    bar.style.setProperty("--bulk-width", rect.width + "px");
    slot.style.minHeight = bar.getBoundingClientRect().height + "px";
  }
  new ResizeObserver(sizeToolbar).observe(main);
  new ResizeObserver(sizeToolbar).observe(bar);
  window.addEventListener("resize", sizeToolbar, {passive:true});

  try { sessionStorage.removeItem("sspos_return_inventory"); } catch (_) {}

  const style = document.createElement("style");
  style.textContent = `
    .inventory-bulk-slot { margin:10px 0; }
    #bulkInventoryBar { margin:0; flex-wrap:wrap; }
    #bulkInventoryBar.has-selection {
      position:fixed; top:8px; left:var(--bulk-left); width:var(--bulk-width);
      z-index:25; box-shadow:0 6px 18px rgba(0,0,0,.16);
    }
    .inventory-table .row-select,
    .inventory-table .select-all {
      appearance:none !important;
      -webkit-appearance:none !important;
      width:18px !important;
      height:18px !important;
      border:2px solid #7c8b82 !important;
      border-radius:4px !important;
      background:#fff !important;
      display:inline-block !important;
      cursor:pointer !important;
      vertical-align:middle !important;
      background-position:center !important;
      background-repeat:no-repeat !important;
      background-size:13px 13px !important;
    }
    .inventory-table .row-select[data-force-selected="true"],
    .inventory-table .select-all[data-force-selected="true"] {
      background-color:#267b22 !important;
      border-color:#267b22 !important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='white' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round' d='M3 8.5 6.5 12 13 4.5'/%3E%3C/svg%3E") !important;
    }
    .inventory-table .select-all[data-force-indeterminate="true"] {
      background-color:#267b22 !important;
      border-color:#267b22 !important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='white' stroke-width='2.6' stroke-linecap='round' d='M3 8h10'/%3E%3C/svg%3E") !important;
    }
  `;
  document.head.appendChild(style);

  function getProducts(){
    try{
      const raw = localStorage.getItem(PRODUCT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch{
      return [];
    }
  }

  function saveProducts(list){
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(list));
  }

  function visibleRows(){
    return [...inventoryBody.querySelectorAll('tr[data-edit-product]')].filter(row => row.style.display !== "none");
  }

  function paintCheckbox(box, checked){
    if(!box) return;
    box.checked = !!checked;
    box.dataset.forceSelected = checked ? "true" : "false";
    box.setAttribute("aria-checked", checked ? "true" : "false");
  }

  function updateSelectionUI(){
    const rows = visibleRows();
    const checkedRows = rows.filter(row => row.querySelector('.row-select')?.checked);
    const count = checkedRows.length;
    bar.classList.toggle("has-selection", count > 0);
    sizeToolbar();

    ["bulkInventoryCount"].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.textContent = `${count} selected`;
    });
    ["bulkArchiveBtn","bulkDeleteBtn"].forEach(id=>{
      const el = document.getElementById(id);
      if(el) el.disabled = count === 0;
    });

    const all = inventoryTable.querySelector('.select-all');
    if(all){
      const allChecked = rows.length > 0 && count === rows.length;
      const partial = count > 0 && count < rows.length;
      all.checked = allChecked;
      all.indeterminate = partial;
      all.dataset.forceSelected = allChecked ? "true" : "false";
      all.dataset.forceIndeterminate = partial ? "true" : "false";
      all.setAttribute("aria-checked", partial ? "mixed" : (allChecked ? "true" : "false"));
    }
  }

  function refreshCounts(){
    const list = getProducts();
    const active = list.filter(p=>!p.archived);
    const summary = document.getElementById("inventorySummary");
    const quick = active.filter(p=>p.quickPick).length;
    if(summary) summary.textContent = `${active.length} products in catalog • ${quick}/12 Quick Picks • stock counts can be updated before rollout`;
    const qpCount = document.getElementById("quickPickCount");
    if(qpCount) qpCount.textContent = `${quick} / 12`;
  }

  function removeProductFromVisibleUI(id){
    selected.delete(String(id));
    inventoryBody.querySelector(`tr[data-edit-product="${CSS.escape(String(id))}"]`)?.remove();
    document.querySelectorAll(`[data-product-id="${CSS.escape(String(id))}"]`).forEach(el=>el.remove());
    refreshCounts();
    updateSelectionUI();
  }

  function archiveProductInVisibleUI(id){
    selected.delete(String(id));
    const row = inventoryBody.querySelector(`tr[data-edit-product="${CSS.escape(String(id))}"]`);
    if(row) row.style.display = "none";
    document.querySelectorAll(`[data-product-id="${CSS.escape(String(id))}"]`).forEach(el=>el.remove());
    refreshCounts();
    updateSelectionUI();
  }

  function selectedIds(){
    return visibleRows()
      .filter(row => row.querySelector('.row-select')?.checked)
      .map(row => String(row.dataset.editProduct));
  }

  // Allow native checkbox activation (including Space) and handle its change
  // exactly once. Do not cancel the click: cancellation restores the old value.
  inventoryTable.addEventListener("click", e => {
    if (e.target.closest('.row-select,.select-all')) e.stopPropagation();
  }, true);
  inventoryTable.addEventListener("change", e => {
    const box = e.target;
    if (box.matches('.row-select')) {
      const id = String(box.closest('tr[data-edit-product]').dataset.editProduct);
      if (box.checked) selected.add(id); else selected.delete(id);
      paintCheckbox(box, box.checked);
    } else if (box.matches('.select-all')) {
      const checked = box.checked;
      visibleRows().forEach(row => {
        const id = String(row.dataset.editProduct);
        if (checked) selected.add(id); else selected.delete(id);
        paintCheckbox(row.querySelector('.row-select'), checked);
      });
    } else return;
    e.stopPropagation();
    updateSelectionUI();
  });

  window.addEventListener("click", e=>{
    const target = e.target;
    if(!(target instanceof Element)) return;

    const singleDelete = target.closest('.delete-item-btn');
    if(singleDelete){
      e.preventDefault();
      e.stopImmediatePropagation();
      const row = singleDelete.closest('tr[data-edit-product]');
      if(!row) return;
      const id = String(row.dataset.editProduct);
      const list = getProducts();
      const product = list.find(p=>String(p.id)===id);
      if(!product) return;
      if(!confirm(`Delete "${product.name}" from inventory?`)) return;
      saveProducts(list.filter(p=>String(p.id)!==id));
      removeProductFromVisibleUI(id);
      return;
    }

    const bulkDelete = target.closest('#bulkDeleteBtn');
    const bulkArchive = target.closest('#bulkArchiveBtn');
    if(bulkDelete || bulkArchive){
      e.preventDefault();
      e.stopImmediatePropagation();
      const ids = selectedIds();
      if(!ids.length) return;
      const idSet = new Set(ids);
      const list = getProducts();

      if(bulkDelete){
        if(!confirm(`Permanently delete ${ids.length} selected inventory item${ids.length===1?"":"s"}? This cannot be undone.`)) return;
        saveProducts(list.filter(p=>!idSet.has(String(p.id))));
        ids.forEach(removeProductFromVisibleUI);
      } else {
        if(!confirm(`Archive ${ids.length} selected inventory item${ids.length===1?"":"s"}?`)) return;
        list.forEach(p=>{
          if(idSet.has(String(p.id))){ p.archived = true; p.quickPick = false; }
        });
        saveProducts(list);
        ids.forEach(archiveProductInVisibleUI);
      }
      updateSelectionUI();
    }
  }, true);

  // Re-apply visible state if older code redraws Inventory after a search/filter change.
  const observer = new MutationObserver(()=>{
    const list = getProducts();
    const byId = new Map(list.map(p=>[String(p.id),p]));
    inventoryBody.querySelectorAll('tr[data-edit-product]').forEach(row=>{
      const p = byId.get(String(row.dataset.editProduct));
      if(!p) row.remove();
      else if(p.archived) row.style.display="none";
      const box = row.querySelector('.row-select');
      if(box) paintCheckbox(box, selected.has(String(row.dataset.editProduct)));
    });
    updateSelectionUI();
  });
  observer.observe(inventoryBody,{childList:true});

  // Prevent deleted/archived products from being reintroduced into product grids
  // by older in-memory render functions.
  ["quickPickGrid","categoryProductGrid"].forEach(id=>{
    const grid = document.getElementById(id);
    if(!grid) return;
    new MutationObserver(()=>{
      const list = getProducts();
      const valid = new Map(list.map(p=>[String(p.id),p]));
      grid.querySelectorAll('[data-product-id]').forEach(tile=>{
        const p = valid.get(String(tile.dataset.productId));
        if(!p || p.archived) tile.remove();
      });
    }).observe(grid,{childList:true});
  });

  inventoryBody.querySelectorAll('.row-select').forEach(box=>paintCheckbox(box, !!box.checked));
  updateSelectionUI();
  refreshCounts();
})();
