import React, { useState, useEffect } from 'react';

const PaymentModal = ({ order, onConfirm, onClose }) => {
  const [method, setMethod] = useState('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [reference, setReference] = useState('');
  const [change, setChange] = useState(0);
  const [submitting, setSubmitting] = useState(false); // prevents double-click

  useEffect(() => {
    if (method === 'CASH' && amountReceived) {
      const received = parseFloat(amountReceived);
      const total = order.total;
      if (received >= total) {
        setChange(received - total);
      } else {
        setChange(0);
      }
    } else {
      setChange(0);
    }
  }, [amountReceived, method, order.total]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (method === 'CASH') {
      const received = parseFloat(amountReceived);
      if (isNaN(received) || received < order.total) {
        alert("Amount received must be greater than or equal to total.");
        return;
      }
    }

    if (method === 'GCASH' && !reference.trim()) {
      alert("Please enter GCash transaction reference.");
      return;
    }

    // Lock the button immediately
    setSubmitting(true);
    try {
      await onConfirm({
        method,
        amountReceived: method === 'CASH' ? parseFloat(amountReceived) : order.total,
        change: method === 'CASH' ? change : 0,
        reference: method === 'GCASH' ? reference : ''
      });
      // On success the modal will be closed by the parent — no need to re-enable
    } catch (err) {
      // On failure re-enable so staff can try again
      setSubmitting(false);
      alert("Payment failed: " + (err.message || "Please try again."));
    }
  };

  return (
    <div className="recipe-modal-overlay" onClick={submitting ? undefined : onClose}>
      <div className="recipe-modal payment-modal" onClick={e => e.stopPropagation()}>
        <div className="recipe-modal-header">
          <h3>Payment: Order #{order.id}</h3>
          <button className="recipe-modal-close" onClick={submitting ? undefined : onClose} disabled={submitting}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="recipe-modal-body">
            <div className="payment-total-display">
              <span>Total Amount Due</span>
              <h1>₱{order.total.toFixed(2)}</h1>
            </div>

            <div className="payment-method-selector">
              <button 
                type="button"
                className={`method-btn ${method === 'CASH' ? 'active' : ''}`}
                onClick={() => setMethod('CASH')}
                disabled={submitting}
              >
                CASH
              </button>
              <button 
                type="button"
                className={`method-btn ${method === 'GCASH' ? 'active' : ''}`}
                onClick={() => setMethod('GCASH')}
                disabled={submitting}
              >
                GCASH
              </button>
            </div>

            {method === 'CASH' && (
              <div className="payment-fields">
                <div className="input-group">
                  <label>Amount Received</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    autoFocus
                    placeholder="0.00"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="change-display">
                  <span>Change</span>
                  <div className={`change-amount ${change > 0 ? 'has-change' : ''}`}>
                    ₱{change.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {method === 'GCASH' && (
              <div className="payment-fields">
                <div className="input-group">
                  <label>Transaction Reference Number</label>
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Enter Reference #"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="payment-notice">
                    Ensure payment is confirmed on GCash app before proceeding.
                </div>
              </div>
            )}
          </div>

          <div className="recipe-modal-footer">
            <button 
              type="button" 
              className="recipe-close-btn" 
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="complete-btn"
              disabled={submitting}
              style={{ opacity: submitting ? 0.7 : 1, cursor: submitting ? 'not-allowed' : 'pointer' }}
            >
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentModal;
