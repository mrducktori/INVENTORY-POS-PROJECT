import React, { useState, useEffect } from 'react';
import { CATEGORIES } from '../../../utils/constants';
import { getCategorySettings, updateCategorySettings } from '../../../api/categorySettingsApi';

const CategorySettingsModal = ({ onClose, allIngredients }) => {
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [settings, setSettings] = useState({}); // { 'MILK TEA': { sizes: [], add_ons: [] } }
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form State for current category
  const [editSizes, setEditSizes] = useState([]);
  const [editAddOns, setEditAddOns] = useState([]);
  
  const [newSize, setNewSize] = useState({ name: '', price_add: '', ingredient_id: '' });
  const [newAddOn, setNewAddOn] = useState({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings[selectedCategory]) {
      setEditSizes(settings[selectedCategory].sizes || []);
      setEditAddOns(settings[selectedCategory].add_ons || []);
    } else {
      setEditSizes([]);
      setEditAddOns([]);
    }
  }, [selectedCategory, settings]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getCategorySettings();
      const settingsMap = {};
      data.forEach(item => {
        settingsMap[item.category] = { sizes: item.sizes, add_ons: item.add_ons };
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateCategorySettings(selectedCategory, { sizes: editSizes, add_ons: editAddOns });
      setMessage('Category settings saved!');
      setTimeout(() => setMessage(''), 3000);
      fetchSettings(); // refresh
    } catch (err) {
      if (err.message.includes('already exists')) {
        alert('WARNING: ' + err.message);
      }
      setMessage('Error saving: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSize = () => {
    if (!newSize.name) return;
    setEditSizes(prev => [...prev, { ...newSize, price_add: parseFloat(newSize.price_add) || 0 }]);
    setNewSize({ name: '', price_add: '', ingredient_id: '' });
  };

  const handleRemoveSize = (index) => {
    setEditSizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAddOn = () => {
    if (!newAddOn.name) return;
    setEditAddOns(prev => [...prev, { 
      ...newAddOn, 
      price: parseFloat(newAddOn.price) || 0,
      quantity: parseFloat(newAddOn.quantity) || 0
    }]);
    setNewAddOn({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });
  };

  const handleRemoveAddOn = (index) => {
    setEditAddOns(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-pop-in" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Global Category Settings</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {message && <div className="alert-info" style={{ marginBottom: '15px' }}>{message}</div>}
          
          <div className="form-group">
            <label>Select Category to Configure</label>
            <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={{ padding: '10px', fontSize: '16px' }}>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px' }}>
            Any sizes or add-ons defined here will automatically apply to ALL products inside the <strong>{selectedCategory}</strong> category.
          </p>

          <div className="sizes-addons-section" style={{ display: 'flex', gap: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '8px' }}>
            {/* SIZES CONFIGURATION */}
            <div style={{ flex: 1 }}>
              <h3 className="recipe-title" style={{ fontSize: '15px', marginBottom: '10px' }}>Default Sizes</h3>
              {editSizes.length > 0 ? (
                <table className="table" style={{ marginBottom: '15px', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Size Name</th>
                      <th>Price Add (₱)</th>
                      <th>Cup Mat.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editSizes.map((sz, i) => (
                      <tr key={i}>
                        <td>{sz.name}</td>
                        <td>+{sz.price_add}</td>
                        <td>{allIngredients.find(ing => ing.id === sz.ingredient_id)?.name || '-'}</td>
                        <td><button type="button" className="delete-recipe-btn" onClick={() => handleRemoveSize(i)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: '12px', color: '#999', marginBottom: '15px' }}>No default sizes.</p>
              )}
              
              <div className="form-group recipe-form-group small">
                <input type="text" placeholder="Size Name (e.g., 16 oz)" value={newSize.name} onChange={e => setNewSize({...newSize, name: e.target.value})} style={{ marginBottom: '5px' }} />
                <input type="number" placeholder="Price Increase (₱)" value={newSize.price_add} onChange={e => setNewSize({...newSize, price_add: e.target.value})} min="0" style={{ marginBottom: '5px' }} />
                <select value={newSize.ingredient_id} onChange={e => setNewSize({...newSize, ingredient_id: e.target.value})} style={{ marginBottom: '5px' }}>
                  <option value="">- No Cup Material -</option>
                  {allIngredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-secondary btn-small" onClick={handleAddSize}>Add Default Size</button>
              </div>
            </div>

            {/* ADD-ONS CONFIGURATION */}
            <div style={{ flex: 1 }}>
              <h3 className="recipe-title" style={{ fontSize: '15px', marginBottom: '10px' }}>Default Add-ons</h3>
              {editAddOns.length > 0 ? (
                <table className="table" style={{ marginBottom: '15px', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th>Add-on</th>
                      <th>Price (₱)</th>
                      <th>Mat. Used</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {editAddOns.map((ao, i) => (
                      <tr key={i}>
                        <td>{ao.name}</td>
                        <td>+{ao.price}</td>
                        <td>{ao.quantity}{ao.unit} {allIngredients.find(ing => ing.id === ao.ingredient_id)?.name || '-'}</td>
                        <td><button type="button" className="delete-recipe-btn" onClick={() => handleRemoveAddOn(i)}>✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ fontSize: '12px', color: '#999', marginBottom: '15px' }}>No default add-ons.</p>
              )}

              <div className="form-group recipe-form-group small">
                <input type="text" placeholder="Add-on Name (e.g., Pearl)" value={newAddOn.name} onChange={e => setNewAddOn({...newAddOn, name: e.target.value})} style={{ marginBottom: '5px' }} />
                <input type="number" placeholder="Price (₱)" value={newAddOn.price} onChange={e => setNewAddOn({...newAddOn, price: e.target.value})} min="0" style={{ marginBottom: '5px' }} />
                <select value={newAddOn.ingredient_id} onChange={e => {
                    const id = e.target.value;
                    const ing = allIngredients.find(i => i.id === id);
                    setNewAddOn({...newAddOn, ingredient_id: id, unit: (ing?.unit || '').toUpperCase()});
                  }} style={{ marginBottom: '5px' }}>
                  <option value="">- No Material -</option>
                  {allIngredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                  ))}
                </select>
                {newAddOn.ingredient_id && (
                  <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                    <input type="number" placeholder="Qty Used" value={newAddOn.quantity} onChange={e => setNewAddOn({...newAddOn, quantity: e.target.value})} min="0" />
                    <span style={{ padding: '8px', background: '#ddd', borderRadius: '4px', fontSize: '12px' }}>{newAddOn.unit}</span>
                  </div>
                )}
                <button type="button" className="btn btn-secondary btn-small" onClick={handleAddAddOn}>Add Default Add-on</button>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '20px', textAlign: 'right' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Settings for ' + selectedCategory}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategorySettingsModal;
