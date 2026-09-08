(() => {
  "use strict";

  const PRODUCT_STORAGE_KEY = "sspos_products_v2";
  const inventoryBody = document.getElementById("inventoryTableBody");
  const inventoryTable = document.querySelector(".inventory-table");
  const inventoryView = document.getElementById("inventoryView");
  const main = document.querySelector(".main");
  if (!inventoryBody || !inventoryTable || !inventoryView || !main) return;

  const selected = new Set();

  const style = document.createElement("style");
  style.textContent = `
    #bulkInventoryFloatingBar {
      position: fixed !important;
      top: 8px !important;
      z-index: 1000 !important;
      display: none;
      align-items: center;
      gap: 8px;
      padding: 9px 10px;
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      box-shadow: 0 10px 28px rgba(0,0,0,.18);
    }
    #bulkInventoryFloatingBar.visible { display: flex !important; }
    #bulkInventoryFloatingBar .bulk-count { font-size:12px;font-weight:800;color:var(--muted);margin-right:auto; }
    #bulkInventoryFloatingBar button { border:1px solid var(--border);background:#fff;border-radius:8px;padding:8px 11px;font-size:12px;font-weight:850; }
    #bulkInventoryFloatingBar .bulk-archive-btn { color:#7b5a00; }
    #bulkInventoryFloatingBar .bulk-delete-btn { color:var(--danger); }
    #bulkInventoryFloatingBar button:disabled { opacity:.45;cursor:not-allowed; }
    #bulkInventoryBarFixed.floating-active { visibility:hidden !important; }
  `;
  document.head.appendChild(style);

  function products(){
    try {
      const raw = localStorage.getItem(PRODUCT_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return Array.isArray(window.SMOKE_SIGNALS_IMPORTED_PRODUCTS) ? window.SMOKE_SIGNALS_IMPORTED_PRODUCTS : [];
  }

  function saveProducts(list){
    localStorage.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(list));
  }

  function visibleRows(){
    return [...inventoryBody.querySelectorAll('tr[data-edit-product]')].filter(r => r.style.display !== 'none');
  }

  function archiveSelected(){
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
  }

  function deleteSelected(){
    if (!selected.size) return;
    if (!confirm(`Permanently delete ${selected.size} selected inventory item${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    const ids = new Set(selected);
    saveProducts(products().filter(p => !ids.has(String(p.id))));
    sessionStorage.setItem('sspos_return_inventory', '1');
    location.reload();
  }

  function ensureNormalBar(){
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
    document.getElementById('bulkArchiveBtnFixed').addEventListener('click', archiveSelected);
    document.getElementById('bulkDeleteBtnFixed').addEventListener('click', deleteSelected);
    return bar;
  }

  function ensureFloatingBar(){
    let bar = document.getElementById('bulkInventoryFloatingBar');
    if (bar) return bar;
    bar = document.createElement('div');
    bar.id = 'bulkInventoryFloatingBar';
    bar.innerHTML = `
      <span class="bulk-count" id="bulkInventoryFloatingCount">0 selected</span>
      <button class="bulk-archive-btn" id="bulkInventoryFloatingArchive" type="button">Archive Selected</button>
      <button class="bulk-delete-btn" id="bulkInventoryFloatingDelete" type="button">Delete Selected</button>`;
    document.body.appendChild(bar);
    document.getElementById('bulkInventoryFloatingArchive').addEventListener('click', archiveSelected);
    document.getElementById('bulkInventoryFloatingDelete').addEventListener('click', deleteSelected);
    return bar;
  }

  function inventoryVisible(){
    return !inventoryView.classList.contains('hidden') && getComputedStyle(inventoryView).display !== 'none';
  }

  function positionFloatingBar(){
    const floating = ensureFloatingBar();
    const normal = ensureNormalBar();
    const shouldShow = selected.size > 0 && inventoryVisible();

    if (!shouldShow) {
      floating.classList.remove('visible');
      normal.classList.remove('floating-active');
      return;
    }

    const rect = main.getBoundingClientRect();
    floating.style.left = `${Math.max(rect.left + 18, 8)}px`;
    floating.style.width = `${Math.max(rect.width - 36, 280)}px`;
    floating.classList.add('visible');
    normal.classList.add('floating-active');
  }

  function refreshBar(){
    const normal = ensureNormalBar();
    const floating = ensureFloatingBar();
    const count = selected.size;

    const normalLabel = document.getElementById('bulkInventoryCountFixed');
    const normalArchive = document.getElementById('bulkArchiveBtnFixed');
    const normalDelete = document.getElementById('bulkDeleteBtnFixed');
    const floatingLabel = document.getElementById('bulkInventoryFloatingCount');
    const floatingArchive = document.getElementById('bulkInventoryFloatingArchive');
    const floatingDelete = document.getElementById('bulkInventoryFloatingDelete');

    if (normalLabel) normalLabel.textContent = `${count} selected`;
    if (floatingLabel) floatingLabel.textContent = `${count} selected`;
    if (normalArchive) normalArchive.disabled = count === 0;
    if (normalDelete) normalDelete.disabled = count === 0;
    if (floatingArchive) floatingArchive.disabled = count === 0;
    if (floatingDelete) floatingDelete.disabled = count === 0;

    const all = inventoryTable.querySelector('.select-all');
    if (all) {
      const rows = visibleRows();
      const checked = rows.filter(r => selected.has(String(r.dataset.editProduct))).length;
      all.checked = rows.length > 0 && checked === rows.length;
      all.indeterminate = checked > 0 && checked < rows.length;
    }

    positionFloatingBar();
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
    if (nextChecked) selected.add(id); else selected.delete(id);
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
  observer.observe(inventoryBody, { childList:true });

  window.addEventListener('resize', positionFloatingBar, {passive:true});
  document.addEventListener('click', e => {
    if (e.target.closest('.nav-btn')) requestAnimationFrame(positionFloatingBar);
  }, true);

  ensureNormalBar();
  ensureFloatingBar();
  syncRowCheckboxes();
  refreshBar();
})();