const PAPER_WIDTH_STORAGE_KEY = 'coftea_receipt_paper_width';
const VALID_PAPER_WIDTHS = ['80mm', '58mm'];
const PRINT_ROOT_ID = 'coftea-print-root';
const PRINT_STYLE_ID = 'coftea-print-style';

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

const buildReceiptMarkup = (
  receipt,
  {
    storeName = 'COF/TEA CAFE',
    branchLabel = 'Main Branch • Store #001',
  } = {}
) => {
  const { discountAmount, totalAmount, subtotalAmount, discountLabel } =
    computeReceiptTotals(receipt);

  const itemsHtml = (receipt.sale_items || [])
    .map((item) => {
      const name = escapeHtml(item.products?.name || item.name || 'Item');
      const cupSize = item.cup_size
        ? ` <span class="coftea-receipt-size">(${escapeHtml(item.cup_size)})</span>`
        : '';
      const addOns =
        Array.isArray(item.add_ons) && item.add_ons.length > 0
          ? `<div class="coftea-receipt-addons">+ ${item.add_ons
              .map((ao) => `${escapeHtml(ao.customer_qty || 1)}x ${escapeHtml(ao.name)}`)
              .join(', ')}</div>`
          : '';
      const qty = escapeHtml(item.quantity ?? 1);
      const lineTotal = formatCurrency((Number(item.quantity) || 0) * (Number(item.unit_price) || 0));

      return `
        <tr>
          <td class="coftea-col-item">
            <div class="coftea-item-name">${name}${cupSize}</div>
            ${addOns}
          </td>
          <td class="coftea-col-qty">${qty}</td>
          <td class="coftea-col-price">${lineTotal}</td>
        </tr>
      `;
    })
    .join('');

  const discountRow =
    discountAmount > 0
      ? `
        <div class="coftea-summary-row">
          <span>Discount${discountLabel ? ` (${escapeHtml(discountLabel)})` : ''}</span>
          <span>-${formatCurrency(discountAmount)}</span>
        </div>
      `
      : '';

  const referenceRow = receipt.transaction_reference
    ? `
      <div class="coftea-summary-row">
        <span>Reference #</span>
        <span>${escapeHtml(receipt.transaction_reference)}</span>
      </div>
    `
    : '';

  return `
    <div class="coftea-receipt-slip">
      <div class="coftea-receipt-header">
        <h1 class="coftea-store-name">${escapeHtml(storeName)}</h1>
        <p class="coftea-branch-label">${escapeHtml(branchLabel)}</p>
      </div>

      <div class="coftea-dashed-divider"></div>

      <div class="coftea-meta-row">
        <span>Date:</span>
        <span class="coftea-meta-val">${escapeHtml(formatReceiptDateTime(receipt.created_at))}</span>
      </div>
      <div class="coftea-meta-row">
        <span>Receipt No:</span>
        <span class="coftea-meta-val">${escapeHtml(receipt.receipt_number || 'N/A')}</span>
      </div>
      <div class="coftea-meta-row">
        <span>Cashier:</span>
        <span class="coftea-meta-val">${escapeHtml(receipt.users?.name || 'System')}</span>
      </div>

      <div class="coftea-dashed-divider"></div>

      <table class="coftea-receipt-table">
        <thead>
          <tr>
            <th class="coftea-col-item">Item</th>
            <th class="coftea-col-qty">Qty</th>
            <th class="coftea-col-price">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="coftea-dashed-divider"></div>

      <div class="coftea-summary-row">
        <span>Subtotal</span>
        <span>${formatCurrency(subtotalAmount)}</span>
      </div>
      ${discountRow}

      <div class="coftea-total-row">
        <span>TOTAL</span>
        <span>${formatCurrency(totalAmount)}</span>
      </div>

      <div class="coftea-summary-row">
        <span>Payment (${escapeHtml(receipt.payment_method || 'CASH')})</span>
        <span>${formatCurrency(receipt.amount_received ?? totalAmount)}</span>
      </div>
      ${referenceRow}
      <div class="coftea-summary-row">
        <span>Change</span>
        <span>${formatCurrency(receipt.change_amount || 0)}</span>
      </div>

      <div class="coftea-dashed-divider"></div>

      <div class="coftea-receipt-footer">
        <div>Thank you for visiting Cof/Tea!</div>
      </div>
    </div>
  `;
};

