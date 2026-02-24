/**
 * @file invoiceExport.js
 * @description Export functions for generating invoice files in PDF, DOCX, and Excel formats.
 *
 * Uses:
 * - jsPDF + jspdf-autotable → PDF generation
 * - docx (docx-js) + file-saver → Word document generation
 * - SheetJS (xlsx) → Excel workbook generation
 *
 * All exports receive the invoice data + calculated totals and produce downloadable files.
 */

import jsPDF from "jspdf";
import "jspdf-autotable";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, ShadingType } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { formatINR } from "./invoiceCalc";
import { INDIAN_STATES } from "./invoiceDefaults";

/** Helper: get state name from code */
const stateName = (code) => INDIAN_STATES.find(s => s.code === code)?.name || code;

// ═══════════════════════════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate and download a PDF invoice
 *
 * @param {Object} inv - Invoice form data
 * @param {Object} totals - Calculated totals from calcInvoiceTotals
 * @param {Object} theme - { primary, accent, light } color theme
 */
export function exportPDF(inv, totals, theme) {
  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Color helpers ────────────────────────────────────────────
  const hexToRGB = (hex) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };
  const primary = hexToRGB(theme.primary);
  const accent = hexToRGB(theme.accent);
  const lightBg = hexToRGB(theme.light);

  // ── Header bar ───────────────────────────────────────────────
  doc.setFillColor(...primary);
  doc.rect(0, 0, pageW, 35, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", margin, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #: ${inv.invoiceNumber}`, margin, 24);
  doc.text(`Date: ${inv.invoiceDate}`, margin, 29);
  if (inv.dueDate) doc.text(`Due: ${inv.dueDate}`, margin + 60, 29);

  // Reverse charge flag
  if (inv.reverseCharge) {
    doc.setFontSize(8);
    doc.text("Reverse Charge: Yes", pageW - margin, 24, { align: "right" });
  }

  y = 42;

  // ── Seller / Buyer blocks ────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  const halfW = contentW / 2 - 3;

  // Seller
  doc.setFillColor(...lightBg);
  doc.roundedRect(margin, y, halfW, 38, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.text("FROM", margin + 4, y + 5);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(inv.sellerName || "Your Business", margin + 4, y + 11);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  const sellerLines = doc.splitTextToSize(inv.sellerAddress || "", halfW - 8);
  doc.text(sellerLines, margin + 4, y + 16);
  if (inv.sellerGSTIN) { doc.setFont("helvetica", "bold"); doc.text(`GSTIN: ${inv.sellerGSTIN}`, margin + 4, y + 28); }
  if (inv.sellerPAN) { doc.setFont("helvetica", "normal"); doc.text(`PAN: ${inv.sellerPAN}`, margin + 4, y + 33); }

  // Buyer
  const bx = margin + halfW + 6;
  doc.setFillColor(...lightBg);
  doc.roundedRect(bx, y, halfW, 38, 2, 2, "F");
  doc.setFontSize(7);
  doc.setTextColor(...accent);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", bx + 4, y + 5);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(inv.buyerName || "Client Name", bx + 4, y + 11);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  const buyerLines = doc.splitTextToSize(inv.buyerAddress || "", halfW - 8);
  doc.text(buyerLines, bx + 4, y + 16);
  if (inv.buyerGSTIN) { doc.setFont("helvetica", "bold"); doc.text(`GSTIN: ${inv.buyerGSTIN}`, bx + 4, y + 28); }

  y += 42;

  // Place of supply
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Place of Supply: ${stateName(inv.placeOfSupply)} (${inv.placeOfSupply})  |  ${totals.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}`, margin, y);
  y += 6;

  // ── Items Table ──────────────────────────────────────────────
  const tableHeaders = ["#", "Description", "HSN/SAC", "Qty", "Rate", "Disc%", "Taxable", "GST%", "Amount"];
  const tableData = totals.lineItems.map((item, i) => [
    i + 1,
    item.description || "-",
    item.hsnCode || "-",
    item.quantity,
    formatINR(item.rate),
    item.discount + "%",
    formatINR(item.calc.taxableValue),
    item.gstRate + "%",
    formatINR(item.calc.total),
  ]);

  doc.autoTable({
    startY: y,
    head: [tableHeaders],
    body: tableData,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 42 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 12, halign: "center" },
      6: { cellWidth: 24, halign: "right" },
      7: { cellWidth: 12, halign: "center" },
      8: { cellWidth: 24, halign: "right" },
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ── Tax Breakdown + Totals (right-aligned) ───────────────────
  const totalsX = pageW - margin - 75;
  const totalsW = 75;

  const addTotalRow = (label, value, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 9 : 8);
    doc.text(label, totalsX, y);
    doc.text(formatINR(value), totalsX + totalsW, y, { align: "right" });
    y += 5;
  };

  addTotalRow("Subtotal", totals.totalTaxable);
  totals.taxBreakdown.forEach(t => {
    if (t.rate === 0) return;
    if (totals.isInterState) {
      addTotalRow(`IGST @ ${t.rate}%`, t.igst);
    } else {
      addTotalRow(`CGST @ ${t.rate / 2}%`, t.cgst);
      addTotalRow(`SGST @ ${t.rate / 2}%`, t.sgst);
    }
  });
  if (totals.shippingCharge > 0) addTotalRow("Shipping", totals.shippingCharge);
  if (inv.roundOff && totals.roundOffAmt !== 0) addTotalRow("Round Off", totals.roundOffAmt);

  y += 1;
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.5);
  doc.line(totalsX, y, totalsX + totalsW, y);
  y += 5;
  addTotalRow("TOTAL", totals.roundedTotal, true);

  // ── Amount in Words ──────────────────────────────────────────
  y += 3;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(80, 80, 80);
  doc.text(totals.amountInWords, margin, y);
  y += 8;

  // ── Bank Details ─────────────────────────────────────────────
  if (inv.bankName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...primary);
    doc.text("Bank Details", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(7.5);
    doc.text(`Bank: ${inv.bankName}`, margin, y); y += 3.5;
    if (inv.accountNumber) { doc.text(`A/C No: ${inv.accountNumber}`, margin, y); y += 3.5; }
    if (inv.ifscCode) { doc.text(`IFSC: ${inv.ifscCode}`, margin, y); y += 3.5; }
    if (inv.bankBranch) { doc.text(`Branch: ${inv.bankBranch}`, margin, y); y += 3.5; }
    y += 4;
  }

  // ── Terms & Notes ────────────────────────────────────────────
  if (inv.termsAndConditions) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...primary);
    doc.text("Terms & Conditions", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    const terms = doc.splitTextToSize(inv.termsAndConditions, contentW);
    doc.text(terms, margin, y);
    y += terms.length * 3.5 + 4;
  }

  if (inv.notes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...primary);
    doc.text("Notes", margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    const notes = doc.splitTextToSize(inv.notes, contentW);
    doc.text(notes, margin, y);
  }

  // ── Footer ───────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated invoice.", pageW / 2, 287, { align: "center" });

  doc.save(`${inv.invoiceNumber || "Invoice"}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════
// DOCX EXPORT
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate and download a DOCX invoice
 * @param {Object} inv - Invoice form data
 * @param {Object} totals - Calculated totals
 */
export async function exportDOCX(inv, totals) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const noBorder = { style: BorderStyle.NONE, size: 0 };
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

  // Helper: create a cell
  const cell = (text, opts = {}) => new TableCell({
    borders: opts.noBorder ? noBorders : borders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: opts.bold, size: opts.size || 20, font: "Calibri", color: opts.color })],
    })],
  });

  // Header
  const headerRow = new TableRow({
    children: [
      new TableCell({
        borders: noBorders, columnSpan: 9,
        shading: { fill: "0F172A", type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({ children: [new TextRun({ text: "TAX INVOICE", bold: true, size: 36, font: "Calibri", color: "FFFFFF" })] }),
          new Paragraph({ children: [new TextRun({ text: `Invoice #: ${inv.invoiceNumber}  |  Date: ${inv.invoiceDate}${inv.dueDate ? "  |  Due: " + inv.dueDate : ""}`, size: 18, font: "Calibri", color: "CCCCCC" })] }),
        ],
      }),
    ],
  });

  // Items table header
  const itemHeaders = ["#", "Description", "HSN/SAC", "Qty", "Rate", "Disc%", "Taxable", "GST%", "Amount"];
  const itemHeaderRow = new TableRow({
    children: itemHeaders.map(h => cell(h, { bold: true, shading: "E2E8F0", size: 18, align: AlignmentType.CENTER })),
  });

  // Item rows
  const itemRows = totals.lineItems.map((item, i) => new TableRow({
    children: [
      cell(i + 1, { align: AlignmentType.CENTER }),
      cell(item.description || "-"),
      cell(item.hsnCode || "-", { align: AlignmentType.CENTER }),
      cell(item.quantity, { align: AlignmentType.CENTER }),
      cell(formatINR(item.rate), { align: AlignmentType.RIGHT }),
      cell(item.discount + "%", { align: AlignmentType.CENTER }),
      cell(formatINR(item.calc.taxableValue), { align: AlignmentType.RIGHT }),
      cell(item.gstRate + "%", { align: AlignmentType.CENTER }),
      cell(formatINR(item.calc.total), { align: AlignmentType.RIGHT }),
    ],
  }));

  // Totals rows
  const totalRows = [];
  const addTotal = (label, value) => totalRows.push(new TableRow({
    children: [
      new TableCell({ borders: noBorders, columnSpan: 7, children: [new Paragraph("")] }),
      cell(label, { bold: true, size: 18, align: AlignmentType.RIGHT }),
      cell(formatINR(value), { bold: true, size: 18, align: AlignmentType.RIGHT }),
    ],
  }));

  addTotal("Subtotal", totals.totalTaxable);
  totals.taxBreakdown.forEach(t => {
    if (t.rate === 0) return;
    if (totals.isInterState) addTotal(`IGST @ ${t.rate}%`, t.igst);
    else { addTotal(`CGST @ ${t.rate / 2}%`, t.cgst); addTotal(`SGST @ ${t.rate / 2}%`, t.sgst); }
  });
  addTotal("TOTAL", totals.roundedTotal);

  const children = [];

  // Build document
  const table = new Table({
    width: { size: 9360, type: WidthType.DXA },
    rows: [headerRow, itemHeaderRow, ...itemRows, ...totalRows],
  });
  children.push(table);

  // Amount in words
  children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: totals.amountInWords, italics: true, size: 18, font: "Calibri", color: "666666" })] }));

  // Terms
  if (inv.termsAndConditions) {
    children.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: "Terms & Conditions", bold: true, size: 20, font: "Calibri" })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: inv.termsAndConditions, size: 18, font: "Calibri", color: "444444" })] }));
  }
  if (inv.notes) {
    children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Notes", bold: true, size: 20, font: "Calibri" })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: inv.notes, size: 18, font: "Calibri", color: "444444" })] }));
  }

  const document = new Document({
    sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }],
  });

  const buffer = await Packer.toBlob(document);
  saveAs(buffer, `${inv.invoiceNumber || "Invoice"}.docx`);
}

