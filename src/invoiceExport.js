/**
 * @file invoiceExport.js
 * @description Export functions for PDF, DOCX, and Excel invoice generation.
 *
 * PDF: jsPDF + jspdf-autotable — fixed column widths summing to content width
 * DOCX: docx-js + file-saver
 * Excel: SheetJS
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";  // explicit named import avoids side-effect bundling issues
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
         AlignmentType, WidthType, BorderStyle, ShadingType } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { formatCurrency } from "./invoiceCalc";
import { INDIAN_STATES } from "./invoiceDefaults";

/** Get state name from GST code */
const sn = (code) => INDIAN_STATES.find(s => s.code === code)?.name || code;

/** Shorthand currency formatter */
const fc = (n, c) => formatCurrency(n, c);

// ═══════════════════════════════════════════════════════════════════
// PDF EXPORT — Fixed alignment with proper column width allocation
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate and download a PDF invoice.
 *
 * Column width strategy: A4 is 210mm. With 14mm margins each side,
 * content width = 182mm. We allocate columns proportionally and let
 * autoTable handle overflow by wrapping description text.
 *
 * @param {Object} inv - Invoice form data
 * @param {Object} totals - Calculated totals
 * @param {Object} theme - { primary, accent, light }
 */
export function exportPDF(inv, totals, theme) {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210, M = 14, CW = W - M * 2;  // 182mm content width
  let y = M;
  const cur = inv.currency || "INR";

  // Color helpers
  const hex = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const pr = hex(theme.primary), ac = hex(theme.accent), lt = hex(theme.light);

  // ── Header Bar ───────────────────────────────────────────────
  doc.setFillColor(...pr);
  doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", M, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`#${inv.invoiceNumber}  |  Date: ${inv.invoiceDate}${inv.dueDate ? "  |  Due: " + inv.dueDate : ""}`, M, 21);
  if (inv.reverseCharge) doc.text("Reverse Charge: Yes", W - M, 14, { align: "right" });
  if (inv.currency !== "INR") doc.text(`Currency: ${inv.currency}`, W - M, 21, { align: "right" });
  y = 38;

  // ── Seller & Buyer Blocks ────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  const halfW = (CW - 6) / 2;

  // Seller box
  doc.setFillColor(...lt);
  doc.roundedRect(M, y, halfW, 34, 2, 2, "F");
  doc.setFontSize(6);
  doc.setTextColor(...ac);
  doc.setFont("helvetica", "bold");
  doc.text("FROM", M + 4, y + 5);
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.text(inv.sellerName || "Your Business", M + 4, y + 10);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const selAddr = doc.splitTextToSize(inv.sellerAddress || "", halfW - 8);
  doc.text(selAddr, M + 4, y + 15);
  let sy = y + 15 + selAddr.length * 3;
  if (inv.sellerGSTIN) { doc.setFont("helvetica", "bold"); doc.text("GSTIN: " + inv.sellerGSTIN, M + 4, sy); sy += 3.5; }
  if (inv.sellerPAN) { doc.setFont("helvetica", "normal"); doc.text("PAN: " + inv.sellerPAN, M + 4, sy); }

  // Buyer box
  const bx = M + halfW + 6;
  doc.setFillColor(...lt);
  doc.roundedRect(bx, y, halfW, 34, 2, 2, "F");
  doc.setFontSize(6);
  doc.setTextColor(...ac);
  doc.setFont("helvetica", "bold");
  doc.text("BILL TO", bx + 4, y + 5);
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.text(inv.buyerName || "Client", bx + 4, y + 10);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  const buyAddr = doc.splitTextToSize(inv.buyerAddress || "", halfW - 8);
  doc.text(buyAddr, bx + 4, y + 15);
  let by = y + 15 + buyAddr.length * 3;
  if (inv.buyerGSTIN) { doc.setFont("helvetica", "bold"); doc.text("GSTIN: " + inv.buyerGSTIN, bx + 4, by); }

  y += 38;

  // Place of Supply line
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(`Place of Supply: ${sn(inv.placeOfSupply)} (${inv.placeOfSupply})  —  ${totals.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}`, M, y);
  y += 5;

  // ── Items Table ──────────────────────────────────────────────
  // Column widths must sum to CW (182mm)
  // #=8, Desc=50, HSN=16, Qty=12, Rate=22, Disc=16, Taxable=22, GST=12, Amt=24 = 182
  const heads = ["#", "Description", "HSN/SAC", "Qty", "Rate", "Disc", "Taxable", "GST%", "Amount"];
  const rows = totals.lineItems.map((item, i) => {
    const dLabel = item.discountType === "flat" ? fc(item.discount, cur) : item.discount + "%";
    return [
      i + 1,
      item.description || "-",
      item.hsnCode || "-",
      `${item.quantity} ${item.unit || ""}`.trim(),
      fc(item.rate, cur),
      dLabel,
      fc(item.calc.taxableValue, cur),
      item.gstRate + "%",
      fc(item.calc.total, cur),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [heads],
    body: rows,
    margin: { left: M, right: M },
    tableWidth: CW,
    styles: {
      fontSize: 7,
      cellPadding: { top: 2.5, right: 2, bottom: 2.5, left: 2 },
      textColor: [50, 50, 50],
      lineColor: [220, 220, 220],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: pr,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 8,  halign: "center" },
      1: { cellWidth: 50 },                     // Description: widest column
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 12, halign: "center" },
      8: { cellWidth: 24, halign: "right" },
    },
  });

  y = doc.lastAutoTable.finalY + 8;

  // ── Totals Section (right-aligned) ───────────────────────────
  const totalsWidth = 78;
  const tx = W - M - totalsWidth;

  const addRow = (label, value, bold) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 8.5 : 7.5);
    doc.setTextColor(bold ? 30 : 90, bold ? 30 : 90, bold ? 30 : 90);
    doc.text(label, tx, y);
    doc.text(fc(value, cur), tx + totalsWidth, y, { align: "right" });
    y += bold ? 5.5 : 4.5;
  };

  addRow("Subtotal", totals.totalTaxable);

  totals.taxBreakdown.forEach(t => {
    if (t.rate === 0) return;
    if (totals.isInterState) {
      addRow(`IGST @ ${t.rate}%`, t.igst);
    } else {
      addRow(`CGST @ ${t.rate / 2}%`, t.cgst);
      addRow(`SGST @ ${t.rate / 2}%`, t.sgst);
    }
  });

  if (totals.shippingCharge > 0) addRow("Shipping", totals.shippingCharge);
  if (inv.roundOff && totals.roundOffAmt !== 0) addRow("Round Off", totals.roundOffAmt);

  // Divider line
  y += 1;
  doc.setDrawColor(...ac);
  doc.setLineWidth(0.5);
  doc.line(tx, y, tx + totalsWidth, y);
  y += 5;

  addRow("TOTAL", totals.roundedTotal, true);

  // ── Amount in Words ──────────────────────────────────────────
  y += 2;
  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(130, 130, 130);
  doc.text(totals.amountInWords, M, y);
  y += 8;

  // ── Bank Details ─────────────────────────────────────────────
  if (inv.bankName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...pr);
    doc.text("Bank Details", M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.text(inv.bankName, M, y); y += 3.5;
    if (inv.accountNumber) { doc.text("A/C: " + inv.accountNumber, M, y); y += 3.5; }
    if (inv.ifscCode) { doc.text("IFSC: " + inv.ifscCode, M, y); y += 3.5; }
    if (inv.bankBranch) { doc.text("Branch: " + inv.bankBranch, M, y); y += 3.5; }
    y += 4;
  }

  // ── Terms & Notes ────────────────────────────────────────────
  if (inv.termsAndConditions) {
    if (y > 260) { doc.addPage(); y = M; }  // page break safety
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...pr);
    doc.text("Terms & Conditions", M, y); y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(100, 100, 100);
    const tLines = doc.splitTextToSize(inv.termsAndConditions, CW);
    doc.text(tLines, M, y); y += tLines.length * 3.2 + 3;
  }

  if (inv.notes) {
    if (y > 265) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(...pr);
    doc.text("Notes", M, y); y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.setTextColor(100, 100, 100);
    const nLines = doc.splitTextToSize(inv.notes, CW);
    doc.text(nLines, M, y);
  }

  // ── Footer ───────────────────────────────────────────────────
  doc.setFontSize(6.5);
  doc.setTextColor(180, 180, 180);
  doc.text("Computer-generated invoice.", W / 2, 287, { align: "center" });

  doc.save(`${inv.invoiceNumber || "Invoice"}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════
// DOCX EXPORT
// ═══════════════════════════════════════════════════════════════════

export async function exportDOCX(inv, totals) {
  const cur = inv.currency || "INR";
  const border = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const nb = { style: BorderStyle.NONE, size: 0 };
  const nbs = { top: nb, bottom: nb, left: nb, right: nb };

  const cell = (text, opts = {}) => new TableCell({
    borders: opts.noBorder ? nbs : borders,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text), bold: opts.bold, size: opts.size || 20, font: "Calibri", color: opts.color })],
    })],
  });

  // Header row
  const hdrRow = new TableRow({
    children: [new TableCell({
      borders: nbs, columnSpan: 9,
      shading: { fill: "3E5068", type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 120, right: 120 },
      children: [
        new Paragraph({ children: [new TextRun({ text: "TAX INVOICE", bold: true, size: 36, font: "Calibri", color: "FFFFFF" })] }),
        new Paragraph({ children: [new TextRun({ text: `#${inv.invoiceNumber}  |  ${inv.invoiceDate}${inv.dueDate ? "  |  Due: " + inv.dueDate : ""}  |  ${inv.currency}`, size: 18, font: "Calibri", color: "B0C4D8" })] }),
      ],
    })],
  });

  // Item column headers
  const itemHdr = new TableRow({
    children: ["#", "Description", "HSN", "Qty", "Rate", "Disc", "Taxable", "GST%", "Amount"].map(h =>
      cell(h, { bold: true, shading: "F0F4F8", size: 18, align: AlignmentType.CENTER })),
  });

  // Item rows
  const itemRows = totals.lineItems.map((item, i) => {
    const dLabel = item.discountType === "flat" ? fc(item.discount, cur) : item.discount + "%";
    return new TableRow({
      children: [
        cell(i + 1, { align: AlignmentType.CENTER }),
        cell(item.description || "-"),
        cell(item.hsnCode || "-", { align: AlignmentType.CENTER }),
        cell(item.quantity, { align: AlignmentType.CENTER }),
        cell(fc(item.rate, cur), { align: AlignmentType.RIGHT }),
        cell(dLabel, { align: AlignmentType.CENTER }),
        cell(fc(item.calc.taxableValue, cur), { align: AlignmentType.RIGHT }),
        cell(item.gstRate + "%", { align: AlignmentType.CENTER }),
        cell(fc(item.calc.total, cur), { align: AlignmentType.RIGHT }),
      ],
    });
  });

  // Totals rows
  const totRows = [];
  const addT = (l, v) => totRows.push(new TableRow({
    children: [
      new TableCell({ borders: nbs, columnSpan: 7, children: [new Paragraph("")] }),
      cell(l, { bold: true, size: 18, align: AlignmentType.RIGHT }),
      cell(fc(v, cur), { bold: true, size: 18, align: AlignmentType.RIGHT }),
    ],
  }));

  addT("Subtotal", totals.totalTaxable);
  totals.taxBreakdown.forEach(t => {
    if (t.rate === 0) return;
    if (totals.isInterState) { addT(`IGST @ ${t.rate}%`, t.igst); }
    else { addT(`CGST @ ${t.rate / 2}%`, t.cgst); addT(`SGST @ ${t.rate / 2}%`, t.sgst); }
  });
  addT("TOTAL", totals.roundedTotal);

  // Build document sections
  const children = [
    new Table({ width: { size: 9360, type: WidthType.DXA }, rows: [hdrRow, itemHdr, ...itemRows, ...totRows] }),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: totals.amountInWords, italics: true, size: 18, font: "Calibri", color: "888888" })] }),
  ];

  if (inv.termsAndConditions) {
    children.push(new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: "Terms & Conditions", bold: true, size: 20, font: "Calibri" })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: inv.termsAndConditions, size: 18, font: "Calibri", color: "666666" })] }));
  }
  if (inv.notes) {
    children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: "Notes", bold: true, size: 20, font: "Calibri" })] }));
    children.push(new Paragraph({ children: [new TextRun({ text: inv.notes, size: 18, font: "Calibri", color: "666666" })] }));
  }

  const document = new Document({
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children,
    }],
  });

  const buffer = await Packer.toBlob(document);
  saveAs(buffer, `${inv.invoiceNumber || "Invoice"}.docx`);
}

