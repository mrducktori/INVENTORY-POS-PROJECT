import React, { useEffect, useState } from "react";
import { getProducts, createSale } from "../api/posApi";
import "../styles/POS.css";

const POS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);

  const user = getCurrentUser();

  // ACCESS CONTROL
  if (!isAuthorized(user)) {
    return <div className="error-box">Access Denied</div>;
  }

  // FETCH PRODUCTS
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  // CART LOGIC
  const addToCart = (product) => {
    setCart(prevCart => {
      const existing = prevCart.find(item => item.id === product.id);

      if (existing) {
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }

      return [...prevCart, { ...product, qty: 1 }];
    });
  };

  const updateQty = (productId, qty) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item =>
      item.id === productId ? { ...item, qty } : item
    ));
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const clearCart = () => setCart([]);

  const calculateTotal = () =>
    cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // COMPLETE SALE
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;

    try {
      await createSale({
        cart,
        total: calculateTotal(),
        staff_id: user.id
      });

      setSaleComplete(true);
      clearCart();
      setTimeout(() => setSaleComplete(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Error completing sale: " + err.message);
    }
  };

  // FILTER
  const filteredProducts = filterProducts(products, category, searchTerm);

  return (
    <div className="pos-container">
      {saleComplete && (
        <div className="success-banner">
          ✓ Sale completed successfully!
        </div>
      )}

      {/* LEFT - Products */}
      <div className="pos-left">
        <div className="pos-header">
          <h2>Point of Sale</h2>
          <input
            type="text"
            placeholder="Search products..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <CategoryFilter category={category} setCategory={setCategory} />

        <div className="pos-products">
          {loading ? (
            <div className="loading">Loading products...</div>
          ) : filteredProducts.length > 0 ? (
            filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={addToCart}
              />
            ))
          ) : (
            <div className="no-products">No products found</div>
          )}
        </div>
      </div>

      {/* RIGHT - Cart */}
      <div className="pos-right">
        <Cart
          cart={cart}
          total={calculateTotal()}
          onUpdateQty={updateQty}
          onRemove={removeFromCart}
        />

        <div className="pos-buttons">
          <button
            className="complete-btn"
            onClick={handleCompleteSale}
            disabled={cart.length === 0}
          >
            Complete Sale
          </button>
          <button
            className="clear-btn"
            onClick={clearCart}
            disabled={cart.length === 0}
          >
            Clear Cart
          </button>
        </div>
      </div>

    </div>
  );
};

export default POS;





// HELPERS

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

const isAuthorized = (user) => {
  return user && ["ADMIN", "STAFF", "Owner"].includes(user.role);
};

const filterProducts = (products, category, searchTerm = "") => {
  return products.filter(p => {
    const matchCategory = category === "ALL" || p.category === category;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });
};

// COMPONENTS

const CategoryFilter = ({ category, setCategory }) => {
  const categories = ["ALL", "COFFEE", "FRAPPE", "MILK TEA", "PASTRIES", "PROMO", "OTHERS"];

  return (
    <div className="pos-categories">
      {categories.map(cat => (
        <button
          key={cat}
          className={`cat-btn ${category === cat ? "active" : ""}`}
          onClick={() => setCategory(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

const ProductCard = ({ product, onClick }) => (
  <div
    className="pos-card"
    onClick={() => onClick(product)}
  >
    <div className="card-content">
      <h4>{product.name}</h4>
      <p className="category">{product.category}</p>
      <p className="price">${product.price?.toFixed(2)}</p>
    </div>
    <button className="add-btn">Add</button>
  </div>
);

const Cart = ({ cart, total, onUpdateQty, onRemove }) => (
  <>
    <div className="cart-header">
      <h3>Transaction</h3>
      <span className="badge">{cart.length}</span>
    </div>

    <div className="cart-box">
      {cart.length === 0 ? (
        <p className="empty">No items in cart</p>
      ) : (
        cart.map(item => (
          <div key={item.id} className="cart-item">
            <div className="item-info">
              <h4>{item.name}</h4>
              <p>${item.price?.toFixed(2)} each</p>
            </div>
            <div className="item-controls">
              <button
                className="qty-btn"
                onClick={() => onUpdateQty(item.id, item.qty - 1)}
              >
                −
              </button>
              <input
                type="number"
                min="1"
                value={item.qty}
                onChange={(e) => onUpdateQty(item.id, parseInt(e.target.value) || 1)}
                className="qty-input"
              />
              <button
                className="qty-btn"
                onClick={() => onUpdateQty(item.id, item.qty + 1)}
              >
                +
              </button>
            </div>
            <div className="item-total">${(item.price * item.qty).toFixed(2)}</div>
            <button
              className="remove-btn"
              onClick={() => onRemove(item.id)}
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>

    <div className="pos-total">
      <div className="summary-row">
        <span>Subtotal:</span>
        <span>${total?.toFixed(2)}</span>
      </div>
      <div className="summary-row">
        <span>Tax:</span>
        <span>$0.00</span>
      </div>
      <div className="summary-row total">
        <span>Total:</span>
        <span>${total?.toFixed(2)}</span>
      </div>
    </div>
  </>
);