(() => {
  "use strict";

  const table = document.querySelector('.inventory-table');
  const body = document.getElementById('inventoryTableBody');
  if (!table || !body) return;

  const selected = new Set();

  const style = document.createElement('style');
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
      cursor:pointer !important;
      position:relative !important;
      vertical-align:middle !important;
    }
    .inventory-table .row-select[data-selected="true"],
    .inventory-table .select-all[data-selected="true"] {
      background:#267b22 !important;
      border-color:#267b22 !important;
      box-shadow:inset 0 0 0 2px #267b22 !important;
    }
    .inventory-table .row-select[data-selected="true"]::before,
    .inventory-table .select-all[data-selected="true"]::before {
      content:"✓" !important;
      position:absolute !important;
      inset:0 !important;
      display:flex !important;
      align-items:center !important;
      justify-content:center !important;
      color:#fff !important;
      font-size:14px !important;
      font-weight:900 !important;
      line-height:1 !important;
    }
    .inventory-table .select-all[data-indeterminate="true"] {
      background:#267b22 !important;
      border-color:#267b22 !important;
    }
    .inventory-table .select-all[data-indeterminate="true"]::before {
      content:"−" !important;
      position:absolute !important;
      inset:0 !important;
      display:flex !important;
      align-items:center !important;
      justify-content:center !important;
      color:#fff !important;
      font-size:14px !important;
      font-weight:900 !important;
    }
  `;
  document.head.appendChild(style);

  function visibleRows(){
    return [...body.querySelectorAll('tr[data-edit-product]')].filter(r => r.style.display !== 'none');
  }

  function paintBox(box, checked){
    if (!box) return;
    box.checked = !!checked;
    box.dataset.selected = checked ? 'true' : 'false';
    box.setAttribute('aria-checked', checked ? 'true' : 'false');
  }

  function updateUI(){
    visibleRows().forEach(row => {
      const id = String(row.dataset.editProduct);
      paintBox(row.querySelector('.row-select'), selected.has(id));
    });

    const rows = visibleRows();
    const count = rows.filter(r => selected.has(String(r.dataset.editProduct))).length;
    const all = table.querySelector('.select-all');
    if (all){
      const allChecked = rows.length > 0 && count === rows.length;
      const partial = count > 0 && count < rows.length;
      paintBox(all, allChecked);
      all.indeterminate = partial;
      all.dataset.indeterminate = partial ? 'true' : 'false';
    }

    ['bulkInventoryCount','bulkInventoryCountFixed'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${selected.size} selected`;
    });
    ['bulkArchiveBtn','bulkDeleteBtn','bulkArchiveBtnFixed','bulkDeleteBtnFixed'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = selected.size === 0;
    });
  }

  // Capture before all older inventory handlers. We cancel the native checkbox
  // action and own both the state and the visual mark ourselves.
  window.addEventListener('click', e => {
    const box = e.target.closest?.('.row-select');
    if (box){
      e.preventDefault();
      e.stopImmediatePropagation();
      const row = box.closest('tr[data-edit-product]');
      if (!row) return;
      const id = String(row.dataset.editProduct);
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      updateUI();
      // Re-assert after the canceled native checkbox activation fully unwinds.
      setTimeout(updateUI, 0);
      return;
    }

    const all = e.target.closest?.('.select-all');
    if (all){
      e.preventDefault();
      e.stopImmediatePropagation();
      const rows = visibleRows();
      const allSelected = rows.length > 0 && rows.every(r => selected.has(String(r.dataset.editProduct)));
      rows.forEach(row => {
        const id = String(row.dataset.editProduct);
        if (allSelected) selected.delete(id); else selected.add(id);
      });
      updateUI();
      setTimeout(updateUI, 0);
    }
  }, true);

  const observer = new MutationObserver(updateUI);
  observer.observe(body, {childList:true, subtree:true});
  updateUI();
})();
