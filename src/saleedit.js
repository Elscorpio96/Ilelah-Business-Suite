import { lineTotal, round2 } from "./lines.js";
// Re-prices a recorded sale. Keeps quantities, costs, stock and payment type; recomputes totals and the amount owed.
// prices: new unit price per line (before discount). discounts (optional): new ₦ discount per line.
export function repriceSale(sale, prices, discounts, qtys) {
  const items = sale.items.map((it, i) => {
    const p = Number(prices[i]);
    const price = Number.isFinite(p) && p >= 0 ? p : it.price;
    const q0 = qtys ? Number(qtys[i]) : it.qty;
    const qty = Number.isFinite(q0) && q0 > 0 ? Math.round(q0 * 1000) / 1000 : it.qty;
    let d = discounts ? Number(discounts[i]) : Number(it.discount) || 0;
    if (!Number.isFinite(d) || d < 0) d = Number(it.discount) || 0;
    d = Math.min(round2(d), round2(price * qty));
    return { ...it, qty, price, discount: d };
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

// Owner only: change a finished sale's lines. Keeps lines unless removed, appends added lines, then re-prices.
//   kept: [{ index, qty, price, discount }]   (index into sale.items; anything not listed is deleted)
//   added: [{ productId, name, qty, price, discount, cost }]
// Cash sale: if the new total is above what was paid, the payment is raised to the new total (customer pays the difference);
// if it is lower, what was paid stays, so "Change due" shows what to give back. Credit sale: the amount owed follows the total.
export function reviseSale(sale, { kept, added }, now = new Date()) {
  const keep = kept.map((k) => ({ ...sale.items[k.index], qty: k.qty, price: k.price, discount: k.discount }));
  const add = (added || []).map((a) => ({ productId: a.productId, name: a.name, qty: a.qty, price: a.price, discount: a.discount || 0, cost: a.cost || 0, listPrice: a.listPrice }));
  if (keep.length + add.length === 0) throw new Error("sale_needs_a_line");
  const items = [...keep, ...add].map((it) => {
    const qty = Math.round(Number(it.qty) * 1000) / 1000, price = Number(it.price);
    const d = Math.min(round2(Math.max(0, Number(it.discount) || 0)), round2(price * qty));
    return { ...it, qty, price, discount: d };
  });
  const total = round2(items.reduce((a, it) => a + lineTotal(it), 0));
  const cost = round2(items.reduce((a, it) => a + (Number(it.cost) || 0) * it.qty, 0));
  let amountTendered = sale.amountTendered, balanceDue;
  if (sale.paymentType === "credit") { amountTendered = Math.min(amountTendered, total); balanceDue = Math.max(0, round2(total - amountTendered)); }
  else { if (amountTendered < total) amountTendered = total; balanceDue = 0; }
  const removedNames = sale.items.filter((_, i) => !kept.some((k) => k.index === i)).map((i) => i.name);
  const revisions = [...(Array.isArray(sale.revisions) ? sale.revisions : []), { at: now.toISOString(), delta: round2(total - sale.total), added: add.map((a) => a.name), removed: removedNames }];
  return { ...sale, items, total, cost, amountTendered, balanceDue, revisions, edited: true, editedAt: now.toISOString() };
}
// Stock movements for a revised sale, per product: positive = goes back on the shelf, negative = comes off it.
export function stockDiffs(oldSale, newSale) {
  const sum = (sale) => { const m = {}; for (const it of sale.items || []) if (it.productId) m[it.productId] = (m[it.productId] || 0) + Number(it.qty); return m; };
  const a = sum(oldSale), b = sum(newSale), out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) { const d = Math.round(((a[id] || 0) - (b[id] || 0)) * 1000) / 1000; if (d) out[id] = d; }
  return out;
}

// Correct the details of a finished receipt. Name and phone: anyone allowed to edit the sale.
// Payment type, amount paid, customer and due date: the owner only (the screen and the server both enforce it).
export function applyDetails(sale, d, now = new Date()) {
  const name = d.customerName !== undefined ? String(d.customerName).trim() : sale.customerName || "";
  const phone = d.customerPhone !== undefined ? String(d.customerPhone).trim() : sale.customerPhone || "";
  const type = d.paymentType || sale.paymentType;
  let customerId = d.customerId !== undefined ? d.customerId : sale.customerId || null;
  let amountTendered = d.amountTendered !== undefined ? Number(d.amountTendered) : sale.amountTendered;
  let dueDate = d.dueDate !== undefined ? d.dueDate || "" : sale.dueDate || "";
  let balanceDue;
  if (type === "credit") {
    if (!name) throw new Error("customer_required");
    if (!customerId) throw new Error("customer_required");
    if (!(amountTendered >= 0) || amountTendered > sale.total) throw new Error("invalid_deposit");
    balanceDue = round2(sale.total - amountTendered);
  } else {
    if (!(amountTendered >= sale.total)) amountTendered = sale.total;
    balanceDue = 0; dueDate = "";
  }
  const changed = [];
  if (name !== (sale.customerName || "")) changed.push("customer name");
  if (phone !== (sale.customerPhone || "")) changed.push("phone");
  if (type !== sale.paymentType) changed.push(type === "credit" ? "cash → credit" : "credit → cash");
  else if (amountTendered !== sale.amountTendered) changed.push("amount paid");
  if ((dueDate || "") !== (sale.dueDate || "")) changed.push("due date");
  if (customerId !== (sale.customerId || null) && type === "credit") changed.push("customer");
  if (!changed.length) return sale;
  const revisions = [...(Array.isArray(sale.revisions) ? sale.revisions : []), { at: now.toISOString(), delta: 0, added: [], removed: [], details: changed }];
  return { ...sale, customerName: name, customerPhone: phone, customerId, paymentType: type, amountTendered, balanceDue, dueDate, revisions, edited: true, editedAt: now.toISOString() };
}
export const moneyDetailsChanged = (a, b) => a.paymentType !== b.paymentType || (a.customerId || null) !== (b.customerId || null) || a.amountTendered !== b.amountTendered || (a.dueDate || "") !== (b.dueDate || "");
