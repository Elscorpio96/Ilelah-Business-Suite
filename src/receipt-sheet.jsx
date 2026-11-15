import React from "react";
import { styles } from "./styles.js";
import { colors, money } from "./theme.js";
import { lineGross, lineDiscount, saleDiscount, saleSubtotal, saleQty, saleRefunded, saleNet } from "./lines.js";

// Paper the receipt is printed on. `w`/`m`: printable width and page margin in mm. zoom scales the type for bigger paper.
export const PAPERS = {
  "58": { label: "58 mm roll (small thermal)", page: "58mm auto", w: 54, m: 2, zoom: 0.9, tall: false },
  "80": { label: "80 mm roll (standard thermal)", page: "80mm auto", w: 76, m: 2, zoom: 1, tall: false },
  a5: { label: "A5 sheet (half page)", page: "A5 portrait", w: 132, m: 8, zoom: 1.2, tall: true },
  a4: { label: "A4 sheet (full page)", page: "A4 portrait", w: 190, m: 10, zoom: 1.4, tall: true },
};
export const TEMPLATES = {
  classic: { label: "Classic", hint: "The standard receipt: numbered items, signatures." },
  compact: { label: "Compact", hint: "Short and tidy. Saves paper on rolls." },
  invoice: { label: "Business invoice", hint: "Logo at the top, boxed table, total box. Best on A5 / A4." },
};
export const paperOf = (s) => PAPERS[(s && s.paperSize) || "80"] || PAPERS["80"];
export const templateOf = (s) => (TEMPLATES[(s && s.receiptTemplate)] ? s.receiptTemplate : "classic");

const mmPx = 3.7795;
// Print page size + the width of the receipt on paper (also used on screen so the preview matches).
export function ReceiptPageStyle({ settings }) {
  const p = paperOf(settings);
  const w = (p.w / p.zoom).toFixed(2);
  // Roll paper has no fixed length, but print engines need one: measure the receipt and make the page exactly that tall.
  const [hmm, setH] = React.useState(0);
  React.useEffect(() => {
    if (p.tall) return undefined;
    const el = document.getElementById("printable-receipt");
    if (!el) return undefined;
    const measure = () => setH(Math.ceil(el.getBoundingClientRect().height / mmPx));
    measure();
    let ro = null;
    if (typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(measure); ro.observe(el); }
    return () => { if (ro) ro.disconnect(); };
  }, [p.tall, p.w, settings.receiptTemplate]);
  const size = p.tall ? p.page : `${p.w + p.m * 2}mm ${Math.max(60, hmm + p.m * 2 + 4)}mm`;
  return (
    <style>{`
      @media print {
        @page { size: ${size}; margin: ${p.m}mm; }
        html, body { height: 100vh !important; min-height: 0 !important; overflow: hidden !important; background: #fff !important; }
        #printable-receipt { width: ${w}mm !important; max-width: ${w}mm !important; padding: 0 !important; zoom: ${p.zoom}; border: none !important; border-radius: 0 !important; }
      }
    `}</style>
  );
}
const previewBox = (settings) => { const p = paperOf(settings); return p.tall ? { width: "100%", maxWidth: 760, margin: "0 auto" } : { width: Math.round(p.w * mmPx) + 28, maxWidth: "100%", margin: "0 auto" }; };

export function Logo({ settings, max = 56, align = "center" }) {
  if (!settings || !settings.logo) return null;
  return <div style={{ textAlign: align, marginBottom: 6 }}><img src={settings.logo} alt="" style={{ maxHeight: max, maxWidth: "70%", objectFit: "contain" }} /></div>;
}

