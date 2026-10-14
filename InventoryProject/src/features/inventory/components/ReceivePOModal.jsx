import React, { useState } from 'react';

const ReceivePOModal = ({ po, onClose, onSubmit }) => {
  const [items, setItems] = useState(
    po.purchase_order_items.map(item => ({
      ...item,
      received_now: 0
    }))
  );
  const [saving, setSaving] = useState(false);

  const handleQuantityChange = (id, val) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, received_now: parseFloat(val) || 0 } : item));
  };
  
  const setMaxQuantity = (id, fullQuantity) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, received_now: fullQuantity } : item));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    // Determine status: Complete if all received, Partial if any are less
    const isComplete = items.every(item => item.is_received || (item.quantity_received + item.received_now) >= item.quantity);
    const newStatus = isComplete ? 'Received' : 'Partial';

    // Only submit items that are newly checked to be received
    const itemsToSubmit = items
      .filter(item => item.received_now > 0)
      .map(item => ({ ...item, quantity_received_now: item.received_now }));

    await onSubmit(po.id, newStatus, itemsToSubmit);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-[popIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="m-0 text-lg font-semibold tracking-wide">Receive PO #{po.id.substring(0, 8).toUpperCase()}</h2>
          <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-xl leading-none cursor-pointer p-0" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden min-h-0">
          <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-sm text-blue-800">
              Please verify the received quantities. If any quantities are less than ordered, the PO will be marked as <strong>Partial</strong>.
            </div>

            <div className="flex flex-col gap-3 mt-2">
              {items.map(item => (
                <div key={item.id} className={`flex flex-col md:flex-row md:items-center gap-4 p-4 border border-gray-200 rounded-lg ${item.is_received ? 'bg-green-50/50' : 'bg-gray-50'}`}>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-900">{item.ingredients?.name}</div>
                    <div className="text-xs text-gray-500">Ordered: {item.quantity} {item.purchase_unit}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.is_received > item.quantity ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-green-700 bg-green-100 rounded-lg">
                        <span className="text-lg leading-none">✓</span> Fully Received
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1 items-end">
                        <div className="text-xs text-gray-500 font-bold">
                          Received So Far: {item.quantity_received} / {item.quantity}
                        </div>
                        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent transition-all">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity - item.quantity_received}
                            step="1"
                            className="w-24 px-3 py-2 text-sm font-bold text-gray-900 text-center border-none focus:outline-none"
                            value={item.received_now || ''}
                            onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                            placeholder="Qty"
                          />
                          <div className="px-3 py-2 bg-gray-50 border-l border-gray-200 text-sm font-bold text-gray-500">
                            {item.purchase_unit}
                          </div>
                          <button
                            type="button"
                            className="px-3 py-2 bg-gray-100 border-l border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-200 transition-colors uppercase tracking-wider"
                            onClick={() => setMaxQuantity(item.id, item.quantity - item.quantity_received)}
                          >
                            Max
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 shrink-0">
            <button type="button" className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="px-5 py-2.5 bg-gray-900 text-white border-none rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm" disabled={saving}>{saving ? 'Processing...' : 'Confirm Receipt'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceivePOModal;
