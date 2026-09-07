(() => {
  "use strict";

  const TAX_RATE = 0.0825;

  const products = [
    { id: "lm15000", name: "Lost Mary MT15000", variant: "Blue Razz Ice", price: 19.99, cost: 9.25, brand: "LOST MARY", category: "Vapes", recentSales: 118 },
    { id: "kr60", name: "Kratom Capsules 60ct", variant: "", price: 24.99, cost: 11.40, brand: "KRATOM", category: "Kratom", recentSales: 106 },
    { id: "gbpx", name: "Geek Bar Pulse X", variant: "", price: 17.99, cost: 8.35, brand: "GEEK BAR", category: "Vapes", recentSales: 95 },
    { id: "grav4", name: "Glass Hand Pipe 4\"", variant: "", price: 12.99, cost: 5.10, brand: "GRAV", category: "Glass", recentSales: 82 },
    { id: "raw114", name: "Raw Rolling Papers 1 1/4", variant: "", price: 1.49, cost: 0.54, brand: "RAW", category: "Rolling Papers & Cones", recentSales: 78 },
    { id: "clipper", name: "Clipper Lighter", variant: "", price: 2.49, cost: 0.89, brand: "CLIPPER", category: "Torches & Lighters", recentSales: 73 },
    { id: "elfbc", name: "Elf Bar BC5000", variant: "", price: 16.99, cost: 7.50, brand: "ELF BAR", category: "Vapes", recentSales: 69 },
    { id: "flum6", name: "Flum Float 6000", variant: "", price: 15.99, cost: 7.20, brand: "FLUM", category: "Vapes", recentSales: 64 },
    { id: "gmd250", name: "Green Maeng Da Kratom 250g", variant: "", price: 21.99, cost: 9.40, brand: "GREEN MAENG DA", category: "Kratom", recentSales: 58 },
    { id: "blink", name: "Torch Lighter", variant: "Butane", price: 11.99, cost: 4.80, brand: "BLINK", category: "Torches & Lighters", recentSales: 53 },
    { id: "ooze", name: "Silicone Pipe", variant: "Assorted", price: 7.99, cost: 3.15, brand: "OOZE", category: "Pipes", recentSales: 47 },
    { id: "zigzag", name: "Zig-Zag Cones 1 1/4", variant: "", price: 1.99, cost: 0.70, brand: "ZIG-ZAG", category: "Rolling Papers & Cones", recentSales: 44 },
    { id: "grinder", name: "2-Piece Grinder", variant: "", price: 9.99, cost: 3.90, brand: "ACCESSORY", category: "Accessories", recentSales: 38 },
    { id: "jewelry", name: "Body Jewelry", variant: "Assorted", price: 12.99, cost: 4.25, brand: "JEWELRY", category: "Body Jewelry", recentSales: 34 },
    { id: "novelty", name: "Novelty Item", variant: "", price: 8.99, cost: 3.20, brand: "NOVELTY", category: "Novelty", recentSales: 28 }
  ];

  const categoryIcons = {
    "Vapes": "▥",
    "Kratom": "🌿",
    "Glass": "⚗",
    "Pipes": "⌁",
    "Torches & Lighters": "🔥",
    "Accessories": "◉",
    "Body Jewelry": "◌",
    "Novelty": "👽",
    "Rolling Papers & Cones": "▭",
    "Other": "•••"
  };

  const customers = [
    { id: "c1", name: "Sarah Johnson", email: "sarah@example.com", phone: "406-555-0101", birthDate: "1991-04-12", ageVerified: true, points: 320, reward: 5 },
    { id: "c2", name: "Michael Azure", email: "", phone: "406-555-0185", birthDate: "1987-09-22", ageVerified: true, points: 185, reward: 0 },
    { id: "c3", name: "Amanda Smith", email: "amanda@example.com", phone: "", birthDate: "1994-02-03", ageVerified: true, points: 95, reward: 0 }
  ];

  const state = {
    cart: [],
    selectedCustomer: null,
    transactionDiscount: null,
    saleNote: "",
    heldSales: []
  };

  const els = {
    popularGrid: document.getElementById("popularGrid"),
    categoryGrid: document.getElementById("categoryGrid"),
    categoryProductsSection: document.getElementById("categoryProductsSection"),
    categoryProductsTitle: document.getElementById("categoryProductsTitle"),
    categoryProductsGrid: document.getElementById("categoryProductsGrid"),
    closeCategory: document.getElementById("closeCategory"),
    productSearch: document.getElementById("productSearch"),
    customerSearch: document.getElementById("customerSearch"),
    customerSearchResults: document.getElementById("customerSearchResults"),
    selectedCustomerCard: document.getElementById("selectedCustomerCard"),
    cartLines: document.getElementById("cartLines"),
    subtotalValue: document.getElementById("subtotalValue"),
    transactionDiscountRow: document.getElementById("transactionDiscountRow"),
    transactionDiscountLabel: document.getElementById("transactionDiscountLabel"),
    transactionDiscountValue: document.getElementById("transactionDiscountValue"),
    taxValue: document.getElementById("taxValue"),
    totalValue: document.getElementById("totalValue"),
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalCard: document.getElementById("modalCard"),
    toast: document.getElementById("toast")
  };

  const money = n => `$${Number(n || 0).toFixed(2)}`;
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.remove("hidden");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => els.toast.classList.add("hidden"), 2300);
  }

  function updateClock() {
    const now = new Date();
    document.getElementById("clockTime").textContent = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    document.getElementById("clockDate").textContent = now.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  }

  function productTile(p) {
    return `
      <button class="product-tile" type="button" data-product-id="${p.id}">
        <div>
          <div class="brand-mark">${escapeHtml(p.brand)}</div>
          <div class="product-name">${escapeHtml(p.name)}${p.variant ? `<br><span class="muted-note">${escapeHtml(p.variant)}</span>` : ""}</div>
        </div>
        <div class="product-price">${money(p.price)}</div>
      </button>
    `;
  }

  function renderPopular(filter = "") {
    const q = filter.trim().toLowerCase();
    const ranked = [...products]
      .filter(p => !q || `${p.brand} ${p.name} ${p.variant} ${p.category}`.toLowerCase().includes(q))
      .sort((a, b) => b.recentSales - a.recentSales)
      .slice(0, 12);

    els.popularGrid.innerHTML = ranked.map(productTile).join("") || `<div class="muted-note">No products match that search.</div>`;
  }

  function renderCategories() {
    const categories = [...new Set(products.map(p => p.category))];
    if (!categories.includes("Other")) categories.push("Other");
    els.categoryGrid.innerHTML = categories.map(c => `
      <button class="category-tile" type="button" data-category="${escapeAttr(c)}">
        <span class="category-icon">${categoryIcons[c] || "•••"}</span>
        <span>${escapeHtml(c)}</span>
      </button>
    `).join("");
  }

  function openCategory(category) {
    const list = products.filter(p => p.category === category);
    els.categoryProductsTitle.textContent = category.toUpperCase();
    els.categoryProductsGrid.innerHTML = list.map(productTile).join("") || `<div class="muted-note">No products have been added to this category yet.</div>`;
    els.categoryProductsSection.classList.remove("hidden");
    els.categoryProductsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = state.cart.find(line => line.productId === productId && !line.adjustment);
    if (existing) existing.qty += 1;
    else state.cart.push({
      lineId: cryptoRandomId(),
      productId: product.id,
      name: product.name,
      variant: product.variant,
      retailPrice: product.price,
      cost: product.cost,
      qty: 1,
      adjustment: null
    });

    renderCart();
  }

  function effectiveUnitPrice(line) {
    const a = line.adjustment;
    if (!a) return line.retailPrice;
    if (a.type === "price") return Math.max(0, a.value);
    if (a.type === "percent") return Math.max(0, line.retailPrice * (1 - a.value / 100));
    if (a.type === "dollar") return Math.max(0, line.retailPrice - a.value);
    return line.retailPrice;
  }

  function transactionSubtotalBeforeDiscount() {
    return state.cart.reduce((sum, line) => sum + effectiveUnitPrice(line) * line.qty, 0);
  }

  function transactionDiscountAmount() {
    const base = transactionSubtotalBeforeDiscount();
    const d = state.transactionDiscount;
    if (!d) return 0;
    if (d.type === "percent") return clamp(base * d.value / 100, 0, base);
    if (d.type === "dollar") return clamp(d.value, 0, base);
    return 0;
  }

  function totals() {
    const beforeDiscount = transactionSubtotalBeforeDiscount();
    const transactionDiscount = transactionDiscountAmount();
    const taxableSubtotal = Math.max(0, beforeDiscount - transactionDiscount);
    const tax = taxableSubtotal * TAX_RATE;
    return { beforeDiscount, transactionDiscount, taxableSubtotal, tax, total: taxableSubtotal + tax };
  }

  function renderCart() {
    if (!state.cart.length) {
      els.cartLines.innerHTML = `
        <div class="empty-cart">
          <strong>No items yet</strong>
          <span>Scan or tap a product to begin a sale.</span>
        </div>`;
    } else {
      els.cartLines.innerHTML = state.cart.map((line, index) => {
        const unit = effectiveUnitPrice(line);
        const adjustmentText = line.adjustment ? `${line.adjustment.label} • ${line.adjustment.reason}` : "";
        return `
          <div class="cart-line" data-line-id="${line.lineId}" title="Tap line to change price or add a discount">
            <div class="cart-product">
              <strong>${escapeHtml(line.name)}</strong>
              ${line.variant ? `<small>${escapeHtml(line.variant)}</small>` : ""}
              ${adjustmentText ? `<div class="line-adjustment">${escapeHtml(adjustmentText)}</div>` : ""}
            </div>
            <div class="qty-control">
              <button type="button" data-cart-action="minus" data-index="${index}" aria-label="Decrease quantity">−</button>
              <span>${line.qty}</span>
              <button type="button" data-cart-action="plus" data-index="${index}" aria-label="Increase quantity">+</button>
            </div>
            <div class="cart-line-total">${money(unit * line.qty)}</div>
            <button class="remove-line" type="button" data-cart-action="remove" data-index="${index}" aria-label="Remove item">×</button>
          </div>
        `;
      }).join("");
    }

    const t = totals();
    els.subtotalValue.textContent = money(t.beforeDiscount);

    if (state.transactionDiscount && t.transactionDiscount > 0) {
      els.transactionDiscountRow.classList.remove("hidden");
      els.transactionDiscountLabel.textContent = state.transactionDiscount.label;
      els.transactionDiscountValue.textContent = `-${money(t.transactionDiscount)}`;
    } else {
      els.transactionDiscountRow.classList.add("hidden");
    }

    els.taxValue.textContent = money(t.tax);
    els.totalValue.textContent = money(t.total);
  }

  function renderSelectedCustomer() {
    const c = state.selectedCustomer;
    if (!c) {
      els.selectedCustomerCard.classList.add("hidden");
      els.selectedCustomerCard.innerHTML = "";
      return;
    }

    els.selectedCustomerCard.classList.remove("hidden");
    els.selectedCustomerCard.innerHTML = `
      <div class="customer-main">
        <strong>${escapeHtml(c.name)} <span class="age-ok">✓</span></strong>
        <div class="age-ok">✓ Age Verified</div>
      </div>
      <div class="customer-loyalty">
        <strong>${c.points || 0} pts</strong><br />
        ${c.reward ? `${money(c.reward)} Reward` : "No reward available"}
      </div>
    `;
  }

  function searchCustomers(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      els.customerSearchResults.classList.add("hidden");
      els.customerSearchResults.innerHTML = "";
      return;
    }

    const results = customers.filter(c =>
      `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q)
    ).slice(0, 8);

    els.customerSearchResults.innerHTML = results.map(c => `
      <button class="search-result" type="button" data-customer-id="${c.id}">
        <strong>${escapeHtml(c.name)} ${c.ageVerified ? "✓" : ""}</strong>
        <span>${escapeHtml(c.phone || c.email || "No marketing contact")}</span>
      </button>
    `).join("") || `<div class="search-result"><span>No matching customers.</span></div>`;

    els.customerSearchResults.classList.remove("hidden");
  }

  function openModal(title, bodyHtml) {
    els.modalCard.innerHTML = `
      <div class="modal-header">
        <h3 id="modalTitle">${escapeHtml(title)}</h3>
        <button class="close-modal" type="button" data-close-modal aria-label="Close">×</button>
      </div>
      ${bodyHtml}
    `;
    els.modalBackdrop.classList.remove("hidden");
    const first = els.modalCard.querySelector("input, select, textarea, button:not([data-close-modal])");
    if (first) setTimeout(() => first.focus(), 0);
  }

  function closeModal() {
    els.modalBackdrop.classList.add("hidden");
    els.modalCard.innerHTML = "";
  }

  function openLineEditor(lineId) {
    const line = state.cart.find(l => l.lineId === lineId);
    if (!line) return;

    openModal("Edit Line Item", `
      <div class="muted-note">${escapeHtml(line.name)}${line.variant ? ` • ${escapeHtml(line.variant)}` : ""} • Original ${money(line.retailPrice)}</div>
      <form id="lineEditForm">
        <div class="form-grid" style="margin-top:12px">
          <div class="field-stack">
            <label for="linePrice">Change price to</label>
            <input id="linePrice" type="number" min="0" step="0.01" placeholder="${line.retailPrice.toFixed(2)}" />
          </div>
          <div class="field-stack">
            <label for="lineDiscountType">Discount type</label>
            <select id="lineDiscountType">
              <option value="">No discount</option>
              <option value="percent">Percentage</option>
              <option value="dollar">Dollar amount</option>
            </select>
          </div>
          <div class="field-stack">
            <label for="lineDiscountValue">Discount amount</label>
            <input id="lineDiscountValue" type="number" min="0" step="0.01" placeholder="0.00" />
          </div>
          <div class="field-stack">
            <label for="lineReason">Reason</label>
            <select id="lineReason" required>
              <option value="">Select reason</option>
              <option>Damaged Item</option>
              <option>Manager Discount</option>
              <option>Price Match</option>
              <option>Promotion</option>
              <option>Customer Courtesy</option>
              <option>Clearance</option>
              <option>Employee Discount</option>
              <option>Other</option>
            </select>
          </div>
          <div class="field-stack form-full">
            <label for="lineNote">Note (optional)</label>
            <textarea id="lineNote" rows="3" placeholder="Optional note"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" type="button" id="removeAdjustmentBtn">Remove Adjustment</button>
          <button class="secondary-btn" type="button" data-close-modal>Cancel</button>
          <button class="primary-btn" type="submit">Apply</button>
        </div>
      </form>
    `);

    const form = document.getElementById("lineEditForm");
    const price = document.getElementById("linePrice");
    const dtype = document.getElementById("lineDiscountType");
    const dvalue = document.getElementById("lineDiscountValue");
    const reason = document.getElementById("lineReason");
    const note = document.getElementById("lineNote");

    if (line.adjustment) {
      reason.value = line.adjustment.reason || "";
      note.value = line.adjustment.note || "";
      if (line.adjustment.type === "price") price.value = Number(line.adjustment.value).toFixed(2);
      else {
        dtype.value = line.adjustment.type;
        dvalue.value = line.adjustment.value;
      }
    }

    document.getElementById("removeAdjustmentBtn").addEventListener("click", () => {
      line.adjustment = null;
      renderCart();
      closeModal();
      showToast("Line adjustment removed.");
    });

    form.addEventListener("submit", e => {
      e.preventDefault();
      const reasonValue = reason.value;
      if (!reasonValue) {
        reason.focus();
        return;
      }

      const enteredPrice = price.value.trim();
      const discountType = dtype.value;
      const discountValue = Number(dvalue.value || 0);

      if (enteredPrice !== "") {
        const newPrice = Math.max(0, Number(enteredPrice));
        if (!Number.isFinite(newPrice)) return;
        line.adjustment = {
          type: "price",
          value: newPrice,
          reason: reasonValue,
          note: note.value.trim(),
          label: `Price changed to ${money(newPrice)}`,
          audit: auditRecord(line.retailPrice, newPrice, reasonValue)
        };
      } else if (discountType && discountValue > 0) {
        const safeValue = discountType === "percent" ? clamp(discountValue, 0, 100) : Math.max(0, discountValue);
        line.adjustment = {
          type: discountType,
          value: safeValue,
          reason: reasonValue,
          note: note.value.trim(),
          label: discountType === "percent" ? `${safeValue}% Off` : `${money(safeValue)} Off`,
          audit: auditRecord(line.retailPrice, effectivePreview(line.retailPrice, discountType, safeValue), reasonValue)
        };
      } else {
        line.adjustment = null;
      }

      renderCart();
      closeModal();
      showToast("Line item updated.");
    });
  }

  function openTransactionDiscountMenu() {
    openModal("Select Discount", `
      <div class="choice-list">
        <button class="choice-btn" type="button" data-discount-choice="employee">
          <strong>Employee Discount</strong>
          <span>Standard 25% discount on the transaction.</span>
        </button>
        <button class="choice-btn" type="button" data-discount-choice="percent">
          <strong>Miscellaneous Discount Percentage</strong>
          <span>Enter a custom percentage discount.</span>
        </button>
        <button class="choice-btn" type="button" data-discount-choice="dollar">
          <strong>Miscellaneous Discount Dollar Amount</strong>
          <span>Enter a custom dollar amount discount.</span>
        </button>
      </div>
      <div class="modal-actions">
        ${state.transactionDiscount ? `<button id="removeTransactionDiscountBtn" class="secondary-btn" type="button">Remove Current Discount</button>` : ""}
        <button class="secondary-btn" type="button" data-close-modal>Cancel</button>
      </div>
    `);

    els.modalCard.querySelectorAll("[data-discount-choice]").forEach(btn => {
      btn.addEventListener("click", () => {
        const choice = btn.dataset.discountChoice;
        if (choice === "employee") {
          state.transactionDiscount = { type: "percent", value: 25, label: "Employee Discount (25%)" };
          renderCart();
          closeModal();
          showToast("Employee Discount applied.");
          return;
        }
        openMiscDiscount(choice);
      });
    });

    const remove = document.getElementById("removeTransactionDiscountBtn");
    if (remove) {
      remove.addEventListener("click", () => {
        state.transactionDiscount = null;
        renderCart();
        closeModal();
        showToast("Transaction discount removed.");
      });
    }
  }

  function openMiscDiscount(type) {
    const isPct = type === "percent";
    openModal(isPct ? "Miscellaneous Discount Percentage" : "Miscellaneous Discount Dollar Amount", `
      <form id="miscDiscountForm">
        <div class="field-stack">
          <label for="miscDiscountValue">${isPct ? "Percentage" : "Dollar amount"}</label>
          <input id="miscDiscountValue" type="number" min="0" ${isPct ? 'max="100"' : ""} step="0.01" required placeholder="${isPct ? "10" : "5.00"}" />
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" type="button" data-close-modal>Cancel</button>
          <button class="primary-btn" type="submit">Apply Discount</button>
        </div>
      </form>
    `);

    document.getElementById("miscDiscountForm").addEventListener("submit", e => {
      e.preventDefault();
      let value = Number(document.getElementById("miscDiscountValue").value || 0);
      if (!Number.isFinite(value) || value <= 0) return;
      if (isPct) value = clamp(value, 0, 100);
      state.transactionDiscount = {
        type,
        value,
        label: isPct ? `Misc. Discount (${value}%)` : `Misc. Discount (${money(value)})`
      };
      renderCart();
      closeModal();
      showToast("Discount applied.");
    });
  }

  function openNewCustomer() {
    openModal("New Customer", `
      <form id="newCustomerForm">
        <div class="form-grid">
          <div class="field-stack">
            <label for="newCustomerName">Name *</label>
            <input id="newCustomerName" required autocomplete="name" />
          </div>
          <div class="field-stack">
            <label for="newCustomerBirthDate">Birth Date *</label>
            <input id="newCustomerBirthDate" type="date" required />
          </div>
          <div class="field-stack">
            <label for="newCustomerPhone">Phone</label>
            <input id="newCustomerPhone" type="tel" autocomplete="tel" />
          </div>
          <div class="field-stack">
            <label for="newCustomerEmail">Email</label>
            <input id="newCustomerEmail" type="email" autocomplete="email" />
          </div>
        </div>
        <p class="muted-note" style="margin:10px 0 0">Phone and email are optional. Without at least one, the customer is not eligible for electronic marketing promotions. Saving this customer records the initial ID check and marks age verification OK for future transactions.</p>
        <div class="modal-actions">
          <button class="secondary-btn" type="button" data-close-modal>Cancel</button>
          <button class="primary-btn" type="submit">Save Customer</button>
        </div>
      </form>
    `);

    document.getElementById("newCustomerForm").addEventListener("submit", e => {
      e.preventDefault();
      const c = {
        id: cryptoRandomId(),
        name: document.getElementById("newCustomerName").value.trim(),
        birthDate: document.getElementById("newCustomerBirthDate").value,
        phone: document.getElementById("newCustomerPhone").value.trim(),
        email: document.getElementById("newCustomerEmail").value.trim(),
        ageVerified: true,
        points: 0,
        reward: 0
      };
      if (!c.name || !c.birthDate) return;
      customers.push(c);
      state.selectedCustomer = c;
      renderSelectedCustomer();
      document.getElementById("customerSearch").value = "";
      closeModal();
      showToast(`${c.name} added and age verified.`);
    });
  }

  function openSplitPayment() {
    const t = totals();
    if (t.total <= 0) return showToast("Add items before taking payment.");

    openModal("Split Payment", `
      <form id="splitPaymentForm">
        <div class="field-stack">
          <label for="splitFirstAmount">First payment amount</label>
          <input id="splitFirstAmount" type="number" min="0" max="${t.total.toFixed(2)}" step="0.01" value="0.00" required />
        </div>
        <div class="form-grid" style="margin-top:10px">
          <div class="field-stack">
            <label for="splitFirstType">First payment type</label>
            <select id="splitFirstType"><option>Cash</option><option>Card</option></select>
          </div>
          <div class="field-stack">
            <label for="splitSecondType">Remaining payment type</label>
            <select id="splitSecondType"><option>Card</option><option>Cash</option></select>
          </div>
        </div>
        <div class="split-summary">
          <div><span>Total due</span><strong>${money(t.total)}</strong></div>
          <div><span>First payment</span><strong id="splitFirstDisplay">$0.00</strong></div>
          <div><span>Remaining</span><strong id="splitRemainingDisplay">${money(t.total)}</strong></div>
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" type="button" data-close-modal>Cancel</button>
          <button class="primary-btn" type="submit">Continue</button>
        </div>
      </form>
    `);

    const first = document.getElementById("splitFirstAmount");
    const firstDisplay = document.getElementById("splitFirstDisplay");
    const remainDisplay = document.getElementById("splitRemainingDisplay");

    const recalc = () => {
      const val = clamp(Number(first.value || 0), 0, t.total);
      firstDisplay.textContent = money(val);
      remainDisplay.textContent = money(t.total - val);
    };
    first.addEventListener("input", recalc);
    recalc();

    document.getElementById("splitPaymentForm").addEventListener("submit", e => {
      e.preventDefault();
      const firstAmount = clamp(Number(first.value || 0), 0, t.total);
      if (firstAmount <= 0 || firstAmount >= t.total) {
        showToast("Enter a split amount greater than $0 and less than the total.");
        return;
      }
      const secondAmount = t.total - firstAmount;
      const firstType = document.getElementById("splitFirstType").value;
      const secondType = document.getElementById("splitSecondType").value;
      closeModal();
      showToast(`${firstType} ${money(firstAmount)} + ${secondType} ${money(secondAmount)} ready.`);
    });
  }

  function openSaleNote() {
    openModal("Sale Note", `
      <div class="field-stack">
        <label for="saleNoteText">Note</label>
        <textarea id="saleNoteText" rows="5" placeholder="Optional transaction note">${escapeHtml(state.saleNote)}</textarea>
      </div>
      <div class="modal-actions">
        <button class="secondary-btn" type="button" data-close-modal>Cancel</button>
        <button class="primary-btn" id="saveSaleNoteBtn" type="button">Save Note</button>
      </div>
    `);
    document.getElementById("saveSaleNoteBtn").addEventListener("click", () => {
      state.saleNote = document.getElementById("saleNoteText").value.trim();
      closeModal();
      showToast(state.saleNote ? "Sale note saved." : "Sale note cleared.");
    });
  }

  function completePayment(method) {
    const t = totals();
    if (!state.cart.length || t.total <= 0) return showToast("Add items before taking payment.");

    const transaction = {
      transactionId: `SS-${Date.now()}`,
      createdAt: new Date().toISOString(),
      employee: "John Smith",
      customerId: state.selectedCustomer?.id || null,
      customerName: state.selectedCustomer?.name || null,
      lineItems: structuredCloneSafe(state.cart),
      transactionDiscount: state.transactionDiscount ? { ...state.transactionDiscount } : null,
      note: state.saleNote,
      subtotal: t.beforeDiscount,
      discountAmount: t.transactionDiscount,
      tax: t.tax,
      total: t.total,
      payment: [{ method, amount: t.total }]
    };

    console.log("Completed Smoke Signals transaction", transaction);
    showToast(`${method} payment ${money(t.total)} completed (prototype).`);
    clearSale(false);
  }

  function holdSale() {
    if (!state.cart.length) return showToast("Nothing to hold.");
    state.heldSales.push({
      heldAt: new Date().toISOString(),
      cart: structuredCloneSafe(state.cart),
      customer: state.selectedCustomer ? { ...state.selectedCustomer } : null,
      discount: state.transactionDiscount ? { ...state.transactionDiscount } : null,
      note: state.saleNote
    });
    clearSale(false);
    showToast("Sale held.");
  }

  function clearSale(confirmFirst = true) {
    if (confirmFirst && state.cart.length && !window.confirm("Clear the current sale?")) return;
    state.cart = [];
    state.transactionDiscount = null;
    state.saleNote = "";
    state.selectedCustomer = null;
    renderSelectedCustomer();
    renderCart();
  }

  function auditRecord(originalPrice, adjustedPrice, reason) {
    return {
      employee: "John Smith",
      timestamp: new Date().toISOString(),
      originalPrice,
      adjustedPrice,
      reason
    };
  }

  function effectivePreview(price, type, value) {
    return type === "percent" ? price * (1 - value / 100) : Math.max(0, price - value);
  }

  function cryptoRandomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function structuredCloneSafe(obj) {
    if (window.structuredClone) return structuredClone(obj);
    return JSON.parse(JSON.stringify(obj));
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[ch]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  // Event wiring
  document.addEventListener("click", e => {
    const product = e.target.closest("[data-product-id]");
    if (product) {
      addToCart(product.dataset.productId);
      return;
    }

    const cat = e.target.closest("[data-category]");
    if (cat) {
      openCategory(cat.dataset.category);
      return;
    }

    const customer = e.target.closest("[data-customer-id]");
    if (customer) {
      state.selectedCustomer = customers.find(c => c.id === customer.dataset.customerId) || null;
      renderSelectedCustomer();
      els.customerSearch.value = "";
      els.customerSearchResults.classList.add("hidden");
      return;
    }

    const cartAction = e.target.closest("[data-cart-action]");
    if (cartAction) {
      e.stopPropagation();
      const index = Number(cartAction.dataset.index);
      const line = state.cart[index];
      if (!line) return;
      const action = cartAction.dataset.cartAction;
      if (action === "plus") line.qty += 1;
      if (action === "minus") {
        line.qty -= 1;
        if (line.qty <= 0) state.cart.splice(index, 1);
      }
      if (action === "remove") state.cart.splice(index, 1);
      renderCart();
      return;
    }

    const cartLine = e.target.closest(".cart-line");
    if (cartLine) {
      openLineEditor(cartLine.dataset.lineId);
      return;
    }

    if (e.target.closest("[data-close-modal]") || e.target === els.modalBackdrop) {
      closeModal();
    }
  });

  els.productSearch.addEventListener("input", e => renderPopular(e.target.value));
  els.productSearch.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      e.preventDefault();
      const q = els.productSearch.value.trim().toLowerCase();
      const match = products.find(p => `${p.id} ${p.brand} ${p.name} ${p.variant}`.toLowerCase().includes(q));
      if (match) {
        addToCart(match.id);
        els.productSearch.value = "";
        renderPopular();
      }
    }
  });

  els.customerSearch.addEventListener("input", e => searchCustomers(e.target.value));
  document.getElementById("newCustomerBtn").addEventListener("click", openNewCustomer);
  document.getElementById("discountBtn").addEventListener("click", openTransactionDiscountMenu);
  document.getElementById("splitPaymentBtn").addEventListener("click", openSplitPayment);
  document.getElementById("saleNoteBtn").addEventListener("click", openSaleNote);
  document.getElementById("holdBtn").addEventListener("click", holdSale);
  document.getElementById("clearSaleBtn").addEventListener("click", () => clearSale(true));
  document.getElementById("cashBtn").addEventListener("click", () => completePayment("Cash"));
  document.getElementById("cardBtn").addEventListener("click", () => completePayment("Card"));
  els.closeCategory.addEventListener("click", () => els.categoryProductsSection.classList.add("hidden"));

  renderPopular();
  renderCategories();
  renderSelectedCustomer();
  renderCart();
  updateClock();
  setInterval(updateClock, 30000);
})();
