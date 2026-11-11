const PAPER_WIDTH_STORAGE_KEY = 'coftea_receipt_paper_width';
const VALID_PAPER_WIDTHS = ['80mm', '58mm'];

/**
 * Formats an ISO timestamp as YYYY-MM-DD hh:mm:ss AM/PM for receipts.
 */
export const formatReceiptDateTime = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '—';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  let hours = d.getHours();
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const hrsStr = String(hours).padStart(2, '0');
  return `${y}-${m}-${day} ${hrsStr}:${mins}:${secs} ${ampm}`;
};

/**
 * Extracts a human-readable discount label from a receipt record.
 */
export const extractDiscountLabel = (receipt) => {
  if (!receipt) return '';
  if (receipt.discount_label) return receipt.discount_label;
  if (typeof receipt.notes === 'string' && receipt.notes.startsWith('Discount:')) {
    return receipt.notes.replace(/^Discount:\s*/i, '').trim();
  }
  return '';
};

/**
 * Derives normalized receipt totals from a sale/receipt payload.
 */
export const computeReceiptTotals = (receipt) => {
  const discountAmount = parseFloat(receipt?.discount_amount) || 0;
  const totalAmount = parseFloat(receipt?.total_amount) || 0;
  const subtotalAmount =
    receipt?.subtotal_amount !== undefined
      ? parseFloat(receipt.subtotal_amount)
      : totalAmount + discountAmount - (parseFloat(receipt?.tax_amount) || 0);
  const discountLabel = extractDiscountLabel(receipt);

  return { discountAmount, totalAmount, subtotalAmount, discountLabel };
};

export const getSavedPaperWidth = () => {
  try {
    const saved = localStorage.getItem(PAPER_WIDTH_STORAGE_KEY);
    return VALID_PAPER_WIDTHS.includes(saved) ? saved : '80mm';
  } catch {
    return '80mm';
  }
};

