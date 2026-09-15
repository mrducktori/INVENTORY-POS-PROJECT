import React, { useState } from 'react';

const PaymentModal = ({ order, onConfirm, onClose }) => {
  const [method, setMethod] = useState('CASH');
  const [amountReceived, setAmountReceived] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false); // prevents double-click

  const received = parseFloat(amountReceived) || 0;
  const change = (method === 'CASH' && received >= order.total) ? received - order.total : 0;

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

    if (!window.confirm("Are you sure you want to complete this payment?")) {
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
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={submitting ? undefined : onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[popIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="m-0 text-base font-semibold tracking-wide">Payment: Order #{order.id}</h3>
          <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0 disabled:opacity-50" onClick={submitting ? undefined : onClose} disabled={submitting}>✕</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 text-center mb-6">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Total Amount Due</span>
              <h1 className="m-0 text-4xl font-extrabold text-gray-900 tracking-tight">₱{order.total.toFixed(2)}</h1>
            </div>

            <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
              <button 
                type="button"
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${method === 'CASH' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setMethod('CASH')}
                disabled={submitting}
              >
                CASH
              </button>
              <button 
                type="button"
                className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${method === 'GCASH' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setMethod('GCASH')}
                disabled={submitting}
              >
                GCASH
              </button>
            </div>

            {method === 'CASH' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount Received</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    autoFocus
                    placeholder="0.00"
                    value={amountReceived}
                    onChange={(e) => setAmountReceived(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-3 text-lg font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100"
                  />
                </div>
                <div className="flex justify-between items-center px-4 py-3 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Change</span>
                  <div className={`text-xl font-bold ${change > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    ₱{change.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {method === 'GCASH' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Transaction Reference Number</label>
                  <input 
                    type="text" 
                    autoFocus
                    placeholder="Enter Reference #"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    required
                    disabled={submitting}
                    className="w-full px-4 py-3 text-base font-medium border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all disabled:bg-gray-100"
                  />
                </div>
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs font-medium border border-blue-100 flex items-center justify-center text-center">
                    Ensure payment is confirmed on GCash app before proceeding.
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
            <button 
              type="button" 
              className="flex-1 py-3 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-600 uppercase tracking-wider hover:bg-gray-50 transition-colors disabled:opacity-50" 
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-[2] py-3 bg-green-600 border border-transparent rounded-xl text-sm font-bold text-white uppercase tracking-wider hover:bg-green-700 hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={submitting}
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
