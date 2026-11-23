import React, { useState } from "react";
import { createPortal } from "react-dom";
import { filterProducts, getProductOptionsAvailability } from "../../utils/productUtils";
import CategoryFilter from "../../components/shared/CategoryFilter";
import ProductCard from "./components/ProductCard";
import Cart from "./components/Cart";
import OngoingOrders from "./components/OngoingOrders";
import PaymentModal from "./components/PaymentModal";
import ProductOptionsModal from "./components/ProductOptionsModal";
import ProductInfoModal from "./components/ProductInfoModal";
import PosKdsSection from "./components/PosKdsSection";
import PosVoidRefundSection from "./components/PosVoidRefundSection";
import PosShiftReadingSection from "./components/PosShiftReadingSection";
import PosSettingsModal from "./components/PosSettingsModal";
import ExtraSupplyButton from "./components/ExtraSupplyButton";
import SalesReceiptModal from "../../components/SalesReceiptModal";
import ConfirmModal from "../../components/shared/ConfirmModal";
import { CardGridSkeleton } from "../../components/shared/SkeletonLoader";
import { usePOS } from "./hooks/usePOS";

const WORKSPACE_TABS = [
  { id: "REGISTER", label: "Register" },
  { id: "KDS", label: "Order Queue / KDS" },
  { id: "VOIDS", label: "Void & Refund" },
  { id: "SHIFTS", label: "Shifts (X/Z)" }
];

const POS = ({ subTab = null, onSubTabChange = null }) => {
  const [localWorkspace, setLocalWorkspace] = useState("REGISTER");
  const [localShowPosSettings, setLocalShowPosSettings] = useState(false);
  const {
    products,
    ingredients,
    recipesByProduct,
    ingredientsMap,
    categories,
    categorySettings,
    posSettings,
    setPosSettings,
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
    showStockNotice,
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
  } = usePOS();

  const filteredProducts = filterProducts(products, category, searchTerm, categories);
  const selectedOptionsAvailability = getProductOptionsAvailability(selectedProduct, categorySettings);
  const isManagerRole = user?.role === "Owner" || user?.role === "Admin";
  const isControlledSubTab = typeof onSubTabChange === "function";
  const workspace = isControlledSubTab
    ? (subTab === "KDS" || subTab === "VOIDS" || subTab === "SHIFTS" ? subTab : "REGISTER")
    : localWorkspace;
  const showPosSettings = isControlledSubTab
    ? (subTab === "SETUP" && isManagerRole)
    : localShowPosSettings;

  const setActiveWorkspace = (nextTab) => {
    setLocalWorkspace(nextTab);
    onSubTabChange?.(nextTab === "REGISTER" ? null : nextTab);
  };

  const openPosSetup = () => {
    setLocalShowPosSettings(true);
    onSubTabChange?.("SETUP");
  };

  const closePosSetup = () => {
    setLocalShowPosSettings(false);
    if (subTab === "SETUP") onSubTabChange?.(null);
  };

  return (
    <div className="flex flex-col h-full lg:h-[calc(100vh-0px)] w-full bg-gray-50 overflow-hidden relative">
      {/* Top Workspace Switcher */}
      <div className="px-4 md:px-6 py-2.5 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <svg className="w-5 h-5 text-gray-900" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <span className="text-sm font-bold text-gray-900 tracking-tight">POS Operations</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
            {WORKSPACE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveWorkspace(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                  workspace === tab.id
                    ? "bg-gray-900 text-white shadow-xs"
                    : "bg-transparent text-gray-600 hover:text-gray-900 hover:bg-white/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isManagerRole && (
            <button
              type="button"
              onClick={openPosSetup}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              POS Setup
            </button>
          )}
        </div>
      </div>
      {saleComplete &&
        createPortal(
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-[100001] animate-[popupSlideUp_var(--dur-slow)_var(--ease-out-expo)] font-semibold tracking-wide">
            Transaction completed successfully!
          </div>,
          document.body
        )}

      {stockNotice &&
        createPortal(
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-xl z-[100002] animate-[popupSlideUp_var(--dur-slow)_var(--ease-out-expo)] flex items-center gap-3 max-w-md border border-amber-400/50">
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

      {workspace === "KDS" && (
        <PosKdsSection
          categorySettings={categorySettings}
          ongoingOrders={ongoingOrders}
          onOpenOngoingOrder={() => {
            setLocalWorkspace("REGISTER");
            setActiveTab("ongoing");
            onSubTabChange?.(null);
          }}
        />
      )}
      {workspace === "VOIDS" && <PosVoidRefundSection user={user} />}
      {workspace === "SHIFTS" && <PosShiftReadingSection user={user} />}

      {workspace === "REGISTER" && (
        <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden">
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

            <div className="flex justify-end px-3 py-2 border-b border-gray-200">
              <ExtraSupplyButton onNotice={showStockNotice} />
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
                    type="button"
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gray-900 transition-all hover:bg-black hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    onClick={handleDirectCheckout}
                    disabled={cart.length === 0 || !cartStockValidation.valid}
                  >
                    Pay Now (Direct Checkout)
                  </button>
                  <button
                    type="button"
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-gray-800 bg-gray-100 border border-gray-200 transition-colors hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    onClick={handleCompleteSale}
                    disabled={cart.length === 0 || !cartStockValidation.valid}
                  >
                    Hold / Queue Order
                  </button>
                  <button
                    type="button"
                    className="w-full py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer bg-transparent border-none"
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
        </div>
      )}

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
          posSettings={posSettings}
          onConfirm={confirmPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Store POS Setup Modal */}
      {showPosSettings && (
        <PosSettingsModal
          allIngredients={ingredients}
          initialSettings={posSettings}
          onSaved={(saved) => setPosSettings(saved)}
          onClose={closePosSetup}
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
