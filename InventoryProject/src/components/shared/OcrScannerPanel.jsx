import React, { useState, useMemo } from 'react';
import { scanOcrDocument } from '../../api/inventoryApi';
import { INPUT_LIMITS } from '../../utils/validationUtils';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const buildSampleReceiptText = (ingredients = []) => {
  const sampleNames = ingredients
    .filter((i) => i && !i.is_archived && i.name)
    .slice(0, 3)
    .map((i) => ({ name: i.name, unit: (i.purchase_unit || i.unit || 'KG').toUpperCase() }));

  const fallback = [
    { name: 'Arabica Coffee Beans', unit: 'KG' },
    { name: 'Full Cream Milk', unit: 'L' },
    { name: 'Vanilla Syrup', unit: 'BOTTLE' }
  ];
  const lines = (sampleNames.length > 0 ? sampleNames : fallback).map((item, idx) => {
    const qty = idx === 0 ? 5 : idx === 1 ? 12 : 4;
    const price = idx === 0 ? '850.00' : idx === 1 ? '95.00' : '320.00';
    const year = 2027;
    const month = String(idx + 3).padStart(2, '0');
    const batch = `LOT-${String(item.name).replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'ITM'}-2026${idx + 1}`;
    return `${item.name} x${qty} ${item.unit} @ ${price} ${batch} EXP: ${year}-${month}-15`;
  });

  return [
    'Supplier: Metro Cafe Supply Co.',
    'Invoice: INV-2026-0418',
    ...lines
  ].join('\n');
};

