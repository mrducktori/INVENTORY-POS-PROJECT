import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getPosCatalog, createSale } from "../../../api/posApi";
import { getCategorySettings, extractCategoryNames } from "../../../api/categorySettingsApi";
import { getCurrentUser } from "../../../utils/authUtils";
import { getProductOptionsAvailability } from "../../../utils/productUtils";
import {
  MAX_LINE_QTY,
  buildRecipesByProductMap,
  buildIngredientsMap,
  calculateReservedStock,
  getProductStockSummary,
  getMaxQtyForConfiguredItem,
  getMaxAddOnQty,
  validateItemsAgainstStock
} from "../utils/posStockUtils";

const DEFAULT_MODIFIERS = { sugar_level: "100%", ice_level: "Normal Ice" };

const buildCartItemId = (productId, hasSizes, cupSize, hasAddOns, addOnsMap, modifiers = null) => {
  if (!hasSizes && !hasAddOns) {
    return `${productId}-standard`;
  }
  const sizeKey = hasSizes ? cupSize : "standard";
  const addOnKey = hasAddOns
    ? Object.entries(addOnsMap || {})
        .filter(([, q]) => (Number(q) || 0) > 0)
        .map(([n, q]) => `${n}x${q}`)
        .sort()
        .join(",") || "none"
    : "none";
  const sugar = modifiers?.sugar_level || DEFAULT_MODIFIERS.sugar_level;
  const ice = modifiers?.ice_level || DEFAULT_MODIFIERS.ice_level;
  return `${productId}-${sizeKey}-${addOnKey}-s:${sugar}-i:${ice}`;
};

const resolveConfiguredItemDetails = (product, options, categorySettings) => {
  const { hasSizes, hasAddOns } = getProductOptionsAvailability(product, categorySettings);
  let finalPrice = parseFloat(product?.price || 0);
  let selectedSizeObj = null;
  const selectedAddonObjs = [];

  if (hasSizes) {
    if (product?.sizes && product.sizes.length > 0) {
      selectedSizeObj = product.sizes.find((s) => s.name === options.cupSize) || null;
      if (selectedSizeObj) finalPrice += parseFloat(selectedSizeObj.price_add || 0);
    } else {
      if (options.cupSize === "16 oz") finalPrice += 10;
      if (options.cupSize === "22 oz") finalPrice += 20;
    }
  }

  if (hasAddOns) {
    Object.entries(options.addOns || {}).forEach(([addonName, customerQty]) => {
      const qty = Number(customerQty) || 0;
      if (qty <= 0) return;

      if (product?.add_ons && product.add_ons.length > 0) {
        const ao = product.add_ons.find((a) => a.name === addonName);
        if (ao) {
          finalPrice += parseFloat(ao.price || 0) * qty;
          selectedAddonObjs.push({ ...ao, customer_qty: qty });
          return;
        }
      }
      selectedAddonObjs.push({ name: addonName, price: 0, customer_qty: qty });
    });
  }

  const normalizedModifiers = (hasSizes || hasAddOns)
    ? {
        sugar_level: options.modifiers?.sugar_level || DEFAULT_MODIFIERS.sugar_level,
        ice_level: options.modifiers?.ice_level || DEFAULT_MODIFIERS.ice_level
      }
    : null;

  const cartItemId = buildCartItemId(
    product?.id,
    hasSizes,
    options.cupSize,
    hasAddOns,
    options.addOns,
    normalizedModifiers
  );

  return {
    hasSizes,
    hasAddOns,
    finalPrice,
    selectedSizeObj,
    selectedAddonObjs,
    normalizedModifiers,
    cartItemId
  };
};

