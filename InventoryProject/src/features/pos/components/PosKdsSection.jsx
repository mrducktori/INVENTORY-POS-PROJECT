import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getKdsQueue, updateKdsTicketStatus } from '../../../api/posApi';
import {
  formatReceiptDateTime,
  extractOrderTypeLabel,
  extractItemModifiersLabel,
  normalizeAddOn
} from '../../../utils/receiptPrint';

const STATION_FILTERS = [
  { id: 'ALL', label: 'All Stations' },
  { id: 'BARISTA', label: 'Barista (Drinks)' },
  { id: 'KITCHEN', label: 'Kitchen (Food & Pastries)' }
];

const STATUS_FILTERS = [
  { id: 'ACTIVE', label: 'Active Queue' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'PREPARING', label: 'Preparing' },
  { id: 'READY', label: 'Ready' },
  { id: 'SERVED', label: 'Served' }
];

const KITCHEN_CATEGORY_PATTERN =
  /PASTRY|PASTRIES|PASTA|SPAGHETTI|CARBONARA|LASAGNA|MACARONI|PENNE|FETTUCCINE|NOODLE|RAMEN|PANCIT|FOOD|MEAL|RICE|SILOG|BREAKFAST|LUNCH|DINNER|SNACK|SANDWICH|BURGER|PIZZA|CAKE|WAFFLE|CROFFLE|BREAD|TOAST|BAGEL|PANINI|COOKIE|BROWNIE|MUFFIN|CUPCAKE|DONUT|CROISSANT|PIE|TART|PUDDING|FRIES|NACHOS|WINGS|CHICKEN|PORK|BEEF|FISH|SEAFOOD|SAUSAGE|HOTDOG|BACON|HAM|EGG|OMELET|SALAD|SOUP|STEAK|RIBS|SISIG|LUMPIA|DIMSUM|SIOMAI|EMPANADA|QUESADILLA|TACO|BURRITO|WRAP|DESSERT|PLATTER|COMBO|SOLO|SIDE|APPETIZER|STARTER|BENTO|BOWL/i;
const BARISTA_CATEGORY_PATTERN =
  /COFFEE|ESPRESSO|LATTE|CAPPUCCINO|MACCHIATO|MOCHA|AMERICANO|COLD BREW|BREW|FRAPPE|FRAPPUCCINO|SMOOTHIE|SHAKE|MILKSHAKE|TEA|MILK TEA|MATCHA|HOJICHA|CHAI|FRUIT TEA|ICED TEA|LEMONADE|SODA|SPARKLING|FIZZ|JUICE|DRINK|BEVERAGE|CHOCOLATE|COCOA|MILO|HORCHATA|YOGURT|YAKULT|FLOAT|AFFOGATO|REFRESH|COOLER/i;

const normalizeCatKey = (raw) =>
  String(raw || '').trim().replace(/\s+/g, ' ').toUpperCase();

const inferItemStation = (item, categoryStationMap = {}) => {
  const explicitPrep = String(item?.prep_station || '').trim().toUpperCase();
  if (explicitPrep === 'BARISTA' || explicitPrep === 'KITCHEN') return explicitPrep;

  const cat = String(item?.category || item?.products?.category || '').trim();
  const catKey = normalizeCatKey(cat);
  if (catKey && categoryStationMap[catKey]) {
    return categoryStationMap[catKey];
  }

  const name = String(item?.name || item?.product_name || item?.products?.name || '').trim();
  if (KITCHEN_CATEGORY_PATTERN.test(cat)) return 'KITCHEN';
  if (BARISTA_CATEGORY_PATTERN.test(cat)) return 'BARISTA';
  if (KITCHEN_CATEGORY_PATTERN.test(name)) return 'KITCHEN';
  if (BARISTA_CATEGORY_PATTERN.test(name)) return 'BARISTA';

  const explicit = String(item?.station || '').trim().toUpperCase();
  if (explicit === 'BARISTA' || explicit === 'KITCHEN') return explicit;

  if (item?.cup_size || (Array.isArray(item?.sizes) && item.sizes.length > 0)) {
    return 'BARISTA';
  }
  return 'KITCHEN';
};

const getStatusBadgeClasses = (status) => {
  const s = String(status || 'PENDING').toUpperCase();
  if (s === 'PREPARING') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (s === 'READY') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (s === 'SERVED') return 'bg-zinc-100 text-zinc-600 border-zinc-200';
  if (s === 'CANCELLED') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-gray-900 text-white border-gray-900';
};

const getOrderTypeBadgeClasses = (orderType) => {
  const ot = String(orderType || 'DINE_IN').toUpperCase();
  if (ot === 'TAKE_OUT') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (ot === 'DELIVERY') return 'bg-blue-50 text-blue-800 border-blue-200';
  return 'bg-zinc-100 text-zinc-800 border-zinc-200';
};

