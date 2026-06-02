const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 480" fill="none" width="72" height="82">
  <rect x="60" y="20" width="280" height="280" stroke="#e0e0e0" stroke-width="1" fill="none"/>
  <circle cx="200" cy="160" r="110" stroke="#111" stroke-width="18" fill="none"/>
  <polyline points="90,195 200,80 310,195" stroke="#111" stroke-width="38" stroke-linecap="square" stroke-linejoin="miter" fill="none"/>
  <text x="200" y="380" font-family="Georgia, serif" font-size="36" letter-spacing="6" text-anchor="middle" fill="#111" font-weight="400">SPARTAN</text>
</svg>`

const COMPANY = {
  name:  'SPARTAN BTY INC.',
  addr1: 'FOURTH DISTRICT, TAGUIG CITY, METRO MANILA 1630',
  addr2: 'NATIONAL CAPITAL REGION, PHILIPPINES',
  phone: '+63 46 431-6559',
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtPrintDate(d) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt)) return esc(d)
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
}

function fmtNum(n) {
  const v = parseFloat(n) || 0
  if (v === 0) return '-'
  return v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtTotal(n) {
  const v = parseFloat(n) || 0
  return v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Layout uses 30 virtual columns (LCM of 2,3,5,6) so every section aligns:
//   Header:     Logo=6, Title=14, OrderInfo=10  (30)
//   CompanyInfo: 30
//   BillTo/ShipTo: 15+15  (30)
//   Meta fields: 5×6      (30)
//   Line items: Qty=3, SKU=5, Desc=14, Price=4, Total=4  (30)
//   Footer: 18+12  (30)

export function generateInvoiceHTML(invoice, withPrintBar = false) {
  const items        = invoice.lineItems || []
  const shippingCost = parseFloat(invoice.shippingCost) || 0
  const subtotal     = items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0), 0)
  const grandTotal   = subtotal + shippingCost

  const itemRowsHtml = items.map(item => {
    const qty    = parseFloat(item.qty) || 0
    const rate   = parseFloat(item.rate) || 0
    const amount = qty * rate
    return `<tr>
      <td colspan="3" class="tc">${qty}</td>
      <td colspan="5">${esc(item.skuCode)}</td>
      <td colspan="14">${esc(item.description)}</td>
      <td colspan="4" class="tr">${rate ? fmtNum(rate) : '-'}</td>
      <td colspan="4" class="tr">${amount ? fmtNum(amount) : '-'}</td>
    </tr>`
  }).join('')

  const TOTAL_ROWS  = Math.max(8, items.length + 3)
  const emptyCount  = TOTAL_ROWS - items.length - 1
  const emptyRowsHtml = Array.from({ length: Math.max(0, emptyCount) }, () =>
    `<tr style="height:22px">
      <td colspan="3"></td><td colspan="5"></td><td colspan="14"></td>
      <td colspan="4"></td><td colspan="4"></td>
    </tr>`
  ).join('')

  const billLines = (invoice.billToAddress || '').split('\n').map(esc).join('<br>')
  const shipLines = (invoice.shipToAddress || '').split('\n').map(esc).join('<br>')

  const printBar = withPrintBar ? `
<div class="pbar">
  <button onclick="window.print()" style="background:#111;color:#fff;border:none;padding:7px 18px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit">&#128438; Print / Save as PDF</button>
  <button onclick="window.close()" style="background:#fff;color:#333;border:1px solid #aaa;padding:7px 14px;border-radius:4px;cursor:pointer;font-size:12px;font-family:inherit">&#x2715; Close</button>
