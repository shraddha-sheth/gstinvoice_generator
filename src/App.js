/**
 * @file App.js
 * @description Main GST Invoice Generator application.
 *
 * New in this version:
 * - Discount: toggle between % and fixed (₹) per line item
 * - Currency selector: INR, USD, EUR, GBP, AED, SGD, AUD, CAD, JPY
 * - Template thumbnails: SVG mini-previews colored to match active theme
 * - Subtle corporate color palette throughout
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  DEFAULT_INVOICE, INDIAN_STATES, COLOR_THEMES, TEMPLATE_LIST, CURRENCIES, createEmptyItem,
} from "./invoiceDefaults";
import { calcInvoiceTotals, formatCurrency } from "./invoiceCalc";
import { exportPDF, exportDOCX, exportExcel } from "./invoiceExport";

// ─── Persistence ─────────────────────────────────────────────────
const KEY = "gst-invoice-v2";
const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
const load = () => { try { const r = localStorage.getItem(KEY); return r ? { ...DEFAULT_INVOICE, ...JSON.parse(r) } : null; } catch { return null; } };

// ─── Reusable Form Components ────────────────────────────────────
function Field({ label, value, onChange, type, placeholder, required, maxLength, className }) {
  return (
    <div className={`field ${className || ""}`}>
      <label>{label}{required && <span className="req">*</span>}</label>
      <input type={type || "text"} value={value} placeholder={placeholder || ""} maxLength={maxLength}
        onChange={e => onChange(type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value)} />
    </div>
  );
}

function Dropdown({ label, value, onChange, options, required, className }) {
  return (
    <div className={`field ${className || ""}`}>
      <label>{label}{required && <span className="req">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextArea({ label, value, onChange, rows, placeholder }) {
  return (
    <div className="field field-full">
      <label>{label}</label>
      <textarea value={value} rows={rows || 3} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle-row"><span>{label}</span>
      <span className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span className="toggle-knob" /></span>
    </label>
  );
}

function Section({ title, icon, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen !== false);
  return (
    <div className="section-card">
      <div className="section-header" onClick={() => setOpen(!open)}>
        <span className="section-icon">{icon}</span>
        <h3>{title}</h3>
        <span className={`chevron ${open ? "up" : ""}`}>▾</span>
      </div>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

// ─── Template Thumbnail (renders SVG with theme colors) ──────────
function TemplateThumbnail({ template, theme, active, onClick }) {
  // Replace ACCENT placeholder in SVG with actual theme color
  const coloredSvg = template.svg.replace(/ACCENT/g, theme.primary);
  return (
    <button className={`template-card ${active ? "active" : ""}`} onClick={onClick} title={template.name}>
      <div className="template-thumb" dangerouslySetInnerHTML={{ __html: coloredSvg }} />
      <div className="template-info">
        <strong>{template.name}</strong>
        <span>{template.desc}</span>
      </div>
    </button>
  );
}

// ─── Line Items Editor ───────────────────────────────────────────
function ItemsEditor({ items, onChange, currency }) {
  const update = (idx, field, val) => {
    const u = [...items]; u[idx] = { ...u[idx], [field]: val }; onChange(u);
  };
  const add = () => onChange([...items, createEmptyItem()]);
  const remove = (idx) => items.length > 1 && onChange(items.filter((_, i) => i !== idx));
  const cur = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];

  const gstOptions = [
    { value: 0, label: "0%" }, { value: 5, label: "5%" }, { value: 12, label: "12%" },
    { value: 18, label: "18%" }, { value: 28, label: "28%" },
  ];

  return (
    <div className="items-editor">
      {items.map((item, i) => (
        <div key={item.id} className="item-row">
          <div className="item-number">{i + 1}</div>
          <div className="item-fields">
            <div className="item-grid">
              <Field label="Description" value={item.description} onChange={v => update(i, "description", v)} className="col-span-2" required />
              <Field label="HSN/SAC" value={item.hsnCode} onChange={v => update(i, "hsnCode", v)} placeholder="e.g. 9983" />
              <Field label="Qty" type="number" value={item.quantity} onChange={v => update(i, "quantity", v)} />
              <Field label="Unit" value={item.unit} onChange={v => update(i, "unit", v)} placeholder="Nos" />
              <Field label={`Rate (${cur.symbol})`} type="number" value={item.rate} onChange={v => update(i, "rate", v)} />
              {/* ── Discount: type toggle + value ── */}
              <div className="field discount-field">
                <label>Discount</label>
                <div className="discount-input-group">
                  <input type="number" value={item.discount} min="0"
                    onChange={e => update(i, "discount", parseFloat(e.target.value) || 0)} />
                  <div className="discount-toggle">
                    <button className={item.discountType === "percent" ? "dt-active" : ""}
                      onClick={() => update(i, "discountType", "percent")} type="button">%</button>
                    <button className={item.discountType === "fixed" ? "dt-active" : ""}
                      onClick={() => update(i, "discountType", "fixed")} type="button">{cur.symbol}</button>
                  </div>
                </div>
              </div>
              <div className="field">
                <label>GST %</label>
                <select value={item.gstRate} onChange={e => update(i, "gstRate", parseInt(e.target.value))}>
                  {gstOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <button className="item-remove" onClick={() => remove(i)} title="Remove">×</button>
        </div>
      ))}
      <button className="btn-add-item" onClick={add}>+ Add Item</button>
    </div>
  );
}

