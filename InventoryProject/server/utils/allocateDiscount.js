// Splits an order-level discount across line grosses proportionally, in cents.
// Largest-remainder method: leftover cents go to lines with the biggest rounding loss that still have
// headroom, so shares sum exactly to the discount and no share exceeds its own line's gross.
export const allocateDiscount = (grosses, discount) => {
  const cents = grosses.map((g) => Math.round((Number(g) || 0) * 100));
  const total = cents.reduce((a, b) => a + b, 0);
  const disc = Math.min(Math.round((Number(discount) || 0) * 100), total);
  if (total <= 0 || disc <= 0) return grosses.map(() => 0);
  const shares = cents.map((c) => Math.floor((disc * c) / total));
  let left = disc - shares.reduce((a, b) => a + b, 0);
  const order = cents
    .map((c, i) => ({ i, frac: (disc * c) / total - shares[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0; k = (k + 1) % order.length) {
    const { i } = order[k];
    if (shares[i] < cents[i]) { shares[i] += 1; left -= 1; }
  }
  return shares.map((s) => s / 100);
};
