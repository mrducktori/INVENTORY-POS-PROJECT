import React, { useState, useEffect } from 'react';
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-800 uppercase tracking-wider m-0">Receipt</h2>
          <button className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer text-xl leading-none" onClick={onClose}>×</button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <p className="text-gray-500 text-center py-4 text-sm">Loading receipt details...</p>
          ) : receipt ? (
            <div className="text-sm text-gray-700">
              <p className="mb-1"><span className="font-semibold text-gray-900">Receipt #:</span> {receipt.receipt_number || "N/A"}</p>
              <p className="mb-1"><span className="font-semibold text-gray-900">Date:</span> {new Date(receipt.created_at).toLocaleString()}</p>
              <p className="mb-4"><span className="font-semibold text-gray-900">Staff:</span> {receipt.users?.name || "System"}</p>
              
              <div className="border-t border-dashed border-gray-300 my-4"></div>
              
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-2 font-semibold text-gray-900">Item</th>
                    <th className="py-2 font-semibold text-gray-900 text-center">Qty</th>
                    <th className="py-2 font-semibold text-gray-900 text-right">Price</th>
                    <th className="py-2 font-semibold text-gray-900 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipt.sale_items?.map(item => (
                    <tr key={item.id}>
                      <td className="py-2">{item.products?.name}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">₱{parseFloat(item.unit_price).toFixed(2)}</td>
                      <td className="py-2 text-right">₱{(item.quantity * item.unit_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="border-t border-dashed border-gray-300 my-4"></div>

              <div className="text-right space-y-1">
                <p className="text-gray-600">Subtotal: ₱{(receipt.total_amount - (receipt.tax_amount || 0) + (receipt.discount_amount || 0)).toFixed(2)}</p>
                {receipt.discount_amount > 0 && <p className="text-gray-600">Discount: -₱{parseFloat(receipt.discount_amount).toFixed(2)}</p>}
                {receipt.tax_amount > 0 && <p className="text-gray-600">Tax: ₱{parseFloat(receipt.tax_amount).toFixed(2)}</p>}
                <h3 className="text-lg font-bold text-gray-900 mt-2">TOTAL: ₱{parseFloat(receipt.total_amount).toFixed(2)}</h3>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4 text-sm">Receipt not found.</p>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/30 flex justify-end">
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors cursor-pointer" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default SalesReceiptModal;