function Totals({ sale, isCredit, size = 11.5 }) {
  const row = (l, r, extra = {}) => <div style={{ ...styles.receiptSubRow, fontSize: size, ...extra }}><span>{l}</span><span style={styles.mono}>{r}</span></div>;
  return (
    <>
      {saleDiscount(sale.items) > 0 && <>{row("Subtotal", money(saleSubtotal(sale.items)))}{row("Discount", "−" + money(saleDiscount(sale.items)), { color: colors.green })}</>}
      <div style={{ ...styles.receiptTotalRow, fontSize: 15 }}><span>Amount Due</span><span style={styles.mono}>{money(sale.total)}</span></div>
      {saleRefunded(sale) > 0 && <>{row("Returned by customer", "−" + money(saleRefunded(sale)), { color: colors.red })}{row("Net after returns", money(saleNet(sale)), { fontWeight: 700 })}</>}
      {row(isCredit ? "Deposit Paid" : "Payment: Cash", money(sale.amountTendered))}
      {row(isCredit ? "AMOUNT OWED" : "Balance", money(sale.balanceDue), isCredit ? { color: colors.red, fontWeight: 700, fontSize: size + 1 } : {})}
      {Number(sale.prevBalance) > 0 && <>{row("Owed from before", money(sale.prevBalance))}{row("TOTAL OWED NOW", money(Number(sale.prevBalance) + Number(sale.balanceDue || 0)), { color: colors.red, fontWeight: 700 })}</>}
    </>
  );
}
const footerText = (isCredit) => (isCredit ? "Goods released on credit. Balance must be settled as agreed. No refund of money after payment." : "Received the above goods in good condition. No refund of money after payment.");
const timeOf = (sale) => { try { return new Date(sale.time).toLocaleTimeString(); } catch (e) { return ""; } };

function Classic({ sale, settings, branch, isCredit, badge }) {
  return (
    <>
      <Logo settings={settings} />
      <div style={styles.invoiceShopName}>{settings.shopName}</div>
      {settings.tagline && <div style={styles.invoiceTagline}>({settings.tagline})</div>}
      {branch && branch.name && <div style={styles.invoiceBranchLine}>Branch: {branch.name}</div>}
      {branch && branch.address && <div style={styles.invoiceMetaLine}>{branch.address}</div>}
      {branch && branch.phone && <div style={styles.invoiceMetaLine}>{branch.phone}</div>}
      <div style={styles.receiptDivider} />
      <div style={{ ...styles.invoiceLabel, ...(isCredit ? { color: colors.red } : {}) }}>{isCredit ? "CREDIT INVOICE: GOODS ON CREDIT" : "CASH INVOICE"}</div>
      <div style={styles.receiptMeta}>
        <div>Invoice No.: <span style={styles.mono}>{sale.invoiceNo}</span></div>
        {badge}
        <div>Date: {sale.date} &nbsp; Time: {timeOf(sale)}</div>
        <div>Name: {sale.customerName || "Walk-in Customer"}</div>
        {isCredit && sale.customerPhone && <div>Phone: {sale.customerPhone}</div>}
        {isCredit && sale.dueDate && <div>Payment due by: <b>{sale.dueDate}</b></div>}
      </div>
      <div style={styles.receiptDivider} />
      <div style={styles.invoiceTableHead}>
        <span style={{ flex: "0 0 24px" }}>S/N</span><span style={{ flex: "0 0 30px" }}>Qty</span><span style={{ flex: 1, minWidth: 0 }}>Description</span>
        <span style={{ flex: "0 0 66px", textAlign: "right" }}>Price</span><span style={{ flex: "0 0 78px", textAlign: "right" }}>Amount</span>
      </div>
      <div style={styles.receiptLines}>
        {sale.items.map((i, idx) => (
          <div key={idx} style={styles.invoiceTableRow}>
            <span style={{ ...styles.mono, flex: "0 0 24px" }}>{idx + 1}</span>
            <span style={{ ...styles.mono, flex: "0 0 30px" }}>{i.qty}</span>
            <span style={{ flex: 1, minWidth: 0, paddingRight: 6 }}>{i.name}</span>
            <span style={{ ...styles.mono, flex: "0 0 66px", textAlign: "right", fontSize: 11 }}>{money(i.price)}</span>
            <span style={{ ...styles.mono, flex: "0 0 78px", textAlign: "right", fontWeight: 600 }}>{money(lineGross(i))}</span>
            {lineDiscount(i) > 0 && <span style={{ flex: "0 0 100%", textAlign: "right", fontSize: 12, color: colors.green }}>Discount −{money(lineDiscount(i))}</span>}
          </div>
        ))}
      </div>
      <div style={styles.receiptDivider} />
      <div style={{ ...styles.receiptSubRow, marginTop: 0, fontWeight: 600, fontSize: 11.5 }}><span>Items: {sale.items.length}</span><span>Total qty: {saleQty(sale.items)}</span></div>
      <Totals sale={sale} isCredit={isCredit} />
      <div style={styles.receiptDivider} />
      <div style={styles.signatureRow}><span>Customer Sign: __________</span><span>Date: __________</span></div>
      <div style={styles.receiptFooter}>{footerText(isCredit)}</div>
      <div style={styles.signatureRow}><span>Cashier: {sale.cashierName}</span><span>Manager: __________</span></div>
      <div style={styles.receiptPrintedOn}>Printed on {new Date().toLocaleString()}</div>
    </>
  );
}

