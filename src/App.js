/**
 * @file App.js
 * @description Main GST Invoice Generator application.
 *
 * Architecture:
 * - Single-page React app with tab-based navigation
 * - Tab 1 (Form): All invoice fields organized in collapsible sections
 * - Tab 2 (Preview): Live invoice preview matching selected template
 * - Tab 3 (Export): Template/theme selection + download buttons
 *
 * Features:
 * - Full GST compliance fields (GSTIN, POS, HSN, reverse charge)
 * - Logo upload with base64 storage
 * - 5 invoice templates + 6 color themes
 * - PDF / DOCX / Excel export
 * - Auto-save to localStorage
 * - Responsive mobile-first design
 * - Terms & conditions / notes fields
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  DEFAULT_INVOICE, INDIAN_STATES, COLOR_THEMES, TEMPLATE_LIST, createEmptyItem,
} from "./invoiceDefaults";
import { calcInvoiceTotals, formatINR } from "./invoiceCalc";
import { exportPDF, exportDOCX, exportExcel } from "./invoiceExport";

// ─── Auto-save helpers ───────────────────────────────────────────
const SAVE_KEY = "gst-invoice-v1";
const save = (d) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(d)); } catch {} };
const load = () => { try { const r = localStorage.getItem(SAVE_KEY); return r ? { ...DEFAULT_INVOICE, ...JSON.parse(r) } : null; } catch { return null; } };

// ─── Reusable Components ─────────────────────────────────────────

/** Text/number input with floating label style */
function Field({ label, value, onChange, type, placeholder, required, maxLength, className }) {
  return (
    <div className={`field ${className || ""}`}>
      <label>{label}{required && <span className="req">*</span>}</label>
      <input type={type || "text"} value={value} placeholder={placeholder || ""} maxLength={maxLength}
        onChange={e => onChange(type === "number" ? (parseFloat(e.target.value) || 0) : e.target.value)} />
    </div>
  );
}

/** Select dropdown */
function Dropdown({ label, value, onChange, options, required }) {
  return (
    <div className="field">
      <label>{label}{required && <span className="req">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

/** Textarea */
function TextArea({ label, value, onChange, rows, placeholder }) {
  return (
    <div className="field field-full">
      <label>{label}</label>
      <textarea value={value} rows={rows || 3} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </div>
  );
}

/** Toggle switch */
function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle-row"><span>{label}</span>
      <span className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><span className="toggle-knob" /></span>
    </label>
  );
}

/** Collapsible section card */
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

// ─── Line Items Editor ───────────────────────────────────────────
function ItemsEditor({ items, onChange }) {
  const update = (idx, field, val) => {
    const u = [...items]; u[idx] = { ...u[idx], [field]: val }; onChange(u);
  };
  const add = () => onChange([...items, createEmptyItem()]);
  const remove = (idx) => items.length > 1 && onChange(items.filter((_, i) => i !== idx));

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
              <Field label="Rate (₹)" type="number" value={item.rate} onChange={v => update(i, "rate", v)} />
              <Field label="Disc %" type="number" value={item.discount} onChange={v => update(i, "discount", v)} />
              <div className="field">
                <label>GST %</label>
                <select value={item.gstRate} onChange={e => update(i, "gstRate", parseInt(e.target.value))}>
                  {gstOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          </div>
          <button className="item-remove" onClick={() => remove(i)} title="Remove item">×</button>
        </div>
      ))}
      <button className="btn-add-item" onClick={add}>+ Add Item</button>
    </div>
  );
}

