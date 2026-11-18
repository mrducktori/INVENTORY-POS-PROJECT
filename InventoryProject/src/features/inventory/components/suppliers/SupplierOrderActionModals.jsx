import React from 'react';

const SupplierOrderActionModals = ({
  declineModal,
  setDeclineModal,
  onDeclineSubmit,
  postponeModal,
  setPostponeModal,
  onPostponeSubmit
}) => {
  return (
    <>
      {/* Decline Order Modal */}
      {declineModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]" onClick={() => setDeclineModal({ show: false, orderId: null, reason: '' })}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 md:p-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="m-0 text-xl font-black text-gray-900">Decline Purchase Order</h3>
                <p className="m-0 text-xs text-gray-500 font-medium">Order #{declineModal.orderId?.substring(0, 8).toUpperCase()}</p>
              </div>
            </div>

            <p className="m-0 text-sm text-gray-600 mb-5 font-medium">
              Please specify the reason for declining this purchase order. This reason will be recorded and communicated directly to the store manager.
            </p>

            <form onSubmit={onDeclineSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Decline Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="3"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none font-medium"
                  placeholder="e.g., Raw materials temporarily out of stock, supplier maintenance..."
                  value={declineModal.reason}
                  onChange={e => setDeclineModal({ ...declineModal, reason: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  onClick={() => setDeclineModal({ show: false, orderId: null, reason: '' })}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  Confirm Decline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Postpone Modal */}
      {postponeModal.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs overflow-y-auto z-[9999] p-4 flex justify-center items-start pt-6 sm:pt-10 md:pt-14 pb-12 animate-[modalBackdropFadeIn_0.2s_ease-out]" onClick={() => setPostponeModal({ show: false, orderId: null, date: '' })}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 md:p-8" onClick={e => e.stopPropagation()}>
            <h3 className="m-0 text-xl md:text-2xl font-black text-gray-900 mb-2">Postpone Order</h3>
            <p className="m-0 text-sm md:text-base text-gray-600 mb-6 font-medium">Select a new expected delivery date for this order.</p>
            <form onSubmit={onPostponeSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm md:text-base font-bold text-gray-700">New Expected Date</label>
                <input
                  type="date"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-base font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 cursor-pointer"
                  value={postponeModal.date}
                  onChange={e => setPostponeModal({ ...postponeModal, date: e.target.value })}
                  min={new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm md:text-base uppercase rounded-lg hover:bg-gray-200 transition-colors cursor-pointer" onClick={() => setPostponeModal({ show: false, orderId: null, date: '' })}>Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-gray-900 text-white font-bold text-sm md:text-base uppercase rounded-lg hover:bg-black transition-colors cursor-pointer">Postpone</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SupplierOrderActionModals;
