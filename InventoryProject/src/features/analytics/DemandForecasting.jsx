import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getDemandForecast, getIngredientDepletionForecast, getAIForecast } from '../../api/analyticsApi';
import { getSuppliers, createPurchaseOrder } from '../../api/purchasingApi';
import { TableSkeleton } from '../../components/shared/SkeletonLoader';
import { InfoTip } from '../../components/shared/InfoTip';

// Clean vector sort indicator (Strictly NO emojis per Rule 16)
const SortIcon = ({ active, direction, className = '' }) => {
  if (!active) {
    return (
      <svg
        className={`w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0 ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 15l5 5 5-5" />
        <path d="M7 9l5-5 5 5" />
      </svg>
    );
  }
  if (direction === 'asc') {
    return (
      <svg
        className={`w-3.5 h-3.5 text-zinc-900 transition-colors shrink-0 ${className}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18 15l-6-6-6 6" />
      </svg>
    );
  }
  return (
    <svg
      className={`w-3.5 h-3.5 text-zinc-900 transition-colors shrink-0 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
};

const DemandForecasting = () => {
  const [activeTab, setActiveTab] = useState('ingredients'); // 'ingredients' | 'products'
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoGuideTab, setInfoGuideTab] = useState('ingredients'); // 'ingredients' | 'products'

  const openInfoGuide = (tabKey) => {
    setInfoGuideTab(tabKey || activeTab);
    setInfoModalOpen(true);
  };

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
  const [ingSortField, setIngSortField] = useState('days_remaining');
  const [ingSortDirection, setIngSortDirection] = useState('asc'); // critical runouts first
  const ING_PAGE_SIZE = 15;

  // Product Demand State
  const [productForecasts, setProductForecasts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('ALL');
  const [prodPage, setProdPage] = useState(1);
  const [prodSortField, setProdSortField] = useState('predictedNext7Days');
  const [prodSortDirection, setProdSortDirection] = useState('desc'); // highest demand first
  const PROD_PAGE_SIZE = 15;

  const handleIngSort = (field) => {
    if (ingSortField === field) {
      setIngSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setIngSortField(field);
      if (field === 'days_remaining' || field === 'name' || field === 'supplier_name') {
        setIngSortDirection('asc');
      } else {
        setIngSortDirection('desc');
      }
    }
  };

  const handleProdSort = (field) => {
    if (prodSortField === field) {
      setProdSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setProdSortField(field);
      if (field === 'name' || field === 'category') {
        setProdSortDirection('asc');
      } else {
        setProdSortDirection('desc');
      }
    }
  };

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

  // Reset ingredient pagination when filter or sort changes
  useEffect(() => {
    setIngPage(1);
  }, [statusFilter, selectedCategory, searchTerm, ingSortField, ingSortDirection]);

  // Sorted Ingredients
  const sortedIngredients = useMemo(() => {
    const list = [...filteredIngredients];
    list.sort((a, b) => {
      let aVal = a[ingSortField];
      let bVal = b[ingSortField];

      if (ingSortField === 'days_remaining') {
        const aDays = aVal === null || aVal === undefined ? 999999 : Number(aVal);
        const bDays = bVal === null || bVal === undefined ? 999999 : Number(bVal);
        return ingSortDirection === 'asc' ? aDays - bDays : bDays - aDays;
      }

      if (ingSortField === 'suggested_purchase_qty') {
        const aQty = Number(a.suggested_purchase_qty) || 0;
        const bQty = Number(b.suggested_purchase_qty) || 0;
        return ingSortDirection === 'asc' ? aQty - bQty : bQty - aQty;
      }

      if (ingSortField === 'avg_daily_burn_rate') {
        const aBurn = Number(a.avg_daily_burn_rate) || 0;
        const bBurn = Number(b.avg_daily_burn_rate) || 0;
        return ingSortDirection === 'asc' ? aBurn - bBurn : bBurn - aBurn;
      }

      if (ingSortField === 'stock_quantity') {
        const aStock = Number(a.stock_quantity) || 0;
        const bStock = Number(b.stock_quantity) || 0;
        return ingSortDirection === 'asc' ? aStock - bStock : bStock - aStock;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string' && isNaN(Number(aVal))) {
        return ingSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return ingSortDirection === 'asc' ? numA - numB : numB - numA;
    });
    return list;
  }, [filteredIngredients, ingSortField, ingSortDirection]);

  const paginatedIngredients = useMemo(() => {
    const start = (ingPage - 1) * ING_PAGE_SIZE;
    return sortedIngredients.slice(start, start + ING_PAGE_SIZE);
  }, [sortedIngredients, ingPage]);

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
  }, [productCategory, productSearch, prodSortField, prodSortDirection]);

  // Sorted Products
  const sortedProducts = useMemo(() => {
    const list = [...filteredProducts];
    list.sort((a, b) => {
      if (prodSortField === 'predictedNext30Days') {
        const a30 = a.predictedNext30Days || Math.round((Number(a.predictedNext7Days) || 0) * 4.3);
        const b30 = b.predictedNext30Days || Math.round((Number(b.predictedNext7Days) || 0) * 4.3);
        return prodSortDirection === 'asc' ? a30 - b30 : b30 - a30;
      }

      if (prodSortField === 'growthRate') {
        const rateA = parseFloat(a.growthRate) || 0;
        const rateB = parseFloat(b.growthRate) || 0;
        return prodSortDirection === 'asc' ? rateA - rateB : rateB - rateA;
      }

      if (prodSortField === 'seasonalIndex') {
        const sA = parseFloat(a.seasonalIndex) || 1.0;
        const sB = parseFloat(b.seasonalIndex) || 1.0;
        return prodSortDirection === 'asc' ? sA - sB : sB - sA;
      }

      if (prodSortField === 'avgDailySales') {
        const aDaily = Number(a.avgDailySales) || 0;
        const bDaily = Number(b.avgDailySales) || 0;
        return prodSortDirection === 'asc' ? aDaily - bDaily : bDaily - aDaily;
      }

      if (prodSortField === 'predictedNext7Days') {
        const a7 = Number(a.predictedNext7Days) || 0;
        const b7 = Number(b.predictedNext7Days) || 0;
        return prodSortDirection === 'asc' ? a7 - b7 : b7 - a7;
      }

      let aVal = a[prodSortField];
      let bVal = b[prodSortField];

      if (typeof aVal === 'string' && typeof bVal === 'string' && isNaN(Number(aVal))) {
        return prodSortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = Number(aVal) || 0;
      const numB = Number(bVal) || 0;
      return prodSortDirection === 'asc' ? numA - numB : numB - numA;
    });
    return list;
  }, [filteredProducts, prodSortField, prodSortDirection]);

  const paginatedProducts = useMemo(() => {
    const start = (prodPage - 1) * PROD_PAGE_SIZE;
    return sortedProducts.slice(start, start + PROD_PAGE_SIZE);
  }, [sortedProducts, prodPage]);

  // Product Summary Metrics
  const productSummary = useMemo(() => {
    const total7DayUnits = productForecasts.reduce((sum, p) => sum + (Number(p.predictedNext7Days) || 0), 0);
    const topProduct = productForecasts.length > 0
      ? [...productForecasts].sort((a, b) => (Number(b.predictedNext7Days) || 0) - (Number(a.predictedNext7Days) || 0))[0]
      : null;
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
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-zinc-900 tracking-tight m-0">
              Demand Forecasting
            </h1>
            <button
              type="button"
              onClick={() => openInfoGuide(activeTab)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 hover:text-zinc-900 text-xs font-semibold border border-zinc-200/80 transition-colors cursor-pointer"
              title="Learn how forecasting is calculated"
            >
              <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>How it works</span>
            </button>
          </div>
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
            {/* Structured Multi-Tier Toolbar */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
              {/* Row 1: Search Box on Left, Action Buttons on Right */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-80">
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
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  {selectedIngredientIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleOpenBatchPO}
                      className="px-3.5 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                    >
                      Create PO ({selectedIngredientIds.length} selected)
                    </button>
                  ) : (
                    ingredientData.summary.criticalCount > 0 && (
                      <button
                        type="button"
                        onClick={handleOrderAllCritical}
                        className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-2xs"
                      >
                        Reorder All Critical ({ingredientData.summary.criticalCount})
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={() => openInfoGuide('ingredients')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Restock Guide</span>
                  </button>

                  <button
                    type="button"
                    onClick={fetchIngredientForecast}
                    disabled={loadingIngredients}
                    className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                    title="Refresh ingredient forecast"
                  >
                    <svg className={`w-4 h-4 ${loadingIngredients ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Row 2: Category Filter Pills spanning full width */}
              {categories.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('ALL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      selectedCategory === 'ALL'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    All Types
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-white text-zinc-900 shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Row 3: Status Filter Pills with dynamic counts */}
              <div className="flex items-center justify-between gap-3 pt-0.5">
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
                      <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold select-none">
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
                        <th className="py-3 px-4 sticky left-0 z-10 bg-zinc-50 shadow-[1px_0_0_0_#e4e4e7] whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleIngSort('name')}
                            className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                          >
                            <span>Ingredient</span>
                            <SortIcon active={ingSortField === 'name'} direction={ingSortDirection} />
                          </button>
                        </th>
                        <th className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleIngSort('stock_quantity')}
                            className="group inline-flex items-center justify-end gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm ml-auto"
                          >
                            <span>On Hand</span>
                            <SortIcon active={ingSortField === 'stock_quantity'} direction={ingSortDirection} />
                          </button>
                        </th>
                        <th className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleIngSort('avg_daily_burn_rate')}
                              className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                            >
                              <span>Daily Usage</span>
                              <SortIcon active={ingSortField === 'avg_daily_burn_rate'} direction={ingSortDirection} />
                            </button>
                            <InfoTip position="bottom" text="Average daily consumption based on recipes sold over the last 30 days, weighted toward the most recent 14 days." />
                          </div>
                        </th>
                        <th className="py-3 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleIngSort('days_remaining')}
                              className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                            >
                              <span>Est. Time Left</span>
                              <SortIcon active={ingSortField === 'days_remaining'} direction={ingSortDirection} />
                            </button>
                            <InfoTip position="bottom" text="Estimated days until current stock runs out at your current daily usage rate." />
                          </div>
                        </th>
                        <th className="py-3 px-4">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleIngSort('suggested_purchase_qty')}
                              className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                            >
                              <span>Suggested Order</span>
                              <SortIcon active={ingSortField === 'suggested_purchase_qty'} direction={ingSortDirection} />
                            </button>
                            <InfoTip position="bottom" text="Recommended purchase quantity in supplier units to maintain a 14-day supply buffer." />
                          </div>
                        </th>
                        <th className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleIngSort('supplier_name')}
                            className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                          >
                            <span>Supplier</span>
                            <SortIcon active={ingSortField === 'supplier_name'} direction={ingSortDirection} />
                          </button>
                        </th>
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
                            className={`transition-colors group ${
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
                            <td className="py-3.5 px-4 sticky left-0 z-10 bg-white group-hover:bg-zinc-50 transition-colors shadow-[1px_0_0_0_#f4f4f5] whitespace-nowrap">
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
            {/* Structured Multi-Tier Toolbar */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3.5">
              {/* Row 1: Search on Left, Action Buttons on Right */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
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
                      aria-label="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openInfoGuide('products')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-zinc-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Menu Forecast Guide</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchProductForecasts}
                    disabled={loadingProducts}
                    className="p-1.5 border border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                    title="Refresh menu forecasts"
                  >
                    <svg className={`w-4 h-4 ${loadingProducts ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Row 2: Category Filter Pills */}
              {productCategories.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 bg-zinc-100 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setProductCategory('ALL')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      productCategory === 'ALL'
                        ? 'bg-white text-zinc-900 shadow-2xs'
                        : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    All Categories
                  </button>
                  {productCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setProductCategory(cat)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        productCategory === cat
                          ? 'bg-white text-zinc-900 shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
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
                      <tr className="border-b border-zinc-200 bg-zinc-50/50 text-zinc-500 font-semibold select-none">
                        <th className="py-3 px-4 sticky left-0 z-10 bg-zinc-50 shadow-[1px_0_0_0_#e4e4e7] whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleProdSort('name')}
                            className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                          >
                            <span>Menu Item</span>
                            <SortIcon active={prodSortField === 'name'} direction={prodSortDirection} />
                          </button>
                        </th>
                        <th className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => handleProdSort('category')}
                            className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                          >
                            <span>Category</span>
                            <SortIcon active={prodSortField === 'category'} direction={prodSortDirection} />
                          </button>
                        </th>
                        <th className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleProdSort('avgDailySales')}
                              className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                            >
                              <span>Daily Average</span>
                              <SortIcon active={prodSortField === 'avgDailySales'} direction={prodSortDirection} />
                            </button>
                            <InfoTip position="bottom" text="Average cups or orders sold per day over the past 30 days." />
                          </div>
                        </th>
                        <th className="py-3 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleProdSort('predictedNext7Days')}
                              className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                            >
                              <span>Next 7 Days</span>
                              <SortIcon active={prodSortField === 'predictedNext7Days'} direction={prodSortDirection} />
                            </button>
                            <InfoTip position="bottom" text="Projected orders for the upcoming 7 days blending recent 14d/30d counter velocity with 4-year (2023–2026) monthly seasonality, weekends, paydays, and holidays." />
                          </div>
                        </th>
                        <th className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleProdSort('predictedNext30Days')}
                            className="group inline-flex items-center justify-end gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm ml-auto"
                          >
                            <span>Est. 30 Days</span>
                            <SortIcon active={prodSortField === 'predictedNext30Days'} direction={prodSortDirection} />
                          </button>
                        </th>
                        <th className="py-3 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleProdSort('seasonalIndex')}
                              className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                            >
                              <span>Seasonality (4-Yr)</span>
                              <SortIcon active={prodSortField === 'seasonalIndex'} direction={prodSortDirection} />
                            </button>
                            <InfoTip position="bottom" text="Multi-year seasonal index (2023–2026) comparing this calendar month's historical demand against the annual average (above 1.0x = peak season)." />
                          </div>
                        </th>
                        <th className="py-3 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleProdSort('growthRate')}
                              className="group inline-flex items-center gap-1.5 font-semibold text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer bg-transparent border-none p-0 text-xs sm:text-sm"
                            >
                              <span>Sales Trend</span>
                              <SortIcon active={prodSortField === 'growthRate'} direction={prodSortDirection} />
                            </button>
                            <InfoTip position="bottom" text="Blends recent 14-day vs. 16-day momentum with multi-year Year-over-Year (YoY) growth trajectory." />
                          </div>
                        </th>
                        <th className="py-3 px-4 text-right">Monthly View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {paginatedProducts.map((item) => {
                        const est30Days = item.predictedNext30Days || Math.round((Number(item.predictedNext7Days) || 0) * 4.3);
                        const sIdx = parseFloat(item.seasonalIndex) || 1.0;
                        return (
                          <tr key={item.id} className="hover:bg-zinc-50/60 transition-colors group">
                            <td className="py-3.5 px-4 font-semibold text-zinc-900 sticky left-0 z-10 bg-white group-hover:bg-zinc-50 transition-colors shadow-[1px_0_0_0_#f4f4f5] whitespace-nowrap">
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
                            <td className="py-3.5 px-4 text-center whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold border ${
                                  sIdx >= 1.12
                                    ? 'bg-zinc-900 text-white border-zinc-900'
                                    : sIdx <= 0.90
                                    ? 'bg-zinc-50 text-zinc-500 border-zinc-200'
                                    : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                                }`}
                              >
                                {sIdx.toFixed(2)}x
                                <span className="font-sans text-[10px] font-medium opacity-80">
                                  {sIdx >= 1.12 ? 'Peak' : sIdx <= 0.90 ? 'Low' : 'Norm'}
                                </span>
                              </span>
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
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1 border border-zinc-200 rounded-lg bg-zinc-50/60">
                      {suppliers.map((sup) => {
                        const isSelected = String(poTargetSupplierId) === String(sup.id);
                        return (
                          <button
                            key={sup.id}
                            type="button"
                            onClick={() => setPoTargetSupplierId(sup.id)}
                            className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-zinc-900 text-white shadow-2xs'
                                : 'bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200'
                            }`}
                          >
                            {sup.name}
                          </button>
                        );
                      })}
                    </div>
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

              {/* Month/Year Selector (Custom Pill Grid — No Native Select) */}
              <div className="p-4 bg-zinc-50 border-b border-zinc-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex bg-zinc-200/70 p-0.5 rounded-lg">
                    {[2023, 2024, 2025, 2026, 2027].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          setAiTargetYear(yr);
                          runMonthlyForecast(aiSelectedProduct?.id, yr, aiTargetMonth);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          aiTargetYear === yr
                            ? 'bg-zinc-900 text-white shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-zinc-500 font-medium">
                    {aiLoading ? 'Updating...' : '4-Yr Multi-Seasonal'}
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1">
                  {[
                    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
                  ].map((mShort, idx) => {
                    const mNum = idx + 1;
                    const isSelected = aiTargetMonth === mNum;
                    return (
                      <button
                        key={mNum}
                        type="button"
                        onClick={() => {
                          setAiTargetMonth(mNum);
                          runMonthlyForecast(aiSelectedProduct?.id, aiTargetYear, mNum);
                        }}
                        className={`py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-zinc-900 text-white shadow-2xs'
                            : 'bg-white border border-zinc-200/80 text-zinc-700 hover:bg-zinc-100'
                        }`}
                      >
                        {mShort}
                      </button>
                    );
                  })}
                </div>
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
                      <div className="font-semibold text-zinc-900 mb-2">Multi-Year &amp; Calendar Factors</div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Seasonal Index (2023–2026)</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          {aiResult.factors?.seasonalIndex ? `${aiResult.factors.seasonalIndex}x` : '1.00x'}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Year-over-Year (YoY) Trend</span>
                        <span
                          className={`font-mono font-semibold ${
                            Number(aiResult.factors?.yoyGrowthRate || 0) > 0
                              ? 'text-emerald-700'
                              : Number(aiResult.factors?.yoyGrowthRate || 0) < 0
                                ? 'text-amber-700'
                                : 'text-zinc-900'
                          }`}
                        >
                          {Number(aiResult.factors?.yoyGrowthRate || 0) >= 0 ? '+' : ''}
                          {aiResult.factors?.yoyGrowthRate ?? 0}%
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Weekend Demand Multiplier</span>
                        <span className="font-mono font-semibold text-zinc-900">
                          {aiResult.factors?.weekendMultiplier ? `${aiResult.factors.weekendMultiplier}x` : '1.0x'}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600">
                        <span>Payday Period Lift (15th &amp; 30th)</span>
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

                    {Array.isArray(aiResult.factors?.sameMonthHistory) &&
                      aiResult.factors.sameMonthHistory.length > 0 && (
                        <div className="border border-zinc-200 rounded-xl p-4 space-y-2 text-xs sm:text-sm bg-zinc-50/60">
                          <div className="font-semibold text-zinc-900">
                            Same-Month Historical Sales (2023–2026)
                          </div>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                            {aiResult.factors.sameMonthHistory.map((h) => (
                              <div
                                key={h.year}
                                className="bg-white border border-zinc-200 rounded-lg px-2.5 py-2 text-center"
                              >
                                <span className="text-[11px] font-semibold text-zinc-500 block">
                                  {h.year}
                                </span>
                                <span className="text-xs sm:text-sm font-bold font-mono text-zinc-900">
                                  {h.qty}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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

      {/* =====================================================================
          HOW FORECASTING WORKS MODAL (Portaled & Clean)
      ===================================================================== */}
      {infoModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] overflow-y-auto flex justify-center items-start pt-8 sm:pt-12 md:pt-16 pb-12 p-4 bg-black/60 backdrop-blur-xs animate-[modalBackdropFadeIn_0.2s_ease-out]"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setInfoModalOpen(false);
            }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl border border-zinc-200 w-full max-w-xl overflow-hidden flex flex-col animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <svg className="w-5 h-5 text-zinc-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <div>
                    <h3 className="m-0 text-base font-bold">Forecasting Reference Guide</h3>
                    <p className="m-0 text-xs text-zinc-400 mt-0.5">
                      How Ingredient Restock and Menu Demand projections are calculated
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoModalOpen(false)}
                  className="text-zinc-400 hover:text-white p-1 cursor-pointer bg-transparent border-none text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Modal Guide Switcher Tabs */}
              <div className="px-6 pt-3.5 pb-2 bg-zinc-50 border-b border-zinc-200 flex gap-2">
                <button
                  type="button"
                  onClick={() => setInfoGuideTab('ingredients')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    infoGuideTab === 'ingredients'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  Ingredient Restock Guide
                </button>
                <button
                  type="button"
                  onClick={() => setInfoGuideTab('products')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    infoGuideTab === 'products'
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                  }`}
                >
                  Menu Demand Guide
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 text-xs sm:text-sm text-zinc-600 leading-relaxed max-h-[calc(100vh-14rem)] overflow-y-auto">
                {infoGuideTab === 'ingredients' ? (
                  <>
                    {/* Ingredient Section 1 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                        <h4 className="m-0 text-sm font-bold text-zinc-900">
                          1. Recipe-Based Daily Usage (Burn Rate)
                        </h4>
                      </div>
                      <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                        <p className="m-0">
                          Every drink sold at the POS is mapped to its bill of materials (grams of coffee beans or powders, milliliters of milk or syrup, and packaging pieces).
                        </p>
                        <p className="m-0">
                          <span className="font-semibold text-zinc-900">Weighted Velocity:</span> Daily usage blends the last 30 days of recipe consumption with extra weight on the most recent 14 days so sudden shifts in drink popularity are reflected immediately.
                        </p>
                      </div>
                    </div>

                    {/* Ingredient Section 2 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                        <h4 className="m-0 text-sm font-bold text-zinc-900">
                          2. Estimated Time Left &amp; Urgency Status
                        </h4>
                      </div>
                      <div className="pl-4 space-y-2 border-l-2 border-zinc-100">
                        <p className="m-0">
                          <span className="font-semibold text-zinc-900">Est. Time Left:</span> Compares current on-hand stock against the daily usage rate to estimate how many operating days remain before stock runs out.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                          <div className="p-2.5 rounded-lg bg-red-50/70 border border-red-200/80">
                            <span className="text-xs font-bold text-red-700 block">Critical (≤ 3 days)</span>
                            <span className="text-[11px] text-red-900/80">Immediate reorder needed or below alert threshold.</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/80">
                            <span className="text-xs font-bold text-amber-700 block">Low Supply (4–7 days)</span>
                            <span className="text-[11px] text-amber-900/80">Approaching reorder point for this week&apos;s delivery.</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200/80">
                            <span className="text-xs font-bold text-emerald-700 block">Healthy (&gt; 7 days)</span>
                            <span className="text-[11px] text-emerald-900/80">Sufficient raw material buffer on hand.</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ingredient Section 3 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                        <h4 className="m-0 text-sm font-bold text-zinc-900">
                          3. Suggested Order &amp; Supplier Unit Conversion
                        </h4>
                      </div>
                      <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                        <p className="m-0">
                          <span className="font-semibold text-zinc-900">14-Day Target Buffer:</span> When an ingredient needs restocking, the system calculates how much stock is needed to cover a full 14-day supply window.
                        </p>
                        <p className="m-0">
                          <span className="font-semibold text-zinc-900">Purchase Units:</span> Raw gram/milliliter deficits are automatically rounded up into supplier ordering units (such as 1 kg bags, 750 ml syrup bottles, or 1 L milk cartons) for one-click Purchase Order creation.
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Menu Demand Section 1 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                        <h4 className="m-0 text-sm font-bold text-zinc-900">
                          1. Multi-Year Seasonality &amp; YoY Growth (2023–2026)
                        </h4>
                      </div>
                      <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                        <p className="m-0">
                          <span className="font-semibold text-zinc-900">4-Year Seasonal Index:</span> Evaluates 47 months of Cof/Tea sales history (2023–2026) to measure how each calendar month performs relative to the annual average—capturing April–May summer surges for iced drinks, February HAMAKA Fiesta &amp; Valentine&apos;s week, school exam periods, and November–December holiday peaks.
                        </p>
                        <p className="m-0">
                          <span className="font-semibold text-zinc-900">Year-over-Year (YoY) Trajectory:</span> Compares same-month sales across consecutive years (2023 through 2026) so long-term store growth is factored into upcoming projections.
                        </p>
                      </div>
                    </div>

                    {/* Menu Demand Section 2 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                        <h4 className="m-0 text-sm font-bold text-zinc-900">
                          2. Recent Counter Velocity (7-Day &amp; 30-Day)
                        </h4>
                      </div>
                      <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                        <p className="m-0">
                          <span className="font-semibold text-zinc-900">Daily Average &amp; Momentum:</span> Tracks each menu item&apos;s recent 14-day and 30-day order pace and blends it with the 4-year seasonal index so both newly trending drinks and established bestsellers are accurately projected.
                        </p>
                      </div>
                    </div>

                    {/* Menu Demand Section 3 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-zinc-900 shrink-0" />
                        <h4 className="m-0 text-sm font-bold text-zinc-900">
                          3. Philippine Calendar, Weekend &amp; Payday Multipliers
                        </h4>
                      </div>
                      <div className="pl-4 space-y-1.5 border-l-2 border-zinc-100">
                        <p className="m-0">
                          <span className="font-semibold text-zinc-900">7-Day &amp; Monthly View:</span> Projections adjust for higher Friday–Sunday foot traffic, bi-monthly payday windows (15th and 30th of the month), and national/local holidays. Click <span className="font-semibold text-zinc-900">By Month</span> on any drink to inspect its month-by-month breakdown and 2023–2026 historical comparison.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex justify-end">
                <button
                  type="button"
                  onClick={() => setInfoModalOpen(false)}
                  className="px-4 py-1.5 bg-zinc-900 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-black cursor-pointer"
                >
                  Got it
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
