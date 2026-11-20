import React from 'react';
import {
  useDemandForecasting,
  ING_PAGE_SIZE,
  PROD_PAGE_SIZE,
} from './hooks/useDemandForecasting';
import IngredientRestockTab from './components/IngredientRestockTab';
import MenuDemandTab from './components/MenuDemandTab';
import ForecastCreatePOModal from './components/ForecastCreatePOModal';
import MonthlyProjectionModal from './components/MonthlyProjectionModal';
import ForecastGuideModal from './components/ForecastGuideModal';

const DemandForecasting = () => {
  const {
    activeTab, handleTabSwitch,
    infoModalOpen, setInfoModalOpen, infoGuideTab, setInfoGuideTab, openInfoGuide,
    ingredientData, loadingIngredients,
    statusFilter, setStatusFilter, searchTerm, setSearchTerm,
    selectedCategory, setSelectedCategory, selectedIngredientIds,
    ingPage, setIngPage, ingSortField, ingSortDirection, handleIngSort,
    categories, filteredIngredients, paginatedIngredients,
    fetchIngredientForecast, handleToggleSelectAll, handleToggleItemSelect,
    handleResetIngredientFilters, handleOrderAllCritical, handleOpenSingleItemPO, handleOpenBatchPO,
    loadingProducts, productSearch, setProductSearch,
    productCategory, setProductCategory, prodPage, setProdPage,
    prodSortField, prodSortDirection, handleProdSort,
    productCategories, filteredProducts, paginatedProducts, productSummary, fetchProductForecasts,
    aiModalOpen, setAiModalOpen, aiSelectedProduct,
    aiTargetYear, aiTargetMonth, aiLoading, aiResult,
    handleOpenMonthlyModal, handleSelectAiYear, handleSelectAiMonth,
    suppliers, poModalOpen, setPoModalOpen,
    poTargetSupplierId, handleSelectPoSupplier, poItems,
    poExpectedDate, setPoExpectedDate, poNotes, setPoNotes, submittingPO,
    handleUpdatePoItemQty, handleRemovePoItem, calculatePoTotal, handleConfirmSubmitPO,
    toast, setToast,
  } = useDemandForecasting();

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
            className="text-zinc-400 hover:text-white cursor-pointer bg-transparent border-none p-0.5 inline-flex items-center justify-center"
            aria-label="Dismiss notification"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
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

      {/* TAB 1: INGREDIENT RESTOCK */}
      {activeTab === 'ingredients' && (
        <IngredientRestockTab
          ingredientData={ingredientData}
          loadingIngredients={loadingIngredients}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          filteredIngredients={filteredIngredients}
          paginatedIngredients={paginatedIngredients}
          selectedIngredientIds={selectedIngredientIds}
          ingPage={ingPage}
          setIngPage={setIngPage}
          pageSize={ING_PAGE_SIZE}
          ingSortField={ingSortField}
          ingSortDirection={ingSortDirection}
          onIngSort={handleIngSort}
          onToggleSelectAll={handleToggleSelectAll}
          onToggleItemSelect={handleToggleItemSelect}
          onResetFilters={handleResetIngredientFilters}
          onOpenBatchPO={handleOpenBatchPO}
          onOrderAllCritical={handleOrderAllCritical}
          onOpenSingleItemPO={handleOpenSingleItemPO}
          onOpenGuide={() => openInfoGuide('ingredients')}
          onRefresh={() => fetchIngredientForecast(true)}
        />
      )}

      {/* TAB 2: MENU DEMAND (7-DAY PRODUCT SALES FORECAST) */}
      {activeTab === 'products' && (
        <MenuDemandTab
          loadingProducts={loadingProducts}
          productSummary={productSummary}
          productSearch={productSearch}
          setProductSearch={setProductSearch}
          productCategory={productCategory}
          setProductCategory={setProductCategory}
          productCategories={productCategories}
          filteredProducts={filteredProducts}
          paginatedProducts={paginatedProducts}
          prodPage={prodPage}
          setProdPage={setProdPage}
          pageSize={PROD_PAGE_SIZE}
          prodSortField={prodSortField}
          prodSortDirection={prodSortDirection}
          onProdSort={handleProdSort}
          onOpenMonthlyModal={handleOpenMonthlyModal}
          onOpenGuide={() => openInfoGuide('products')}
          onRefresh={() => fetchProductForecasts(true)}
        />
      )}

      {/* PURCHASE ORDER GENERATION MODAL */}
      <ForecastCreatePOModal
        isOpen={poModalOpen}
        onClose={() => setPoModalOpen(false)}
        suppliers={suppliers}
        poTargetSupplierId={poTargetSupplierId}
        setPoTargetSupplierId={handleSelectPoSupplier}
        poExpectedDate={poExpectedDate}
        setPoExpectedDate={setPoExpectedDate}
        poItems={poItems}
        poNotes={poNotes}
        setPoNotes={setPoNotes}
        submittingPO={submittingPO}
        onUpdateQty={handleUpdatePoItemQty}
        onRemoveItem={handleRemovePoItem}
        poTotal={calculatePoTotal()}
        onConfirmSubmit={handleConfirmSubmitPO}
      />

      {/* MONTHLY PRODUCT PROJECTION MODAL */}
      <MonthlyProjectionModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        selectedProduct={aiSelectedProduct}
        targetYear={aiTargetYear}
        targetMonth={aiTargetMonth}
        loading={aiLoading}
        result={aiResult}
        onSelectYear={handleSelectAiYear}
        onSelectMonth={handleSelectAiMonth}
      />

      {/* HOW FORECASTING WORKS MODAL */}
      <ForecastGuideModal
        isOpen={infoModalOpen}
        onClose={() => setInfoModalOpen(false)}
        guideTab={infoGuideTab}
        setGuideTab={setInfoGuideTab}
      />
    </div>
  );
};

export default DemandForecasting;
