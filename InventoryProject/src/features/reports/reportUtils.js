/**
 * reportUtils.js
 * Shared utilities for all report modules:
 *  - downloadCSV: clean CSV file download
 *  - printReport: opens a dedicated print window (only report content, no nav)
 */

/**
 * Downloads a CSV file from a 2D array of rows.
 * @param {Array<Array<any>>} rows  - 2D array where each sub-array is one row
 * @param {string}            filename
 */
export const downloadCSV = (rows, filename) => {
  const csv = rows
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
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
 * @param {string} title   - Window / document title shown in the print dialog
 * @param {string} html    - The HTML content of the report body
 */
export const printReport = (title, html) => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    console.error('Pop-up blocked. Please allow pop-ups for this site to use Print.');
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          color: #000;
          padding: 24px 32px;
        }
        h1 { font-size: 18px; margin-bottom: 4px; }
        h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 2px solid #000; padding-bottom: 4px; }
        p.subtitle { font-size: 11px; color: #555; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #000; color: #fff; padding: 6px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
        td { padding: 5px 10px; border-bottom: 1px solid #ddd; font-size: 12px; }
        tr:nth-child(even) td { background: #f9f9f9; }
        .kpi-grid { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
        .kpi-box { border: 1px solid #ccc; padding: 12px 16px; min-width: 140px; }
        .kpi-label { font-size: 10px; text-transform: uppercase; color: #666; }
        .kpi-value { font-size: 22px; font-weight: bold; margin-top: 4px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        .badge-healthy { background: #e8f5e9; color: #2e7d32; }
        .badge-warning { background: #fff3e0; color: #e65100; }
        .badge-critical, .badge-out { background: #ffebee; color: #c62828; }
        .badge-up { color: #2e7d32; }
        .badge-down { color: #c62828; }
        .section-note { font-size: 10px; color: #666; margin-bottom: 8px; font-style: italic; }
        @media print {
          body { padding: 0; }
          @page { margin: 18mm; }
        }
      </style>
    </head>
    <body>
      ${html}
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  win.document.close();
};
