import React, { useEffect, useState } from "react";
import "../CSS/POS.css";

const POS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("ALL");

  const user = getCurrentUser();

  // ACCESS CONTROL
  if (!isAuthorized(user)) {
    return <div>Access Denied</div>;
  }

  // FETCH PRODUCTS
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/pos/products");
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products:", err);
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

  const clearCart = () => setCart([]);

  const calculateTotal = () =>
    cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  // COMPLETE SALE
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;

    try {
      const res = await fetch("/api/pos/sale", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cart,
          total: calculateTotal(),
          staff_id: user.id
        })
      });

      if (!res.ok) throw new Error("Sale failed");

      alert("Sale completed!");
      clearCart();
      fetchProducts(); // refresh stock if needed
    } catch (err) {
      console.error(err);
      alert("Error completing sale");
    }
  };

  // FILTER
  const filteredProducts = filterProducts(products, category);

  return (
    <div className="pos-container">

      {/* LEFT */}
      <div className="pos-left">
        <Header />
        <CategoryFilter category={category} setCategory={setCategory} />

        <div className="pos-products">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={addToCart}
            />
          ))}
        </div>
      </div>

      {/* RIGHT */}
      <div className="pos-right">
        <Cart cart={cart} total={calculateTotal()} />

        <div className="pos-buttons">
          <button className="complete" onClick={handleCompleteSale}>
            Complete
          </button>
          <button className="clear" onClick={clearCart}>
            Clear
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
  return user && (user.role === "ADMIN" || user.role === "STAFF");
};

const filterProducts = (products, category) => {
  if (category === "ALL") return products;
  return products.filter(p => p.category === category);
};



// COMPONENTS

const Header = () => (
  <div className="pos-header">
    <h2>Point of Sale</h2>
    <input placeholder="Search item..." />
  </div>
);

const CategoryFilter = ({ category, setCategory }) => {
  const categories = ["ALL","COFFEE","FRAPPE","MILK TEA","PASTRIES","PROMO ITEMS","OTHERS"];

  return (
    <div className="pos-categories">
      {categories.map(cat => (
        <button
          key={cat}
          className={category === cat ? "active" : ""}
          onClick={() => setCategory(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  );
};

const ProductCard = ({ product, onClick }) => (
  <div className="pos-card" onClick={() => onClick(product)}>
    <h4>{product.name}</h4>
    <p>{product.price} PHP</p>
    <span className={product.stock === 0 ? "out" : ""}>
      {product.stock ?? 0} Remaining
    </span>
  </div>
);

const Cart = ({ cart, total }) => (
  <>
    <h3>Transaction</h3>

    <div className="cart-box">
      {cart.length === 0 ? (
        <p>No items</p>
      ) : (
        cart.map(item => (
          <div key={item.id} className="cart-item">
            <span>{item.name}</span>
            <span>{item.qty} x {item.price}</span>
          </div>
        ))
      )}
    </div>

    <div className="pos-total">
      <p>Subtotal: {total} PHP</p>
      <p>Tax: 0 PHP</p>
      <h3>Total: {total} PHP</h3>
    </div>
  </>
);