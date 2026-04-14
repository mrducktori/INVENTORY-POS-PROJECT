import React, { useState, useEffect } from 'react';
import { getIngredients } from '../api/inventoryApi';
import { reportWastage, getWastageHistory } from '../api/wastageApi';
import '../styles/Inventory.css';

const ReportWastage = () => {
  const [ingredients, setIngredients] = useState([]);
  const [wastageHistory, setWastageHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ingredient_id: '',
    quantity: '',
    reason: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ings, history] = await Promise.all([
        getIngredients(),
        getWastageHistory()
      ]);
      setIngredients(ings || []);
      setWastageHistory(history || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ingredient_id || !formData.quantity || !formData.reason) {
      setMessage('All fields are required');
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await reportWastage({
        ...formData,
        quantity: parseFloat(formData.quantity),
        reported_by: user.id
      });

      setMessage('Wastage reported successfully!');
      setFormData({ ingredient_id: '', quantity: '', reason: '' });
      setTimeout(() => setMessage(''), 3000);
      fetchData();
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const totalWastageQuantity = wastageHistory.reduce((sum, w) => sum + w.quantity, 0);

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Report Broken Items</h1>
        <p>Track and report ingredient wastage</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="label">Total Records</div>
          <div className="value">{wastageHistory.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">Total Quantity Wasted</div>
          <div className="value">{totalWastageQuantity.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="label">This Month</div>
          <div className="value">
            {wastageHistory.filter(w => {
              const date = new Date(w.created_at);
              const now = new Date();
              return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }).length}
          </div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px', marginBottom: '30px' }}>
        <div className="card-header">
          <h2>Report Wastage</h2>
        </div>
        <div className="card-body">
          {message && (
            <div className={`alert ${message.includes('successfully') ? 'alert-success' : 'alert-error'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Ingredient</label>
              <select
                name="ingredient_id"
                value={formData.ingredient_id}
                onChange={handleInputChange}
              >
                <option value="">-- Select ingredient --</option>
                {ingredients.map(ing => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Quantity Wasted</label>
              <input
                type="number"
                step="0.01"
                name="quantity"
                placeholder="Enter quantity"
                value={formData.quantity}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Reason for Wastage</label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
              >
                <option value="">-- Select reason --</option>
                <option value="Expiry">Expiry</option>
                <option value="Spoilage">Spoilage</option>
                <option value="Damage">Damage</option>
                <option value="Spillage">Spillage</option>
                <option value="Quality Issue">Quality Issue</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button type="submit" className="btn btn-primary">
              Report Wastage
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Wastage History</h2>
        </div>
        <div className="card-body">
          {loading ? (
            <p>Loading...</p>
          ) : wastageHistory.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Ingredient</th>
                    <th>Quantity</th>
                    <th>Unit</th>
                    <th>Reason</th>
                    <th>Reported By</th>
                  </tr>
                </thead>
                <tbody>
                  {wastageHistory.map(record => (
                    <tr key={record.id}>
                      <td>{new Date(record.created_at).toLocaleDateString()}</td>
                      <td>{record.ingredients?.name || 'N/A'}</td>
                      <td>{record.quantity}</td>
                      <td>{record.ingredients?.unit || 'N/A'}</td>
                      <td>
                        <span style={{
                          background: '#fff3e0',
                          padding: '4px 12px',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}>
                          {record.reason}
                        </span>
                      </td>
                      <td>{record.users?.name || 'Unknown'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No wastage records</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportWastage;
