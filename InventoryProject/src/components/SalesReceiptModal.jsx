import React, { useState, useEffect } from 'react';
import { getSalesReceipt } from '../api/logsApi';
import '../styles/Inventory.css';
import '../styles/SalesReceiptModal.css';

const SalesReceiptModal = ({ saleId, onClose }) => {
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (saleId) {
      fetchReceipt();
    }
  }, [saleId]);

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

  if (!saleId) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content receipt-modal-content">
        <div className="modal-header">
          <h2>RECEIPT</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body receipt-modal-body">
          {loading ? (
            <p>Loading receipt details...</p>
          ) : receipt ? (
            <div>
              <p>Receipt #: {receipt.receipt_number || "N/A"}</p>
              <p>Date/Time: {new Date(receipt.created_at).toLocaleString()}</p>
              <p>Staff: {receipt.users?.name || "System"}</p>
              
              <hr className="receipt-modal-divider" />
              
              <table className="receipt-modal-table">
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd' }}>
                    <th className="receipt-modal-th-left">Item</th>
                    <th className="receipt-modal-th-left">Qty</th>
                    <th className="receipt-modal-th-left">Price</th>
                    <th className="receipt-modal-th-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.sale_items?.map(item => (
                    <tr key={item.id}>
                      <td className="receipt-modal-td-left">{item.products?.name}</td>
                      <td className="receipt-modal-td-left">{item.quantity}</td>
                      <td className="receipt-modal-td-left">₱{parseFloat(item.unit_price).toFixed(2)}</td>
                      <td className="receipt-modal-td-right">₱{(item.quantity * item.unit_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <hr className="receipt-modal-divider" />

              <div className="receipt-modal-totals">
                <p>Subtotal: ₱{(receipt.total_amount - (receipt.tax_amount || 0) + (receipt.discount_amount || 0)).toFixed(2)}</p>
                {receipt.discount_amount > 0 && <p>Discount: -₱{parseFloat(receipt.discount_amount).toFixed(2)}</p>}
                {receipt.tax_amount > 0 && <p>Tax: ₱{parseFloat(receipt.tax_amount).toFixed(2)}</p>}
                <h3 className="receipt-modal-grandtotal">TOTAL: ₱{parseFloat(receipt.total_amount).toFixed(2)}</h3>
              </div>
            </div>
          ) : (
            <p>Receipt not found.</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary receipt-modal-close-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default SalesReceiptModal;
