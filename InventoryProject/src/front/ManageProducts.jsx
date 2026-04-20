import React, { useState, useEffect } from 'react';
import { getAllProducts, createProduct, updateProduct, archiveProduct, restoreProduct } from '../api/productsApi';
import { getRecipesByProduct, updateRecipe, createRecipe, deleteRecipe } from '../api/recipesApi';
import { getIngredients } from '../api/inventoryApi';
import '../styles/Inventory.css';
import '../styles/ManageProducts.css';

const ManageProducts = () => {
  const [viewMode, setViewMode] = useState('ADD'); // 'ADD' | 'MODIFY'

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'ARCHIVED'
  const [categoryFilter, setCategoryFilter] = useState('ALL');


  // --- ADD State ---
  const [formData, setFormData] = useState({ name: '', category: '', price: '' });

  // --- MODIFY State ---
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ ingredient_id: '', quantity: '' });
  const [editPrice, setEditPrice] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      const data = await getIngredients();
      setAllIngredients(data || []);
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAllProducts();
      setProducts(data || []);

      // If a product is currently selected, refresh it
      if (selectedProduct) {
        const prod = (data || []).find(p => p.id === selectedProduct.id);
        if (prod) {
          setSelectedProduct(prod);
          setEditPrice(prod.price);
          setEditName(prod.name);
          setEditCategory(prod.category);
        }
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  // --- ADD METHODS ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      let normalizedCategory = formData.category.trim().toUpperCase();
      if (normalizedCategory === 'PASTRY') normalizedCategory = 'PASTRIES';

      await createProduct({
        name: formData.name.trim().toUpperCase(),
        category: normalizedCategory,
        price: parseFloat(formData.price)
      });
      setMessage('Product created successfully!');
      setFormData({ name: '', category: '', price: '' });
      fetchProducts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const handleArchiveToggle = async (id, isArchived) => {
    try {
      if (isArchived) {
        await restoreProduct(id);
      } else {
        await archiveProduct(id);
      }
      fetchProducts();
    } catch (err) {
      console.error('Archiving error:', err);
      alert('Error updating product status');
    }
  };

  // --- MODIFY METHODS ---
  const handleSelectProduct = async (e) => {
    const productId = e.target.value;
    if (!productId) {
      setSelectedProduct(null);
      setRecipe([]);
      return;
    }

    const prod = products.find(p => p.id === productId);
    setSelectedProduct(prod);
    setEditPrice(prod.price);
    setEditName(prod.name);
    setEditCategory(prod.category);

    try {
      const data = await getRecipesByProduct(productId);
      setRecipe(data || []);
    } catch (err) {
      console.error('Failed to load recipe:', err);
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      let normalizedCategory = editCategory.trim().toUpperCase();
      if (normalizedCategory === 'PASTRY') normalizedCategory = 'PASTRIES';

      await updateProduct(selectedProduct.id, {
        name: editName.trim().toUpperCase(),
        category: normalizedCategory,
        price: parseFloat(editPrice)
      });
      setMessage('Product details updated successfully!');
      fetchProducts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error updating product: ' + err.message);
    }
  };

  const handleUpdateRecipeQuantity = async (recipeId, newQty) => {
    try {
      await updateRecipe(recipeId, { quantity_used: parseFloat(newQty) });
      setRecipe(recipe.map(r => r.id === recipeId ? { ...r, quantity_used: parseFloat(newQty) } : r));
      setMessage('Recipe component updated!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Error updating recipe: ' + err.message);
    }
  };

  const handleAddRecipeItem = async (e) => {
    e.preventDefault();
    if (!selectedProduct || !newRecipeItem.ingredient_id || !newRecipeItem.quantity) return;

    try {
      await createRecipe({
        product_id: selectedProduct.id,
        ingredient_id: newRecipeItem.ingredient_id,
        quantity_used: parseFloat(newRecipeItem.quantity)
      });
      setMessage('Ingredient added to recipe!');
      setNewRecipeItem({ ingredient_id: '', quantity: '' });

      // Refresh recipe
      const data = await getRecipesByProduct(selectedProduct.id);
      setRecipe(data || []);

      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Error adding ingredient: ' + err.message);
    }
  };

  const handleDeleteRecipeItem = async (recipeId) => {
    if (!window.confirm('Remove this ingredient from the recipe?')) return;
    try {
      await deleteRecipe(recipeId);
      setRecipe(recipe.filter(r => r.id !== recipeId));
      setMessage('Ingredient removed from recipe');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Error removing ingredient: ' + err.message);
    }
  };

  const handleSetRecipe = async (product) => {
    setViewMode('MODIFY');
    setSelectedProduct(product);
    setEditPrice(product.price);
    setEditName(product.name);
    setEditCategory(product.category);
    try {
      const data = await getRecipesByProduct(product.id);
      setRecipe(data || []);
    } catch (err) {
      console.error('Failed to load recipe:', err);
    }
  };


  const categories = ['ALL', ...new Set(products.map(p => p.category))];
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
                    <input type="text" name="category" value={formData.category} onChange={handleInputChange} required />
                  </div>
                  <div className="form-group">
                    <label>Price</label>
                    <input type="number" step="0.01" min="0" name="price" value={formData.price} onChange={handleInputChange} required />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Add Product</button>
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

                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
                            <span className={`status ${p.is_archived ? 'critical' : 'normal'}`}>
                              {p.is_archived ? 'ARCHIVED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button
                                className="btn btn-small btn-secondary"
                                onClick={() => handleSetRecipe(p)}
                                title="Configure Recipe & Details"
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
        <>
          <div className="card">
            <div className="card-header">
              <h2>Select Product</h2>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label>Find Product</label>
                <select onChange={handleSelectProduct} value={selectedProduct?.id || ''}>
                  <option value="">-- Choose a Product to Modify --</option>
                  {products.filter(p => !p.is_archived).map(p => (
                    <option key={p.id} value={p.id}>{p.name} - ₱{p.price}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {selectedProduct && (
            <div className="card product-modify-card">
              <div className="card-header">
                <h2>Modify Product: {selectedProduct.name}</h2>
              </div>
              <div className="card-body">
                <form onSubmit={handleUpdateProduct}>
                  <div className="form-group">
                    <label>Product Name</label>
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input type="text" value={editCategory} onChange={e => setEditCategory(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Price (₱)</label>
                    <input type="number" step="0.01" min="0" value={editPrice} onChange={e => setEditPrice(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </form>

                <div className="recipe-section">
                  <h3 className="recipe-title">Recipe Configuration</h3>
                  
                  {recipe.length > 0 ? (
                    <div className="recipe-table-container">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Ingredient</th>
                            <th>Qty Needed</th>
                            <th>Unit</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recipe.map(r => (
                            <tr key={r.id}>
                              <td>{r.ingredient_name}</td>
                              <td>{r.quantity_used}</td>
                              <td>{r.unit}</td>
                              <td>
                                <button
                                  className="delete-recipe-btn"
                                  onClick={() => handleDeleteRecipeItem(r.id)}
                                  title="Remove ingredient"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      <p>No recipe configured for this product.</p>
                    </div>
                  )}

                  <div className="recipe-section">
                    <h3 className="recipe-title">Add Ingredient</h3>
                    <form onSubmit={handleAddRecipeItem} className="recipe-form">
                      <div className="form-group recipe-form-group">
                        <label>Select Ingredient</label>
                        <select 
                          value={newRecipeItem.ingredient_id} 
                          onChange={e => setNewRecipeItem({ ...newRecipeItem, ingredient_id: e.target.value })}
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
                        <input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          placeholder="Qty" 
                          value={newRecipeItem.quantity}
                          onChange={e => setNewRecipeItem({ ...newRecipeItem, quantity: e.target.value })}
                          required 
                        />
                      </div>
                      <button type="submit" className="btn btn-primary">Add</button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ManageProducts;
