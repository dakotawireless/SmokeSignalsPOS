(() => {
  "use strict";

  const inventoryView = document.getElementById("inventoryView");
  const main = document.querySelector(".main");
  if (!inventoryView || !main) return;

  let activeBar = null;
  let placeholder = null;
  let anchorTop = 0;
  let rafPending = false;

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
    if (placeholder){
      placeholder.remove();
      placeholder = null;
    }
    activeBar = null;
    anchorTop = 0;
  }

  function pin(bar){
    if (activeBar !== bar){
      release();
      activeBar = bar;
      const rect = bar.getBoundingClientRect();
      anchorTop = window.scrollY + rect.top;
      placeholder = document.createElement("div");
      placeholder.className = "bulk-bar-placeholder";
      placeholder.style.height = `${rect.height + 20}px`;
      bar.parentNode.insertBefore(placeholder, bar);
    }

    const mainRect = main.getBoundingClientRect();
    activeBar.classList.add("bulk-following");
    activeBar.style.left = `${Math.max(mainRect.left + 18, 0)}px`;
    activeBar.style.width = `${Math.max(mainRect.width - 36, 280)}px`;
  }

  function updateNow(){
    rafPending = false;
    const bar = getBar();

    if (!bar || !inventoryVisible() || selectedCount(bar) < 1){
      release();
      return;
    }

    if (!activeBar){
      const rect = bar.getBoundingClientRect();
      anchorTop = window.scrollY + rect.top;
    }

    if (window.scrollY + 8 >= anchorTop) pin(bar);
    else release();
  }

  function scheduleUpdate(){
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(updateNow);
  }

  // Only react to actual user/navigation events. The previous implementation
  // observed nearly every DOM/class mutation across ~2,000 inventory rows,
  // which could create a feedback loop and freeze Chrome while clicking/scrolling.
  window.addEventListener("scroll", scheduleUpdate, {passive:true});
  window.addEventListener("resize", scheduleUpdate, {passive:true});
  document.addEventListener("click", () => setTimeout(scheduleUpdate, 0), true);
  document.addEventListener("change", () => setTimeout(scheduleUpdate, 0), true);

  setTimeout(scheduleUpdate, 0);
})();
