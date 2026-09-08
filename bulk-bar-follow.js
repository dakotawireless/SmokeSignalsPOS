(() => {
  "use strict";

  const inventoryView = document.getElementById("inventoryView");
  const main = document.querySelector(".main");
  if (!inventoryView || !main) return;

  let placeholder = null;
  let activeBar = null;
  let originalTop = 0;

  const style = document.createElement("style");
  style.textContent = `
    .bulk-inventory-bar.bulk-following {
      position: fixed !important;
      top: 8px !important;
      z-index: 90 !important;
      margin: 0 !important;
      box-shadow: 0 8px 24px rgba(0,0,0,.14) !important;
    }
    .bulk-bar-placeholder { display:block; }
  `;
  document.head.appendChild(style);

  function getBar(){
    return document.getElementById("bulkInventoryBarFixed") || document.getElementById("bulkInventoryBar");
  }

  function inventoryVisible(){
    return !inventoryView.classList.contains("hidden") && getComputedStyle(inventoryView).display !== "none";
  }

  function selectedCount(bar){
    const label = bar?.querySelector(".bulk-count");
    const n = parseInt(label?.textContent || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }

  function release(){
    if (!activeBar) return;
    activeBar.classList.remove("bulk-following");
    activeBar.style.left = "";
    activeBar.style.width = "";
    if (placeholder){ placeholder.remove(); placeholder = null; }
    activeBar = null;
    originalTop = 0;
  }

  function pin(bar){
    if (activeBar !== bar){
      release();
      activeBar = bar;
      const rect = bar.getBoundingClientRect();
      originalTop = window.scrollY + rect.top;
      placeholder = document.createElement("div");
      placeholder.className = "bulk-bar-placeholder";
      placeholder.style.height = `${rect.height + 20}px`;
      bar.parentNode.insertBefore(placeholder, bar);
    }

    const mainRect = main.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const left = Math.max(mainRect.left + 18, 0);
    const width = Math.max(mainRect.width - 36, 280);
    bar.classList.add("bulk-following");
    bar.style.left = `${left}px`;
    bar.style.width = `${width}px`;
  }

  function update(){
    const bar = getBar();
    if (!bar || !inventoryVisible() || selectedCount(bar) < 1){
      release();
      return;
    }

    if (!activeBar){
      const rect = bar.getBoundingClientRect();
      originalTop = window.scrollY + rect.top;
    }

    if (window.scrollY + 8 >= originalTop){ pin(bar); }
    else release();
  }

  window.addEventListener("scroll", update, {passive:true});
  window.addEventListener("resize", update);

  const observer = new MutationObserver(update);
  observer.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:["class","disabled"]});

  setTimeout(update, 0);
})();
