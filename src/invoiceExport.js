/**
 * @file invoiceExport.js
 * @description Export functions for PDF, DOCX, Excel.
 * Updated to use formatCurrency with dynamic currency code.
 */

import jsPDF from "jspdf";
import "jspdf-autotable";
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, BorderStyle, ShadingType } from "docx";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { formatCurrency } from "./invoiceCalc";
import { INDIAN_STATES } from "./invoiceDefaults";

const stateName = (code) => INDIAN_STATES.find(s => s.code === code)?.name || code;
const fc = (n, c) => formatCurrency(n, c);

// ═══════════════════════════════════════════════════════════════════
// PDF EXPORT
// ═══════════════════════════════════════════════════════════════════
export function exportPDF(inv, totals, theme) {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210, M = 15, CW = W - M * 2;
  let y = M;
  const cur = inv.currency || "INR";

  const hex = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const pr = hex(theme.primary), ac = hex(theme.accent), lt = hex(theme.light);

  // Header
  doc.setFillColor(...pr);
  doc.rect(0, 0, W, 34, "F");
  doc.setTextColor(255,255,255);
  doc.setFontSize(20); doc.setFont("helvetica","bold");
  doc.text("TAX INVOICE", M, 15);
  doc.setFontSize(8.5); doc.setFont("helvetica","normal");
  doc.text(`#${inv.invoiceNumber}  |  Date: ${inv.invoiceDate}${inv.dueDate ? "  |  Due: " + inv.dueDate : ""}`, M, 22);
  if (inv.reverseCharge) doc.text("Reverse Charge: Yes", W - M, 22, { align: "right" });
  if (inv.currency !== "INR") doc.text(`Currency: ${inv.currency}`, W - M, 28, { align: "right" });
  y = 40;

  // Parties
  doc.setTextColor(0,0,0);
  const hw = CW / 2 - 3;

  // Seller
  doc.setFillColor(...lt); doc.roundedRect(M, y, hw, 36, 2, 2, "F");
  doc.setFontSize(6.5); doc.setTextColor(...ac); doc.setFont("helvetica","bold"); doc.text("FROM", M+4, y+5);
  doc.setTextColor(0,0,0); doc.setFontSize(9.5); doc.text(inv.sellerName || "Your Business", M+4, y+11);
  doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text(doc.splitTextToSize(inv.sellerAddress || "", hw-8), M+4, y+16);
  if (inv.sellerGSTIN) { doc.setFont("helvetica","bold"); doc.text("GSTIN: "+inv.sellerGSTIN, M+4, y+27); }
  if (inv.sellerPAN) { doc.setFont("helvetica","normal"); doc.text("PAN: "+inv.sellerPAN, M+4, y+32); }

  // Buyer
  const bx = M + hw + 6;
  doc.setFillColor(...lt); doc.roundedRect(bx, y, hw, 36, 2, 2, "F");
  doc.setFontSize(6.5); doc.setTextColor(...ac); doc.setFont("helvetica","bold"); doc.text("BILL TO", bx+4, y+5);
  doc.setTextColor(0,0,0); doc.setFontSize(9.5); doc.text(inv.buyerName || "Client", bx+4, y+11);
  doc.setFontSize(7); doc.setFont("helvetica","normal");
  doc.text(doc.splitTextToSize(inv.buyerAddress || "", hw-8), bx+4, y+16);
  if (inv.buyerGSTIN) { doc.setFont("helvetica","bold"); doc.text("GSTIN: "+inv.buyerGSTIN, bx+4, y+27); }

  y += 40;
  doc.setFontSize(7.5); doc.setTextColor(120,120,120);
  doc.text(`Place of Supply: ${stateName(inv.placeOfSupply)} (${inv.placeOfSupply})  —  ${totals.isInterState ? "Inter-State (IGST)" : "Intra-State (CGST+SGST)"}`, M, y);
  y += 6;

  // Items Table
  const heads = ["#", "Description", "HSN/SAC", "Qty", "Rate", "Discount", "Taxable", "GST%", "Amount"];
  const rows = totals.lineItems.map((item, i) => {
    const dLabel = item.discountType === "flat" ? fc(item.discount, cur) : item.discount + "%";
    return [i+1, item.description||"-", item.hsnCode||"-", item.quantity, fc(item.rate,cur), dLabel, fc(item.calc.taxableValue,cur), item.gstRate+"%", fc(item.calc.total,cur)];
  });

  doc.autoTable({
    startY: y, head: [heads], body: rows, margin: { left: M, right: M },
    styles: { fontSize: 7.2, cellPadding: 2.5, textColor: [50,50,50] },
    headStyles: { fillColor: pr, textColor: [255,255,255], fontStyle: "bold", fontSize: 6.8 },
    alternateRowStyles: { fillColor: [249,250,251] },
    columnStyles: {
      0:{cellWidth:7,halign:"center"},1:{cellWidth:40},2:{cellWidth:16,halign:"center"},
      3:{cellWidth:10,halign:"center"},4:{cellWidth:22,halign:"right"},5:{cellWidth:16,halign:"center"},
      6:{cellWidth:22,halign:"right"},7:{cellWidth:10,halign:"center"},8:{cellWidth:24,halign:"right"},
    },
  });

  y = doc.lastAutoTable.finalY + 6;
  const tx = W - M - 72, tw = 72;
  const addRow = (l, v, b) => { doc.setFont("helvetica", b?"bold":"normal"); doc.setFontSize(b?8.5:7.5); doc.setTextColor(b?30:80, b?30:80, b?30:80); doc.text(l, tx, y); doc.text(fc(v,cur), tx+tw, y, {align:"right"}); y+=4.5; };

  addRow("Subtotal", totals.totalTaxable);
  totals.taxBreakdown.forEach(t => { if(t.rate===0)return; if(totals.isInterState){addRow(`IGST @ ${t.rate}%`,t.igst);}else{addRow(`CGST @ ${t.rate/2}%`,t.cgst);addRow(`SGST @ ${t.rate/2}%`,t.sgst);} });
  if (totals.shippingCharge > 0) addRow("Shipping", totals.shippingCharge);
  if (inv.roundOff && totals.roundOffAmt !== 0) addRow("Round Off", totals.roundOffAmt);
  y+=1; doc.setDrawColor(...ac); doc.setLineWidth(0.4); doc.line(tx,y,tx+tw,y); y+=5;
  addRow("TOTAL", totals.roundedTotal, true);

  y+=3; doc.setFontSize(7); doc.setFont("helvetica","italic"); doc.setTextColor(130,130,130); doc.text(totals.amountInWords, M, y); y+=7;

  if (inv.bankName) { doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...pr); doc.text("Bank Details",M,y); y+=4; doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80); doc.setFontSize(7); doc.text(`${inv.bankName}`,M,y); y+=3.5; if(inv.accountNumber){doc.text(`A/C: ${inv.accountNumber}`,M,y);y+=3.5;} if(inv.ifscCode){doc.text(`IFSC: ${inv.ifscCode}`,M,y);y+=3.5;} y+=4; }

  if (inv.termsAndConditions) { doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...pr); doc.text("Terms & Conditions",M,y); y+=4; doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(100,100,100); const t=doc.splitTextToSize(inv.termsAndConditions,CW); doc.text(t,M,y); y+=t.length*3.2+3; }
  if (inv.notes) { doc.setFont("helvetica","bold"); doc.setFontSize(7.5); doc.setTextColor(...pr); doc.text("Notes",M,y); y+=4; doc.setFont("helvetica","normal"); doc.setFontSize(6.5); doc.setTextColor(100,100,100); doc.text(doc.splitTextToSize(inv.notes,CW),M,y); }

  doc.setFontSize(6.5); doc.setTextColor(180,180,180); doc.text("Computer-generated invoice.", W/2, 287, {align:"center"});
  doc.save(`${inv.invoiceNumber||"Invoice"}.pdf`);
}

