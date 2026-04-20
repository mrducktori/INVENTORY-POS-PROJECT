import React, { useState, useEffect } from 'react';
import { getSales } from '../api/salesApi';
import { getSalesReceipt } from '../api/logsApi';
import '../styles/Inventory.css';
import '../styles/SalesReceiptJournal.css';

const ExpandableReceiptRow = ({ sale }) => {
  const [expanded, setExpanded] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [loading, setLoading] = useState(false);

  const toggleExpand = async () => {
    if (!expanded && !receiptDetails) {
      setLoading(true);
      try {
        const data = await getSalesReceipt(sale.id);
        setReceiptDetails(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(!expanded);
  };

  return (
    <React.Fragment>
      <tr onClick={toggleExpand} className="receipt-row">
        <td className="receipt-row-arrow">
          {expanded ? '▼' : '▶'}
        </td>
        <td className="receipt-row-id">
          {sale.receipt_number || sale.id.substring(0, 8).toUpperCase()}
        </td>
        <td>{new Date(sale.created_at).toLocaleString()}</td>
        <td>{sale.users?.name || 'System'}</td>
        <td>{sale.sale_items?.length || 0} items</td>
        <td><strong>₱{parseFloat(sale.total_amount).toFixed(2)}</strong></td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="6" className="receipt-expanded-container">
            <div className="receipt-expanded-wrapper">
              {loading ? (
                <p>Loading receipt...</p>
              ) : receiptDetails ? (
                <div className="receipt-paper">
                  <div className="receipt-header">
                    <h3>COF/TEA SYSTEM</h3>
                    <p className="receipt-number">Receipt #{receiptDetails.receipt_number || sale.id.substring(0,8)}</p>
                    <p>{new Date(receiptDetails.created_at).toLocaleString()}</p>
                    <p>Cashier: {receiptDetails.users?.name || 'System'}</p>
                  </div>
                  
                  <hr className="receipt-divider" />
                  
                  <table className="receipt-items-table">
                    <tbody>
                      {receiptDetails.sale_items?.map(item => (
                        <tr key={item.id}>
                          <td className="receipt-item-cell">{item.quantity}x {item.products?.name}</td>
                          <td className="receipt-item-total">₱{(item.quantity * item.unit_price).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <hr className="receipt-divider" />

                  <div className="receipt-totals">
                    <div className="receipt-totals-row">
                      <span>Subtotal</span>
                      <span>₱{(receiptDetails.total_amount - (receiptDetails.tax_amount || 0) + (receiptDetails.discount_amount || 0)).toFixed(2)}</span>
                    </div>
                    {(receiptDetails.discount_amount > 0) && (
                      <div className="receipt-totals-row">
                        <span>Discount</span>
                        <span>-₱{parseFloat(receiptDetails.discount_amount).toFixed(2)}</span>
                      </div>
                    )}
                    {(receiptDetails.tax_amount > 0) && (
                      <div className="receipt-totals-row">
                        <span>Tax</span>
                        <span>₱{parseFloat(receiptDetails.tax_amount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="receipt-grand-total">
                      <span>TOTAL</span>
                      <span>₱{parseFloat(receiptDetails.total_amount).toFixed(2)}</span>
                    </div>
                    <div className="receipt-payment-info">
                      <span>Payment</span>
                      <span>{receiptDetails.payment_method}</span>
                    </div>
                  </div>
                  
                  <div className="receipt-footer">
                    <p>Thank you for your purchase!</p>
                  </div>
                </div>
              ) : (
                <p>Failed to load receipt details.</p>
              )}
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
};

const SalesReceiptJournal = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    fetchSales();
  }, [dateFilter]);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const data = await getSales({ date: dateFilter });
      setSales(data || []);
    } catch (err) {
      console.error('Failed to load sales:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header receipt-header-actions">
        <div>
          <h1>Receipt Journal</h1>
          <p>Click any transaction row to expand and view its full receipt.</p>
        </div>
        <div>
          <input 
            type="date" 
            value={dateFilter} 
            onChange={e => setDateFilter(e.target.value)}
            className="receipt-date-input"
          />
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table table-collapse">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Receipt #</th>
                  <th>Date & Time</th>
                  <th>Cashier</th>
                  <th>Items</th>
                  <th>Total Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="table-loading">Loading receipts...</td>
                  </tr>
                ) : sales.length > 0 ? (
                  sales.map(sale => <ExpandableReceiptRow key={sale.id} sale={sale} />)
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-state">No sales found for this date.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesReceiptJournal;
