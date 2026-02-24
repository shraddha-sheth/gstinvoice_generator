/**
 * @file invoiceCalc.js
 * @description Pure calculation functions for GST invoice totals.
 *
 * GST Logic:
 * - If seller state === place of supply → Intra-state → CGST + SGST (each half of GST)
 * - If seller state !== place of supply → Inter-state → IGST (full GST rate)
 *
 * Each item can have a different GST rate (0%, 5%, 12%, 18%, 28%).
 *
 * Exports:
 * - calcLineItem(item): computes per-line taxable, discount, tax amounts
 * - calcInvoiceTotals(invoice): computes full invoice totals with tax breakdowns
 * - formatINR(n): Indian locale currency formatter
 * - numberToWords(n): Converts number to Indian English words (for invoices)
 */

/**
 * Format a number as Indian Rupees (₹1,23,456.00)
 * @param {number} n - Amount to format
 * @returns {string} Formatted currency string
 */
export function formatINR(n) {
  return "₹" + Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Calculate a single line item's amounts
 * @param {Object} item - Line item with quantity, rate, discount, gstRate
 * @returns {Object} { subtotal, discountAmt, taxableValue, gstAmt, cgst, sgst, igst, total }
 */
export function calcLineItem(item) {
  const subtotal = item.quantity * item.rate;
  const discountAmt = subtotal * (item.discount / 100);
  const taxableValue = subtotal - discountAmt;
  const gstAmt = taxableValue * (item.gstRate / 100);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmt: Math.round(discountAmt * 100) / 100,
    taxableValue: Math.round(taxableValue * 100) / 100,
    gstAmt: Math.round(gstAmt * 100) / 100,
    total: Math.round((taxableValue + gstAmt) * 100) / 100,
  };
}

/**
 * Calculate complete invoice totals with tax breakdown
 *
 * @param {Object} inv - Full invoice object from state
 * @returns {Object} {
 *   lineItems: [{ ...item, calc }],    // items enriched with calculations
 *   subtotal, totalDiscount, totalTaxable,
 *   isInterState,                        // true if IGST applies
 *   taxBreakdown: [{ rate, taxable, cgst, sgst, igst }],  // grouped by GST rate
 *   totalCGST, totalSGST, totalIGST, totalTax,
 *   shippingCharge, grandTotal, roundedTotal, roundOffAmt,
 *   amountInWords
 * }
 */
export function calcInvoiceTotals(inv) {
  const isInterState = inv.sellerState !== inv.placeOfSupply;

  // Step 1: Calculate each line item
  const lineItems = inv.items.map(item => ({
    ...item,
    calc: calcLineItem(item),
  }));

  // Step 2: Aggregate totals
  const subtotal = lineItems.reduce((s, i) => s + i.calc.subtotal, 0);
  const totalDiscount = lineItems.reduce((s, i) => s + i.calc.discountAmt, 0);
  const totalTaxable = lineItems.reduce((s, i) => s + i.calc.taxableValue, 0);

  // Step 3: Group tax by rate for the tax breakdown table
  const taxMap = {};
  lineItems.forEach(item => {
    const rate = item.gstRate;
    if (!taxMap[rate]) taxMap[rate] = { rate, taxable: 0, tax: 0 };
    taxMap[rate].taxable += item.calc.taxableValue;
    taxMap[rate].tax += item.calc.gstAmt;
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

  const totalTax = lineItems.reduce((s, i) => s + i.calc.gstAmt, 0);
  const totalCGST = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const totalSGST = isInterState ? 0 : Math.round((totalTax / 2) * 100) / 100;
  const totalIGST = isInterState ? Math.round(totalTax * 100) / 100 : 0;

  // Step 4: Grand total
  const shipping = parseFloat(inv.shippingCharge) || 0;
  const grandTotal = totalTaxable + totalTax + shipping;
  const roundedTotal = inv.roundOff ? Math.round(grandTotal) : Math.round(grandTotal * 100) / 100;
  const roundOffAmt = Math.round((roundedTotal - grandTotal) * 100) / 100;

  return {
    lineItems, subtotal: Math.round(subtotal * 100) / 100,
    totalDiscount: Math.round(totalDiscount * 100) / 100,
    totalTaxable: Math.round(totalTaxable * 100) / 100,
    isInterState, taxBreakdown,
    totalCGST, totalSGST, totalIGST,
    totalTax: Math.round(totalTax * 100) / 100,
    shippingCharge: shipping,
    grandTotal: Math.round(grandTotal * 100) / 100,
    roundedTotal, roundOffAmt,
    amountInWords: numberToWords(roundedTotal),
  };
}

/**
 * Convert a number to Indian English words (used on invoice footer)
 * Handles up to ₹99,99,99,99,999 (99 crore+)
 *
 * @param {number} n - Amount (rounded to integer)
 * @returns {string} e.g. "Rupees Twelve Thousand Three Hundred Forty Five Only"
 */
export function numberToWords(n) {
  if (n === 0) return "Rupees Zero Only";
  n = Math.round(Math.abs(n));

  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convert(num) {
    if (num < 20) return ones[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
    if (num < 1000) return ones[Math.floor(num / 100)] + " Hundred" + (num % 100 ? " and " + convert(num % 100) : "");
    if (num < 100000) return convert(Math.floor(num / 1000)) + " Thousand" + (num % 1000 ? " " + convert(num % 1000) : "");
    if (num < 10000000) return convert(Math.floor(num / 100000)) + " Lakh" + (num % 100000 ? " " + convert(num % 100000) : "");
    return convert(Math.floor(num / 10000000)) + " Crore" + (num % 10000000 ? " " + convert(num % 10000000) : "");
  }

  return "Rupees " + convert(n) + " Only";
}
