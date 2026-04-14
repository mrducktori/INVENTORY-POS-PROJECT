import React, { useState, useEffect } from 'react';
import { getAllProducts, createProduct, archiveProduct, restoreProduct } from '../api/productsApi';
import '../styles/Inventory.css';

const ManageProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', category: '', price: '' });
  const [message, setMessage] = useState('');

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await createProduct({
        name: formData.name,
        category: formData.category,
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

  return (
    <div className="inventory-container">
      <div className="page-header">
        <h1>Manage Products</h1>
        <p>Add new products or archive existing ones.</p>
      </div>

      <div className="card" style={{ maxWidth: '600px', marginBottom: '30px' }}>
        <div className="card-header">
          <h2>Add New Product</h2>
        </div>
        <div className="card-body">
          {message && (
            <div className={`alert ${message.includes('success') ? 'alert-success' : 'alert-error'}`}>
              {message}
            </div>
          )}
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
                <input type="number" step="0.01" name="price" value={formData.price} onChange={handleInputChange} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Add Product</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Product List</h2>
        </div>
        <div className="card-body">
          {loading ? (
            <p>Loading...</p>
          ) : products.length > 0 ? (
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
                  {products.map(p => (
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
                        <button
                          className={`btn btn-small ${p.is_archived ? 'btn-success' : 'btn-danger'}`}
                          onClick={() => handleArchiveToggle(p.id, p.is_archived)}
                        >
                          {p.is_archived ? 'Restore' : 'Archive'}
                        </button>
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
    </div>
  );
};

export default ManageProducts;
