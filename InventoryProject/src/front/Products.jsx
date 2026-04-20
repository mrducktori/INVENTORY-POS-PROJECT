import React, { useState, useEffect } from 'react';
import { getAllProducts } from '../api/productsApi';
import { getRecipesByProduct } from '../api/recipesApi';
import '../styles/Inventory.css';
import '../styles/Products.css';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recipe, setRecipe] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAllProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProductClick = async (product) => {
    setSelectedProduct(product);
    try {
      const data = await getRecipesByProduct(product.id);
      setRecipe(data || []);
    } catch (err) {
      console.error('Failed to load recipe:', err);
    }
  };

  const categories = ['ALL', ...new Set(products.map(p => p.category))];
  const filteredProducts = products.filter(p => {
    const pCat = (p.category || "").toUpperCase();
    const fCat = filter.toUpperCase();
    const matchCat = filter === 'ALL' || pCat === fCat || (fCat === 'PASTRIES' && pCat === 'PASTRY') || (fCat === 'PASTRY' && pCat === 'PASTRIES');
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch && !p.is_archived;
  });

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Products</h1>
        <p>Browse all active products and their recipes.</p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Product Inventory</h2>
        </div>
        <div className="card-body">
          <div className="form-row products-search-row">
            <div className="form-group">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="form-group">
              <select value={filter} onChange={e => setFilter(e.target.value)}>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {loading ? (
            <p>Loading...</p>
          ) : filteredProducts.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id}>
                      <td><strong>{product.name}</strong></td>
                      <td>{product.category}</td>
                      <td>₱{product.price.toFixed(2)}</td>
                      <td>
                        <button className="btn btn-secondary btn-small" onClick={() => handleProductClick(product)}>
                          View Recipe
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <p>No products found</p>
            </div>
          )}
        </div>
      </div>

      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Recipe: {selectedProduct.name}</h2>
              <button className="modal-close" onClick={() => setSelectedProduct(null)}>✕</button>
            </div>
            <div className="modal-body">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ingredient</th>
                    <th>Quantity Used</th>
                    <th>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {recipe && recipe.length > 0 ? (
                    recipe.map(r => (
                      <tr key={r.id}>
                        <td>{r.ingredients?.name}</td>
                        <td>{r.quantity_used}</td>
                        <td>{r.ingredients?.unit}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="recipe-empty-row">No recipe details found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedProduct(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
