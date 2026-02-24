/**
 * @file invoiceCalc.js
 * @description Pure calculation functions for GST invoice totals.
 *
 * GST Logic:
 * - sellerState === placeOfSupply → Intra-state → CGST + SGST (each half)
 * - sellerState !== placeOfSupply → Inter-state → IGST (full rate)
 *
 * Discount modes per item:
 * - "percent": discount value treated as percentage of subtotal
 * - "flat": discount value treated as absolute amount
 *
 * Exports:
 * - formatCurrency(n, currencyCode): Locale-aware formatter
 * - calcLineItem(item): Per-line taxable, discount, tax
 * - calcInvoiceTotals(inv): Full invoice with grouped tax breakdown
 * - numberToWords(n): Indian English words for amount
 */

import { CURRENCIES } from "./invoiceDefaults";

/**
 * Format a number with the selected currency symbol.
 * Falls back to ₹ if currency not found.
 *
 * @param {number} n - Amount
 * @param {string} currencyCode - e.g. "INR", "USD"
 * @returns {string} Formatted string like "₹1,23,456.00"
 */
export function formatCurrency(n, currencyCode = "INR") {
  const cur = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES[0];
  const locale = currencyCode === "INR" ? "en-IN" : "en-US";
  return cur.symbol + Math.abs(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Backward-compatible alias used throughout the app */
export const formatINR = (n, code) => formatCurrency(n, code);

/**
 * Calculate a single line item's amounts.
 * Handles both percent-based and flat (absolute) discounts.
 *
 * @param {Object} item - { quantity, rate, discount, discountType, gstRate }
 * @returns {Object} { subtotal, discountAmt, taxableValue, gstAmt, total }
 */
export function calcLineItem(item) {
  const subtotal = item.quantity * item.rate;

  // Discount: "percent" applies % of subtotal; "flat" subtracts absolute value
  let discountAmt;
  if (item.discountType === "flat") {
    discountAmt = Math.min(item.discount || 0, subtotal); // can't exceed subtotal
  } else {
    discountAmt = subtotal * ((item.discount || 0) / 100);
  }

  const taxableValue = subtotal - discountAmt;
  const gstAmt = taxableValue * (item.gstRate / 100);

  return {
    subtotal:     Math.round(subtotal * 100) / 100,
    discountAmt:  Math.round(discountAmt * 100) / 100,
    taxableValue: Math.round(taxableValue * 100) / 100,
    gstAmt:       Math.round(gstAmt * 100) / 100,
    total:        Math.round((taxableValue + gstAmt) * 100) / 100,
  };
}

/**
 * Calculate complete invoice totals with tax breakdown.
 *
 * @param {Object} inv - Full invoice object
 * @returns {Object} Comprehensive totals including per-rate tax breakdown
 */
export function calcInvoiceTotals(inv) {
  const isInterState = inv.sellerState !== inv.placeOfSupply;
  const cur = inv.currency || "INR";

  // Step 1: Enrich each item with calculations
  const lineItems = inv.items.map(item => ({ ...item, calc: calcLineItem(item) }));

  // Step 2: Aggregate
  const subtotal      = lineItems.reduce((s, i) => s + i.calc.subtotal, 0);
  const totalDiscount = lineItems.reduce((s, i) => s + i.calc.discountAmt, 0);
  const totalTaxable  = lineItems.reduce((s, i) => s + i.calc.taxableValue, 0);

  // Step 3: Group tax by GST rate
  const taxMap = {};
  lineItems.forEach(item => {
    const r = item.gstRate;
    if (!taxMap[r]) taxMap[r] = { rate: r, taxable: 0, tax: 0 };
    taxMap[r].taxable += item.calc.taxableValue;
    taxMap[r].tax     += item.calc.gstAmt;
  });

  const taxBreakdown = Object.values(taxMap)
    .sort((a, b) => a.rate - b.rate)
    .map(t => ({
      rate: t.rate,
      taxable: Math.round(t.taxable * 100) / 100,
      cgst: isInterState ? 0 : Math.round((t.tax / 2) * 100) / 100,
      sgst: isInterState ? 0 : Math.round((t.tax / 2) * 100) / 100,
      igst: isInterState ? Math.round(t.tax * 100) / 100 : 0,
    }));

  const totalTax  = lineItems.reduce((s, i) => s + i.calc.gstAmt, 0);
  const totalCGST = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const totalSGST = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const totalIGST = isInterState ? Math.round(totalTax * 100) / 100 : 0;

  // Step 4: Grand total
  const shipping    = parseFloat(inv.shippingCharge) || 0;
  const grandTotal  = totalTaxable + totalTax + shipping;
  const roundedTotal = inv.roundOff ? Math.round(grandTotal) : Math.round(grandTotal * 100) / 100;
  const roundOffAmt  = Math.round((roundedTotal - grandTotal) * 100) / 100;

  return {
    lineItems, currency: cur,
    subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTaxable: Math.round(totalTaxable * 100) / 100,
    isInterState, taxBreakdown,
    totalCGST, totalSGST, totalIGST,
    totalTax: Math.round(totalTax * 100) / 100,
    shippingCharge: shipping,
    grandTotal: Math.round(grandTotal * 100) / 100,
    roundedTotal, roundOffAmt,
    amountInWords: numberToWords(roundedTotal, cur),
  };
}

/**
 * Convert number to Indian English words.
 * Prefixes with currency name (e.g., "Rupees", "Dollars").
 *
 * @param {number} n - Amount
 * @param {string} cur - Currency code
 * @returns {string}
 */
export function numberToWords(n, cur = "INR") {
  const currencyNames = { INR: "Rupees", USD: "Dollars", EUR: "Euros", GBP: "Pounds", AED: "Dirhams", SGD: "Dollars", AUD: "Dollars", CAD: "Dollars", JPY: "Yen" };
  const prefix = currencyNames[cur] || "Rupees";
  if (n === 0) return `${prefix} Zero Only`;
  n = Math.round(Math.abs(n));

  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

  function c(num) {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] : "");
    if (num < 1000) return ones[Math.floor(num/100)] + " Hundred" + (num%100 ? " and " + c(num%100) : "");
    if (num < 100000) return c(Math.floor(num/1000)) + " Thousand" + (num%1000 ? " " + c(num%1000) : "");
    if (num < 10000000) return c(Math.floor(num/100000)) + " Lakh" + (num%100000 ? " " + c(num%100000) : "");
    return c(Math.floor(num/10000000)) + " Crore" + (num%10000000 ? " " + c(num%10000000) : "");
  }

  return `${prefix} ${c(n)} Only`;
}