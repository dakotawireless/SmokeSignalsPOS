(() => {
  "use strict";

  const PRODUCT_STORAGE_KEY = "sspos_products_v2";
  const inventoryBody = document.getElementById("inventoryTableBody");
  const inventoryTable = document.querySelector(".inventory-table");
  const main = document.querySelector(".main");
  if (!inventoryBody || !inventoryTable || !main) return;

  const selected = new Set();

  const style = document.createElement("style");
  style.textContent = `
    #bulkInventoryBarFixed.bulk-fixed-active {
      position: fixed !important;
      top: 8px !important;
      z-index: 95 !important;
      margin: 0 !important;
      box-shadow: 0 8px 24px rgba(0,0,0,.16) !important;
    }
  `;
  document.head.appendChild(style);

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

  function positionBar(){
    const bar = ensureBar();
    if (!bar) return;
    if (selected.size > 0) {
      const rect = main.getBoundingClientRect();
      bar.classList.add('bulk-fixed-active');
      bar.style.left = `${Math.max(rect.left + 18, 8)}px`;
      bar.style.width = `${Math.max(rect.width - 36, 280)}px`;
    } else {
      bar.classList.remove('bulk-fixed-active');
      bar.style.left = '';
      bar.style.width = '';
    }
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
    positionBar();
  }

  function syncRowCheckboxes(){
    visibleRows().forEach(row => {
      const box = row.querySelector('.row-select');
      if (box) box.checked = selected.has(String(row.dataset.editProduct));
    });
  }

  inventoryBody.addEventListener('click', e => {
    const box = e.target.closest('.row-select');
    if (!box) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const row = box.closest('tr[data-edit-product]');
    if (!row) return;
    const id = String(row.dataset.editProduct);
    const nextChecked = !selected.has(id);

    if (nextChecked) selected.add(id);
    else selected.delete(id);

    box.checked = nextChecked;
    refreshBar();
  }, true);

  inventoryTable.addEventListener('click', e => {
    const all = e.target.closest('.select-all');
    if (!all) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const rows = visibleRows();
    const allVisibleSelected = rows.length > 0 && rows.every(r => selected.has(String(r.dataset.editProduct)));
    const nextChecked = !allVisibleSelected;

    rows.forEach(row => {
      const id = String(row.dataset.editProduct);
      if (nextChecked) selected.add(id); else selected.delete(id);
      const box = row.querySelector('.row-select');
      if (box) box.checked = nextChecked;
    });

    all.checked = nextChecked;
    all.indeterminate = false;
    refreshBar();
  }, true);

  const observer = new MutationObserver(() => {
    syncRowCheckboxes();
    refreshBar();
  });
  observer.observe(inventoryBody, { childList: true });

  window.addEventListener('resize', positionBar, {passive:true});

  ensureBar();
  syncRowCheckboxes();
  refreshBar();
})();