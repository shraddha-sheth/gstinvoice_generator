/**
 * @file invoiceDefaults.js
 * @description Default data structures, constants, and configuration for GST invoicing.
 *
 * Exports:
 * - INDIAN_STATES: All states/UTs with GST codes for Place of Supply
 * - COLOR_THEMES: Subtle, corporate color palettes
 * - TEMPLATE_LIST: Invoice templates with SVG thumbnail previews
 * - CURRENCIES: Supported currency list with symbols
 * - DEFAULT_INVOICE: Blank invoice initial state
 * - createEmptyItem: Factory for new line items (supports % and flat discount)
 */

// ─── Indian States & Union Territories (GST State Codes) ─────────
export const INDIAN_STATES = [
  { code: "01", name: "Jammu & Kashmir" }, { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" }, { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" }, { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" }, { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" }, { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" }, { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" }, { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" }, { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" }, { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" }, { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" }, { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" }, { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" }, { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" }, { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" }, { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" }, { code: "35", name: "Andaman & Nicobar" },
  { code: "36", name: "Telangana" }, { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" }, { code: "97", name: "Other Territory" },
];

// ─── Color Themes — Subtle, light, corporate tones ──────────────
export const COLOR_THEMES = [
  { id: "slate",   name: "Corporate Blue",  primary: "#3e5068", accent: "#7296bf", light: "#f2f5f9" },
  { id: "emerald", name: "Sage Green",      primary: "#476b5e", accent: "#7db39e", light: "#f1f7f4" },
  { id: "wine",    name: "Dusty Rose",      primary: "#6e5060", accent: "#c0939f", light: "#faf3f5" },
  { id: "indigo",  name: "Soft Indigo",     primary: "#50508a", accent: "#9494ca", light: "#f2f2fa" },
  { id: "amber",   name: "Warm Taupe",      primary: "#6a5a44", accent: "#b9a57c", light: "#f9f6f0" },
  { id: "teal",    name: "Steel Teal",      primary: "#456568", accent: "#7eb3b7", light: "#f0f7f8" },
];

// ─── Currencies ──────────────────────────────────────────────────
export const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "AED", symbol: "د.إ", name: "UAE Dirham" },
  { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  { code: "CAD", symbol: "C$", name: "Canadian Dollar" },
  { code: "JPY", symbol: "¥", name: "Japanese Yen" },
];

// ─── Template Definitions with SVG thumbnail generators ──────────
/**
 * Each template has an `id`, display `name`, short `desc`, and a
 * `thumbnail` function that takes a theme object ({primary, accent, light})
 * and returns a tiny SVG string representing the layout visually.
 */
export const TEMPLATE_LIST = [
  {
    id: "classic", name: "Classic", desc: "Top header bar with clean columns",
    thumbnail: (t) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="4"/>
      <rect width="120" height="28" fill="${t.primary}" rx="4 4 0 0"/>
      <rect x="8" y="6" width="40" height="4" rx="1" fill="#fff" opacity=".9"/>
      <rect x="8" y="14" width="25" height="3" rx="1" fill="#fff" opacity=".5"/>
      <rect x="8" y="34" width="48" height="16" rx="2" fill="${t.light}"/>
      <rect x="64" y="34" width="48" height="16" rx="2" fill="${t.light}"/>
      <rect x="8" y="56" width="104" height="3" rx="1" fill="${t.primary}" opacity=".15"/>
      <rect x="8" y="63" width="104" height="2" rx="1" fill="${t.light}"/>
      <rect x="8" y="69" width="104" height="2" rx="1" fill="${t.light}"/>
      <rect x="8" y="75" width="104" height="2" rx="1" fill="${t.light}"/>
      <rect x="8" y="81" width="104" height="2" rx="1" fill="${t.light}"/>
      <rect x="70" y="92" width="42" height="3" rx="1" fill="${t.accent}" opacity=".5"/>
      <rect x="70" y="99" width="42" height="3" rx="1" fill="${t.accent}" opacity=".5"/>
      <rect x="70" y="108" width="42" height="4" rx="1" fill="${t.primary}" opacity=".8"/>
      <rect x="8" y="125" width="60" height="2" rx="1" fill="#ddd"/>
      <rect x="8" y="130" width="45" height="2" rx="1" fill="#ddd"/>
    </svg>`
  },
  {
    id: "modern", name: "Modern", desc: "Left accent strip with airy layout",
    thumbnail: (t) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="4"/>
      <rect width="5" height="160" fill="${t.accent}" rx="4 0 0 4"/>
      <rect x="14" y="10" width="45" height="5" rx="1" fill="${t.primary}" opacity=".8"/>
      <rect x="14" y="19" width="30" height="3" rx="1" fill="${t.accent}" opacity=".5"/>
      <rect x="14" y="30" width="45" height="14" rx="2" fill="${t.light}"/>
      <rect x="66" y="30" width="45" height="14" rx="2" fill="${t.light}"/>
      <rect x="14" y="52" width="97" height="2" rx="1" fill="${t.primary}" opacity=".1"/>
      <rect x="14" y="58" width="97" height="2" rx="1" fill="${t.light}"/>
      <rect x="14" y="64" width="97" height="2" rx="1" fill="${t.light}"/>
      <rect x="14" y="70" width="97" height="2" rx="1" fill="${t.light}"/>
      <rect x="14" y="76" width="97" height="2" rx="1" fill="${t.light}"/>
      <rect x="72" y="88" width="39" height="3" rx="1" fill="${t.accent}" opacity=".4"/>
      <rect x="72" y="95" width="39" height="3" rx="1" fill="${t.accent}" opacity=".4"/>
      <rect x="72" y="104" width="39" height="4" rx="1" fill="${t.primary}" opacity=".7"/>
      <rect x="14" y="120" width="50" height="2" rx="1" fill="#ddd"/>
    </svg>`
  },
  {
    id: "minimal", name: "Minimal", desc: "Whitespace-focused, clean borders",
    thumbnail: (t) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="4"/>
      <rect x="8" y="10" width="50" height="5" rx="1" fill="${t.primary}" opacity=".6"/>
      <rect x="8" y="19" width="30" height="3" rx="1" fill="#bbb"/>
      <line x1="8" y1="28" x2="112" y2="28" stroke="${t.accent}" stroke-width="1" opacity=".4"/>
      <rect x="8" y="34" width="40" height="12" rx="2" fill="${t.light}" opacity=".7"/>
      <rect x="68" y="34" width="40" height="12" rx="2" fill="${t.light}" opacity=".7"/>
      <rect x="8" y="54" width="104" height="2" rx="1" fill="#eee"/>
      <rect x="8" y="60" width="104" height="2" rx="1" fill="#f5f5f5"/>
      <rect x="8" y="66" width="104" height="2" rx="1" fill="#eee"/>
      <rect x="8" y="72" width="104" height="2" rx="1" fill="#f5f5f5"/>
      <rect x="8" y="78" width="104" height="2" rx="1" fill="#eee"/>
      <line x1="8" y1="88" x2="112" y2="88" stroke="#ddd" stroke-width="0.5"/>
      <rect x="74" y="93" width="38" height="3" rx="1" fill="#ccc"/>
      <rect x="74" y="100" width="38" height="3" rx="1" fill="#ccc"/>
      <rect x="74" y="109" width="38" height="4" rx="1" fill="${t.primary}" opacity=".5"/>
      <rect x="8" y="128" width="55" height="2" rx="1" fill="#e0e0e0"/>
    </svg>`
  },
  {
    id: "bold", name: "Bold", desc: "Large colored header, strong presence",
    thumbnail: (t) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="4"/>
      <rect width="120" height="42" fill="${t.primary}" rx="4 4 0 0"/>
      <rect x="10" y="8" width="55" height="7" rx="2" fill="#fff" opacity=".9"/>
      <rect x="10" y="20" width="35" height="3" rx="1" fill="#fff" opacity=".45"/>
      <rect x="10" y="27" width="25" height="3" rx="1" fill="#fff" opacity=".3"/>
      <rect x="10" y="48" width="45" height="14" rx="2" fill="${t.light}"/>
      <rect x="62" y="48" width="45" height="14" rx="2" fill="${t.light}"/>
      <rect x="10" y="68" width="100" height="3" rx="1" fill="${t.accent}" opacity=".2"/>
      <rect x="10" y="75" width="100" height="2" rx="1" fill="${t.light}"/>
      <rect x="10" y="81" width="100" height="2" rx="1" fill="${t.light}"/>
      <rect x="10" y="87" width="100" height="2" rx="1" fill="${t.light}"/>
      <rect x="68" y="98" width="42" height="3" rx="1" fill="${t.accent}" opacity=".5"/>
      <rect x="68" y="105" width="42" height="3" rx="1" fill="${t.accent}" opacity=".5"/>
      <rect x="68" y="114" width="42" height="5" rx="1" fill="${t.primary}" opacity=".8"/>
      <rect x="10" y="132" width="50" height="2" rx="1" fill="#ddd"/>
    </svg>`
  },
  {
    id: "corporate", name: "Corporate", desc: "Formal two-column header",
    thumbnail: (t) => `<svg viewBox="0 0 120 160" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="160" fill="#fff" rx="4"/>
      <rect x="8" y="8" width="18" height="18" rx="3" fill="${t.light}" stroke="${t.accent}" stroke-width="0.5"/>
      <rect x="32" y="10" width="45" height="4" rx="1" fill="${t.primary}" opacity=".7"/>
      <rect x="32" y="18" width="30" height="3" rx="1" fill="#bbb"/>
      <rect x="82" y="10" width="28" height="3" rx="1" fill="${t.accent}" opacity=".5"/>
      <rect x="82" y="17" width="20" height="2" rx="1" fill="#ccc"/>
      <line x1="8" y1="32" x2="112" y2="32" stroke="${t.primary}" stroke-width="0.7" opacity=".2"/>
      <rect x="8" y="38" width="48" height="14" rx="2" fill="${t.light}" opacity=".8"/>
      <rect x="64" y="38" width="48" height="14" rx="2" fill="${t.light}" opacity=".8"/>
      <rect x="8" y="58" width="104" height="2.5" rx="1" fill="${t.primary}" opacity=".12"/>
      <rect x="8" y="64" width="104" height="2" rx="1" fill="#f2f2f2"/>
      <rect x="8" y="70" width="104" height="2" rx="1" fill="#f2f2f2"/>
      <rect x="8" y="76" width="104" height="2" rx="1" fill="#f2f2f2"/>
      <rect x="8" y="82" width="104" height="2" rx="1" fill="#f2f2f2"/>
      <rect x="70" y="94" width="42" height="3" rx="1" fill="${t.accent}" opacity=".35"/>
      <rect x="70" y="101" width="42" height="3" rx="1" fill="${t.accent}" opacity=".35"/>
      <rect x="70" y="110" width="42" height="4" rx="1" fill="${t.primary}" opacity=".6"/>
      <rect x="8" y="128" width="55" height="2" rx="1" fill="#e0e0e0"/>
      <rect x="8" y="134" width="40" height="2" rx="1" fill="#e0e0e0"/>
    </svg>`
  },
];

// ─── Factory: Empty Line Item ────────────────────────────────────
/**
 * Creates a new blank line item.
 * discountType: "percent" or "flat" — controls how discount is applied.
 */
export function createEmptyItem() {
  return {
    id: Date.now() + Math.random(),
    description: "",
    hsnCode: "",
    quantity: 1,
    unit: "Nos",
    rate: 0,
    discount: 0,
    discountType: "percent",   // "percent" = %, "flat" = absolute amount
    gstRate: 18,
  };
}

// ─── Default Invoice State ───────────────────────────────────────
export const DEFAULT_INVOICE = {
  // Currency
  currency: "INR",

  // Seller
  sellerName: "", sellerAddress: "", sellerGSTIN: "", sellerState: "27",
  sellerPhone: "", sellerEmail: "", sellerPAN: "",

  // Buyer
  buyerName: "", buyerAddress: "", buyerGSTIN: "", buyerState: "27",
  buyerPhone: "", buyerEmail: "",

  // Shipping (optional)
  shippingEnabled: false, shippingName: "", shippingAddress: "", shippingState: "27",

  // Invoice Meta
  invoiceNumber: "INV-001",
  invoiceDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  placeOfSupply: "27",
  reverseCharge: false,

  // Line Items
  items: [createEmptyItem()],

  // Additional Charges
  shippingCharge: 0,
  roundOff: true,

  // Bank Details
  bankName: "", accountNumber: "", ifscCode: "", bankBranch: "",

  // Footer
  termsAndConditions: "",
  notes: "",

  // Branding
  logo: null,
  colorTheme: "slate",
  template: "classic",
};