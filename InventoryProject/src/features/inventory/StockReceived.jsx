import React, { useState, useEffect } from 'react';
import { getIngredients, receiveStock } from '../../api/inventoryApi';
import { getAllProducts, receiveProductStock } from '../../api/productsApi';
import { formatQuantity } from '../../utils/productUtils';
import SearchableIngredientSelect from '../../components/shared/SearchableIngredientSelect';


const StockReceived = () => {
  const [ingredients, setIngredients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [message, setMessage] = useState('');

  // Combined list of trackable items
  const activeIngredients = ingredients.filter(i => !i.is_archived);
  const trackableProducts = products.filter(p => p.track_stock && !p.is_archived);

  const allItems = [
    ...activeIngredients.map(i => ({ ...i, itemType: 'ingredient' })),
    ...trackableProducts.map(p => ({ 
      ...p, 
      itemType: 'product', 
      low_stock_alert: p.low_stock_threshold,
      unit: 'pcs' // Products usually pcs
    }))
  ].sort((a, b) => a.name.localeCompare(b.name));

  const selectedItem = allItems.find(i => String(i.id) === String(selectedId));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ingData, prodData] = await Promise.all([
        getIngredients(),
        getAllProducts()
      ]);
      setIngredients(ingData || []);
      setProducts(prodData || []);
    } catch (err) {
      setMessage('Error loading data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveStock = async (e) => {
    e.preventDefault();
    if (!selectedId || !quantity) {
      setMessage('Please select an item and enter a quantity.');
      return;
    }
    try {
      setSubmitting(true);
      if (selectedItem.itemType === 'ingredient') {
        await receiveStock(selectedId, parseFloat(quantity));
      } else {
        await receiveProductStock(selectedId, parseFloat(quantity));
      }
      
      setMessage(`Successfully added ${parseFloat(quantity)} ${selectedItem.unit || ''} to ${selectedItem.name}!`);
      setSelectedId('');
      setQuantity('');
      setTimeout(() => setMessage(''), 4000);
      fetchData();
    } catch (err) {
      setMessage('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Stock Received</h1>
          <p className="m-0 mt-1 text-sm text-gray-500 font-medium">Log incoming deliveries for ingredients and direct-track products.</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-8 rounded-xl text-sm font-bold flex items-center shadow-sm border ${
          message.includes('success') || message.includes('Successfully') 
            ? 'bg-green-50 text-green-800 border-green-200' 
            : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full mb-8">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Add Incoming Stock</h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleReceiveStock} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700">Select Item (Ingredient or Product)</label>
              <SearchableIngredientSelect
                ingredients={allItems}
                value={selectedId}
                onChange={(id) => setSelectedId(id)}
                placeholder="Search or select ingredient or product..."
              />
            </div>

            {selectedItem && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm text-gray-600">Current: <strong className="text-gray-900">{formatQuantity(selectedItem.stock_quantity, selectedItem.unit)}</strong></span>
                  <span className="text-sm text-gray-600">Alert at: <strong className="text-gray-900">{formatQuantity(selectedItem.low_stock_alert, selectedItem.unit)}</strong></span>
                </div>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selectedItem.stock_quantity <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                  selectedItem.stock_quantity <= selectedItem.low_stock_alert ? 'bg-red-50 text-red-600 border border-red-100' :
                  selectedItem.stock_quantity <= selectedItem.low_stock_alert * 1.5 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {selectedItem.stock_quantity <= 0 ? 'OUT OF STOCK' :
                   selectedItem.stock_quantity <= selectedItem.low_stock_alert ? 'RESTOCK NEEDED' :
                   selectedItem.stock_quantity <= selectedItem.low_stock_alert * 1.5 ? 'LOW STOCK' : 'IN STOCK'}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700">Quantity to Add ({selectedItem?.unit || 'unit'})</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Enter quantity received"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
              />
            </div>

            <button 
              type="submit" 
              className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm disabled:bg-gray-400 self-start" 
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Confirm Stock Receipt'}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden w-full">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Inventory Status Overview</h2>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-500 font-medium">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Current Stock</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Low Alert</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allItems.map(item => (
                    <tr key={`${item.itemType}-${item.id}`} className={`transition-colors ${selectedId === String(item.id) ? 'bg-blue-50/50' : 'hover:bg-gray-50/50'}`}>
                      <td className="px-6 py-4"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100 px-2 py-1 rounded">{item.itemType}</span></td>
                      <td className="px-6 py-4"><strong className="text-sm font-bold text-gray-900">{item.name}</strong></td>
                      <td className="px-6 py-4 text-sm font-extrabold text-gray-900 text-right">{formatQuantity(item.stock_quantity, item.unit)}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-500 text-right">{formatQuantity(item.low_stock_alert, item.unit)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.stock_quantity <= 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                          item.stock_quantity <= item.low_stock_alert ? 'bg-red-50 text-red-600 border border-red-100' :
                          item.stock_quantity <= item.low_stock_alert * 1.5 ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-green-700 border border-green-200'
                        }`}>
                          {item.stock_quantity <= 0 ? 'Out of Stock' :
                           item.stock_quantity <= item.low_stock_alert ? 'Restock Needed' :
                           item.stock_quantity <= item.low_stock_alert * 1.5 ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockReceived;