// ═══════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════

export function exportExcel(inv, totals) {
  const cur = inv.currency || "INR";
  const d = [
    ["TAX INVOICE", "", "", "", "", "", `Currency: ${cur}`],
    ["Invoice #", inv.invoiceNumber, "", "Date", inv.invoiceDate, "", "Due", inv.dueDate || "N/A"],
    [],
    ["SELLER"],
    ["Name", inv.sellerName, "", "BUYER"],
    ["Address", inv.sellerAddress, "", "Name", inv.buyerName],
    ["GSTIN", inv.sellerGSTIN, "", "Address", inv.buyerAddress],
    ["State", sn(inv.sellerState), "", "GSTIN", inv.buyerGSTIN],
    [],
    ["Place of Supply", sn(inv.placeOfSupply) + " (" + inv.placeOfSupply + ")", "", "Type", totals.isInterState ? "Inter-State" : "Intra-State"],
    [],
    ["#", "Description", "HSN/SAC", "Qty", "Unit", "Rate", "Discount", "Disc Type", "Taxable", "GST%", "GST Amt", "Total"],
  ];

  totals.lineItems.forEach((item, i) => {
    d.push([i + 1, item.description, item.hsnCode, item.quantity, item.unit, item.rate, item.discount, item.discountType, item.calc.taxableValue, item.gstRate, item.calc.gstAmt, item.calc.total]);
  });

  d.push([]);
  d.push(["", "", "", "", "", "", "", "", "Subtotal", "", "", totals.totalTaxable]);

  totals.taxBreakdown.forEach(t => {
    if (t.rate === 0) return;
    if (totals.isInterState) {
      d.push(["", "", "", "", "", "", "", "", `IGST @ ${t.rate}%`, "", "", t.igst]);
    } else {
      d.push(["", "", "", "", "", "", "", "", `CGST @ ${t.rate / 2}%`, "", "", t.cgst]);
      d.push(["", "", "", "", "", "", "", "", `SGST @ ${t.rate / 2}%`, "", "", t.sgst]);
    }
  });

  d.push(["", "", "", "", "", "", "", "", "TOTAL", "", "", totals.roundedTotal]);
  d.push([]);
  d.push(["Amount:", totals.amountInWords]);
  if (inv.termsAndConditions) { d.push([]); d.push(["Terms:", inv.termsAndConditions]); }
  if (inv.notes) { d.push([]); d.push(["Notes:", inv.notes]); }

  const ws = XLSX.utils.aoa_to_sheet(d);
  ws["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 12 }, { wch: 6 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  XLSX.writeFile(wb, `${inv.invoiceNumber || "Invoice"}.xlsx`);
}