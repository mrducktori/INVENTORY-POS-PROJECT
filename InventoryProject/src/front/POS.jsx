import React, { useEffect, useState } from "react";
import { getProducts, createSale } from "../api/posApi";
import { getRecipesByProduct } from "../api/recipesApi";
import "../styles/POS.css";

const POS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState(null);
  const [ongoingOrders, setOngoingOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("cart"); // 'cart' or 'ongoing'
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState([]);

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

  // FETCH RECIPE FOR MODAL
  useEffect(() => {
    if (recipeProduct) {
      loadRecipe(recipeProduct.id);
    } else {
      setCurrentRecipe([]);
    }
  }, [recipeProduct]);

  const loadRecipe = async (productId) => {
    try {
      setRecipeLoading(true);
      const data = await getRecipesByProduct(productId);
      setCurrentRecipe(data || []);
    } catch (err) {
      console.error("Failed to load recipe:", err);
    } finally {
      setRecipeLoading(false);
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
      const newOrder = {
        id: Date.now(),
        items: [...cart],
        total: calculateTotal(),
        staff_id: user.id,
        timestamp: new Date().toLocaleTimeString(),
        status: 'pending'
      };

      setOngoingOrders([...ongoingOrders, newOrder]);
      clearCart();
      setActiveTab('ongoing');
    } catch (err) {
      console.error(err);
      alert("Error creating order: " + err.message);
    }
  };

  // COMPLETE ORDER
  const handleCompleteOrder = async (orderId) => {
    try {
      const order = ongoingOrders.find(o => o.id === orderId);
      if (!order) return;

      await createSale({
        cart: order.items,
        total: order.total,
        staff_id: user.id
      });

      setOngoingOrders(ongoingOrders.filter(o => o.id !== orderId));
      setSaleComplete(true);
      setTimeout(() => setSaleComplete(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Error completing order: " + err.message);
    }
  };

  // CANCEL ORDER
  const handleCancelOrder = (orderId) => {
    setOngoingOrders(ongoingOrders.filter(o => o.id !== orderId));
  };

  // FILTER
  const filteredProducts = filterProducts(products, category, searchTerm);

  return (
    <div className="pos-container">
      {saleComplete && (
        <div className="success-banner">
          ✓ Transaction completed successfully!
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
                onViewRecipe={(p) => setRecipeProduct(p)}
              />
            ))
          ) : (
            <div className="no-products">No products found</div>
          )}
        </div>
      </div>

      {/* RIGHT - Cart/Ongoing Orders */}
      <div className="pos-right">
        {/* Tabs */}
        <div className="pos-tabs">
          <button
            className={`tab-btn ${activeTab === 'cart' ? 'active' : ''}`}
            onClick={() => setActiveTab('cart')}
          >
            Transaction ({cart.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'ongoing' ? 'active' : ''}`}
            onClick={() => setActiveTab('ongoing')}
          >
            Ongoing Orders ({ongoingOrders.length})
          </button>
        </div>

        {/* Cart Tab */}
        {activeTab === 'cart' && (
          <>
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
                Create Order
              </button>
              <button
                className="clear-btn"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                Clear Cart
              </button>
            </div>
          </>
        )}

        {/* Ongoing Orders Tab */}
        {activeTab === 'ongoing' && (
          <OngoingOrders
            orders={ongoingOrders}
            onComplete={handleCompleteOrder}
            onCancel={handleCancelOrder}
          />
        )}
      </div>

      {/* Ingredients Info Modal */}
      {recipeProduct && (
        <div className="recipe-modal-overlay" onClick={() => setRecipeProduct(null)}>
          <div className="recipe-modal" onClick={e => e.stopPropagation()}>
            <div className="recipe-modal-header">
              <h3>Ingredients: {recipeProduct.name}</h3>
              <button className="recipe-modal-close" onClick={() => setRecipeProduct(null)}>✕</button>
            </div>
            <div className="recipe-modal-body">
              {recipeLoading ? (
                <div className="loading">Loading recipe details...</div>
              ) : (
                <table className="recipe-table">
                  <thead>
                    <tr><th>Ingredient</th><th>Qty</th><th>Unit</th><th>Stock</th></tr>
                  </thead>
                  <tbody>
                    {currentRecipe.map((r, i) => (
                      <tr key={i}>
                        <td>{r.ingredients?.name}</td>
                        <td>{r.quantity_used}</td>
                        <td>{r.ingredients?.unit}</td>
                        <td>
                          <span className={`stock-indicator ${(r.ingredients?.stock_quantity || 0) < 10 ? 'critical' : 'normal'}`}>
                            {r.ingredients?.stock_quantity}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {currentRecipe.length === 0 && (
                      <tr><td colSpan={4} className="empty">No recipe data found for this product.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
            <div className="recipe-modal-footer">
              <button className="recipe-close-btn" onClick={() => setRecipeProduct(null)}>Close</button>
              <button className="complete-btn btn-small" onClick={() => { addToCart(recipeProduct); setRecipeProduct(null); }}>
                + Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
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
  return user && ["ADMIN", "STAFF", "Owner", "Admin", "Staff"].includes(user.role);
};

const filterProducts = (products, category, searchTerm = "") => {
  const mainCategories = ["COFFEE", "FRAPPE", "MILK TEA", "PASTRIES", "PASTRY", "PROMO"];
  
  return products.filter(p => {
    const pCat = (p.category || "").toUpperCase();
    const targetCat = category.toUpperCase();
    
    let matchCategory = false;
    if (targetCat === "ALL") {
      matchCategory = true;
    } else if (targetCat === "OTHERS") {
      // Items that are not in the main categories list go to 'OTHERS'
      matchCategory = !mainCategories.includes(pCat);
    } else if (targetCat === "PASTRIES") {
      // Match both 'PASTRIES' and 'PASTRY'
      matchCategory = (pCat === "PASTRIES" || pCat === "PASTRY");
    } else {
      matchCategory = pCat === targetCat;
    }


    const matchSearch = (p.name || "").toLowerCase().includes(searchTerm.toLowerCase());
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

const ProductCard = ({ product, onClick, onViewRecipe }) => (
  <div className="pos-card">
    <div className="card-content" onClick={() => onClick(product)}>
      <h4>{product.name}</h4>
      <p className="category">{product.category}</p>
      <p className="price">₱{product.price?.toFixed(2)}</p>
    </div>
    <div className="pos-card-footer">
      <button
        className="info-btn"
        onClick={(e) => { e.stopPropagation(); onViewRecipe(product); }}
        title="View Ingredients"
      >
        Info
      </button>
      <button className="add-btn" onClick={() => onClick(product)}>+ Add</button>
    </div>
  </div>
);

const Cart = ({ cart, total, onUpdateQty, onRemove }) => (
  <>
    <div className="cart-header">
      <h2>Transaction</h2>
      <span className="badge">ITEMS: {cart.length}</span>
    </div>

    <div className="cart-box">
      {cart.length === 0 ? (
        <p className="empty">No items in cart</p>
      ) : (
        cart.map(item => (
          <div key={item.id} className="cart-item">
            <div className="item-info">
              <h4>{item.name}</h4>
              <p>₱ {item.price?.toFixed(2)} each</p>
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
            <div className="item-total">₱ {(item.price * item.qty).toFixed(2)}</div>
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
        <span>₱ {total?.toFixed(2)}</span>
      </div>
      <div className="summary-row">
        <span>Tax:</span>
        <span>₱ 0.00</span>
      </div>
      <div className="summary-row total">
        <span>Total:</span>
        <span>₱ {total?.toFixed(2)}</span>
      </div>
    </div>
  </>
);

const OngoingOrders = ({ orders, onComplete, onCancel }) => (
  <>
    <div className="cart-header">
      <h2>Ongoing Orders</h2>
      <span className="badge">ORDERS: {orders.length}</span>
    </div>

    <div className="cart-box ongoing-orders-box">
      {orders.length === 0 ? (
        <p className="empty">No ongoing orders</p>
      ) : (
        orders.map(order => (
          <div key={order.id} className="ongoing-order-card">
            <div className="order-header">
              <h4>Order #{order.id}</h4>
              <span className="order-time">{order.timestamp}</span>
            </div>

            <div className="order-items">
              {order.items.map(item => (
                <div key={item.id} className="order-item">
                  <span className="order-item-name">{item.name} x{item.qty}</span>
                  <span className="order-item-price">₱{(item.price * item.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="order-total">
              <strong>Total: ₱{order.total.toFixed(2)}</strong>
            </div>

            <div className="order-actions">
              <button
                className="complete-btn small-btn"
                onClick={() => onComplete(order.id)}
              >
                ✓ Complete
              </button>
              <button
                className="cancel-btn small-btn"
                onClick={() => onCancel(order.id)}
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </>
);