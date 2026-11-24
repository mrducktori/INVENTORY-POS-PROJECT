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

const formatOrderTypeLabel = (orderType) => {
  const norm = String(orderType || 'DINE_IN').toUpperCase();
  if (norm === 'TAKE_OUT') return 'Take-Out';
  if (norm === 'DELIVERY') return 'Delivery';
  return 'Dine-In';
};

const OngoingOrders = ({ orders, stockIssuesByOrderId = {}, onComplete, onCancel, onEdit }) => (
  <div className="flex flex-col flex-1 overflow-hidden bg-white">
    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-white z-10">
      <h2 className="m-0 text-base font-bold text-gray-900">Ongoing Orders</h2>
      <span className="text-xs font-semibold text-gray-500">
        {orders.length} {orders.length === 1 ? 'order' : 'orders'} active
      </span>
    </div>

    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200 bg-gray-50/50">
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 mt-10">
          <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="m-0 text-sm font-medium text-gray-500">No ongoing orders</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((order) => {
            const orderIssues = stockIssuesByOrderId?.[order.id] || [];
            return (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl shadow-xs overflow-hidden transition-shadow hover:shadow-sm">
              <div className="flex justify-between items-center px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">Order #{order.id}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-200/80 text-zinc-800">
                    {formatOrderTypeLabel(order.order_type)}
                  </span>
                </div>
                <span className="text-xs text-gray-500 font-medium">{order.timestamp}</span>
              </div>

              {orderIssues.length > 0 && (
                <div className="px-4 py-2 bg-red-50 border-b border-red-100 text-xs font-semibold text-red-700">
                  Insufficient stock — edit order to adjust
                </div>
              )}

              <div className="p-4 flex flex-col gap-2.5">
                {order.items.map((item) => (
                  <div key={item.cartItemId} className="flex flex-col gap-0.5 pb-2.5 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-800">
                        {item.name} <span className="text-gray-400 text-xs">×{item.qty}</span>
                      </span>
                      <span className="text-sm font-semibold text-gray-900 font-mono">
                        ₱{(item.price * item.qty).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 leading-tight">
                      {item.cup_size}{parseAddons(item.add_ons).length > 0 ? ` + ${parseAddons(item.add_ons).map(addonName).join(', ')}` : ''}
                    </div>
                    {item.modifiers && (item.modifiers.sugar_level || item.modifiers.ice_level) && (
                      <div className="text-[11px] text-zinc-500 leading-tight">
                        {[
                          item.modifiers.sugar_level ? `Sugar: ${item.modifiers.sugar_level}` : null,
                          item.modifiers.ice_level || null
                        ].filter(Boolean).join(' • ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 bg-gray-50/70 border-t border-gray-100 flex flex-col gap-1">
                {order.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-xs font-semibold text-emerald-700">
                    <span>Discount ({order.discountLabel})</span>
                    <span className="font-mono">-₱{Number(order.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-gray-500">Total</span>
                  <strong className="text-base font-bold text-gray-900 font-mono">
                    ₱{Number(order.finalTotal ?? order.total).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  className="py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer bg-transparent border-none"
                  onClick={() => onEdit(order.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer bg-transparent border-none"
                  onClick={() => onComplete(order.id)}
                >
                  Pay
                </button>
                <button
                  type="button"
                  className="py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors cursor-pointer bg-transparent border-none"
                  onClick={() => onCancel(order.id)}
                >
                  Cancel
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

export default OngoingOrders;
