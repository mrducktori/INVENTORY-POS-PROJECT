import React, { useState, useEffect } from 'react';
import { getSales } from '../../api/salesApi';
import { getSalesReceipt } from '../../api/logsApi';
import './SalesReceiptJournal.css';

// add_ons entries may be full objects OR JSON strings — handle both
const addonName = (a) => {
  if (!a) return '';
  if (typeof a === 'object') return a.name ?? '';
  try { return JSON.parse(a)?.name ?? a; } catch { return a; }
};

// Ensure add_ons is an array before mapping
const parseAddons = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [raw];
  }
};


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
      <tr onClick={toggleExpand} className="performance-row journal-row">
        <td style={{ textAlign: 'center', width: '60px' }}>
          <span className={`expand-icon ${expanded ? 'active' : ''}`}>▶</span>
        </td>
        <td>
          <span className="receipt-ref-text">
            #{sale.receipt_number || sale.id.substring(0, 8).toUpperCase()}
          </span>
        </td>
        <td className="log-timestamp">{new Date(sale.created_at).toLocaleString()}</td>
        <td className="operator-name">{sale.users?.name || 'System'}</td>
        <td style={{ fontSize: '11px', fontWeight: '900', color: '#aaa', textTransform: 'uppercase' }}>
          {sale.sale_items?.length || 0} units
        </td>
        <td style={{ textAlign: 'right', fontWeight: '900', fontStyle: 'italic', fontSize: '14px' }}>
          ₱{parseFloat(sale.total_amount).toFixed(2)}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan="6" className="receipt-expand-area">
            <div className="animate-pop-in">
              {loading ? (
                <div className="audit-loading-row">
                  <div className="audit-loading-text">Retrieving digital record...</div>
                </div>
              ) : receiptDetails ? (
                <div className="receipt-digital-copy">
                  <div className="receipt-branding">
                    <h3>COF/TEA System</h3>
                    <p className="receipt-audit-tag">Digital Audit Copy</p>
                    <div style={{ marginTop: '16px' }}>
                       <p style={{ fontFamily: 'monospace', fontWeight: '900', color: '#000', fontSize: '11px' }}>
                         #{receiptDetails.receipt_number || sale.id.substring(0,8).toUpperCase()}
                       </p>
                       <p style={{ fontSize: '9px', fontWeight: '700', color: '#aaa' }}>
                         {new Date(receiptDetails.created_at).toLocaleString()}
                       </p>
                    </div>
                  </div>
                  
                  <div style={{ padding: '0 32px' }}>
                    <div className="receipt-dashed-divider" />
                    <div className="receipt-items-list">
                      {receiptDetails.sale_items?.map(item => (
                        <div key={item.id} className="receipt-item-row">
                          <div className="receipt-item-info">
                            <span className="receipt-item-name">{item.quantity}x {item.products?.name}</span>
                            {(item.cup_size || item.add_ons?.length > 0) && (
                            <span className="receipt-item-meta">
                              {item.cup_size && <span>[{item.cup_size}] </span>}
                              {parseAddons(item.add_ons).length > 0 && (
                                <span>+{parseAddons(item.add_ons).map(addonName).join(', ')}</span>
                              )}
                            </span>
                            )}
                          </div>
                          <span className="receipt-item-price">₱{(item.quantity * item.unit_price).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="receipt-dashed-divider" />
                    <div style={{ padding: '8px 0' }}>
                      <div className="receipt-summary-line">
                        <span>Base Amount</span>
                        <span>₱{(receiptDetails.total_amount - (receiptDetails.tax_amount || 0) + (receiptDetails.discount_amount || 0)).toFixed(2)}</span>
                      </div>
                      {(receiptDetails.discount_amount > 0) && (
                        <div className="receipt-summary-line" style={{ color: '#c62828', fontWeight: '900' }}>
                          <span>Markdowns</span>
                          <span>-₱{parseFloat(receiptDetails.discount_amount).toFixed(2)}</span>
                        </div>
                      )}
                      {(receiptDetails.tax_amount > 0) && (
                        <div className="receipt-summary-line">
                          <span>Service Tax</span>
                          <span>₱{parseFloat(receiptDetails.tax_amount).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="receipt-total-line">
                        <span className="receipt-total-label">Final Total</span>
                        <span className="receipt-total-amount">₱{parseFloat(receiptDetails.total_amount).toFixed(2)}</span>
                      </div>
                      <div className="receipt-summary-line" style={{ marginTop: '12px', fontSize: '9px', fontStyle: 'italic' }}>
                        <span>Method</span>
                        <span>{receiptDetails.payment_method}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="receipt-footer-tag">
                    EndOfTransmission
                  </div>
                </div>
              ) : (
                <div className="audit-empty-text" style={{ color: '#c62828' }}>Data retrieval failed</div>
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
    <div className="journal-container">
      <div className="journal-header-flex">
        <div className="journal-title">
          <h1>Receipt Journal</h1>
          <p>Click any transaction row to expand and view its full receipt.</p>
        </div>
        <div className="date-filter-group">
          <label className="date-filter-label">Filter by Date</label>
          <input 
            type="date" 
            value={dateFilter} 
            onChange={e => setDateFilter(e.target.value)}
            className="date-filter-input"
          />
        </div>
      </div>

      <div className="journal-table-card">
        <div className="audit-table-wrapper">
          <table className="performance-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}></th>
                <th>Receipt Ref</th>
                <th>Timestamp</th>
                <th>Operator</th>
                <th>Items</th>
                <th style={{ textAlign: 'right' }}>Settlement</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="audit-loading-row">
                    <div className="audit-loading-text">Consulting Ledger...</div>
                  </td>
                </tr>
              ) : sales.length > 0 ? (
                sales.map(sale => <ExpandableReceiptRow key={sale.id} sale={sale} />)
              ) : (
                <tr>
                  <td colSpan="6" className="audit-empty-row">
                    <div className="audit-empty-text">No transactions recorded</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesReceiptJournal;
