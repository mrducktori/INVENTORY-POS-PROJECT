import React from 'react';

const ConfirmModal = ({ isOpen, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-[popIn_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Action</h3>
          <p className="text-sm text-gray-600 font-medium">{message}</p>
        </div>
        <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button 
            className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-600 uppercase tracking-wider hover:bg-gray-50 transition-colors" 
            onClick={onCancel}
          >
            No, Cancel
          </button>
          <button 
            className="flex-1 py-2.5 bg-gray-900 border border-transparent rounded-xl text-sm font-bold text-white uppercase tracking-wider hover:bg-black hover:shadow-md transition-all" 
            onClick={onConfirm}
          >
            Yes, Proceed
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
