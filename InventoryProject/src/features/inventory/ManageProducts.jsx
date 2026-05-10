import React, { useState } from 'react';
import { useManageProducts } from './hooks/useManageProducts';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { CATEGORIES, CATEGORIES_WITH_ALL } from '../../utils/constants';
import { getCurrentUser } from '../../utils/authUtils';
import CategorySettingsModal from './components/CategorySettingsModal';

import './ManageProducts.css';


const ManageProducts = () => {
  const user = getCurrentUser();
  const [showCategorySettings, setShowCategorySettings] = useState(false);

  const {
    viewMode, setViewMode,
    products, loading, message, setMessage,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    confirmConfig, setConfirmConfig,
    formData, handleInputChange,
    selectedProduct, setSelectedProduct,
    recipe, allIngredients,
    newSize, setNewSize,
    newAddOn, setNewAddOn,
    newRecipeItem, setNewRecipeItem,
    editPrice, setEditPrice,
    editName, setEditName,
    editCategory, setEditCategory,
    editTrackStock, setEditTrackStock,
    editStockQty,
    editThreshold, setEditThreshold,
    editSizes,
    editAddOns,
    handleAddSize, handleRemoveSize,
    handleAddAddOn, handleRemoveAddOn,
    handleReceiveProductStock,
    handleAddProduct,
    handleArchiveToggle,
    handleSetRecipe,
    handleUpdateProduct,
    handleDeleteRecipeItem,
    handleAddRecipeItem
  } = useManageProducts();

  if (user?.role === 'Staff') {
    return <div className="inventory-container"><h2>Access Denied</h2></div>;
  }

  const filteredProductsList = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? !p.is_archived : p.is_archived;
    const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  return (
    <div className="inventory-container">
      <div className="page-header manage-products-header">
        <div>
          <h1>Product Management</h1>
          <p>Create and manage products, categories, and ingredient recipes.</p>
        </div>
        <div className="header-actions">
          <button 
            className={`btn ${viewMode === 'ADD' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => { setViewMode('ADD'); setMessage(''); }}
          >
            Add Product
          </button>
          <button 
            className={`btn ${viewMode === 'MODIFY' ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => { setViewMode('MODIFY'); setMessage(''); }}
          >
            Modify Existing
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowCategorySettings(true)}
          >
            Category Defaults
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
              <h2>Add New Product</h2>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddProduct}>
                <div className="form-group">
                  <label>Product Name</label>
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <select name="category" value={formData.category} onChange={handleInputChange} required>
                      <option value="">Select Category</option>
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price</label>
                    <input type="number" step="0.01" min="0" name="price" value={formData.price} onChange={handleInputChange} required />
                  </div>
                </div>

                <div className="checkbox-group">
                  <label className="switch">
                    <input type="checkbox" name="track_stock" checked={formData.track_stock} onChange={handleInputChange} />
                    <span className="slider"></span>
                  </label>
                  <label>
                    Direct Stock Tracking
                    <small>Enable for resellable items like pastries, drinks, etc.</small>
                  </label>
                </div>

                {formData.track_stock && (
                  <div className="form-row">
                    <div className="form-group">
                      <label>Initial Stock Level</label>
                      <input type="number" value="0" disabled style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }} />
                    </div>
                    <div className="form-group">
                      <label>Low Stock Alert at</label>
                      <input type="number" name="low_stock_threshold" value={formData.low_stock_threshold} onChange={handleInputChange} min="0" required />
                    </div>
                  </div>
                )}
                <button type="submit" className="btn btn-primary">Add</button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header manage-products-header">
              <h2>Product List</h2>
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
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  {CATEGORIES_WITH_ALL.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
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
              ) : filteredProductsList.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                         <th>Product Name</th>
                         <th>Category</th>
                         <th>Price</th>
                         <th>Stock</th>
                         <th>Status</th>
                         <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProductsList.map(p => (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td>{p.category}</td>
                           <td>₱{parseFloat(p.price).toFixed(2)}</td>
                            <td>
                              {p.track_stock ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                  <span className={`stock-badge ${
                                    p.stock_quantity <= 0 ? 'out' : 
                                    p.stock_quantity <= p.low_stock_threshold ? 'critical' : 
                                    p.stock_quantity <= p.low_stock_threshold * 1.5 ? 'warning' : 'normal'
                                  }`}>
                                    {p.stock_quantity} in stock
                                  </span>
                                  <div className="receive-stock-mini">
                                    <input 
                                      type="number" 
                                      placeholder="+ Qty" 
                                      id={`receive-${p.id}`}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleReceiveProductStock(p.id, e.target.value);
                                          e.target.value = '';
                                        }
                                      }}
                                    />
                                    <button onClick={() => {
                                      const input = document.getElementById(`receive-${p.id}`);
                                      handleReceiveProductStock(p.id, input.value);
                                      input.value = '';
                                    }}>Receive</button>
                                  </div>
                                </div>
                              ) : (
                                <span className="stock-badge-none">Recipe based</span>
                              )}
                            </td>
                           <td>
                             <span className={`status ${p.is_archived ? 'critical' : 'normal'}`}>
                               {p.is_archived ? 'ARCHIVED' : 'ACTIVE'}
                             </span>
                           </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button
                                className="btn btn-small btn-secondary"
                                onClick={() => handleSetRecipe(p)}
                              >
                                Edit / Recipe
                              </button>
                              <button
                                className={`btn btn-small ${p.is_archived ? 'btn-success' : 'btn-danger'}`}
                                onClick={() => handleArchiveToggle(p.id, p.is_archived)}
                              >
                                {p.is_archived ? 'Restore' : 'Archive'}
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
                  <p>No products available</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {viewMode === 'MODIFY' && (
        <div className="card">
          <div className="card-header manage-products-header">
            <h2>Select Product to Modify</h2>
            <div className="table-filters-container">
              <input
                type="text"
                placeholder="Search products..."
                className="filter-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select
                className="filter-select"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                {CATEGORIES_WITH_ALL.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="card-body">
            {filteredProductsList.length > 0 ? (
              <div className="product-selection-grid">
                {filteredProductsList.filter(p => !p.is_archived).map(p => (
                  <div 
                    key={p.id} 
                    className="product-selection-card" 
                    onClick={() => handleSetRecipe(p)}
                  >
                    <div className="card-main">
                      <h3>{p.name}</h3>
                      <span className="category">{p.category}</span>
                    </div>
                    <div className="card-footer">
                      <span className="price">₱{parseFloat(p.price).toFixed(2)}</span>
                      <button className="btn-edit-tiny">Edit Details & Recipe</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No products found matching your search.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedProduct && viewMode === 'MODIFY' && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal animate-pop-in" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Modify Product: {selectedProduct.name}</h2>
              <button className="modal-close" onClick={() => setSelectedProduct(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpdateProduct}>
                <div className="form-group">
                  <label>Product Name</label>
                  <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select value={editCategory} onChange={e => setEditCategory(e.target.value)} required>
                    <option value="">Select Category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                 <div className="form-group">
                   <label>Price (₱)</label>
                   <input type="number" step="0.01" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)} required />
                 </div>

                 <div className="checkbox-group">
                   <label className="switch">
                     <input type="checkbox" checked={editTrackStock} onChange={e => setEditTrackStock(e.target.checked)} />
                     <span className="slider"></span>
                   </label>
                   <label>
                     Direct Stock Tracking
                     <small>Deducts directly from product stock instead of ingredients</small>
                   </label>
                 </div>

                 {editTrackStock && (
                   <div className="form-row">
                     <div className="form-group">
                       <label>Current Stock <span style={{ fontSize: '10px', color: '#888' }}>(read-only)</span></label>
                       <input 
                         type="number" 
                         value={editStockQty} 
                         readOnly 
                         style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                       />
                       <small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
                         Update via <strong>Update Stock</strong> module.
                       </small>
                     </div>
                     <div className="form-group">
                       <label>Low Stock Alert at</label>
                       <input type="number" value={editThreshold} onChange={e => setEditThreshold(e.target.value)} min="0" required />
                     </div>
                   </div>
                 )}
                 <button type="submit" className="btn btn-primary">Save Changes</button>
               </form>

              <div className="sizes-addons-section" style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px', display: 'flex', gap: '20px' }}>
                {/* SIZES CONFIGURATION */}
                <div style={{ flex: 1 }}>
                  <h3 className="recipe-title" style={{ fontSize: '16px', marginBottom: '10px' }}>Sizes Configuration</h3>
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
                    <p style={{ fontSize: '12px', color: '#999', marginBottom: '15px' }}>No sizes configured.</p>
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
                    <button type="button" className="btn btn-secondary btn-small" onClick={handleAddSize}>Add Size</button>
                  </div>
                </div>

                {/* ADD-ONS CONFIGURATION */}
                <div style={{ flex: 1 }}>
                  <h3 className="recipe-title" style={{ fontSize: '16px', marginBottom: '10px' }}>Add-ons Configuration</h3>
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
                    <p style={{ fontSize: '12px', color: '#999', marginBottom: '15px' }}>No add-ons configured.</p>
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
                        <span style={{ padding: '8px', background: '#eee', borderRadius: '4px', fontSize: '12px' }}>{newAddOn.unit}</span>
                      </div>
                    )}
                    <button type="button" className="btn btn-secondary btn-small" onClick={handleAddAddOn}>Add Add-on</button>
                  </div>
                </div>
              </div>

              <div className="recipe-section" style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                <h3 className="recipe-title">Recipe Configuration</h3>
                
                {recipe.length > 0 ? (
                  <div className="recipe-table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Qty Needed</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipe.map(r => {
                          const unitToUse = r.recipe_unit || r.ingredients?.unit;
                          const formattedQty = `${r.quantity_used} ${unitToUse}`;
                          return (
                            <tr key={r.id}>
                              <td>{r.ingredients?.name || r.ingredient_name}</td>
                              <td>{formattedQty}</td>
                              <td>
                                <button
                                  className="delete-recipe-btn"
                                  onClick={() => handleDeleteRecipeItem(r.id)}
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>No recipe configured for this product.</p>
                  </div>
                )}

                <div className="recipe-section" style={{ marginTop: '20px' }}>
                  <h3 className="recipe-title">Add Ingredient</h3>
                  <form onSubmit={handleAddRecipeItem} className="recipe-form">
                    <div className="form-group recipe-form-group">
                      <label>Select Ingredient</label>
                      <select 
                        value={newRecipeItem.ingredient_id} 
                        onChange={e => {
                          const id = e.target.value;
                          const ing = allIngredients.find(i => i.id === id);
                          setNewRecipeItem({ 
                            ...newRecipeItem, 
                            ingredient_id: id,
                            input_unit: (ing?.unit || '').toUpperCase()
                          });
                        }}
                        required
                      >
                        <option value="">-- Choose Ingredient --</option>
                        {allIngredients
                          .filter(ing => !recipe.some(r => r.ingredient_id === ing.id))
                          .map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                          ))
                        }
                      </select>
                    </div>
                    <div className="form-group recipe-form-group small">
                      <label>Quantity</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          placeholder="Qty" 
                          value={newRecipeItem.quantity}
                          onChange={e => setNewRecipeItem({ ...newRecipeItem, quantity: e.target.value })}
                          required 
                          style={{ flex: 1 }}
                        />
                        {(() => {
                          const selectedIng = allIngredients.find(i => i.id === newRecipeItem.ingredient_id);
                          const baseUnit = (selectedIng?.unit || '').toUpperCase();
                          
                          if (baseUnit === 'L') {
                            return (
                              <select 
                                value={newRecipeItem.input_unit || 'L'} 
                                onChange={e => setNewRecipeItem({ ...newRecipeItem, input_unit: e.target.value })}
                                style={{ width: '80px' }}
                              >
                                <option value="L">L</option>
                                <option value="ML">ML</option>
                              </select>
                            );
                          } else if (baseUnit === 'KG') {
                            return (
                              <select 
                                value={newRecipeItem.input_unit || 'KG'} 
                                onChange={e => setNewRecipeItem({ ...newRecipeItem, input_unit: e.target.value })}
                                style={{ width: '80px' }}
                              >
                                <option value="KG">KG</option>
                                <option value="G">G</option>
                              </select>
                            );
                          } else if (baseUnit) {
                            return <span style={{ padding: '10px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '4px' }}>{baseUnit}</span>;
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary">Add</button>
                  </form>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedProduct(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showCategorySettings && (
        <CategorySettingsModal 
          allIngredients={allIngredients} 
          onClose={() => setShowCategorySettings(false)} 
        />
      )}

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ManageProducts;
