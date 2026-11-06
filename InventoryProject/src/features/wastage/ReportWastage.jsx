import React, { useState, useEffect, useMemo } from 'react';
import { getIngredients } from '../../api/inventoryApi';
import { reportWastage, getWastageHistory } from '../../api/wastageApi';
import { formatQuantity } from '../../utils/productUtils';
import { getCurrentUser } from '../../api/authApi';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';

const REASON_COLORS = {
  'Expiry': 'bg-amber-50 text-amber-800 border-amber-200/80',
  'Spoilage': 'bg-rose-50 text-rose-800 border-rose-200/80',
  'Damage': 'bg-purple-50 text-purple-800 border-purple-200/80',
  'Spillage': 'bg-blue-50 text-blue-800 border-blue-200/80',
  'Quality Issue': 'bg-orange-50 text-orange-800 border-orange-200/80',
  'Other': 'bg-zinc-100 text-zinc-800 border-zinc-200'
};

const ReportWastage = () => {
  const [ingredients, setIngredients] = useState([]);
  const [wastageHistory, setWastageHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [formData, setFormData] = useState({
    ingredient_id: '',
    quantity: '',
    reason: ''
  });
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const selectedIngredient = useMemo(
    () => ingredients.find(ing => ing.id === formData.ingredient_id),
    [ingredients, formData.ingredient_id]
  );

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
      console.error('Error loading wastage data:', err);
      setFeedback({ type: 'error', text: 'Failed to load records: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ingredient_id || !formData.quantity || !formData.reason) {
      setFeedback({ type: 'error', text: 'Please fill in all required fields.' });
      return;
    }

    const qty = parseFloat(formData.quantity);
    if (isNaN(qty) || qty <= 0) {
      setFeedback({ type: 'error', text: 'Wastage quantity must be greater than zero.' });
      return;
    }

    if (selectedIngredient && qty > parseFloat(selectedIngredient.stock_quantity || 0)) {
      setFeedback({
        type: 'error',
        text: `Cannot report ${qty} ${selectedIngredient.unit}. Current stock is only ${selectedIngredient.stock_quantity} ${selectedIngredient.unit}.`
      });
      return;
    }

    try {
      setSubmitting(true);
      const currentUser = getCurrentUser() || JSON.parse(localStorage.getItem('user') || '{}');
      await reportWastage({
        ...formData,
        quantity: qty,
        reported_by: currentUser.id
      });

      setFeedback({ type: 'success', text: 'Wastage logged and inventory successfully deducted!' });
      setFormData({ ingredient_id: '', quantity: '', reason: '' });
      setTimeout(() => setFeedback({ type: '', text: '' }), 4000);
      await fetchData();
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'Failed to submit wastage report.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // KPI Calculations
  const totalWastageQuantity = useMemo(
    () => wastageHistory.reduce((sum, w) => sum + (parseFloat(w.quantity) || 0), 0),
    [wastageHistory]
  );

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    return wastageHistory.filter(w => {
      const date = new Date(w.created_at);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length;
  }, [wastageHistory]);

  // Filtered History
  const filteredHistory = useMemo(() => {
    if (!searchFilter.trim()) return wastageHistory;
    const q = searchFilter.toLowerCase();
    return wastageHistory.filter(w =>
      (w.ingredients?.name || '').toLowerCase().includes(q) ||
      (w.reason || '').toLowerCase().includes(q) ||
      (w.users?.name || '').toLowerCase().includes(q)
    );
  }, [wastageHistory, searchFilter]);

  return (
    <div className="w-full px-6 lg:px-10 py-6 min-h-full space-y-6">
      {/* Operational Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-900 text-white tracking-wide">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              Inventory Control
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight m-0">
            Report Wastage
          </h1>
          <p className="text-base text-zinc-600 mt-1 mb-0">
            Log spoiled, spilled, damaged, or expired stock to keep raw material counts synchronized.
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-xs">
          <div className="text-sm font-bold text-zinc-600 uppercase tracking-wide mb-2">
            Total Logged Incidents
          </div>
          <div className="text-4xl md:text-5xl font-black text-zinc-900 tabular-nums">
            {wastageHistory.length}
          </div>
          <div className="text-sm text-zinc-500 font-medium mt-2">
            Historical incident records
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-xs">
          <div className="text-sm font-bold text-zinc-600 uppercase tracking-wide mb-2">
            Total Units Wasted
          </div>
          <div className="text-4xl md:text-5xl font-black text-zinc-900 tabular-nums">
            {totalWastageQuantity.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-zinc-500 font-medium mt-2">
            Cumulative ingredient deduction
          </div>
        </div>

        <div className="bg-white border border-gray-200/90 rounded-2xl p-6 shadow-xs">
          <div className="text-sm font-bold text-zinc-600 uppercase tracking-wide mb-2">
            Logged This Month
          </div>
          <div className="text-4xl md:text-5xl font-black text-zinc-900 tabular-nums">
            {thisMonthCount}
          </div>
          <div className="text-sm text-zinc-500 font-medium mt-2">
            Incidents reported in current cycle
          </div>
        </div>
      </div>

      {/* Adaptive 2-Column Section: Form on Left, History Table on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Log Wastage Form */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white border border-gray-200/90 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="pb-4 border-b border-gray-100">
            <h2 className="text-xl font-bold text-zinc-900 m-0">
              Log Incident
            </h2>
            <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
              Deductions reflect in real time.
            </p>
          </div>

          {/* Feedback Banner */}
          {feedback.text && (
            <div
              className={`p-4 rounded-xl text-sm font-semibold border transition-all ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Ingredient Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-zinc-800 uppercase tracking-wide">
                Raw Material Ingredient *
              </label>
              <select
                name="ingredient_id"
                value={formData.ingredient_id}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-zinc-50 hover:bg-white focus:bg-white border border-zinc-300 rounded-xl text-base text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all cursor-pointer shadow-xs"
              >
                <option value="">-- Choose ingredient --</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.unit})
                  </option>
                ))}
              </select>
            </div>

            {/* Live Stock Context Chip */}
            {selectedIngredient && (
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Current Stock
                  </span>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider border ${
                      selectedIngredient.stock_quantity <= 0
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : selectedIngredient.stock_quantity <= selectedIngredient.low_stock_alert
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {selectedIngredient.stock_quantity <= 0
                      ? 'Out of Stock'
                      : selectedIngredient.stock_quantity <= selectedIngredient.low_stock_alert
                      ? 'Low Stock'
                      : 'In Stock'}
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-base">
                  <span className="text-zinc-600 font-medium">Available:</span>
                  <span className="text-zinc-900 font-extrabold tabular-nums">
                    {formatQuantity(selectedIngredient.stock_quantity, selectedIngredient.unit)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-zinc-500">Alert threshold:</span>
                  <span className="text-zinc-700 font-semibold tabular-nums">
                    {formatQuantity(selectedIngredient.low_stock_alert, selectedIngredient.unit)}
                  </span>
                </div>
              </div>
            )}

            {/* Quantity Input */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-zinc-800 uppercase tracking-wide">
                Quantity Wasted *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  name="quantity"
                  placeholder="e.g. 250"
                  value={formData.quantity}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 bg-zinc-50 hover:bg-white focus:bg-white border border-zinc-300 rounded-xl text-base text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all shadow-xs tabular-nums pr-16"
                />
                {selectedIngredient?.unit && (
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500 uppercase">
                    {selectedIngredient.unit}
                  </span>
                )}
              </div>
            </div>

            {/* Reason Selector */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-zinc-800 uppercase tracking-wide">
                Reason *
              </label>
              <select
                name="reason"
                value={formData.reason}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-zinc-50 hover:bg-white focus:bg-white border border-zinc-300 rounded-xl text-base text-zinc-900 font-medium focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all cursor-pointer shadow-xs"
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

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 px-6 bg-zinc-900 hover:bg-black text-white text-base font-bold rounded-xl shadow-sm hover:shadow transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Deducting Stock...' : 'Submit Wastage Report'}
            </button>
          </form>
        </div>

        {/* Right Column: Wastage History Table */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white border border-gray-200/90 rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 m-0">
                Wastage Log History
              </h2>
              <p className="text-sm text-zinc-500 font-medium mt-1 mb-0">
                Audit trail of ingredient deductions.
              </p>
            </div>

            {/* Filter Search Input */}
            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Search ingredient, reason..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-zinc-50 hover:bg-white focus:bg-white border border-zinc-300 rounded-xl text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="w-full">
            {loading ? (
              <div className="py-4">
                <TableSkeleton rows={6} cols={6} />
              </div>
            ) : filteredHistory.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-zinc-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200">
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                        Date & Time
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                        Ingredient
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-600 uppercase tracking-wider text-right">
                        Quantity
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                        Reason
                      </th>
                      <th className="px-5 py-3.5 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                        Reported By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {filteredHistory.map((record) => {
                      const reasonClass = REASON_COLORS[record.reason] || 'bg-zinc-100 text-zinc-800 border-zinc-200';
                      const formattedDate = new Intl.DateTimeFormat('en-PH', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: 'numeric',
                        hour12: true,
                        timeZone: 'Asia/Manila'
                      }).format(new Date(record.created_at));

                      return (
                        <tr key={record.id} className="hover:bg-zinc-50/70 transition-colors">
                          <td className="px-5 py-4 text-sm font-semibold text-zinc-600 tabular-nums">
                            {formattedDate}
                          </td>
                          <td className="px-5 py-4 text-base font-bold text-zinc-900">
                            {record.ingredients?.name || 'Unknown'}
                          </td>
                          <td className="px-5 py-4 text-base font-bold font-mono text-zinc-900 text-right tabular-nums">
                            {record.quantity}
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-zinc-600 uppercase">
                            {record.ingredients?.unit || '—'}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${reasonClass}`}>
                              {record.reason}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-sm font-semibold text-zinc-700">
                            {record.users?.name || record.users?.username || 'Staff'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-16 px-6 rounded-xl bg-zinc-50 border border-dashed border-zinc-300 flex flex-col items-center justify-center text-center">
                <h3 className="text-base font-bold text-zinc-800 m-0 mb-1">
                  No Wastage Records Found
                </h3>
                <p className="text-sm text-zinc-500 max-w-sm m-0">
                  {searchFilter
                    ? 'No matching incidents found for your search filter.'
                    : 'Any reported ingredient losses or spoilage will be cataloged here.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportWastage;
