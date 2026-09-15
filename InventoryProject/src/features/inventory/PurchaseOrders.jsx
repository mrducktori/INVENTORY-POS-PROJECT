import React, { useState, useEffect } from 'react';
import { getPurchaseOrders, updatePurchaseOrderStatus } from '../../api/purchasingApi';
import PurchaseOrderForm from './PurchaseOrderForm';

const PurchaseOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const data = await getPurchaseOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load purchase orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await updatePurchaseOrderStatus(id, newStatus);
      fetchOrders(); // Refresh the list
    } catch (err) {
      console.error(err);
      alert('Failed to update status.');
    }
  };

  const handleCreateSuccess = () => {
    setShowModal(false);
    fetchOrders();
  };

  const [expandedRow, setExpandedRow] = useState(null);

  const toggleRow = (id) => {
    if (expandedRow === id) setExpandedRow(null);
    else setExpandedRow(id);
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Purchase Orders</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Manage supplier orders, track incoming ingredients, and confirm received stock.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Current Orders</h2>
          <button 
            className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm whitespace-nowrap"
            onClick={() => setShowModal(true)}
          >
            + Create Purchase Order
          </button>
        </div>
        
        <div className="p-0">
          {error && <div className="m-4 p-4 bg-red-50 text-red-800 border border-red-200 rounded-xl text-sm font-bold">{error}</div>}

          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading purchase orders...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">ID (Ref)</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Supplier</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Expected Date</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Items Summary</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Amount</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-8 text-center text-sm font-medium text-gray-400 italic">No purchase orders found.</td>
                    </tr>
                  ) : (
                    orders.map((po) => (
                      <React.Fragment key={po.id}>
                        <tr className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-mono font-bold text-gray-900">{po.id.substring(0, 8).toUpperCase()}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{po.suppliers?.name || 'Unknown Supplier'}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : 'N/A'}</td>
                          <td className="px-6 py-4">
                            <button 
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-bold transition-colors border border-gray-200 flex items-center gap-1"
                              onClick={() => toggleRow(po.id)}
                            >
                              {po.purchase_order_items?.length || 0} Items
                              <svg className={`w-3 h-3 transition-transform ${expandedRow === po.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">₱{Number(po.total_amount).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              po.status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                              po.status === 'Received' ? 'bg-green-50 text-green-700 border border-green-200' :
                              'bg-gray-100 text-gray-600 border border-gray-200'
                            }`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {po.status === 'Pending' && (
                              <button 
                                className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-bold uppercase tracking-wider transition-colors border border-green-200 whitespace-nowrap"
                                onClick={() => handleStatusUpdate(po.id, 'Received')}
                              >
                                Mark Received
                              </button>
                            )}
                          </td>
                        </tr>
                        {expandedRow === po.id && (
                          <tr className="bg-gray-50/80">
                            <td colSpan="7" className="p-0">
                              <div className="px-8 py-6 border-b border-gray-200">
                                <h4 className="m-0 mb-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Order Items</h4>
                                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                  <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead>
                                      <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Qty</th>
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Unit Price</th>
                                        <th className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Subtotal</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {po.purchase_order_items?.map(item => (
                                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{item.ingredients?.name || 'Unknown'}</td>
                                          <td className="px-4 py-3 text-sm font-medium text-gray-600 text-right">{item.quantity} {item.ingredients?.unit}</td>
                                          <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">₱{Number(item.unit_price).toFixed(2)}</td>
                                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">₱{Number(item.subtotal).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <PurchaseOrderForm 
          onClose={() => setShowModal(false)} 
          onSuccess={handleCreateSuccess} 
        />
      )}
    </div>
  );
};

export default PurchaseOrders;
