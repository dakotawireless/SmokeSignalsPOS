(() => {
  "use strict";

  const CURRENT_BUILD = "0.1.14";
  const cartLogo = document.querySelector('.cart-logo');
  if (!cartLogo) return;

  cartLogo.querySelectorAll('#buildStatusBar,.cart-build-status,.build-sync-bar').forEach(el => el.remove());

  const bar = document.createElement('div');
  bar.className = 'build-sync-bar';
  bar.id = 'buildSyncBar';
  bar.innerHTML = `
    <span class="build-version-pill">Build <strong id="buildVersionBadge">v${CURRENT_BUILD}</strong></span>
    <button id="cloudSyncBtn" class="cloud-sync-btn" type="button" data-state="syncing">
      <span class="sync-dot"></span><span id="cloudSyncText">Checking…</span>
    </button>`;
  cartLogo.insertBefore(bar, cartLogo.firstChild);

  const badge = document.getElementById("buildVersionBadge");
  const syncBtn = document.getElementById("cloudSyncBtn");
  const syncText = document.getElementById("cloudSyncText");

  const style = document.createElement('style');
  style.textContent = `
    .build-sync-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 8px 3px}
    .build-version-pill,.cloud-sync-btn{border:0;border-radius:999px;background:#30383b;color:#fff;font-size:10px;font-weight:800;padding:5px 8px}
    .cloud-sync-btn{display:flex;align-items:center;gap:5px;cursor:pointer}
    .sync-dot{width:7px;height:7px;border-radius:50%;background:#f2a23a;display:inline-block}
    .cloud-sync-btn[data-state="ok"] .sync-dot{background:#4fc36b}
    .cloud-sync-btn[data-state="error"] .sync-dot{background:#df5a5a}
    .cloud-sync-btn[data-state="update"] .sync-dot{background:#f2a23a}
  `;
  document.head.appendChild(style);

  function setStatus(text, state="ok"){
    syncText.textContent = text;
    syncBtn.dataset.state = state;
  }

  badge.textContent = `v${CURRENT_BUILD}`;

  async function checkLatestBuild(forceReload=false){
    try{
      setStatus("Checking…", "syncing");
      const res = await fetch(`build.json?ts=${Date.now()}`, {cache:"no-store"});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      const latest = String(info.version || "");

      if(latest && latest !== CURRENT_BUILD){
        setStatus(`Update v${latest}`, "update");
        if(forceReload){
          const url = new URL(location.href);
          url.searchParams.set("build", latest);
          location.replace(url.toString());
        }
        return;
      }

      setStatus("Cloud Synced", "ok");
    }catch(err){
      console.warn("Build sync check failed", err);
      setStatus("Sync unavailable", "error");
    }
  }

  syncBtn.addEventListener("click", ()=>checkLatestBuild(true));
  checkLatestBuild(false);
})();
