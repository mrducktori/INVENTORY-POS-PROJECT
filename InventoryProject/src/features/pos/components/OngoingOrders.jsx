import React from 'react';

const addonName = (a) => {
  if (!a) return '';
  if (typeof a === 'object') return a.name ?? '';
  try { return JSON.parse(a)?.name ?? a; } catch { return a; }
};

const parseAddons = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [raw];
  }
};

const OngoingOrders = ({ orders, onComplete, onCancel, onEdit }) => (
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
                <div key={item.cartItemId} className="order-item">
                  <div className="order-item-main">
                    <span className="order-item-name">{item.name} x{item.qty}</span>
                    <span className="order-item-price">₱{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                  <div className="order-item-options">
                    <small>{item.cup_size}{parseAddons(item.add_ons).length > 0 ? ` + ${parseAddons(item.add_ons).map(addonName).join(', ')}` : ''}</small>
                  </div>
                </div>
              ))}
            </div>

            <div className="order-total">
              <strong>Total: ₱{order.total.toFixed(2)}</strong>
            </div>

            <div className="order-actions">
              <button
                className="edit-btn small-btn"
                onClick={() => onEdit(order.id)}
              >
                ✎ Edit
              </button>
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

export default OngoingOrders;
