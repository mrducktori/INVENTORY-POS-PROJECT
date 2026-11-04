import React, { useState, useEffect, useMemo } from 'react';
import { getDemandForecast, getIngredientDepletionForecast, getAIForecast } from '../../api/analyticsApi';
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

  // AI Stock Forecasting State (Adapted from classmate's AI_API_StockForecastingService)
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSelectedProduct, setAiSelectedProduct] = useState(null);
  const [aiTargetYear, setAiTargetYear] = useState(() => new Date().getFullYear());
  const [aiTargetMonth, setAiTargetMonth] = useState(() => new Date().getMonth() + 1);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

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

  const handleOpenAiForecast = (product) => {
    setAiSelectedProduct(product);
    setAiResult(null);
    setAiModalOpen(true);
    runAiForecast(product.id, aiTargetYear, aiTargetMonth);
  };

  const runAiForecast = async (productId, year, month) => {
    try {
      setAiLoading(true);
      const res = await getAIForecast({
        productId,
        year: parseInt(year, 10),
        month: parseInt(month, 10)
      });
      setAiResult(res);
    } catch (err) {
      console.error('Failed to run AI forecast:', err);
      showToast('error', 'Forecast Error: ' + (err.message || 'Server error'));
    } finally {
      setAiLoading(false);
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

  const _handleUpdatePoItemPrice = (index, value) => {
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
      return (
        <span className="inline-flex items-center gap-1.5 font-black text-red-800 bg-red-100 border border-red-300 px-3 py-1.5 rounded-lg text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          <span>Out of Stock</span>
        </span>
      );
    }
    if (days === null || days === undefined) {
      return <span className="text-gray-600 font-mono font-bold text-xs sm:text-sm">No Recent Sales</span>;
    }
    if (days <= 3) {
      return (
        <span className="inline-flex items-center gap-1.5 font-black text-red-800 bg-red-100 border border-red-300 px-3 py-1.5 rounded-lg text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
          <span>{days} {days === 1 ? 'day' : 'days'}</span>
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="inline-flex items-center gap-1.5 font-black text-amber-900 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg text-xs sm:text-sm">
          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          <span>{days} days</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-900 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs sm:text-sm">
        <svg className="w-4 h-4 text-emerald-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
        <span>{days} days</span>
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
          <span>
            {toast.type === 'error' ? (
              <svg className="w-4 h-4 text-rose-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </span>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-gray-400 hover:text-white p-0.5 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header & Sub-Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="m-0 text-2xl sm:text-3xl lg:text-4xl font-black text-gray-900 tracking-tight">Demand & Inventory Forecasting</h1>
            
          </div>
          <p className="m-0 text-sm sm:text-base text-gray-700 font-medium">
            Cross-references 30-day POS product recipe usage with real-time stock to forecast depletion and automate restock purchase orders.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex bg-gray-100 p-1.5 rounded-xl border border-gray-200 self-start md:self-auto">
          <button
            onClick={() => handleTabSwitch('ingredients')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide transition-all duration-150 cursor-pointer ${
              activeTab === 'ingredients'
                ? 'bg-white text-gray-950 shadow-sm'
                : 'text-gray-600 hover:text-gray-950'
            }`}
          >
            <span>Raw Materials Restock</span>
            {(ingredientData.summary.criticalCount > 0 || ingredientData.summary.lowStockCount > 0) && (
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-red-600 text-white">
                {ingredientData.summary.criticalCount + ingredientData.summary.lowStockCount}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabSwitch('products')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide transition-all duration-150 cursor-pointer ${
              activeTab === 'products'
                ? 'bg-white text-gray-950 shadow-sm'
                : 'text-gray-600 hover:text-gray-950'
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
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 sm:p-6 border-l-4 border-l-red-600 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">Critical Depletion (&lt; 3 Days)</span>
                <span className="p-2 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <div className="text-3xl sm:text-4xl font-black text-red-600 tracking-tight">
                  {loadingIngredients ? '...' : ingredientData.summary.criticalCount}
                </div>
                <p className="m-0 mt-1.5 text-xs sm:text-sm text-gray-700 font-semibold">Immediate reorder required</p>
              </div>
            </div>

            {/* Card 2: Low Stock */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 sm:p-6 border-l-4 border-l-amber-500 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">Low Stock (&lt; 7 Days)</span>
                <span className="p-2 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <div className="text-3xl sm:text-4xl font-black text-amber-700 tracking-tight">
                  {loadingIngredients ? '...' : ingredientData.summary.lowStockCount}
                </div>
                <p className="m-0 mt-1.5 text-xs sm:text-sm text-gray-700 font-semibold">Approaching reorder threshold</p>
              </div>
            </div>

            {/* Card 3: Restock Capital */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 sm:p-6 border-l-4 border-l-gray-900 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">Est. Restock Capital</span>
                <span className="w-8 h-8 bg-gray-100 text-gray-900 rounded-lg flex items-center justify-center text-sm font-black">₱</span>
              </div>
              <div className="mt-4">
                <div className="text-2xl sm:text-4xl font-black text-gray-900 tracking-tight">
                  {loadingIngredients ? '...' : formatCurrency(ingredientData.summary.totalRestockCapitalRequired)}
                </div>
                <p className="m-0 mt-1.5 text-xs sm:text-sm text-gray-700 font-semibold">Capital to buffer 14-day supply</p>
              </div>
            </div>

            {/* Card 4: Tracked Items */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 sm:p-6 border-l-4 border-l-emerald-600 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">Monitored Raw Materials</span>
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
              </div>
              <div className="mt-4">
                <div className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
                  {loadingIngredients ? '...' : ingredientData.summary.totalIngredients}
                </div>
                <p className="m-0 mt-1.5 text-xs sm:text-sm text-emerald-800 font-bold">
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
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Search material, supplier, category..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-black focus:border-black transition-all"
                />
              </div>

              {categories.length > 0 && (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-black font-bold"
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
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide border transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                All ({ingredientData.ingredients.length})
              </button>
              <button
                onClick={() => setStatusFilter('CRITICAL')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide border transition-colors cursor-pointer ${
                  statusFilter === 'CRITICAL'
                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                    : 'bg-white text-red-700 border-red-300 hover:bg-red-50'
                }`}
              >
                <svg className="w-4 h-4 shrink-0 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>Critical ({ingredientData.summary.criticalCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('LOW_STOCK')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide border transition-colors cursor-pointer ${
                  statusFilter === 'LOW_STOCK'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                    : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-50'
                }`}
              >
                <svg className="w-4 h-4 shrink-0 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Low Stock ({ingredientData.summary.lowStockCount})</span>
              </button>
              <button
                onClick={() => setStatusFilter('HEALTHY')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-extrabold uppercase tracking-wide border transition-colors cursor-pointer ${
                  statusFilter === 'HEALTHY'
                    ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                    : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50'
                }`}
              >
                <svg className="w-4 h-4 shrink-0 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span>Healthy ({ingredientData.summary.healthyCount})</span>
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 border-t lg:border-t-0 pt-3 lg:pt-0">
              {ingredientData.summary.criticalCount > 0 && (
                <button
                  onClick={handleSelectAllCritical}
                  className="px-3.5 py-2 bg-red-50 text-red-700 border border-red-300 hover:bg-red-100 rounded-lg text-xs sm:text-sm font-black tracking-wide transition-colors cursor-pointer"
                  title="Select all critical raw materials"
                >
                  Select Critical
                </button>
              )}

              {selectedIngredientIds.length > 0 && (
                <button
                  onClick={handleOpenBatchPO}
                  className="px-4 py-2 bg-black text-white hover:bg-gray-800 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wide shadow-sm flex items-center gap-2 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  <span>Create PO ({selectedIngredientIds.length})</span>
                </button>
              )}

              <button
                onClick={fetchIngredientForecast}
                disabled={loadingIngredients}
                className="p-2 border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                title="Refresh Depletion Calculations"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
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
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">
                        <th className="px-4 py-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIngredientIds.length > 0 && selectedIngredientIds.length === filteredIngredients.length}
                            onChange={handleToggleSelectAll}
                            className="rounded border-gray-300 text-black focus:ring-black cursor-pointer"
                          />
                        </th>
                        <th className="px-5 py-4">Raw Material</th>
                        <th className="px-4 py-4 text-right">Current Stock</th>
                        <th className="px-4 py-4 text-right">Daily Burn Rate</th>
                        <th className="px-4 py-4 text-center">Runout Forecast</th>
                        <th className="px-5 py-4">Restock Suggestion</th>
                        <th className="px-4 py-4">Preferred Supplier</th>
                        <th className="px-5 py-4 text-center">Action</th>
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
                                <span className="font-black text-base text-gray-900">{item.name}</span>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="inline-flex px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide bg-gray-100 text-gray-800 border border-gray-300">
                                    {item.category}
                                  </span>
                                  {item.conversion_factor > 1 && (
                                    <span className="text-xs text-gray-600 font-medium">
                                      (1 {item.purchase_unit} = {item.conversion_factor} {item.unit})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-black text-base text-gray-900">
                                  {Number(item.stock_quantity).toLocaleString()} <span className="text-xs sm:text-sm text-gray-700 font-semibold">{item.unit}</span>
                                </span>
                                <span className="text-xs text-gray-600 font-medium mt-0.5">
                                  Min alert: {item.low_stock_alert} {item.unit}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex flex-col items-end">
                                <span className="font-mono font-black text-base text-gray-900">
                                  {item.avg_daily_burn_rate > 0 ? `${item.avg_daily_burn_rate} ${item.unit}/day` : '0.00'}
                                </span>
                                <span className="text-xs text-gray-600 font-medium mt-0.5">30-day recipe average</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="flex flex-col items-center">
                                {formatDaysRemaining(item.days_remaining, item.urgency_status)}
                                {item.depletion_date && (
                                  <span className="text-xs text-gray-700 font-bold mt-1 font-mono">
                                    Depletes {item.depletion_date}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              {item.suggested_purchase_qty > 0 ? (
                                <div className="flex flex-col">
                                  <span className="font-black text-base text-gray-900">
                                    {item.suggested_purchase_qty} {item.purchase_unit}
                                    {item.conversion_factor > 1 && (
                                      <span className="text-xs text-gray-700 font-medium ml-1">
                                        ({(item.suggested_purchase_qty * item.conversion_factor).toLocaleString()} {item.unit})
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-xs sm:text-sm text-gray-800 font-bold mt-0.5">
                                    Est. {formatCurrency(item.estimated_restock_cost)}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs sm:text-sm font-extrabold text-emerald-900 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300">
                                  Adequate Stock
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-gray-900">
                                  {item.supplier_name}
                                </span>
                                {item.unit_price > 0 && (
                                  <span className="text-xs text-gray-700 font-semibold mt-0.5">
                                    {formatCurrency(item.unit_price)} / {item.purchase_unit}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <button
                                onClick={() => handleOpenSingleItemPO(item)}
                                className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs sm:text-sm font-black rounded-lg tracking-wider uppercase shadow-sm transition-all flex items-center gap-1.5 mx-auto cursor-pointer"
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
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <h2 className="m-0 text-sm sm:text-base font-black text-gray-900 uppercase tracking-wide">
                Ingredient Burn Rate & Depletion Methodology
              </h2>
              <span className="text-xs font-mono font-bold text-gray-600">Formula Specification</span>
            </div>
            <div className="p-6 text-sm text-gray-700 leading-relaxed grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-base font-black text-gray-900 mb-1.5">1. Recipe Deconstruction</div>
                Every completed POS order in the last 30 days is cross-referenced with your bill of materials (recipes), converting units (g, ml, pcs) into base ingredient usage.
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-base font-black text-gray-900 mb-1.5">2. Weighted Burn Velocity</div>
                Daily burn rates give 70% weight to recent 14-day velocity and 30% to monthly baseline, adapting quickly to sudden surges in drink demand.
              </div>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-base font-black text-gray-900 mb-1.5">3. Automated Supplier Units</div>
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
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 sm:p-6 border-t-4 border-t-blue-500">
              <div className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Forecast Confidence</div>
              <div className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">92%</div>
              <p className="m-0 text-xs sm:text-sm text-gray-700 font-semibold mt-1">Based on historical daily sales consistency</p>
            </div>
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 sm:p-6 border-t-4 border-t-green-500">
              <div className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide mb-2">High Growth Products</div>
              <div className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">
                {productForecasts.filter(f => parseFloat(f.growthRate) > 5).length} items
              </div>
              <p className="m-0 text-xs sm:text-sm text-gray-700 font-semibold mt-1">Growing faster than 5% week-over-week</p>
            </div>
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 sm:p-6 border-t-4 border-t-gray-900">
              <div className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide mb-2">Analysis Window</div>
              <div className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">30 Days Historical</div>
              <p className="m-0 text-xs sm:text-sm text-gray-700 font-semibold mt-1">Day-of-week cyclical modeling</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <div>
                <h2 className="m-0 text-lg sm:text-xl font-black text-gray-900 tracking-tight">Product Demand Forecast (Next 7 Days)</h2>
                <p className="m-0 text-sm text-gray-700 font-medium mt-1">Estimated customer orders across menu categories</p>
              </div>
              <button 
                className="px-5 py-2.5 bg-gray-900 text-white rounded-lg text-xs sm:text-sm font-black uppercase tracking-wide hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm cursor-pointer" 
                onClick={fetchProductForecasts} 
                disabled={loadingProducts}
              >
                {loadingProducts ? 'Calculating...' : 'Refresh Forecast'}
              </button>
            </div>
            <div className="p-0">
              {loadingProducts ? (
                <div className="p-16 flex flex-col items-center justify-center text-gray-500 bg-white">
                  <div className="w-9 h-9 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin mb-4"></div>
                  <p className="m-0 font-bold text-gray-800 text-base">Calculating demand projections from sales history...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">
                        <th className="px-6 py-4">Product</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4 text-right">In-Stock</th>
                        <th className="px-6 py-4 text-right">Daily Avg</th>
                        <th className="px-6 py-4 text-right">7-Day Forecast</th>
                        <th className="px-6 py-4">Growth</th>
                        <th className="px-6 py-4 min-w-[140px]">Confidence</th>
                        <th className="px-6 py-4 text-center">Stockout Risk</th>
                        <th className="px-6 py-4 text-center">Monthly Projection</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {productForecasts.map(item => (
                        <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="px-6 py-4 text-base font-black text-gray-900">{item.name}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide bg-gray-100 text-gray-800 border border-gray-300">
                              {item.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-base font-black font-mono text-zinc-950 text-right">
                            {item.currentStock ?? 0}
                          </td>
                          <td className="px-6 py-4 text-base font-black font-mono text-gray-900 text-right">{item.avgDailySales}</td>
                          <td className="px-6 py-4 text-base font-black font-mono text-blue-800 text-right">{item.predictedNext7Days} units</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1 font-black font-mono text-sm ${parseFloat(item.growthRate) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {parseFloat(item.growthRate) >= 0 ? '↑' : '↓'} {Math.abs(item.growthRate)}%
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${item.confidence >= 90 ? 'bg-green-600' : item.confidence >= 70 ? 'bg-blue-600' : 'bg-orange-600'}`} 
                                  style={{ width: `${item.confidence}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-extrabold text-gray-900 w-10 text-right">{item.confidence}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                              item.stockoutRisk === 'Low' ? 'bg-green-50 text-green-800 border-green-300' : item.stockoutRisk === 'Medium' ? 'bg-orange-50 text-orange-800 border-orange-300' : 'bg-red-50 text-red-800 border-red-300'
                            }`}>
                              {item.stockoutRisk}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              type="button"
                              onClick={() => handleOpenAiForecast(item)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs sm:text-sm font-black transition-all shadow-xs cursor-pointer"
                              title="Calculate monthly demand projection"
                            >
                              <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                <polyline points="17 6 23 6 23 12" />
                              </svg>
                              <span>Forecast</span>
                            </button>
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
                <h3 className="m-0 text-xl font-black tracking-tight">Generate Purchase Order</h3>
                <p className="m-0 text-sm text-gray-300 mt-1">Automated procurement from depletion analysis</p>
              </div>
              <button
                onClick={() => setPoModalOpen(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex flex-col gap-5 flex-1">
              {/* Supplier Selection & Expected Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-gray-800 mb-1.5">
                    Supplier <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={poTargetSupplierId}
                    onChange={(e) => setPoTargetSupplierId(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 font-bold focus:ring-2 focus:ring-black focus:outline-none"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-gray-800 mb-1.5">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poExpectedDate}
                    onChange={(e) => setPoExpectedDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 font-bold focus:ring-2 focus:ring-black focus:outline-none"
                  />
                </div>
              </div>

              {/* Items List Table */}
              <div>
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-gray-800 mb-2">
                  Materials to Reorder ({poItems.length})
                </label>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide">
                        <th className="px-4 py-3">Material</th>
                        <th className="px-4 py-3 w-36">Order Qty</th>
                        <th className="px-4 py-3 w-40">Unit Cost (₱)</th>
                        <th className="px-4 py-3 text-right w-36">Subtotal</th>
                        <th className="px-3 py-3 text-center w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {poItems.map((item, idx) => (
                        <tr key={item.ingredient_id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3.5">
                            <div className="font-black text-base text-gray-900">{item.name}</div>
                            <div className="text-xs text-gray-600 font-semibold mt-0.5">
                              Unit: {item.purchase_unit} ({item.conversion_factor} {item.unit})
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdatePoItemQty(idx, e.target.value)}
                                className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-base text-gray-900 font-black focus:ring-1 focus:ring-black"
                              />
                              <span className="text-xs sm:text-sm text-gray-700 font-bold">{item.purchase_unit}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-gray-700 font-black">₱</span>
                              <input
                                type="text"
                                value={Number(item.unit_price || 0).toFixed(2)}
                                readOnly
                                tabIndex="-1"
                                className="w-24 px-2.5 py-1.5 border border-gray-200 bg-gray-100 text-gray-800 rounded-lg text-base font-black font-mono cursor-not-allowed select-none focus:outline-none"
                                title="Unit cost is fixed from the supplier catalog and cannot be edited"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-black font-mono text-base text-gray-950">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            {poItems.length > 1 && (
                              <button
                                onClick={() => handleRemovePoItem(idx)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                title="Remove item"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
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
                <label className="block text-xs sm:text-sm font-black uppercase tracking-wide text-gray-800 mb-1.5">
                  Order Notes / Instructions
                </label>
                <textarea
                  rows="2"
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  placeholder="Special instructions for the supplier..."
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm sm:text-base text-gray-900 focus:ring-2 focus:ring-black focus:outline-none"
                ></textarea>
              </div>

              {/* Grand Total Bar */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs sm:text-sm font-black text-gray-700 uppercase tracking-wide block">Estimated Total PO Amount</span>
                  <span className="text-xs sm:text-sm text-gray-600 font-semibold">Excludes supplier delivery/freight fees</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-gray-950 font-mono">
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
                className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitPO}
                disabled={submittingPO || poItems.length === 0}
                className="px-6 py-2.5 bg-black hover:bg-gray-800 text-white rounded-lg text-xs sm:text-sm font-black uppercase tracking-wide shadow-sm disabled:opacity-50 flex items-center gap-2 transition-all cursor-pointer"
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

      {/* AI MONTHLY STOCK FORECAST MODAL */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-zinc-950 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="m-0 text-lg font-black text-white tracking-tight">Demand & Stock Forecast</h3>
                  <p className="m-0 text-xs sm:text-sm text-zinc-300 mt-0.5">
                    Time-series projection and inventory reorder planning
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer transition-colors"
                title="Close"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Target Selectors Bar */}
            <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-black uppercase tracking-wide text-zinc-500 block">Product</span>
                <span className="text-base font-black text-zinc-950">{aiSelectedProduct?.name || 'Selected Item'}</span>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={aiTargetMonth}
                  onChange={(e) => setAiTargetMonth(parseInt(e.target.value, 10))}
                  className="px-3 py-2 text-xs sm:text-sm font-bold border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-black"
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].map((mName, idx) => (
                    <option key={idx + 1} value={idx + 1}>{mName}</option>
                  ))}
                </select>

                <select
                  value={aiTargetYear}
                  onChange={(e) => setAiTargetYear(parseInt(e.target.value, 10))}
                  className="px-3 py-2 text-xs sm:text-sm font-bold border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-1 focus:ring-black"
                >
                  {[2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => runAiForecast(aiSelectedProduct?.id, aiTargetYear, aiTargetMonth)}
                  disabled={aiLoading}
                  className="px-3.5 py-2 bg-zinc-900 hover:bg-black text-white text-xs sm:text-sm font-bold rounded-lg transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>{aiLoading ? 'Calculating...' : 'Recalculate'}</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {aiLoading ? (
                <div className="py-14 flex flex-col items-center justify-center text-center">
                  <div className="w-8 h-8 border-3 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mb-3"></div>
                  <p className="text-sm font-bold text-zinc-700 m-0">Generating monthly demand projection...</p>
                </div>
              ) : aiResult ? (
                <>
                  {/* Model Engine Tag */}
                  <div className="flex items-center justify-between text-xs sm:text-sm pb-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-zinc-800 bg-zinc-100 border border-zinc-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Demand Trend Model</span>
                    </span>
                    <span className="text-zinc-600 font-medium">
                      Confidence: <span className="font-black text-zinc-950">{aiResult.confidenceScore || 85}%</span>
                    </span>
                  </div>

                  {/* 3 Core Output Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-center">
                      <div className="text-xs font-black uppercase tracking-wide text-zinc-500 mb-1">
                        Projected Demand
                      </div>
                      <div className="text-3xl font-black text-zinc-950 tabular-nums">
                        {aiResult.predictedUnitsSold || 0}
                      </div>
                      <div className="text-xs font-semibold text-zinc-600 mt-1">Units this month</div>
                    </div>

                    <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-center">
                      <div className="text-xs font-black uppercase tracking-wide text-zinc-500 mb-1">
                        Current On-Hand
                      </div>
                      <div className="text-3xl font-black text-zinc-950 tabular-nums">
                        {aiResult.currentStock || 0}
                      </div>
                      <div className="text-xs font-semibold text-zinc-600 mt-1">Available units</div>
                    </div>

                    <div className={`border rounded-xl p-4 text-center ${
                      (aiResult.recommendedOrderQuantity || 0) > 0
                        ? 'bg-amber-50/80 border-amber-300'
                        : 'bg-emerald-50/80 border-emerald-300'
                    }`}>
                      <div className="text-xs font-black uppercase tracking-wide text-zinc-600 mb-1">
                        Suggested Reorder
                      </div>
                      <div className="text-3xl font-black text-zinc-950 tabular-nums">
                        {aiResult.recommendedOrderQuantity || 0}
                      </div>
                      <div className={`text-xs font-black mt-1 ${
                        (aiResult.recommendedOrderQuantity || 0) > 0 ? 'text-amber-800' : 'text-emerald-800'
                      }`}>
                        {(aiResult.recommendedOrderQuantity || 0) > 0 ? 'Reorder Needed' : 'Stock Sufficient'}
                      </div>
                    </div>
                  </div>

                  {/* Calendar Influencing Factors */}
                  <div>
                    <div className="text-xs sm:text-sm font-black uppercase tracking-wide text-zinc-700 mb-2">
                      Demand Drivers
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                        <div className="text-xs font-bold text-zinc-500 uppercase">Weekend Surge</div>
                        <div className="text-base font-black text-zinc-950 mt-1">
                          {aiResult.factors?.weekendMultiplier ? `${aiResult.factors.weekendMultiplier}x` : '1.0x'}
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                        <div className="text-xs font-bold text-zinc-500 uppercase">Payday Lift</div>
                        <div className="text-base font-black text-zinc-950 mt-1">
                          {aiResult.factors?.paydayMultiplier ? `${aiResult.factors.paydayMultiplier}x` : '1.0x'}
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                        <div className="text-xs font-bold text-zinc-500 uppercase">Holidays</div>
                        <div className="text-base font-black text-zinc-950 mt-1">
                          {aiResult.factors?.holidaySurgeDays ?? 0}
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-center">
                        <div className="text-xs font-bold text-zinc-500 uppercase">Weekly Velocity</div>
                        <div className="text-base font-black text-zinc-950 mt-1">
                          {aiResult.factors?.unitsSoldGrowth7Days ? `${aiResult.factors.unitsSoldGrowth7Days}%` : '0.0%'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analysis Summary */}
                  {aiResult.reasoning && (
                    <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl">
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-zinc-800 mb-1.5">
                        <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="16" x2="12" y2="12" />
                          <line x1="12" y1="8" x2="12.01" y2="8" />
                        </svg>
                        <span>Analysis Summary</span>
                      </div>
                      <p className="text-sm text-zinc-700 leading-relaxed m-0 font-normal">
                        {aiResult.reasoning}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-sm font-medium text-zinc-500">
                  Select month and click Recalculate to generate forecast.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-200 flex justify-end">
              <button
                type="button"
                onClick={() => setAiModalOpen(false)}
                className="px-5 py-2 border border-zinc-300 rounded-lg text-xs sm:text-sm font-bold text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemandForecasting;

