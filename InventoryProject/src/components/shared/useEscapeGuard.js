import { useEffect, useRef, useState } from 'react';

/**
 * Escape key for edit modals. Clean form: Escape closes it. Unsaved changes: Escape does NOT close,
 * and `warn` turns true for a few seconds so the modal can show <UnsavedNotice show={warn} />.
 */
export const useEscapeGuard = ({ active = true, dirty, onClose }) => {
  const [warn, setWarn] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (dirty) {
        setWarn(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setWarn(false), 3500);
      } else {
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, dirty, onClose]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return warn;
};
