(() => {
  "use strict";

  const PRODUCT_STORAGE_KEY = "sspos_products_v2";
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

  setTimeout(()=>searchInput.focus(), 0);
})();
