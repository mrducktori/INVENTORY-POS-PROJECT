import React, { useState, useEffect } from 'react';
import { getIngredients, receiveStock } from '../api/inventoryApi';
import '../styles/Inventory.css';

const StockReceived = () => {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');

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
      setMessage('❌ Please select an ingredient and enter quantity');
      return;
    }

    try {
      await receiveStock(selectedId, parseFloat(quantity));
      setMessage('✓ Stock received successfully!');
      setSelectedId('');
      setQuantity('');
      setTimeout(() => setMessage(''), 3000);
      fetchIngredients();
    } catch (err) {
      setMessage('❌ Error: ' + err.message);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>📦 Stock Received</h1>
        <p>Add new stock to your inventory</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', marginBottom: '30px' }}>
        <div className="card-header">
          <h2>Receive Stock</h2>
        </div>
        <div className="card-body">
          {message && (
            <div className={`alert ${message.includes('✓') ? 'alert-success' : 'alert-error'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleReceiveStock}>
            <div className="form-group">
              <label>Select Ingredient</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                <option value="">-- Choose an ingredient --</option>
                {ingredients.map(ing => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit}) - Current: {ing.stock_quantity}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Quantity Received</label>
              <input
                type="number"
                step="0.01"
                placeholder="Enter quantity"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Receive Stock
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Ingredient Inventory</h2>
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
                    <th>Unit</th>
                    <th>Current Stock</th>
                    <th>Low Stock Alert</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map(ing => (
                    <tr key={ing.id}>
                      <td>{ing.name}</td>
                      <td>{ing.unit}</td>
                      <td>{ing.stock_quantity}</td>
                      <td>{ing.low_stock_alert}</td>
                      <td>
                        <span className={`status ${ing.stock_quantity < ing.low_stock_alert ? 'low' : 'normal'}`}>
                          {ing.stock_quantity < ing.low_stock_alert ? '⚠ Low' : '✓ Normal'}
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