const PosKdsSection = ({ categorySettings = {}, ongoingOrders = [], onOpenOngoingOrder = null }) => {
  const [tickets, setTickets] = useState([]);
  const [stationFilter, setStationFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const categoryStationMap = useMemo(() => {
    const map = {};
    Object.entries(categorySettings || {}).forEach(([k, val]) => {
      const ps = String(val?.prep_station || '').trim().toUpperCase();
      if (ps === 'BARISTA' || ps === 'KITCHEN') {
        map[normalizeCatKey(k)] = ps;
      }
    });
    return map;
  }, [categorySettings]);

  const fetchQueue = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const includeServed = statusFilter === 'SERVED';
      const res = await getKdsQueue({
        station: stationFilter,
        includeServed
      });
      const list = Array.isArray(res) ? res : (res?.tickets || res?.data || []);
      setTickets(list);
    } catch (err) {
      setError(err?.message || 'Failed to load kitchen display queue.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [stationFilter, statusFilter]);

  useEffect(() => {
    fetchQueue(false);
  }, [fetchQueue]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const timer = setInterval(() => {
      void fetchQueue(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [autoRefresh, fetchQueue]);

  const handleStatusChange = async (ticketId, nextStatus) => {
    setUpdatingId(ticketId);
    setError('');
    setNotice('');
    try {
      const updated = await updateKdsTicketStatus(ticketId, nextStatus);
      const updatedTicket = updated?.ticket || updated;
      setTickets((prev) =>
        prev.map((t) => (t.id === ticketId ? { ...t, ...(updatedTicket || {}), status: nextStatus } : t))
      );
      setNotice(`Ticket updated to ${nextStatus}.`);
      setTimeout(() => setNotice(''), 2500);
      await fetchQueue(true);
    } catch (err) {
      setError(err?.message || 'Failed to update ticket status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const heldTickets = useMemo(() => {
    if (statusFilter !== 'ACTIVE' && statusFilter !== 'PENDING') return [];
    return (Array.isArray(ongoingOrders) ? ongoingOrders : []).map((order) => ({
      id: `held-${order.id}`,
      held_order_id: order.id,
      is_held: true,
      receipt_number: `HELD #${String(order.id).slice(-6)}`,
      order_type: order.order_type || 'DINE_IN',
      status: 'PENDING',
      display_time: order.timestamp || '',
      created_at: order.created_at || null,
      items: (order.items || []).map((item) => ({
        ...item,
        station: inferItemStation(item, categoryStationMap)
      }))
    }));
  }, [ongoingOrders, statusFilter, categoryStationMap]);

  const visibleTickets = useMemo(() => {
    const paidVisible = (tickets || []).filter((t) => {
      const status = String(t.status || 'PENDING').toUpperCase();
      if (status === 'CANCELLED') return false;
      if (statusFilter === 'ACTIVE') return status !== 'SERVED';
      return status === statusFilter;
    });
    return [...heldTickets, ...paidVisible];
  }, [tickets, heldTickets, statusFilter]);

  const splitTicketsForStation = useCallback((station) => {
    return visibleTickets
      .map((ticket) => {
        const rawItems = Array.isArray(ticket.items) ? ticket.items : [];
        const stationItems = rawItems.filter((item) => inferItemStation(item, categoryStationMap) === station);
        if (stationItems.length === 0 && rawItems.length > 0) return null;
        if (rawItems.length === 0 && String(ticket.station || 'BARISTA').toUpperCase() !== station) {
          return null;
        }
        return {
          ...ticket,
          stationItems: stationItems.length > 0 ? stationItems : rawItems
        };
      })
      .filter(Boolean);
  }, [visibleTickets, categoryStationMap]);

  const baristaTickets = useMemo(() => splitTicketsForStation('BARISTA'), [splitTicketsForStation]);
  const kitchenTickets = useMemo(() => splitTicketsForStation('KITCHEN'), [splitTicketsForStation]);

  const renderTicketCard = (ticket, displayItems) => {
    const status = String(ticket.status || 'PENDING').toUpperCase();
    const orderTypeLabel = extractOrderTypeLabel(ticket) || 'Dine-In';
    const isBusy = updatingId === ticket.id;

    return (
      <div
        key={ticket.id}
        className={`bg-white border rounded-xl shadow-xs overflow-hidden flex flex-col justify-between ${
          ticket.is_held ? 'border-amber-300' : 'border-gray-200'
        }`}
      >
        <div>
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-sm font-bold text-gray-900 font-mono">
                {ticket.receipt_number || `TKT-${String(ticket.id || '').slice(0, 8)}`}
              </div>
              <div className="text-[11px] text-gray-500">
                {ticket.display_time || formatReceiptDateTime(ticket.created_at)}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${getOrderTypeBadgeClasses(
                  ticket.order_type
                )}`}
              >
                {orderTypeLabel}
              </span>
              {ticket.is_held ? (
                <span className="px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border-amber-200">
                  HELD (UNPAID)
                </span>
              ) : (
                <span
                  className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${getStatusBadgeClasses(
                    status
                  )}`}
                >
                  {status}
                </span>
              )}
            </div>
          </div>

          <div className="p-4 space-y-2.5">
            {displayItems.map((item, idx) => {
              const modText = extractItemModifiersLabel(item);
              const qty = item.quantity ?? item.qty ?? 1;
              const name = item.name || item.product_name || item.products?.name || 'Menu Item';
              return (
                <div
                  key={`${ticket.id}-${idx}`}
                  className="pb-2.5 last:pb-0 border-b last:border-b-0 border-gray-100"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-bold text-gray-900">
                      <span className="inline-flex items-center justify-center min-w-[22px] px-1.5 py-0.5 mr-2 rounded bg-gray-900 text-white text-xs font-mono">
                        {qty}x
                      </span>
                      {name}
                    </div>
                    {item.cup_size && (
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[10px] font-bold text-gray-700 uppercase shrink-0">
                        {item.cup_size}
                      </span>
                    )}
                  </div>
                  {modText && (
                    <div className="text-xs text-gray-600 mt-1 pl-8 font-medium">
                      {modText}
                    </div>
                  )}
                  {Array.isArray(item.add_ons) && item.add_ons.length > 0 && (
                    <div className="text-xs text-gray-500 mt-0.5 pl-8">
                      +{' '}
                      {item.add_ons
                        .map((ao) => {
                          const norm = normalizeAddOn(ao);
                          return `${norm.customer_qty}x ${norm.name}`;
                        })
                        .join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          {ticket.is_held ? (
            <button
              type="button"
              onClick={() => onOpenOngoingOrder?.(ticket.held_order_id)}
              className="flex-1 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer border-none"
            >
              Open in Register (Pay)
            </button>
          ) : (
            <>
              {status === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(ticket.id, 'PREPARING')}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isBusy ? 'Updating...' : 'Start Preparing'}
                </button>
              )}
              {status === 'PREPARING' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(ticket.id, 'READY')}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isBusy ? 'Updating...' : 'Mark Ready'}
                </button>
              )}
              {status === 'READY' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange(ticket.id, 'SERVED')}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-zinc-900 hover:bg-black text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isBusy ? 'Updating...' : 'Serve'}
                </button>
              )}
              {status === 'SERVED' && (
                <div className="w-full text-center text-xs font-semibold text-gray-500 py-1">
                  Served
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50">
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {STATION_FILTERS.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStationFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                stationFilter === st.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((sf) => (
            <button
              key={sf.id}
              type="button"
              onClick={() => setStatusFilter(sf.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                statusFilter === sf.id
                  ? 'bg-zinc-800 text-white border-zinc-800'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {sf.label}
            </button>
          ))}

          <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-gray-900"
            />
            Auto-refresh
          </label>

          <button
            type="button"
            onClick={() => fetchQueue(false)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {(error || notice) && (
        <div className="px-6 pt-3">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
              {notice}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        {loading && tickets.length === 0 ? (
          <div className="py-16 text-center text-sm text-gray-400 font-medium">
            Loading kitchen & barista order queue...
          </div>
        ) : stationFilter === 'ALL' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="m-0 text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Barista Station (Drinks)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-gray-900 text-white text-xs font-bold">
                  {baristaTickets.length}
                </span>
              </div>
              {baristaTickets.length === 0 ? (
                <div className="p-8 bg-white rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                  No drinks in this status.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {baristaTickets.map((t) => renderTicketCard(t, t.stationItems))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="m-0 text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Kitchen Station (Food & Pastries)
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-gray-900 text-white text-xs font-bold">
                  {kitchenTickets.length}
                </span>
              </div>
              {kitchenTickets.length === 0 ? (
                <div className="p-8 bg-white rounded-xl border border-dashed border-gray-200 text-center text-xs text-gray-400">
                  No kitchen items in this status.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {kitchenTickets.map((t) => renderTicketCard(t, t.stationItems))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <div>
            {(() => {
              const list = stationFilter === 'BARISTA' ? baristaTickets : kitchenTickets;
              if (list.length === 0) {
                return (
                  <div className="p-12 bg-white rounded-xl border border-dashed border-gray-200 text-center text-sm text-gray-400">
                    No {stationFilter.toLowerCase()} tickets found.
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {list.map((t) => renderTicketCard(t, t.stationItems))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default PosKdsSection;
