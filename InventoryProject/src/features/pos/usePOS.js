import { useState, useEffect } from "react";
import { getProducts, createSale } from '../../api/posApi';
import { getCategorySettings } from '../../api/categorySettingsApi';
import { getRecipesByProduct } from "../../api/recipesApi";
import { getCurrentUser } from "../../utils/authUtils";

export const usePOS = () => {
  const [products, setProducts] = useState([]);
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
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState([]);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState(null);

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const requestConfirm = (message) => {
    return new Promise((resolve) => {
      setConfirmConfig({
        isOpen: true,
        message,
        onConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          resolve(false);
        }
      });
    });
  };

  const user = getCurrentUser();

  // FETCH PRODUCTS AND SETTINGS
  useEffect(() => {
    fetchProducts();
    fetchCategorySettings();
  }, []);

  const fetchCategorySettings = async () => {
    try {
      const data = await getCategorySettings();
      const settingsMap = {};
      (data || []).forEach(item => {
        settingsMap[item.category] = item;
      });
      setCategorySettings(settingsMap);
    } catch (err) {
      console.error("Failed to fetch category settings", err);
    }
  };

  // PERSIST STATE
  useEffect(() => {
    localStorage.setItem("pos_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem("pos_ongoingOrders", JSON.stringify(ongoingOrders));
  }, [ongoingOrders]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data || []);
    } catch (err) {
      console.error("Failed to load products:", err);
    } finally {
      setLoading(false);
    }
  };

  // FETCH RECIPE FOR MODAL
  useEffect(() => {
    if (recipeProduct) {
      loadRecipe(recipeProduct.id);
    } else {
      setCurrentRecipe([]);
    }
  }, [recipeProduct]);

  const loadRecipe = async (productId) => {
    try {
      setRecipeLoading(true);
      const data = await getRecipesByProduct(productId);
      setCurrentRecipe(data || []);
    } catch (err) {
      console.error("Failed to load recipe:", err);
    } finally {
      setRecipeLoading(false);
    }
  };

  const [showOptions, setShowOptions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingCartItemId, setEditingCartItemId] = useState(null);
  const [productOptions, setProductOptions] = useState({
    qty: 1,
    cupSize: "12 oz",
    addOns: {}
  });

  const openOptions = (product) => {
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
        const existingNames = virtualProduct.add_ons.map(a => a.name);
        catSettings.add_ons.forEach(ca => {
          if (!existingNames.includes(ca.name)) {
            virtualProduct.add_ons.push(ca);
          }
        });
      }
    }

    setSelectedProduct(virtualProduct);
    let defaultSize = "12 oz";
    if (virtualProduct.sizes && virtualProduct.sizes.length > 0) {
      defaultSize = virtualProduct.sizes[0].name; // Default to first configured size
    }
    setProductOptions({ qty: 1, cupSize: defaultSize, addOns: {} });
    setEditingCartItemId(null);
    setShowOptions(true);
  };

  const openEditOptions = (cartItemId) => {
    const item = cart.find(i => i.cartItemId === cartItemId);
    if (!item || !item.baseProduct) return;

    setSelectedProduct(item.baseProduct);
    
    const reconstructedAddOns = {};
    if (item.add_ons && item.add_ons.length > 0) {
      item.add_ons.forEach(ao => {
        reconstructedAddOns[ao.name] = ao.customer_qty || 1;
      });
    }

    setProductOptions({
      qty: item.qty,
      cupSize: item.cup_size || (item.baseProduct.sizes?.[0]?.name) || "12 oz",
      addOns: reconstructedAddOns
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
    const isDrink = ["COFFEE", "FRAPPE", "MILK TEA", "SODA", "FRUIT DRINKS"].includes(selectedProduct.category?.toUpperCase());
    
    let finalPrice = parseFloat(selectedProduct.price);
    let selectedSizeObj = null;
    let selectedAddonObjs = [];

    if (isDrink) {
      if (selectedProduct.sizes && selectedProduct.sizes.length > 0) {
        selectedSizeObj = selectedProduct.sizes.find(s => s.name === productOptions.cupSize);
        if (selectedSizeObj) finalPrice += parseFloat(selectedSizeObj.price_add || 0);
      } else {
        // Legacy fallback
        if (productOptions.cupSize === "16 oz") finalPrice += 10;
        if (productOptions.cupSize === "22 oz") finalPrice += 20;
      }

      Object.entries(productOptions.addOns).forEach(([addonName, customerQty]) => {
        // Handle dynamic addons attached to the virtualProduct (which includes category defaults)
        if (selectedProduct.add_ons && selectedProduct.add_ons.length > 0) {
          const ao = selectedProduct.add_ons.find(a => a.name === addonName);
          if (ao) {
            finalPrice += parseFloat(ao.price || 0) * customerQty;
            selectedAddonObjs.push({...ao, customer_qty: customerQty});
            return;
          }
        }
        
        // Legacy string fallback if absolutely nothing was found
        selectedAddonObjs.push({name: addonName, price: 0, customer_qty: customerQty});
      });
    }

    const itemToAdd = {
      ...selectedProduct,
      price: finalPrice,
      qty: productOptions.qty,
      cup_size: isDrink ? productOptions.cupSize : null,
      cup_size_obj: selectedSizeObj,
      add_ons: isDrink ? selectedAddonObjs : [],
      cartItemId: isDrink 
        ? `${selectedProduct.id}-${productOptions.cupSize}-${Object.entries(productOptions.addOns).map(([n, q]) => `${n}x${q}`).sort().join(',')}`
        : `${selectedProduct.id}-standard`,
      baseProduct: selectedProduct
    };

    setCart(prevCart => {
      let newCart = [...prevCart];
      if (editingCartItemId) {
        newCart = newCart.filter(item => item.cartItemId !== editingCartItemId);
      }

      const existing = newCart.find(item => item.cartItemId === itemToAdd.cartItemId);
      if (existing) {
        return newCart.map(item =>
          item.cartItemId === itemToAdd.cartItemId
            ? { ...item, qty: item.qty + itemToAdd.qty }
            : item
        );
      }
      return [...newCart, itemToAdd];
    });

    closeOptions();
  };

  const updateAddOnQty = (addOn, qty) => {
    setProductOptions(prev => {
      const newAddOns = { ...prev.addOns };
      if (qty <= 0) {
        delete newAddOns[addOn];
      } else {
        newAddOns[addOn] = qty;
      }
      return { ...prev, addOns: newAddOns };
    });
  };

  const updateQty = (cartItemId, qty) => {
    if (qty <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setCart(cart.map(item =>
      item.cartItemId === cartItemId ? { ...item, qty } : item
    ));
  };

  const removeFromCart = (cartItemId) => {
    setCart(cart.filter(item => item.cartItemId !== cartItemId));
  };

  const clearCart = async () => {
    if (await requestConfirm("Are you sure you want to clear the cart?")) {
      setCart([]);
    }
  };

  const calculateTotal = () =>
    cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    if (!(await requestConfirm("Are you sure you want to create this order?"))) return;
    try {
      const newOrder = {
        id: Date.now(),
        items: [...cart],
        total: calculateTotal(),
        staff_id: user.id,
        timestamp: new Date().toLocaleTimeString(),
        status: 'pending'
      };
      setOngoingOrders([...ongoingOrders, newOrder]);
      clearCart();
      setActiveTab('ongoing');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompleteOrder = async (orderId) => {
    const order = ongoingOrders.find(o => o.id === orderId);
    if (!order) return;

    // Fetch the latest product prices to ensure we charge the correct amount
    try {
      const latestProducts = await getProducts();
      if (latestProducts && latestProducts.length > 0) {
        let updatedTotal = 0;
        const updatedItems = order.items.map(item => {
          const latestProd = latestProducts.find(p => p.id === item.id);
          if (latestProd) {
            let finalPrice = parseFloat(latestProd.price || 0);

            // Re-apply size price
            if (item.cup_size_obj) {
              const sz = latestProd.sizes?.find(s => s.name === item.cup_size_obj.name);
              if (sz) finalPrice += parseFloat(sz.price_add || 0);
            } else if (item.cup_size) {
              if (item.cup_size === "16 oz") finalPrice += 10;
              if (item.cup_size === "22 oz") finalPrice += 20;
            }

            // Re-apply add-ons
            if (item.add_ons && item.add_ons.length > 0) {
              item.add_ons.forEach(ao => {
                const latestAo = latestProd.add_ons?.find(a => a.name === ao.name);
                if (latestAo) finalPrice += parseFloat(latestAo.price || 0) * (ao.customer_qty || 1);
                else finalPrice += parseFloat(ao.price || 0) * (ao.customer_qty || 1); // fallback
              });
            }
            
            item.price = finalPrice;
          }
          updatedTotal += (item.price * item.qty);
          return item;
        });

        order.items = updatedItems;
        order.total = updatedTotal;
        
        // Update the ongoing order in state so the UI reflects the new total
        setOngoingOrders(prev => prev.map(o => o.id === orderId ? order : o));
      }
    } catch (err) {
      console.error("Failed to fetch latest prices before checkout", err);
    }

    setPaymentOrder(order);
    setShowPaymentModal(true);
  };

  const confirmPayment = async (paymentData) => {
    if (!paymentOrder) return;

    const saleData = {
      cart: paymentOrder.items,
      total: paymentOrder.total,
      staff_id: user.id,
      payment_method: paymentData.method,
      amount_received: paymentData.amountReceived || 0,
      change_amount: paymentData.change || 0,
      transaction_reference: paymentData.reference || "",
    };

    // Let any error bubble up to PaymentModal so it can re-enable the button
    await createSale(saleData);

    setOngoingOrders(ongoingOrders.filter(o => o.id !== paymentOrder.id));
    setShowPaymentModal(false);
    setPaymentOrder(null);
    setSaleComplete(true);
    setTimeout(() => setSaleComplete(false), 3000);
  };

  const handleCancelOrder = async (orderId) => {
    if (await requestConfirm("Are you sure you want to cancel this order?")) {
      setOngoingOrders(ongoingOrders.filter(o => o.id !== orderId));
    }
  };

  const handleEditOrder = (orderId) => {
    const order = ongoingOrders.find(o => o.id === orderId);
    if (!order) return;
    setCart(prevCart => {
      let newCart = [...prevCart];
      order.items.forEach(orderItem => {
        const existing = newCart.find(item => item.cartItemId === orderItem.cartItemId);
        if (existing) {
          existing.qty += orderItem.qty;
        } else {
          newCart.push({ ...orderItem });
        }
      });
      return newCart;
    });
    setOngoingOrders(ongoingOrders.filter(o => o.id !== orderId));
    setActiveTab('cart');
  };

  return {
    products,
    cart,
    searchTerm,
    setSearchTerm,
    category,
    setCategory,
    loading,
    saleComplete,
    recipeProduct,
    setRecipeProduct,
    ongoingOrders,
    activeTab,
    setActiveTab,
    recipeLoading,
    currentRecipe,
    showOptions,
    closeOptions,
    selectedProduct,
    productOptions,
    setProductOptions,
    openOptions,
    openEditOptions,
    editingCartItemId,
    handleAddWithOptions,
    updateAddOnQty,
    updateQty,
    removeFromCart,
    clearCart,
    calculateTotal,
    handleCompleteSale,
    handleCompleteOrder,
    handleCancelOrder,
    handleEditOrder,
    user,
    showPaymentModal,
    setShowPaymentModal,
    paymentOrder,
    confirmPayment,
    confirmConfig
  };
};
