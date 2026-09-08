(() => {
  "use strict";

  const TX_KEY = "sspos_transactions_v1";
  const TX_SEQ_KEY = "sspos_transaction_sequence_v1";
  const BUILD = "0.1.21";

  const $ = id => document.getElementById(id);
  const money = n => `$${Number(n || 0).toFixed(2)}`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const round2 = n => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  function loadTransactions(){
    try { return JSON.parse(localStorage.getItem(TX_KEY) || "[]"); }
    catch { return []; }
  }

  function saveTransactions(list){
    localStorage.setItem(TX_KEY, JSON.stringify(list));
  }

  function nextTransactionNumber(){
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth()+1).padStart(2,"0");
    const d = String(today.getDate()).padStart(2,"0");
    const dateKey = `${y}${m}${d}`;
    let state = {dateKey, seq:0};
    try { state = JSON.parse(localStorage.getItem(TX_SEQ_KEY) || JSON.stringify(state)); } catch {}
    if (state.dateKey !== dateKey) state = {dateKey, seq:0};
    state.seq += 1;
    localStorage.setItem(TX_SEQ_KEY, JSON.stringify(state));
    return `SS-${dateKey}-${String(state.seq).padStart(4,"0")}`;
  }

  function cartSnapshot(){
    const lines = [...document.querySelectorAll("#cartLines .cart-line")].map(row => {
      const qty = Number(row.querySelector(".qty span")?.textContent || 1);
      const lineTotalText = row.querySelector(".line-total")?.textContent || "$0";
      const lineTotal = Number(lineTotalText.replace(/[^0-9.-]/g,"")) || 0;
      return {
        name: row.querySelector(".cart-product strong")?.textContent?.trim() || "Item",
        qty,
        lineTotal: round2(lineTotal),
        unitPrice: qty ? round2(lineTotal / qty) : round2(lineTotal),
        adjustment: row.querySelector(".line-adjustment")?.textContent?.trim() || ""
      };
    });

    const subtotal = Number(($('subtotalValue')?.textContent || "$0").replace(/[^0-9.-]/g,"")) || 0;
    const total = Number(($('totalValue')?.textContent || "$0").replace(/[^0-9.-]/g,"")) || 0;
    const discountRow = $('discountRow');
    const discountVisible = discountRow && !discountRow.classList.contains("hidden");
    const discountAmount = discountVisible ? Math.abs(Number(($('discountValue')?.textContent || "$0").replace(/[^0-9.-]/g,"")) || 0) : 0;
    const discountLabel = discountVisible ? ($('discountLabel')?.textContent?.trim() || "Discount") : "";

    const selectedCustomer = $('selectedCustomer');
    const customerName = selectedCustomer && !selectedCustomer.classList.contains("hidden")
      ? (selectedCustomer.querySelector("strong")?.textContent?.trim() || selectedCustomer.textContent.trim())
      : "Walk-in";

    return {
      lines,
      subtotal: round2(subtotal),
      discountAmount: round2(discountAmount),
      discountLabel,
      total: round2(total),
      customerName,
      note: ""
    };
  }

  function hasSale(){
    return document.querySelectorAll("#cartLines .cart-line").length > 0 && cartSnapshot().total >= 0;
  }

  function openFlowModal(title, body){
    const card = $('modalCard');
    const backdrop = $('modalBackdrop');
    if (!card || !backdrop) return;
    card.innerHTML = `<div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" data-tx-close type="button">×</button></div>${body}`;
    backdrop.classList.remove("hidden");
    setTimeout(() => card.querySelector("input,button:not([data-tx-close]),select")?.focus(), 0);
  }

  function closeFlowModal(){
    $('modalBackdrop')?.classList.add("hidden");
    if ($('modalCard')) $('modalCard').innerHTML = "";
  }

  function toast(message){
    const t = $('toast');
    if (!t) return;
    t.textContent = message;
    t.classList.remove("hidden");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.add("hidden"), 2300);
  }

  function clearCurrentSale(){
    const clearBtn = $('clearSaleBtn');
    if (!clearBtn) return;
    const originalConfirm = window.confirm;
    try {
      window.confirm = () => true;
      clearBtn.click();
    } finally {
      window.confirm = originalConfirm;
    }
  }

  function saveCompletedTransaction(paymentRecords){
    const snap = cartSnapshot();
    const tx = {
      id: crypto?.randomUUID ? crypto.randomUUID() : `tx-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
      transactionNumber: nextTransactionNumber(),
      createdAt: new Date().toISOString(),
      status: "Completed",
      employee: "Owner",
      customerName: snap.customerName,
      items: snap.lines,
      subtotal: snap.subtotal,
      discountAmount: snap.discountAmount,
      discountLabel: snap.discountLabel,
      total: snap.total,
      payments: paymentRecords,
      build: BUILD
    };
    const list = loadTransactions();
    list.unshift(tx);
    saveTransactions(list);
    clearCurrentSale();
    closeFlowModal();
    toast(`${tx.transactionNumber} completed.`);
    return tx;
  }

  function openCashFlow(){
    if (!hasSale()) { toast("Add an item before taking payment."); return; }
    const due = cartSnapshot().total;
    openFlowModal("Cash Payment", `
      <div class="tx-payment-due"><span>Amount Due</span><strong>${money(due)}</strong></div>
      <div class="field tx-field"><label>Cash Received</label><input id="txCashReceived" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></div>
      <div class="tx-quick-cash">
        <button type="button" data-cash-quick="exact">Exact ${money(due)}</button>
        <button type="button" data-cash-quick="20">$20</button>
        <button type="button" data-cash-quick="50">$50</button>
        <button type="button" data-cash-quick="100">$100</button>
      </div>
      <div class="tx-change-row"><span>Change Due</span><strong id="txCashChange">$0.00</strong></div>
      <div id="txCashMessage" class="tx-payment-message"></div>
      <div class="modal-actions"><button class="secondary-btn" data-tx-close type="button">Cancel</button><button id="txCompleteCash" class="primary-btn" type="button" disabled>Complete Cash Sale</button></div>`);

    const input = $('txCashReceived');
    const complete = $('txCompleteCash');
    const changeEl = $('txCashChange');
    const message = $('txCashMessage');

    function update(){
      const received = round2(Number(input.value || 0));
      const change = round2(Math.max(0, received - due));
      changeEl.textContent = money(change);
      const enough = received >= due;
      complete.disabled = !enough;
      message.textContent = enough ? "" : (received > 0 ? `${money(round2(due-received))} still due.` : "");
    }

    input.addEventListener("input", update);
    document.querySelectorAll("[data-cash-quick]").forEach(btn => btn.addEventListener("click", () => {
      const v = btn.dataset.cashQuick === "exact" ? due : Number(btn.dataset.cashQuick);
      input.value = Number(v).toFixed(2);
      update();
      input.focus();
      input.select();
    }));

    complete.addEventListener("click", () => {
      const received = round2(Number(input.value || 0));
      if (received < due) return;
      const change = round2(received - due);
      saveCompletedTransaction([{type:"Cash", amount:due, cashReceived:received, changeGiven:change}]);
    });
  }

  function cardTerminalBody(amount, onApprove){
    return `
      <div class="tx-payment-due"><span>Card Amount</span><strong>${money(amount)}</strong></div>
      <div class="tx-terminal-status waiting"><span class="tx-terminal-dot"></span><div><strong>Waiting for terminal</strong><small>Development simulation — live terminal integration comes later.</small></div></div>
      <div id="txCardResult" class="tx-payment-message"></div>
      <div class="tx-terminal-actions">
        <button id="txSimApprove" class="primary-btn" type="button">Simulate Approved</button>
        <button id="txSimDecline" class="danger-btn" type="button">Simulate Declined</button>
      </div>
      <div class="modal-actions"><button class="secondary-btn" data-tx-close type="button">Cancel</button></div>`;
  }

  function wireCardTerminal(amount, onApprove){
    $('txSimApprove')?.addEventListener("click", () => {
      const approvalCode = `SIM${Math.floor(100000 + Math.random()*900000)}`;
      onApprove({type:"Card", amount:round2(amount), status:"Approved", processor:"Simulation", approvalCode});
    });
    $('txSimDecline')?.addEventListener("click", () => {
      const status = document.querySelector(".tx-terminal-status");
      if (status){ status.classList.remove("waiting"); status.classList.add("declined"); status.querySelector("strong").textContent = "Card declined"; }
      const msg = $('txCardResult');
      if (msg) msg.textContent = "No transaction was completed. The sale remains open so you can retry or choose another payment method.";
    });
  }

  function openCardFlow(){
    if (!hasSale()) { toast("Add an item before taking payment."); return; }
    const due = cartSnapshot().total;
    openFlowModal("Card Payment", cardTerminalBody(due));
    wireCardTerminal(due, payment => saveCompletedTransaction([payment]));
  }

  function openSplitFlow(){
    if (!hasSale()) { toast("Add items before splitting payment."); return; }
    const total = cartSnapshot().total;
    openFlowModal("Split Payment", `
      <div class="tx-payment-due"><span>Total Due</span><strong>${money(total)}</strong></div>
      <div class="tx-split-grid">
        <div class="field tx-field"><label>Cash Portion Applied to Sale</label><input id="txSplitCashApplied" type="number" min="0" max="${total.toFixed(2)}" step="0.01" inputmode="decimal" value="0.00"></div>
        <div class="field tx-field"><label>Cash Received from Customer</label><input id="txSplitCashReceived" type="number" min="0" step="0.01" inputmode="decimal" value="0.00"></div>
      </div>
      <div class="tx-split-summary">
        <div><span>Cash Applied</span><strong id="txSplitCashDisplay">$0.00</strong></div>
        <div><span>Cash Received</span><strong id="txSplitReceivedDisplay">$0.00</strong></div>
        <div><span>Change Due</span><strong id="txSplitChangeDisplay">$0.00</strong></div>
        <div class="tx-split-card"><span>Card Portion</span><strong id="txSplitCardDisplay">${money(total)}</strong></div>
      </div>
      <div id="txSplitMessage" class="tx-payment-message"></div>
      <div class="modal-actions"><button class="secondary-btn" data-tx-close type="button">Cancel</button><button id="txSplitContinue" class="primary-btn" type="button">Process Card Portion</button></div>`);

    const appliedInput = $('txSplitCashApplied');
    const receivedInput = $('txSplitCashReceived');
    const continueBtn = $('txSplitContinue');
    const message = $('txSplitMessage');

    function values(){
      const applied = round2(Math.max(0, Number(appliedInput.value || 0)));
      const received = round2(Math.max(0, Number(receivedInput.value || 0)));
      const card = round2(Math.max(0, total - applied));
      const change = round2(Math.max(0, received - applied));
      return {applied, received, card, change};
    }

    function update(){
      let {applied, received, card, change} = values();
      const overApplied = applied > total;
      $('txSplitCashDisplay').textContent = money(applied);
      $('txSplitReceivedDisplay').textContent = money(received);
      $('txSplitChangeDisplay').textContent = money(change);
      $('txSplitCardDisplay').textContent = money(card);
      const cashValid = applied === 0 ? received === 0 : received >= applied;
      continueBtn.disabled = overApplied || !cashValid;
      continueBtn.textContent = card > 0 ? "Process Card Portion" : "Complete Cash Portion";
      if (overApplied) message.textContent = "Cash portion cannot be greater than the sale total.";
      else if (applied > 0 && received < applied) message.textContent = `${money(round2(applied-received))} more cash must be received for the cash portion.`;
      else if (applied === 0 && received > 0) message.textContent = "Enter the cash amount being applied to the sale, or set Cash Received back to $0.00.";
      else message.textContent = "";
    }

    appliedInput.addEventListener("input", update);
    receivedInput.addEventListener("input", update);
    update();

    continueBtn.addEventListener("click", () => {
      const {applied, received, card, change} = values();
      if (applied > total || (applied > 0 && received < applied) || (applied === 0 && received > 0)) return;
      const cashPayment = applied > 0 ? {type:"Cash", amount:applied, cashReceived:received, changeGiven:change} : null;
      if (card <= 0){
        if (!cashPayment) return;
        saveCompletedTransaction([cashPayment]);
        return;
      }

      openFlowModal("Split Payment — Card Portion", `
        <div class="tx-split-recap"><span>Cash Applied: <strong>${money(applied)}</strong></span><span>Cash Received: <strong>${money(received)}</strong></span><span>Change: <strong>${money(change)}</strong></span></div>
        ${cardTerminalBody(card)}`);
      wireCardTerminal(card, cardPayment => {
        const payments = [];
        if (cashPayment) payments.push(cashPayment);
        payments.push(cardPayment);
        saveCompletedTransaction(payments);
      });
    });
  }

  function paymentLabel(tx){
    const types = [...new Set((tx.payments || []).map(p => p.type))];
    return types.length > 1 ? "Split" : (types[0] || "—");
  }

  function formatDate(iso){
    const d = new Date(iso);
    return `${d.toLocaleDateString([], {month:"short",day:"numeric",year:"numeric"})} ${d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`;
  }

  function renderTransactionsView(){
    const sale = $('saleView');
    const inv = $('inventoryView');
    const placeholder = $('placeholderView');
    if (!placeholder) return;
    sale?.classList.add("hidden");
    inv?.classList.add("hidden");
    placeholder.classList.remove("hidden");

    document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === "transactions"));

    const list = loadTransactions();
    placeholder.innerHTML = `
      <div class="transactions-page">
        <div class="transactions-head"><div><h1>Transactions</h1><p>Completed Smoke Signals sales are stored here on this device.</p></div><div class="tx-count-badge">${list.length} transaction${list.length===1?"":"s"}</div></div>
        <div class="transactions-tools"><input id="txHistorySearch" type="search" placeholder="Search transaction #, customer, payment type, or item..."></div>
        <div class="transactions-table-wrap">
          <table class="transactions-table"><thead><tr><th>Transaction #</th><th>Date / Time</th><th>Customer</th><th>Employee</th><th>Payment</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody id="txHistoryBody"></tbody></table>
        </div>
      </div>`;

    const tbody = $('txHistoryBody');
    const search = $('txHistorySearch');
    function draw(){
      const q = (search.value || "").trim().toLowerCase();
      const filtered = !q ? list : list.filter(tx => {
        const hay = `${tx.transactionNumber} ${tx.customerName} ${tx.employee} ${paymentLabel(tx)} ${(tx.items||[]).map(i=>i.name).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
      tbody.innerHTML = filtered.length ? filtered.map(tx => `
        <tr class="tx-history-row" data-tx-id="${esc(tx.id)}">
          <td><strong>${esc(tx.transactionNumber)}</strong></td><td>${esc(formatDate(tx.createdAt))}</td><td>${esc(tx.customerName || "Walk-in")}</td><td>${esc(tx.employee || "Owner")}</td><td>${esc(paymentLabel(tx))}</td><td>${(tx.items||[]).reduce((s,i)=>s+Number(i.qty||0),0)}</td><td><strong>${money(tx.total)}</strong></td><td><span class="tx-status-completed">${esc(tx.status || "Completed")}</span></td>
        </tr>`).join("") : `<tr><td colspan="8" class="tx-empty">No completed transactions found.</td></tr>`;
    }
    search.addEventListener("input", draw);
    draw();
  }

  function openTransactionDetail(id){
    const tx = loadTransactions().find(t => String(t.id) === String(id));
    if (!tx) return;
    const paymentRows = (tx.payments || []).map(p => `
      <div class="tx-detail-payment"><span>${esc(p.type)}</span><strong>${money(p.amount)}</strong>${p.type === "Cash" ? `<small>Received ${money(p.cashReceived)} · Change ${money(p.changeGiven)}</small>` : `<small>${esc(p.status || "Approved")}${p.approvalCode ? ` · Approval ${esc(p.approvalCode)}`:""}</small>`}</div>`).join("");
    openFlowModal(tx.transactionNumber, `
      <div class="tx-detail-meta"><div><span>Date / Time</span><strong>${esc(formatDate(tx.createdAt))}</strong></div><div><span>Customer</span><strong>${esc(tx.customerName || "Walk-in")}</strong></div><div><span>Employee</span><strong>${esc(tx.employee || "Owner")}</strong></div><div><span>Status</span><strong>${esc(tx.status || "Completed")}</strong></div></div>
      <div class="tx-detail-lines">${(tx.items||[]).map(i => `<div><span>${esc(i.name)} × ${i.qty}${i.adjustment?`<small>${esc(i.adjustment)}</small>`:""}</span><strong>${money(i.lineTotal)}</strong></div>`).join("")}</div>
      <div class="tx-detail-totals"><div><span>Subtotal</span><strong>${money(tx.subtotal)}</strong></div>${tx.discountAmount?`<div><span>${esc(tx.discountLabel || "Discount")}</span><strong>-${money(tx.discountAmount)}</strong></div>`:""}<div class="total"><span>Total</span><strong>${money(tx.total)}</strong></div></div>
      <h4 class="tx-payment-heading">Payment</h4>${paymentRows}
      <div class="modal-actions"><button class="primary-btn" data-tx-close type="button">Close</button></div>`);
  }

  const style = document.createElement("style");
  style.textContent = `
    .tx-payment-due{display:flex;justify-content:space-between;align-items:end;padding:14px;border:1px solid var(--border);border-radius:12px;background:#f7faf7;margin-bottom:14px}.tx-payment-due span{font-size:13px;color:var(--muted);font-weight:800}.tx-payment-due strong{font-size:30px;color:var(--green2)}
    .tx-field input{font-size:20px;font-weight:800}.tx-quick-cash{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:10px 0}.tx-quick-cash button{border:1px solid var(--border);background:#fff;border-radius:9px;padding:10px 6px;font-weight:850}.tx-change-row{display:flex;justify-content:space-between;align-items:center;padding:13px 0;border-top:1px solid var(--border);font-weight:850}.tx-change-row strong{font-size:24px;color:var(--green2)}.tx-payment-message{min-height:18px;color:var(--danger);font-size:12px;font-weight:750;margin-top:5px}
    .tx-terminal-status{display:flex;align-items:center;gap:10px;border:1px solid var(--border);border-radius:12px;padding:15px;background:#fafcfb}.tx-terminal-dot{width:12px;height:12px;border-radius:50%;background:#d99520;box-shadow:0 0 0 5px rgba(217,149,32,.12)}.tx-terminal-status strong,.tx-terminal-status small{display:block}.tx-terminal-status small{color:var(--muted);margin-top:3px}.tx-terminal-status.declined .tx-terminal-dot{background:var(--danger);box-shadow:0 0 0 5px rgba(183,43,43,.12)}.tx-terminal-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
    .tx-split-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tx-split-summary{border:1px solid var(--border);border-radius:12px;margin-top:12px;overflow:hidden}.tx-split-summary>div{display:flex;justify-content:space-between;padding:9px 12px;border-bottom:1px solid var(--border)}.tx-split-summary>div:last-child{border-bottom:0}.tx-split-card{background:#f7faf7;font-size:16px}.tx-split-recap{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:12px}.tx-split-recap span{border:1px solid var(--border);border-radius:8px;padding:8px;font-size:11px;text-align:center}.tx-split-recap strong{display:block;margin-top:2px;font-size:14px}
    .transactions-page{min-width:0}.transactions-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.transactions-head h1{margin:0}.transactions-head p{margin:4px 0 0;color:var(--muted);font-size:13px}.tx-count-badge{background:var(--greenSoft);color:var(--green2);font-weight:850;border-radius:999px;padding:7px 11px;font-size:12px}.transactions-tools{margin:14px 0}.transactions-tools input{width:100%;border:1px solid var(--border);border-radius:10px;padding:11px;background:#fff;outline:0}.transactions-table-wrap{background:#fff;border:1px solid var(--border);border-radius:12px;overflow:auto}.transactions-table{width:100%;border-collapse:collapse;min-width:900px}.transactions-table th,.transactions-table td{padding:11px;border-bottom:1px solid var(--border);font-size:12px;text-align:left}.transactions-table th{background:#f1f4f2;font-size:11px;text-transform:uppercase;letter-spacing:.03em}.tx-history-row{cursor:pointer}.tx-history-row:hover{background:#f8fbf8}.tx-status-completed{display:inline-block;border-radius:999px;background:var(--greenSoft);color:var(--green2);padding:4px 7px;font-weight:850}.tx-empty{text-align:center!important;color:var(--muted);padding:30px!important}
    .tx-detail-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}.tx-detail-meta>div{border:1px solid var(--border);border-radius:9px;padding:9px}.tx-detail-meta span,.tx-detail-meta strong{display:block}.tx-detail-meta span{font-size:10px;color:var(--muted);text-transform:uppercase;font-weight:850}.tx-detail-meta strong{margin-top:3px;font-size:13px}.tx-detail-lines{border:1px solid var(--border);border-radius:10px;overflow:hidden}.tx-detail-lines>div,.tx-detail-totals>div{display:flex;justify-content:space-between;gap:12px;padding:9px 10px;border-bottom:1px solid var(--border)}.tx-detail-lines>div:last-child{border-bottom:0}.tx-detail-lines small{display:block;color:var(--green);font-size:10px;margin-top:2px}.tx-detail-totals{margin-top:10px}.tx-detail-totals .total{font-size:18px;font-weight:900;border-top:2px solid var(--border)}.tx-payment-heading{margin:14px 0 7px}.tx-detail-payment{display:grid;grid-template-columns:1fr auto;gap:3px 10px;border:1px solid var(--border);border-radius:9px;padding:10px;margin-bottom:6px}.tx-detail-payment small{grid-column:1/-1;color:var(--muted)}
    @media(max-width:700px){.tx-quick-cash{grid-template-columns:1fr 1fr}.tx-split-grid,.tx-detail-meta,.tx-split-recap{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  window.addEventListener("click", e => {
    const cash = e.target.closest?.("#cashBtn");
    if (cash){ e.preventDefault(); e.stopImmediatePropagation(); openCashFlow(); return; }
    const card = e.target.closest?.("#cardBtn");
    if (card){ e.preventDefault(); e.stopImmediatePropagation(); openCardFlow(); return; }
    const split = e.target.closest?.("#splitPaymentBtn");
    if (split){ e.preventDefault(); e.stopImmediatePropagation(); openSplitFlow(); return; }
    const txNav = e.target.closest?.('.nav-btn[data-view="transactions"]');
    if (txNav){ e.preventDefault(); e.stopImmediatePropagation(); renderTransactionsView(); return; }
    const row = e.target.closest?.(".tx-history-row");
    if (row){ e.preventDefault(); openTransactionDetail(row.dataset.txId); return; }
    if (e.target.closest?.("[data-tx-close]")){ e.preventDefault(); closeFlowModal(); }
  }, true);
})();