export const usePOS = () => {
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("pos_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(false);

  const [categorySettings, setCategorySettings] = useState({});
  const [saleComplete, setSaleComplete] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState(null);
  const [ongoingOrders, setOngoingOrders] = useState(() => {
    try {
      const saved = localStorage.getItem("pos_ongoingOrders");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeTab, setActiveTab] = useState("cart");
  const [orderType, setOrderType] = useState("DINE_IN");

  const [stockNotice, setStockNotice] = useState("");
  const noticeTimerRef = useRef(null);

  // Payment & Digital Receipt Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState(null);
  const [completedReceipt, setCompletedReceipt] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);

  // Cart-level Discount Selection State
  const [discountType, setDiscountType] = useState("NONE");
  const [customDiscountMode, setCustomDiscountMode] = useState("PERCENT");
  const [customDiscountValue, setCustomDiscountValue] = useState("");

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    message: "",
    onConfirm: () => {},
    onCancel: () => {}
  });

  const showStockNotice = useCallback((message) => {
    if (!message) return;
    clearTimeout(noticeTimerRef.current);
    setStockNotice(message);
    noticeTimerRef.current = setTimeout(() => {
      setStockNotice("");
    }, 4500);
  }, []);

  const clearStockNotice = useCallback(() => {
    clearTimeout(noticeTimerRef.current);
    setStockNotice("");
  }, []);

  useEffect(() => {
    return () => clearTimeout(noticeTimerRef.current);
  }, []);

  const requestConfirm = (message) => {
    return new Promise((resolve) => {
      setConfirmConfig({
        isOpen: true,
        message,
        onConfirm: () => {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  };

  const user = getCurrentUser();

  const fetchCatalog = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const data = await getPosCatalog();
      const nextProducts = data?.products || [];
      const nextRecipes = data?.recipes || [];
      const nextIngredients = data?.ingredients || [];

      setProducts(nextProducts);
      setRecipes(nextRecipes);
      setIngredients(nextIngredients);
      setCatalogLoaded(true);

      return {
        products: nextProducts,
        recipes: nextRecipes,
        ingredients: nextIngredients
      };
    } catch (err) {
      console.error("Failed to load POS catalog:", err);
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const fetchCategorySettings = useCallback(async () => {
    try {
      const data = await getCategorySettings();
      const settingsMap = {};
      (data || []).forEach((item) => {
        if (item?.category) {
          settingsMap[item.category.toUpperCase()] = item;
        }
      });
      setCategorySettings(settingsMap);
    } catch (err) {
      console.error("Failed to fetch category settings", err);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
    fetchCategorySettings();
  }, [fetchCatalog, fetchCategorySettings]);

  const categories = useMemo(() => {
    const combined = [
      ...Object.keys(categorySettings || {}),
      ...products.map((p) => p.category)
    ];
    return extractCategoryNames(combined);
  }, [categorySettings, products]);

  // PERSIST STATE
  useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("pos_ongoingOrders", JSON.stringify(ongoingOrders));
  }, [ongoingOrders]);

  const getVirtualProduct = useCallback(
    (product) => {
      if (!product) return null;
      const catSettings = categorySettings[product.category?.toUpperCase()];
      const virtualProduct = {
        ...product,
        sizes: [...(product.sizes || [])],
        add_ons: [...(product.add_ons || [])]
      };

      if (catSettings) {
        if (catSettings.sizes && catSettings.sizes.length > 0 && virtualProduct.sizes.length === 0) {
          virtualProduct.sizes = [...catSettings.sizes];
        }
        if (catSettings.add_ons && catSettings.add_ons.length > 0) {
          const existingNames = virtualProduct.add_ons.map((a) => a.name);
          catSettings.add_ons.forEach((ca) => {
            if (!existingNames.includes(ca.name)) {
              virtualProduct.add_ons.push(ca);
            }
          });
        }
      }
      return virtualProduct;
    },
    [categorySettings]
  );

  const productsMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      if (p?.id) map[p.id] = p;
    });
    return map;
  }, [products]);

  const recipesByProduct = useMemo(() => buildRecipesByProductMap(recipes), [recipes]);
  const ingredientsMap = useMemo(() => buildIngredientsMap(ingredients), [ingredients]);

  const globalReserved = useMemo(
    () =>
      calculateReservedStock({
        cart,
        ongoingOrders,
        recipesByProduct,
        ingredientsMap,
        orderType
      }),
    [cart, ongoingOrders, recipesByProduct, ingredientsMap, orderType]
  );

  const ongoingOnlyReserved = useMemo(
    () =>
      calculateReservedStock({
        cart: [],
        ongoingOrders,
        recipesByProduct,
        ingredientsMap,
        orderType
      }),
    [ongoingOrders, recipesByProduct, ingredientsMap, orderType]
  );

  const stockSummaryByProductId = useMemo(() => {
    const map = {};
    products.forEach((product) => {
      map[product.id] = getProductStockSummary(product, {
        recipesByProduct,
        ingredientsMap,
        reserved: globalReserved,
        virtualProduct: getVirtualProduct(product)
      });
    });
    return map;
  }, [products, recipesByProduct, ingredientsMap, globalReserved, getVirtualProduct]);

  const maxQtyByCartItemId = useMemo(() => {
    const map = {};
    cart.forEach((item) => {
      const liveProduct = getVirtualProduct(productsMap[item.id] || item.baseProduct || item);
      const reservedExcludingThis = calculateReservedStock({
        cart,
        ongoingOrders,
        recipesByProduct,
        ingredientsMap,
        excludeCartItemId: item.cartItemId,
        orderType
      });
      const { maxQty } = getMaxQtyForConfiguredItem({
        product: liveProduct,
        cupSizeObj: item.cup_size_obj || null,
        cupSizeName: item.cup_size || null,
        addOnsList: item.add_ons || [],
        modifiers: item.modifiers || null,
        orderType,
        recipesByProduct,
        ingredientsMap,
        reserved: reservedExcludingThis,
        existingSameLineQty: 0
      });
      map[item.cartItemId] = maxQty;
    });
    return map;
  }, [cart, ongoingOrders, productsMap, recipesByProduct, ingredientsMap, getVirtualProduct, orderType]);

  const cartStockValidation = useMemo(() => {
    if (!catalogLoaded) return { valid: true, issues: [] };
    return validateItemsAgainstStock(cart, {
      productsMap,
      recipesByProduct,
      ingredientsMap,
      reserved: ongoingOnlyReserved,
      orderType
    });
  }, [catalogLoaded, cart, productsMap, recipesByProduct, ingredientsMap, ongoingOnlyReserved, orderType]);

  const stockIssuesByOrderId = useMemo(() => {
    const map = {};
    if (!catalogLoaded) return map;
    ongoingOrders.forEach((order) => {
      const res = validateItemsAgainstStock(order.items, {
        productsMap,
        recipesByProduct,
        ingredientsMap,
        reserved: null,
        orderType: order.order_type || "DINE_IN"
      });
      if (!res.valid) {
        map[order.id] = res.issues;
      }
    });
    return map;
  }, [catalogLoaded, ongoingOrders, productsMap, recipesByProduct, ingredientsMap]);

  // Sync cart prices, categories, cup_size_obj, and add-on metadata with latest fetched products
  useEffect(() => {
    if (products.length === 0) return;

    setCart((prevCart) => {
      if (prevCart.length === 0) return prevCart;
      let hasChanges = false;

      const updatedCart = prevCart.map((item) => {
        const rawProd = products.find((p) => p.id === item.id);
        if (!rawProd) return item;

        const latestProd = getVirtualProduct(rawProd);
        let finalPrice = parseFloat(latestProd.price || 0);
        let updatedCupObj = item.cup_size_obj || null;

        if (item.cup_size_obj || item.cup_size) {
          const targetSizeName = item.cup_size_obj?.name || item.cup_size;
          const sz = latestProd.sizes?.find((s) => s.name === targetSizeName);
          if (sz) {
            updatedCupObj = sz;
            finalPrice += parseFloat(sz.price_add || 0);
          } else if (item.cup_size_obj) {
            finalPrice += parseFloat(item.cup_size_obj.price_add || 0);
          } else {
            if (item.cup_size === "16 oz") finalPrice += 10;
            if (item.cup_size === "22 oz") finalPrice += 20;
          }
        }

        let updatedAddOns = item.add_ons || [];
        if (Array.isArray(item.add_ons) && item.add_ons.length > 0) {
          updatedAddOns = item.add_ons.map((ao) => {
            const latestAo = latestProd.add_ons?.find((a) => a.name === ao.name);
            const customerQty = ao.customer_qty || 1;
            if (latestAo) {
              finalPrice += parseFloat(latestAo.price || 0) * customerQty;
              return { ...latestAo, customer_qty: customerQty };
            }
            finalPrice += parseFloat(ao.price || 0) * customerQty;
            return ao;
          });
        }

        const cupChanged =
          (updatedCupObj?.ingredient_id || null) !== (item.cup_size_obj?.ingredient_id || null) ||
          Number(updatedCupObj?.price_add || 0) !== Number(item.cup_size_obj?.price_add || 0);
        const addonsChanged = JSON.stringify(updatedAddOns) !== JSON.stringify(item.add_ons || []);

        if (
          item.price !== finalPrice ||
          item.baseProduct?.price !== latestProd.price ||
          item.baseProduct?.stock_quantity !== latestProd.stock_quantity ||
          item.track_stock !== latestProd.track_stock ||
          item.category !== latestProd.category ||
          cupChanged ||
          addonsChanged
        ) {
          hasChanges = true;
          return {
            ...item,
            category: latestProd.category,
            track_stock: latestProd.track_stock,
            price: finalPrice,
            cup_size_obj: updatedCupObj,
            add_ons: updatedAddOns,
            baseProduct: { ...latestProd }
          };
        }
        return item;
      });

      return hasChanges ? updatedCart : prevCart;
    });
  }, [products, categorySettings, getVirtualProduct]);

  // Refresh catalog silently whenever the Info Modal is opened so live stock numbers stay current
  useEffect(() => {
    if (recipeProduct) {
      void fetchCatalog({ silent: true });
    }
  }, [recipeProduct, fetchCatalog]);

  const activeRecipeProduct = useMemo(() => {
    if (!recipeProduct) return null;
    return productsMap[recipeProduct.id] || recipeProduct;
  }, [recipeProduct, productsMap]);

  const recipeProductSummary = useMemo(() => {
    if (!activeRecipeProduct) return null;
    if (stockSummaryByProductId[activeRecipeProduct.id]) {
      return stockSummaryByProductId[activeRecipeProduct.id];
    }
    return getProductStockSummary(activeRecipeProduct, {
      recipesByProduct,
      ingredientsMap,
      reserved: globalReserved,
      virtualProduct: getVirtualProduct(activeRecipeProduct)
    });
  }, [
    activeRecipeProduct,
    stockSummaryByProductId,
    recipesByProduct,
    ingredientsMap,
    globalReserved,
    getVirtualProduct
  ]);

  const [showOptions, setShowOptions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingCartItemId, setEditingCartItemId] = useState(null);
  const [productOptions, setProductOptions] = useState({
    qty: 1,
    cupSize: "12 oz",
    addOns: {},
    modifiers: { ...DEFAULT_MODIFIERS }
  });

  const optionsModalStock = useMemo(() => {
    if (!showOptions || !selectedProduct) {
      return {
        stockMax: MAX_LINE_QTY,
        maxLineQty: MAX_LINE_QTY,
        limitingName: null,
        sizeAvailability: [],
        addonMaxMap: {},
        existingSameLineQty: 0
      };
    }

    const reservedForModal = calculateReservedStock({
      cart,
      ongoingOrders,
      recipesByProduct,
      ingredientsMap,
      excludeCartItemId: editingCartItemId,
      orderType
    });

    const { selectedSizeObj, selectedAddonObjs, normalizedModifiers, cartItemId } = resolveConfiguredItemDetails(
      selectedProduct,
      productOptions,
      categorySettings
    );

    const otherExisting = cart.find(
      (item) => item.cartItemId === cartItemId && item.cartItemId !== editingCartItemId
    );
    const existingSameLineQty = otherExisting ? otherExisting.qty : 0;

    const { stockMax, maxQty, limitingName } = getMaxQtyForConfiguredItem({
      product: selectedProduct,
      cupSizeObj: selectedSizeObj,
      cupSizeName: productOptions.cupSize,
      addOnsList: selectedAddonObjs,
      modifiers: normalizedModifiers,
      orderType,
      recipesByProduct,
      ingredientsMap,
      reserved: reservedForModal,
      existingSameLineQty
    });

    const modalSummary = getProductStockSummary(selectedProduct, {
      recipesByProduct,
      ingredientsMap,
      reserved: reservedForModal,
      virtualProduct: selectedProduct
    });

    const addonsList =
      selectedProduct.add_ons?.length > 0
        ? selectedProduct.add_ons
        : ["Pearl", "Nata", "Jelly", "Pudding", "Extra Sugar", "Extra Ice"].map((name) => ({ name }));

    const addonMaxMap = {};
    addonsList.forEach((ao) => {
      addonMaxMap[ao.name] = getMaxAddOnQty({
        product: selectedProduct,
        cupSizeObj: selectedSizeObj,
        cupSizeName: productOptions.cupSize,
        currentAddOns: selectedAddonObjs,
        targetAddon: ao,
        currentItemQty: productOptions.qty,
        modifiers: normalizedModifiers,
        orderType,
        recipesByProduct,
        ingredientsMap,
        reserved: reservedForModal
      });
    });

    return {
      stockMax,
      maxLineQty: maxQty,
      limitingName,
      sizeAvailability: modalSummary.sizeAvailability,
      addonMaxMap,
      existingSameLineQty
    };
  }, [
    showOptions,
    selectedProduct,
    productOptions,
    categorySettings,
    cart,
    ongoingOrders,
    recipesByProduct,
    ingredientsMap,
    editingCartItemId,
    orderType
  ]);

  // Automatically clamp quantity when cup size, add-on, or existing cart line lowers available cap
  useEffect(() => {
    if (!showOptions || !selectedProduct) return;
    if (optionsModalStock.maxLineQty >= 1 && productOptions.qty > optionsModalStock.maxLineQty) {
      setProductOptions((prev) => ({
        ...prev,
        qty: optionsModalStock.maxLineQty
      }));
    }
  }, [showOptions, selectedProduct, optionsModalStock.maxLineQty, productOptions.qty]);

  const openOptions = (product) => {
    const liveProduct = productsMap[product.id] || product;
    const summary =
      stockSummaryByProductId[liveProduct.id] ||
      getProductStockSummary(liveProduct, {
        recipesByProduct,
        ingredientsMap,
        reserved: globalReserved,
        virtualProduct: getVirtualProduct(liveProduct)
      });

    if ((summary?.remainingOrderable ?? 0) <= 0) {
      showStockNotice(`${liveProduct.name} has no available stock remaining.`);
      return;
    }

    const virtualProduct = getVirtualProduct(liveProduct);
    setSelectedProduct(virtualProduct);

    let defaultSize = "12 oz";
    if (virtualProduct.sizes && virtualProduct.sizes.length > 0) {
      const availableSize = summary?.sizeAvailability?.find(
        (s) => s.cupRemaining === null || s.cupRemaining > 0
      );
      defaultSize = availableSize ? availableSize.name : virtualProduct.sizes[0].name;
    }

    setProductOptions({
      qty: 1,
      cupSize: defaultSize,
      addOns: {},
      modifiers: { ...DEFAULT_MODIFIERS }
    });
    setEditingCartItemId(null);
    setShowOptions(true);
  };

  const openEditOptions = (cartItemId) => {
    const item = cart.find((i) => i.cartItemId === cartItemId);
    if (!item || (!item.baseProduct && !productsMap[item.id])) return;

    const liveProduct = getVirtualProduct(productsMap[item.id] || item.baseProduct);
    setSelectedProduct(liveProduct);

    const reconstructedAddOns = {};
    if (item.add_ons && item.add_ons.length > 0) {
      item.add_ons.forEach((ao) => {
        reconstructedAddOns[ao.name] = ao.customer_qty || 1;
      });
    }

    setProductOptions({
      qty: item.qty,
      cupSize: item.cup_size || liveProduct.sizes?.[0]?.name || "12 oz",
      addOns: reconstructedAddOns,
      modifiers: {
        sugar_level: item.modifiers?.sugar_level || DEFAULT_MODIFIERS.sugar_level,
        ice_level: item.modifiers?.ice_level || DEFAULT_MODIFIERS.ice_level
      }
    });
    setEditingCartItemId(cartItemId);
    setShowOptions(true);
  };

  const closeOptions = () => {
    setShowOptions(false);
    setSelectedProduct(null);
    setEditingCartItemId(null);
  };

  const handleAddWithOptions = () => {
    if (!selectedProduct) return;

    const maxAllowed = optionsModalStock.maxLineQty;
    if (maxAllowed <= 0) {
      showStockNotice(`Cannot add ${selectedProduct.name}: insufficient stock.`);
      return;
    }

    if (productOptions.qty > maxAllowed) {
      showStockNotice(`Only ${maxAllowed} available for ${selectedProduct.name}.`);
      setProductOptions((prev) => ({ ...prev, qty: maxAllowed }));
      return;
    }

    const { hasSizes, hasAddOns, finalPrice, selectedSizeObj, selectedAddonObjs, normalizedModifiers, cartItemId } =
      resolveConfiguredItemDetails(selectedProduct, productOptions, categorySettings);

    const safeQty = Math.min(maxAllowed, Math.max(1, parseInt(productOptions.qty, 10) || 1));

    const itemToAdd = {
      ...selectedProduct,
      price: finalPrice,
      qty: safeQty,
      cup_size: hasSizes ? productOptions.cupSize : null,
      cup_size_obj: hasSizes ? selectedSizeObj : null,
      add_ons: hasAddOns ? selectedAddonObjs : [],
      modifiers: normalizedModifiers,
      cartItemId,
      baseProduct: selectedProduct
    };

    setCart((prevCart) => {
      let newCart = [...prevCart];
      if (editingCartItemId) {
        newCart = newCart.filter((item) => item.cartItemId !== editingCartItemId);
      }

      const existing = newCart.find((item) => item.cartItemId === itemToAdd.cartItemId);
      if (existing) {
        return newCart.map((item) =>
          item.cartItemId === itemToAdd.cartItemId
            ? { ...item, qty: Math.min(MAX_LINE_QTY, item.qty + itemToAdd.qty) }
            : item
        );
      }
      return [...newCart, itemToAdd];
    });

    closeOptions();
  };

  const updateAddOnQty = (addOn, qty) => {
    if (!selectedProduct) return;

    const targetAddon = selectedProduct.add_ons?.find((a) => a.name === addOn) || { name: addOn };
    const reservedForModal = calculateReservedStock({
      cart,
      ongoingOrders,
      recipesByProduct,
      ingredientsMap,
      excludeCartItemId: editingCartItemId,
      orderType
    });
    const { selectedSizeObj, selectedAddonObjs, normalizedModifiers } = resolveConfiguredItemDetails(
      selectedProduct,
      productOptions,
      categorySettings
    );

    const maxAo = getMaxAddOnQty({
      product: selectedProduct,
      cupSizeObj: selectedSizeObj,
      cupSizeName: productOptions.cupSize,
      currentAddOns: selectedAddonObjs,
      targetAddon,
      currentItemQty: productOptions.qty,
      modifiers: normalizedModifiers,
      orderType,
      recipesByProduct,
      ingredientsMap,
      reserved: reservedForModal
    });

    if (qty > maxAo) {
      showStockNotice(`Maximum ${maxAo} "${addOn}" allowed with current stock.`);
    }

    const clampedQty = Math.min(maxAo, Math.max(0, qty));

    setProductOptions((prev) => {
      const newAddOns = { ...prev.addOns };
      if (clampedQty <= 0) {
        delete newAddOns[addOn];
      } else {
        newAddOns[addOn] = clampedQty;
      }
      return { ...prev, addOns: newAddOns };
    });
  };

  const updateQty = (cartItemId, qty) => {
    if (qty <= 0) {
      removeFromCart(cartItemId);
      return;
    }

    const maxAllowed = maxQtyByCartItemId[cartItemId] ?? MAX_LINE_QTY;
    if (maxAllowed <= 0) {
      const item = cart.find((i) => i.cartItemId === cartItemId);
      showStockNotice(`No additional stock available for ${item?.name || "this item"}.`);
      return;
    }

    if (qty > maxAllowed) {
      const item = cart.find((i) => i.cartItemId === cartItemId);
      showStockNotice(`Only ${maxAllowed} available for ${item?.name || "this item"}.`);
    }

    const safeQty = Math.min(maxAllowed, Math.max(1, qty));
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.cartItemId === cartItemId ? { ...item, qty: safeQty } : item
      )
    );
  };

  const removeFromCart = (cartItemId) => {
    setCart((prevCart) => prevCart.filter((item) => item.cartItemId !== cartItemId));
  };

  const clearCart = async () => {
    if (await requestConfirm("Are you sure you want to clear the cart?")) {
      setCart([]);
      setDiscountType("NONE");
      setCustomDiscountValue("");
    }
  };

  const calculateTotal = () =>
    cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const getCartDiscountDetails = (rawSubtotal = calculateTotal()) => {
    const subtotal = parseFloat(rawSubtotal) || 0;
    const rates = {
      NONE: { label: "No Discount", rate: 0 },
      SENIOR: { label: "Senior Citizen", rate: 0.20 },
      PWD: { label: "PWD", rate: 0.20 },
      STUDENT: { label: "Student / Promo", rate: 0.10 },
      STAFF: { label: "Employee / Staff", rate: 0.15 }
    };

    let disc = 0;
    let label = "";

    if (discountType === "CUSTOM") {
      const val = Math.max(0, parseFloat(customDiscountValue) || 0);
      if (customDiscountMode === "PERCENT") {
        const pct = Math.min(100, val);
        disc = subtotal * (pct / 100);
        label = pct > 0 ? `Custom (${pct}%)` : "";
      } else {
        disc = Math.min(subtotal, val);
        label = disc > 0 ? `Custom (-₱${disc.toFixed(2)})` : "";
      }
    } else if (rates[discountType]?.rate) {
      const r = rates[discountType];
      disc = subtotal * r.rate;
      label = `${r.label} (${Math.round(r.rate * 100)}%)`;
    }

    const discountAmount = Math.round(disc * 100) / 100;
    const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    return {
      subtotal,
      discountType,
      customDiscountMode,
      customDiscountValue,
      discountAmount,
      discountLabel: label,
      finalTotal
    };
  };

  const handleDirectCheckout = () => {
    if (cart.length === 0) return;
    if (!cartStockValidation.valid) {
      showStockNotice(cartStockValidation.issues[0] || "Insufficient stock for items in cart.");
      return;
    }

    const details = getCartDiscountDetails();
    const directOrder = {
      id: Date.now(),
      items: [...cart],
      order_type: orderType,
      total: details.subtotal,
      discountType: details.discountType,
      customDiscountMode: details.customDiscountMode,
      customDiscountValue: details.customDiscountValue,
      discountAmount: details.discountAmount,
      discountLabel: details.discountLabel,
      finalTotal: details.finalTotal,
      staff_id: user.id,
      timestamp: new Date().toLocaleTimeString(),
      status: "pending",
      isDirectCartCheckout: true
    };
    setPaymentOrder(directOrder);
    setShowPaymentModal(true);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    if (!cartStockValidation.valid) {
      showStockNotice(cartStockValidation.issues[0] || "Insufficient stock for items in cart.");
      return;
    }

    try {
      const details = getCartDiscountDetails();
      const newOrder = {
        id: Date.now(),
        items: [...cart],
        order_type: orderType,
        total: details.subtotal,
        discountType: details.discountType,
        customDiscountMode: details.customDiscountMode,
        customDiscountValue: details.customDiscountValue,
        discountAmount: details.discountAmount,
        discountLabel: details.discountLabel,
        finalTotal: details.finalTotal,
        staff_id: user.id,
        timestamp: new Date().toLocaleTimeString(),
        status: "pending"
      };
      setOngoingOrders((prev) => [...prev, newOrder]);
      setCart([]);
      setOrderType("DINE_IN");
      setDiscountType("NONE");
      setCustomDiscountValue("");
      setActiveTab("ongoing");
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    const order = ongoingOrders.find((o) => o.id === orderId);
    if (!order) return;

    let latestProducts = products;
    let latestRecipes = recipes;
    let latestIngredients = ingredients;

    try {
      const freshCatalog = await fetchCatalog({ silent: true });
      if (freshCatalog) {
        latestProducts = freshCatalog.products;
        latestRecipes = freshCatalog.recipes;
        latestIngredients = freshCatalog.ingredients;
      }
    } catch (err) {
      console.error("Failed to fetch latest catalog before checkout", err);
    }

    const latestProductsMap = {};
    (latestProducts || []).forEach((p) => {
      if (p?.id) latestProductsMap[p.id] = p;
    });
    const latestRecipesMap = buildRecipesByProductMap(latestRecipes);
    const latestIngredientsMap = buildIngredientsMap(latestIngredients);

    let updatedTotal = 0;
    const updatedItems = order.items.map((item) => {
      const rawLatest = latestProductsMap[item.id];
      if (!rawLatest) {
        updatedTotal += item.price * item.qty;
        return item;
      }

      const latestProd = getVirtualProduct(rawLatest);
      let finalPrice = parseFloat(latestProd.price || 0);
      let updatedCupObj = item.cup_size_obj || null;

      if (item.cup_size_obj || item.cup_size) {
        const sizeName = item.cup_size_obj?.name || item.cup_size;
        const sz = latestProd.sizes?.find((s) => s.name === sizeName);
        if (sz) {
          updatedCupObj = sz;
          finalPrice += parseFloat(sz.price_add || 0);
        } else if (item.cup_size_obj) {
          finalPrice += parseFloat(item.cup_size_obj.price_add || 0);
        } else {
          if (item.cup_size === "16 oz") finalPrice += 10;
          if (item.cup_size === "22 oz") finalPrice += 20;
        }
      }

      let updatedAddOns = item.add_ons || [];
      if (Array.isArray(item.add_ons) && item.add_ons.length > 0) {
        updatedAddOns = item.add_ons.map((ao) => {
          const latestAo = latestProd.add_ons?.find((a) => a.name === ao.name);
          const customerQty = ao.customer_qty || 1;
          if (latestAo) {
            finalPrice += parseFloat(latestAo.price || 0) * customerQty;
            return { ...latestAo, customer_qty: customerQty };
          }
          finalPrice += parseFloat(ao.price || 0) * customerQty;
          return ao;
        });
      }

      updatedTotal += finalPrice * item.qty;
      return {
        ...item,
        category: latestProd.category,
        track_stock: latestProd.track_stock,
        price: finalPrice,
        cup_size_obj: updatedCupObj,
        add_ons: updatedAddOns,
        baseProduct: { ...latestProd }
      };
    });

    const updatedOrder = {
      ...order,
      items: updatedItems,
      total: updatedTotal
    };

    setOngoingOrders((prev) => prev.map((o) => (o.id === orderId ? updatedOrder : o)));

    const validation = validateItemsAgainstStock(updatedOrder.items, {
      productsMap: latestProductsMap,
      recipesByProduct: latestRecipesMap,
      ingredientsMap: latestIngredientsMap,
      reserved: null,
      orderType: updatedOrder.order_type || "DINE_IN"
    });

    if (!validation.valid) {
      showStockNotice(
        `Cannot pay Order #${orderId}: ${validation.issues[0]}. Edit the order to adjust quantities.`
      );
      return;
    }

    setPaymentOrder(updatedOrder);
    setShowPaymentModal(true);
  };

  const confirmPayment = async (paymentData) => {
    if (!paymentOrder) return;

    const subtotal = parseFloat(paymentOrder.total) || 0;
    const discountAmount = parseFloat(paymentData.discountAmount) || 0;
    const finalTotal =
      paymentData.finalTotal !== undefined
        ? parseFloat(paymentData.finalTotal)
        : Math.max(0, subtotal - discountAmount);
    const discountLabel = paymentData.discountLabel || "";
    const resolvedOrderType = paymentOrder.order_type || orderType || "DINE_IN";
    const resolvedDiscountType = paymentData.discountType || paymentOrder.discountType || "NONE";

    const saleData = {
      cart: paymentOrder.items,
      total: finalTotal,
      discount_amount: discountAmount,
      discount_type: resolvedDiscountType,
      discount_id_number: paymentData.discountIdNumber || "",
      customer_name: paymentData.customerName || "",
      promo_code: paymentData.promoCode || "",
      custom_discount_mode: paymentData.customDiscountMode || null,
      custom_discount_value: paymentData.customDiscountValue ?? null,
      staff_id: user.id,
      order_type: resolvedOrderType,
      payment_method: paymentData.method,
      amount_received: paymentData.amountReceived || 0,
      change_amount: paymentData.change || 0,
      transaction_reference: paymentData.reference || "",
      payments: Array.isArray(paymentData.payments) ? paymentData.payments : null,
      idempotency_key: paymentData.idempotencyKey || null,
      notes: discountLabel ? `Discount: ${discountLabel}` : ""
    };

    let res;
    try {
      res = await createSale(saleData);
    } catch (err) {
      void fetchCatalog({ silent: true });
      throw err;
    }

    void fetchCatalog({ silent: true });
    const createdSale = res?.sale || res || {};
    const resolvedDiscountDetails =
      createdSale.discount_details ||
      (resolvedDiscountType && resolvedDiscountType !== "NONE"
        ? {
            discount_type: resolvedDiscountType,
            discount_label: discountLabel,
            label: discountLabel,
            customer_name: paymentData.customerName || null,
            discount_id_number: paymentData.discountIdNumber || null,
            promo_code: paymentData.promoCode || null
          }
        : null);

    const immediateReceipt = {
      id: createdSale.id || `LOCAL-${Date.now()}`,
      receipt_number: createdSale.receipt_number || `RCP-${Date.now().toString().slice(-6)}`,
      created_at: createdSale.created_at || new Date().toISOString(),
      order_type: createdSale.order_type || resolvedOrderType,
      status: createdSale.status || "COMPLETED",
      void_info: createdSale.void_info || null,
      subtotal_amount: createdSale.subtotal_amount ?? subtotal,
      discount_amount:
        createdSale.discount_amount !== undefined ? Number(createdSale.discount_amount) : discountAmount,
      discount_label: discountLabel,
      discount_details: resolvedDiscountDetails,
      tax_amount: createdSale.tax_amount || 0,
      total_amount:
        createdSale.total_amount !== undefined ? Number(createdSale.total_amount) : finalTotal,
      payment_method: createdSale.payment_method || paymentData.method,
      payments: createdSale.payments || paymentData.payments || null,
      amount_received:
        createdSale.amount_received !== undefined
          ? Number(createdSale.amount_received)
          : paymentData.amountReceived || finalTotal,
      change_amount:
        createdSale.change_amount !== undefined ? Number(createdSale.change_amount) : paymentData.change || 0,
      transaction_reference: createdSale.transaction_reference || paymentData.reference || "",
      notes: createdSale.notes || saleData.notes,
      users: {
        name: user?.name || user?.username || "Staff"
      },
      sale_items: (paymentOrder.items || []).map((item, idx) => ({
        id: item.cartItemId || `${item.id}-${idx}`,
        quantity: item.qty,
        unit_price: item.price,
        cup_size: item.cup_size || null,
        add_ons: item.add_ons || [],
        modifiers: item.modifiers || null,
        products: {
          id: item.id,
          name: item.name,
          category: item.category
        }
      }))
    };

    if (paymentOrder.isDirectCartCheckout) {
      setCart([]);
      setOrderType("DINE_IN");
      setDiscountType("NONE");
      setCustomDiscountValue("");
    } else {
      setOngoingOrders((prev) => prev.filter((o) => o.id !== paymentOrder.id));
    }
    setShowPaymentModal(false);
    setPaymentOrder(null);
    setCompletedSaleId(createdSale.id || null);
    setCompletedReceipt(immediateReceipt);
    setShowReceiptModal(true);
    setSaleComplete(true);
    setTimeout(() => setSaleComplete(false), 3000);
  };

  const closeReceiptModal = () => {
    setShowReceiptModal(false);
    setCompletedSaleId(null);
    setCompletedReceipt(null);
  };

  const handleCancelOrder = async (orderId) => {
    if (await requestConfirm("Are you sure you want to cancel this order?")) {
      setOngoingOrders((prev) => prev.filter((o) => o.id !== orderId));
    }
  };

  const handleEditOrder = (orderId) => {
    const order = ongoingOrders.find((o) => o.id === orderId);
    if (!order) return;

    setCart((prevCart) => {
      const newCart = [...prevCart];
      order.items.forEach((orderItem) => {
        const existingIndex = newCart.findIndex((item) => item.cartItemId === orderItem.cartItemId);
        if (existingIndex >= 0) {
          const existing = newCart[existingIndex];
          newCart[existingIndex] = {
            ...existing,
            qty: Math.min(MAX_LINE_QTY, existing.qty + orderItem.qty)
          };
        } else {
          newCart.push({
            ...orderItem,
            qty: Math.min(MAX_LINE_QTY, Math.max(1, orderItem.qty))
          });
        }
      });
      return newCart;
    });

    if (order.order_type) setOrderType(order.order_type);
    if (order.discountType) setDiscountType(order.discountType);
    if (order.customDiscountMode) setCustomDiscountMode(order.customDiscountMode);
    if (order.customDiscountValue !== undefined) setCustomDiscountValue(order.customDiscountValue);
    setOngoingOrders((prev) => prev.filter((o) => o.id !== orderId));
    setActiveTab("cart");
  };

  return {
    products,
    recipes,
    recipesByProduct,
    ingredientsMap,
    categories,
    categorySettings,
    cart,
    orderType,
    setOrderType,
    searchTerm,
    setSearchTerm,
    category,
    setCategory,
    loading,
    catalogLoaded,
    saleComplete,
    recipeProduct: activeRecipeProduct,
    setRecipeProduct,
    recipeProductSummary,
    recipeLoading: !catalogLoaded && loading,
    stockSummaryByProductId,
    maxQtyByCartItemId,
    cartStockValidation,
    stockIssuesByOrderId,
    stockNotice,
    clearStockNotice,
    ongoingOrders,
    activeTab,
    setActiveTab,
    showOptions,
    closeOptions,
    selectedProduct,
    productOptions,
    setProductOptions,
    optionsModalStock,
    openOptions,
    openEditOptions,
    editingCartItemId,
    handleAddWithOptions,
    updateAddOnQty,
    updateQty,
    removeFromCart,
    clearCart,
    calculateTotal,
    discountType,
    setDiscountType,
    customDiscountMode,
    setCustomDiscountMode,
    customDiscountValue,
    setCustomDiscountValue,
    getCartDiscountDetails,
    handleDirectCheckout,
    handleCompleteSale,
    handleCompleteOrder,
    handleCancelOrder,
    handleEditOrder,
    user,
    showPaymentModal,
    setShowPaymentModal,
    paymentOrder,
    confirmPayment,
    showReceiptModal,
    completedSaleId,
    completedReceipt,
    closeReceiptModal,
    confirmConfig
  };
};
