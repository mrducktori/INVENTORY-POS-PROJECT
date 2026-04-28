import React, { useState, useEffect } from 'react';
import { getIngredients, receiveStock } from '../../api/inventoryApi';
import { formatQuantity } from '../../utils/productUtils';

import './StockReceived.css';

const StockReceived = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');

  const activeIngredients = ingredients.filter(i => !i.is_archived);
  const selectedIng = activeIngredients.find(i => String(i.id) === String(selectedId));

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients();
      setIngredients(data || []);
    } catch (err) {
      setMessage('Error loading ingredients: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    if (!selectedId || !quantity) {
      setMessage('Please select an ingredient and enter a quantity.');
      return;
    }
    try {
      setSubmitting(true);
      await receiveStock(selectedId, parseFloat(quantity));
      setMessage(`Successfully added ${formatQuantity(parseFloat(quantity), selectedIng?.unit || '')} of stock!`);
      setSelectedId('');
      setQuantity('');
      setTimeout(() => setMessage(''), 4000);
      fetchIngredients();
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Stock Received</h1>
        <p>Log incoming deliveries and top up ingredient stock levels.</p>
      </div>

      {message && (
        <div className={`alert ${message.includes('success') || message.includes('Successfully') ? 'alert-success' : 'alert-error'}`}>
          {message}
        </div>
      )}

      <div className="card manage-form-card">
        <div className="card-header">
          <h2>Add Incoming Stock</h2>
        </div>
        <div className="card-body">
          <form onSubmit={handleReceiveStock}>
            <div className="form-group">
              <label>Select Ingredient</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                required
              >
                <option value="">-- Choose an ingredient --</option>
                {activeIngredients.map(ing => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} — {formatQuantity(ing.stock_quantity, ing.unit)} in stock
                  </option>
                ))}
              </select>
            </div>

            {selectedIng && (
              <div className="stock-preview-box">
                <span>Current: <strong>{formatQuantity(selectedIng.stock_quantity, selectedIng.unit)}</strong></span>
                <span>Alert at: <strong>{formatQuantity(selectedIng.low_stock_alert, selectedIng.unit)}</strong></span>
                <span className={`stock-badge ${
                  selectedIng.stock_quantity <= 0 ? 'out' :
                  selectedIng.stock_quantity <= selectedIng.low_stock_alert ? 'critical' : 'normal'
                }`}>
                  {selectedIng.stock_quantity <= 0 ? 'OUT OF STOCK' :
                   selectedIng.stock_quantity <= selectedIng.low_stock_alert ? 'LOW STOCK' : 'HEALTHY'}
                </span>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Quantity to Add ({selectedIng?.unit || 'unit'})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Enter quantity received"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : 'Confirm Stock Receipt'}
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Current Ingredient Inventory</h2>
        </div>
        <div className="card-body">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Current Stock</th>
                    <th>Low Alert</th>
                    <th>Stock Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeIngredients.map(ing => (
                    <tr key={ing.id} className={selectedId === String(ing.id) ? 'row-highlighted' : ''}>
                      <td><strong>{ing.name}</strong></td>
                      <td>{formatQuantity(ing.stock_quantity, ing.unit)}</td>
                      <td>{formatQuantity(ing.low_stock_alert, ing.unit)}</td>
                      <td>
                        <span className={`stock-badge ${
                          ing.stock_quantity <= 0 ? 'out' :
                          ing.stock_quantity <= ing.low_stock_alert ? 'critical' :
                          ing.stock_quantity <= ing.low_stock_alert * 1.5 ? 'warning' : 'normal'
                        }`}>
                          {ing.stock_quantity <= 0 ? 'OUT' :
                           ing.stock_quantity <= ing.low_stock_alert ? 'CRITICAL' :
                           ing.stock_quantity <= ing.low_stock_alert * 1.5 ? 'WARNING' : 'HEALTHY'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockReceived;
