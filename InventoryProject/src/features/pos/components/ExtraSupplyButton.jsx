import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getExtraSupplies, useExtraSupply as postExtraSupply } from '../../../api/posApi';

// Staff quick action: give an extra straw (stock deduction only, not a sale).
export default function ExtraSupplyButton({ onNotice }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = loading
  const [picked, setPicked] = useState(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const list = await getExtraSupplies();
      const arr = Array.isArray(list) ? list : [];
      setItems(arr);
      setPicked((p) => (arr.length === 1 ? arr[0].ingredient_id : arr.some((i) => i.ingredient_id === p) ? p : null));
    } catch (e) {
      setItems([]);
      setError(e?.message || 'Could not load straws.');
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    const onDown = (e) => rootRef.current && !rootRef.current.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setItems(null);
      setPicked(null);
      setQty(1);
      setError('');
      load();
    }
    setOpen(!open);
  };

  const give = async () => {
    const item = items?.find((i) => i.ingredient_id === picked);
    if (!item || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await postExtraSupply({ ingredient_id: item.ingredient_id, quantity: qty });
      onNotice?.(`Gave ${res.quantity} × ${res.name} (${res.new_stock} left)`);
      setOpen(false);
      load();
    } catch (e) {
      setError(e?.message || 'Could not record extra straw.');
    } finally {
      setBusy(false);
    }
  };

  const selected = items?.find((i) => i.ingredient_id === picked);
  const btn = 'min-h-11 min-w-11 rounded-lg border border-gray-200 bg-white text-lg font-bold cursor-pointer disabled:opacity-40';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="min-h-11 px-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 21l3-18h2l-3 18M14 3l3 0" />
        </svg>
        Extra straw
      </button>

      {open && (
        <div role="dialog" aria-label="Extra straw" className="absolute right-0 top-full mt-2 w-64 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 flex flex-col gap-2">
          {items === null && <p className="m-0 text-sm text-gray-500">Loading...</p>}
          {items?.length === 0 && !error && (
            <p className="m-0 text-sm text-gray-600">No straw ingredient found. Add a raw material named 'Straw' in Inventory.</p>
          )}
          {items?.length > 1 && (
            <div className="flex flex-col gap-1.5">
              {items.map((i) => {
                const out = !(Number(i.usable_stock) > 0);
                return (
                  <button
                    key={i.ingredient_id}
                    type="button"
                    disabled={out}
                    onClick={() => { setPicked(i.ingredient_id); setQty(1); }}
                    className={`min-h-11 px-3 rounded-lg border text-left text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                      picked === i.ingredient_id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-800'
                    }`}
                  >
                    {i.name} <span className="font-normal opacity-80">{out ? '- Out of stock' : `(${i.usable_stock})`}</span>
                  </button>
                );
              })}
            </div>
          )}
          {items?.length === 1 && (
            <p className="m-0 text-sm font-semibold text-gray-800">
              {items[0].name}{' '}
              <span className="font-normal text-gray-500">{Number(items[0].usable_stock) > 0 ? `(${items[0].usable_stock})` : '- Out of stock'}</span>
            </p>
          )}
          {selected && Number(selected.usable_stock) > 0 && (
            <div className="flex items-center gap-2">
              <button type="button" className={btn} aria-label="Decrease" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>-</button>
              <span className="flex-1 text-center text-base font-bold" aria-live="polite">{qty}</span>
              <button type="button" className={btn} aria-label="Increase" disabled={qty >= 5} onClick={() => setQty(qty + 1)}>+</button>
              <button
                type="button"
                onClick={give}
                disabled={busy}
                className="min-h-11 px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {busy ? '...' : 'Give'}
              </button>
            </div>
          )}
          {error && <p role="alert" className="m-0 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
