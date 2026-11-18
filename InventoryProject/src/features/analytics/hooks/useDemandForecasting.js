import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  getDemandForecast,
  getIngredientDepletionForecast,
  getAIForecast,
} from '../../../api/analyticsApi';
import { getSuppliers, createPurchaseOrder } from '../../../api/purchasingApi';

export const ING_PAGE_SIZE = 15;
export const PROD_PAGE_SIZE = 15;

const getInitialTab = () => {
  if (typeof window !== 'undefined' && window.location.hash.includes('/')) {
    const sub = window.location.hash.split('/')[1];
    if (sub === 'ingredients' || sub === 'products') return sub;
  }
  try {
    const saved = localStorage.getItem('coftea_forecasting_tab');
    if (saved === 'ingredients' || saved === 'products') return saved;
  } catch {
    /* ignore storage/history errors */
  }
  return 'ingredients';
};

/**
 * Custom hook encapsulating state, data fetching, filtering, sorting,
 * pagination, selection, and PO / projection modal handlers for DemandForecasting.
 */
export const useDemandForecasting = () => {
  const [activeTab, setActiveTab] = useState(getInitialTab); // 'ingredients' | 'products'

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    try {
      localStorage.setItem('coftea_forecasting_tab', tab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#Forecasting/${tab}`);
      }
    } catch {
      /* ignore storage/history errors */
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('coftea_forecasting_tab', activeTab);
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `#Forecasting/${activeTab}`);
      }
    } catch {
      /* ignore storage/history errors */
    }
  }, [activeTab]);

  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoGuideTab, setInfoGuideTab] = useState(activeTab); // 'ingredients' | 'products'

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

  // Product Demand State
  const [productForecasts, setProductForecasts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productCategory, setProductCategory] = useState('ALL');
  const [prodPage, setProdPage] = useState(1);
  const [prodSortField, setProdSortField] = useState('predictedNext7Days');
  const [prodSortDirection, setProdSortDirection] = useState('desc'); // highest demand first

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

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const fetchIngredientForecast = useCallback(
    async (refresh = false) => {
      try {
        setLoadingIngredients(true);
        const res = await getIngredientDepletionForecast(refresh);
        if (res && res.ingredients) {
          setIngredientData(res);
        }
      } catch (err) {
        console.error('Failed to fetch ingredient forecast:', err);
        showToast('error', 'Failed to load ingredient forecast.');
      } finally {
        setLoadingIngredients(false);
      }
    },
    [showToast]
  );

  const fetchSuppliersList = useCallback(async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    }
  }, []);

  const fetchProductForecasts = useCallback(
    async (refresh = false) => {
      try {
        setLoadingProducts(true);
        const data = await getDemandForecast(refresh);
        setProductForecasts(data || []);
      } catch (err) {
        console.error('Failed to fetch product forecasts:', err);
        showToast('error', 'Failed to load product demand forecast.');
      } finally {
        setLoadingProducts(false);
      }
    },
    [showToast]
  );

  const hasFetchedProductsRef = useRef(false);

  useEffect(() => {
    fetchIngredientForecast();
    fetchSuppliersList();
  }, [fetchIngredientForecast, fetchSuppliersList]);

  useEffect(() => {
    if (activeTab === 'products' && !hasFetchedProductsRef.current) {
      hasFetchedProductsRef.current = true;
      fetchProductForecasts();
    }
  }, [activeTab, fetchProductForecasts]);

  const handleTabSwitch = (tab) => {
    handleTabChange(tab);
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

  const handleOpenMonthlyModal = (product) => {
    setAiSelectedProduct(product);
    setAiResult(null);
    setAiModalOpen(true);
    runMonthlyForecast(product.id, aiTargetYear, aiTargetMonth);
  };

  const handleSelectAiYear = (yr) => {
    setAiTargetYear(yr);
    runMonthlyForecast(aiSelectedProduct?.id, yr, aiTargetMonth);
  };

  const handleSelectAiMonth = (mNum) => {
    setAiTargetMonth(mNum);
    runMonthlyForecast(aiSelectedProduct?.id, aiTargetYear, mNum);
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
      if (
        statusFilter === 'CRITICAL' &&
        item.urgency_status !== 'CRITICAL' &&
        item.urgency_status !== 'OUT_OF_STOCK'
      ) {
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
      const aVal = a[ingSortField];
      const bVal = b[ingSortField];

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

      const aVal = a[prodSortField];
      const bVal = b[prodSortField];

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
    const total7DayUnits = productForecasts.reduce(
      (sum, p) => sum + (Number(p.predictedNext7Days) || 0),
      0
    );
    const topProduct =
      productForecasts.length > 0
        ? [...productForecasts].sort(
            (a, b) => (Number(b.predictedNext7Days) || 0) - (Number(a.predictedNext7Days) || 0)
          )[0]
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

  const handleResetIngredientFilters = () => {
    setStatusFilter('ALL');
    setSearchTerm('');
    setSelectedCategory('ALL');
  };

  const mapToPoItem = (item) => ({
    ingredient_id: item.id,
    name: item.name,
    quantity: item.suggested_purchase_qty > 0 ? item.suggested_purchase_qty : 1,
    unit_price: item.unit_price > 0 ? item.unit_price : 0,
    purchase_unit: item.purchase_unit || item.unit,
    conversion_factor: item.conversion_factor || 1,
    stock_quantity: item.stock_quantity,
    unit: item.unit,
  });

  const handleOrderAllCritical = () => {
    const criticalItems = ingredientData.ingredients.filter(
      (item) => item.urgency_status === 'CRITICAL' || item.urgency_status === 'OUT_OF_STOCK'
    );
    if (criticalItems.length === 0) return;

    const firstSupplierId = criticalItems.find((i) => i.supplier_id)?.supplier_id;
    setPoTargetSupplierId(
      firstSupplierId ? String(firstSupplierId) : suppliers[0]?.id ? String(suppliers[0].id) : ''
    );
    setPoItems(criticalItems.map(mapToPoItem));
    setPoNotes(`Restock order for ${criticalItems.length} critical raw materials.`);
    setPoModalOpen(true);
  };

  const handleOpenSingleItemPO = (item) => {
    setPoTargetSupplierId(
      item.supplier_id ? String(item.supplier_id) : suppliers[0]?.id ? String(suppliers[0].id) : ''
    );
    setPoItems([mapToPoItem(item)]);
    setPoNotes(`Reorder for ${item.name} (Current stock: ${item.stock_quantity} ${item.unit}).`);
    setPoModalOpen(true);
  };

  const handleOpenBatchPO = () => {
    if (selectedIngredientIds.length === 0) return;
    const selectedItems = ingredientData.ingredients.filter((item) =>
      selectedIngredientIds.includes(item.id)
    );
    const firstSupplierId = selectedItems.find((i) => i.supplier_id)?.supplier_id;
    setPoTargetSupplierId(
      firstSupplierId ? String(firstSupplierId) : suppliers[0]?.id ? String(suppliers[0].id) : ''
    );
    setPoItems(selectedItems.map(mapToPoItem));
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

  return {
    activeTab,
    handleTabSwitch,
    infoModalOpen,
    setInfoModalOpen,
    infoGuideTab,
    setInfoGuideTab,
    openInfoGuide,
    ingredientData,
    loadingIngredients,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    selectedIngredientIds,
    ingPage,
    setIngPage,
    ingSortField,
    ingSortDirection,
    handleIngSort,
    categories,
    filteredIngredients,
    paginatedIngredients,
    fetchIngredientForecast,
    handleToggleSelectAll,
    handleToggleItemSelect,
    handleResetIngredientFilters,
    handleOrderAllCritical,
    handleOpenSingleItemPO,
    handleOpenBatchPO,
    productForecasts,
    loadingProducts,
    productSearch,
    setProductSearch,
    productCategory,
    setProductCategory,
    prodPage,
    setProdPage,
    prodSortField,
    prodSortDirection,
    handleProdSort,
    productCategories,
    filteredProducts,
    paginatedProducts,
    productSummary,
    fetchProductForecasts,
    aiModalOpen,
    setAiModalOpen,
    aiSelectedProduct,
    aiTargetYear,
    aiTargetMonth,
    aiLoading,
    aiResult,
    handleOpenMonthlyModal,
    handleSelectAiYear,
    handleSelectAiMonth,
    suppliers,
    poModalOpen,
    setPoModalOpen,
    poTargetSupplierId,
    setPoTargetSupplierId,
    poItems,
    poExpectedDate,
    setPoExpectedDate,
    poNotes,
    setPoNotes,
    submittingPO,
    handleUpdatePoItemQty,
    handleRemovePoItem,
    calculatePoTotal,
    handleConfirmSubmitPO,
    toast,
    setToast,
  };
};
