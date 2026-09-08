(() => {
  "use strict";

  const CURRENT_BUILD = "0.1.10";
  const badge = document.getElementById("buildVersionBadge");
  const syncBtn = document.getElementById("cloudSyncBtn");
  const syncText = document.getElementById("cloudSyncText");

  function setStatus(text, state="ok"){
    if(syncText) syncText.textContent = text;
    if(syncBtn){
      syncBtn.dataset.state = state;
      syncBtn.classList.toggle("syncing", state === "syncing");
    }
  }

  if(badge) badge.textContent = `v${CURRENT_BUILD}`;

  async function checkLatestBuild(forceReload=false){
    try{
      setStatus("Checking…", "syncing");
      const res = await fetch(`build.json?ts=${Date.now()}`, {cache:"no-store"});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const info = await res.json();
      const latest = String(info.version || "");

      if(latest && latest !== CURRENT_BUILD){
        setStatus(`Update ${latest} ready`, "update");
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

  syncBtn?.addEventListener("click", ()=>checkLatestBuild(true));
  checkLatestBuild(false);
})();
