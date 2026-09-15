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
  <div className="flex flex-col flex-1 overflow-hidden bg-white">
    <div className="flex justify-between items-center px-6 py-5 border-b border-gray-100 bg-white shadow-sm z-10">
      <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Ongoing Orders</h2>
      <span className="bg-gray-100 text-gray-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">ORDERS: {orders.length}</span>
    </div>

    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-200 bg-gray-50/50">
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3 mt-10">
          <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
          <p className="m-0 text-sm font-medium">No ongoing orders</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map(order => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h4 className="m-0 text-sm font-bold text-gray-900">Order #{order.id}</h4>
                <span className="text-xs font-medium text-gray-500">{order.timestamp}</span>
              </div>

              <div className="p-4 flex flex-col gap-3">
                {order.items.map(item => (
                  <div key={item.cartItemId} className="flex flex-col gap-1 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <span className="text-sm font-medium text-gray-800">{item.name} <span className="text-gray-500 text-xs">x{item.qty}</span></span>
                      <span className="text-sm font-bold text-gray-900">₱{(item.price * item.qty).toFixed(2)}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 leading-tight">
                      {item.cup_size}{parseAddons(item.add_ons).length > 0 ? ` + ${parseAddons(item.add_ons).map(addonName).join(', ')}` : ''}
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total</span>
                <strong className="text-base font-extrabold text-gray-900">₱{order.total.toFixed(2)}</strong>
              </div>

              <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                <button
                  className="py-3 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 transition-colors"
                  onClick={() => onEdit(order.id)}
                >
                  ✎ Edit
                </button>
                <button
                  className="py-3 text-xs font-bold uppercase tracking-wider text-green-600 hover:bg-green-50 transition-colors"
                  onClick={() => onComplete(order.id)}
                >
                  ✓ Pay
                </button>
                <button
                  className="py-3 text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 transition-colors"
                  onClick={() => onCancel(order.id)}
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

export default OngoingOrders;
