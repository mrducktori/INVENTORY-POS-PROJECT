import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EMPTY_LOW_STOCK,
  getRelativeTimeString,
  useNotifications,
} from '../hooks/useNotifications';
import { ADMIN_POPUP_STORAGE_PREFIX } from '../../../utils/authUtils';

// Shown once per login session, a few seconds after sign-in, for every role (what each sees is decided by isNotificationAllowedForUser).
export const ADMIN_POPUP_DELAY_MS = 4 * 1000;
export const ADMIN_POPUP_DURATION_MS = 15 * 1000;
const MAX_VISIBLE_ITEMS = 3;

const BADGE_STYLES = {
  danger: 'bg-rose-100 text-rose-800 border-rose-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  info: 'bg-sky-100 text-sky-800 border-sky-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  neutral: 'bg-zinc-100 text-zinc-800 border-zinc-200',
};

const safeGet = (key) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or access errors
  }
};

const AdminNotificationPopupInner = ({ user, onNavigate }) => {
  const {
    notifications,
    unreadCount,
    criticalCount,
    loading,
    markAsRead,
    markAllAsRead,
  } = useNotifications(EMPTY_LOW_STOCK, user);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.isRead),
    [notifications]
  );

  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [remainingMs, setRemainingMs] = useState(ADMIN_POPUP_DURATION_MS);

  const unreadCountRef = useRef(0);
  const remainingMsRef = useRef(ADMIN_POPUP_DURATION_MS);

  useEffect(() => {
    unreadCountRef.current = unreadNotifications.length;
  }, [unreadNotifications.length]);

  const startKey = `${ADMIN_POPUP_STORAGE_PREFIX}start_${user.id}`;
  const shownKey = `${ADMIN_POPUP_STORAGE_PREFIX}shown_${user.id}`;

  // One-shot short delay for the active session
  useEffect(() => {
    if (safeGet(shownKey) === '1') return undefined;

    const existingStart = Number(safeGet(startKey));
    let startTs = Number.isFinite(existingStart) && existingStart > 0 ? existingStart : NaN;
    if (!Number.isFinite(startTs)) {
      startTs = Date.now();
      safeSet(startKey, String(startTs));
    }

    const remainingDelay = Math.max(0, ADMIN_POPUP_DELAY_MS - (Date.now() - startTs));
    if (loading && remainingDelay === 0) {
      return undefined;
    }

    const timerId = setTimeout(() => {
      safeSet(shownKey, '1');
      if (unreadCountRef.current > 0) {
        remainingMsRef.current = ADMIN_POPUP_DURATION_MS;
        setRemainingMs(ADMIN_POPUP_DURATION_MS);
        setIsVisible(true);
      }
    }, remainingDelay);

    return () => clearTimeout(timerId);
  }, [startKey, shownKey, loading]);

  // Auto-hide countdown duration (pauses while hovered)
  useEffect(() => {
    if (!isVisible || isPaused) return undefined;

    const startedAt = Date.now();
    const initialRemaining = remainingMsRef.current;

    if (initialRemaining <= 0) {
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
      }, 0);
      return () => clearTimeout(hideTimer);
    }

    const tickId = setInterval(() => {
      const next = Math.max(0, initialRemaining - (Date.now() - startedAt));
      remainingMsRef.current = next;
      setRemainingMs(next);
      if (next <= 0) {
        clearInterval(tickId);
        setIsVisible(false);
      }
    }, 100);

    return () => {
      clearInterval(tickId);
      remainingMsRef.current = Math.max(0, initialRemaining - (Date.now() - startedAt));
    };
  }, [isVisible, isPaused]);

  if (!isVisible || unreadNotifications.length === 0) {
    return null;
  }

  const previewItems = unreadNotifications.slice(0, MAX_VISIBLE_ITEMS);
  const extraCount = Math.max(0, unreadNotifications.length - MAX_VISIBLE_ITEMS);
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const progressPct = Math.max(
    0,
    Math.min(100, (remainingMs / ADMIN_POPUP_DURATION_MS) * 100)
  );

  const handleItemClick = (notification) => {
    markAsRead(notification.id);
    setIsVisible(false);
    if (onNavigate && notification.actionTab) {
      onNavigate(notification.actionTab);
    }
  };

  const handleMarkAllRead = () => {
    markAllAsRead();
    setIsVisible(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="fixed bottom-5 right-5 z-40 w-[calc(100vw-2rem)] max-w-sm bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden animate-[popupSlideUp_var(--dur-slow)_var(--ease-out-expo)]"
    >
      {/* Header */}
      <div className="bg-zinc-950 text-white px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-4 h-4 text-zinc-300 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <span className="text-xs font-extrabold tracking-tight truncate">
            Notifications
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums shrink-0 ${
              criticalCount > 0
                ? 'bg-rose-600 text-white'
                : 'bg-zinc-800 text-zinc-200'
            }`}
          >
            {unreadCount} unread
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
            {isPaused ? 'Paused' : `${remainingSeconds}s`}
          </span>
          <button
            type="button"
            onClick={() => setIsVisible(false)}
            aria-label="Dismiss notification pop-up"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer bg-transparent border-none inline-flex items-center justify-center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Preview Items */}
      <div className="divide-y divide-zinc-100 max-h-72 overflow-y-auto bg-white">
        {previewItems.map((n) => {
          const badgeClass = BADGE_STYLES[n.badgeVariant] || BADGE_STYLES.neutral;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => handleItemClick(n)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-50 transition-colors cursor-pointer bg-transparent border-none block"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span
                  className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded border ${badgeClass}`}
                >
                  {n.badgeText}
                </span>
                <span className="text-[11px] text-zinc-400 font-medium shrink-0">
                  {getRelativeTimeString(n.timestamp)}
                </span>
              </div>
              <div className="text-xs font-bold text-zinc-900 truncate">
                {n.title}
              </div>
              <p className="text-xs text-zinc-600 mt-0.5 mb-0 line-clamp-2 leading-relaxed">
                {n.message}
              </p>
            </button>
          );
        })}

        {extraCount > 0 && (
          <div className="px-4 py-2 bg-zinc-50/70 text-[11px] font-medium text-zinc-500">
            +{extraCount} more unread alert{extraCount === 1 ? '' : 's'} in Inbox
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={handleMarkAllRead}
          className="font-bold text-zinc-800 hover:text-black hover:underline cursor-pointer bg-transparent border-none p-0"
        >
          Mark all read
        </button>
        <button
          type="button"
          onClick={() => setIsVisible(false)}
          className="font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer bg-transparent border-none p-0"
        >
          Dismiss
        </button>
      </div>

      {/* Duration Countdown Bar */}
      <div className="h-1 w-full bg-zinc-100">
        <div
          className="h-full bg-zinc-900 transition-[width] duration-100 ease-linear"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
};

const AdminNotificationPopup = ({ user, onNavigate }) => {
  if (!user?.id) return null;
  return <AdminNotificationPopupInner user={user} onNavigate={onNavigate} />;
};

export default AdminNotificationPopup;
