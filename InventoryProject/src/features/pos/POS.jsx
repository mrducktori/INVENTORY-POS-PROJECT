import React from "react";
import { filterProducts, formatQuantity } from "../../utils/productUtils";
import CategoryFilter from '../../components/shared/CategoryFilter';
import ProductCard from "./components/ProductCard";
import Cart from "./components/Cart";
import OngoingOrders from "./components/OngoingOrders";
import PaymentModal from "./components/PaymentModal";
import SalesReceiptModal from "../../components/SalesReceiptModal";
import ConfirmModal from "../../components/shared/ConfirmModal";
import { CardGridSkeleton } from "../../components/shared/SkeletonLoader";
import { usePOS } from "./usePOS";

const POS = () => {
  const {
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

  const filteredProducts = filterProducts(products, category, searchTerm);

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-gray-50 overflow-hidden relative">
      {saleComplete && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-[fadeIn_0.3s_ease-out] font-semibold tracking-wide">
          Transaction completed successfully!
        </div>
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

        <CategoryFilter category={category} setCategory={setCategory} />

        <div className="flex-1 overflow-y-auto mt-6 scrollbar-thin scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400 pb-20">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 md:gap-6">
            {loading ? (
              <div className="col-span-full">
                <CardGridSkeleton count={8} />
              </div>
            ) : filteredProducts.length > 0 ? (
              filteredProducts.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
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
            className={`flex-1 py-4 text-sm md:text-base font-semibold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'cart' ? 'border-gray-900 text-gray-900 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveTab('cart')}
          >
            Transaction ({cart.length})
          </button>
          <button
            className={`flex-1 py-4 text-sm md:text-base font-semibold uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'ongoing' ? 'border-gray-900 text-gray-900 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveTab('ongoing')}
          >
            Ongoing Orders ({ongoingOrders.length})
          </button>
        </div>

        {/* Cart Tab */}
        {activeTab === 'cart' && (
          <>
            <Cart
              cart={cart}
              total={calculateTotal()}
              discountType={discountType}
              onSelectDiscountType={setDiscountType}
              customDiscountMode={customDiscountMode}
              onSelectCustomDiscountMode={setCustomDiscountMode}
              customDiscountValue={customDiscountValue}
              onChangeCustomDiscountValue={setCustomDiscountValue}
              discountDetails={getCartDiscountDetails()}
              onUpdateQty={updateQty}
              onRemove={removeFromCart}
              onEdit={openEditOptions}
            />

            <div className="p-4 border-t border-gray-200 bg-gray-50 mt-auto flex flex-col gap-2.5">
              <button
                className="w-full py-3.5 rounded-xl text-sm md:text-base font-bold uppercase tracking-wider text-white bg-gray-900 transition-all hover:bg-black hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                onClick={handleDirectCheckout}
                disabled={cart.length === 0}
              >
                Checkout &amp; Pay Now
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="w-full py-2.5 rounded-xl text-xs md:text-sm font-bold uppercase tracking-wider text-gray-800 bg-white border border-gray-300 transition-all hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  onClick={handleCompleteSale}
                  disabled={cart.length === 0}
                >
                  Hold Order
                </button>
                <button
                  className="w-full py-2.5 rounded-xl text-xs md:text-sm font-semibold uppercase tracking-wider text-red-600 bg-red-50 border border-red-200 transition-all hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </>
        )}

        {/* Ongoing Orders Tab */}
        {activeTab === 'ongoing' && (
          <OngoingOrders
            orders={ongoingOrders}
            onComplete={handleCompleteOrder}
            onCancel={handleCancelOrder}
            onEdit={handleEditOrder}
          />
        )}
      </div>
      {/* Options Modal */}
      {showOptions && selectedProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) closeOptions(); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[calc(100vh-5rem)] md:max-h-[calc(100vh-6rem)] animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="m-0 text-lg md:text-xl font-bold tracking-wide">{editingCartItemId ? 'Edit:' : 'Customize:'} {selectedProduct.name}</h3>
              <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0" onClick={closeOptions} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[65vh] scrollbar-thin scrollbar-thumb-gray-200">
              {/* Quantity */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm md:text-base font-bold text-gray-800 uppercase tracking-wider">Quantity</label>
                  <span className="text-xs md:text-sm text-gray-500 font-semibold">Limit: 1 – 99</span>
                </div>
                <div className="flex items-center gap-1 border-2 border-gray-300 rounded-xl overflow-hidden w-40">
                  <button 
                    type="button"
                    className="flex-1 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                    onClick={() => setProductOptions(p => ({...p, qty: Math.max(1, p.qty - 1)}))}
                    disabled={productOptions.qty <= 1}
                  >−</button>
                  <input 
                    type="number" 
                    min="1" 
                    max="99" 
                    className="w-16 text-center text-gray-900 font-black text-xl border-none focus:outline-none bg-white p-0" 
                    value={productOptions.qty} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (isNaN(val)) return;
                      setProductOptions(p => ({ ...p, qty: Math.min(99, Math.max(1, val)) }));
                    }}
                  />
                  <button 
                    type="button"
                    className="flex-1 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed" 
                    onClick={() => setProductOptions(p => ({...p, qty: Math.min(99, p.qty + 1)}))}
                    disabled={productOptions.qty >= 99}
                  >+</button>
                </div>
              </div>

              {/* Cup Size & Add-ons - Only for Drinks */}
              {["COFFEE", "FRAPPE", "MILK TEA", "SODA", "FRUIT DRINKS"].includes(selectedProduct.category?.toUpperCase()) && (
                <>
                  <div className="mb-6">
                    <label className="block text-sm md:text-base font-bold text-gray-800 uppercase tracking-wider mb-2">Cup Size</label>
                    <div className="flex gap-2.5 flex-wrap">
                      {(selectedProduct.sizes?.length > 0 ? selectedProduct.sizes.map(s => s.name) : ["12 oz", "16 oz", "22 oz"]).map(size => (
                        <button 
                          key={size}
                          className={`px-5 py-2.5 text-sm md:text-base font-bold uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${productOptions.cupSize === size ? "bg-gray-900 text-white border-gray-900 shadow-md" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"}`}
                          onClick={() => setProductOptions(p => ({...p, cupSize: size}))}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm md:text-base font-bold text-gray-800 uppercase tracking-wider">Add-ons</label>
                      <span className="text-xs md:text-sm text-gray-500 font-semibold">Max 5 per add-on</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(() => {
                        let addonsToList = selectedProduct.add_ons?.length > 0 
                          ? selectedProduct.add_ons.map(a => a.name)
                          : ["Pearl", "Nata", "Jelly", "Pudding", "Extra Sugar", "Extra Ice"];
                        
                        return addonsToList.map(addon => {
                          const currentQty = productOptions.addOns[addon] || 0;
                          return (
                            <div key={addon} className={`flex flex-col p-3 rounded-xl border-2 transition-colors ${currentQty > 0 ? 'bg-indigo-50/60 border-indigo-400' : 'bg-white border-gray-200'}`}>
                              <span className="text-sm md:text-base font-bold text-gray-900 mb-2 truncate">{addon}</span>
                              <div className="flex items-center justify-between mt-auto">
                                <button 
                                  type="button"
                                  className="w-9 h-9 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100 transition-colors text-lg disabled:opacity-30 disabled:cursor-not-allowed" 
                                  onClick={() => updateAddOnQty(addon, currentQty - 1)}
                                  disabled={currentQty <= 0}
                                >-</button>
                                <span className="font-black text-gray-900 text-lg w-7 text-center">{currentQty}</span>
                                <button 
                                  type="button"
                                  className="w-9 h-9 rounded-full bg-white border border-gray-300 flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100 transition-colors text-lg disabled:opacity-30 disabled:cursor-not-allowed" 
                                  onClick={() => updateAddOnQty(addon, currentQty + 1)}
                                  disabled={currentQty >= 5}
                                >+</button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button className="flex-[1] py-3.5 bg-white border border-gray-300 rounded-xl text-sm md:text-base font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer" onClick={closeOptions}>Cancel</button>
              <button className="flex-[2] py-3.5 bg-gray-900 border border-transparent rounded-xl text-sm md:text-base font-bold text-white uppercase tracking-wider hover:bg-black hover:shadow-md transition-all cursor-pointer" onClick={handleAddWithOptions}>
                {(() => {
                  let displayPrice = parseFloat(selectedProduct.price);
                  if (["COFFEE", "FRAPPE", "MILK TEA", "SODA", "FRUIT DRINKS"].includes(selectedProduct.category?.toUpperCase())) {
                    if (selectedProduct.sizes && selectedProduct.sizes.length > 0) {
                      const sz = selectedProduct.sizes.find(s => s.name === productOptions.cupSize);
                      if (sz) displayPrice += parseFloat(sz.price_add || 0);
                    } else {
                      if (productOptions.cupSize === "16 oz") displayPrice += 10;
                      if (productOptions.cupSize === "22 oz") displayPrice += 20;
                    }

                    Object.entries(productOptions.addOns).forEach(([addonName, customerQty]) => {
                      if (selectedProduct.add_ons && selectedProduct.add_ons.length > 0) {
                        const ao = selectedProduct.add_ons.find(a => a.name === addonName);
                        if (ao) displayPrice += parseFloat(ao.price || 0) * customerQty;
                      }
                    });
                  }
                  return `${editingCartItemId ? 'Update Item' : 'Add to Transaction'} (₱${(displayPrice * productOptions.qty).toFixed(2)})`;
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingredients Info Modal */}
      {recipeProduct && (() => {
        const treatsAsDirect = recipeProduct.track_stock || recipeProduct.has_recipe === false;
        const isDirectOut = treatsAsDirect && recipeProduct.stock_quantity <= 0;
        const isUnavailable = recipeProduct.is_available === false || isDirectOut;
        
        return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]" onMouseDown={(e) => { if (e.target === e.currentTarget) setRecipeProduct(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]" onClick={e => e.stopPropagation()}>
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="m-0 text-lg md:text-xl font-bold tracking-wide">Ingredients: {recipeProduct.name}</h3>
              <button className="text-gray-400 hover:text-white transition-colors bg-transparent border-none text-2xl leading-none cursor-pointer p-0" onClick={() => setRecipeProduct(null)} aria-label="Close"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6">
              {recipeLoading ? (
                <div className="py-4 space-y-3 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              ) : currentRecipe.length > 0 ? (
                <div className="text-left">
                  <p className="mb-4 text-base md:text-lg text-gray-700 leading-relaxed font-semibold">
                    This product is prepared using the following ingredients:
                  </p>
                  <ul className="list-disc pl-5 space-y-2.5">
                    {currentRecipe.map((r, i) => {
                      const displayUnit = (r.recipe_unit || r.ingredients?.unit || '').toUpperCase();
                      const formattedQty = `${r.quantity_used} ${displayUnit}`;
                      const formattedStock = formatQuantity(r.ingredients?.stock_quantity, r.ingredients?.unit);
                        
                      return (
                        <li key={i} className="text-base md:text-lg text-gray-900">
                          <strong>{formattedQty}</strong> of <strong>{r.ingredients?.name}</strong>
                          <span className={`ml-2 text-sm md:text-base font-bold px-2 py-0.5 rounded-md ${ (r.ingredients?.stock_quantity || 0) < 10 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200' }`}>
                            ({formattedStock} in stock)
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500 font-medium text-base">
                  No recipe data found or this is a direct-stock item.
                </div>
              )}
            </div>
            <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button className="flex-1 py-3.5 bg-white border border-gray-300 rounded-xl text-base font-bold text-gray-700 uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => setRecipeProduct(null)}>Close</button>
              <button 
                className="flex-1 py-3.5 bg-gray-900 border border-transparent rounded-xl text-base font-bold text-white uppercase tracking-wider hover:bg-black hover:shadow-md transition-all cursor-pointer disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none disabled:cursor-not-allowed" 
                onClick={() => { openOptions(recipeProduct); setRecipeProduct(null); }}
                disabled={isUnavailable}
              >
                {isUnavailable ? 'Unavailable' : '+ Add to Order'}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
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
