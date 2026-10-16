// Sale-line arithmetic shared by checkout, receipts, reports and sync.
// A sale line is { qty, price (unit price before discount), discount (₦ off this whole line, default 0), cost }.
// Everything is rounded to kobo (2 decimals) the same way the server does.
export const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
export const lineGross = (i) => round2(n(i.qty) * n(i.price));
export const lineDiscount = (i) => Math.min(lineGross(i), Math.max(0, round2(n(i.discount))));
export const lineTotal = (i) => round2(lineGross(i) - lineDiscount(i));
export const saleSubtotal = (items) => round2((items || []).reduce((a, i) => a + lineGross(i), 0));
export const saleDiscount = (items) => round2((items || []).reduce((a, i) => a + lineDiscount(i), 0));
export const saleTotal = (items) => round2((items || []).reduce((a, i) => a + lineTotal(i), 0));
// what one unit really sold for, after discount (used for "below cost" checks)
export const effectiveUnit = (i) => (n(i.qty) > 0 ? lineTotal(i) / n(i.qty) : n(i.price));

// An amount entered as { mode: "amt" | "pct", text } against a base amount -> ₦ off (never more than the base, never negative)
export function discountAmount(entry, base) {
  if (!entry || entry.text === "" || entry.text === undefined) return 0;
  const v = Math.max(0, n(entry.text));
  const raw = entry.mode === "pct" ? (Math.min(v, 100) / 100) * base : v;
  return Math.min(round2(base), round2(raw));
}
// Turns the cart + the discounts typed at checkout into final lines.
//  cart items: { ..., qty, price, discEntry?: {mode,text} }   saleEntry: {mode,text} applied to what is left after line discounts.
export function priceCart(cart, saleEntry) {
  const lines = cart.map((i) => ({ ...i, discount: discountAmount(i.discEntry, lineGross(i)) }));
  const afterLines = lines.map((i) => lineTotal(i));
  const base = round2(afterLines.reduce((a, v) => a + v, 0));
  const extra = discountAmount(saleEntry, base);
  if (extra > 0 && base > 0) {          // share the sale-wide discount across lines in proportion to their value; the last line absorbs rounding
    let left = extra; const idx = lines.map((_, k) => k).filter((k) => afterLines[k] > 0);
    idx.forEach((k, pos) => {
      const share = pos === idx.length - 1 ? left : Math.min(left, round2((extra * afterLines[k]) / base));
      lines[k] = { ...lines[k], discount: round2(lines[k].discount + share) }; left = round2(left - share);
    });
  }
  return { lines, subtotal: saleSubtotal(lines), discount: saleDiscount(lines), total: saleTotal(lines) };
}
// Who may change a recorded sale: admins always; staff only their own sales from today.
export function canEditSale(user, sale, today) {
  if (!user || !sale) return false;
  if (user.role === "admin") return true;
  const mine = sale.cashierId ? sale.cashierId === user.id : sale.cashierName === user.name;
  return mine && sale.date === today;
}
