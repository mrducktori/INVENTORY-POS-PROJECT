import React, { useState, useEffect } from 'react';
import { getSales } from '../api/salesApi';
import SalesReceiptModal from './SalesReceiptModal';
import '../styles/Inventory.css';
import '../styles/TransactionLogs.css';

const TransactionLogs = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState(null);

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

  const calculateTotalSales = () => {
    return sales.reduce((sum, sale) => sum + parseFloat(sale.total_amount), 0);
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Transaction Logs</h1>
        <p>Review detailed point-of-sale transaction history.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="value">{sales.length}</div>
          <div className="label">Total Transactions</div>
        </div>
        <div className="stat-card">
          <div className="value">₱{calculateTotalSales().toFixed(2)}</div>
          <div className="label">Total Revenue</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header tx-logs-header">
          <h2>Transaction History</h2>
          <div>
            <input 
              type="date" 
              value={dateFilter} 
              onChange={e => setDateFilter(e.target.value)}
              className="tx-date-input"
            />
            {dateFilter && (
              <button 
                onClick={() => setDateFilter('')}
                className="tx-date-clear"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="card-body">
          {loading ? (
            <p>Loading transactions...</p>
          ) : sales.length > 0 ? (
            <div className="table-container">
              <table className="table tx-table">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Date & Time</th>
                    <th>Cashier</th>
                    <th>Items</th>
                    <th>Total Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.id}>
                      <td className="tx-id-cell">
                        {sale.receipt_number || sale.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td>{new Date(sale.created_at).toLocaleString()}</td>
                      <td>{sale.users?.name || 'Unknown'}</td>
                      <td>{sale.sale_items?.length || 0} items</td>
                      <td><strong>₱{parseFloat(sale.total_amount).toFixed(2)}</strong></td>
                      <td>
                        <button 
                          className="btn btn-secondary tx-view-btn" 
                          onClick={() => setSelectedSaleId(sale.id)}
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No transactions found for the selected period.</p>
            </div>
          )}
        </div>
      </div>

      {selectedSaleId && (
        <SalesReceiptModal 
          saleId={selectedSaleId} 
          onClose={() => setSelectedSaleId(null)} 
        />
      )}
    </div>
  );
};

export default TransactionLogs;
