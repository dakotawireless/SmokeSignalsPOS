(() => {
  "use strict";

  const PRODUCT_KEY = "sspos_products_v2";
  const SEEN_KEY = "sspos_catalog_seen_ids_v1";
  const DELETED_KEY = "sspos_deleted_product_ids_v1";

  const imported = Array.isArray(window.SMOKE_SIGNALS_IMPORTED_PRODUCTS)
    ? window.SMOKE_SIGNALS_IMPORTED_PRODUCTS
    : [];

  const importedIds = new Set(imported.map(p => String(p.id)));
  const rawProducts = localStorage.getItem(PRODUCT_KEY);

  // First run: seed the browser with the imported catalog and remember which
  // imported IDs have already existed. Future builds will merge against this.
  if (!rawProducts) {
    localStorage.setItem(PRODUCT_KEY, JSON.stringify(imported));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...importedIds]));
    if (!localStorage.getItem(DELETED_KEY)) localStorage.setItem(DELETED_KEY, "[]");
    return;
  }

  let localProducts = [];
  let seenIds = new Set();
  let deletedIds = new Set();

  try { localProducts = JSON.parse(rawProducts) || []; } catch { localProducts = []; }
  try { seenIds = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]").map(String)); } catch {}
  try { deletedIds = new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || "[]").map(String)); } catch {}

  const localIds = new Set(localProducts.map(p => String(p.id)));

  // When this layer is first introduced, treat imported items that are already
  // missing from the user's saved catalog as intentional deletes. That keeps
  // previously deleted products from being resurrected by a later deployment.
  if (!localStorage.getItem(SEEN_KEY)) {
    importedIds.forEach(id => {
      if (!localIds.has(id)) deletedIds.add(id);
    });
  } else {
    // Any previously seen imported item that is now absent locally was deleted
    // by the user. Record a tombstone so future catalog updates cannot restore it.
    seenIds.forEach(id => {
      if (importedIds.has(id) && !localIds.has(id)) deletedIds.add(id);
    });
  }

  const localById = new Map(localProducts.map(p => [String(p.id), p]));
  const merged = [];

  // Preserve user-edited records exactly as saved: quick-pick choices, prices,
  // barcodes, stock counts, archive state, descriptions, etc. Only genuinely new
  // imported products are added automatically.
  imported.forEach(base => {
    const id = String(base.id);
    if (deletedIds.has(id)) return;
    if (localById.has(id)) {
      merged.push(localById.get(id));
      localById.delete(id);
      return;
    }
    if (!seenIds.has(id)) merged.push(base);
  });

  // Keep products created directly inside the POS and any other local-only items.
  localById.forEach(product => merged.push(product));

  importedIds.forEach(id => seenIds.add(id));

  localStorage.setItem(PRODUCT_KEY, JSON.stringify(merged));
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seenIds]));
  localStorage.setItem(DELETED_KEY, JSON.stringify([...deletedIds]));
})();
