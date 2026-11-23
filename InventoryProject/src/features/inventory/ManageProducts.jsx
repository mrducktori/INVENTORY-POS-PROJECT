import React, { useState, useMemo } from 'react';
import { useManageProducts } from './hooks/useManageProducts';
import ConfirmModal from '../../components/shared/ConfirmModal';
import { getCurrentUser } from '../../utils/authUtils';
import { canAccess } from '../../utils/permissions';
import CategorySettingsModal from './components/products/CategorySettingsModal';
import AddProductFormSection from './components/products/AddProductFormSection';
import ProductListSection from './components/products/ProductListSection';
import ArchivedProductsSection from './components/products/ArchivedProductsSection';
import ModifyProductSection from './components/products/ModifyProductSection';
import ModifyProductModal from './components/products/ModifyProductModal';

const ManageProducts = () => {
  const user = getCurrentUser();
  const [showCategorySettings, setShowCategorySettings] = useState(false);

  // Sorting & Pagination States
  const [sortField, setSortField] = useState('name'); // 'name' | 'price'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [modifyCurrentPage, setModifyCurrentPage] = useState(1);

  const {
    viewMode, setViewMode,
    products, categories, fetchCategories, loading, uploading, message, setMessage,
    fetchProducts,
    isProcessing, processingId,
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    categoryFilter, setCategoryFilter,
    confirmConfig, setConfirmConfig,
    formData, handleInputChange, handleImageUpload,
    selectedProduct, setSelectedProduct,
    recipe, allIngredients,
    newRecipeItem, setNewRecipeItem,
    editPrice, setEditPrice,
    editName, setEditName,
    editCategory, setEditCategory,
    editImageUrl,
    editTrackStock, setEditTrackStock,
    editStockQty,
    editThreshold, setEditThreshold,
    handleAddProduct,
    handleArchiveToggle,
    handlePermanentDeleteProduct,
    handleSetRecipe,
    handleUpdateProduct,
    handleDeleteRecipeItem,
    handleAddRecipeItem,
    handleUpdateRecipeItem
  } = useManageProducts();

  const archivedProductsList = useMemo(() => {
    return products.filter(p => p.is_archived);
  }, [products]);

  const filteredProductsList = useMemo(() => {
    const term = (searchTerm || '').trim().toLowerCase();
    return products.filter(p => {
      const matchSearch = !term || (p.name || '').toLowerCase().includes(term) || (p.category || '').toLowerCase().includes(term);
      const matchStatus = statusFilter === 'ALL' ? true : statusFilter === 'ACTIVE' ? !p.is_archived : p.is_archived;
      const matchCat = categoryFilter === 'ALL' || p.category === categoryFilter;
      return matchSearch && matchStatus && matchCat;
    });
  }, [products, searchTerm, statusFilter, categoryFilter]);

  // Reset pagination helpers on search or filter change
  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setCurrentPage(1);
    setModifyCurrentPage(1);
  };

  const handleStatusFilterChange = (val) => {
    setStatusFilter(val);
    setCurrentPage(1);
    setModifyCurrentPage(1);
  };

  const handleCategoryFilterChange = (val) => {
    setCategoryFilter(val);
    setCurrentPage(1);
    setModifyCurrentPage(1);
  };

  // Sort Handlers
  const handlePriceSort = () => {
    if (sortField !== 'price') {
      setSortField('price');
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      // Back to nothing: returns to alphabetical A-Z
      setSortField('name');
      setSortDirection('asc');
    }
    setCurrentPage(1);
    setModifyCurrentPage(1);
  };

  const handleNameSort = () => {
    if (sortField !== 'name') {
      setSortField('name');
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortDirection('asc');
    }
    setCurrentPage(1);
    setModifyCurrentPage(1);
  };

  // Sorted product list
  const sortedProductsList = useMemo(() => {
    const list = [...filteredProductsList];
    if (sortField === 'price') {
      if (sortDirection === 'asc') {
        list.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
      } else {
        list.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
      }
    } else {
      // Default / Alphabetical
      if (sortDirection === 'desc') {
        list.sort((a, b) => b.name.localeCompare(a.name));
      } else {
        list.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
    return list;
  }, [filteredProductsList, sortField, sortDirection]);

  // Paginated items for Table View (Add Product mode)
  const totalPages = Math.max(1, Math.ceil(sortedProductsList.length / itemsPerPage));
  const paginatedProductsList = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedProductsList.slice(start, start + itemsPerPage);
  }, [sortedProductsList, currentPage, itemsPerPage]);

  // Paginated items for Modify Existing Grid mode
  const activeModifyProducts = useMemo(() => {
    return sortedProductsList.filter(p => !p.is_archived);
  }, [sortedProductsList]);
  const modifyItemsPerPage = 12;
  const modifyTotalPages = Math.max(1, Math.ceil(activeModifyProducts.length / modifyItemsPerPage));
  const paginatedModifyProducts = useMemo(() => {
    const start = (modifyCurrentPage - 1) * modifyItemsPerPage;
    return activeModifyProducts.slice(start, start + modifyItemsPerPage);
  }, [activeModifyProducts, modifyCurrentPage, modifyItemsPerPage]);

  if (!canAccess(user, 'ManageProducts')) {
    return <div className="p-6 flex-1 bg-gray-50"><h2 className="text-xl font-bold text-red-600">Access Denied</h2></div>;
  }

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Product Management</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">Create and manage products, categories, and ingredient recipes.</p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-3 bg-white p-1.5 rounded-xl shadow-sm border border-gray-200">
          <button
            className={`px-4 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${viewMode === 'ADD' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
            onClick={() => { setViewMode('ADD'); setMessage(''); }}
          >
            Add Product
          </button>
          <button
            className={`px-4 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${viewMode === 'MODIFY' ? 'bg-gray-900 text-white shadow-md' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
            onClick={() => { setViewMode('MODIFY'); setMessage(''); }}
          >
            Modify Existing
          </button>
          <button
            className="px-4 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-lg text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all ml-auto md:ml-0 border border-gray-200 bg-white cursor-pointer"
            onClick={() => setShowCategorySettings(true)}
          >
            Manage Categories
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded-xl text-base font-bold flex items-center shadow-sm ${message.includes('success') || message.includes('updated') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{message}</div>
      )}

      {viewMode === 'ADD' && (
        <div className="flex flex-col lg:flex-row items-start gap-6">
          <AddProductFormSection
            formData={formData}
            categories={categories}
            uploading={uploading}
            onInputChange={handleInputChange}
            onImageUpload={handleImageUpload}
            onSubmit={handleAddProduct}
          />

          <ProductListSection
            loading={loading}
            products={paginatedProductsList}
            categories={categories}
            totalItems={sortedProductsList.length}
            searchTerm={searchTerm}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            onSearchChange={handleSearchChange}
            onCategoryFilterChange={handleCategoryFilterChange}
            onStatusFilterChange={handleStatusFilterChange}
            sortField={sortField}
            sortDirection={sortDirection}
            onNameSort={handleNameSort}
            onPriceSort={handlePriceSort}
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newSize) => {
              setItemsPerPage(newSize);
              setCurrentPage(1);
            }}
            isProcessing={isProcessing}
            processingId={processingId}
            onEdit={handleSetRecipe}
            onArchiveToggle={handleArchiveToggle}
            onPermanentDelete={handlePermanentDeleteProduct}
          />
        </div>
      )}

      {/* Dedicated Archived Products Section matching Image 2 */}
      <ArchivedProductsSection
        archivedProducts={archivedProductsList}
        processingId={processingId}
        onRefresh={fetchProducts}
        onRestore={(id) => handleArchiveToggle(id, true)}
        onPermanentDelete={handlePermanentDeleteProduct}
      />

      {viewMode === 'MODIFY' && (
        <ModifyProductSection
          loading={loading}
          products={paginatedModifyProducts}
          categories={categories}
          totalItems={activeModifyProducts.length}
          searchTerm={searchTerm}
          categoryFilter={categoryFilter}
          onSearchChange={handleSearchChange}
          onCategoryFilterChange={handleCategoryFilterChange}
          currentPage={modifyCurrentPage}
          totalPages={modifyTotalPages}
          itemsPerPage={modifyItemsPerPage}
          onPageChange={setModifyCurrentPage}
          onEdit={handleSetRecipe}
        />
      )}

      {selectedProduct && (
        <ModifyProductModal
          selectedProduct={selectedProduct}
          categories={categories}
          onClose={() => { setSelectedProduct(null); setMessage(''); }}
          editName={editName}
          setEditName={setEditName}
          editCategory={editCategory}
          setEditCategory={setEditCategory}
          editPrice={editPrice}
          setEditPrice={setEditPrice}
          editImageUrl={editImageUrl}
          uploading={uploading}
          onImageUpload={handleImageUpload}
          editTrackStock={editTrackStock}
          setEditTrackStock={setEditTrackStock}
          editStockQty={editStockQty}
          editThreshold={editThreshold}
          setEditThreshold={setEditThreshold}
          onUpdateProduct={handleUpdateProduct}
          recipe={recipe}
          allIngredients={allIngredients}
          newRecipeItem={newRecipeItem}
          setNewRecipeItem={setNewRecipeItem}
          onAddRecipeItem={handleAddRecipeItem}
          onUpdateRecipeItem={handleUpdateRecipeItem}
          onDeleteRecipeItem={handleDeleteRecipeItem}
          message={message}
          onClearMessage={() => setMessage('')}
        />
      )}

      {showCategorySettings && (
        <CategorySettingsModal
          allIngredients={allIngredients}
          onClose={() => setShowCategorySettings(false)}
          onCategoriesChanged={async () => {
            const updated = await fetchCategories();
            await fetchProducts();
            if (categoryFilter !== 'ALL' && Array.isArray(updated) && !updated.includes(categoryFilter)) {
              setCategoryFilter('ALL');
            }
          }}
        />
      )}

      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        confirmColor={confirmConfig.confirmColor}
        cancelText={confirmConfig.cancelText}
        isLoading={isProcessing}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default ManageProducts;
