import test from 'node:test';
import assert from 'node:assert/strict';
import { addDaysManila } from '../services/batchService.js';
import { forecastFromHistory, backtestForecast, confidenceFrom, quantityAtRiskOfExpiry, templateInsight } from '../services/forecastService.js';

const asOf = '2026-11-23'; // a Monday
const build = (days, fn) => {
  const m = new Map();
  for (let i = 0; i < days; i += 1) {
    const d = addDaysManila(asOf, -i);
    const u = fn(d, i);
    if (u) m.set(d, u);
  }
  return m;
};
const weekday = (d) => new Date(d + 'T00:00:00Z').getUTCDay();

test('weekday pattern is learned and zero-sale days count', () => {
  // 10 every Saturday, 2 on weekdays, nothing on Sundays
  const units = build(800, (d) => (weekday(d) === 6 ? 10 : weekday(d) === 0 ? 0 : 2));
  const f = forecastFromHistory(units, asOf, '2024-01-01', { horizon: 7 });
  assert.equal(f.status, 'OK');
  assert.equal(f.peakDay, 'Saturday');
  assert.equal(f.weekdayProfile[0], 0); // Sunday average includes the zero days
  assert.equal(f.trendPct, 0);
  const sat = f.daily.find((d) => weekday(d.date) === 6);
  assert.equal(sat.units, 10);
});

test('steady history backtests at 100% and gets High confidence', () => {
  const units = build(800, () => 5);
  const bt = backtestForecast(units, asOf, '2024-01-01');
  assert.equal(bt.accuracyPct, 100);
  assert.equal(confidenceFrom('OK', bt.accuracyPct), 'High');
});

test('growth is detected but damped and capped', () => {
  const units = build(56, (d, i) => (i < 28 ? 20 : 10)); // doubled in the last 4 weeks
  const f = forecastFromHistory(units, asOf, addDaysManila(asOf, -55), { horizon: 7 });
  assert.ok(f.trendPct >= 90 && f.trendPct <= 100); // (560+1)/(280+1) ≈ +100%
  assert.ok(f.trendFactor <= 1.2);
});

test('new products are flagged instead of guessed confidently', () => {
  const units = build(5, () => 3);
  const f = forecastFromHistory(units, asOf, addDaysManila(asOf, -4), { horizon: 7 });
  assert.equal(f.status, 'NEW_PRODUCT');
  assert.equal(backtestForecast(units, asOf, addDaysManila(asOf, -4)), null);
  assert.equal(confidenceFrom(f.status, null), 'Not enough data');
  assert.match(templateInsight('Matcha', f), /new/);
});

test('expiry risk: stock that cannot be used before it expires', () => {
  // use 2/day; lot A 10 units expires in 2 days (can use 6), lot B no expiry
  const lots = [
    { quantity_remaining: 10, days_until_expiry: 2, is_expired: false },
    { quantity_remaining: 50, days_until_expiry: null, is_expired: false },
  ];
  assert.equal(quantityAtRiskOfExpiry(lots, 2), 4);
  assert.equal(quantityAtRiskOfExpiry(lots, 10), 0);
});
