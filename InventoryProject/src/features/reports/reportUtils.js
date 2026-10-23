/**
 * reportUtils.js
 * Shared utilities for all report modules:
 *  - downloadCSV: clean CSV file download with Excel BOM and RFC-standard CRLF
 *  - printReport: opens a dedicated, beautifully styled print/PDF window
 */

/**
 * Downloads a CSV file from a 2D array of rows.
 * @param {Array<Array<any>>} rows  - 2D array where each sub-array is one row
 * @param {string}            filename
 */
export const downloadCSV = (rows, filename) => {
  const csv = rows
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Opens a clean print window containing only the report HTML.
 * Supports both printReport(title, html) and single-arg printReport(html).
 * @param {string} title   - Window / document title shown in the print dialog
 * @param {string} [html]  - The HTML content of the report body
 */
export const printReport = (title, html) => {
  let reportTitle = title;
  let reportHtml = html;

  // Defensive fallback if single argument passed
  if (!html || typeof html !== 'string') {
    reportHtml = title;
    reportTitle = 'Report';
  }

  const win = window.open('', '_blank', 'width=1000,height=800');
  if (!win) {
    alert('Pop-up was blocked by your browser. Please allow pop-ups for this site to print or save as PDF.');
    return;
  }

  win.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${reportTitle}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 11px;
          line-height: 1.45;
          color: #111827;
          background: #ffffff;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          padding: 24px 32px;
        }
        .report-header {
          border-bottom: 2px solid #111827;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .brand-subtitle {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #4b5563;
        }
        h1 {
          font-size: 20px;
          font-weight: 900;
          color: #111827;
          letter-spacing: -0.02em;
          margin-top: 2px;
          margin-bottom: 4px;
        }
        h2 {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #111827;
          margin: 24px 0 10px;
          padding-bottom: 4px;
          border-bottom: 1.5px solid #e5e7eb;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        p.subtitle {
          font-size: 11px;
          color: #4b5563;
          margin-bottom: 16px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        .kpi-box {
          border: 1px solid #d1d5db;
          border-radius: 6px;
          padding: 10px 14px;
          background: #f9fafb;
          page-break-inside: avoid;
        }
        .kpi-box.border-in { border-left: 4px solid #15803d; }
        .kpi-box.border-out { border-left: 4px solid #b91c1c; }
        .kpi-box.border-alert { border-left: 4px solid #d97706; }
        .kpi-box.border-neutral { border-left: 4px solid #111827; }
        .kpi-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #4b5563;
          margin-bottom: 2px;
        }
        .kpi-value {
          font-size: 18px;
          font-weight: 900;
          color: #111827;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .kpi-sub {
          font-size: 9.5px;
          color: #6b7280;
          margin-top: 2px;
          font-weight: 500;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          page-break-inside: auto;
          font-size: 10.5px;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        thead {
          display: table-header-group;
        }
        th {
          background: #111827 !important;
          color: #ffffff !important;
          padding: 8px 10px;
          text-align: left;
          font-size: 9.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid #111827;
        }
        th.text-right { text-align: right; }
        th.text-center { text-align: center; }
        td {
          padding: 6px 10px;
          border: 1px solid #e5e7eb;
          color: #1f2937;
          vertical-align: middle;
        }
        td.text-right { text-align: right; }
        td.text-center { text-align: center; }
        tr:nth-child(even) td {
          background: #f9fafb;
        }
        .section-header-row td {
          background: #f3f4f6 !important;
          font-weight: 800;
          font-size: 10.5px;
          color: #111827;
          padding: 8px 10px;
          border-top: 2px solid #d1d5db;
        }
        .badge {
          display: inline-block;
          padding: 2px 7px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          border: 1px solid transparent;
        }
        .badge-in { background: #dcfce7 !important; color: #166534 !important; border-color: #86efac !important; }
        .badge-out { background: #fee2e2 !important; color: #991b1b !important; border-color: #fca5a5 !important; }
        .badge-waste { background: #ffedd5 !important; color: #9a3412 !important; border-color: #fdba74 !important; }
        .badge-normal { background: #f3f4f6 !important; color: #1f2937 !important; border-color: #d1d5db !important; }
        .badge-warning { background: #fef3c7 !important; color: #92400e !important; border-color: #fcd34d !important; }
        .badge-danger { background: #fee2e2 !important; color: #991b1b !important; border-color: #fca5a5 !important; }
        .num-pos { color: #15803d; font-weight: 800; font-family: monospace; }
        .num-neg { color: #b91c1c; font-weight: 800; font-family: monospace; }
        .report-footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          color: #6b7280;
        }
        @media print {
          body { padding: 0; }
          @page { margin: 12mm 15mm; size: auto; }
        }
      </style>
    </head>
    <body>
      ${reportHtml}
      <script>
        window.onload = () => {
          setTimeout(() => {
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `);
  win.document.close();
};
