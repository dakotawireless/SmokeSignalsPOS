(() => {
  "use strict";

  const ORDER_KEY = "sspos_quickpick_order_v1";
  const grid = document.getElementById("quickPickGrid");
  if (!grid) return;

  const style = document.createElement("style");
  style.textContent = `
    #quickPickGrid .product-tile{cursor:grab;user-select:none;touch-action:none}
    #quickPickGrid .product-tile:active{cursor:grabbing}
    #quickPickGrid .product-tile.quickpick-dragging{opacity:.42;transform:scale(.97);box-shadow:0 12px 26px rgba(0,0,0,.14)}
    #quickPickGrid .product-tile.quickpick-drop-target{outline:2px dashed var(--green);outline-offset:2px}
  `;
  document.head.appendChild(style);

  function loadOrder(){
    try{
      const parsed = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.map(String) : [];
    }catch{
      return [];
    }
  }

  function saveOrder(ids){
    localStorage.setItem(ORDER_KEY, JSON.stringify(ids.map(String)));
  }

  function tileId(tile){
    return String(tile?.dataset?.productId || "");
  }

  function currentTiles(){
    return [...grid.querySelectorAll(":scope > .product-tile[data-product-id]")];
  }

  function applySavedOrder(){
    const tiles = currentTiles();
    if (!tiles.length) return;

    const saved = loadOrder();
    const byId = new Map(tiles.map(t => [tileId(t), t]));
    const ordered = [];

    saved.forEach(id => {
      const tile = byId.get(String(id));
      if (tile){
        ordered.push(tile);
        byId.delete(String(id));
      }
    });

    tiles.forEach(tile => {
      if (byId.has(tileId(tile))){
        ordered.push(tile);
        byId.delete(tileId(tile));
      }
    });

    ordered.forEach(tile => grid.appendChild(tile));
    saveOrder(ordered.map(tileId));
    makeTilesDraggable();
  }

  let dragged = null;

  function clearTargets(){
    currentTiles().forEach(t => t.classList.remove("quickpick-drop-target"));
  }

  function persistDomOrder(){
    saveOrder(currentTiles().map(tileId));
  }

  function makeTilesDraggable(){
    currentTiles().forEach(tile => {
      tile.draggable = true;
      if (tile.dataset.quickpickDnDReady === "1") return;
      tile.dataset.quickpickDnDReady = "1";

      tile.addEventListener("dragstart", e => {
        dragged = tile;
        tile.classList.add("quickpick-dragging");
        if (e.dataTransfer){
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", tileId(tile));
        }
      });

      tile.addEventListener("dragend", () => {
        tile.classList.remove("quickpick-dragging");
        clearTargets();
        persistDomOrder();
        dragged = null;
      });

      tile.addEventListener("dragover", e => {
        if (!dragged || dragged === tile) return;
        e.preventDefault();
        clearTargets();
        tile.classList.add("quickpick-drop-target");

        const rect = tile.getBoundingClientRect();
        const midpointX = rect.left + rect.width / 2;
        const midpointY = rect.top + rect.height / 2;
        const sameRow = Math.abs((dragged.getBoundingClientRect().top + dragged.getBoundingClientRect().height / 2) - midpointY) < rect.height * .75;

        if (sameRow){
          if (e.clientX < midpointX) grid.insertBefore(dragged, tile);
          else grid.insertBefore(dragged, tile.nextSibling);
        } else {
          if (e.clientY < midpointY) grid.insertBefore(dragged, tile);
          else grid.insertBefore(dragged, tile.nextSibling);
        }
      });

      tile.addEventListener("drop", e => {
        if (!dragged) return;
        e.preventDefault();
        clearTargets();
        persistDomOrder();
      });
    });
  }

  // Touch/pointer drag support for tablets and touchscreens.
  let pointerTile = null;
  let pointerId = null;

  grid.addEventListener("pointerdown", e => {
    const tile = e.target.closest(".product-tile[data-product-id]");
    if (!tile || e.pointerType === "mouse") return;
    pointerTile = tile;
    pointerId = e.pointerId;
    tile.setPointerCapture?.(pointerId);
    tile.classList.add("quickpick-dragging");
  });

  grid.addEventListener("pointermove", e => {
    if (!pointerTile || e.pointerId !== pointerId) return;
    e.preventDefault();
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest(".product-tile[data-product-id]");
    if (!el || el === pointerTile || !grid.contains(el)) return;
    clearTargets();
    el.classList.add("quickpick-drop-target");
    const rect = el.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2 || (Math.abs(e.clientY - (rect.top + rect.height / 2)) < rect.height * .35 && e.clientX < rect.left + rect.width / 2);
    grid.insertBefore(pointerTile, before ? el : el.nextSibling);
  }, {passive:false});

  function endPointerDrag(e){
    if (!pointerTile || e.pointerId !== pointerId) return;
    pointerTile.classList.remove("quickpick-dragging");
    clearTargets();
    persistDomOrder();
    pointerTile = null;
    pointerId = null;
  }

  grid.addEventListener("pointerup", endPointerDrag);
  grid.addEventListener("pointercancel", endPointerDrag);

  const observer = new MutationObserver(() => {
    clearTimeout(observer.timer);
    observer.timer = setTimeout(applySavedOrder, 0);
  });
  observer.observe(grid, {childList:true});

  applySavedOrder();
})();
