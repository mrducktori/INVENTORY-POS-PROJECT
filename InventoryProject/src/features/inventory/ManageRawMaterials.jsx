import React from 'react';
import { useManageRawMaterials } from './hooks/useManageRawMaterials';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { formatQuantity } from '../../utils/productUtils';

import './ManageProducts.css';
import './ManageRawMaterials.css';

const ManageRawMaterials = () => {
  const {
    viewMode, setViewMode,
    ingredients, loading, message, setMessage,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    confirmConfig, setConfirmConfig,
    formData, handleInputChange,
    selectedIngredient, setSelectedIngredient,
    editName, setEditName,
    editUnit, setEditUnit,
    editAlert, setEditAlert,
    editQuantity, setEditQuantity,
    UNIT_CHOICES,
    handleAddIngredient,
    handleArchiveToggle,
    handleUpdateIngredient,
    handleSetModify
  } = useManageRawMaterials();

  const filteredList = ingredients.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? !i.is_archived : i.is_archived;
    return matchSearch && matchStatus;
  });

  return (
    <div className="inventory-container">

      {/* ---- Page Header ---- */}
      <div className="page-header manage-products-header">
        <div>
          <h1>Manage Raw Materials</h1>
          <p>Add ingredients, update stock levels, and configure low-stock alerts.</p>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${viewMode === 'ADD' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setViewMode('ADD'); setMessage(''); }}
          >
            Add Material
          </button>
          <button
            className={`btn ${viewMode === 'MODIFY' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setViewMode('MODIFY'); setMessage(''); }}
          >
            Modify Existing
          </button>
        </div>
      </div>

      {/* ---- Alert Banner ---- */}
      {message && (
        <div className={`alert ${message.includes('success') || message.includes('updated') ? 'alert-success' : 'alert-error'}`}>
          {message}
        </div>
      )}

      {/* ---- ADD VIEW ---- */}
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
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. COFFEE BEANS"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Unit</label>
                    <input
                      type="text"
                      name="unit"
                      list="unit-choices"
                      value={formData.unit}
                      onChange={handleInputChange}
                      placeholder="e.g. KG, ML, PCS"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Initial Stock Quantity</label>
                    <input
                      type="number"
                      value="0"
                      disabled
                      style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>Low Stock Alert Level</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      name="low_stock_alert"
                      value={formData.low_stock_alert}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Add</button>
              </form>
            </div>
          </div>

          {/* List below form */}
          <div className="card">
            <div className="card-header manage-products-header">
              <h2>Materials List</h2>
              <div className="table-filters-container">
                <input
                  type="text"
                  placeholder="Search materials..."
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
              ) : filteredList.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Material Name</th>
                        <th>Current Stock</th>
                        <th>Alert Level</th>
                        <th>Stock Status</th>
                        <th>State</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredList.map(i => (
                        <tr key={i.id}>
                          <td><strong>{i.name}</strong></td>
                          <td>{formatQuantity(i.stock_quantity, i.unit)}</td>
                          <td>{formatQuantity(i.low_stock_alert, i.unit)}</td>
                          <td>
                            <span className={`stock-badge ${
                              i.stock_quantity <= 0 ? 'out' :
                              i.stock_quantity <= i.low_stock_alert ? 'critical' :
                              i.stock_quantity <= i.low_stock_alert * 1.5 ? 'warning' : 'normal'
                            }`}>
                              {i.stock_quantity <= 0 ? 'OUT' :
                               i.stock_quantity <= i.low_stock_alert ? 'CRITICAL' :
                               i.stock_quantity <= i.low_stock_alert * 1.5 ? 'WARNING' : 'HEALTHY'}
                            </span>
                          </td>
                          <td>
                            <span className={`status ${i.is_archived ? 'critical' : 'normal'}`}>
                              {i.is_archived ? 'ARCHIVED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button
                                className="btn btn-small btn-secondary"
                                onClick={() => handleSetModify(i)}
                              >
                                Edit
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
                  <p>No materials found.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---- MODIFY VIEW (card grid, same as ManageProducts) ---- */}
      {viewMode === 'MODIFY' && (
        <div className="card">
          <div className="card-header manage-products-header">
            <h2>Select Material to Modify</h2>
            <div className="table-filters-container">
              <input
                type="text"
                placeholder="Search materials..."
                className="filter-input"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="card-body">
            {loading ? (
              <p>Loading...</p>
            ) : filteredList.filter(i => !i.is_archived).length > 0 ? (
              <div className="product-selection-grid">
                {filteredList.filter(i => !i.is_archived).map(i => (
                  <div
                    key={i.id}
                    className="product-selection-card"
                    onClick={() => handleSetModify(i)}
                  >
                    <div className="card-main">
                      <h3>{i.name}</h3>
                      <span className={`stock-badge ${
                        i.stock_quantity <= 0 ? 'out' :
                        i.stock_quantity <= i.low_stock_alert ? 'critical' :
                        i.stock_quantity <= i.low_stock_alert * 1.5 ? 'warning' : 'normal'
                      }`} style={{ fontSize: '10px', padding: '2px 7px' }}>
                        {i.stock_quantity <= 0 ? 'OUT' :
                         i.stock_quantity <= i.low_stock_alert ? 'CRITICAL' :
                         i.stock_quantity <= i.low_stock_alert * 1.5 ? 'WARNING' : 'HEALTHY'}
                      </span>
                    </div>
                    <div className="card-footer">
                      <span style={{ fontWeight: 700, fontSize: '14px', color: '#000' }}>
                        {formatQuantity(i.stock_quantity, i.unit)}
                      </span>
                      <button className="btn-edit-tiny">Edit Details</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No active materials found.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Edit Modal ---- */}
      {selectedIngredient && (
        <div className="modal-overlay" onClick={() => setSelectedIngredient(null)}>
          <div className="modal animate-pop-in" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit: {selectedIngredient.name}</h2>
              <button className="modal-close" onClick={() => setSelectedIngredient(null)}>✕</button>
            </div>
            <div className="modal-body">
              <form id="edit-material-form" onSubmit={handleUpdateIngredient}>
                <div className="form-group">
                  <label>Ingredient Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Base Unit</label>
                  <input
                    type="text"
                    list="unit-choices"
                    value={editUnit}
                    onChange={e => setEditUnit(e.target.value)}
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Current Stock
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#888', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        (read-only)
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editQuantity}
                      readOnly
                      style={{ background: '#f5f5f5', color: '#888', cursor: 'not-allowed', borderColor: '#ddd' }}
                    />
                    <p style={{ fontSize: 11, color: '#999', marginTop: 4, fontStyle: 'italic' }}>
                      To update stock, use the <strong>Update Stock</strong> module in Inventory Control.
                    </p>
                  </div>
                  <div className="form-group">
                    <label>Low Alert Level</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editAlert}
                      onChange={e => setEditAlert(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedIngredient(null)}>Cancel</button>
              <button type="submit" form="edit-material-form" className="btn btn-primary">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <datalist id="unit-choices">
        {UNIT_CHOICES.map(u => <option key={u} value={u} />)}
      </datalist>
    </div>
  );
};

export default ManageRawMaterials;
