import React, { useState, useEffect, useMemo } from 'react';
import { getDemandForecast, getIngredientDepletionForecast } from '../../api/analyticsApi';
import { getSuppliers, createPurchaseOrder } from '../../api/purchasingApi';

const DemandForecasting = () => {
  const [activeTab, setActiveTab] = useState('ingredients'); // 'ingredients' | 'products'
  
  // Ingredient Depletion State
  const [ingredientData, setIngredientData] = useState({
    summary: {
      totalIngredients: 0,
      criticalCount: 0,
      lowStockCount: 0,
      healthyCount: 0,
      totalRestockCapitalRequired: 0
    },
    ingredients: []
  });
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'LOW_STOCK' | 'HEALTHY'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);

  // Product Demand State
  const [productForecasts, setProductForecasts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Suppliers & PO Modal State
  const [suppliers, setSuppliers] = useState([]);
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poTargetSupplierId, setPoTargetSupplierId] = useState('');
  const [poItems, setPoItems] = useState([]); // [{ ingredient_id, name, quantity, unit_price, purchase_unit, conversion_factor }]
  const [poExpectedDate, setPoExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [poNotes, setPoNotes] = useState('');
  const [submittingPO, setSubmittingPO] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success' | 'error', message: string }

  // Load initial data
  useEffect(() => {
    fetchIngredientForecast();
    fetchSuppliersList();
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  const fetchIngredientForecast = async () => {
    try {
      setLoadingIngredients(true);
      const res = await getIngredientDepletionForecast();
      if (res && res.ingredients) {
        setIngredientData(res);
      }
    } catch (err) {
      console.error('Failed to fetch ingredient forecast:', err);
      showToast('error', 'Failed to calculate ingredient depletion. Please try again.');
    } finally {
      setLoadingIngredients(false);
    }
  };

  const fetchSuppliersList = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  };

  const fetchProductForecasts = async () => {
    try {
      setLoadingProducts(true);
      const data = await getDemandForecast();
      setProductForecasts(data || []);
    } catch (err) {
      console.error('Failed to fetch product forecasts:', err);
      showToast('error', 'Failed to load product demand forecasts.');
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    if (tab === 'products' && productForecasts.length === 0) {
      fetchProductForecasts();
    }
  };

  // Categories for filtering
  const categories = useMemo(() => {
    const set = new Set();
    ingredientData.ingredients.forEach(item => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [ingredientData.ingredients]);

  // Filtered ingredients
  const filteredIngredients = useMemo(() => {
    return ingredientData.ingredients.filter(item => {
      // Status filter
      if (statusFilter === 'CRITICAL' && item.urgency_status !== 'CRITICAL' && item.urgency_status !== 'OUT_OF_STOCK') {
        return false;
      }
      if (statusFilter === 'LOW_STOCK' && item.urgency_status !== 'LOW_STOCK') {
        return false;
      }
      if (statusFilter === 'HEALTHY' && item.urgency_status !== 'HEALTHY') {
        return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchCategory = item.category?.toLowerCase().includes(query);
        const matchSupplier = item.supplier_name?.toLowerCase().includes(query);
        if (!matchName && !matchCategory && !matchSupplier) return false;
      }

      return true;
    });
  }, [ingredientData.ingredients, statusFilter, selectedCategory, searchTerm]);

  // Checkbox selection helpers
  const handleToggleSelectAll = () => {
    if (selectedIngredientIds.length === filteredIngredients.length) {
      setSelectedIngredientIds([]);
    } else {
      setSelectedIngredientIds(filteredIngredients.map(item => item.id));
    }
  };

  const handleToggleItemSelect = (id) => {
    setSelectedIngredientIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllCritical = () => {
    const criticalIds = ingredientData.ingredients
      .filter(item => item.urgency_status === 'CRITICAL' || item.urgency_status === 'OUT_OF_STOCK')
      .map(item => item.id);
    setSelectedIngredientIds(criticalIds);
    showToast('success', `Selected ${criticalIds.length} critical raw materials.`);
  };

  // Open PO modal for a single item
  const handleOpenSingleItemPO = (item) => {
    const defaultQty = item.suggested_purchase_qty > 0 ? item.suggested_purchase_qty : 1;
    const defaultPrice = item.unit_price > 0 ? item.unit_price : 0;
    
    setPoTargetSupplierId(item.supplier_id ? String(item.supplier_id) : (suppliers[0]?.id ? String(suppliers[0].id) : ''));
    setPoItems([{
      ingredient_id: item.id,
      name: item.name,
      quantity: defaultQty,
      unit_price: defaultPrice,
      purchase_unit: item.purchase_unit || item.unit,
      conversion_factor: item.conversion_factor || 1,
      stock_quantity: item.stock_quantity,
      unit: item.unit
    }]);
    setPoNotes(`Automated reorder from Depletion Forecast. Current stock: ${item.stock_quantity} ${item.unit}.`);
    setPoModalOpen(true);
  };

  // Open PO modal for batch selected items
  const handleOpenBatchPO = () => {
    if (selectedIngredientIds.length === 0) return;
    const selectedItems = ingredientData.ingredients.filter(item => selectedIngredientIds.includes(item.id));
    
    // Check primary supplier
    const firstSupplierId = selectedItems.find(i => i.supplier_id)?.supplier_id;
    setPoTargetSupplierId(firstSupplierId ? String(firstSupplierId) : (suppliers[0]?.id ? String(suppliers[0].id) : ''));

    const itemsForPO = selectedItems.map(item => ({
      ingredient_id: item.id,
      name: item.name,
      quantity: item.suggested_purchase_qty > 0 ? item.suggested_purchase_qty : 1,
      unit_price: item.unit_price || 0,
      purchase_unit: item.purchase_unit || item.unit,
      conversion_factor: item.conversion_factor || 1,
      stock_quantity: item.stock_quantity,
      unit: item.unit,
      original_supplier_id: item.supplier_id
    }));

    setPoItems(itemsForPO);
    setPoNotes(`Batch Restock Order (${selectedItems.length} materials) generated from Depletion Forecast.`);
    setPoModalOpen(true);
  };

  // PO Item update handlers in modal
  const handleUpdatePoItemQty = (index, value) => {
    const val = Math.max(1, parseInt(value, 10) || 1);
    setPoItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: val };
      return copy;
    });
  };

  const handleUpdatePoItemPrice = (index, value) => {
    const val = Math.max(0, parseFloat(value) || 0);
    setPoItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], unit_price: val };
      return copy;
    });
  };

  const handleRemovePoItem = (index) => {
    setPoItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const calculatePoTotal = () => {
    return poItems.reduce((acc, curr) => acc + (curr.quantity * curr.unit_price), 0);
  };

  // Submit Purchase Order to Backend
  const handleConfirmSubmitPO = async () => {
    if (!poTargetSupplierId) {
      showToast('error', 'Please choose a target supplier for this Purchase Order.');
      return;
    }
    if (poItems.length === 0) {
      showToast('error', 'Purchase order must have at least one raw material item.');
      return;
    }

    try {
      setSubmittingPO(true);
      const payload = {
        supplier_id: poTargetSupplierId,
        expected_date: poExpectedDate || null,
        notes: poNotes,
        items: poItems.map(item => ({
          ingredient_id: item.ingredient_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          purchase_unit: item.purchase_unit,
          conversion_factor: item.conversion_factor
        }))
      };

      await createPurchaseOrder(payload);
      showToast('success', `Purchase order successfully generated for ${poItems.length} items!`);
      setPoModalOpen(false);
      setSelectedIngredientIds([]);
      // Refresh forecast to update recommendation statuses
      fetchIngredientForecast();
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      showToast('error', err.message || 'Failed to create purchase order.');
    } finally {
      setSubmittingPO(false);
    }
  };

  const formatCurrency = (val) => {
    return `₱${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDaysRemaining = (days, urgency) => {
    if (urgency === 'OUT_OF_STOCK' || days === 0) {
      return <span className="inline-flex items-center gap-1 font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded text-xs">Out of Stock</span>;
    }
    if (days === null || days === undefined) {
      return <span className="text-gray-400 font-mono text-xs">No Recent Sales</span>;
    }
    if (days <= 3) {
      return (
        <span className="inline-flex items-center gap-1 font-extrabold text-red-700 bg-red-100/80 border border-red-300 px-2.5 py-1 rounded text-xs animate-pulse">
          ⚡ {days} {days === 1 ? 'day' : 'days'}
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded text-xs">
          ⚠️ {days} days
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded text-xs">
        ✓ {days} days
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-[1600px] mx-auto w-full">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border text-sm font-semibold transition-all duration-300 animate-in fade-in slide-in-from-top-3 ${
          toast.type === 'error' ? 'bg-red-900 text-white border-red-700' : 'bg-gray-900 text-white border-gray-700'
        }`}>
          <span>{toast.type === 'error' ? '❌' : '✅'}</span>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-gray-400 hover:text-white font-mono text-xs">✕</button>
        </div>
      )}

      {/* Header & Sub-Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="m-0 text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Demand & Inventory Forecasting</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-black text-white">
              AI Predictive
            </span>
          </div>
          <p className="m-0 text-sm text-gray-500 font-medium">
            Cross-references 30-day POS product recipe usage with real-time stock to forecast depletion and automate restock purchase orders.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex bg-gray-100 p-1.5 rounded-xl border border-gray-200 self-start md:self-auto">
          <button
            onClick={() => handleTabSwitch('ingredients')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
              activeTab === 'ingredients'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Raw Materials Restock</span>
            {(ingredientData.summary.criticalCount > 0 || ingredientData.summary.lowStockCount > 0) && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-red-600 text-white">
                {ingredientData.summary.criticalCount + ingredientData.summary.lowStockCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabSwitch('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-150 ${
              activeTab === 'products'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Product Sales Demand (7D)</span>
          </button>
        </div>
      </div>

      {/* TAB 1: INGREDIENT DEPLETION & RESTOCK FORECAST */}
      {activeTab === 'ingredients' && (
        <div className="flex flex-col gap-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Card 1: Critical */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-l-4 border-l-red-600 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Critical Depletion (&lt; 3 Days)</span>
                <span className="p-1.5 bg-red-50 text-red-600 rounded-lg text-sm">🚨</span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-red-600 tracking-tight">
                  {loadingIngredients ? '...' : ingredientData.summary.criticalCount}
                </div>
                <p className="m-0 mt-1 text-xs text-gray-500 font-medium">Immediate reorder required</p>
              </div>
            </div>

            {/* Card 2: Low Stock */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-l-4 border-l-amber-500 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Low Stock (&lt; 7 Days)</span>
                <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg text-sm">⚠️</span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-amber-700 tracking-tight">
                  {loadingIngredients ? '...' : ingredientData.summary.lowStockCount}
                </div>
                <p className="m-0 mt-1 text-xs text-gray-500 font-medium">Approaching reorder threshold</p>
              </div>
            </div>

            {/* Card 3: Restock Capital */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-l-4 border-l-gray-900 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Est. Restock Capital</span>
                <span className="p-1.5 bg-gray-100 text-gray-900 rounded-lg text-sm">₱</span>
              </div>
              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                  {loadingIngredients ? '...' : formatCurrency(ingredientData.summary.totalRestockCapitalRequired)}
                </div>
                <p className="m-0 mt-1 text-xs text-gray-500 font-medium">Capital to buffer 14-day supply</p>
              </div>
            </div>

            {/* Card 4: Tracked Items */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-l-4 border-l-emerald-600 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Monitored Raw Materials</span>
                <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-sm">📦</span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  {loadingIngredients ? '...' : ingredientData.summary.totalIngredients}
                </div>
                <p className="m-0 mt-1 text-xs text-emerald-700 font-semibold">
                  {ingredientData.summary.healthyCount} items in healthy stock
                </p>
              </div>
            </div>
          </div>

          {/* Table Controls / Filters */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search & Category */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search material, supplier, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                />
              </div>

              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-black font-medium"
                >
                  <option value="ALL">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                All ({ingredientData.ingredients.length})
              </button>
              <button
                onClick={() => setStatusFilter('CRITICAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                  statusFilter === 'CRITICAL'
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                }`}
              >
                🚨 Critical ({ingredientData.summary.criticalCount})
              </button>
              <button
                onClick={() => setStatusFilter('LOW_STOCK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                  statusFilter === 'LOW_STOCK'
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                }`}
              >
                ⚠️ Low Stock ({ingredientData.summary.lowStockCount})
              </button>
              <button
                onClick={() => setStatusFilter('HEALTHY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-colors ${
                  statusFilter === 'HEALTHY'
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                }`}
              >
                Healthy ({ingredientData.summary.healthyCount})
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0">
              {ingredientData.summary.criticalCount > 0 && (
                <button
                  onClick={handleSelectAllCritical}
                  className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-lg text-xs font-bold tracking-wider transition-colors"
                  title="Select all critical raw materials"
                >
                  Select Critical
                </button>
              )}

              {selectedIngredientIds.length > 0 && (
                <button
                  onClick={handleOpenBatchPO}
                  className="px-4 py-2 bg-black text-white hover:bg-gray-800 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <span>🛒 Create PO ({selectedIngredientIds.length})</span>
                </button>
              )}

              <button
                onClick={fetchIngredientForecast}
                disabled={loadingIngredients}
                className="p-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                title="Refresh Depletion Calculations"
              >
                🔄
              </button>
            </div>
          </div>

          {/* Depletion Table */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="p-0">
              {loadingIngredients ? (
                <div className="p-16 flex flex-col items-center justify-center text-gray-500 bg-white">
                  <div className="w-9 h-9 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
                  <p className="m-0 font-bold text-gray-800">Calculating raw material burn rates from 30-day sales recipes...</p>
                  <p className="m-0 text-xs text-gray-400 mt-1">Cross-referencing POS transactions with bill of materials</p>
                </div>
              ) : filteredIngredients.length === 0 ? (
                <div className="p-12 text-center text-gray-500 bg-white">
                  <p className="text-lg font-bold text-gray-700">No raw materials match your filter criteria.</p>
                  <button
                    onClick={() => { setStatusFilter('ALL'); setSearchTerm(''); setSelectedCategory('ALL'); }}
                    className="mt-3 px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIngredientIds.length > 0 && selectedIngredientIds.length === filteredIngredients.length}
                            onChange={handleToggleSelectAll}
                            className="rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                          />
                        </th>
                        <th className="px-5 py-3.5">Raw Material</th>
                        <th className="px-4 py-3.5 text-right">Current Stock</th>
                        <th className="px-4 py-3.5 text-right">Daily Burn Rate</th>
                        <th className="px-4 py-3.5 text-center">Runout Forecast</th>
                        <th className="px-5 py-3.5">Restock Suggestion</th>
                        <th className="px-4 py-3.5">Preferred Supplier</th>
                        <th className="px-5 py-3.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredIngredients.map(item => {
                        const isSelected = selectedIngredientIds.includes(item.id);
                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${isSelected ? 'bg-amber-50/40' : 'hover:bg-gray-50/60'}`}
                          >
                            <td className="px-4 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleItemSelect(item.id)}
                                className="rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                              />
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-sm text-gray-900">{item.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                                    {item.category}
                                  </span>
                                  {item.conversion_factor > 1 && (
                                    <span className="text-[11px] text-gray-400">
                                      (1 {item.purchase_unit} = {item.conversion_factor} {item.unit})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-extrabold text-sm text-gray-900">
                                  {Number(item.stock_quantity).toLocaleString()} <span className="text-xs text-gray-500 font-normal">{item.unit}</span>
                                </span>
                                <span className="text-[11px] text-gray-400">
                                  Min alert: {item.low_stock_alert} {item.unit}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-bold text-sm text-gray-800">
                                  {item.avg_daily_burn_rate > 0 ? `${item.avg_daily_burn_rate} ${item.unit}/day` : '0.00'}
                                </span>
                                <span className="text-[11px] text-gray-400">30-day recipe average</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex flex-col items-center">
                                {formatDaysRemaining(item.days_remaining, item.urgency_status)}
                                {item.depletion_date && (
                                  <span className="text-[10px] text-gray-500 mt-1 font-mono">
                                    Depletes {item.depletion_date}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {item.suggested_purchase_qty > 0 ? (
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-sm text-gray-900">
                                    {item.suggested_purchase_qty} {item.purchase_unit}
                                    {item.conversion_factor > 1 && (
                                      <span className="text-xs text-gray-500 font-normal ml-1">
                                        ({(item.suggested_purchase_qty * item.conversion_factor).toLocaleString()} {item.unit})
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs text-gray-600 font-semibold mt-0.5">
                                    Est. {formatCurrency(item.estimated_restock_cost)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  Adequate Stock
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-gray-800">
                                  {item.supplier_name}
                                </span>
                                {item.unit_price > 0 && (
                                  <span className="text-[11px] text-gray-500">
                                    {formatCurrency(item.unit_price)} / {item.purchase_unit}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => handleOpenSingleItemPO(item)}
                                className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-lg tracking-wider uppercase shadow-sm transition-all flex items-center gap-1 mx-auto"
                              >
                                <span>+ Order</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Forecasting Methodology Explainer Card */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="m-0 text-sm font-bold text-gray-900 uppercase tracking-wider">
                Ingredient Burn Rate & Depletion Methodology
              </h2>
              <span className="text-xs font-mono text-gray-400">Formula Specification</span>
            </div>
            <div className="p-5 text-xs text-gray-600 leading-relaxed grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="font-extrabold text-gray-900 mb-1">1. Recipe Deconstruction</div>
                Every completed POS order in the last 30 days is cross-referenced with your bill of materials (recipes), converting units (g, ml, pcs) into base ingredient usage.
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="font-extrabold text-gray-900 mb-1">2. Weighted Burn Velocity</div>
                Daily burn rates give 70% weight to recent 14-day velocity and 30% to monthly baseline, adapting quickly to sudden surges in drink demand.
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="font-extrabold text-gray-900 mb-1">3. Automated Supplier Units</div>
                Reorder quantities are automatically converted into whole supplier purchase units (Bags, Cases, Packs) targeting a safe 14-day buffer.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCT DEMAND PREDICTIONS (7-DAY SALES) */}
      {activeTab === 'products' && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-blue-500">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Forecast Confidence</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">92%</div>
              <p className="m-0 text-xs text-gray-500">Based on historical daily sales consistency</p>
            </div>
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-green-500">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">High Growth Products</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">
                {productForecasts.filter(f => parseFloat(f.growthRate) > 5).length} items
              </div>
              <p className="m-0 text-xs text-gray-500">Growing faster than 5% week-over-week</p>
            </div>
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 border-t-4 border-t-gray-900">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Analysis Window</div>
              <div className="text-2xl font-extrabold text-gray-900 mb-1">30 Days Historical</div>
              <p className="m-0 text-xs text-gray-500">Day-of-week cyclical modeling</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h2 className="m-0 text-lg font-bold text-gray-900 tracking-tight">Product Demand Predictions (Next 7 Days)</h2>
                <p className="m-0 text-xs text-gray-500 mt-0.5">Estimated customer orders across menu categories</p>
              </div>
              <button 
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm" 
                onClick={fetchProductForecasts} 
                disabled={loadingProducts}
              >
                {loadingProducts ? 'Analyzing...' : 'Refresh Predictions'}
              </button>
            </div>
            <div className="p-0">
              {loadingProducts ? (
                <div className="p-12 flex flex-col items-center justify-center text-gray-500 bg-white">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4"></div>
                  <p className="m-0 font-medium">Generating menu predictions using historical sales data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Daily Avg</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">7-Day Forecast</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Growth</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[150px]">Confidence</th>
                        <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Stockout Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {productForecasts.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{item.name}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 border border-gray-200">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-bold font-mono text-gray-900 text-right">{item.avgDailySales}</td>
                          <td className="px-6 py-4 text-sm font-extrabold font-mono text-blue-700 text-right">{item.predictedNext7Days} units</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 font-bold font-mono text-xs ${parseFloat(item.growthRate) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {parseFloat(item.growthRate) >= 0 ? '↑' : '↓'} {Math.abs(item.growthRate)}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${item.confidence >= 90 ? 'bg-green-500' : item.confidence >= 70 ? 'bg-blue-500' : 'bg-orange-500'}`} 
                                  style={{ width: `${item.confidence}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-gray-600 w-8 text-right">{item.confidence}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              item.stockoutRisk === 'Low' ? 'bg-green-50 text-green-700 border-green-200' : item.stockoutRisk === 'Medium' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-700 border-red-200'
                            }`}>
                              {item.stockoutRisk}
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
      )}

      {/* ONE-CLICK PURCHASE ORDER MODAL */}
      {poModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gray-900 text-white flex items-center justify-between">
              <div>
                <h3 className="m-0 text-lg font-extrabold tracking-tight">Generate Purchase Order</h3>
                <p className="m-0 text-xs text-gray-400 mt-0.5">Automated procurement from predictive depletion analysis</p>
              </div>
              <button
                onClick={() => setPoModalOpen(false)}
                className="text-gray-400 hover:text-white text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5 flex-1">
              {/* Supplier Selection & Expected Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={poTargetSupplierId}
                    onChange={(e) => setPoTargetSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 font-medium focus:ring-2 focus:ring-black focus:outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-black focus:outline-none"
                  />
                </div>
              </div>

              {/* Items List Table */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Materials to Reorder ({poItems.length})
                </label>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-2.5">Material</th>
                        <th className="px-4 py-2.5 w-32">Order Qty</th>
                        <th className="px-4 py-2.5 w-36">Unit Cost (₱)</th>
                        <th className="px-4 py-2.5 text-right w-32">Subtotal</th>
                        <th className="px-3 py-2.5 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {poItems.map((item, idx) => (
                        <tr key={item.ingredient_id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-400">
                              Unit: {item.purchase_unit} ({item.conversion_factor} {item.unit})
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdatePoItemQty(idx, e.target.value)}
                                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 font-bold focus:ring-1 focus:ring-black"
                              />
                              <span className="text-xs text-gray-500">{item.purchase_unit}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => handleUpdatePoItemPrice(idx, e.target.value)}
                              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900 font-mono focus:ring-1 focus:ring-black"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold font-mono text-gray-900">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {poItems.length > 1 && (
                              <button
                                onClick={() => handleRemovePoItem(idx)}
                                className="text-red-500 hover:text-red-700 font-bold text-xs"
                                title="Remove item"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Order Notes / Instructions
                </label>
                <textarea
                  rows="2"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Special instructions for the supplier..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-black focus:outline-none"
                ></textarea>
              </div>

              {/* Grand Total Bar */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Estimated Total PO Amount</span>
                  <span className="text-xs text-gray-400">Excludes supplier delivery/freight fees</span>
                </div>
                <div className="text-2xl font-extrabold text-gray-900 font-mono">
                  {formatCurrency(calculatePoTotal())}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPoModalOpen(false)}
                disabled={submittingPO}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitPO}
                disabled={submittingPO || poItems.length === 0}
                className="px-5 py-2 bg-black hover:bg-gray-800 text-white rounded-lg text-sm font-bold uppercase tracking-wider shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all"
              >
                {submittingPO ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                    <span>Generating PO...</span>
                  </>
                ) : (
                  <span>Confirm & Generate PO</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemandForecasting;