function Compact({ sale, settings, branch, isCredit, badge }) {
  const mid = { textAlign: "center", fontSize: 11, color: colors.inkSoft };
  return (
    <>
      <Logo settings={settings} max={44} />
      <div style={styles.invoiceShopName}>{settings.shopName}</div>
      {branch && branch.address ? <div style={mid}>{branch.address}</div> : settings.address ? <div style={mid}>{settings.address}</div> : null}
      {(branch && branch.phone) || settings.phone ? <div style={mid}>{(branch && branch.phone) || settings.phone}</div> : null}
      <div style={styles.receiptDivider} />
      <div style={{ fontSize: 11.5, display: "flex", justifyContent: "space-between" }}><span>#{sale.invoiceNo}</span><span>{sale.date} {timeOf(sale)}</span></div>
      {badge}
      {(sale.customerName || isCredit) && <div style={{ fontSize: 11.5 }}>{sale.customerName || "Walk-in Customer"}{isCredit && sale.customerPhone ? ` · ${sale.customerPhone}` : ""}</div>}
      {isCredit && <div style={{ fontSize: 11.5, fontWeight: 700, color: colors.red }}>CREDIT SALE{sale.dueDate ? ` · pay by ${sale.dueDate}` : ""}</div>}
      <div style={styles.receiptDivider} />
      {sale.items.map((i, idx) => (
        <div key={idx} style={{ marginBottom: 6, fontSize: 12 }}>
          <div style={{ fontWeight: 600 }}>{i.name}</div>
          <div style={{ display: "flex", justifyContent: "space-between", color: colors.inkSoft }}>
            <span style={styles.mono}>{i.qty} × {money(i.price)}</span><span style={{ ...styles.mono, color: colors.ink }}>{money(lineGross(i))}</span>
          </div>
          {lineDiscount(i) > 0 && <div style={{ textAlign: "right", fontSize: 11, color: colors.green }}>Discount −{money(lineDiscount(i))}</div>}
        </div>
      ))}
      <div style={styles.receiptDivider} />
      <Totals sale={sale} isCredit={isCredit} />
      <div style={{ ...styles.receiptFooter, marginTop: 10 }}>Thank you for your patronage.</div>
      <div style={{ ...styles.receiptFooter, marginTop: 2 }}>Served by {sale.cashierName}</div>
    </>
  );
}

