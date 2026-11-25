import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';

const ConfirmModal = ({
  isOpen,
  title = 'Confirm Action',
  message,
  onConfirm,
  onCancel,
  confirmText = 'Yes, Proceed',
  cancelText = 'No, Cancel',
  confirmColor = 'default', // 'danger' | 'success' | 'default'
  isLoading = false,
}) => {
  const [internalSubmitting, setInternalSubmitting] = useState(false);
  const dialogRef = useRef(null);

  const isBusy = isLoading || internalSubmitting;

  useFocusTrap(dialogRef, isOpen, () => {
    if (!isBusy && onCancel) onCancel();
  });

  if (!isOpen) return null;

  const isDanger = confirmColor === 'danger' || confirmColor === 'rose';
  const isSuccess = confirmColor === 'success' || confirmColor === 'primary';

  const handleConfirmClick = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isBusy) return;

    try {
      setInternalSubmitting(true);
      if (onConfirm) {
        await onConfirm();
      }
    } catch (err) {
      console.error('Error in ConfirmModal onConfirm handler:', err);
    } finally {
      setInternalSubmitting(false);
    }
  };

  const handleCancelClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isBusy) return;
    if (onCancel) onCancel();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100000] p-4 animate-[modalBackdropFadeIn_0.2s_ease-out]"
      onClick={handleCancelClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[modalPopIn_0.25s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 md:p-8 text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              isDanger
                ? 'bg-rose-100 text-rose-600'
                : isSuccess
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-amber-100 text-amber-600'
            }`}
          >
            {isBusy ? (
              <div className="w-7 h-7 border-3 border-current border-t-transparent rounded-full animate-spin" />
            ) : isDanger ? (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            ) : isSuccess ? (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
          </div>

          <h3 id="confirm-modal-title" className="text-xl md:text-2xl font-black text-gray-900 mb-2.5">
            {title}
          </h3>
          <p className="text-base text-gray-700 font-medium leading-relaxed m-0">
            {message}
          </p>
        </div>

        <div className="flex gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            type="button"
            disabled={isBusy}
            className="flex-1 py-3 bg-white border border-gray-300 rounded-xl text-base font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleCancelClick}
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isBusy}
            className={`flex-1 py-3 rounded-xl text-base font-bold text-white transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700'
                : isSuccess
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-zinc-900 hover:bg-black'
            }`}
            onClick={handleConfirmClick}
          >
            {isBusy ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;