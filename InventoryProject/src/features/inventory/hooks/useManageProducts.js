import { useState, useEffect } from 'react';
import { supabase } from '../../../config/supabaseClient';
import { getAllProducts, createProduct, updateProduct, archiveProduct, restoreProduct, receiveProductStock } from '../../../api/productsApi';
import { checkDuplicateOrSimilar } from '../../../utils/productUtils';
import { getRecipesByProduct, createRecipe, updateRecipe, deleteRecipe } from '../../../api/recipesApi';
import { getIngredients } from '../../../api/inventoryApi';

export const useManageProducts = () => {
  const [viewMode, setViewMode] = useState('ADD'); 
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); 
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const [formData, setFormData] = useState({ 
    name: '', 
    category: '', 
    price: '',
    image_url: '',
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
  const [editImageUrl, setEditImageUrl] = useState('');
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
          setEditImageUrl(prod.image_url || '');
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

  const handleImageUpload = async (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `product-${Date.now()}-${Math.random()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cms-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('cms-images')
        .getPublicUrl(filePath);

      if (isEdit) {
        setEditImageUrl(data.publicUrl);
      } else {
        setFormData(prev => ({ ...prev, image_url: data.publicUrl }));
      }
    } catch (err) {
      console.error(err);
      setMessage('Error uploading image.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUploading(false);
    }
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

  const handleAddProduct = async (e, forceCreate = false, skipConfirm = false) => {
    if (e) e.preventDefault();
    const newName = formData.name.trim().toUpperCase();

    if (!skipConfirm) {
      setConfirmConfig({
        isOpen: true,
        title: 'Confirm Add',
        message: `Are you sure you want to add "${newName}" as a new product?`,
        onConfirm: () => {
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          handleAddProduct(null, forceCreate, true);
        }
      });
      return;
    }

    // Frontend strict match check
    if (!forceCreate) {
      const similarityMatch = checkDuplicateOrSimilar(formData.name, products);
      if (similarityMatch) {
        setConfirmConfig({
          isOpen: true,
          title: similarityMatch.isExactMatch ? 'Duplicate Detected' : 'Similar Product Detected',
          message: similarityMatch.isExactMatch 
            ? `WARNING: A product with the exact name "${similarityMatch.matchName}" already exists. Do you still want to add it?`
            : `WARNING: The product "${similarityMatch.matchName}" sounds very similar to what you're adding. Are you sure you want to proceed?`,
          onConfirm: () => {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            handleAddProduct(null, true);
          }
        });
        return;
      }
    }

    try {
      await createProduct({
        name: newName,
        category: formData.category,
        price: parseFloat(formData.price),
        image_url: formData.image_url,
        track_stock: formData.track_stock,
        stock_quantity: 0,
        low_stock_threshold: parseFloat(formData.low_stock_threshold) || 0,
        force_create: forceCreate
      });
      setMessage('Product created successfully!');
      setFormData({ 
        name: '', 
        category: '', 
        price: '', 
        image_url: '',
        track_stock: false, 
        low_stock_threshold: 5 
      });
      fetchProducts();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      if (err.payload?.is_duplicate_warning) {
        setConfirmConfig({
          isOpen: true,
          title: 'Duplicate Detected',
          message: err.message + '\n\nDo you still want to proceed?',
          onConfirm: () => {
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            handleAddProduct(null, true);
          }
        });
      } else {
        setMessage('Error: ' + err.message);
      }
    }
  };

  const handleArchiveToggle = (id, isArchived) => {
    if (isProcessing) return;
    const product = products.find(p => p.id === id);
    const prodName = product ? `"${product.name}"` : 'this product';

    setConfirmConfig({
      isOpen: true,
      title: isArchived ? 'Restore Product?' : 'Archive Product?',
      message: isArchived
        ? `Are you sure you want to restore ${prodName}? It will become active and available again on the POS register and online menus.`
        : `Are you sure you want to archive ${prodName}? It will be hidden from the POS register and menus, but historical sales records will remain preserved.`,
      confirmText: isArchived ? 'Yes, Restore' : 'Yes, Archive',
      confirmColor: isArchived ? 'success' : 'danger',
      onConfirm: async () => {
        if (isProcessing) return;
        setIsProcessing(true);
        setProcessingId(id);
        try {
          if (isArchived) {
            await restoreProduct(id);
            setMessage(`Product ${prodName} restored successfully.`);
          } else {
            await archiveProduct(id);
            setMessage(`Product ${prodName} archived.`);
          }
          setTimeout(() => setMessage(''), 3000);
          await fetchProducts();
        } catch (err) {
          console.error('Archiving error:', err);
          setMessage('Error updating product status: ' + (err.message || 'Please try again.'));
          setTimeout(() => setMessage(''), 4000);
        } finally {
          setIsProcessing(false);
          setProcessingId(null);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleSetRecipe = async (product) => {
    setSelectedProduct(product);
    setEditPrice(product.price);
    setEditName(product.name);
    setEditCategory(product.category);
    setEditImageUrl(product.image_url || '');
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
        const updatedName = editName.trim().toUpperCase();
        const proceedWithUpdate = async () => {
          try {
            await updateProduct(selectedProduct.id, {
              name: updatedName,
              category: editCategory,
              price: parseFloat(editPrice),
              image_url: editImageUrl,
              track_stock: editTrackStock,
              stock_quantity: parseFloat(editStockQty),
              low_stock_threshold: parseFloat(editThreshold),
              sizes: editSizes,
              add_ons: editAddOns
            });
            setMessage('Product details updated successfully!');
            fetchProducts();
            setViewMode('ADD');
            setSelectedProduct(null);
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
            setTimeout(() => setMessage(''), 3000);
          } catch (err) {
            if (err.message.includes('already exists')) {
              setMessage('WARNING: ' + err.message);
              setTimeout(() => setMessage(''), 3000);
            } else {
              setMessage('Error updating product: ' + err.message);
              setTimeout(() => setMessage(''), 3000);
            }
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          }
        };

        const similarityMatch = checkDuplicateOrSimilar(editName, products, selectedProduct.id);
        if (similarityMatch) {
          const message = similarityMatch.isExactMatch 
            ? `WARNING: A product with the name "${similarityMatch.matchName}" already exists. Do you still want to update to this name?`
            : `WARNING: The name sounds very similar to an existing product "${similarityMatch.matchName}". Do you still want to update?`;
          
          setConfirmConfig({
            isOpen: true,
            title: similarityMatch.isExactMatch ? 'Duplicate Detected' : 'Similar Product Detected',
            message: message,
            onConfirm: proceedWithUpdate
          });
          return;
        }

        proceedWithUpdate();
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
    if (e && e.preventDefault) e.preventDefault();
    
    const qty = parseFloat(newRecipeItem.quantity);
    if (!newRecipeItem.ingredient_id) {
      setMessage('Please select an ingredient.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setMessage('Please enter a valid quantity greater than 0.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    const ingredient = allIngredients.find(i => i.id === newRecipeItem.ingredient_id);
    const unit = (newRecipeItem.input_unit || ingredient?.unit || '').toUpperCase();

    try {
      setIsProcessing(true);
      await createRecipe({
        product_id: selectedProduct.id,
        ingredient_id: newRecipeItem.ingredient_id,
        quantity_used: qty,
        recipe_unit: unit
      });

      setMessage(`Added ${qty} ${unit} of ${ingredient?.name || 'ingredient'} to recipe!`);
      setNewRecipeItem({ ingredient_id: '', quantity: '', input_unit: '' });
      const data = await getRecipesByProduct(selectedProduct.id);
      setRecipe(data || []);
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setMessage('Error adding ingredient: ' + err.message);
      setTimeout(() => setMessage(''), 3500);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateRecipeItem = async (recipeId, quantityUsed, recipeUnit) => {
    try {
      setIsProcessing(true);
      await updateRecipe(recipeId, {
        quantity_used: parseFloat(quantityUsed),
        recipe_unit: recipeUnit
      });
      setMessage('Recipe ingredient updated successfully');
      const data = await getRecipesByProduct(selectedProduct.id);
      setRecipe(data || []);
      setTimeout(() => setMessage(''), 2000);
    } catch (err) {
      setMessage('Error updating recipe ingredient: ' + err.message);
      setTimeout(() => setMessage(''), 3500);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    viewMode, setViewMode,
    products, loading, uploading, message, setMessage,
    isProcessing, processingId,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    confirmConfig, setConfirmConfig,
    formData, setFormData, handleInputChange, handleImageUpload,
    selectedProduct, setSelectedProduct,
    recipe, allIngredients,
    newRecipeItem, setNewRecipeItem,
    newSize, setNewSize,
    newAddOn, setNewAddOn,
    editPrice, setEditPrice,
    editName, setEditName,
    editCategory, setEditCategory,
    editImageUrl, setEditImageUrl,
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
    handleAddRecipeItem,
    handleUpdateRecipeItem
  };
};
