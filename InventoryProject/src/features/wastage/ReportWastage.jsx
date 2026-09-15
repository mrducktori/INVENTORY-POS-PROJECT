import React, { useState, useEffect } from 'react';
import { getIngredients } from '../../api/inventoryApi';
import { reportWastage, getWastageHistory } from '../../api/wastageApi';
import { formatQuantity } from '../../utils/productUtils';


const ReportWastage = () => {
  const [ingredients, setIngredients] = useState([]);
  const [wastageHistory, setWastageHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ingredient_id: '',
    quantity: '',
    reason: ''
  });
  const [message, setMessage] = useState('');

  const selectedIngredient = ingredients.find(ing => ing.id === formData.ingredient_id);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ings, history] = await Promise.all([
        getIngredients(),
        getWastageHistory()
      ]);
      setIngredients(ings || []);
      setWastageHistory(history || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ingredient_id || !formData.quantity || !formData.reason) {
      setMessage('All fields are required');
      return;
    }

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      await reportWastage({
        ...formData,
        quantity: parseFloat(formData.quantity),
        reported_by: user.id
      });

      setMessage('Wastage reported successfully!');
      setFormData({ ingredient_id: '', quantity: '', reason: '' });
      setTimeout(() => setMessage(''), 3000);
      fetchData();
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const totalWastageQuantity = wastageHistory.reduce((sum, w) => sum + w.quantity, 0);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-extrabold text-gray-900 tracking-tight">Report Broken Items</h1>
        <p className="m-0 text-sm text-gray-500 font-medium">Track and report ingredient wastage</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-gray-900">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Records</div>
          <div className="text-2xl font-extrabold text-gray-900 mb-1">{wastageHistory.length}</div>
        </div>
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-orange-500">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Quantity Wasted</div>
          <div className="text-2xl font-extrabold text-gray-900 mb-1">{totalWastageQuantity.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-red-500">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">This Month</div>
          <div className="text-2xl font-extrabold text-gray-900 mb-1">
            {wastageHistory.filter(w => {
              const date = new Date(w.created_at);
              const now = new Date();
              return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }).length}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden max-w-2xl">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Report Wastage</h2>
        </div>
        <div className="p-6">
          {message && (
            <div className={`p-4 rounded-lg mb-6 text-sm font-medium border ${message.includes('successfully') ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Ingredient</label>
              <select
                name="ingredient_id"
                value={formData.ingredient_id}
                onChange={handleInputChange}
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm w-full cursor-pointer"
              >
                <option value="">-- Select ingredient --</option>
                {ingredients.map(ing => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>

            {selectedIngredient && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Current:</span>
                  <strong className="text-gray-900 font-mono">{formatQuantity(selectedIngredient.stock_quantity, selectedIngredient.unit)}</strong>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Alert at:</span>
                  <strong className="text-gray-900 font-mono">{formatQuantity(selectedIngredient.low_stock_alert, selectedIngredient.unit)}</strong>
                </div>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  selectedIngredient.stock_quantity <= 0 ? 'bg-black text-white border-black' :
                  selectedIngredient.stock_quantity <= selectedIngredient.low_stock_alert ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {selectedIngredient.stock_quantity <= 0 ? 'OUT OF STOCK' :
                   selectedIngredient.stock_quantity <= selectedIngredient.low_stock_alert ? 'LOW STOCK' : 'IN STOCK'}
                </span>
              </div>
            )}


            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Quantity Wasted</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="quantity"
                placeholder="Enter quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm w-full"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700 uppercase tracking-wider">Reason for Wastage</label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                className="px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all shadow-sm w-full cursor-pointer"
              >
                <option value="">-- Select reason --</option>
                <option value="Expiry">Expiry</option>
                <option value="Spoilage">Spoilage</option>
                <option value="Damage">Damage</option>
                <option value="Spillage">Spillage</option>
                <option value="Quality Issue">Quality Issue</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="mt-2 px-6 py-3 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors shadow-sm w-full sm:w-auto"
            >
              Report Wastage
            </button>
          </form>
        </div>
      </div>

      <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden mt-6">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Wastage History</h2>
        </div>
        <div className="p-0">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 animate-pulse">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4"></div>
              <p className="m-0 font-medium">Loading wastage history...</p>
            </div>
          ) : wastageHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ingredient</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Quantity</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Unit</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Reported By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {wastageHistory.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4 text-xs font-medium font-mono text-gray-500">
                        {new Date(record.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-900">
                        {record.ingredients?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold font-mono text-gray-900 text-right">
                        {record.quantity}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-500">
                        {record.ingredients?.unit || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200">
                          {record.reason}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-600">
                        {record.users?.name || 'Unknown'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500">
              <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              <div className="text-lg font-bold text-gray-900 mb-1">No Records</div>
              <p className="m-0 text-sm">There are no wastage records yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportWastage;
