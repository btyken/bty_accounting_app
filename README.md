# QuickBooks App

A React + Vite accounting web app with Excel import support.

## Getting Started

```bash
cd "quickbooks-app"
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Features
- **Dashboard** — KPI cards, 6-month income vs expense chart, outstanding invoices
- **Chart of Accounts** — Full double-entry account list (Assets, Liabilities, Equity, Revenue, Expenses)
- **Transactions** — Post balanced journal entries
- **Invoices** — Create, send, and mark invoices paid
- **Expenses** — Record expenses by vendor and category
- **Reports** — Profit & Loss and Balance Sheet

## Excel Import
Each module has an **Import Excel** button. Click it to:
1. Download the template for that record type
2. Fill it in with your data
3. Drop or browse for the file
4. Preview and choose Append or Replace
5. Click Import

### Supported file types
`.xlsx`, `.xls`, `.csv`

## Build for production
```bash
npm run build
npm run preview
```
