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
      min-width:18px !important;
      border:2px solid #7c8b82 !important;
      border-radius:4px !important;
      background-color:#fff !important;
      background-repeat:no-repeat !important;
      background-position:center !important;
      background-size:13px 13px !important;
      cursor:pointer !important;
      vertical-align:middle !important;
      padding:0 !important;
      margin:0 !important;
    }
    .inventory-table .row-select[data-selected="true"],
    .inventory-table .select-all[data-selected="true"] {
      background-color:#267b22 !important;
      border-color:#267b22 !important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' d='M4 10.5l4 4L16 6'/%3E%3C/svg%3E") !important;
    }
    .inventory-table .select-all[data-indeterminate="true"] {
      background-color:#267b22 !important;
      border-color:#267b22 !important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath stroke='white' stroke-width='3' stroke-linecap='round' d='M4 10h12'/%3E%3C/svg%3E") !important;
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
    }
  }, true);

  const observer = new MutationObserver(updateUI);
  observer.observe(body, {childList:true, subtree:true});
  updateUI();
})();
