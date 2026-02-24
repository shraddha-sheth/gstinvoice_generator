/**
 * @file invoiceDefaults.js
 * @description Default data structures, constants, and Indian state list for GST invoicing.
 *
 * This module provides:
 * - INDIAN_STATES: All states/UTs with codes for Place of Supply dropdown
 * - COLOR_THEMES: Predefined brand color themes users can choose
 * - TEMPLATE_LIST: Available invoice template identifiers
 * - DEFAULT_INVOICE: The initial blank invoice state
 * - createEmptyItem: Factory function for new line items
 */

// ─── Indian States & Union Territories (with GST State Codes) ────
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

// ─── Color Themes ────────────────────────────────────────────────
export const COLOR_THEMES = [
  { id: "slate",   name: "Midnight Slate",  primary: "#0f172a", accent: "#3b82f6", light: "#e2e8f0" },
  { id: "emerald", name: "Emerald Forest",  primary: "#064e3b", accent: "#10b981", light: "#d1fae5" },
  { id: "wine",    name: "Royal Wine",      primary: "#4a0404", accent: "#dc2626", light: "#fecaca" },
  { id: "indigo",  name: "Deep Indigo",     primary: "#312e81", accent: "#6366f1", light: "#e0e7ff" },
  { id: "amber",   name: "Warm Amber",      primary: "#451a03", accent: "#f59e0b", light: "#fef3c7" },
  { id: "teal",    name: "Ocean Teal",      primary: "#134e4a", accent: "#14b8a6", light: "#ccfbf1" },
];

// ─── Template Definitions ────────────────────────────────────────
export const TEMPLATE_LIST = [
  { id: "classic",    name: "Classic",       desc: "Clean professional layout with top header bar" },
  { id: "modern",     name: "Modern",        desc: "Sleek design with sidebar accent strip" },
  { id: "minimal",    name: "Minimal",       desc: "Whitespace-focused with subtle borders" },
  { id: "bold",       name: "Bold",          desc: "Full-color header with large typography" },
  { id: "corporate",  name: "Corporate",     desc: "Formal two-column header for enterprises" },
];

// ─── Factory: Empty Line Item ────────────────────────────────────
export function createEmptyItem() {
  return {
    id: Date.now() + Math.random(),  // unique key for React list rendering
    description: "",
    hsnCode: "",                     // HSN/SAC code for GST classification
    quantity: 1,
    unit: "Nos",                     // UOM: Nos, Kg, Ltrs, etc.
    rate: 0,
    discount: 0,                     // discount percentage per item
    gstRate: 18,                     // GST rate: 0, 5, 12, 18, 28
  };
}

// ─── Default Invoice State ───────────────────────────────────────
export const DEFAULT_INVOICE = {
  // Seller (Your Business)
  sellerName: "",
  sellerAddress: "",
  sellerGSTIN: "",
  sellerState: "27",                // Maharashtra default
  sellerPhone: "",
  sellerEmail: "",
  sellerPAN: "",

  // Buyer (Bill To)
  buyerName: "",
  buyerAddress: "",
  buyerGSTIN: "",
  buyerState: "27",
  buyerPhone: "",
  buyerEmail: "",

  // Shipping (Ship To — optional)
  shippingEnabled: false,
  shippingName: "",
  shippingAddress: "",
  shippingState: "27",

  // Invoice Meta
  invoiceNumber: "INV-001",
  invoiceDate: new Date().toISOString().split("T")[0],
  dueDate: "",
  placeOfSupply: "27",              // determines IGST vs CGST+SGST
  reverseCharge: false,

  // Line Items
  items: [createEmptyItem()],

  // Additional Charges
  shippingCharge: 0,
  roundOff: true,

  // Bank Details (for payment)
  bankName: "",
  accountNumber: "",
  ifscCode: "",
  bankBranch: "",

  // Footer
  termsAndConditions: "",
  notes: "",

  // Branding
  logo: null,                        // base64 data URL
  colorTheme: "slate",
  template: "classic",
};
