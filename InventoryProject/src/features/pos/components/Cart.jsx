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

const ORDER_TYPES = [
  { id: 'DINE_IN', label: 'Dine-In' },
  { id: 'TAKE_OUT', label: 'Take-Out' },
  { id: 'DELIVERY', label: 'Delivery' }
];

const Cart = ({
  cart,
  total,
  maxQtyByCartItemId = {},
  orderType = 'DINE_IN',
  onOrderTypeChange = null,
  onUpdateQty,
  onRemove,
  onEdit
}) => {
  const numTotal = parseFloat(total) || 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-white">
      <div className="px-6 py-3.5 border-b border-gray-100 bg-white z-10 space-y-2.5">
        <div className="flex justify-between items-center">
          <h2 className="m-0 text-base font-bold text-gray-900">Transaction</h2>
          <span className="text-xs font-semibold text-gray-500">
            {cart.length} {cart.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {onOrderTypeChange && (
          <div className="grid grid-cols-3 p-1 bg-zinc-100 rounded-xl border border-zinc-200/80 gap-1">
            {ORDER_TYPES.map((opt) => {
              const active = orderType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onOrderTypeChange(opt.id)}
                  className={`py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border-none ${
                    active
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-transparent text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 mt-10">
            <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="m-0 text-sm font-medium text-gray-500">Cart is empty</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {cart.map((item) => {
              const maxQty = maxQtyByCartItemId?.[item.cartItemId] ?? 99;
              const isOverMax = item.qty > maxQty;

              return (
              <div
                key={item.cartItemId}
                className="flex gap-3 p-3.5 bg-white border border-gray-100 rounded-xl shadow-xs hover:border-gray-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="m-0 text-sm font-bold text-gray-900 truncate">{item.name}</h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 mb-1">
                    {item.cup_size && (
                      <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded">
                        {item.cup_size}
                      </span>
                    )}
                    {item.modifiers && (item.modifiers.sugar_level || item.modifiers.ice_level || item.modifiers.no_lid || item.modifiers.no_straw) && (
                      <span className="text-[11px] font-medium text-zinc-500">
                        {[
                          item.modifiers.sugar_level ? `Sugar: ${item.modifiers.sugar_level}` : null,
                          item.modifiers.ice_level || null,
                          item.modifiers.no_lid ? 'No lid' : null,
                          item.modifiers.no_straw ? 'No straw' : null
                        ].filter(Boolean).join(' • ')}
                      </span>
                    )}
                    {parseAddons(item.add_ons).length > 0 && (
                      <span className="text-xs text-gray-500 truncate block w-full leading-tight">
                        + {parseAddons(item.add_ons).map(addonName).join(', ')}
                      </span>
                    )}
                  </div>
                  <p className="m-0 text-xs font-medium text-gray-500">₱{item.price?.toFixed(2)} each</p>
                </div>

                <div className="flex flex-col justify-between items-end shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    {onEdit && (
                      <button
                        type="button"
                        className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer bg-transparent border-none"
                        title="Edit Item"
                        onClick={() => onEdit(item.cartItemId)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2-2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer bg-transparent border-none"
                      onClick={() => onRemove(item.cartItemId)}
                      title="Remove Item"
                      aria-label="Remove item"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-xs">
                        <button
                          type="button"
                          className="px-2 py-1 text-gray-600 hover:bg-gray-100 font-bold text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none"
                          onClick={() => onUpdateQty(item.cartItemId, Math.max(1, item.qty - 1))}
                          disabled={item.qty <= 1}
                          title="Decrease quantity"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={Math.max(1, maxQty)}
                          value={item.qty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (isNaN(val)) return;
                            onUpdateQty(item.cartItemId, Math.max(1, val));
                          }}
                          className="w-8 text-center text-xs font-bold text-gray-900 border-none focus:outline-none p-0 tabular-nums"
                        />
                        <button
                          type="button"
                          className="px-2 py-1 text-gray-600 hover:bg-gray-100 font-bold text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none"
                          onClick={() => onUpdateQty(item.cartItemId, item.qty + 1)}
                          disabled={item.qty >= maxQty}
                          title={item.qty >= maxQty ? `Max available (${maxQty})` : 'Increase quantity'}
                        >
                          +
                        </button>
                      </div>
                      <div className="text-sm font-bold text-gray-900 w-16 text-right font-mono tabular-nums">
                        ₱{(item.price * item.qty).toFixed(2)}
                      </div>
                    </div>
                    {isOverMax && (
                      <span className="text-[11px] font-semibold text-red-600 mt-1 text-right">
                        Only {maxQty} available
                      </span>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-gray-50/80 px-5 py-3.5 border-t border-gray-200 mt-auto space-y-1.5">
        <div className="flex justify-between items-center text-xs font-medium text-gray-500">
          <span>Net of VAT (12%)</span>
          <span className="font-mono">₱{(numTotal / 1.12).toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-xs font-medium text-gray-500">
          <span>VAT (12%)</span>
          <span className="font-mono">₱{(numTotal - numTotal / 1.12).toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-sm font-bold text-gray-900">Total Amount Due</span>
          <span className="text-xl font-bold text-gray-900 font-mono tracking-tight">
            ₱{numTotal.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Cart;
