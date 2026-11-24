import React from 'react';
import { createPortal } from 'react-dom';

/** Amber warning shown when someone presses Escape while a form has unsaved changes. */
const UnsavedNotice = ({ show }) => {
  if (!show) return null;
  return createPortal(
    <div
      role="alert"
      className="fixed top-5 left-1/2 -translate-x-1/2 z-[100001] px-4 py-3 rounded-xl shadow-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm font-semibold"
    >
      You have unsaved changes. Save them, or press Reset, before closing.
    </div>,
    document.body
  );
};

export default UnsavedNotice;