const buildReceiptStyles = (paperWidth, heightMm = null) => {
  const safeWidth = VALID_PAPER_WIDTHS.includes(paperWidth) ? paperWidth : '80mm';
  const isCompact = safeWidth === '58mm';
  const pageRule = heightMm
    ? `@page { size: ${safeWidth} ${heightMm}mm; margin: 0; }`
    : `@page { size: ${safeWidth} 297mm; margin: 0; }`;

  return `
    ${pageRule}

    #${PRINT_ROOT_ID} {
      position: fixed;
      left: -9999px;
      top: 0;
      width: ${safeWidth};
      background: #ffffff;
      color: #000000;
      font-family: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace !important;
      font-size: ${isCompact ? '9.5px' : '11.5px'};
      line-height: 1.35;
      visibility: hidden;
      pointer-events: none;
      z-index: -1;
    }

    #${PRINT_ROOT_ID} * {
      box-sizing: border-box;
      font-family: ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace !important;
    }

    #${PRINT_ROOT_ID} .coftea-receipt-slip {
      width: 100%;
      padding: ${isCompact ? '3.5mm 2.5mm 5mm' : '4mm 3.5mm 6mm'};
    }

    #${PRINT_ROOT_ID} .coftea-receipt-header {
      text-align: center;
      margin-bottom: 8px;
    }

    #${PRINT_ROOT_ID} .coftea-store-name {
      margin: 0;
      font-size: ${isCompact ? '13.5px' : '16px'};
      font-weight: 800;
      letter-spacing: 0.04em;
    }

    #${PRINT_ROOT_ID} .coftea-branch-label {
      margin: 2px 0 0;
      font-size: ${isCompact ? '9px' : '10.5px'};
    }

    #${PRINT_ROOT_ID} .coftea-dashed-divider {
      border-top: 1px dashed #000000;
      margin: 6px 0;
    }

    #${PRINT_ROOT_ID} .coftea-meta-row,
    #${PRINT_ROOT_ID} .coftea-summary-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 4px;
      margin: 2px 0;
      font-size: ${isCompact ? '9px' : '11px'};
    }

    #${PRINT_ROOT_ID} .coftea-meta-val {
      text-align: right;
      font-weight: 700;
      white-space: nowrap;
    }

    #${PRINT_ROOT_ID} .coftea-receipt-table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
    }

    #${PRINT_ROOT_ID} .coftea-receipt-table th {
      text-align: left;
      font-size: ${isCompact ? '9px' : '10.5px'};
      font-weight: 700;
      padding: 3px 0;
      border-bottom: 1px dashed #000000;
    }

    #${PRINT_ROOT_ID} .coftea-receipt-table td {
      padding: 4px 0;
      vertical-align: top;
      border-bottom: 1px dotted #999999;
      font-size: ${isCompact ? '9.5px' : '11px'};
    }

    #${PRINT_ROOT_ID} .coftea-receipt-table tr:last-child td {
      border-bottom: none;
    }

    #${PRINT_ROOT_ID} .coftea-col-item {
      width: ${isCompact ? '56%' : '58%'};
      padding-right: 4px;
      word-break: break-word;
    }

    #${PRINT_ROOT_ID} .coftea-col-qty {
      width: ${isCompact ? '13%' : '14%'};
      text-align: center;
      white-space: nowrap;
    }

    #${PRINT_ROOT_ID} .coftea-col-price {
      width: ${isCompact ? '31%' : '28%'};
      text-align: right;
      white-space: nowrap;
    }

    #${PRINT_ROOT_ID} th.coftea-col-qty { text-align: center; }
    #${PRINT_ROOT_ID} th.coftea-col-price { text-align: right; }

    #${PRINT_ROOT_ID} .coftea-item-name {
      font-weight: 600;
    }

    #${PRINT_ROOT_ID} .coftea-receipt-size {
      font-weight: 400;
      font-size: ${isCompact ? '8.5px' : '10px'};
      white-space: nowrap;
    }

    #${PRINT_ROOT_ID} .coftea-receipt-addons {
      font-size: ${isCompact ? '8.5px' : '10px'};
      margin-top: 1px;
    }

    #${PRINT_ROOT_ID} .coftea-total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: ${isCompact ? '12.5px' : '14.5px'};
      font-weight: 800;
      padding: 4px 0;
      border-top: 1px solid #000000;
      border-bottom: 1px dashed #000000;
      margin: 5px 0;
    }

    #${PRINT_ROOT_ID} .coftea-receipt-footer {
      text-align: center;
      margin-top: 8px;
      font-size: ${isCompact ? '9px' : '10.5px'};
    }

    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: ${safeWidth} !important;
        ${heightMm ? `height: ${heightMm}mm !important;` : 'height: auto !important;'}
        min-height: 0 !important;
        overflow: hidden !important;
        background: #ffffff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      body > *:not(#${PRINT_ROOT_ID}) {
        display: none !important;
      }

      #${PRINT_ROOT_ID} {
        display: block !important;
        visibility: visible !important;
        position: static !important;
        left: auto !important;
        top: auto !important;
        width: ${safeWidth} !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
      }
    }
  `;
};

const cleanupExistingPrintElements = () => {
  const oldRoot = document.getElementById(PRINT_ROOT_ID);
  if (oldRoot) oldRoot.remove();
  const oldStyle = document.getElementById(PRINT_STYLE_ID);
  if (oldStyle) oldStyle.remove();
};

/**
 * Prints only the thermal receipt slip at top-level window context so Chromium
 * honors the exact 80mm / 58mm @page size, removes browser headers/footers,
 * and avoids popup blockers and SPA screen captures.
 */
export const printThermalReceipt = (receipt, options = {}) => {
  if (!receipt || typeof document === 'undefined') return;

  const safeWidth = VALID_PAPER_WIDTHS.includes(options.paperWidth) ? options.paperWidth : '80mm';
  cleanupExistingPrintElements();

  const styleEl = document.createElement('style');
  styleEl.id = PRINT_STYLE_ID;
  styleEl.textContent = buildReceiptStyles(safeWidth);
  document.head.appendChild(styleEl);

  const rootEl = document.createElement('div');
  rootEl.id = PRINT_ROOT_ID;
  rootEl.setAttribute('aria-hidden', 'true');
  rootEl.innerHTML = buildReceiptMarkup(receipt, options);
  document.body.appendChild(rootEl);

  // Measure the exact rendered receipt height at target thermal width (96px = 25.4mm)
  const measuredPx = Math.max(rootEl.scrollHeight, rootEl.getBoundingClientRect().height);
  const heightMm = Math.max(60, Math.ceil((measuredPx * 25.4) / 96) + 4);
  styleEl.textContent = buildReceiptStyles(safeWidth, heightMm);

  const originalTitle = document.title;
  if (receipt.receipt_number) {
    document.title = `Receipt_${receipt.receipt_number}`;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.title = originalTitle;
    cleanupExistingPrintElements();
  };

  window.addEventListener('afterprint', cleanup, { once: true });

  // Wait two animation frames so Chromium commits the updated @page dimensions before print preview opens
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.print();
      } finally {
        setTimeout(cleanup, 60000);
      }
    });
  });
};