const OcrScannerPanel = ({
  ingredients = [],
  scanMode = 'PO_RECEIPT',
  onApplyItems,
  compact = false,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [rawText, setRawText] = useState('');
  const [imagePayload, setImagePayload] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [appliedMsg, setAppliedMsg] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [editableItems, setEditableItems] = useState([]);

  const sortedIngredients = useMemo(
    () =>
      [...(ingredients || [])]
        .filter((i) => i && !i.is_archived)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [ingredients]
  );

  const handleFileChange = (e) => {
    setError('');
    setAppliedMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setError('Unsupported image format. Please select a PNG, JPG, or WEBP file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Image size exceeds the 6MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setImagePayload({
        base64: result,
        mimeType: file.type,
        fileName: file.name
      });
    };
    reader.onerror = () => {
      setError('Failed to read the selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSample = () => {
    setError('');
    setAppliedMsg('');
    setRawText(buildSampleReceiptText(sortedIngredients));
  };

  const handleScan = async () => {
    setError('');
    setAppliedMsg('');

    const trimmed = rawText.trim();
    if (!trimmed && !imagePayload?.base64) {
      setError('Upload a receipt/label image or paste receipt text before scanning.');
      return;
    }
    if (trimmed.length > 20000) {
      setError('Receipt text must not exceed 20,000 characters.');
      return;
    }

    setScanning(true);
    try {
      const res = await scanOcrDocument({
        base64Image: imagePayload?.base64 || undefined,
        mimeType: imagePayload?.mimeType || undefined,
        fileName: imagePayload?.fileName || undefined,
        rawText: trimmed || undefined,
        scanMode
      });
      setScanResult(res);
      const normalized = (res?.items || []).map((item, idx) => ({
        rowKey: `${idx}-${item.raw_name || 'item'}`,
        raw_name: item.raw_name || '',
        matched_ingredient_id: item.matched_ingredient_id || '',
        matched_ingredient_name: item.matched_ingredient_name || '',
        matched_unit: item.matched_unit || item.unit || '',
        quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '1',
        unit_price: item.unit_price ?? null,
        expiry_date: item.expiry_date || '',
        batch_code: item.batch_code || '',
        match_confidence: item.match_confidence || 'UNMATCHED'
      }));
      setEditableItems(normalized);
      if (normalized.length === 0) {
        setError('No deliverable line items could be extracted. Edit the text or enter values manually.');
      }
    } catch (err) {
      setError(err?.message || 'OCR scan failed. Please verify the text or image and try again.');
    } finally {
      setScanning(false);
    }
  };

  const updateRow = (rowKey, patch) => {
    setAppliedMsg('');
    setEditableItems((prev) =>
      prev.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row))
    );
  };

  const removeRow = (rowKey) => {
    setEditableItems((prev) => prev.filter((row) => row.rowKey !== rowKey));
  };

  const handleApply = () => {
    setError('');
    setAppliedMsg('');

    const validRows = [];
    for (let i = 0; i < editableItems.length; i += 1) {
      const row = editableItems[i];
      if (!row.matched_ingredient_id) continue;
      const qtyNum = parseFloat(row.quantity);
      if (!Number.isFinite(qtyNum) || qtyNum < INPUT_LIMITS.RECEIVE_QTY_MIN || qtyNum > INPUT_LIMITS.PO_QTY_MAX) {
        setError(`Row "${row.raw_name || row.matched_ingredient_name}" quantity must be between 0.01 and 100,000.`);
        return;
      }
      const chosenIng = sortedIngredients.find(
        (ing) => String(ing.id) === String(row.matched_ingredient_id)
      );
      validRows.push({
        raw_name: row.raw_name,
        matched_ingredient_id: row.matched_ingredient_id,
        matched_ingredient_name: chosenIng?.name || row.matched_ingredient_name || row.raw_name,
        matched_unit: chosenIng?.purchase_unit || chosenIng?.unit || row.matched_unit || '',
        quantity: qtyNum,
        expiry_date: row.expiry_date || '',
        batch_code: (row.batch_code || '').trim().slice(0, INPUT_LIMITS.BATCH_CODE_MAX_LEN)
      });
    }

    if (validRows.length === 0) {
      setError('Select a matched ingredient on at least one scanned row before applying.');
      return;
    }

    onApplyItems?.(validRows, scanResult);
    setAppliedMsg(`Applied ${validRows.length} validated line item${validRows.length === 1 ? '' : 's'} to form.`);
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden ${compact ? 'mb-3' : 'mb-6'}`}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100/80 transition-colors flex items-center justify-between gap-3 text-left border-none cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gray-900 text-white flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-gray-900">
              OCR Receipt & Expiry Label Scanner
            </div>
            <div className="text-[11px] text-gray-500">
              Upload a supplier delivery slip image or paste label text to prefill matched ingredients, batch codes, and expiry dates.
            </div>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-700 shrink-0">
          {isOpen ? 'Hide Scanner' : 'Open Scanner'}
        </span>
      </button>

      {isOpen && (
        <div className={`${compact ? 'p-4' : 'p-5'} border-t border-gray-200 space-y-4`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-2.5">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                1. Receipt / Expiry Label Image (Optional)
              </label>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleFileChange}
                className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-xs file:font-bold file:bg-white file:text-gray-800 hover:file:bg-gray-50 cursor-pointer"
              />
              {imagePayload && (
                <div className="p-2 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={imagePayload.base64}
                      alt="Uploaded receipt preview"
                      className="w-10 h-10 object-cover rounded border border-gray-200 shrink-0"
                    />
                    <span className="text-xs font-semibold text-gray-700 truncate">{imagePayload.fileName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setImagePayload(null)}
                    className="text-xs font-semibold text-red-600 hover:text-red-800 bg-transparent border-none cursor-pointer shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )}
              <p className="m-0 text-[11px] text-gray-400">
                Supports PNG, JPG, or WEBP up to 6MB. Text fallback parser works offline too.
              </p>
            </div>

            <div className="lg:col-span-7 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  2. Receipt / Label Text
                </label>
                <button
                  type="button"
                  onClick={handleLoadSample}
                  className="px-2.5 py-1 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-[11px] font-bold text-gray-700 cursor-pointer"
                >
                  Load Sample Receipt
                </button>
              </div>
              <textarea
                rows={compact ? 3 : 4}
                maxLength={20000}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={'Supplier: Metro Cafe Supply\nCoffee Beans x5 KG @ 850 LOT-COF-01 EXP: 2027-04-30'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning || (!rawText.trim() && !imagePayload?.base64)}
                className="px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {scanning ? 'Scanning...' : 'Scan & Validate'}
              </button>
              {(rawText || imagePayload || scanResult) && (
                <button
                  type="button"
                  onClick={() => {
                    setRawText('');
                    setImagePayload(null);
                    setScanResult(null);
                    setEditableItems([]);
                    setError('');
                    setAppliedMsg('');
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-600 cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>

            {scanResult && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-600">
                <span className="px-2 py-0.5 rounded bg-gray-100 border border-gray-200 font-bold uppercase">
                  Engine: {scanResult.engine === 'gemini_vision' ? 'Gemini Vision' : 'Deterministic Parser'}
                </span>
                {scanResult.supplier_name && (
                  <span className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 font-semibold">
                    Supplier: {scanResult.supplier_name}
                  </span>
                )}
                {scanResult.invoice_number && (
                  <span className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 font-mono">
                    Ref: {scanResult.invoice_number}
                  </span>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-bold text-red-700">
              {error}
            </div>
          )}
          {appliedMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800">
              {appliedMsg}
            </div>
          )}

          {Array.isArray(scanResult?.warnings) && scanResult.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
              <div className="font-bold uppercase tracking-wider text-[11px]">Validation Warnings</div>
              <ul className="m-0 pl-4 space-y-0.5">
                {scanResult.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {editableItems.length > 0 && (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3 font-semibold">Detected Name</th>
                      <th className="py-2 px-3 font-semibold">Matched Ingredient</th>
                      <th className="py-2 px-3 font-semibold w-24">Qty</th>
                      <th className="py-2 px-3 font-semibold w-36">Expiry Date</th>
                      <th className="py-2 px-3 font-semibold w-36">Batch Code</th>
                      <th className="py-2 px-3 font-semibold text-center">Status</th>
                      <th className="py-2 px-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {editableItems.map((row) => {
                      const qtyVal = parseFloat(row.quantity);
                      const isRowValid =
                        Boolean(row.matched_ingredient_id) &&
                        Number.isFinite(qtyVal) &&
                        qtyVal >= INPUT_LIMITS.RECEIVE_QTY_MIN &&
                        qtyVal <= INPUT_LIMITS.PO_QTY_MAX;

                      return (
                        <tr key={row.rowKey} className="hover:bg-gray-50/70">
                          <td className="py-2 px-3">
                            <div className="font-bold text-gray-900">{row.raw_name || '—'}</div>
                            {row.unit_price !== null && row.unit_price !== undefined && (
                              <div className="text-[10px] text-gray-500 font-mono">
                                Unit Price: ₱{Number(row.unit_price).toFixed(2)}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 min-w-[170px]">
                            <select
                              value={row.matched_ingredient_id}
                              onChange={(e) => {
                                const ing = sortedIngredients.find(
                                  (it) => String(it.id) === String(e.target.value)
                                );
                                updateRow(row.rowKey, {
                                  matched_ingredient_id: e.target.value,
                                  matched_ingredient_name: ing?.name || '',
                                  matched_unit: ing?.purchase_unit || ing?.unit || ''
                                });
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                            >
                              <option value="">-- Select ingredient --</option>
                              {sortedIngredients.map((ing) => (
                                <option key={ing.id} value={ing.id}>
                                  {ing.name} ({ing.purchase_unit || ing.unit})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="number"
                              min={INPUT_LIMITS.RECEIVE_QTY_MIN}
                              max={INPUT_LIMITS.PO_QTY_MAX}
                              step="any"
                              value={row.quantity}
                              onChange={(e) => updateRow(row.rowKey, { quantity: e.target.value })}
                              className="w-20 px-2 py-1 border border-gray-300 rounded-md text-xs font-mono font-bold text-gray-900"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={row.expiry_date}
                              onChange={(e) => updateRow(row.rowKey, { expiry_date: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded-md text-xs text-gray-800"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              maxLength={INPUT_LIMITS.BATCH_CODE_MAX_LEN}
                              value={row.batch_code}
                              onChange={(e) => updateRow(row.rowKey, { batch_code: e.target.value })}
                              placeholder="Optional"
                              className="w-32 px-2 py-1 border border-gray-300 rounded-md text-xs font-mono text-gray-800"
                            />
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                isRowValid
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {isRowValid ? 'Matched' : 'Review Needed'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(row.rowKey)}
                              aria-label="Remove row"
                              className="text-gray-400 hover:text-red-600 bg-transparent border-none cursor-pointer p-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500">
                  Review matched ingredients, quantities, and expiry dates before applying.
                </span>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  Apply to Form
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OcrScannerPanel;
