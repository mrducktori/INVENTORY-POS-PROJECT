import { useState, useEffect } from 'react';
import { getAllProducts, createProduct, updateProduct, archiveProduct, restoreProduct, receiveProductStock } from '../../../api/productsApi';
import { getRecipesByProduct, updateRecipe, createRecipe, deleteRecipe } from '../../../api/recipesApi';
import { getIngredients } from '../../../api/inventoryApi';

export const useManageProducts = () => {
  const [viewMode, setViewMode] = useState('ADD'); 
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); 
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [formData, setFormData] = useState({ 
    name: '', 
    category: '', 
    price: '',
    track_stock: false,
    low_stock_threshold: 5
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recipe, setRecipe] = useState([]);
  const [allIngredients, setAllIngredients] = useState([]);
  const [newRecipeItem, setNewRecipeItem] = useState({ ingredient_id: '', quantity: '', input_unit: '' });
  const [editPrice, setEditPrice] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTrackStock, setEditTrackStock] = useState(false);
  const [editStockQty, setEditStockQty] = useState(0);
  const [editThreshold, setEditThreshold] = useState(5);
  const [editSizes, setEditSizes] = useState([]);
  const [editAddOns, setEditAddOns] = useState([]);

  const [newSize, setNewSize] = useState({ name: '', price_add: '', ingredient_id: '' });
  const [newAddOn, setNewAddOn] = useState({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });

  useEffect(() => {
    fetchProducts();
    fetchIngredients();
  }, []);

  const fetchIngredients = async () => {
    try {
      const data = await getIngredients();
      setAllIngredients(data || []);
    } catch (err) {
      console.error('Failed to load ingredients:', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await getAllProducts();
      setProducts(data || []);
      if (selectedProduct) {
        const prod = (data || []).find(p => p.id === selectedProduct.id);
        if (prod) {
          setSelectedProduct(prod);
          setEditPrice(prod.price);
          setEditName(prod.name);
          setEditCategory(prod.category);
          setEditTrackStock(prod.track_stock || false);
          setEditStockQty(prod.stock_quantity || 0);
          setEditThreshold(prod.low_stock_threshold || 5);
        }
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : value });
  };

  const handleReceiveProductStock = async (productId, qty) => {
    if (!qty || parseFloat(qty) <= 0) return;
    
    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Stock Receipt',
      message: `Are you sure you want to add ${qty} units to the stock?`,
      onConfirm: async () => {
        try {
          await receiveProductStock(productId, parseFloat(qty));
          setMessage('Stock received successfully!');
          fetchProducts();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(''), 3000);
        } catch (err) {
          setMessage('Error receiving stock: ' + err.message);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleAddProduct = async (e) => {
    if (e) e.preventDefault();
    try {
      await createProduct({
        name: formData.name.trim().toUpperCase(),
        category: formData.category,
        price: parseFloat(formData.price),
        track_stock: formData.track_stock,
        stock_quantity: 0,
        low_stock_threshold: parseFloat(formData.low_stock_threshold) || 0
      });
      setMessage('Product created successfully!');
      setFormData({ 
        name: '', 
        category: '', 
        price: '', 
        track_stock: false, 
        low_stock_threshold: 5 
      });
      fetchProducts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Error: ' + err.message);
    }
  };

  const handleArchiveToggle = async (id, isArchived) => {
    try {
      if (isArchived) {
        await restoreProduct(id);
      } else {
        await archiveProduct(id);
      }
      fetchProducts();
    } catch (err) {
      console.error('Archiving error:', err);
      alert('Error updating product status');
    }
  };

  const handleSetRecipe = async (product) => {
    setViewMode('MODIFY');
    setSelectedProduct(product);
    setEditPrice(product.price);
    setEditName(product.name);
    setEditCategory(product.category);
    setEditTrackStock(product.track_stock || false);
    setEditStockQty(product.stock_quantity || 0);
    setEditThreshold(product.low_stock_threshold || 5);
    setEditSizes(product.sizes || []);
    setEditAddOns(product.add_ons || []);
    try {
      const data = await getRecipesByProduct(product.id);
      setRecipe(data || []);
    } catch (err) {
      console.error('Failed to load recipe:', err);
    }
  };

  const handleUpdateProduct = async (e) => {
    if (e) e.preventDefault();
    
    setConfirmConfig({
      isOpen: true,
      title: 'Confirm Update',
      message: `Are you sure you want to save changes to "${selectedProduct.name}"?`,
      onConfirm: async () => {
        try {
          await updateProduct(selectedProduct.id, {
            name: editName.trim().toUpperCase(),
            category: editCategory,
            price: parseFloat(editPrice),
            track_stock: editTrackStock,
            stock_quantity: parseFloat(editStockQty),
            low_stock_threshold: parseFloat(editThreshold),
            sizes: editSizes,
            add_ons: editAddOns
          });
          setMessage('Product details updated successfully!');
          fetchProducts();
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(''), 3000);
        } catch (err) {
          setMessage('Error updating product: ' + err.message);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleDeleteRecipeItem = async (recipeId) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Remove Ingredient',
      message: 'Are you sure you want to remove this ingredient from the recipe?',
      onConfirm: async () => {
        try {
          await deleteRecipe(recipeId);
          setRecipe(recipe.filter(r => r.id !== recipeId));
          setMessage('Ingredient removed from recipe');
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(''), 2000);
        } catch (err) {
          setMessage('Error removing ingredient: ' + err.message);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleAddSize = (e) => {
    if (e) e.preventDefault();
    if (!newSize.name) return;
    setEditSizes(prev => [...prev, { ...newSize, price_add: parseFloat(newSize.price_add) || 0 }]);
    setNewSize({ name: '', price_add: '', ingredient_id: '' });
  };

  const handleRemoveSize = (index) => {
    setEditSizes(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddAddOn = (e) => {
    if (e) e.preventDefault();
    if (!newAddOn.name) return;
    setEditAddOns(prev => [...prev, { 
      ...newAddOn, 
      price: parseFloat(newAddOn.price) || 0,
      quantity: parseFloat(newAddOn.quantity) || 0
    }]);
    setNewAddOn({ name: '', price: '', ingredient_id: '', quantity: '', unit: '' });
  };

  const handleRemoveAddOn = (index) => {
    setEditAddOns(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddRecipeItem = async (e) => {
    if (e) e.preventDefault();
    
    const qty = parseFloat(newRecipeItem.quantity);
    const ingredient = allIngredients.find(i => i.id === newRecipeItem.ingredient_id);
    const unit = (newRecipeItem.input_unit || ingredient?.unit || '').toUpperCase();

    setConfirmConfig({
      isOpen: true,
      title: 'Add to Recipe',
      message: `Add ${qty} ${unit} of ${ingredient?.name} to this product's recipe?`,
      onConfirm: async () => {
        try {
          // We now store the raw quantity and the specific unit chosen (ML, G, etc.)
          // The backend (posService) will handle the conversion during sale deduction.
          await createRecipe({
            product_id: selectedProduct.id,
            ingredient_id: newRecipeItem.ingredient_id,
            quantity_used: qty,
            recipe_unit: unit
          });

          setMessage('Ingredient added to recipe!');
          setNewRecipeItem({ ingredient_id: '', quantity: '', input_unit: '' });
          const data = await getRecipesByProduct(selectedProduct.id);
          setRecipe(data || []);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          setTimeout(() => setMessage(''), 2000);
        } catch (err) {
          setMessage('Error adding ingredient: ' + err.message);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  return {
    viewMode, setViewMode,
    products, loading, message, setMessage,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    confirmConfig, setConfirmConfig,
    formData, setFormData, handleInputChange,
    selectedProduct, setSelectedProduct,
    recipe, allIngredients,
    newRecipeItem, setNewRecipeItem,
    newSize, setNewSize,
    newAddOn, setNewAddOn,
    editPrice, setEditPrice,
    editName, setEditName,
    editCategory, setEditCategory,
    editTrackStock, setEditTrackStock,
    editStockQty, setEditStockQty,
    editThreshold, setEditThreshold,
    editSizes, setEditSizes,
    editAddOns, setEditAddOns,
    handleAddSize, handleRemoveSize,
    handleAddAddOn, handleRemoveAddOn,
    handleReceiveProductStock,
    handleAddProduct,
    handleArchiveToggle,
    handleSetRecipe,
    handleUpdateProduct,
    handleDeleteRecipeItem,
    handleAddRecipeItem
  };
};
