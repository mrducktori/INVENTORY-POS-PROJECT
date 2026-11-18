import React from 'react';
import { useSupplierPortal } from './hooks/useSupplierPortal';
import SupplierReviewPOModal from './components/suppliers/SupplierReviewPOModal';
import SupplierCatalogSection from './components/suppliers/SupplierCatalogSection';
import SupplierOrderActionModals from './components/suppliers/SupplierOrderActionModals';
import SupplierOrdersTable from './components/suppliers/SupplierOrdersTable';

const SupplierPortal = () => {
  const {
    mainView, setMainView,
    orders, loading, error,
    expandedId, toggleExpand,
    tabFilter, setTabFilter,
    searchQuery, setSearchQuery,
    orderPage, setOrderPage,
    orderItemsPerPage, setOrderItemsPerPage,
    orderTotalPages,
    postponeModal, setPostponeModal,
    reviewModal, setReviewModal,
    declineModal, setDeclineModal,
    handleStatusChange,
    handleDeclineSubmit,
    handlePostponeSubmit,
    handleReviewSubmit,
    overdueCount, pendingCount, proposalsCount, activeCount, completedCount,
    filteredOrders, paginatedOrders
  } = useSupplierPortal();

  return (
    <div className="p-4 md:p-8 flex-1 bg-gray-50 overflow-y-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Supplier Portal</h1>
          <p className="m-0 mt-1 text-sm md:text-base text-gray-500 font-medium">
            {mainView === 'ORDERS'
              ? 'Manage incoming purchase orders from the store.'
              : 'Review catalog items, customize packaging units, and update pricing.'}
          </p>
        </div>

        {/* Top View Switcher */}
        <div className="inline-flex p-1 bg-gray-200/80 rounded-xl gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMainView('ORDERS')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              mainView === 'ORDERS'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Orders {orders.length > 0 ? `(${orders.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setMainView('CATALOG')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              mainView === 'CATALOG'
                ? 'bg-zinc-900 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            My Catalog & Pricing
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 mb-6 rounded-xl text-sm font-bold bg-red-50 text-red-800 border border-red-200">
          {error}
        </div>
      )}

      {mainView === 'CATALOG' ? (
        <SupplierCatalogSection />
      ) : (
        <>
          {/* Summary Stats */}
          {!loading && orders.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div
                onClick={() => setTabFilter('ALL')}
                className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
                  tabFilter === 'ALL' ? 'bg-zinc-900 text-white border-zinc-900 shadow-md' : 'bg-white border-gray-200 text-zinc-900 hover:border-zinc-400'
                }`}
              >
                <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'ALL' ? 'text-zinc-400' : 'text-gray-500'}`}>Total Orders</span>
                <span className="text-2xl font-extrabold">{orders.length}</span>
              </div>

              <div
                onClick={() => setTabFilter('OVERDUE')}
                className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
                  tabFilter === 'OVERDUE' ? 'bg-rose-700 text-white border-rose-700 shadow-md' : overdueCount > 0 ? 'bg-rose-50 border-rose-200 text-rose-900 hover:border-rose-400' : 'bg-white border-gray-200 text-zinc-900 hover:border-zinc-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'OVERDUE' ? 'text-rose-100' : overdueCount > 0 ? 'text-rose-700' : 'text-gray-500'}`}>Overdue</span>
                  {overdueCount > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>}
                </div>
                <span className="text-2xl font-extrabold">{overdueCount}</span>
              </div>

              <div
                onClick={() => setTabFilter('PENDING')}
                className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
                  tabFilter === 'PENDING' ? 'bg-yellow-600 text-white border-yellow-600 shadow-md' : 'bg-yellow-50 border-yellow-200 text-yellow-900 hover:border-yellow-400'
                }`}
              >
                <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'PENDING' ? 'text-yellow-100' : 'text-yellow-700'}`}>Pending Review</span>
                <span className="text-2xl font-extrabold">{pendingCount}</span>
              </div>

              <div
                onClick={() => setTabFilter('PROPOSALS')}
                className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
                  tabFilter === 'PROPOSALS' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-amber-50 border-amber-200 text-amber-900 hover:border-amber-400'
                }`}
              >
                <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'PROPOSALS' ? 'text-amber-100' : 'text-amber-700'}`}>Proposals</span>
                <span className="text-2xl font-extrabold">{proposalsCount}</span>
              </div>

              <div
                onClick={() => setTabFilter('ACTIVE')}
                className={`p-5 rounded-xl border shadow-sm flex flex-col cursor-pointer transition-all ${
                  tabFilter === 'ACTIVE' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:border-indigo-400'
                }`}
              >
                <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${tabFilter === 'ACTIVE' ? 'text-indigo-100' : 'text-indigo-700'}`}>Active Deliveries</span>
                <span className="text-2xl font-extrabold">{activeCount}</span>
              </div>
            </div>
          )}

          {/* Main Table Card with Tabs */}
          <SupplierOrdersTable
            loading={loading}
            orders={orders}
            filteredOrders={filteredOrders}
            paginatedOrders={paginatedOrders}
            tabFilter={tabFilter}
            setTabFilter={setTabFilter}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            overdueCount={overdueCount}
            pendingCount={pendingCount}
            proposalsCount={proposalsCount}
            activeCount={activeCount}
            completedCount={completedCount}
            expandedId={expandedId}
            toggleExpand={toggleExpand}
            orderPage={orderPage}
            setOrderPage={setOrderPage}
            orderItemsPerPage={orderItemsPerPage}
            setOrderItemsPerPage={setOrderItemsPerPage}
            orderTotalPages={orderTotalPages}
            onStatusChange={handleStatusChange}
            onOpenReviewModal={(po) => setReviewModal({ show: true, order: po })}
          />
        </>
      )}

      {/* Decline & Postpone Modals */}
      <SupplierOrderActionModals
        declineModal={declineModal}
        setDeclineModal={setDeclineModal}
        onDeclineSubmit={handleDeclineSubmit}
        postponeModal={postponeModal}
        setPostponeModal={setPostponeModal}
        onPostponeSubmit={handlePostponeSubmit}
      />

      {/* Review & Accept Items Modal */}
      <SupplierReviewPOModal
        isOpen={reviewModal.show}
        onClose={() => setReviewModal({ show: false, order: null })}
        order={reviewModal.order}
        onSubmit={handleReviewSubmit}
      />
    </div>
  );
};

export default SupplierPortal;
