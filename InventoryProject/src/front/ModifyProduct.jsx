import React, { useState, useEffect } from 'react';
import { getAllProducts, updateProduct } from '../api/productsApi';
import { getRecipesByProduct, updateRecipe } from '../api/recipesApi';
import '../styles/Inventory.css';

const ModifyProduct = () => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Form states
  const [editPrice, setEditPrice] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAllProducts();
      setProducts((data || []).filter(p => !p.is_archived));
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

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
      await updateProduct(selectedProduct.id, {
        name: editName,
        category: editCategory,
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
      // update local state
      setRecipe(recipe.map(r => r.id === recipeId ? { ...r, quantity_used: parseFloat(newQty) } : r));
      setMessage('Recipe component updated!');
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Error updating recipe: ' + err.message);
    }
  };

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Modify Product</h1>
        <p>Update product details, pricing, and recipe components.</p>
      </div>

      <div className="card" style={{ maxWidth: '800px' }}>
        <div className="card-header">
          <h2>Select Product</h2>
        </div>
        <div className="card-body">
          <div className="form-group">
            <select onChange={handleSelectProduct} value={selectedProduct?.id || ''}>
              <option value="">-- Choose a Product to Modify --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} - ₱{p.price}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.includes('success') || message.includes('updated') ? 'alert-success' : 'alert-error'}`}>
          {message}
        </div>
      )}

      {selectedProduct && (
        <div className="form-row">
          <div className="card">
            <div className="card-header">
              <h2>Product Details</h2>
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
                  <input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Recipe Configuration</h2>
            </div>
            <div className="card-body">
              {recipe.length > 0 ? (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Qty Used</th>
                        <th>Unit</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.map(r => (
                        <tr key={r.id}>
                          <td>{r.ingredients?.name}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              className="form-group"
                              style={{ width: '80px', margin: 0, padding: '4px' }}
                              defaultValue={r.quantity_used}
                              onBlur={(e) => {
                                if (parseFloat(e.target.value) !== r.quantity_used) {
                                  handleUpdateRecipeQuantity(r.id, e.target.value);
                                }
                              }}
                            />
                          </td>
                          <td>{r.ingredients?.unit}</td>
                          <td>
                            <span className="status normal" style={{ fontSize: '10px' }}>Auto-save</span>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModifyProduct;
