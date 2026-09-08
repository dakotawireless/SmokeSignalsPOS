(() => {
  "use strict";

  const inventorySearch = document.getElementById("inventorySearch");
  const modalBackdrop = document.getElementById("modalBackdrop");
  const toast = document.getElementById("toast");
  const PRODUCT_STORAGE_KEY = "sspos_products_v2";

  function products(){
    try{
      const raw = localStorage.getItem(PRODUCT_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    }catch{}
    return Array.isArray(window.SMOKE_SIGNALS_IMPORTED_PRODUCTS) ? window.SMOKE_SIGNALS_IMPORTED_PRODUCTS : [];
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

  function addProduct(product){
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

  // Inventory/product edit dialogs are deliberate work areas. Clicking the dimmed
  // page behind a dialog must never discard the employee's edits.
  if (modalBackdrop){
    modalBackdrop.addEventListener("click", e => {
      if (e.target === modalBackdrop){
        e.stopPropagation();
      }
    });
  }

  // The global scanner listener intentionally watches keyboard-speed input, but a
  // fast human typist in Inventory could be mistaken for a scanner. Protect the
  // Inventory search field from that listener while keeping normal text entry and
  // still recognizing an actual rapid barcode scan terminated by Enter.
  if (inventorySearch){
    const scan = {buffer:"", startedAt:0, lastAt:0, timer:null};

    function reset(){
      scan.buffer = "";
      scan.startedAt = 0;
      scan.lastAt = 0;
      clearTimeout(scan.timer);
    }

    window.addEventListener("keydown", e => {
      if (e.target !== inventorySearch) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = performance.now();

      // Do not allow the later document-level scanner listener to interfere with
      // this search box. stopPropagation does not cancel the browser's normal text
      // editing/default action.
      e.stopPropagation();

      if (e.key === "Enter"){
        const elapsed = scan.startedAt ? now - scan.startedAt : Infinity;
        const looksLikeScan = scan.buffer.length >= 8 && elapsed <= 1600;
        if (looksLikeScan){
          e.preventDefault();
          const code = scan.buffer;
          reset();
          const product = findBarcode(code);
          inventorySearch.value = "";
          inventorySearch.dispatchEvent(new Event("input", {bubbles:true}));
          if (product){
            addProduct(product);
            showMessage(`${product.name} added.`);
          } else {
            showMessage("Item not found.");
          }
        } else {
          reset();
        }
        return;
      }

      if (e.key.length !== 1){
        if (e.key === "Backspace" || e.key === "Delete" || e.key.startsWith("Arrow")) reset();
        return;
      }

      const gap = scan.lastAt ? now - scan.lastAt : 0;
      if (!scan.startedAt || gap > 160){
        scan.buffer = "";
        scan.startedAt = now;
      }
      scan.buffer += e.key;
      scan.lastAt = now;
      clearTimeout(scan.timer);
      scan.timer = setTimeout(reset, 220);
    }, true);
  }
})();