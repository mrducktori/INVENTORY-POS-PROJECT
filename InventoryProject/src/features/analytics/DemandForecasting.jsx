import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getDemandForecast, getIngredientDepletionForecast, getAIForecast } from '../../api/analyticsApi';
import { getSuppliers, createPurchaseOrder } from '../../api/purchasingApi';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';

const DemandForecasting = () => {
  const [activeTab, setActiveTab] = useState('ingredients'); // 'ingredients' | 'products'

  // Ingredient Depletion State
  const [ingredientData, setIngredientData] = useState({
    summary: {
      totalIngredients: 0,
      criticalCount: 0,
      lowStockCount: 0,
      healthyCount: 0,
      totalRestockCapitalRequired: 0,
    },
    ingredients: [],
  });
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'LOW_STOCK' | 'HEALTHY'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedIngredientIds, setSelectedIngredientIds] = useState([]);
  const [ingPage, setIngPage] = useState(1);
  const ING_PAGE_SIZE = 15;

  // Product Demand State
  const [productForecasts, setProductForecasts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('ALL');
  const [prodPage, setProdPage] = useState(1);
  const PROD_PAGE_SIZE = 15;

  // Monthly Projection Modal State
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
  const [poItems, setPoItems] = useState([]);
  const [poExpectedDate, setPoExpectedDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  });
  const [poNotes, setPoNotes] = useState('');
  const [submittingPO, setSubmittingPO] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchIngredientForecast();
    fetchSuppliersList();
  }, []);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
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
      showToast('error', 'Failed to load ingredient forecast.');
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
      showToast('error', 'Failed to load product demand forecast.');
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

  const handleOpenMonthlyModal = (product) => {
    setAiSelectedProduct(product);
    setAiResult(null);
    setAiModalOpen(true);
    runMonthlyForecast(product.id, aiTargetYear, aiTargetMonth);
  };

  const runMonthlyForecast = async (productId, year, month) => {
    try {
      setAiLoading(true);
      const res = await getAIForecast({
        productId,
        year: parseInt(year, 10),
        month: parseInt(month, 10),
      });
      setAiResult(res);
    } catch (err) {
      console.error('Failed to run monthly forecast:', err);
      showToast('error', err.message || 'Could not load monthly projection.');
    } finally {
      setAiLoading(false);
    }
  };

  // Ingredient Categories
  const categories = useMemo(() => {
    const set = new Set();
    ingredientData.ingredients.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [ingredientData.ingredients]);

  // Filtered Ingredients
  const filteredIngredients = useMemo(() => {
    return ingredientData.ingredients.filter((item) => {
      if (statusFilter === 'CRITICAL' && item.urgency_status !== 'CRITICAL' && item.urgency_status !== 'OUT_OF_STOCK') {
        return false;
      }
      if (statusFilter === 'LOW_STOCK' && item.urgency_status !== 'LOW_STOCK') {
        return false;
      }
      if (statusFilter === 'HEALTHY' && item.urgency_status !== 'HEALTHY') {
        return false;
      }
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchSup = item.supplier_name?.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchSup) return false;
      }
      return true;
    });
  }, [ingredientData.ingredients, statusFilter, selectedCategory, searchTerm]);

  // Reset ingredient pagination when filter changes
  useEffect(() => {
    setIngPage(1);
  }, [statusFilter, selectedCategory, searchTerm]);

  const paginatedIngredients = useMemo(() => {
    const start = (ingPage - 1) * ING_PAGE_SIZE;
    return filteredIngredients.slice(start, start + ING_PAGE_SIZE);
  }, [filteredIngredients, ingPage]);

  // Product Categories & Filtering
  const productCategories = useMemo(() => {
    const set = new Set();
    productForecasts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [productForecasts]);

  const filteredProducts = useMemo(() => {
    return productForecasts.filter((item) => {
      if (productCategory !== 'ALL' && item.category !== productCategory) return false;
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        if (!item.name?.toLowerCase().includes(q) && !item.category?.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [productForecasts, productCategory, productSearch]);

  useEffect(() => {
    setProdPage(1);
  }, [productCategory, productSearch]);

  const paginatedProducts = useMemo(() => {
    const start = (prodPage - 1) * PROD_PAGE_SIZE;
    return filteredProducts.slice(start, start + PROD_PAGE_SIZE);
  }, [filteredProducts, prodPage]);

  // Product Summary Metrics
  const productSummary = useMemo(() => {
    const total7DayUnits = productForecasts.reduce((sum, p) => sum + (Number(p.predictedNext7Days) || 0), 0);
    const topProduct = productForecasts.length > 0 ? productForecasts[0] : null;
    const trendingUpCount = productForecasts.filter((p) => parseFloat(p.growthRate) > 5).length;
    return { total7DayUnits, topProduct, trendingUpCount };
  }, [productForecasts]);

  // Selection helpers
  const handleToggleSelectAll = () => {
    if (selectedIngredientIds.length === filteredIngredients.length) {
      setSelectedIngredientIds([]);
    } else {
      setSelectedIngredientIds(filteredIngredients.map((item) => item.id));
    }
  };

  const handleToggleItemSelect = (id) => {
    setSelectedIngredientIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleOrderAllCritical = () => {
    const criticalItems = ingredientData.ingredients.filter(
      (item) => item.urgency_status === 'CRITICAL' || item.urgency_status === 'OUT_OF_STOCK'
    );
    if (criticalItems.length === 0) return;

    const firstSupplierId = criticalItems.find((i) => i.supplier_id)?.supplier_id;
    setPoTargetSupplierId(firstSupplierId ? String(firstSupplierId) : suppliers[0]?.id ? String(suppliers[0].id) : '');

    setPoItems(
      criticalItems.map((item) => ({
        ingredient_id: item.id,
        name: item.name,
        quantity: item.suggested_purchase_qty > 0 ? item.suggested_purchase_qty : 1,
        unit_price: item.unit_price || 0,
        purchase_unit: item.purchase_unit || item.unit,
        conversion_factor: item.conversion_factor || 1,
        stock_quantity: item.stock_quantity,
        unit: item.unit,
      }))
    );
    setPoNotes(`Restock order for ${criticalItems.length} critical raw materials.`);
    setPoModalOpen(true);
  };

  const handleOpenSingleItemPO = (item) => {
    const defaultQty = item.suggested_purchase_qty > 0 ? item.suggested_purchase_qty : 1;
    const defaultPrice = item.unit_price > 0 ? item.unit_price : 0;

    setPoTargetSupplierId(item.supplier_id ? String(item.supplier_id) : suppliers[0]?.id ? String(suppliers[0].id) : '');
    setPoItems([
      {
        ingredient_id: item.id,
        name: item.name,
        quantity: defaultQty,
        unit_price: defaultPrice,
        purchase_unit: item.purchase_unit || item.unit,
        conversion_factor: item.conversion_factor || 1,
        stock_quantity: item.stock_quantity,
        unit: item.unit,
      },
    ]);
    setPoNotes(`Reorder for ${item.name} (Current stock: ${item.stock_quantity} ${item.unit}).`);
    setPoModalOpen(true);
  };

  const handleOpenBatchPO = () => {
    if (selectedIngredientIds.length === 0) return;
    const selectedItems = ingredientData.ingredients.filter((item) => selectedIngredientIds.includes(item.id));
    const firstSupplierId = selectedItems.find((i) => i.supplier_id)?.supplier_id;
    setPoTargetSupplierId(firstSupplierId ? String(firstSupplierId) : suppliers[0]?.id ? String(suppliers[0].id) : '');

    setPoItems(
      selectedItems.map((item) => ({
        ingredient_id: item.id,
        name: item.name,
        quantity: item.suggested_purchase_qty > 0 ? item.suggested_purchase_qty : 1,
        unit_price: item.unit_price || 0,
        purchase_unit: item.purchase_unit || item.unit,
        conversion_factor: item.conversion_factor || 1,
        stock_quantity: item.stock_quantity,
        unit: item.unit,
      }))
    );
    setPoNotes(`Batch restock order (${selectedItems.length} items).`);
    setPoModalOpen(true);
  };

  const handleUpdatePoItemQty = (index, value) => {
    const val = Math.max(1, parseInt(value, 10) || 1);
    setPoItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], quantity: val };
      return copy;
    });
  };

  const handleRemovePoItem = (index) => {
    setPoItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const calculatePoTotal = () => {
    return poItems.reduce((acc, curr) => acc + curr.quantity * curr.unit_price, 0);
  };

  const handleConfirmSubmitPO = async () => {
    if (!poTargetSupplierId) {
      showToast('error', 'Please select a supplier.');
      return;
    }
    if (poItems.length === 0) {
      showToast('error', 'Please include at least one item.');
      return;
    }

    try {
      setSubmittingPO(true);
      await createPurchaseOrder({
        supplier_id: poTargetSupplierId,
        expected_date: poExpectedDate || null,
        notes: poNotes,
        items: poItems.map((item) => ({
          ingredient_id: item.ingredient_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          purchase_unit: item.purchase_unit,
          conversion_factor: item.conversion_factor,
        })),
      });
      showToast('success', `Purchase order created for ${poItems.length} item(s).`);
      setPoModalOpen(false);
      setSelectedIngredientIds([]);
      fetchIngredientForecast();
    } catch (err) {
      console.error('Failed to create purchase order:', err);
      showToast('error', err.message || 'Failed to create purchase order.');
    } finally {
      setSubmittingPO(false);
    }
  };

  const formatCurrency = (val) => {
    return `₱${Number(val || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderStatusBadge = (days, urgency) => {
    if (urgency === 'OUT_OF_STOCK' || days === 0) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
          Out of stock
        </span>
      );
    }
    if (days === null || days === undefined) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
          Stable
        </span>
      );
    }
    if (days <= 3) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
          {days} {days === 1 ? 'day' : 'days'} left
        </span>
      );
    }
    if (days <= 7) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {days} days left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {Math.round(days)} days left
      </span>
    );
  };

  const renderTrendBadge = (growthRate) => {
    const rate = parseFloat(growthRate) || 0;
    if (rate > 5) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          +{rate.toFixed(0)}% Up
        </span>
      );
    }
    if (rate < -5) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          {rate.toFixed(0)}% Down
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
        Steady
      </span>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[10000] flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${
            toast.type === 'error'
              ? 'bg-red-950 text-white border-red-800'
              : 'bg-zinc-900 text-white border-zinc-800'
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header & Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight m-0">
            Demand Forecasting
          </h1>
          <p className="text-sm text-zinc-500 mt-1 mb-0">
            Monitor raw material runout estimates and upcoming 7-day menu demand.
          </p>
        </div>

        {/* Clean Segmented Control */}
        <div className="inline-flex p-1 bg-zinc-100 rounded-xl border border-zinc-200/80 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleTabSwitch('ingredients')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'ingredients'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span>Ingredient Restock</span>
            {ingredientData.summary.criticalCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
                {ingredientData.summary.criticalCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('products')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'products'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span>Menu Demand (7-Day)</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: INGREDIENT RESTOCK
      ===================================================================== */}
      {activeTab === 'ingredients' && (
        <div className="space-y-5">
          {/* 4 Minimalist Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
              <span className="text-xs font-medium text-zinc-500">Immediate Reorder (≤ 3d)</span>
              <div className="text-2xl sm:text-3xl font-bold text-red-600 mt-1 tabular-nums">
                {loadingIngredients ? '—' : ingredientData.summary.criticalCount}
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
              <span className="text-xs font-medium text-zinc-500">Low Supply (4–7d)</span>
              <div className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1 tabular-nums">
                {loadingIngredients ? '—' : ingredientData.summary.lowStockCount}
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
              <span className="text-xs font-medium text-zinc-500">Healthy Stock (&gt; 7d)</span>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-1 tabular-nums">
                {loadingIngredients ? '—' : ingredientData.summary.healthyCount}
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
              <span className="text-xs font-medium text-zinc-500">Est. Restock Budget</span>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-1 font-mono tabular-nums">
                {loadingIngredients ? '—' : formatCurrency(ingredientData.summary.totalRestockCapitalRequired)}
              </div>
            </div>
          </div>

          {/* Main Table Card */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
            {/* Compact Single-Line Toolbar */}
            <div className="p-4 border-b border-zinc-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                {/* Search */}
                <div className="relative w-full sm:w-64">
                  <svg
                    className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search material or supplier..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-transparent border-none"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Category Select */}
                {categories.length > 0 && (
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm font-medium text-zinc-700 focus:outline-none focus:bg-white focus:border-zinc-400 cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}

                {/* Status Filter Pills */}
                <div className="inline-flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200/70">
                  {[
                    { id: 'ALL', label: 'All', count: ingredientData.ingredients.length },
                    { id: 'CRITICAL', label: 'Critical', count: ingredientData.summary.criticalCount },
                    { id: 'LOW_STOCK', label: 'Low', count: ingredientData.summary.lowStockCount },
                    { id: 'HEALTHY', label: 'Healthy', count: ingredientData.summary.healthyCount },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        statusFilter === tab.id
                          ? 'bg-white text-zinc-900 shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Action Buttons */}
              <div className="flex items-center gap-2">
                {selectedIngredientIds.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleOpenBatchPO}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Create PO ({selectedIngredientIds.length} selected)
                  </button>
                ) : (
                  ingredientData.summary.criticalCount > 0 && (
                    <button
                      type="button"
                      onClick={handleOrderAllCritical}
                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                    >
                      Reorder All Critical ({ingredientData.summary.criticalCount})
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={fetchIngredientForecast}
                  disabled={loadingIngredients}
                  className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                  title="Refresh"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Table Content */}
            {loadingIngredients ? (
              <div className="p-6">
                <TableSkeleton rows={6} cols={7} />
              </div>
            ) : filteredIngredients.length === 0 ? (
              <div className="py-14 text-center">
                <p className="text-sm font-medium text-zinc-500 m-0">No ingredients match your current filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setSearchTerm('');
                    setSelectedCategory('ALL');
                  }}
                  className="mt-3 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold">
                        <th className="py-3 px-4 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={
                              filteredIngredients.length > 0 &&
                              selectedIngredientIds.length === filteredIngredients.length
                            }
                            onChange={handleToggleSelectAll}
                            className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-4">Ingredient</th>
                        <th className="py-3 px-4 text-right">On Hand</th>
                        <th className="py-3 px-4 text-right">Daily Usage</th>
                        <th className="py-3 px-4 text-center">Est. Time Left</th>
                        <th className="py-3 px-4">Suggested Order</th>
                        <th className="py-3 px-4">Supplier</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {paginatedIngredients.map((item) => {
                        const isSelected = selectedIngredientIds.includes(item.id);
                        const needsOrder = item.urgency_status === 'CRITICAL' || item.urgency_status === 'OUT_OF_STOCK' || item.urgency_status === 'LOW_STOCK';

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors ${
                              isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50/60'
                            }`}
                          >
                            <td className="py-3.5 px-4 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleItemSelect(item.id)}
                                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                              />
                            </td>

                            {/* Ingredient Name & Category */}
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-zinc-900">{item.name}</div>
                              <div className="text-xs text-zinc-400">{item.category}</div>
                            </td>

                            {/* On Hand */}
                            <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                              <span className="font-semibold text-zinc-900">
                                {Number(item.stock_quantity).toLocaleString()}
                              </span>{' '}
                              <span className="text-zinc-500 text-xs">{item.unit}</span>
                            </td>

                            {/* Daily Usage */}
                            <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap text-zinc-700">
                              {item.avg_daily_burn_rate > 0 ? (
                                <>
                                  <span className="font-medium text-zinc-900">{item.avg_daily_burn_rate}</span>{' '}
                                  <span className="text-xs text-zinc-400">{item.unit}/d</span>
                                </>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>

                            {/* Est. Time Left */}
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              {renderStatusBadge(item.days_remaining, item.urgency_status)}
                            </td>

                            {/* Suggested Order */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {item.suggested_purchase_qty > 0 ? (
                                <div>
                                  <span className="font-semibold text-zinc-900">
                                    {item.suggested_purchase_qty} {item.purchase_unit}
                                  </span>
                                  {item.estimated_restock_cost > 0 && (
                                    <span className="text-xs text-zinc-500 font-mono ml-1.5">
                                      ({formatCurrency(item.estimated_restock_cost)})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-400">Sufficient</span>
                              )}
                            </td>

                            {/* Supplier */}
                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="text-zinc-700 font-medium">
                                {item.supplier_name || 'Unassigned'}
                              </span>
                            </td>

                            {/* Action */}
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenSingleItemPO(item)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                  needsOrder
                                    ? 'bg-zinc-900 hover:bg-black text-white'
                                    : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                                }`}
                              >
                                Order
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                {filteredIngredients.length > ING_PAGE_SIZE && (
                  <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                    <div>
                      Showing <span className="font-semibold text-zinc-900">{(ingPage - 1) * ING_PAGE_SIZE + 1}</span> to{' '}
                      <span className="font-semibold text-zinc-900">
                        {Math.min(ingPage * ING_PAGE_SIZE, filteredIngredients.length)}
                      </span>{' '}
                      of <span className="font-semibold text-zinc-900">{filteredIngredients.length}</span> ingredients
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIngPage((p) => Math.max(1, p - 1))}
                        disabled={ingPage <= 1}
                        className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer font-medium text-zinc-700"
                      >
                        Previous
                      </button>
                      <span className="px-2 font-semibold text-zinc-800">
                        {ingPage} / {Math.ceil(filteredIngredients.length / ING_PAGE_SIZE)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setIngPage((p) =>
                            Math.min(Math.ceil(filteredIngredients.length / ING_PAGE_SIZE), p + 1)
                          )
                        }
                        disabled={ingPage >= Math.ceil(filteredIngredients.length / ING_PAGE_SIZE)}
                        className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer font-medium text-zinc-700"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: MENU DEMAND (7-DAY PRODUCT SALES FORECAST)
      ===================================================================== */}
      {activeTab === 'products' && (
        <div className="space-y-5">
          {/* 3 Clean Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
              <span className="text-xs font-medium text-zinc-500">Projected 7-Day Volume</span>
              <div className="text-2xl sm:text-3xl font-bold text-zinc-900 mt-1 tabular-nums">
                {loadingProducts ? '—' : `${productSummary.total7DayUnits.toLocaleString()} orders`}
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
              <span className="text-xs font-medium text-zinc-500">Highest Demand Item</span>
              <div className="text-lg sm:text-xl font-bold text-zinc-900 mt-1 truncate">
                {loadingProducts
                  ? '—'
                  : productSummary.topProduct
                  ? `${productSummary.topProduct.name} (${productSummary.topProduct.predictedNext7Days} est.)`
                  : 'No sales data'}
              </div>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-xl p-4 sm:p-5 shadow-2xs">
              <span className="text-xs font-medium text-zinc-500">Trending Up This Week</span>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-600 mt-1 tabular-nums">
                {loadingProducts ? '—' : `${productSummary.trendingUpCount} items`}
              </div>
            </div>
          </div>

          {/* Product Demand Table Card */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-2xs overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1">
                <div className="relative w-full sm:w-64">
                  <svg
                    className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search menu item..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-7 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:bg-white focus:border-zinc-400 transition-colors"
                  />
                  {productSearch && (
                    <button
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 text-xs cursor-pointer bg-transparent border-none"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {productCategories.length > 0 && (
                  <select
                    value={productCategory}
                    onChange={(e) => setProductCategory(e.target.value)}
                    className="px-3 py-1.5 bg-zinc-50/70 border border-zinc-200 rounded-lg text-xs sm:text-sm font-medium text-zinc-700 focus:outline-none focus:bg-white focus:border-zinc-400 cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    {productCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="button"
                onClick={fetchProductForecasts}
                disabled={loadingProducts}
                className="px-3.5 py-1.5 border border-zinc-200 text-zinc-700 hover:bg-zinc-50 rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer self-start sm:self-auto"
              >
                {loadingProducts ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {loadingProducts ? (
              <div className="p-6">
                <TableSkeleton rows={6} cols={6} />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-14 text-center text-sm text-zinc-500">
                No menu items found.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold">
                        <th className="py-3 px-4">Menu Item</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4 text-right">Daily Average</th>
                        <th className="py-3 px-4 text-right">Next 7 Days</th>
                        <th className="py-3 px-4 text-right">Est. 30 Days</th>
                        <th className="py-3 px-4 text-center">Sales Trend</th>
                        <th className="py-3 px-4 text-right">Monthly View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {paginatedProducts.map((item) => {
                        const est30Days = Math.round((Number(item.predictedNext7Days) || 0) * 4.3);
                        return (
                          <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-zinc-900">
                              {item.name}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-zinc-700">
                              {item.avgDailySales} <span className="text-xs text-zinc-400">/ day</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-900">
                              {item.predictedNext7Days} <span className="text-xs font-normal text-zinc-500">orders</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-zinc-700">
                              ~{est30Days} <span className="text-xs text-zinc-400">orders</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {renderTrendBadge(item.growthRate)}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleOpenMonthlyModal(item)}
                                className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition-colors cursor-pointer"
                              >
                                By Month
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                {filteredProducts.length > PROD_PAGE_SIZE && (
                  <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-500">
                    <div>
                      Showing <span className="font-semibold text-zinc-900">{(prodPage - 1) * PROD_PAGE_SIZE + 1}</span> to{' '}
                      <span className="font-semibold text-zinc-900">
                        {Math.min(prodPage * PROD_PAGE_SIZE, filteredProducts.length)}
                      </span>{' '}
                      of <span className="font-semibold text-zinc-900">{filteredProducts.length}</span> products
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setProdPage((p) => Math.max(1, p - 1))}
                        disabled={prodPage <= 1}
                        className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer font-medium text-zinc-700"
                      >
                        Previous
                      </button>
                      <span className="px-2 font-semibold text-zinc-800">
                        {prodPage} / {Math.ceil(filteredProducts.length / PROD_PAGE_SIZE)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setProdPage((p) =>
                            Math.min(Math.ceil(filteredProducts.length / PROD_PAGE_SIZE), p + 1)
                          )
                        }
                        disabled={prodPage >= Math.ceil(filteredProducts.length / PROD_PAGE_SIZE)}
                        className="px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 cursor-pointer font-medium text-zinc-700"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          PURCHASE ORDER GENERATION MODAL (Portaled & Top-Anchored)
      ===================================================================== */}
      {poModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] overflow-y-auto flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setPoModalOpen(false);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(100vh-5rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="m-0 text-base sm:text-lg font-bold tracking-tight">Create Purchase Order</h3>
                  <p className="m-0 text-xs text-zinc-400 mt-0.5">
                    Review quantities and assign a supplier
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPoModalOpen(false)}
                  className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer bg-transparent border-none text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Supplier *
                    </label>
                    <select
                      value={poTargetSupplierId}
                      onChange={(e) => setPoTargetSupplierId(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 font-medium focus:outline-none focus:border-zinc-900"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                      Expected Delivery Date
                    </label>
                    <input
                      type="date"
                      value={poExpectedDate}
                      onChange={(e) => setPoExpectedDate(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 font-medium focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                </div>

                {/* Items Table */}
                <div className="border border-zinc-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-semibold">
                        <th className="py-2.5 px-4">Material</th>
                        <th className="py-2.5 px-4 w-32">Order Qty</th>
                        <th className="py-2.5 px-4 text-right">Unit Cost</th>
                        <th className="py-2.5 px-4 text-right">Subtotal</th>
                        <th className="py-2.5 px-2 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {poItems.map((item, idx) => (
                        <tr key={item.ingredient_id}>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-zinc-900">{item.name}</div>
                            <div className="text-xs text-zinc-400">
                              1 {item.purchase_unit} = {item.conversion_factor} {item.unit}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdatePoItemQty(idx, e.target.value)}
                                className="w-16 px-2 py-1 border border-zinc-300 rounded-md text-sm font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                              />
                              <span className="text-xs text-zinc-500">{item.purchase_unit}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-zinc-600">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-900">
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                          <td className="py-3 px-2 text-center">
                            {poItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePoItem(idx)}
                                className="text-zinc-400 hover:text-red-600 p-1 cursor-pointer bg-transparent border-none"
                                title="Remove"
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

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    placeholder="Optional delivery instructions..."
                    className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-zinc-600">Estimated Total</span>
                  <span className="text-xl font-bold text-zinc-900 font-mono">
                    {formatCurrency(calculatePoTotal())}
                  </span>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPoModalOpen(false)}
                  disabled={submittingPO}
                  className="px-4 py-2 border border-zinc-300 rounded-lg text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmitPO}
                  disabled={submittingPO || poItems.length === 0}
                  className="px-5 py-2 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {submittingPO ? 'Creating...' : 'Create Purchase Order'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* =====================================================================
          MONTHLY PRODUCT PROJECTION MODAL (Portaled & Clean)
      ===================================================================== */}
      {aiModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] overflow-y-auto flex justify-center items-start pt-8 sm:pt-12 md:pt-16 pb-12 p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setAiModalOpen(false);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden flex flex-col animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="m-0 text-base font-bold">{aiSelectedProduct?.name}</h3>
                  <p className="m-0 text-xs text-zinc-400 mt-0.5">Monthly Demand Projection</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="text-zinc-400 hover:text-white p-1 cursor-pointer bg-transparent border-none text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Month/Year Selector */}
              <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <select
                    value={aiTargetMonth}
                    onChange={(e) => {
                      const m = parseInt(e.target.value, 10);
                      setAiTargetMonth(m);
                      runMonthlyForecast(aiSelectedProduct?.id, aiTargetYear, m);
                    }}
                    className="px-2.5 py-1.5 text-xs sm:text-sm font-medium border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none"
                  >
                    {[
                      'January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December',
                    ].map((mName, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {mName}
                      </option>
                    ))}
                  </select>

                  <select
                    value={aiTargetYear}
                    onChange={(e) => {
                      const y = parseInt(e.target.value, 10);
                      setAiTargetYear(y);
                      runMonthlyForecast(aiSelectedProduct?.id, y, aiTargetMonth);
                    }}
                    className="px-2.5 py-1.5 text-xs sm:text-sm font-medium border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none"
                  >
                    {[2025, 2026, 2027].map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <span className="text-xs text-zinc-500 font-medium">
                  {aiLoading ? 'Updating...' : 'Auto-calculated'}
                </span>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {aiLoading ? (
                  <div className="py-8 text-center text-sm text-zinc-400">
                    Calculating monthly projection...
                  </div>
                ) : aiResult ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
                        <span className="text-xs text-zinc-500 block">Projected Volume</span>
                        <span className="text-2xl font-bold text-zinc-900 mt-1 block font-mono">
                          {aiResult.predictedUnitsSold || 0} orders
                        </span>
                      </div>

                      <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
                        <span className="text-xs text-zinc-500 block">Daily Average</span>
                        <span className="text-2xl font-bold text-zinc-900 mt-1 block font-mono">
                          {Math.round(((aiResult.predictedUnitsSold || 0) / 30) * 10) / 10} / day
                        </span>
                      </div>
                    </div>

                    <div className="border border-zinc-200 rounded-xl p-4 space-y-2 text-xs sm:text-sm">
                      <div className="font-semibold text-zinc-900 mb-2">Calendar Adjustments Included</div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Weekend Demand Multiplier</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          {aiResult.factors?.weekendMultiplier ? `${aiResult.factors.weekendMultiplier}x` : '1.0x'}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Payday Period Lift (15th & 30th)</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          {aiResult.factors?.paydayMultiplier ? `${aiResult.factors.paydayMultiplier}x` : '1.0x'}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Holidays in Selected Month</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          {aiResult.factors?.holidaySurgeDays ?? 0} days
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-sm text-zinc-500">
                    No projection data available.
                  </div>
                )}
              </div>

              <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-black cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DemandForecasting;
