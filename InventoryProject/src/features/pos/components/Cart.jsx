import React from 'react';

// add_ons may be objects {name,...} or JSON strings — handle both
const addonName = (a) => {
  if (!a) return '';
  if (typeof a === 'object') {
    return a.name ? `${a.name}${a.customer_qty > 1 ? ` (x${a.customer_qty})` : ''}` : '';
  }
  try { 
    const parsed = JSON.parse(a);
    return parsed?.name ? `${parsed.name}${parsed.customer_qty > 1 ? ` (x${parsed.customer_qty})` : ''}` : a; 
  } catch { 
    return a; 
  }
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
const Cart = ({ cart, total, onUpdateQty, onRemove, onEdit }) => (
  <div className="flex flex-col flex-1 overflow-hidden bg-white">
    <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-white shadow-sm z-10">
      <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Transaction</h2>
      <span className="bg-gray-100 text-gray-800 text-sm md:text-base font-bold px-3 py-1 rounded-full uppercase tracking-wider">ITEMS: {cart.length}</span>
    </div>

    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
      {cart.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 mt-10">
          <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
          <p className="m-0 text-sm md:text-base font-medium">No items in cart</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cart.map(item => (
            <div key={item.cartItemId} className="flex gap-3 p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-gray-300 transition-colors">
              <div className="flex-1 min-w-0">
                <h4 className="m-0 text-sm md:text-base font-bold text-gray-900 truncate">{item.name}</h4>
                <div className="flex flex-wrap items-center gap-2 mt-1 mb-1.5">
                  {item.cup_size && <span className="bg-gray-100 text-gray-600 text-xs md:text-sm font-bold px-2 py-0.5 rounded uppercase tracking-wider">{item.cup_size}</span>}
                  {parseAddons(item.add_ons).length > 0 && (
                    <span className="text-sm md:text-base text-gray-500 truncate block w-full leading-tight"> + {parseAddons(item.add_ons).map(addonName).join(', ')}</span>
                  )}
                </div>
                <p className="m-0 text-sm md:text-base font-medium text-gray-500">₱ {item.price?.toFixed(2)} each</p>
              </div>
              
              <div className="flex flex-col justify-between items-end shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  {onEdit && (
                    <button
                      className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="Edit Item"
                      onClick={() => onEdit(item.cartItemId)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2-2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                      </svg>
                    </button>
                  )}
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors font-bold text-sm md:text-base"
                    onClick={() => onRemove(item.cartItemId)}
                    title="Remove Item"
                   aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-xs">
                    <button
                      type="button"
                      className="px-2 py-1 text-gray-600 hover:bg-gray-100 font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => onUpdateQty(item.cartItemId, Math.max(1, item.qty - 1))}
                      disabled={item.qty <= 1}
                      title="Decrease quantity"
                    >−</button>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={item.qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val)) return;
                        onUpdateQty(item.cartItemId, Math.min(99, Math.max(1, val)));
                      }}
                      className="w-10 text-center text-sm md:text-base font-bold text-gray-900 border-none focus:outline-none p-0"
                    />
                    <button
                      type="button"
                      className="px-2 py-1 text-gray-600 hover:bg-gray-100 font-bold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      onClick={() => onUpdateQty(item.cartItemId, Math.min(99, item.qty + 1))}
                      disabled={item.qty >= 99}
                      title="Increase quantity (Max 99)"
                    >+</button>
                  </div>
                  <div className="text-sm md:text-base font-bold text-gray-900 w-18 text-right tabular-nums">₱ {(item.price * item.qty).toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="bg-gray-50 p-5 border-t border-gray-200 mt-auto">
      <div className="flex justify-between items-center mb-2 text-sm md:text-base font-medium text-gray-500 uppercase tracking-wider">
        <span>Net of VAT (12%):</span>
        <span>₱ {(total / 1.12).toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-center mb-3 text-sm md:text-base font-medium text-gray-500 uppercase tracking-wider">
        <span>VAT (12%):</span>
        <span>₱ {(total - (total / 1.12)).toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-center pt-3 border-t border-gray-200">
        <span className="text-sm md:text-base font-bold text-gray-900 uppercase tracking-wider">Total Amount Due:</span>
        <span className="text-2xl font-extrabold text-gray-900 tracking-tight">₱ {total?.toFixed(2)}</span>
      </div>
    </div>
  </div>
);

export default Cart;
