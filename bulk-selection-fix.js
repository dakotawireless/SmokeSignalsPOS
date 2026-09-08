(() => {
  "use strict";

  const PRODUCT_STORAGE_KEY = "sspos_products_v2";
  const inventoryBody = document.getElementById("inventoryTableBody");
  const inventoryTable = document.querySelector(".inventory-table");
  if (!inventoryBody || !inventoryTable) return;

  const selected = new Set();

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

  function visibleRows(){
    return [...inventoryBody.querySelectorAll('tr[data-edit-product]')].filter(r => r.style.display !== 'none');
  }

  function ensureBar(){
    let bar = document.getElementById('bulkInventoryBarFixed');
    if (bar) return bar;

    // Hide the previous bulk bar so only the corrected one is shown.
    const oldBar = document.getElementById('bulkInventoryBar');
    if (oldBar) oldBar.style.display = 'none';

    bar = document.createElement('div');
    bar.id = 'bulkInventoryBarFixed';
    bar.className = 'bulk-inventory-bar';
    bar.innerHTML = `
      <span class="bulk-count" id="bulkInventoryCountFixed">0 selected</span>
      <button class="bulk-archive-btn" id="bulkArchiveBtnFixed" type="button" disabled>Archive Selected</button>
      <button class="bulk-delete-btn" id="bulkDeleteBtnFixed" type="button" disabled>Delete Selected</button>`;

    const wrap = inventoryTable.closest('.inventory-table-wrap');
    wrap.parentNode.insertBefore(bar, wrap);

    document.getElementById('bulkArchiveBtnFixed').addEventListener('click', () => {
      if (!selected.size) return;
      if (!confirm(`Archive ${selected.size} selected inventory item${selected.size === 1 ? '' : 's'}?`)) return;
      const ids = new Set(selected);
      const list = products();
      list.forEach(p => {
        if (ids.has(String(p.id))) {
          p.archived = true;
          p.quickPick = false;
        }
      });
      saveProducts(list);
      sessionStorage.setItem('sspos_return_inventory', '1');
      location.reload();
    });

    document.getElementById('bulkDeleteBtnFixed').addEventListener('click', () => {
      if (!selected.size) return;
      if (!confirm(`Permanently delete ${selected.size} selected inventory item${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
      const ids = new Set(selected);
      saveProducts(products().filter(p => !ids.has(String(p.id))));
      sessionStorage.setItem('sspos_return_inventory', '1');
      location.reload();
    });

    return bar;
  }

  function refreshBar(){
    ensureBar();
    const count = selected.size;
    const label = document.getElementById('bulkInventoryCountFixed');
    const archive = document.getElementById('bulkArchiveBtnFixed');
    const del = document.getElementById('bulkDeleteBtnFixed');
    if (label) label.textContent = `${count} selected`;
    if (archive) archive.disabled = count === 0;
    if (del) del.disabled = count === 0;

    const all = inventoryTable.querySelector('.select-all');
    if (all) {
      const rows = visibleRows();
      const checked = rows.filter(r => selected.has(String(r.dataset.editProduct))).length;
      all.checked = rows.length > 0 && checked === rows.length;
      all.indeterminate = checked > 0 && checked < rows.length;
    }
  }

  function syncRowCheckboxes(){
    visibleRows().forEach(row => {
      const box = row.querySelector('.row-select');
      if (box) box.checked = selected.has(String(row.dataset.editProduct));
    });
  }

  // Capture before the older delegated handler. We stop that handler and let
  // the native checkbox default action toggle visually, then update selection.
  inventoryBody.addEventListener('click', e => {
    const box = e.target.closest('.row-select');
    if (!box) return;
    e.stopImmediatePropagation();

    const row = box.closest('tr[data-edit-product]');
    if (!row) return;
    const id = String(row.dataset.editProduct);

    // The browser applies the checkbox's default toggle after the click event.
    setTimeout(() => {
      if (box.checked) selected.add(id);
      else selected.delete(id);
      refreshBar();
    }, 0);
  }, true);

  // Correct Select All as well, and block the older listener from interfering.
  inventoryTable.addEventListener('click', e => {
    const all = e.target.closest('.select-all');
    if (!all) return;
    e.stopImmediatePropagation();

    setTimeout(() => {
      const checked = all.checked;
      visibleRows().forEach(row => {
        const id = String(row.dataset.editProduct);
        if (checked) selected.add(id); else selected.delete(id);
      });
      syncRowCheckboxes();
      refreshBar();
    }, 0);
  }, true);

  const observer = new MutationObserver(() => {
    syncRowCheckboxes();
    refreshBar();
  });
  observer.observe(inventoryBody, { childList: true });

  ensureBar();
  syncRowCheckboxes();
  refreshBar();
})();