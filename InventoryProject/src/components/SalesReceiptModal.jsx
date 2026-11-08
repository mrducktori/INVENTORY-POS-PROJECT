import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getSalesReceipt } from '../api/logsApi';

const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '—';
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

const extractDiscountLabel = (receipt) => {
  if (!receipt) return '';
  if (receipt.discount_label) return receipt.discount_label;
  if (typeof receipt.notes === 'string' && receipt.notes.startsWith('Discount:')) {
    return receipt.notes.replace(/^Discount:\s*/i, '').trim();
  }
  return '';
};

const SalesReceiptModal = ({ saleId, initialReceipt = null, onClose }) => {
  const [receipt, setReceipt] = useState(initialReceipt);
  const [loading, setLoading] = useState(!initialReceipt && Boolean(saleId));

  useEffect(() => {
    if (initialReceipt) {
      setReceipt(initialReceipt);
      setLoading(false);
      return;
    }

    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const data = await getSalesReceipt(saleId);
        setReceipt(data);
      } catch (error) {
        console.error('Failed to fetch receipt:', error);
      } finally {
        setLoading(false);
      }
    };

    if (saleId) {
      fetchReceipt();
    }
  }, [saleId, initialReceipt]);

  if (!saleId && !initialReceipt) return null;

  const discountAmount = parseFloat(receipt?.discount_amount) || 0;
  const totalAmount = parseFloat(receipt?.total_amount) || 0;
  const subtotalAmount =
    receipt?.subtotal_amount !== undefined
      ? parseFloat(receipt.subtotal_amount)
      : totalAmount + discountAmount - (parseFloat(receipt?.tax_amount) || 0);
  const discountLabel = extractDiscountLabel(receipt);

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto p-6 animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)] relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-bold text-zinc-900 uppercase tracking-wider">
              Digital Transaction Receipt
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-800 text-lg font-bold cursor-pointer p-1 bg-transparent border-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-zinc-400 font-medium">Loading receipt details...</div>
        ) : receipt ? (
          <div className="text-zinc-800 text-sm space-y-4">
            <div className="text-center">
              <h3 className="font-extrabold text-xl text-zinc-900 tracking-tight m-0">COF/TEA CAFE</h3>
              <p className="text-xs text-zinc-500 font-medium mt-0.5 mb-0">Main Branch • Store #001</p>
            </div>

            <div className="border-t border-b border-dashed border-zinc-200 py-2.5 text-xs text-zinc-600 space-y-1">
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-medium text-zinc-900">{formatDateTime(receipt.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Receipt No:</span>
                <span className="font-mono font-bold text-zinc-900">{receipt.receipt_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span className="font-medium text-zinc-900">{receipt.users?.name || 'System'}</span>
              </div>
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 font-semibold">
                  <th className="py-1.5 text-left">Item</th>
                  <th className="py-1.5 text-center">Qty</th>
                  <th className="py-1.5 text-right">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {receipt.sale_items?.map((item, idx) => (
                  <tr key={item.id || idx} className="py-1.5 align-top">
                    <td className="py-1.5 font-medium text-zinc-900">
                      <div>
                        {item.products?.name || item.name}
                        {item.cup_size && (
                          <span className="text-[10px] text-zinc-400 ml-1 font-mono">({item.cup_size})</span>
                        )}
                      </div>
                      {Array.isArray(item.add_ons) && item.add_ons.length > 0 && (
                        <div className="text-[11px] text-zinc-500 mt-0.5">
                          + {item.add_ons.map((ao) => `${ao.customer_qty || 1}x ${ao.name}`).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-1.5 text-center text-zinc-700 font-mono font-bold">{item.quantity}</td>
                    <td className="py-1.5 text-right font-medium text-zinc-900 font-mono">
                      ₱{(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-zinc-200 pt-3 space-y-1 text-xs">
              <div className="flex justify-between text-zinc-600">
                <span>Subtotal</span>
                <span className="font-mono font-semibold">₱{subtotalAmount.toFixed(2)}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount{discountLabel ? ` (${discountLabel})` : ''}</span>
                  <span className="font-mono font-bold">-₱{discountAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-extrabold text-zinc-900 pt-1 border-t border-zinc-900">
                <span>Total</span>
                <span className="font-mono text-lg">₱{totalAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-zinc-600 pt-1">
                <span>Payment ({receipt.payment_method || 'CASH'})</span>
                <span className="font-mono">
                  ₱{Number(receipt.amount_received ?? totalAmount).toFixed(2)}
                </span>
              </div>

              {receipt.transaction_reference && (
                <div className="flex justify-between text-zinc-600">
                  <span>Reference #</span>
                  <span className="font-mono font-semibold text-zinc-900">{receipt.transaction_reference}</span>
                </div>
              )}

              <div className="flex justify-between text-zinc-600">
                <span>Change</span>
                <span className="font-mono font-bold text-emerald-700">
                  ₱{Number(receipt.change_amount || 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="pt-2 text-center text-[11px] text-zinc-400 font-medium">
              Thank you for visiting Cof/Tea!
            </div>

            <div className="pt-2 flex items-center gap-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Print Receipt
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-red-500 font-medium">Receipt not found.</div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default SalesReceiptModal;
