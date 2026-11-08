import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getSalesReceipt } from '../api/logsApi';

const SalesReceiptModal = ({ saleId, onClose }) => {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchReceipt = async () => {
      try {
        setLoading(true);
        const data = await getSalesReceipt(saleId);
        setReceipt(data);
      } catch (error) {
        console.error("Failed to fetch receipt:", error);
      } finally {
        setLoading(false);
      }
    };

    if (saleId) {
      fetchReceipt();
    }
  }, [saleId]);

  if (!saleId) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-[modalBackdropFadeIn_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg md:text-xl font-black text-gray-900 uppercase tracking-wider m-0">Official Receipt</h2>
          <button className="text-gray-400 hover:text-gray-900 transition-colors cursor-pointer text-2xl leading-none" onClick={onClose}>×</button>
        </div>
        
        <div className="p-6 md:p-8 overflow-y-auto bg-white text-gray-800">
          {loading ? (
            <div className="space-y-4 py-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto"></div>
              <div className="h-4 bg-gray-100 rounded w-1/3 mx-auto"></div>
              <div className="border-t-2 border-b-2 border-dashed border-gray-200 py-4 my-6 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                <div className="h-4 bg-gray-200 rounded w-4/5"></div>
              </div>
              <div className="h-5 bg-gray-200 rounded w-1/3 ml-auto"></div>
            </div>
          ) : receipt ? (
            <div className="text-base md:text-lg">
              {/* --- HEADER ZONE --- */}
              <div className="text-center mb-6">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 m-0">COF/TEA CAFE</h1>
                <div className="text-gray-600 text-base font-semibold mt-1">
                  <p className="m-0">Store #001 • Main Branch</p>
                </div>
              </div>

              {/* --- BODY ZONE --- */}
              <div className="border-t-2 border-b-2 border-dashed border-gray-300 py-4 mb-6 text-base text-gray-800 space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span>{new Date(receipt.created_at).toLocaleDateString()} {new Date(receipt.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  <span className="font-bold text-gray-900">Staff: {receipt.users?.name || "System"}</span>
                </div>
                <div className="flex justify-between font-mono font-bold text-gray-900 text-base">
                  <span>Receipt #: {receipt.receipt_number || "N/A"}</span>
                </div>
              </div>
              
              <table className="w-full text-left border-collapse mb-6">
                <thead>
                  <tr className="border-b-2 border-gray-300">
                    <th className="py-3 font-black text-gray-900 text-sm md:text-base uppercase tracking-wider">Item</th>
                    <th className="py-3 font-black text-gray-900 text-center text-sm md:text-base uppercase tracking-wider">Qty</th>
                    <th className="py-3 font-black text-gray-900 text-right text-sm md:text-base uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-base">
                  {receipt.sale_items?.map(item => (
                    <React.Fragment key={item.id}>
                      <tr className="align-top">
                        <td className="py-3">
                          <div className="font-extrabold text-gray-900 text-base md:text-lg">{item.products?.name}</div>
                          <div className="text-sm md:text-base text-gray-600 font-medium mt-0.5">
                            {item.cup_size && <span className="font-bold text-gray-800">Size: {item.cup_size} </span>}
                            <span>(@ ₱{parseFloat(item.unit_price).toFixed(2)})</span>
                          </div>
                          {item.add_ons && item.add_ons.length > 0 && (
                            <div className="text-sm md:text-base text-indigo-700 font-bold mt-1">
                              + {item.add_ons.map(ao => `${ao.customer_qty || 1}x ${ao.name}`).join(', ')}
                            </div>
                          )}
                        </td>
                        <td className="py-3 text-center font-black text-gray-900 text-base md:text-lg">{item.quantity}</td>
                        <td className="py-3 text-right font-black text-gray-900 text-base md:text-lg tabular-nums">₱{(item.quantity * item.unit_price).toFixed(2)}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* --- MONEY BLOCK ZONE --- */}
              <div className="border-t-2 border-gray-300 pt-4 mb-6">
                <div className="flex flex-col items-end space-y-2 text-base md:text-lg">
                  <div className="w-full flex justify-between text-gray-700 font-medium">
                    <span>Subtotal:</span>
                    <span className="font-bold tabular-nums">₱{(receipt.total_amount - (receipt.tax_amount || 0) + (receipt.discount_amount || 0)).toFixed(2)}</span>
                  </div>
                  
                  {receipt.discount_amount > 0 && (
                    <div className="w-full flex justify-between text-emerald-700 font-bold">
                      <span>Discount:</span>
                      <span className="tabular-nums">-₱{parseFloat(receipt.discount_amount).toFixed(2)}</span>
                    </div>
                  )}
                  
                  {receipt.tax_amount > 0 && (
                    <div className="w-full flex justify-between text-gray-700 font-medium">
                      <span>Tax (12% VAT):</span>
                      <span className="tabular-nums">₱{parseFloat(receipt.tax_amount).toFixed(2)}</span>
                    </div>
                  )}
                  
                  <div className="w-full flex justify-between items-end mt-3 pt-3 border-t-2 border-gray-900">
                    <span className="text-xl md:text-2xl font-black text-gray-900 uppercase">TOTAL</span>
                    <span className="text-3xl md:text-4xl font-black text-gray-900 tabular-nums">₱{parseFloat(receipt.total_amount).toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t-2 border-dashed border-gray-300 text-base text-gray-800 space-y-2">
                  <div className="flex justify-between font-bold">
                    <span>TENDER ({receipt.payment_method || 'CASH'})</span>
                    <span className="tabular-nums font-black text-lg">₱{parseFloat(receipt.amount_received || receipt.total_amount).toFixed(2)}</span>
                  </div>
                  {receipt.transaction_reference && (
                    <div className="flex justify-between text-gray-700">
                      <span className="font-semibold">CARD/REF #</span>
                      <span className="font-mono font-bold text-gray-900 text-base">{receipt.transaction_reference}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-emerald-800">
                    <span className="text-base md:text-lg">CHANGE</span>
                    <span className="tabular-nums font-black text-xl">₱{parseFloat(receipt.change_amount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* --- FOOTER ZONE --- */}
              <div className="border-t-2 border-gray-900 mt-6 pt-5 text-center text-sm md:text-base text-gray-600 space-y-2">
                <div className="font-mono text-sm text-gray-600 font-bold">
                  TXN: {receipt.id?.substring(0, 8).toUpperCase()}-{receipt.receipt_number}
                </div>
                
                <div className="font-bold text-gray-900 text-base">
                  <p className="m-0">Follow us on our socials!</p>
                  <p className="m-0 text-zinc-900 font-black text-lg">@cofteacafe</p>
                </div>
                
                <div className="text-sm text-gray-500 font-semibold pt-2">
                  <p className="m-0">Thank you for your business!</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-6 text-base font-medium">Receipt not found.</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button className="px-7 py-3 bg-gray-900 text-white rounded-xl text-base font-bold uppercase tracking-wider hover:bg-black transition-colors cursor-pointer" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default SalesReceiptModal;