// ═══════════════════════════════════════════════════════════════════
// DOCX EXPORT
// ═══════════════════════════════════════════════════════════════════
export async function exportDOCX(inv, totals) {
  const cur = inv.currency || "INR";
  const border = {style:BorderStyle.SINGLE,size:1,color:"DDDDDD"};
  const borders = {top:border,bottom:border,left:border,right:border};
  const nb = {style:BorderStyle.NONE,size:0};
  const nbs = {top:nb,bottom:nb,left:nb,right:nb};

  const cell = (text, opts={}) => new TableCell({
    borders: opts.noBorder ? nbs : borders,
    width: opts.width ? {size:opts.width,type:WidthType.DXA} : undefined,
    shading: opts.shading ? {fill:opts.shading,type:ShadingType.CLEAR} : undefined,
    margins: {top:60,bottom:60,left:80,right:80},
    children: [new Paragraph({ alignment: opts.align||AlignmentType.LEFT,
      children: [new TextRun({text:String(text),bold:opts.bold,size:opts.size||20,font:"Calibri",color:opts.color})] })],
  });

  const hdrRow = new TableRow({ children: [new TableCell({
    borders:nbs, columnSpan:9, shading:{fill:"3E5C76",type:ShadingType.CLEAR},
    margins:{top:100,bottom:100,left:120,right:120},
    children: [
      new Paragraph({children:[new TextRun({text:"TAX INVOICE",bold:true,size:36,font:"Calibri",color:"FFFFFF"})]}),
      new Paragraph({children:[new TextRun({text:`#${inv.invoiceNumber}  |  ${inv.invoiceDate}${inv.dueDate?"  |  Due: "+inv.dueDate:""}  |  ${inv.currency}`,size:18,font:"Calibri",color:"B0C4D8"})]}),
    ],
  })] });

  const itemHdr = new TableRow({ children: ["#","Description","HSN","Qty","Rate","Disc","Taxable","GST%","Amount"].map(h => cell(h,{bold:true,shading:"F0F4F8",size:18,align:AlignmentType.CENTER})) });

  const itemRows = totals.lineItems.map((item,i) => {
    const dLabel = item.discountType === "flat" ? fc(item.discount,cur) : item.discount+"%";
    return new TableRow({ children: [
      cell(i+1,{align:AlignmentType.CENTER}), cell(item.description||"-"), cell(item.hsnCode||"-",{align:AlignmentType.CENTER}),
      cell(item.quantity,{align:AlignmentType.CENTER}), cell(fc(item.rate,cur),{align:AlignmentType.RIGHT}),
      cell(dLabel,{align:AlignmentType.CENTER}), cell(fc(item.calc.taxableValue,cur),{align:AlignmentType.RIGHT}),
      cell(item.gstRate+"%",{align:AlignmentType.CENTER}), cell(fc(item.calc.total,cur),{align:AlignmentType.RIGHT}),
    ] });
  });

  const totRows = [];
  const addT = (l,v) => totRows.push(new TableRow({ children: [
    new TableCell({borders:nbs,columnSpan:7,children:[new Paragraph("")]}),
    cell(l,{bold:true,size:18,align:AlignmentType.RIGHT}), cell(fc(v,cur),{bold:true,size:18,align:AlignmentType.RIGHT}),
  ] }));
  addT("Subtotal",totals.totalTaxable);
  totals.taxBreakdown.forEach(t=>{if(t.rate===0)return;if(totals.isInterState)addT(`IGST@${t.rate}%`,t.igst);else{addT(`CGST@${t.rate/2}%`,t.cgst);addT(`SGST@${t.rate/2}%`,t.sgst);}});
  addT("TOTAL",totals.roundedTotal);

  const children = [
    new Table({width:{size:9360,type:WidthType.DXA},rows:[hdrRow,itemHdr,...itemRows,...totRows]}),
    new Paragraph({spacing:{before:200},children:[new TextRun({text:totals.amountInWords,italics:true,size:18,font:"Calibri",color:"888888"})]}),
  ];
  if(inv.termsAndConditions){children.push(new Paragraph({spacing:{before:300},children:[new TextRun({text:"Terms & Conditions",bold:true,size:20,font:"Calibri"})]}));children.push(new Paragraph({children:[new TextRun({text:inv.termsAndConditions,size:18,font:"Calibri",color:"666666"})]}));}
  if(inv.notes){children.push(new Paragraph({spacing:{before:200},children:[new TextRun({text:"Notes",bold:true,size:20,font:"Calibri"})]}));children.push(new Paragraph({children:[new TextRun({text:inv.notes,size:18,font:"Calibri",color:"666666"})]}));}

  const document = new Document({sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:720,right:720,bottom:720,left:720}}},children}]});
  const buffer = await Packer.toBlob(document);
  saveAs(buffer, `${inv.invoiceNumber||"Invoice"}.docx`);
}

