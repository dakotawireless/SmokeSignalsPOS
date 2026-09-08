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

  let dragged = null;
  let pointerTile = null;
  let pointerId = null;
  let internalMove = false;

  function isDragging(){
    return !!dragged || !!pointerTile;
  }

  function clearTargets(){
    currentTiles().forEach(t => t.classList.remove("quickpick-drop-target"));
  }

  function persistDomOrder(){
    saveOrder(currentTiles().map(tileId));
  }

  function moveTile(tile, beforeNode){
    internalMove = true;
    grid.insertBefore(tile, beforeNode || null);
    queueMicrotask(() => { internalMove = false; });
  }

  function applySavedOrder(){
    if (isDragging()) return;

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

    internalMove = true;
    ordered.forEach(tile => grid.appendChild(tile));
    queueMicrotask(() => { internalMove = false; });
    saveOrder(ordered.map(tileId));
    makeTilesDraggable();
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
        const draggedRect = dragged.getBoundingClientRect();
        const sameRow = Math.abs((draggedRect.top + draggedRect.height / 2) - midpointY) < rect.height * .75;

        if (sameRow){
          moveTile(dragged, e.clientX < midpointX ? tile : tile.nextSibling);
        } else {
          moveTile(dragged, e.clientY < midpointY ? tile : tile.nextSibling);
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
    const centerY = rect.top + rect.height / 2;
    const centerX = rect.left + rect.width / 2;
    const before = e.clientY < centerY || (Math.abs(e.clientY - centerY) < rect.height * .35 && e.clientX < centerX);
    moveTile(pointerTile, before ? el : el.nextSibling);
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
    if (internalMove || isDragging()) return;
    clearTimeout(observer.timer);
    observer.timer = setTimeout(() => {
      if (!internalMove && !isDragging()) applySavedOrder();
    }, 20);
  });
  observer.observe(grid, {childList:true});

  applySavedOrder();
})();