</div>` : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Sales Order - ${esc(invoice.number)}</title>
<style>
  @page { size: A4 portrait; margin: 1.3cm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5px; color: #000; background: #fff; padding: 10px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #000; padding: 5px 8px; vertical-align: middle; }
  .tc { text-align: center; }
  .tr { text-align: right; }
  .tl { text-align: left; }
  .vt { vertical-align: top; }
  .bold { font-weight: bold; }
  .pbar { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 12px; background: #f0f0f0; border-bottom: 2px solid #ccc; margin-bottom: 14px; }
  @media print { .pbar { display: none; } body { padding: 0; } }
</style>
</head>
<body>
${printBar}
<table>
  <!-- HEADER: Logo (rowspan=2) | SALES ORDER (rowspan=2) | Order No / Date -->
  <tr>
    <td rowspan="2" colspan="6" class="tc" style="padding:10px">
      ${LOGO_SVG}
    </td>
    <td rowspan="2" colspan="14" class="tc" style="font-size:21px;font-weight:bold;letter-spacing:3px;padding:14px 8px">
      SALES ORDER
    </td>
    <td colspan="10" style="padding:8px 10px">
      <span class="bold">ORDER NO.:</span> ${esc(invoice.number)}
    </td>
  </tr>
  <tr>
    <td colspan="10" style="padding:8px 10px">
      <span class="bold">DATE:</span> ${fmtPrintDate(invoice.date)}
    </td>
  </tr>

  <!-- COMPANY INFO -->
  <tr>
    <td colspan="30" class="tc" style="padding:9px 8px">
      <div style="font-size:15px;font-weight:bold;letter-spacing:1px">${COMPANY.name}</div>
      <div style="margin-top:3px">${COMPANY.addr1}</div>
      <div>${COMPANY.addr2}</div>
      <div>${COMPANY.phone}</div>
    </td>
  </tr>

  <!-- BILL TO / SHIP TO -->
  <tr>
    <td colspan="15" class="vt" style="padding:8px 12px">
      <div class="bold" style="margin-bottom:5px">BILL TO:</div>
      <div>${esc(invoice.customer)}</div>
      ${invoice.billToAddress ? `<div style="margin-top:2px">${billLines}</div>` : ''}
    </td>
    <td colspan="15" class="vt" style="padding:8px 12px">
      <div class="bold" style="margin-bottom:5px">SHIP TO:</div>
      <div>${esc(invoice.shipToName || invoice.customer)}</div>
      ${invoice.shipToAddress ? `<div style="margin-top:2px">${shipLines}</div>` : ''}
    </td>
  </tr>

  <!-- META FIELDS LABELS -->
  <tr>
    <th colspan="5" class="tc">Date</th>
    <th colspan="5" class="tc">Date Needed</th>
    <th colspan="5" class="tc">Ship Via</th>
    <th colspan="5" class="tc">Terms</th>
    <th colspan="5" class="tc">Sales Person</th>
    <th colspan="5" class="tc">Customer No.</th>
  </tr>
  <!-- META FIELDS VALUES -->
  <tr>
    <td colspan="5" class="tc">${esc(invoice.date)}</td>
    <td colspan="5" class="tc">${esc(invoice.dueDate)}</td>
    <td colspan="5" class="tc">${esc(invoice.shipVia)}</td>
    <td colspan="5" class="tc">${esc(invoice.terms)}</td>
    <td colspan="5" class="tc">${esc(invoice.salesPerson)}</td>
    <td colspan="5" class="tc">${esc(invoice.customerNo)}</td>
  </tr>

  <!-- LINE ITEMS HEADER -->
  <tr>
    <th colspan="3" class="tc">Quantity</th>
    <th colspan="5">SKU Code</th>
    <th colspan="14">SKU Description</th>
    <th colspan="4" class="tr">Price</th>
    <th colspan="4" class="tr">Total</th>
  </tr>

  <!-- LINE ITEM ROWS -->
  ${itemRowsHtml}

  <!-- NOTHING FOLLOWS -->
  <tr>
    <td colspan="3"></td>
    <td colspan="5"></td>
    <td colspan="14" class="tc bold">** NOTHING FOLLOWS **</td>
    <td colspan="4"></td>
    <td colspan="4"></td>
  </tr>

  <!-- EMPTY PADDING ROWS -->
  ${emptyRowsHtml}

  <!-- SHIPPING COST -->
  <tr>
    <td colspan="22" class="tr bold">TOTAL SHIPPING COST</td>
    <td colspan="4"></td>
    <td colspan="4" class="tr">${shippingCost > 0 ? fmtTotal(shippingCost) : ''}</td>
  </tr>

  <!-- GRAND TOTAL -->
  <tr>
    <td colspan="22" style="padding:6px 8px"></td>
    <td colspan="4" class="tr bold">Total</td>
    <td colspan="4" class="tr bold">${fmtTotal(grandTotal)}</td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td colspan="18" style="padding:8px 12px">
      <span class="bold">Method of Payment:</span> ${esc(invoice.notes ? invoice.notes.split('\n')[0] : 'BANK REMITTANCE')}
    </td>
    <td colspan="12" style="padding:8px 12px">
      <span class="bold">Received By:</span>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function printInvoice(invoice) {
  const html = generateInvoiceHTML(invoice, true)
  const win  = window.open('', '_blank', 'width=920,height=780,scrollbars=yes,resizable=yes')
  if (!win) {
    alert('Please allow popups to open the print view.')
    return
  }
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.focus()
}