// ═══════════════════════════════════════════════════════════════════
// EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════════
export function exportExcel(inv, totals) {
  const cur = inv.currency || "INR";
  const d = [
    ["TAX INVOICE", "", "", "", "", "", `Currency: ${cur}`],
    ["Invoice #", inv.invoiceNumber, "", "Date", inv.invoiceDate, "", "Due", inv.dueDate||"N/A"],
    [],
    ["SELLER"], ["Name",inv.sellerName,"","BUYER"], ["Address",inv.sellerAddress,"","Name",inv.buyerName],
    ["GSTIN",inv.sellerGSTIN,"","Address",inv.buyerAddress], ["State",stateName(inv.sellerState),"","GSTIN",inv.buyerGSTIN],
    [],
    ["Place of Supply", stateName(inv.placeOfSupply)+" ("+inv.placeOfSupply+")", "", "Type", totals.isInterState?"Inter-State":"Intra-State"],
    [],
    ["#","Description","HSN/SAC","Qty","Unit","Rate","Discount","Disc Type","Taxable","GST%","GST Amt","Total"],
  ];
  totals.lineItems.forEach((item,i)=>{d.push([i+1,item.description,item.hsnCode,item.quantity,item.unit,item.rate,item.discount,item.discountType,item.calc.taxableValue,item.gstRate,item.calc.gstAmt,item.calc.total]);});
  d.push([]); d.push(["","","","","","","","","Subtotal","","",totals.totalTaxable]);
  totals.taxBreakdown.forEach(t=>{if(t.rate===0)return;if(totals.isInterState){d.push(["","","","","","","","",`IGST@${t.rate}%`,"","",t.igst]);}else{d.push(["","","","","","","","",`CGST@${t.rate/2}%`,"","",t.cgst]);d.push(["","","","","","","","",`SGST@${t.rate/2}%`,"","",t.sgst]);}});
  d.push(["","","","","","","","","TOTAL","","",totals.roundedTotal]);
  d.push([]); d.push(["Amount:",totals.amountInWords]);
  if(inv.termsAndConditions){d.push([]);d.push(["Terms:",inv.termsAndConditions]);}
  if(inv.notes){d.push([]);d.push(["Notes:",inv.notes]);}

  const ws=XLSX.utils.aoa_to_sheet(d);
  ws["!cols"]=[{wch:5},{wch:28},{wch:12},{wch:6},{wch:6},{wch:12},{wch:8},{wch:8},{wch:14},{wch:8},{wch:12},{wch:14}];
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Invoice");
  XLSX.writeFile(wb, `${inv.invoiceNumber||"Invoice"}.xlsx`);
}