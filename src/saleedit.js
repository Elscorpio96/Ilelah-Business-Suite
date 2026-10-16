import { lineTotal, round2 } from "./lines.js";
// Re-prices a recorded sale. Keeps quantities, costs, stock and payment type; recomputes totals and the amount owed.
// prices: new unit price per line (before discount). discounts (optional): new ₦ discount per line.
export function repriceSale(sale, prices, discounts) {
  const items = sale.items.map((it, i) => {
    const p = Number(prices[i]);
    const price = Number.isFinite(p) && p >= 0 ? p : it.price;
    let d = discounts ? Number(discounts[i]) : Number(it.discount) || 0;
    if (!Number.isFinite(d) || d < 0) d = Number(it.discount) || 0;
    d = Math.min(round2(d), round2(price * it.qty));
    return { ...it, price, discount: d };
  });
  const total = round2(items.reduce((a, it) => a + lineTotal(it), 0));
  let amountTendered = sale.amountTendered;
  let balanceDue;
  if (sale.paymentType === "credit") {
    amountTendered = Math.min(amountTendered, total);
    balanceDue = Math.max(0, round2(total - amountTendered));
  } else {
    if (amountTendered < total) amountTendered = total;
    balanceDue = 0;
  }
  return { ...sale, items, total, amountTendered, balanceDue, edited: true, editedAt: new Date().toISOString() };
}
