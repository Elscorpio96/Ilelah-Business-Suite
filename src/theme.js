// Design tokens + number formatting. Single source of truth for the look of the app.
export const CURRENCY = "₦";

export const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const colors = {
  // surfaces
  bg: "#F5F7FA",
  surface: "#FFFFFF",
  surface2: "#F1F4F8",
  panel: "#FFFFFF",
  // text
  ink: "#0F172A",
  inkSoft: "#5B6678",
  inkFaint: "#94A0B2",
  // lines
  line: "#E7EBF0",
  lineStrong: "#D3DAE3",
  // brand
  primary: "#0F766E",
  primaryDark: "#0B5C56",
  primarySoft: "#E4F4F1",
  // semantic
  amber: "#B45309",
  amberSoft: "#FEF3E0",
  red: "#DC2626",
  redSoft: "#FDECEC",
  green: "#15803D",
  greenSoft: "#E3F5E9",
  blue: "#2563EB",
  blueSoft: "#E8F0FE",
  whatsapp: "#1FA855",
  whatsappSoft: "#E4F6EB",
};
// Backwards-compatible names used across the app.
colors.teal = colors.primary;
colors.tealSoft = colors.primarySoft;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };
export const shadow = {
  sm: "0 1px 2px rgba(15,23,42,0.05)",
  md: "0 1px 3px rgba(15,23,42,0.06), 0 4px 14px rgba(15,23,42,0.05)",
  lg: "0 18px 44px rgba(15,23,42,0.20)",
};
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 };

const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// 54200 -> "54,200"   1200.5 -> "1,200.50"
export function fmtNum(n) {
  const v = round2(Number(n) || 0);
  const abs = Math.abs(v);
  const whole = Number.isInteger(abs);
  const txt = abs.toLocaleString("en-US", whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-" : "") + txt;
}
export const money = (n) => {
  const t = fmtNum(n);
  return t.startsWith("-") ? "-" + CURRENCY + t.slice(1) : CURRENCY + t;
};
// Compact for tight spots: 1,250,000 -> ₦1.25M
export function moneyShort(n) {
  const v = Number(n) || 0, a = Math.abs(v), s = v < 0 ? "-" : "";
  if (a >= 1e9) return s + CURRENCY + round2(a / 1e9) + "B";
  if (a >= 1e6) return s + CURRENCY + round2(a / 1e6) + "M";
  if (a >= 1e4) return s + CURRENCY + round2(a / 1e3) + "K";
  return money(v);
}
