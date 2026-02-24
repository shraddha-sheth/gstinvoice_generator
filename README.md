# GST Invoice Generator

Professional GST-compliant invoice generator built with React. Create, preview, and export invoices in PDF, DOCX, and Excel formats.

## Features

- **Full GST Compliance** — GSTIN fields, Place of Supply, HSN/SAC codes, IGST/CGST+SGST auto-detection, reverse charge mechanism
- **5 Invoice Templates** — Classic, Modern, Minimal, Bold, Corporate
- **6 Color Themes** — Midnight Slate, Emerald Forest, Royal Wine, Deep Indigo, Warm Amber, Ocean Teal
- **Multiple Export Formats** — PDF (print-ready), DOCX (editable), Excel (data)
- **Logo Upload** — Add your business logo to invoices
- **Live Preview** — Real-time invoice preview as you type
- **Mobile Responsive** — Full functionality on phones and tablets
- **Auto-Save** — All data persists in localStorage across sessions
- **Tax Breakdown** — Grouped by GST rate with per-item and summary calculations
- **Bank Details** — Add payment info to invoices
- **Terms & Notes** — Customizable footer sections
- **Shipping Address** — Optional separate ship-to address
- **Amount in Words** — Indian English format (Lakhs, Crores)

## Tech Stack

- **React 18** — UI framework (Create React App)
- **jsPDF + jspdf-autotable** — PDF generation
- **docx (docx-js)** — Word document generation
- **SheetJS (xlsx)** — Excel workbook generation
- **file-saver** — Client-side file downloads

## Project Structure

```
├── public/
│   └── index.html          # HTML entry point
├── src/
│   ├── index.js            # React DOM mount
│   ├── App.js              # Main application (form, preview, export tabs)
│   ├── invoiceDefaults.js  # Constants, Indian states, themes, templates
│   ├── invoiceCalc.js      # Pure tax calculation functions
│   ├── invoiceExport.js    # PDF/DOCX/Excel export logic
│   └── styles.css          # Complete stylesheet with design system
├── package.json
└── README.md
```

## Deployment (Vercel)

1. Push to GitHub maintaining the folder structure above
2. Connect repo to Vercel
3. Framework: **Create React App**
4. Build command: `npm run build`
5. Output directory: `build`

No additional configuration needed — the default CRA settings work out of the box.

## Local Development

```bash
npm install
npm start
```

Opens on `http://localhost:3000`.

## GST Calculation Logic

- **Intra-State** (Seller State = Place of Supply) → CGST + SGST, each at half the GST rate
- **Inter-State** (Seller State ≠ Place of Supply) → IGST at full GST rate
- Supported GST rates: 0%, 5%, 12%, 18%, 28%
- Each line item can have a different GST rate
- Discount applied per-item before tax calculation

## License

MIT
