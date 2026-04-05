import React, { useState, useEffect } from "react";
import "../CSS/POS.css";

const POS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [category, setCategory] = useState("ALL");

  // TEMP ACCESS 
  const role = "STAFF"; // replace with real auth later
  if (role !== "ADMIN" && role !== "STAFF") {
    return <div>Access Denied</div>;
  }

  //  TEMP DATA 
  useEffect(() => {
    setProducts([
      { id: 1, name: "Coffee 1 - Iced", category: "COFFEE", price: 70, stock: 8 },
      { id: 2, name: "Coffee 2 - Iced", category: "COFFEE", price: 67, stock: 67 },
      { id: 3, name: "Frappe 1", category: "FRAPPE", price: 70, stock: 0 },
      { id: 4, name: "Milk Tea 1", category: "MILK TEA", price: 80, stock: 3 },
      { id: 5, name: "Milk Tea 2", category: "MILK TEA", price: 69, stock: 7 },
      { id: 6, name: "Sherbet", category: "OTHERS", price: 25, stock: 30 }
    ]);
  }, []);

  const filteredProducts =
    category === "ALL"
      ? products
      : products.filter(p => p.category === category);

  const addToCart = (product) => {
    const existing = cart.find(c => c.id === product.id);
    if (existing) {
      setCart(cart.map(c =>
        c.id === product.id ? { ...c, qty: c.qty + 1 } : c
      ));
    } else {
      setCart([...cart, { ...product, qty: 1 }]);
    }
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="pos-container">

      {/* LEFT SIDE */}
      <div className="pos-left">

        <div className="pos-header">
          <h2>Point of Sale</h2>
          <input placeholder="Search item name or category..." />
        </div>

        {/* CATEGORY */}
        <div className="pos-categories">
          {["ALL","COFFEE","FRAPPE","MILK TEA","PASTRIES","PROMO ITEMS","OTHERS"].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>

        {/* PRODUCTS */}
        <div className="pos-products">
          {filteredProducts.map(product => (
            <div
              key={product.id}
              className="pos-card"
              onClick={() => addToCart(product)}
            >
              <h4>{product.name}</h4>
              <p>{product.price} PHP</p>
              <span className={product.stock === 0 ? "out" : ""}>
                {product.stock} Remaining
              </span>
            </div>
          ))}
        </div>

      </div>

      {/* RIGHT SIDE */}
      <div className="pos-right">

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

        <div className="pos-buttons">
          <button className="complete">Complete</button>
          <button className="clear" onClick={() => setCart([])}>Clear</button>
        </div>

      </div>
    </div>
  );
};

export default POS;