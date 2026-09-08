(() => {
  "use strict";

  const BUILD_VERSION = "0.1.9";
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

  function installBuildStatus(){
    const logo = document.querySelector(".cart-logo");
    if (!logo || document.getElementById("buildStatusBar")) return;

    const style = document.createElement("style");
    style.textContent = `
      .cart-logo{height:auto !important;min-height:74px !important;padding:7px 10px 9px !important;align-content:center !important;gap:5px !important}
      .cart-build-status{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;color:#dce5df;font-size:10px;line-height:1}
      .build-version-badge{font-weight:900;letter-spacing:.03em;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 8px;white-space:nowrap}
      .cloud-sync-btn{border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:850;display:flex;align-items:center;gap:5px;white-space:nowrap}
      .cloud-sync-dot{width:7px;height:7px;border-radius:50%;background:#7d8b83;box-shadow:0 0 0 2px rgba(255,255,255,.05)}
      .cloud-sync-btn[data-state="ok"] .cloud-sync-dot{background:#4fd14a}
      .cloud-sync-btn[data-state="syncing"] .cloud-sync-dot{background:#e6bf38;animation:sssyncpulse .8s ease-in-out infinite alternate}
      .cloud-sync-btn[data-state="update"] .cloud-sync-dot{background:#f39c36}
      .cloud-sync-btn[data-state="error"] .cloud-sync-dot{background:#df4d4d}
      @keyframes sssyncpulse{from{opacity:.4}to{opacity:1}}
      .cart-logo img{margin-top:1px}
    `;
    document.head.appendChild(style);

    const bar = document.createElement("div");
    bar.id = "buildStatusBar";
    bar.className = "cart-build-status";
    bar.innerHTML = `
      <span class="build-version-badge">Build v${BUILD_VERSION}</span>
      <button id="cloudSyncBuildBtn" class="cloud-sync-btn" data-state="syncing" type="button" title="Check for the latest deployed POS build">
        <span class="cloud-sync-dot"></span><span id="cloudSyncBuildText">Cloud Sync</span>
      </button>`;
    logo.insertBefore(bar, logo.firstChild);

    const btn = document.getElementById("cloudSyncBuildBtn");
    const text = document.getElementById("cloudSyncBuildText");

    function setSyncStatus(label,state){
      if(text) text.textContent = label;
      if(btn) btn.dataset.state = state;
    }

    async function checkBuild(forceReload=false){
      try{
        setSyncStatus("Checking…","syncing");
        const res = await fetch(`build.json?ts=${Date.now()}`, {cache:"no-store"});
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        const info = await res.json();
        const latest = String(info.version || "");
        if(latest && latest !== BUILD_VERSION){
          setSyncStatus(`Update v${latest}`,"update");
          if(forceReload){
            const u = new URL(location.href);
            u.searchParams.set("build", latest);
            location.replace(u.toString());
          }
          return;
        }
        setSyncStatus("Cloud Synced","ok");
      }catch(err){
        console.warn("Cloud build check failed",err);
        setSyncStatus("Sync unavailable","error");
      }
    }

    btn?.addEventListener("click",()=>checkBuild(true));
    checkBuild(false);
  }

  installBuildStatus();

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