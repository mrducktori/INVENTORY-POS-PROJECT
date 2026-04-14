import React, { useState, useEffect } from 'react';
import { getSales } from '../api/salesApi';
import '../styles/Inventory.css';

const TransactionLogs = () => {
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
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Transaction History</h2>
          <div>
            <input 
              type="date" 
              value={dateFilter} 
              onChange={e => setDateFilter(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: '3px', border: 'none', cursor: 'pointer' }}
            />
            {dateFilter && (
              <button 
                onClick={() => setDateFilter('')}
                style={{ marginLeft: '10px', background: 'transparent', border: '1px solid white', color: 'white', cursor: 'pointer', padding: '4px 8px', borderRadius: '3px' }}
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
              <table className="table">
                <thead>
                  <tr>
                    <th>Transaction ID</th>
                    <th>Date & Time</th>
                    <th>Cashier</th>
                    <th>Items</th>
                    <th>Total Amount</th>
                    <th>Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(sale => (
                    <tr key={sale.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#666' }}>
                        {sale.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td>{new Date(sale.created_at).toLocaleString()}</td>
                      <td>{sale.users?.name || 'Unknown'}</td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#555' }}>
                          {(sale.sale_items || []).map((item, idx) => (
                            <div key={idx}>
                              {item.quantity}x {item.products?.name} 
                            </div>
                          ))}
                        </div>
                      </td>
                      <td><strong>₱{parseFloat(sale.total_amount).toFixed(2)}</strong></td>
                      <td>
                        <span className="status normal">{sale.payment_method}</span>
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
    </div>
  );
};

export default TransactionLogs;
