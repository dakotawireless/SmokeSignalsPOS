(() => {
  "use strict";

  const TX_KEY = "sspos_transactions_v1";
  const BUILD = "0.1.22";
  const $ = id => document.getElementById(id);
  const money = n => `$${Number(n || 0).toFixed(2)}`;
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  function loadTransactions(){
    try { return JSON.parse(localStorage.getItem(TX_KEY) || "[]"); }
    catch { return []; }
  }

  let lastFirstId = String(loadTransactions()[0]?.id || "");

  function closeReceiptModal(){
    $('modalBackdrop')?.classList.add('hidden');
    if ($('modalCard')) $('modalCard').innerHTML = '';
  }

  function formatDate(iso){
    const d = new Date(iso);
    return `${d.toLocaleDateString([], {month:"numeric",day:"numeric",year:"numeric"})} ${d.toLocaleTimeString([], {hour:"numeric",minute:"2-digit"})}`;
  }

  function receiptHtml(tx){
    const itemRows = (tx.items || []).map(item => `
      <div class="item">
        <div class="item-name">${esc(item.name)}</div>
        <div class="item-line"><span>${Number(item.qty || 0)} x ${money(item.unitPrice)}</span><strong>${money(item.lineTotal)}</strong></div>
        ${item.adjustment ? `<div class="adjustment">${esc(item.adjustment)}</div>` : ""}
      </div>`).join("");

    const paymentRows = (tx.payments || []).map(p => {
      if (p.type === "Cash") {
        return `
          <div class="row"><span>Cash</span><strong>${money(p.amount)}</strong></div>
          <div class="subrow"><span>Cash Received</span><span>${money(p.cashReceived)}</span></div>
          <div class="subrow"><span>Change</span><span>${money(p.changeGiven)}</span></div>`;
      }
      return `
        <div class="row"><span>Card</span><strong>${money(p.amount)}</strong></div>
        ${p.approvalCode ? `<div class="subrow"><span>Approval</span><span>${esc(p.approvalCode)}</span></div>` : ""}`;
    }).join("");

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(tx.transactionNumber || "Receipt")}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  html,body{margin:0;padding:0;background:#fff;color:#000}
  body{width:72mm;margin:0 auto;padding:4mm 0 6mm;font-family:"Courier New",monospace;font-size:11px;line-height:1.28}
  *{box-sizing:border-box}
  .center{text-align:center}.store{font-size:19px;font-weight:900;letter-spacing:.5px}.small{font-size:9px}
  .rule{border-top:1px dashed #000;margin:7px 0}.row,.subrow,.item-line{display:flex;justify-content:space-between;gap:8px}
  .row{padding:2px 0}.subrow{font-size:9px;padding:1px 0}.item{padding:3px 0}.item-name{font-weight:700;word-break:break-word}.item-line{margin-top:1px}.adjustment{font-size:9px;margin-top:1px}
  .total{font-size:15px;font-weight:900;padding-top:3px}.footer{margin-top:10px;text-align:center;font-size:10px}
  @media print{body{width:72mm} }
</style>
</head>
<body>
  <div class="center store">SMOKE SIGNALS</div>
  <div class="center">Wolf Point, MT</div>
  <div class="rule"></div>
  <div>Transaction: ${esc(tx.transactionNumber || "")}</div>
  <div>Date: ${esc(formatDate(tx.createdAt))}</div>
  <div>Employee: ${esc(tx.employee || "Owner")}</div>
  ${tx.customerName && tx.customerName !== "Walk-in" ? `<div>Customer: ${esc(tx.customerName)}</div>` : ""}
  <div class="rule"></div>
  ${itemRows}
  <div class="rule"></div>
  <div class="row"><span>Subtotal</span><strong>${money(tx.subtotal)}</strong></div>
  ${tx.discountAmount ? `<div class="row"><span>${esc(tx.discountLabel || "Discount")}</span><strong>-${money(tx.discountAmount)}</strong></div>` : ""}
  <div class="row total"><span>TOTAL</span><strong>${money(tx.total)}</strong></div>
  <div class="rule"></div>
  ${paymentRows}
  <div class="rule"></div>
  <div class="footer">Thank you!</div>
  <div class="center small">Smoke Signals POS • Build ${BUILD}</div>
<script>
  window.addEventListener('load',()=>setTimeout(()=>window.print(),100));
  window.addEventListener('afterprint',()=>window.close());
<\/script>
</body>
</html>`;
  }

  function printReceipt(tx){
    const win = window.open('', '_blank', 'width=420,height=720');
    if (!win) {
      alert('The receipt window was blocked. Allow pop-ups for this POS and try Print Receipt again.');
      return false;
    }
    win.document.open();
    win.document.write(receiptHtml(tx));
    win.document.close();
    return true;
  }

  function showReceiptChoice(tx){
    const card = $('modalCard');
    const backdrop = $('modalBackdrop');
    if (!card || !backdrop || !tx) return;

    card.innerHTML = `
      <div class="modal-head"><h3>Sale Complete</h3></div>
      <div class="receipt-choice">
        <div class="receipt-check">✓</div>
        <strong>${esc(tx.transactionNumber)}</strong>
        <span>${money(tx.total)} completed successfully.</span>
        <p>Would you like a receipt?</p>
        <div class="receipt-choice-actions">
          <button id="receiptPrintBtn" class="primary-btn" type="button">🧾 Print Receipt</button>
          <button id="receiptNoBtn" class="secondary-btn" type="button">No Receipt</button>
        </div>
      </div>`;
    backdrop.classList.remove('hidden');

    $('receiptPrintBtn')?.addEventListener('click', () => {
      if (printReceipt(tx)) closeReceiptModal();
    });
    $('receiptNoBtn')?.addEventListener('click', closeReceiptModal);
  }

  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value){
    originalSetItem.call(this, key, value);
    if (this !== localStorage || key !== TX_KEY) return;
    try {
      const list = JSON.parse(value || "[]");
      const first = list[0];
      const firstId = String(first?.id || "");
      if (first && firstId && firstId !== lastFirstId) {
        lastFirstId = firstId;
        setTimeout(() => showReceiptChoice(first), 0);
      }
    } catch {}
  };

  const style = document.createElement('style');
  style.textContent = `
    .receipt-choice{text-align:center;padding:10px 4px 2px}.receipt-check{width:50px;height:50px;border-radius:50%;display:grid;place-items:center;margin:0 auto 10px;background:var(--greenSoft);color:var(--green2);font-size:28px;font-weight:900}.receipt-choice>strong{display:block;font-size:18px}.receipt-choice>span{display:block;color:var(--muted);margin-top:4px}.receipt-choice p{margin:18px 0 10px;font-weight:850}.receipt-choice-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.receipt-choice-actions button{min-height:46px}
    .receipt-reprint-btn{margin-right:auto}
    @media(max-width:600px){.receipt-choice-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  // Add a reprint option whenever an existing transaction is opened.
  window.addEventListener('click', e => {
    const row = e.target.closest?.('.tx-history-row');
    if (!row) return;
    const txId = row.dataset.txId;
    setTimeout(() => {
      const card = $('modalCard');
      const actions = card?.querySelector('.modal-actions');
      if (!actions || actions.querySelector('.receipt-reprint-btn')) return;
      const tx = loadTransactions().find(t => String(t.id) === String(txId));
      if (!tx) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'secondary-btn receipt-reprint-btn';
      btn.textContent = '🧾 Print Receipt';
      btn.addEventListener('click', () => printReceipt(tx));
      actions.insertBefore(btn, actions.firstChild);
    }, 0);
  }, true);
})();
