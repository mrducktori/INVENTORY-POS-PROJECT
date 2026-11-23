import React from "react";
import { createPortal } from "react-dom";
import { filterProducts, getProductOptionsAvailability } from "../../utils/productUtils";
import CategoryFilter from "../../components/shared/CategoryFilter";
import ProductCard from "./components/ProductCard";
import Cart from "./components/Cart";
import OngoingOrders from "./components/OngoingOrders";
import PaymentModal from "./components/PaymentModal";
import ProductOptionsModal from "./components/ProductOptionsModal";
import ProductInfoModal from "./components/ProductInfoModal";
import SalesReceiptModal from "../../components/SalesReceiptModal";
import ConfirmModal from "../../components/shared/ConfirmModal";
import { CardGridSkeleton } from "../../components/shared/SkeletonLoader";
import { usePOS } from "./hooks/usePOS";

const POS = () => {
  const {
    products,
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
    saleComplete,
    recipeProduct,
    setRecipeProduct,
    recipeProductSummary,
    recipeLoading,
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
    handleCompleteSale,
    handleCompleteOrder,
    handleCancelOrder,
    handleEditOrder,
    showPaymentModal,
    setShowPaymentModal,
    paymentOrder,
    confirmPayment,
    showReceiptModal,
    completedSaleId,
    completedReceipt,
    closeReceiptModal,
    confirmConfig
  } = usePOS();

  const filteredProducts = filterProducts(products, category, searchTerm, categories);
  const selectedOptionsAvailability = getProductOptionsAvailability(selectedProduct, categorySettings);

  return (
    <div className="flex flex-col lg:flex-row h-full lg:h-[calc(100vh-0px)] w-full bg-gray-50 overflow-hidden relative">
      {saleComplete &&
        createPortal(
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-[100001] animate-[fadeIn_0.3s_ease-out] font-semibold tracking-wide">
            Transaction completed successfully!
          </div>,
          document.body
        )}

      {stockNotice &&
        createPortal(
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl z-[100002] animate-[fadeIn_0.2s_ease-out] flex items-center gap-3 max-w-md border border-amber-400/50">
            <svg
              className="w-5 h-5 text-amber-400 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <span className="text-sm font-semibold leading-snug">{stockNotice}</span>
            <button
              type="button"
              onClick={clearStockNotice}
              className="text-gray-400 hover:text-white transition-colors bg-transparent border-none p-0.5 cursor-pointer shrink-0"
              aria-label="Dismiss notice"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>,
          document.body
        )}

      {/* LEFT - Products */}
      <div className="flex-[2] flex flex-col p-4 md:p-6 overflow-hidden border-r border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h2 className="m-0 text-2xl font-bold text-gray-900 tracking-tight">Point of Sale</h2>
          <input
            type="text"
            placeholder="Search products..."
            className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg text-sm md:text-base bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <CategoryFilter category={category} setCategory={setCategory} categories={categories} />

        <div className="flex-1 overflow-y-auto mt-6 scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 pb-20">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 md:gap-6">
            {loading ? (
              <div className="col-span-full">
                <CardGridSkeleton count={8} />
              </div>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  stockSummary={stockSummaryByProductId[product.id]}
                  onClick={() => openOptions(product)}
                  onViewRecipe={(p) => setRecipeProduct(p)}
                />
              ))
            ) : (
              <div className="text-gray-500 col-span-full text-center py-10">No products found</div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT - Cart/Ongoing Orders */}
      <div className="flex-1 flex flex-col bg-white min-w-[320px] max-w-full lg:max-w-[400px] z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.03)]">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/50">
          <button
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              activeTab === "cart"
                ? "border-gray-900 text-gray-900 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => setActiveTab("cart")}
          >
            Cart ({cart.length})
          </button>
          <button
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors border-b-2 cursor-pointer ${
              activeTab === "ongoing"
                ? "border-gray-900 text-gray-900 bg-white"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => setActiveTab("ongoing")}
          >
            Ongoing ({ongoingOrders.length})
          </button>
        </div>

        {/* Cart Tab */}
        {activeTab === "cart" && (
          <>
            <Cart
              cart={cart}
              total={calculateTotal()}
              maxQtyByCartItemId={maxQtyByCartItemId}
              orderType={orderType}
              onOrderTypeChange={setOrderType}
              onUpdateQty={updateQty}
              onRemove={removeFromCart}
              onEdit={openEditOptions}
            />

            <div className="p-4 border-t border-gray-200 bg-white mt-auto flex flex-col gap-2">
              {cart.length > 0 && !cartStockValidation.valid && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
                  {cartStockValidation.issues[0] || "Insufficient stock for items in cart."}
                </div>
              )}
              <button
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gray-900 transition-all hover:bg-black hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                onClick={handleCompleteSale}
                disabled={cart.length === 0 || !cartStockValidation.valid}
              >
                Create Order
              </button>
              <button
                className="w-full py-2 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                Clear Cart
              </button>
            </div>
          </>
        )}

        {/* Ongoing Orders Tab */}
        {activeTab === "ongoing" && (
          <OngoingOrders
            orders={ongoingOrders}
            stockIssuesByOrderId={stockIssuesByOrderId}
            onComplete={handleCompleteOrder}
            onCancel={handleCancelOrder}
            onEdit={handleEditOrder}
          />
        )}
      </div>

      {/* Options Modal */}
      {showOptions && selectedProduct && (
        <ProductOptionsModal
          key={`${selectedProduct.id}-${editingCartItemId || "new"}`}
          selectedProduct={selectedProduct}
          editingCartItemId={editingCartItemId}
          productOptions={productOptions}
          setProductOptions={setProductOptions}
          optionsAvailability={selectedOptionsAvailability}
          optionsStock={optionsModalStock}
          productRecipes={selectedProduct ? (recipesByProduct[selectedProduct.id] || []) : []}
          ingredientsMap={ingredientsMap}
          onUpdateAddOnQty={updateAddOnQty}
          onConfirm={handleAddWithOptions}
          onClose={closeOptions}
        />
      )}

      {/* Ingredients & Availability Info Modal */}
      {recipeProduct && (
        <ProductInfoModal
          product={recipeProduct}
          stockSummary={recipeProductSummary}
          loading={recipeLoading}
          onClose={() => setRecipeProduct(null)}
          onAddToOrder={(productToAdd) => {
            openOptions(productToAdd);
            setRecipeProduct(null);
          }}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          onConfirm={confirmPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Digital Receipt Modal after Completed Transaction */}
      {showReceiptModal && (completedReceipt || completedSaleId) && (
        <SalesReceiptModal
          saleId={completedSaleId}
          initialReceipt={completedReceipt}
          onClose={closeReceiptModal}
        />
      )}

      {/* Confirmation Modal */}
      <ConfirmModal {...confirmConfig} />
    </div>
  );
};

export default POS;