function Invoice({ sale, settings, branch, isCredit, badge }) {
  const addr = (branch && branch.address) || settings.address;
  const phone = (branch && branch.phone) || settings.phone;
  const th = { textAlign: "left", fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#0F172A", padding: "6px 8px" };
  const td = { padding: "6px 8px", borderBottom: `1px solid ${colors.line}`, fontSize: 12, verticalAlign: "top" };
  const R = { textAlign: "right" };
  const paid = !isCredit || Number(sale.balanceDue) <= 0;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          {settings.logo && <img src={settings.logo} alt="" style={{ maxHeight: 64, maxWidth: 110, objectFit: "contain" }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em" }}>{settings.shopName}</div>
            {settings.tagline && <div style={{ fontSize: 11, color: colors.inkSoft }}>{settings.tagline}</div>}
            {branch && branch.name && <div style={{ fontSize: 11, color: colors.inkSoft }}>Branch: {branch.name}</div>}
            {addr && <div style={{ fontSize: 11, color: colors.inkSoft }}>{addr}</div>}
            {phone && <div style={{ fontSize: 11, color: colors.inkSoft }}>Tel: {phone}</div>}
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "0 0 auto" }}>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: "0.06em", color: isCredit ? colors.red : "#0F172A" }}>{isCredit ? "CREDIT INVOICE" : "INVOICE"}</div>
          <div style={{ fontSize: 11.5 }}>No. <span style={styles.mono}>{sale.invoiceNo}</span></div>
          <div style={{ fontSize: 11.5 }}>{sale.date} · {timeOf(sale)}</div>
          {badge}
        </div>
      </div>
      <div style={{ height: 3, background: "#0F172A", margin: "12px 0 10px", borderRadius: 2 }} />
      <div style={{ fontSize: 11, color: colors.inkSoft, fontWeight: 700, letterSpacing: "0.04em" }}>BILLED TO</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{sale.customerName || "Walk-in Customer"}</div>
      {sale.customerPhone && <div style={{ fontSize: 11.5 }}>{sale.customerPhone}</div>}
      {isCredit && sale.dueDate && <div style={{ fontSize: 11.5 }}>Payment due by: <b>{sale.dueDate}</b></div>}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
        <thead><tr><th style={{ ...th, width: 28 }}>#</th><th style={th}>Description</th><th style={{ ...th, ...R, width: 44 }}>Qty</th><th style={{ ...th, ...R, width: 84 }}>Price</th><th style={{ ...th, ...R, width: 92 }}>Amount</th></tr></thead>
        <tbody>
          {sale.items.map((i, idx) => (
            <tr key={idx}>
              <td style={{ ...td, ...styles.mono }}>{idx + 1}</td>
              <td style={td}>{i.name}{lineDiscount(i) > 0 && <div style={{ fontSize: 11, color: colors.green }}>Discount −{money(lineDiscount(i))}</div>}</td>
              <td style={{ ...td, ...R, ...styles.mono }}>{i.qty}</td>
              <td style={{ ...td, ...R, ...styles.mono }}>{money(i.price)}</td>
              <td style={{ ...td, ...R, ...styles.mono, fontWeight: 600 }}>{money(lineGross(i))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: colors.inkSoft, flex: 1 }}>
          <div>{sale.items.length} item(s) · total quantity {saleQty(sale.items)}</div>
          <div style={{ marginTop: 6, display: "inline-block", border: `2px solid ${paid ? colors.green : colors.red}`, color: paid ? colors.green : colors.red, fontWeight: 800, padding: "2px 10px", borderRadius: 6, letterSpacing: "0.08em", transform: "rotate(-4deg)" }}>{paid ? "PAID" : "BALANCE DUE"}</div>
        </div>
        <div style={{ flex: "1 1 220px", maxWidth: 300, marginLeft: "auto", border: `1px solid ${colors.line}`, borderRadius: 8, padding: "8px 10px" }}><Totals sale={sale} isCredit={isCredit} size={12} /></div>
      </div>
      <div style={{ ...styles.receiptFooter, marginTop: 16, textAlign: "left" }}>{footerText(isCredit)}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 28, fontSize: 11, color: colors.inkSoft }}>
        <span style={{ borderTop: `1px solid ${colors.ink}`, paddingTop: 4, minWidth: 130 }}>Customer signature</span>
        <span style={{ borderTop: `1px solid ${colors.ink}`, paddingTop: 4, minWidth: 130, textAlign: "right" }}>Authorised by ({sale.cashierName})</span>
      </div>
      <div style={styles.receiptPrintedOn}>Printed on {new Date().toLocaleString()}</div>
    </>
  );
}

export function ReceiptSheet({ sale, settings, branch, isCredit, badge, preview }) {
  const t = templateOf(settings);
  const Body = t === "compact" ? Compact : t === "invoice" ? Invoice : Classic;
  const box = previewBox(settings);
  return (
    <>
      {!preview && <ReceiptPageStyle settings={settings} />}
      <div id={preview ? undefined : "printable-receipt"} className="force-light" style={{ ...styles.receiptPrintArea, ...(isCredit ? styles.creditPrintArea : {}), ...box, ...(t === "invoice" ? { padding: "20px 22px" } : {}) }}>
        <Body sale={sale} settings={settings} branch={branch} isCredit={isCredit} badge={badge} />
      </div>
    </>
  );
}

// ---- logo upload: shrink to a small picture so it stays light in backups and on the receipt
export function prepareLogo(file, maxSide = 360) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error("not_image")); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
        let out = c.toDataURL("image/png");
        if (out.length > 160000) { // big photo-like logo: JPEG on white is much smaller
          const c2 = document.createElement("canvas"); c2.width = w; c2.height = h; const g2 = c2.getContext("2d");
          g2.fillStyle = "#fff"; g2.fillRect(0, 0, w, h); g2.drawImage(img, 0, 0, w, h); out = c2.toDataURL("image/jpeg", 0.85);
        }
        URL.revokeObjectURL(url); resolve(out);
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad_image")); };
    img.src = url;
  });
}
