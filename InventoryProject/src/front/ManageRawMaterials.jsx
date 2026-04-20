import React, { useState, useEffect } from 'react';
import { getIngredients, createIngredient, updateIngredient, archiveIngredient, restoreIngredient } from '../api/inventoryApi';
import '../styles/Inventory.css';
import '../styles/ManageRawMaterials.css';


const ManageRawMaterials = () => {
  const [viewMode, setViewMode] = useState('ADD'); // 'ADD' | 'MODIFY'

  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'ARCHIVED'

  
  const UNIT_CHOICES = ['KG', 'G', 'L', 'ML', 'PCS', 'PACK', 'BOTTLE', 'CAN'];



  // --- ADD State ---
  const [formData, setFormData] = useState({ name: '', unit: '', low_stock_alert: '', stock_quantity: '0' });


  // --- MODIFY State ---
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editAlert, setEditAlert] = useState('');

  useEffect(() => {
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const data = await getIngredients();
      setIngredients(data || []);

      // If an ingredient is currently selected, refresh it
      if (selectedIngredient) {
        const ing = (data || []).find(i => i.id === selectedIngredient.id);
        if (ing) {
          setSelectedIngredient(ing);
          setEditName(ing.name);
          setEditUnit(ing.unit);
          setEditAlert(ing.low_stock_alert);
        }
      }
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- ADD METHODS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddIngredient = async (e) => {
    e.preventDefault();
    try {
      await createIngredient({
        name: formData.name.trim().toUpperCase(),
        unit: formData.unit.trim().toUpperCase(),
        low_stock_alert: parseFloat(formData.low_stock_alert) || 0,
        stock_quantity: parseFloat(formData.stock_quantity) || 0
      });
      setMessage('Ingredient created successfully!');
      setFormData({ name: '', unit: '', low_stock_alert: '', stock_quantity: '0' });
      fetchIngredients();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const handleArchiveToggle = async (id, isArchived) => {
    try {
      if (isArchived) {
        await restoreIngredient(id);
      } else {
        await archiveIngredient(id);
      }
      fetchIngredients();
    } catch (err) {
      console.error('Archiving error:', err);
      alert('Error updating ingredient status');
    }
  };

  // --- MODIFY METHODS ---
  const handleSelectIngredient = (e) => {
    const ingredientId = e.target.value;
    if (!ingredientId) {
      setSelectedIngredient(null);
      return;
    }

    const ing = ingredients.find(i => i.id === ingredientId);
    setSelectedIngredient(ing);
    setEditName(ing.name);
    setEditUnit(ing.unit);
    setEditAlert(ing.low_stock_alert);
  };

  const handleUpdateIngredient = async (e) => {
    e.preventDefault();
    if (!selectedIngredient) return;

    try {
      await updateIngredient(selectedIngredient.id, {
        name: editName.trim().toUpperCase(),
        unit: editUnit.trim().toUpperCase(),
        low_stock_alert: parseFloat(editAlert) || 0
      });
      setMessage('Ingredient details updated successfully!');
      fetchIngredients();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error updating ingredient: ' + err.message);
    }
  };
  const handleSetModify = (ingredient) => {
    setViewMode('MODIFY');
    setSelectedIngredient(ingredient);
    setEditName(ingredient.name);
    setEditUnit(ingredient.unit);
    setEditAlert(ingredient.low_stock_alert);
  };


  const filteredIngredientsList = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? !i.is_archived : i.is_archived;
    return matchSearch && matchStatus;
  });


  return (
    <div className="inventory-container">
      <div className="page-header manage-header">
        <div>
          <h1>Manage Raw Materials</h1>
          <p>Add new ingredients, modify units, and configure low stock alert levels.</p>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${viewMode === 'ADD' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setViewMode('ADD'); setMessage(''); }}
          >
            Add Ingredient
          </button>
          <button
            className={`btn ${viewMode === 'MODIFY' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setViewMode('MODIFY'); setMessage(''); }}
          >
            Modify Existing
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.includes('success') || message.includes('updated') ? 'alert-success' : 'alert-error'}`}>
          {message}
        </div>
      )}

      {viewMode === 'ADD' && (
        <>
          <div className="card manage-form-card">
            <div className="card-header">
              <h2>Add New Raw Material</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddIngredient}>
                <div className="form-group">
                  <label>Ingredient Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Unit (Suggestions: KG, G, L, ML, PCS...)</label>
                  <input 
                    type="text" 
                    name="unit" 
                    list="unit-choices"
                    value={formData.unit} 
                    onChange={handleInputChange} 
                    placeholder="e.g. KG or PCS"
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Low Stock Alert Level</label>
                  <input type="number" step="0.01" min="0" name="low_stock_alert" value={formData.low_stock_alert} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Initial Stock Quantity</label>
                  <input type="number" step="0.01" min="0" name="stock_quantity" value={formData.stock_quantity} onChange={handleInputChange} required />
                </div>
                <button type="submit" className="btn btn-primary">Add Ingredient</button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header manage-header">
              <h2>Ingredient List</h2>
              <div className="table-filters-container">
                <input
                  type="text"
                  placeholder="Search name..."
                  className="filter-input"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >

                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="ARCHIVED">Archived Only</option>
                </select>
              </div>
            </div>
            <div className="card-body">
              {loading ? (
                <p>Loading...</p>
              ) : filteredIngredientsList.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Ingredient Name</th>
                        <th>Unit</th>
                        <th>Alert Level</th>
                        <th>Stock Status</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIngredientsList.map(i => (
                        <tr key={i.id}>
                          <td><strong>{i.name}</strong></td>
                          <td>{i.unit}</td>
                          <td>{i.low_stock_alert}</td>
                          <td>
                            <span className={`status ${i.stock_quantity <= i.low_stock_alert ? 'critical' : 'normal'}`}>
                              {i.stock_quantity <= i.low_stock_alert ? 'LOW' : 'NORMAL'}
                            </span>
                          </td>
                          <td>
                            <span className={`status ${i.is_archived ? 'critical' : 'normal'}`}>
                              {i.is_archived ? 'ARCHIVED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons-group">

                              <button
                                className="btn btn-small btn-secondary"
                                onClick={() => handleSetModify(i)}
                              >
                                Edit Details
                              </button>
                              <button
                                className={`btn btn-small ${i.is_archived ? 'btn-success' : 'btn-danger'}`}
                                onClick={() => handleArchiveToggle(i.id, i.is_archived)}
                              >
                                {i.is_archived ? 'Restore' : 'Archive'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No ingredients available</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {viewMode === 'MODIFY' && (
        <>
          <div className="card">
            <div className="card-header">
              <h2>Select Ingredient</h2>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Find Ingredient</label>
                <select onChange={handleSelectIngredient} value={selectedIngredient?.id || ''}>
                  <option value="">-- Choose an Ingredient to Modify --</option>
                  {ingredients.filter(i => !i.is_archived).map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedIngredient && (
            <div className="card modify-card">
              <div className="card-header">

                <h2>Ingredient Details</h2>
              </div>
              <div className="card-body">
                <form onSubmit={handleUpdateIngredient}>
                  <div className="form-group">
                    <label>Ingredient Name</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Unit</label>
                    <input 
                      type="text" 
                      list="unit-choices"
                      value={editUnit} 
                      onChange={e => setEditUnit(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>Low Stock Alert Level</label>
                    <input type="number" step="0.01" min="0" value={editAlert} onChange={e => setEditAlert(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
      <datalist id="unit-choices">
        {UNIT_CHOICES.map(u => <option key={u} value={u} />)}
      </datalist>
    </div>
  );
};

export default ManageRawMaterials;
