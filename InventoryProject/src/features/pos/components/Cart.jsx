import React from 'react';

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
          <div key={item.cartItemId} className="cart-item">
            <div className="item-info">
              <h4>{item.name}</h4>
              <div className="item-meta">
                {item.cup_size && <span className="size-badge">{item.cup_size}</span>}
                {item.add_ons?.length > 0 && (
                  <span className="addons-list"> + {item.add_ons.join(', ')}</span>
                )}
              </div>
              <p>₱ {item.price?.toFixed(2)} each</p>
            </div>
            <div className="item-controls">
              <input
                type="number"
                min="1"
                value={item.qty}
                onChange={(e) => onUpdateQty(item.cartItemId, parseInt(e.target.value) || 1)}
                className="qty-input"
              />
            </div>
            <div className="item-total-group">
              <button
                className="remove-btn"
                onClick={() => onRemove(item.cartItemId)}
              >
                ✕
              </button>
              <div className="item-total">₱ {(item.price * item.qty).toFixed(2)}</div>
            </div>
          </div>
        ))
      )}
    </div>

    <div className="pos-total">
      <div className="summary-row">
        <span>Net of VAT (12%):</span>
        <span>₱ {(total / 1.12).toFixed(2)}</span>
      </div>
      <div className="summary-row">
        <span>VAT (12%):</span>
        <span>₱ {(total - (total / 1.12)).toFixed(2)}</span>
      </div>
      <div className="summary-row total">
        <span>Total Amount Due:</span>
        <span>₱ {total?.toFixed(2)}</span>
      </div>
    </div>
  </>
);

export default Cart;