// ═══════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate and download an Excel workbook with invoice data
 * @param {Object} inv - Invoice form data
 * @param {Object} totals - Calculated totals
 */
export function exportExcel(inv, totals) {
  // Sheet 1: Invoice Data
  const wsData = [
    ["TAX INVOICE"],
    ["Invoice #", inv.invoiceNumber, "", "Date", inv.invoiceDate, "", "Due Date", inv.dueDate || "N/A"],
    [],
    ["SELLER DETAILS"],
    ["Name", inv.sellerName, "", "BUYER DETAILS"],
    ["Address", inv.sellerAddress, "", "Name", inv.buyerName],
    ["GSTIN", inv.sellerGSTIN, "", "Address", inv.buyerAddress],
    ["State", stateName(inv.sellerState), "", "GSTIN", inv.buyerGSTIN],
    ["PAN", inv.sellerPAN || "N/A", "", "State", stateName(inv.buyerState)],
    [],
    ["Place of Supply", `${stateName(inv.placeOfSupply)} (${inv.placeOfSupply})`, "", "Type", totals.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"],
    [],
    ["#", "Description", "HSN/SAC", "Qty", "Unit", "Rate (₹)", "Disc %", "Taxable (₹)", "GST %", "GST Amt (₹)", "Total (₹)"],
  ];

  totals.lineItems.forEach((item, i) => {
    wsData.push([
      i + 1, item.description, item.hsnCode, item.quantity, item.unit,
      item.rate, item.discount, item.calc.taxableValue, item.gstRate,
      item.calc.gstAmt, item.calc.total,
    ]);
  });

  wsData.push([]);
  wsData.push(["", "", "", "", "", "", "", "Subtotal", "", "", totals.totalTaxable]);

  totals.taxBreakdown.forEach(t => {
    if (t.rate === 0) return;
    if (totals.isInterState) {
      wsData.push(["", "", "", "", "", "", "", `IGST @ ${t.rate}%`, "", "", t.igst]);
    } else {
      wsData.push(["", "", "", "", "", "", "", `CGST @ ${t.rate / 2}%`, "", "", t.cgst]);
      wsData.push(["", "", "", "", "", "", "", `SGST @ ${t.rate / 2}%`, "", "", t.sgst]);
    }
  });

  if (totals.shippingCharge > 0) wsData.push(["", "", "", "", "", "", "", "Shipping", "", "", totals.shippingCharge]);
  wsData.push(["", "", "", "", "", "", "", "TOTAL", "", "", totals.roundedTotal]);
  wsData.push([]);
  wsData.push(["Amount in Words:", totals.amountInWords]);

  if (inv.termsAndConditions) { wsData.push([]); wsData.push(["Terms & Conditions:", inv.termsAndConditions]); }
  if (inv.notes) { wsData.push([]); wsData.push(["Notes:", inv.notes]); }

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 30 }, { wch: 12 }, { wch: 6 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  XLSX.writeFile(wb, `${inv.invoiceNumber || "Invoice"}.xlsx`);
}
