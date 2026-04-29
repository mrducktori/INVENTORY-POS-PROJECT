import { useState, useEffect } from "react";
import { getProducts, createSale } from "../../api/posApi";
import { getRecipesByProduct } from "../../api/recipesApi";
import { getCurrentUser } from "../../utils/authUtils";

export const usePOS = () => {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const [saleComplete, setSaleComplete] = useState(false);
  const [recipeProduct, setRecipeProduct] = useState(null);
  const [ongoingOrders, setOngoingOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("cart"); 
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState([]);

  const user = getCurrentUser();

  // FETCH PRODUCTS
  useEffect(() => {
    fetchProducts();
  }, []);

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
  const [productOptions, setProductOptions] = useState({
    qty: 1,
    cupSize: "Medium",
    addOns: []
  });

  const openOptions = (product) => {
    setSelectedProduct(product);
    setProductOptions({ qty: 1, cupSize: "Medium", addOns: [] });
    setShowOptions(true);
  };

  const handleAddWithOptions = () => {
    const isDrink = ["COFFEE", "FRAPPE", "MILK TEA", "SODA"].includes(selectedProduct.category?.toUpperCase());
    
    const itemToAdd = {
      ...selectedProduct,
      qty: productOptions.qty,
      cup_size: isDrink ? productOptions.cupSize : null,
      add_ons: isDrink ? productOptions.addOns : [],
      cartItemId: isDrink 
        ? `${selectedProduct.id}-${productOptions.cupSize}-${productOptions.addOns.sort().join(',')}`
        : `${selectedProduct.id}-standard`
    };

    setCart(prevCart => {
      const existing = prevCart.find(item => item.cartItemId === itemToAdd.cartItemId);
      if (existing) {
        return prevCart.map(item =>
          item.cartItemId === itemToAdd.cartItemId
            ? { ...item, qty: item.qty + itemToAdd.qty }
            : item
        );
      }
      return [...prevCart, itemToAdd];
    });

    setShowOptions(false);
    setSelectedProduct(null);
  };

  const toggleAddOn = (addOn) => {
    setProductOptions(prev => ({
      ...prev,
      addOns: prev.addOns.includes(addOn)
        ? prev.addOns.filter(a => a !== addOn)
        : [...prev.addOns, addOn]
    }));
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

  const clearCart = () => setCart([]);

  const calculateTotal = () =>
    cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
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
    try {
      const order = ongoingOrders.find(o => o.id === orderId);
      if (!order) return;
      await createSale({
        cart: order.items,
        total: order.total,
        staff_id: user.id
      });
      setOngoingOrders(ongoingOrders.filter(o => o.id !== orderId));
      setSaleComplete(true);
      setTimeout(() => setSaleComplete(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Error completing order: " + err.message);
    }
  };

  const handleCancelOrder = (orderId) => {
    setOngoingOrders(ongoingOrders.filter(o => o.id !== orderId));
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
    setShowOptions,
    selectedProduct,
    productOptions,
    setProductOptions,
    openOptions,
    handleAddWithOptions,
    toggleAddOn,
    updateQty,
    removeFromCart,
    clearCart,
    calculateTotal,
    handleCompleteSale,
    handleCompleteOrder,
    handleCancelOrder,
    handleEditOrder,
    user
  };
};