export const savePaperWidth = (width) => {
  if (!VALID_PAPER_WIDTHS.includes(width)) return;
  try {
    localStorage.setItem(PAPER_WIDTH_STORAGE_KEY, width);
  } catch {
    // ignore storage errors
  }
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatCurrency = (value) => `₱${(Number(value) || 0).toFixed(2)}`;

const buildThermalReceiptHtml = (
  receipt,
  {
    paperWidth = '80mm',
    storeName = 'COF/TEA CAFE',
    branchLabel = 'Main Branch • Store #001',
  } = {}
) => {
  const safeWidth = VALID_PAPER_WIDTHS.includes(paperWidth) ? paperWidth : '80mm';
  const isCompact = safeWidth === '58mm';
  const { discountAmount, totalAmount, subtotalAmount, discountLabel } =
    computeReceiptTotals(receipt);

  const itemsHtml = (receipt.sale_items || [])
    .map((item) => {
      const name = escapeHtml(item.products?.name || item.name || 'Item');
      const cupSize = item.cup_size ? ` <span class="muted">(${escapeHtml(item.cup_size)})</span>` : '';
      const addOns =
        Array.isArray(item.add_ons) && item.add_ons.length > 0
          ? `<div class="addons">+ ${item.add_ons
              .map((ao) => `${escapeHtml(ao.customer_qty || 1)}x ${escapeHtml(ao.name)}`)
              .join(', ')}</div>`
          : '';
      const qty = escapeHtml(item.quantity ?? 1);
      const lineTotal = formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));

      return `
        <tr>
          <td class="col-item">
            <div class="item-name">${name}${cupSize}</div>
            ${addOns}
          </td>
          <td class="col-qty">${qty}</td>
          <td class="col-price">${lineTotal}</td>
        </tr>
      `;
    })
    .join('');

  const discountRow =
    discountAmount > 0
      ? `
        <div class="summary-row">
          <span>Discount${discountLabel ? ` (${escapeHtml(discountLabel)})` : ''}</span>
          <span>-${formatCurrency(discountAmount)}</span>
        </div>
      `
      : '';

  const referenceRow = receipt.transaction_reference
    ? `
      <div class="summary-row">
        <span>Reference #</span>
        <span>${escapeHtml(receipt.transaction_reference)}</span>
      </div>
    `
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt ${escapeHtml(receipt.receipt_number || '')}</title>
  <style>
    @page {
      size: ${safeWidth} auto;
      margin: 0;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #000000;
      width: ${safeWidth};
      font-family: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace;
      font-size: ${isCompact ? '10px' : '11.5px'};
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .receipt {
      width: 100%;
      padding: ${isCompact ? '3.5mm 2.5mm 6mm' : '4mm 3.5mm 7mm'};
    }

    .header {
      text-align: center;
      margin-bottom: 8px;
    }

    .store-name {
      margin: 0;
      font-size: ${isCompact ? '14px' : '16px'};
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    .branch-label {
      margin: 2px 0 0;
      font-size: ${isCompact ? '9.5px' : '10.5px'};
    }

    .dashed-divider {
      border-top: 1px dashed #000000;
      margin: 7px 0;
    }

    .solid-divider {
      border-top: 1px solid #000000;
      margin: 6px 0;
    }

    .meta-row, .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 6px;
      margin: 2px 0;
    }

    .meta-val {
      text-align: right;
      font-weight: 700;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }

    th {
      text-align: left;
      font-size: ${isCompact ? '9.5px' : '10.5px'};
      font-weight: 700;
      padding: 3px 0;
      border-bottom: 1px dashed #000000;
    }

    td {
      padding: 4px 0;
      vertical-align: top;
      border-bottom: 1px dotted #999999;
    }

    tr:last-child td {
      border-bottom: none;
    }

    .col-item {
      width: 58%;
      padding-right: 4px;
      word-break: break-word;
    }

    .col-qty {
      width: 14%;
      text-align: center;
      white-space: nowrap;
    }

    .col-price {
      width: 28%;
      text-align: right;
      white-space: nowrap;
    }

    th.col-qty { text-align: center; }
    th.col-price { text-align: right; }

    .item-name {
      font-weight: 600;
    }

    .muted {
      font-weight: 400;
      font-size: ${isCompact ? '9px' : '10px'};
    }

    .addons {
      font-size: ${isCompact ? '9px' : '10px'};
      margin-top: 1px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: ${isCompact ? '13px' : '14.5px'};
      font-weight: 800;
      padding: 4px 0;
      border-top: 1px solid #000000;
      border-bottom: 1px dashed #000000;
      margin: 5px 0;
    }

    .footer {
      text-align: center;
      margin-top: 10px;
      font-size: ${isCompact ? '9.5px' : '10.5px'};
    }

    @media print {
      html, body {
        width: ${safeWidth};
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <h1 class="store-name">${escapeHtml(storeName)}</h1>
      <p class="branch-label">${escapeHtml(branchLabel)}</p>
    </div>

    <div class="dashed-divider"></div>

    <div class="meta-row">
      <span>Date:</span>
      <span class="meta-val">${escapeHtml(formatReceiptDateTime(receipt.created_at))}</span>
    </div>
    <div class="meta-row">
      <span>Receipt No:</span>
      <span class="meta-val">${escapeHtml(receipt.receipt_number || 'N/A')}</span>
    </div>
    <div class="meta-row">
      <span>Cashier:</span>
      <span class="meta-val">${escapeHtml(receipt.users?.name || 'System')}</span>
    </div>

    <div class="dashed-divider"></div>

    <table>
      <thead>
        <tr>
          <th class="col-item">Item</th>
          <th class="col-qty">Qty</th>
          <th class="col-price">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="dashed-divider"></div>

    <div class="summary-row">
      <span>Subtotal</span>
      <span>${formatCurrency(subtotalAmount)}</span>
    </div>
    ${discountRow}

    <div class="total-row">
      <span>TOTAL</span>
      <span>${formatCurrency(totalAmount)}</span>
    </div>

    <div class="summary-row">
      <span>Payment (${escapeHtml(receipt.payment_method || 'CASH')})</span>
      <span>${formatCurrency(receipt.amount_received ?? totalAmount)}</span>
    </div>
    ${referenceRow}
    <div class="summary-row">
      <span>Change</span>
      <span>${formatCurrency(receipt.change_amount || 0)}</span>
    </div>

    <div class="dashed-divider"></div>

    <div class="footer">
      <div>Thank you for visiting Cof/Tea!</div>
    </div>
  </div>
</body>
</html>`;
};

const PRINT_IFRAME_ID = 'coftea-thermal-receipt-frame';

/**
 * Prints only the thermal receipt slip via an isolated hidden iframe so
 * dashboard UI, modal backdrops, and browser headers/footers never appear.
 */
export const printThermalReceipt = (receipt, options = {}) => {
  if (!receipt || typeof document === 'undefined') return;

  const existing = document.getElementById(PRINT_IFRAME_ID);
  if (existing) {
    existing.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = PRINT_IFRAME_ID;
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
  });

  document.body.appendChild(iframe);

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    return;
  }

  doc.open();
  doc.write(buildThermalReceiptHtml(receipt, options));
  doc.close();

  const triggerPrint = () => {
    const win = iframe.contentWindow;
    if (!win) {
      cleanup();
      return;
    }

    let cleaned = false;
    const safeCleanup = () => {
      if (cleaned) return;
      cleaned = true;
      cleanup();
    };

    win.addEventListener('afterprint', safeCleanup, { once: true });

    try {
      win.focus();
      win.print();
    } finally {
      // Fallback cleanup for browsers that do not fire afterprint on iframes
      setTimeout(safeCleanup, 60000);
    }
  };

  // Allow layout calculation inside the hidden iframe before opening print dialog
  setTimeout(triggerPrint, 120);
};
