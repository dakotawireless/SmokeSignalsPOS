(() => {
  "use strict";

  const PRODUCT_STORAGE_KEY = "sspos_products_v2";
  const inventoryBody = document.getElementById("inventoryTableBody");
  const inventoryTable = document.querySelector(".inventory-table");
  if (!inventoryBody || !inventoryTable) return;

  const style = document.createElement("style");
  style.textContent = `
    .inventory-table .row-select,
    .inventory-table .select-all {
      appearance:none !important;
      -webkit-appearance:none !important;
      width:18px !important;
      height:18px !important;
      border:2px solid #7c8b82 !important;
      border-radius:4px !important;
      background:#fff !important;
      display:inline-grid !important;
      place-content:center !important;
      cursor:pointer !important;
      vertical-align:middle !important;
    }
    .inventory-table .row-select:checked,
    .inventory-table .select-all:checked {
      background:#267b22 !important;
      border-color:#267b22 !important;
    }
    .inventory-table .row-select:checked::after,
    .inventory-table .select-all:checked::after {
      content:"✓";
      color:#fff;
      font-size:14px;
      font-weight:900;
      line-height:1;
      transform:translateY(-1px);
    }
    .inventory-table .select-all:indeterminate {
      background:#267b22 !important;
      border-color:#267b22 !important;
    }
    .inventory-table .select-all:indeterminate::after {
      content:"−";
      color:#fff;
      font-size:14px;
      font-weight:900;
      line-height:1;
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

  function removeProductFromVisibleUI(id){
    inventoryBody.querySelector(`tr[data-edit-product="${CSS.escape(String(id))}"]`)?.remove();
    document.querySelectorAll(`[data-product-id="${CSS.escape(String(id))}"]`).forEach(el=>el.remove());
    refreshCounts();
  }

  function archiveProductInVisibleUI(id){
    const row = inventoryBody.querySelector(`tr[data-edit-product="${CSS.escape(String(id))}"]`);
    if(row) row.style.display = "none";
    document.querySelectorAll(`[data-product-id="${CSS.escape(String(id))}"]`).forEach(el=>el.remove());
    refreshCounts();
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

  // Single-row delete: perform entirely in place. No page reload, so no flash.
  inventoryBody.addEventListener("click", e=>{
    const btn = e.target.closest(".delete-item-btn");
    if(!btn) return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const row = btn.closest("tr[data-edit-product]");
    if(!row) return;
    const id = String(row.dataset.editProduct);
    const list = getProducts();
    const product = list.find(p=>String(p.id)===id);
    if(!product) return;
    if(!confirm(`Delete "${product.name}" from inventory?`)) return;

    saveProducts(list.filter(p=>String(p.id)!==id));
    removeProductFromVisibleUI(id);
  }, true);

  // Bulk delete/archive: intercept before legacy handlers can reload the page.
  document.addEventListener("click", e=>{
    const deleteBtn = e.target.closest("#bulkDeleteBtn,#bulkDeleteBtnFixed");
    const archiveBtn = e.target.closest("#bulkArchiveBtn,#bulkArchiveBtnFixed");
    if(!deleteBtn && !archiveBtn) return;

    const selectedRows = [...inventoryBody.querySelectorAll('tr[data-edit-product]')]
      .filter(row => row.querySelector('.row-select')?.checked)
      .map(row => String(row.dataset.editProduct));
    if(!selectedRows.length) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const list = getProducts();
    const idSet = new Set(selectedRows);

    if(deleteBtn){
      if(!confirm(`Permanently delete ${selectedRows.length} selected inventory item${selectedRows.length===1?"":"s"}? This cannot be undone.`)) return;
      saveProducts(list.filter(p=>!idSet.has(String(p.id))));
      selectedRows.forEach(removeProductFromVisibleUI);
    }else{
      if(!confirm(`Archive ${selectedRows.length} selected inventory item${selectedRows.length===1?"":"s"}?`)) return;
      list.forEach(p=>{
        if(idSet.has(String(p.id))){ p.archived = true; p.quickPick = false; }
      });
      saveProducts(list);
      selectedRows.forEach(archiveProductInVisibleUI);
    }

    // Reset the corrected bulk bar without reloading.
    ["bulkInventoryCount","bulkInventoryCountFixed"].forEach(id=>{
      const el=document.getElementById(id); if(el) el.textContent="0 selected";
    });
    ["bulkArchiveBtn","bulkDeleteBtn","bulkArchiveBtnFixed","bulkDeleteBtnFixed"].forEach(id=>{
      const el=document.getElementById(id); if(el) el.disabled=true;
    });
    const all = inventoryTable.querySelector('.select-all');
    if(all){ all.checked=false; all.indeterminate=false; }
  }, true);

  // If legacy code re-renders rows later, keep deleted/archived items from reappearing.
  const observer = new MutationObserver(()=>{
    const list = getProducts();
    const byId = new Map(list.map(p=>[String(p.id),p]));
    inventoryBody.querySelectorAll('tr[data-edit-product]').forEach(row=>{
      const p = byId.get(String(row.dataset.editProduct));
      if(!p) row.remove();
      else if(p.archived) row.style.display="none";
    });
  });
  observer.observe(inventoryBody,{childList:true});

  refreshCounts();
})();
