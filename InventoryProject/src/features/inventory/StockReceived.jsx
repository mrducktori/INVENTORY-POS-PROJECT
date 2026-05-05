import React, { useState, useEffect } from 'react';
import { getIngredients, receiveStock } from '../../api/inventoryApi';
import { getAllProducts, receiveProductStock } from '../../api/productsApi';
import { formatQuantity } from '../../utils/productUtils';

import './StockReceived.css';

const StockReceived = () => {
  const [ingredients, setIngredients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');

  // Combined list of trackable items
  const activeIngredients = ingredients.filter(i => !i.is_archived);
  const trackableProducts = products.filter(p => p.track_stock && !p.is_archived);

  const allItems = [
    ...activeIngredients.map(i => ({ ...i, itemType: 'ingredient' })),
    ...trackableProducts.map(p => ({ 
      ...p, 
      itemType: 'product', 
      low_stock_alert: p.low_stock_threshold,
      unit: 'pcs' // Products usually pcs
    }))
  ].sort((a, b) => a.name.localeCompare(b.name));

  const selectedItem = allItems.find(i => String(i.id) === String(selectedId));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ingData, prodData] = await Promise.all([
        getIngredients(),
        getAllProducts()
      ]);
      setIngredients(ingData || []);
      setProducts(prodData || []);
    } catch (err) {
      setMessage('Error loading data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    if (!selectedId || !quantity) {
      setMessage('Please select an item and enter a quantity.');
      return;
    }
    try {
      setSubmitting(true);
      if (selectedItem.itemType === 'ingredient') {
        await receiveStock(selectedId, parseFloat(quantity));
      } else {
        await receiveProductStock(selectedId, parseFloat(quantity));
      }
      
      setMessage(`Successfully added ${parseFloat(quantity)} ${selectedItem.unit || ''} to ${selectedItem.name}!`);
      setSelectedId('');
      setQuantity('');
      setTimeout(() => setMessage(''), 4000);
      fetchData();
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
        <p>Log incoming deliveries for ingredients and direct-track products.</p>
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
              <label>Select Item (Ingredient or Product)</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                required
              >
                <option value="">-- Choose an item --</option>
                <optgroup label="Ingredients (Raw Materials)">
                  {activeIngredients.map(ing => (
                    <option key={`ing-${ing.id}`} value={ing.id}>
                      {ing.name} — {formatQuantity(ing.stock_quantity, ing.unit)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Products (Direct Tracking)">
                  {trackableProducts.map(p => (
                    <option key={`prod-${p.id}`} value={p.id}>
                      {p.name} — {p.stock_quantity} pcs
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {selectedItem && (
              <div className="stock-preview-box">
                <span>Current: <strong>{formatQuantity(selectedItem.stock_quantity, selectedItem.unit)}</strong></span>
                <span>Alert at: <strong>{formatQuantity(selectedItem.low_stock_alert, selectedItem.unit)}</strong></span>
                <span className={`stock-badge ${
                  selectedItem.stock_quantity <= 0 ? 'out' :
                  selectedItem.stock_quantity <= selectedItem.low_stock_alert ? 'critical' : 'normal'
                }`}>
                  {selectedItem.stock_quantity <= 0 ? 'OUT OF STOCK' :
                   selectedItem.stock_quantity <= selectedItem.low_stock_alert ? 'LOW STOCK' : 'HEALTHY'}
                </span>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Quantity to Add ({selectedItem?.unit || 'unit'})</label>
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
          <h2>Inventory Status Overview</h2>
        </div>
        <div className="card-body">
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Item Name</th>
                    <th style={{ textAlign: 'right' }}>Current Stock</th>
                    <th style={{ textAlign: 'right' }}>Low Alert</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {allItems.map(item => (
                    <tr key={`${item.itemType}-${item.id}`} className={selectedId === String(item.id) ? 'row-highlighted' : ''}>
                      <td style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase' }}>{item.itemType}</td>
                      <td><strong>{item.name}</strong></td>
                      <td style={{ textAlign: 'right' }}>{formatQuantity(item.stock_quantity, item.unit)}</td>
                      <td style={{ textAlign: 'right' }}>{formatQuantity(item.low_stock_alert, item.unit)}</td>
                      <td>
                        <span className={`stock-badge ${
                          item.stock_quantity <= 0 ? 'out' :
                          item.stock_quantity <= item.low_stock_alert ? 'critical' :
                          item.stock_quantity <= item.low_stock_alert * 1.5 ? 'warning' : 'normal'
                        }`}>
                          {item.stock_quantity <= 0 ? 'OUT' :
                           item.stock_quantity <= item.low_stock_alert ? 'CRITICAL' :
                           item.stock_quantity <= item.low_stock_alert * 1.5 ? 'WARNING' : 'HEALTHY'}
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