// ─── Invoice Preview (Template Renderer) ─────────────────────────
function InvoicePreview({ inv, totals, theme }) {
  const stateName = (code) => INDIAN_STATES.find(s => s.code === code)?.name || code;

  return (
    <div className="preview-invoice" style={{ "--t-primary": theme.primary, "--t-accent": theme.accent, "--t-light": theme.light }}>
      {/* Header */}
      <div className="inv-header">
        <div className="inv-header-left">
          {inv.logo && <img src={inv.logo} alt="Logo" className="inv-logo" />}
          <div>
            <h2 className="inv-title">TAX INVOICE</h2>
            <p className="inv-meta">#{inv.invoiceNumber} &nbsp;|&nbsp; {inv.invoiceDate}</p>
            {inv.dueDate && <p className="inv-meta">Due: {inv.dueDate}</p>}
            {inv.reverseCharge && <p className="inv-badge">Reverse Charge</p>}
          </div>
        </div>
      </div>

      {/* Parties */}
      <div className="inv-parties">
        <div className="inv-party">
          <h4>From</h4>
          <p className="inv-party-name">{inv.sellerName || "Your Business"}</p>
          <p>{inv.sellerAddress}</p>
          {inv.sellerGSTIN && <p><strong>GSTIN:</strong> {inv.sellerGSTIN}</p>}
          {inv.sellerPAN && <p><strong>PAN:</strong> {inv.sellerPAN}</p>}
          <p>{stateName(inv.sellerState)}</p>
        </div>
        <div className="inv-party">
          <h4>Bill To</h4>
          <p className="inv-party-name">{inv.buyerName || "Client Name"}</p>
          <p>{inv.buyerAddress}</p>
          {inv.buyerGSTIN && <p><strong>GSTIN:</strong> {inv.buyerGSTIN}</p>}
          <p>{stateName(inv.buyerState)}</p>
        </div>
        {inv.shippingEnabled && inv.shippingName && (
          <div className="inv-party">
            <h4>Ship To</h4>
            <p className="inv-party-name">{inv.shippingName}</p>
            <p>{inv.shippingAddress}</p>
            <p>{stateName(inv.shippingState)}</p>
          </div>
        )}
      </div>

      <p className="inv-pos">Place of Supply: <strong>{stateName(inv.placeOfSupply)} ({inv.placeOfSupply})</strong> — {totals.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}</p>

      {/* Items Table */}
      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr>
              <th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Rate</th><th>Disc</th><th>Taxable</th><th>GST</th><th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {totals.lineItems.map((item, i) => (
              <tr key={item.id}>
                <td>{i + 1}</td><td>{item.description || "—"}</td><td>{item.hsnCode || "—"}</td>
                <td>{item.quantity} {item.unit}</td><td>{formatINR(item.rate)}</td>
                <td>{item.discount}%</td><td>{formatINR(item.calc.taxableValue)}</td>
                <td>{item.gstRate}%</td><td className="amt">{formatINR(item.calc.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="inv-totals-section">
        <div className="inv-totals-left">
          {inv.bankName && (
            <div className="inv-bank">
              <h4>Bank Details</h4>
              <p>{inv.bankName}</p>
              {inv.accountNumber && <p>A/C: {inv.accountNumber}</p>}
              {inv.ifscCode && <p>IFSC: {inv.ifscCode}</p>}
              {inv.bankBranch && <p>Branch: {inv.bankBranch}</p>}
            </div>
          )}
        </div>
        <div className="inv-totals-right">
          <div className="inv-total-row"><span>Subtotal</span><span>{formatINR(totals.totalTaxable)}</span></div>
          {totals.totalDiscount > 0 && <div className="inv-total-row"><span>Discount</span><span>-{formatINR(totals.totalDiscount)}</span></div>}
          {totals.taxBreakdown.map(t => t.rate > 0 && (
            totals.isInterState
              ? <div key={t.rate} className="inv-total-row"><span>IGST @ {t.rate}%</span><span>{formatINR(t.igst)}</span></div>
              : <React.Fragment key={t.rate}>
                  <div className="inv-total-row"><span>CGST @ {t.rate/2}%</span><span>{formatINR(t.cgst)}</span></div>
                  <div className="inv-total-row"><span>SGST @ {t.rate/2}%</span><span>{formatINR(t.sgst)}</span></div>
                </React.Fragment>
          ))}
          {totals.shippingCharge > 0 && <div className="inv-total-row"><span>Shipping</span><span>{formatINR(totals.shippingCharge)}</span></div>}
          {inv.roundOff && totals.roundOffAmt !== 0 && <div className="inv-total-row"><span>Round Off</span><span>{formatINR(totals.roundOffAmt)}</span></div>}
          <div className="inv-total-row inv-grand-total"><span>Total</span><span>{formatINR(totals.roundedTotal)}</span></div>
        </div>
      </div>

      <p className="inv-words">{totals.amountInWords}</p>

      {/* Footer sections */}
      {inv.termsAndConditions && <div className="inv-footer-section"><h4>Terms & Conditions</h4><p>{inv.termsAndConditions}</p></div>}
      {inv.notes && <div className="inv-footer-section"><h4>Notes</h4><p>{inv.notes}</p></div>}

      <div className="inv-signature">
        <div></div>
        <div className="inv-sig-block"><p>Authorized Signatory</p><p className="inv-sig-name">{inv.sellerName}</p></div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// MAIN APPLICATION
// ═════════════════════════════════════════════════════════════════
export default function App() {
  const [inv, setInv] = useState(() => load() || { ...DEFAULT_INVOICE });
  const [tab, setTab] = useState("form");
  const fileRef = useRef(null);

  // Auto-save on every change
  useEffect(() => { save(inv); }, [inv]);

  // Updater helper
  const u = useCallback((field, val) => setInv(prev => ({ ...prev, [field]: val })), []);

  // Computed values
  const totals = calcInvoiceTotals(inv);
  const theme = COLOR_THEMES.find(t => t.id === inv.colorTheme) || COLOR_THEMES[0];

  // State dropdown options
  const stateOpts = INDIAN_STATES.map(s => ({ value: s.code, label: `${s.name} (${s.code})` }));

  // Logo upload handler
  const handleLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => u("logo", ev.target.result);
    reader.readAsDataURL(file);
  };

  // Export handlers
  const handleExportPDF = () => exportPDF(inv, totals, theme);
  const handleExportDOCX = () => exportDOCX(inv, totals);
  const handleExportExcel = () => exportExcel(inv, totals);

  // Reset invoice
  const handleReset = () => { if (window.confirm("Clear all fields?")) setInv({ ...DEFAULT_INVOICE, items: [createEmptyItem()] }); };

  const tabs = [
    { id: "form", label: "✏️ Edit", icon: "Edit" },
    { id: "preview", label: "👁 Preview", icon: "Preview" },
    { id: "export", label: "📥 Export", icon: "Export" },
  ];

  return (
    <div className="app">
      {/* ── App Header ────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-inner">
          <div className="brand">
            <h1>GST Invoice<span>Generator</span></h1>
            <p className="tagline">Professional GST-compliant invoices</p>
          </div>
          <div className="header-actions">
            <button className="btn-ghost" onClick={handleReset}>Reset</button>
          </div>
        </div>
        <nav className="tab-bar">
          {tabs.map(t => (
            <button key={t.id} className={`tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      </header>

      <main className="main">
        {/* ═══ FORM TAB ═════════════════════════════════════════ */}
        {tab === "form" && (
          <div className="form-container">
            {/* Logo & Branding */}
            <Section title="Branding" icon="🎨" defaultOpen={true}>
              <div className="brand-section">
                <div className="logo-upload" onClick={() => fileRef.current?.click()}>
                  {inv.logo ? <img src={inv.logo} alt="Logo" /> : <span>+ Upload Logo</span>}
                  <input type="file" accept="image/*" ref={fileRef} onChange={handleLogo} style={{ display: "none" }} />
                </div>
                {inv.logo && <button className="btn-ghost btn-sm" onClick={() => u("logo", null)}>Remove</button>}
              </div>
              <div className="theme-picker">
                <label>Color Theme</label>
                <div className="theme-swatches">
                  {COLOR_THEMES.map(t => (
                    <button key={t.id} className={`swatch ${inv.colorTheme === t.id ? "active" : ""}`}
                      style={{ background: t.primary, borderColor: t.accent }} onClick={() => u("colorTheme", t.id)} title={t.name}>
                      <span style={{ background: t.accent }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="template-picker">
                <label>Invoice Template</label>
                <div className="template-cards">
                  {TEMPLATE_LIST.map(t => (
                    <button key={t.id} className={`template-card ${inv.template === t.id ? "active" : ""}`} onClick={() => u("template", t.id)}>
                      <strong>{t.name}</strong><span>{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Section>

            {/* Invoice Details */}
            <Section title="Invoice Details" icon="📋" defaultOpen={true}>
              <div className="field-grid">
                <Field label="Invoice Number" value={inv.invoiceNumber} onChange={v => u("invoiceNumber", v)} required />
                <Field label="Invoice Date" type="date" value={inv.invoiceDate} onChange={v => u("invoiceDate", v)} required />
                <Field label="Due Date" type="date" value={inv.dueDate} onChange={v => u("dueDate", v)} />
                <Dropdown label="Place of Supply" value={inv.placeOfSupply} onChange={v => u("placeOfSupply", v)} options={stateOpts} required />
              </div>
              <Toggle label="Reverse Charge Mechanism" checked={inv.reverseCharge} onChange={v => u("reverseCharge", v)} />
            </Section>

            {/* Seller Details */}
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

            {/* Buyer Details */}
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

            {/* Shipping (optional) */}
            <Section title="Shipping Details (Optional)" icon="🚚" defaultOpen={false}>
              <Toggle label="Enable Shipping Address" checked={inv.shippingEnabled} onChange={v => u("shippingEnabled", v)} />
              {inv.shippingEnabled && (
                <div className="field-grid">
                  <Field label="Recipient Name" value={inv.shippingName} onChange={v => u("shippingName", v)} className="col-span-2" />
                  <Dropdown label="State" value={inv.shippingState} onChange={v => u("shippingState", v)} options={stateOpts} />
                  <TextArea label="Shipping Address" value={inv.shippingAddress} onChange={v => u("shippingAddress", v)} />
                </div>
              )}
            </Section>

            {/* Line Items */}
            <Section title="Items / Services" icon="📦" defaultOpen={true}>
              <ItemsEditor items={inv.items} onChange={v => u("items", v)} />
              <div className="field-grid" style={{ marginTop: "1rem" }}>
                <Field label="Shipping Charge (₹)" type="number" value={inv.shippingCharge} onChange={v => u("shippingCharge", v)} />
                <Toggle label="Round Off Total" checked={inv.roundOff} onChange={v => u("roundOff", v)} />
              </div>
            </Section>

            {/* Bank Details */}
            <Section title="Bank Details (Payment)" icon="🏦" defaultOpen={false}>
              <div className="field-grid">
                <Field label="Bank Name" value={inv.bankName} onChange={v => u("bankName", v)} />
                <Field label="Account Number" value={inv.accountNumber} onChange={v => u("accountNumber", v)} />
                <Field label="IFSC Code" value={inv.ifscCode} onChange={v => u("ifscCode", v)} />
                <Field label="Branch" value={inv.bankBranch} onChange={v => u("bankBranch", v)} />
              </div>
            </Section>

            {/* Terms & Notes */}
            <Section title="Terms & Notes" icon="📝" defaultOpen={false}>
              <TextArea label="Terms & Conditions" value={inv.termsAndConditions} onChange={v => u("termsAndConditions", v)} rows={4} placeholder="e.g. Payment due within 30 days. Late payments attract 18% interest p.a." />
              <TextArea label="Notes / Remarks" value={inv.notes} onChange={v => u("notes", v)} rows={3} placeholder="Any additional notes for the client" />
            </Section>

            {/* Quick Summary (sticky on mobile) */}
            <div className="quick-summary">
              <div className="qs-row"><span>Taxable</span><span>{formatINR(totals.totalTaxable)}</span></div>
              <div className="qs-row"><span>Tax</span><span>{formatINR(totals.totalTax)}</span></div>
              <div className="qs-row qs-total"><span>Total</span><span>{formatINR(totals.roundedTotal)}</span></div>
            </div>
          </div>
        )}

        {/* ═══ PREVIEW TAB ══════════════════════════════════════ */}
        {tab === "preview" && (
          <div className="preview-container">
            <InvoicePreview inv={inv} totals={totals} theme={theme} />
          </div>
        )}

        {/* ═══ EXPORT TAB ═══════════════════════════════════════ */}
        {tab === "export" && (
          <div className="export-container">
            <div className="export-card">
              <h2>Download Invoice</h2>
              <p>Choose your preferred format. All exports include full GST details.</p>
              <div className="export-buttons">
                <button className="export-btn pdf" onClick={handleExportPDF}>
                  <span className="export-icon">📄</span><span>Download PDF</span><span className="export-desc">Print-ready with color theme</span>
                </button>
                <button className="export-btn docx" onClick={handleExportDOCX}>
                  <span className="export-icon">📝</span><span>Download DOCX</span><span className="export-desc">Editable Word document</span>
                </button>
                <button className="export-btn xlsx" onClick={handleExportExcel}>
                  <span className="export-icon">📊</span><span>Download Excel</span><span className="export-desc">Spreadsheet with formulas</span>
                </button>
              </div>
            </div>
            <div className="export-card">
              <h3>Invoice Summary</h3>
              <div className="export-summary">
                <div><span>Invoice</span><strong>#{inv.invoiceNumber}</strong></div>
                <div><span>Client</span><strong>{inv.buyerName || "—"}</strong></div>
                <div><span>Items</span><strong>{inv.items.length}</strong></div>
                <div><span>Taxable</span><strong>{formatINR(totals.totalTaxable)}</strong></div>
                <div><span>{totals.isInterState ? "IGST" : "CGST+SGST"}</span><strong>{formatINR(totals.totalTax)}</strong></div>
                <div className="export-total"><span>Total</span><strong>{formatINR(totals.roundedTotal)}</strong></div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>GST Invoice Generator • For informational purposes. Verify with a CA.</p>
      </footer>
    </div>
  );
}
