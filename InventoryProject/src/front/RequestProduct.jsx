import React, { useState, useEffect } from 'react';
import { createRequest, getRequests } from '../api/requestsApi';
import { getCurrentUser } from '../api/authApi';
import { getProducts } from '../api/posApi';
import { getIngredients } from '../api/inventoryApi';
import { getRecipesByProduct } from '../api/recipesApi';
import '../styles/Inventory.css';
import '../styles/RequestProduct.css';

const RequestProduct = () => {
  const [activeTab, setActiveTab] = useState('SUBMIT'); // 'SUBMIT' | 'HISTORY'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Data for dropdowns
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);

  // Form State
  const [type, setType] = useState('NEW_PRODUCT');
  const [priority, setPriority] = useState('NORMAL');
  const [description, setDescription] = useState('');
  
  // Structured Form Data
  const [newProduct, setNewProduct] = useState({ name: '', category: '', price: '' });
  const [selectedProductId, setSelectedProductId] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [proposedRecipe, setProposedRecipe] = useState([]); // List of { ingredient_id, name, qty, unit }
  const [newRecipeItem, setNewRecipeItem] = useState({ ingredient_id: '', quantity: '' });
  
  // History State
  const [history, setHistory] = useState([]);

  const user = getCurrentUser();

  useEffect(() => {
    fetchDropdownData();
    if (activeTab === 'HISTORY') {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchDropdownData = async () => {
    try {
      const [prodData, ingData] = await Promise.all([
        getProducts(),
        getIngredients()
      ]);
      setProducts(prodData || []);
      setIngredients(ingData || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await getRequests({ requested_by: user.id });
      setHistory(data || []);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = async (productId) => {
    setSelectedProductId(productId);
    if (type === 'PRICE_CHANGE') {
      const prod = products.find(p => p.id === productId);
      setNewPrice(prod?.price || '');
    } else if (type === 'RECIPE_CHANGE') {
      try {
        const data = await getRecipesByProduct(productId);
        const mapped = (data || []).map(r => ({
          ingredient_id: r.ingredient_id,
          name: r.ingredients?.name,
          qty: r.quantity_used,
          unit: r.ingredients?.unit
        }));
        setProposedRecipe(mapped);
      } catch (err) {
        console.error('Failed to load recipe:', err);
      }
    }
  };

  const addIngredientToProposed = () => {
    if (!newRecipeItem.ingredient_id || !newRecipeItem.quantity) return;
    const ing = ingredients.find(i => i.id === newRecipeItem.ingredient_id);
    if (!ing) return;

    setProposedRecipe([...proposedRecipe, {
      ingredient_id: ing.id,
      name: ing.name,
      qty: parseFloat(newRecipeItem.quantity),
      unit: ing.unit
    }]);
    setNewRecipeItem({ ingredient_id: '', quantity: '' });
  };

  const removeIngredientFromProposed = (id) => {
    setProposedRecipe(proposedRecipe.filter(item => item.ingredient_id !== id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      type,
      requested_by: user.id,
      details: {
        description,
        priority,
        requestedDate: new Date().toISOString(),
      }
    };

    if (type === 'NEW_PRODUCT') {
      payload.details.new_product = { ...newProduct, price: parseFloat(newProduct.price) };
    } else if (type === 'PRICE_CHANGE') {
      const prod = products.find(p => p.id === selectedProductId);
      payload.details.product_id = selectedProductId;
      payload.details.product_name = prod?.name;
      payload.details.old_price = prod?.price;
      payload.details.proposed_price = parseFloat(newPrice);
    } else if (type === 'RECIPE_CHANGE') {
      const prod = products.find(p => p.id === selectedProductId);
      payload.details.product_id = selectedProductId;
      payload.details.product_name = prod?.name;
      payload.details.proposed_recipe = proposedRecipe;
    }

    try {
      setLoading(true);
      await createRequest(payload);
      setMessage('Request submitted successfully!');
      resetForm();
      setActiveTab('HISTORY');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error submitting request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setDescription('');
    setNewProduct({ name: '', category: '', price: '' });
    setSelectedProductId('');
    setNewPrice('');
    setProposedRecipe([]);
    setPriority('NORMAL');
  };

  return (
    <div className="inventory-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Staff Request Center</h1>
          <p>Submit structured requests for product additions or modifications.</p>
        </div>
        <div className="tab-buttons">
          <button 
            className={`btn ${activeTab === 'SUBMIT' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('SUBMIT')}
          >
            New Request
          </button>
          <button 
            className={`btn ${activeTab === 'HISTORY' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('HISTORY')}
          >
            My History
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-error'}`}>
          {message}
        </div>
      )}

      {activeTab === 'SUBMIT' ? (
        <div className="card request-card-large">
          <div className="card-header">
            <h2>{type.replace('_', ' ')} FORM</h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Request Category</label>
                  <select value={type} onChange={e => { setType(e.target.value); resetForm(); }}>
                    <option value="NEW_PRODUCT">Add New Item</option>
                    <option value="PRICE_CHANGE">Modify Pricing</option>
                    <option value="RECIPE_CHANGE">Modify Recipe</option>
                    <option value="OTHER">General Feedback</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Urgency</label>
                  <select value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="request-form-content animate-fade-in">
                {type === 'NEW_PRODUCT' && (
                  <div className="structured-form">
                    <div className="form-group">
                      <label>Proposed Item Name</label>
                      <input 
                        type="text" 
                        value={newProduct.name} 
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                        placeholder="e.g. Spanish Latte"
                        required 
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Category</label>
                        <input 
                          type="text" 
                          value={newProduct.category} 
                          onChange={e => setNewProduct({...newProduct, category: e.target.value})} 
                          placeholder="e.g. COFFEE"
                          required 
                        />
                      </div>
                      <div className="form-group">
                        <label>Suggested Price (₱)</label>
                        <input 
                          type="number" 
                          step="0.01" 
                          value={newProduct.price} 
                          onChange={e => setNewProduct({...newProduct, price: e.target.value})} 
                          required 
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(type === 'PRICE_CHANGE' || type === 'RECIPE_CHANGE') && (
                  <div className="form-group">
                    <label>Select Existing Product</label>
                    <select 
                      value={selectedProductId} 
                      onChange={e => handleProductSelect(e.target.value)}
                      required
                    >
                      <option value="">-- Choose product --</option>
                      {products.filter(p => !p.is_archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                )}

                {type === 'PRICE_CHANGE' && selectedProductId && (
                  <div className="form-group animate-fade-in">
                    <label>Proposed New Price (₱)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={newPrice} 
                      onChange={e => setNewPrice(e.target.value)} 
                      required 
                    />
                    <small style={{color: '#666'}}>Current price: ₱{products.find(p => p.id === selectedProductId)?.price}</small>
                  </div>
                )}

                {type === 'RECIPE_CHANGE' && selectedProductId && (
                  <div className="proposed-recipe-section animate-fade-in">
                    <h3>Proposed Recipe Changes</h3>
                    <div className="table-container">
                      <table className="table">
                        <thead>
                          <tr><th>Ingredient</th><th>Proposed Qty</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {proposedRecipe.map(item => (
                            <tr key={item.ingredient_id}>
                              <td>{item.name}</td>
                              <td>
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  value={item.qty} 
                                  onChange={e => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setProposedRecipe(proposedRecipe.map(i => i.ingredient_id === item.ingredient_id ? {...i, qty: val} : i));
                                  }}
                                  style={{width: '80px'}}
                                /> {item.unit}
                              </td>
                              <td>
                                <button type="button" className="btn btn-small btn-danger" onClick={() => removeIngredientFromProposed(item.ingredient_id)}>×</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="add-proposed-ing" style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                      <select 
                        value={newRecipeItem.ingredient_id} 
                        onChange={e => setNewRecipeItem({...newRecipeItem, ingredient_id: e.target.value})}
                      >
                        <option value="">+ Add Ingredient</option>
                        {ingredients.filter(ing => !proposedRecipe.some(p => p.ingredient_id === ing.id)).map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name}</option>
                        ))}
                      </select>
                      <input 
                        type="number" 
                        placeholder="Qty" 
                        value={newRecipeItem.quantity} 
                        onChange={e => setNewRecipeItem({...newRecipeItem, quantity: e.target.value})}
                        style={{width: '70px'}}
                      />
                      <button type="button" className="btn btn-secondary btn-small" onClick={addIngredientToProposed}>Add</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group" style={{marginTop: '20px'}}>
                <label>Justification / Notes</label>
                <textarea
                  rows="3"
                  placeholder="Why is this change necessary?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  required
                ></textarea>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Submitting...' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h2>Your Request History</h2>
          </div>
          <div className="card-body">
            {loading ? (
              <p>Loading history...</p>
            ) : history.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr><th>Date</th><th>Type</th><th>Subject</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {history.map(req => (
                      <tr key={req.id}>
                        <td>{new Date(req.created_at).toLocaleDateString()}</td>
                        <td><strong>{req.type.replace('_', ' ')}</strong></td>
                        <td>
                          <div className="request-subject">{req.details.product_name || req.details.new_product?.name || 'General'}</div>
                          <div className="request-desc-small">{req.details.description}</div>
                        </td>
                        <td>
                          <span className={`status ${req.status === 'APPROVED' ? 'normal' : req.status === 'REJECTED' ? 'critical' : 'low'}`}>
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><p>No history found.</p></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestProduct;
