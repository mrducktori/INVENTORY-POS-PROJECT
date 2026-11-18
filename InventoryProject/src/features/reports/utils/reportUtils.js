/**
 * reportUtils.js
 * Centralized reporting utilities for all report and log modules:
 *  - downloadCSV: RFC-4180 compliant CSV export with Excel UTF-8 BOM (\uFEFF)
 *  - printReport: Dedicated, executive-grade print & PDF layout with Cof/Tea Cafe branding
 */

/**
 * Downloads a CSV file from a 2D array of rows.
 * Enforces RFC-4180 escaping: fields with quotes, commas, or newlines are wrapped in quotes.
 * Prepends UTF-8 BOM (\uFEFF) so Excel, Numbers, and Google Sheets display Philippine Peso (₱)
 * and special characters without encoding errors.
 * 
 * @param {Array<Array<any>>} rows - 2D array of table data
 * @param {string} filename - Target filename (e.g., 'Sales_Report.csv')
 */
export const downloadCSV = (rows, filename = 'report.csv') => {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('downloadCSV called with empty rows');
    return;
  }

  const csvContent = rows
    .map(row => {
      if (!Array.isArray(row)) return '';
      return row
        .map(cell => {
          if (cell === null || cell === undefined) return '""';
          const str = String(cell);
          // Escape double quotes by doubling them
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(',');
    })
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Opens an executive-grade print/PDF window with unified Cof/Tea Cafe branding.
 * Supports auto-print and print-preview styling.
 * 
 * @param {string} title - Document title displayed in browser tab and print header
 * @param {string} html - HTML body content
 */
export const printReport = (title, html) => {
  let reportTitle = title || 'Cof/Tea Cafe Report';
  let reportHtml = html || '';

  // Defensive fallback if single argument passed
  if (!html || typeof html !== 'string') {
    reportHtml = title;
    reportTitle = 'Cof/Tea Cafe Report';
  }

  const win = window.open('', '_blank', 'width=1100,height=850');
  if (!win) {
    alert('Pop-up was blocked by your browser. Please allow pop-ups for this site to print or save as PDF.');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${reportTitle}</title>
      <style>
        *, *::before, *::after {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        html, body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          color: #111827;
          background: #ffffff;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body {
          padding: 24px 32px;
          max-width: 100%;
        }

        /* Top Action Bar (hidden in print) */
        .print-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 10px 16px;
          margin-bottom: 24px;
        }
        .print-toolbar-text {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
        }
        .print-btn {
          background: #111827;
          color: #ffffff;
          border: none;
          padding: 6px 16px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 6px;
          cursor: pointer;
        }
        .print-btn:hover {
          background: #1f2937;
        }

        /* Official Report Header */
        .report-header {
          border-bottom: 2px solid #111827;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .brand-meta-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
        }
        .brand-logo-text {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #111827;
        }
        .brand-subtitle {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7280;
          margin-top: 1px;
        }
        .report-timestamp {
          font-size: 9.5px;
          color: #6b7280;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .report-timestamp strong {
          color: #111827;
        }
        h1 {
          font-size: 20px;
          font-weight: 900;
          color: #111827;
          letter-spacing: -0.02em;
          margin-top: 4px;
          margin-bottom: 4px;
        }
        p.subtitle {
          font-size: 11px;
          color: #4b5563;
          margin-bottom: 14px;
        }
        p.subtitle strong {
          color: #111827;
        }

        /* Executive KPI Summary Cards */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 10px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .kpi-box {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 10px 12px;
          background: #fafafa;
          page-break-inside: avoid;
        }
        .kpi-box.border-in      { border-left: 4px solid #16a34a; background: #f0fdf4; }
        .kpi-box.border-out     { border-left: 4px solid #dc2626; background: #fef2f2; }
        .kpi-box.border-alert   { border-left: 4px solid #d97706; background: #fffbeb; }
        .kpi-box.border-neutral { border-left: 4px solid #111827; background: #f9fafb; }
        .kpi-box.border-brand   { border-left: 4px solid #4f46e5; background: #eef2ff; }

        .kpi-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          margin-bottom: 3px;
        }
        .kpi-value {
          font-size: 17px;
          font-weight: 900;
          color: #111827;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          line-height: 1.2;
        }
        .kpi-sub {
          font-size: 9px;
          color: #6b7280;
          margin-top: 2px;
          font-weight: 500;
        }

        /* Section Headings */
        h2 {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #111827;
          margin: 22px 0 8px;
          padding-bottom: 4px;
          border-bottom: 1.5px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Tables */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          page-break-inside: auto;
          font-size: 10px;
        }
        thead {
          display: table-header-group;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        th {
          background: #111827 !important;
          color: #ffffff !important;
          padding: 7px 9px;
          text-align: left;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid #111827;
        }
        th.text-right { text-align: right; }
        th.text-center { text-align: center; }

        td {
          padding: 6px 9px;
          border: 1px solid #e5e7eb;
          color: #1f2937;
          vertical-align: middle;
        }
        td.text-right { text-align: right; }
        td.text-center { text-align: center; }
        tr:nth-child(even) td {
          background: #fbfbfb;
        }

        .section-header-row td {
          background: #f3f4f6 !important;
          font-weight: 800;
          font-size: 10px;
          color: #111827;
          padding: 7px 9px;
          border-top: 2px solid #d1d5db;
        }

        /* Status & Movement Badges */
        .badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 8.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid transparent;
          white-space: nowrap;
        }
        .badge-in       { background: #dcfce7 !important; color: #166534 !important; border-color: #86efac !important; }
        .badge-out      { background: #fee2e2 !important; color: #991b1b !important; border-color: #fca5a5 !important; }
        .badge-waste    { background: #ffedd5 !important; color: #9a3412 !important; border-color: #fdba74 !important; }
        .badge-normal   { background: #f3f4f6 !important; color: #1f2937 !important; border-color: #d1d5db !important; }
        .badge-warning  { background: #fef3c7 !important; color: #92400e !important; border-color: #fcd34d !important; }
        .badge-danger   { background: #fee2e2 !important; color: #991b1b !important; border-color: #fca5a5 !important; }

        .num-pos { color: #16a34a; font-weight: 800; font-family: monospace; }
        .num-neg { color: #dc2626; font-weight: 800; font-family: monospace; }

        /* Report Footer */
        .report-footer {
          margin-top: 24px;
          padding-top: 8px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #9ca3af;
        }

        /* Media Print Specifics */
        @media print {
          .no-print, .print-toolbar {
            display: none !important;
          }
          body {
            padding: 0;
            background: #ffffff;
          }
          @page {
            margin: 10mm 12mm;
            size: auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-toolbar no-print">
        <span class="print-toolbar-text">Document preview ready for printing or export to PDF</span>
        <button class="print-btn" onclick="window.print()">Print Document / Save PDF</button>
      </div>

      ${reportHtml}

      <script>
        window.onload = () => {
          setTimeout(() => {
            window.focus();
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
};