// ─── Invoice Preview ─────────────────────────────────────────────
function InvoicePreview({ inv, totals, theme }) {
  const sn = (code) => INDIAN_STATES.find(s => s.code === code)?.name || code;
  const fc = (n) => formatCurrency(n, inv.currency);

  return (
    <div className="preview-invoice" style={{ "--t-primary": theme.primary, "--t-accent": theme.accent, "--t-light": theme.light }}>
      <div className="inv-header">
        <div className="inv-header-left">
          {inv.logo && <img src={inv.logo} alt="Logo" className="inv-logo" />}
          <div>
            <h2 className="inv-title">TAX INVOICE</h2>
            <p className="inv-meta">#{inv.invoiceNumber} &nbsp;|&nbsp; {inv.invoiceDate} {inv.currency !== "INR" && <> &nbsp;|&nbsp; {inv.currency}</>}</p>
            {inv.dueDate && <p className="inv-meta">Due: {inv.dueDate}</p>}
            {inv.reverseCharge && <p className="inv-badge">Reverse Charge</p>}
          </div>
        </div>
      </div>

      <div className="inv-parties">
        <div className="inv-party"><h4>From</h4><p className="inv-party-name">{inv.sellerName || "Your Business"}</p><p>{inv.sellerAddress}</p>{inv.sellerGSTIN && <p><strong>GSTIN:</strong> {inv.sellerGSTIN}</p>}{inv.sellerPAN && <p><strong>PAN:</strong> {inv.sellerPAN}</p>}<p>{sn(inv.sellerState)}</p></div>
        <div className="inv-party"><h4>Bill To</h4><p className="inv-party-name">{inv.buyerName || "Client"}</p><p>{inv.buyerAddress}</p>{inv.buyerGSTIN && <p><strong>GSTIN:</strong> {inv.buyerGSTIN}</p>}<p>{sn(inv.buyerState)}</p></div>
        {inv.shippingEnabled && inv.shippingName && <div className="inv-party"><h4>Ship To</h4><p className="inv-party-name">{inv.shippingName}</p><p>{inv.shippingAddress}</p><p>{sn(inv.shippingState)}</p></div>}
      </div>

      <p className="inv-pos">Place of Supply: <strong>{sn(inv.placeOfSupply)} ({inv.placeOfSupply})</strong> — {totals.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}</p>

      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead><tr><th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Disc</th><th>Taxable</th><th>GST</th><th>Amount</th></tr></thead>
          <tbody>
            {totals.lineItems.map((item, i) => {
              const dLabel = item.discountType === "fixed" ? fc(item.discount) : item.discount + "%";
              return (
                <tr key={item.id}><td>{i+1}</td><td>{item.description||"—"}</td><td>{item.hsnCode||"—"}</td>
                  <td>{item.quantity} {item.unit}</td><td>{fc(item.rate)}</td><td>{dLabel}</td>
                  <td>{fc(item.calc.taxableValue)}</td><td>{item.gstRate}%</td><td className="amt">{fc(item.calc.total)}</td></tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="inv-totals-section">
        <div className="inv-totals-left">
          {inv.bankName && <div className="inv-bank"><h4>Bank Details</h4><p>{inv.bankName}</p>{inv.accountNumber && <p>A/C: {inv.accountNumber}</p>}{inv.ifscCode && <p>IFSC: {inv.ifscCode}</p>}{inv.bankBranch && <p>Branch: {inv.bankBranch}</p>}</div>}
        </div>
        <div className="inv-totals-right">
          <div className="inv-total-row"><span>Subtotal</span><span>{fc(totals.totalTaxable)}</span></div>
          {totals.totalDiscount > 0 && <div className="inv-total-row"><span>Discount</span><span>-{fc(totals.totalDiscount)}</span></div>}
          {totals.taxBreakdown.map(t => t.rate > 0 && (
            totals.isInterState
              ? <div key={t.rate} className="inv-total-row"><span>IGST @ {t.rate}%</span><span>{fc(t.igst)}</span></div>
              : <React.Fragment key={t.rate}><div className="inv-total-row"><span>CGST @ {t.rate/2}%</span><span>{fc(t.cgst)}</span></div><div className="inv-total-row"><span>SGST @ {t.rate/2}%</span><span>{fc(t.sgst)}</span></div></React.Fragment>
          ))}
          {totals.shippingCharge > 0 && <div className="inv-total-row"><span>Shipping</span><span>{fc(totals.shippingCharge)}</span></div>}
          {inv.roundOff && totals.roundOffAmt !== 0 && <div className="inv-total-row"><span>Round Off</span><span>{fc(totals.roundOffAmt)}</span></div>}
          <div className="inv-total-row inv-grand-total"><span>Total</span><span>{fc(totals.roundedTotal)}</span></div>
        </div>
      </div>

      <p className="inv-words">{totals.amountInWords}</p>
      {inv.termsAndConditions && <div className="inv-footer-section"><h4>Terms & Conditions</h4><p>{inv.termsAndConditions}</p></div>}
      {inv.notes && <div className="inv-footer-section"><h4>Notes</h4><p>{inv.notes}</p></div>}
      <div className="inv-signature"><div></div><div className="inv-sig-block"><p>Authorized Signatory</p><p className="inv-sig-name">{inv.sellerName}</p></div></div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN APP
// ═════════════════════════════════════════════════════════════════
export default function App() {
  const [inv, setInv] = useState(() => load() || { ...DEFAULT_INVOICE });
  const [tab, setTab] = useState("form");
  const fileRef = useRef(null);

  useEffect(() => { save(inv); }, [inv]);

  const u = useCallback((f, v) => setInv(prev => ({ ...prev, [f]: v })), []);
  const totals = calcInvoiceTotals(inv);
  const theme = COLOR_THEMES.find(t => t.id === inv.colorTheme) || COLOR_THEMES[0];
  const fc = (n) => formatCurrency(n, inv.currency);

  const stateOpts = INDIAN_STATES.map(s => ({ value: s.code, label: `${s.name} (${s.code})` }));
  const currencyOpts = CURRENCIES.map(c => ({ value: c.code, label: `${c.symbol} ${c.code} — ${c.name}` }));

  const handleLogo = (e) => { const f = e.target.files?.[0]; if(!f)return; const r = new FileReader(); r.onload = ev => u("logo", ev.target.result); r.readAsDataURL(f); };
  const handleReset = () => { if(window.confirm("Clear all fields?")) setInv({ ...DEFAULT_INVOICE, items: [createEmptyItem()] }); };

  const tabs = [{ id: "form", label: "✏️ Edit" }, { id: "preview", label: "👁 Preview" }, { id: "export", label: "📥 Export" }];

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand"><h1>GST Invoice<span>Generator</span></h1><p className="tagline">Professional GST-compliant invoices</p></div>
          <div className="header-actions"><button className="btn-ghost" onClick={handleReset}>Reset</button></div>
        </div>
        <nav className="tab-bar">{tabs.map(t => <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
      </header>

      <main className="main">
        {tab === "form" && (
          <div className="form-container">
            {/* ── Branding ── */}
            <Section title="Branding & Theme" icon="🎨" defaultOpen={true}>
              <div className="brand-section">
                <div className="logo-upload" onClick={() => fileRef.current?.click()}>
                  {inv.logo ? <img src={inv.logo} alt="Logo" /> : <span>+ Upload Logo</span>}
                  <input type="file" accept="image/*" ref={fileRef} onChange={handleLogo} style={{ display: "none" }} />
                </div>
                {inv.logo && <button className="btn-ghost btn-sm btn-dark" onClick={() => u("logo", null)}>Remove</button>}
              </div>
              <div className="theme-picker">
                <label>Color Theme</label>
                <div className="theme-swatches">
                  {COLOR_THEMES.map(t => (
                    <button key={t.id} className={`swatch ${inv.colorTheme === t.id ? "active" : ""}`}
                      style={{ background: `linear-gradient(135deg, ${t.primary} 50%, ${t.accent} 50%)` }}
                      onClick={() => u("colorTheme", t.id)} title={t.name} />
                  ))}
                </div>
              </div>
              <div className="template-picker">
                <label>Invoice Template</label>
                <div className="template-cards">
                  {TEMPLATE_LIST.map(t => <TemplateThumbnail key={t.id} template={t} theme={theme} active={inv.template === t.id} onClick={() => u("template", t.id)} />)}
                </div>
              </div>
            </Section>

            {/* ── Invoice Details ── */}
            <Section title="Invoice Details" icon="📋" defaultOpen={true}>
              <div className="field-grid">
                <Field label="Invoice Number" value={inv.invoiceNumber} onChange={v => u("invoiceNumber", v)} required />
                <Field label="Invoice Date" type="date" value={inv.invoiceDate} onChange={v => u("invoiceDate", v)} required />
                <Field label="Due Date" type="date" value={inv.dueDate} onChange={v => u("dueDate", v)} />
                <Dropdown label="Place of Supply" value={inv.placeOfSupply} onChange={v => u("placeOfSupply", v)} options={stateOpts} required />
                <Dropdown label="Currency" value={inv.currency} onChange={v => u("currency", v)} options={currencyOpts} />
              </div>
              <Toggle label="Reverse Charge Mechanism" checked={inv.reverseCharge} onChange={v => u("reverseCharge", v)} />
            </Section>

            {/* ── Seller ── */}
            <Section title="Your Business (Seller)" icon="🏢">
              <div className="field-grid">
                <Field label="Business Name" value={inv.sellerName} onChange={v => u("sellerName", v)} required className="col-span-2" />
                <Field label="GSTIN" value={inv.sellerGSTIN} onChange={v => u("sellerGSTIN", v)} placeholder="22AAAAA0000A1Z5" maxLength={15} required />
                <Field label="PAN" value={inv.sellerPAN} onChange={v => u("sellerPAN", v)} placeholder="AAAAA0000A" maxLength={10} />
                <Dropdown label="State" value={inv.sellerState} onChange={v => u("sellerState", v)} options={stateOpts} required />
                <Field label="Phone" value={inv.sellerPhone} onChange={v => u("sellerPhone", v)} />
                <Field label="Email" value={inv.sellerEmail} onChange={v => u("sellerEmail", v)} />
              </div>
              <TextArea label="Address" value={inv.sellerAddress} onChange={v => u("sellerAddress", v)} placeholder="Full business address" />
            </Section>

            {/* ── Buyer ── */}
            <Section title="Client (Bill To)" icon="👤">
              <div className="field-grid">
                <Field label="Client Name" value={inv.buyerName} onChange={v => u("buyerName", v)} required className="col-span-2" />
                <Field label="GSTIN" value={inv.buyerGSTIN} onChange={v => u("buyerGSTIN", v)} placeholder="Optional for B2C" maxLength={15} />
                <Dropdown label="State" value={inv.buyerState} onChange={v => u("buyerState", v)} options={stateOpts} />
                <Field label="Phone" value={inv.buyerPhone} onChange={v => u("buyerPhone", v)} />
                <Field label="Email" value={inv.buyerEmail} onChange={v => u("buyerEmail", v)} />
              </div>
              <TextArea label="Address" value={inv.buyerAddress} onChange={v => u("buyerAddress", v)} />
            </Section>

            {/* ── Shipping ── */}
            <Section title="Shipping (Optional)" icon="🚚" defaultOpen={false}>
              <Toggle label="Enable Shipping Address" checked={inv.shippingEnabled} onChange={v => u("shippingEnabled", v)} />
              {inv.shippingEnabled && <div className="field-grid"><Field label="Recipient" value={inv.shippingName} onChange={v => u("shippingName", v)} className="col-span-2" /><Dropdown label="State" value={inv.shippingState} onChange={v => u("shippingState", v)} options={stateOpts} /><TextArea label="Address" value={inv.shippingAddress} onChange={v => u("shippingAddress", v)} /></div>}
            </Section>

            {/* ── Items ── */}
            <Section title="Items / Services" icon="📦" defaultOpen={true}>
              <ItemsEditor items={inv.items} onChange={v => u("items", v)} currency={inv.currency} />
              <div className="field-grid" style={{ marginTop: "1rem" }}>
                <Field label={`Shipping Charge (${CURRENCIES.find(c=>c.code===inv.currency)?.symbol||"₹"})`} type="number" value={inv.shippingCharge} onChange={v => u("shippingCharge", v)} />
                <Toggle label="Round Off Total" checked={inv.roundOff} onChange={v => u("roundOff", v)} />
              </div>
            </Section>

            {/* ── Bank ── */}
            <Section title="Bank Details" icon="🏦" defaultOpen={false}>
              <div className="field-grid"><Field label="Bank Name" value={inv.bankName} onChange={v => u("bankName", v)} /><Field label="Account No." value={inv.accountNumber} onChange={v => u("accountNumber", v)} /><Field label="IFSC" value={inv.ifscCode} onChange={v => u("ifscCode", v)} /><Field label="Branch" value={inv.bankBranch} onChange={v => u("bankBranch", v)} /></div>
            </Section>

            {/* ── Terms ── */}
            <Section title="Terms & Notes" icon="📝" defaultOpen={false}>
              <TextArea label="Terms & Conditions" value={inv.termsAndConditions} onChange={v => u("termsAndConditions", v)} rows={4} placeholder="Payment due within 30 days..." />
              <TextArea label="Notes / Remarks" value={inv.notes} onChange={v => u("notes", v)} rows={3} placeholder="Additional notes" />
            </Section>

            {/* ── Quick Summary ── */}
            <div className="quick-summary">
              <div className="qs-row"><span>Taxable</span><span>{fc(totals.totalTaxable)}</span></div>
              <div className="qs-row"><span>Tax</span><span>{fc(totals.totalTax)}</span></div>
              <div className="qs-row qs-total"><span>Total</span><span>{fc(totals.roundedTotal)}</span></div>
            </div>
          </div>
        )}

        {tab === "preview" && <div className="preview-container"><InvoicePreview inv={inv} totals={totals} theme={theme} /></div>}

        {tab === "export" && (
          <div className="export-container">
            <div className="export-card">
              <h2>Download Invoice</h2>
              <p>All exports include full GST details, tax breakdown, and your branding.</p>
              <div className="export-buttons">
                <button className="export-btn pdf" onClick={() => exportPDF(inv, totals, theme)}><span className="export-icon">📄</span><span>Download PDF</span><span className="export-desc">Print-ready with theme colors</span></button>
                <button className="export-btn docx" onClick={() => exportDOCX(inv, totals)}><span className="export-icon">📝</span><span>Download DOCX</span><span className="export-desc">Editable Word document</span></button>
                <button className="export-btn xlsx" onClick={() => exportExcel(inv, totals)}><span className="export-icon">📊</span><span>Download Excel</span><span className="export-desc">Spreadsheet with all data</span></button>
              </div>
            </div>
            <div className="export-card">
              <h3>Summary</h3>
              <div className="export-summary">
                <div><span>Invoice</span><strong>#{inv.invoiceNumber}</strong></div>
                <div><span>Client</span><strong>{inv.buyerName || "—"}</strong></div>
                <div><span>Items</span><strong>{inv.items.length}</strong></div>
                <div><span>Taxable</span><strong>{fc(totals.totalTaxable)}</strong></div>
                <div><span>{totals.isInterState ? "IGST" : "CGST+SGST"}</span><strong>{fc(totals.totalTax)}</strong></div>
                <div className="export-total"><span>Total ({inv.currency})</span><strong>{fc(totals.roundedTotal)}</strong></div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer"><p>GST Invoice Generator • For informational purposes only.</p></footer>
    </div>
  );
}