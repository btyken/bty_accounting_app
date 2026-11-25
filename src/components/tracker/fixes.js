// Plain-language issues and recommended fixes for a REQUESTS row of the
// requisition tracker. Reads the row by header name so column moves in the
// sheet don't break it.

const num = (v) => {
  const s = String(v ?? '').trim()
  if (!s || s === '-') return 0
  const neg = /^\(.*\)$/.test(s)
  const n = parseFloat(s.replace(/[(),₱\s]/g, ''))
  return isNaN(n) ? 0 : (neg ? -n : n)
}
export const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// "1156 · CASH IN BANK - GCASH (GERARD NEW - 09679263600)" → "GCash GERARD NEW"
export const gcashShort = (label) => {
  const m = /GCASH \(([^)]*?)\s*-\s*\d+\)/i.exec(String(label || ''))
  return m ? `GCash ${m[1]}` : String(label || '')
}

export function rowObj(headers, row) {
  const o = {}
  headers.forEach((h, i) => { if (h) o[h] = row[i] ?? '' })
  return o
}

// Status column → issue + fix
const STATUS_RULES = {
  'For processing': {
    key: 'processing', title: 'Waiting for processing',
    fix: () => 'Accounts Payable: check the request and fill Processed Date and Processing Result (columns K–L).',
  },
  'For sending to bank': {
    key: 'to-send', title: 'Processed, not yet sent to bank',
    groupFix: 'Set up the transfer in RCBC (or issue the check), then tick these requests on the Requests tab and click "Mark sent to bank". Requests paid in one transfer can be marked together.',
    fix: () => 'Set up the transfer in RCBC (or issue the check), then use "Sent to bank" on this request.',
  },
  'Authorization on hold': {
    key: 'auth-hold', title: "On hold with Ma'am Mia",
    fix: () => "Ma'am Mia put this on hold. Follow up with her; once approved in RCBC the bank statement will release it.",
  },
  'For authorization': {
    key: 'authorization', title: 'Waiting for authorization',
    fix: () => 'Older entry: mark it "Sent to bank" so the bank statement can release it.',
  },
  'For release': {
    key: 'release', title: 'Approved, waiting for release',
    fix: () => 'Older entry: mark it "Sent to bank" so the bank statement can release it.',
  },
  'Returned to requester': {
    key: 'returned', title: 'Returned to requester',
    fix: (r) => `${r['Requested By'] || 'The requester'}: correct the request per the Accounts Payable notes and resubmit.`,
  },
  'Released, for liquidation': {
    key: 'for-liquidation', title: 'Released, waiting for liquidation',
    fix: (r) => `${r['Requested By'] || 'The requester'}: submit the official receipts and any change (sukli) before the liquidation due date.`,
  },
  'Overdue for liquidation': {
    key: 'overdue', title: 'Overdue for liquidation',
    groupFix: 'Follow up with each requester for the receipts and change. Once in, record each receipt in RECEIPTS and fill Liquidation Date (column V).',
    fix: (r) => `Follow up with ${r['Requested By'] || 'the requester'} for the receipts and change. Once in, record each receipt in RECEIPTS and fill Liquidation Date (column V).`,
  },
  'Partially liquidated': {
    key: 'partial', title: 'Liquidation incomplete — receipts not recorded',
    groupFix: 'Add each official receipt in RECEIPTS under its Request ID. If part of the money was returned, enter it in Change Returned (column W). For anything paid straight to a supplier (bills, rent), consider setting Request Type to Direct Payment and attaching the bill or OR as the receipt.',
    note: (r) => {
      const payee = String(r['Payee / Supplier'] || '').trim().toUpperCase()
      const by = String(r['Requested By'] || '').trim().toUpperCase()
      const rec = num(r['Receipts Total (net of withholding tax)'])
      let t = rec === 0 ? 'No receipts recorded yet.' : `Receipts so far: ${peso(rec)}.`
      if (payee && by && payee !== by) t += ` Paid to ${r['Payee / Supplier']}, possibly a Direct Payment.`
      return t
    },
    fix: (r) => {
      const open = num(r['Open Balance'])
      const rec = num(r['Receipts Total (net of withholding tax)'])
      let t = rec === 0
        ? `No receipts are recorded yet. Add each official receipt for this request in RECEIPTS (Request ID ${r['Request ID']}).`
        : `Receipts cover ${peso(rec)} so far. Add the remaining receipts in RECEIPTS.`
      t += ` Still to account for: ${peso(open)}. If part of the money was returned, enter it in Change Returned (column W).`
      const payee = String(r['Payee / Supplier'] || '').trim().toUpperCase()
      const by = String(r['Requested By'] || '').trim().toUpperCase()
      if (payee && by && payee !== by) {
        t += ` This was paid to ${r['Payee / Supplier']}, not to ${r['Requested By']}: if it went straight to the supplier (e.g. a bill or rent), consider setting Request Type to Direct Payment and attaching the bill or OR as the receipt.`
      }
      return t
    },
  },
  'Liquidated, pay back employee': {
    key: 'payback', title: 'Employee spent more than the advance',
    fix: (r) => `Pay ${r['Requested By'] || 'the employee'} the excess (${peso(Math.abs(num(r['Open Balance'])))}), then fill Paid Back to Employee and Paid Back Date (columns Y–Z).`,
  },
  'Released, receipts missing': {
    key: 'receipts-missing', title: 'Released, receipt missing',
    fix: (r) => `Add the official receipt for ${r['Request ID']} in RECEIPTS.`,
  },
  'Receipts not equal to released': {
    key: 'receipts-mismatch', title: 'Receipts don’t match the amount released',
    fix: (r) => {
      const rel = num(r['Amount Released']); const rec = num(r['Receipts Total (net of withholding tax)'])
      const gap = rel - rec
      return gap > 0
        ? `Receipts total ${peso(rec)} but ${peso(rel)} was released (${peso(gap)} short). Add the missing receipts in RECEIPTS, or if the release was too high, record the amount returned.`
        : `Receipts total ${peso(rec)}, which is ${peso(-gap)} more than the ${peso(rel)} released. Check for a duplicate receipt, or release the difference to the requester.`
    },
  },
}

// Reconciliation Check parts → issue + fix
const CHECK_RULES = [
  {
    re: /^Released not equal to requested/i, key: 'rel-vs-req', title: 'Released amount differs from requested',
    fix: () => 'Check Amount Released (column S) against Amount Requested less withholding tax. If a partial release was intended, explain it in Accounts Payable Notes.',
  },
  {
    re: /^No reference no/i, key: 'no-ref', title: 'No bank / GCash reference number',
    fix: () => 'Enter the bank Transaction ID (or GCash reference) in column R so the release can be matched to the books and the bank.',
  },
  {
    re: /^Reference not found in disbursement book/i, key: 'ref-not-in-book', title: 'Not recorded in DISBURSEMENT 2026',
    fix: (r) => `Record the release in DISBURSEMENT 2026 using reference ${r['Bank / GCash Reference No.'] || '(column R)'}, or fix a typo in the reference.`,
  },
  {
    re: /^Book amount differs/i, key: 'book-differs', title: 'Book entry amount differs from the release',
    fix: (r) => `Make the DISBURSEMENT 2026 entry for ${r['Bank / GCash Reference No.']} equal the amount released plus the bank charge. If one transfer paid several requests, use the same reference on each so they are checked together.`,
  },
  {
    re: /^Bank shows/i, key: 'bank-differs', title: 'Bank amount differs from the release',
    fix: (r, part) => `${part}. If one transfer paid several requests, give them all the same reference number so they're checked together; otherwise correct Amount Released or the reference.`,
  },
  {
    re: /^Not found in bank statement/i, key: 'not-in-bank', title: 'Not found in the bank statement',
    fix: () => 'Paste the latest RCBC export into BANK IMPORT (GCash: GCASH IMPORT, then apply). For accounts without an imported statement, tick Bank Confirmed Manually (column U) once checked.',
  },
]

const SENT_RULES = {
  'match-found': { key: 'match-found', title: 'In the bank statement: ready to apply',
    groupFix: 'The bank / GCash statement shows these payments. Click "Apply bank / GCash statement" to fill the release from the statement.',
    fix: () => 'The bank / GCash statement shows this payment. Click "Apply bank / GCash statement" to fill the release from it.' },
  'overdue': { key: 'sent-overdue', title: 'Sent, but not in the bank statement yet',
    groupFix: 'The statement already covers enough banking days after these were sent. Check in RCBC whether Ma\'am Mia approved them, or whether the transfer was declined or failed. If declined, use "Not approved in RCBC".',
    fix: (r, w) => `Sent ${w.sent} via ${w.channel}; the statement covers ${w.bankingDaysCovered} banking day(s) after that (up to ${w.coverage}) and it is not there. Check in RCBC whether Ma'am Mia approved it, or whether it failed.` },
  'waiting': { key: 'sent-waiting', title: "Sent, waiting for Ma'am Mia / bank posting",
    groupFix: 'Nothing to do yet. These will release automatically once Ma\'am Mia approves in RCBC and the next statement (Mon/Wed/Fri) is pasted and applied.',
    fix: () => 'Nothing to do yet: it releases once approved in RCBC and the next statement is applied.' },
  'check-not-encashed': { key: 'check-out', title: 'Check issued, not yet encashed',
    groupFix: 'Normal until the payee deposits the check. It releases from the statement when the check clears (matched by check number).',
    fix: (r, w) => `Check no. ${w.checkNo} issued ${w.sent}. It releases when the check clears.` },
  'no-statement': { key: 'no-statement', title: 'No statement yet: GCash / cash',
    groupFix: 'GCash: paste the GCash statement of the wallet used into GCASH IMPORT, then click "Apply bank / GCash statement". Cash: open the request and use "Manual release".',
    fix: (r, w) => w.channel === 'GCash'
      ? 'Paste the GCash statement of the wallet used into GCASH IMPORT, then click "Apply bank / GCash statement".'
      : 'Cash has no statement: use "Manual release" on this request.' },
  'gcash-overdue': { key: 'gcash-overdue', title: 'Sent by GCash, but not in the GCash statement',
    groupFix: 'The GCash statement already covers the days after these were sent and no line fits. Check the payee GCash no. and amount on the request, or paste the statement of the wallet actually used.',
    fix: (r, w) => `Sent ${w.sent} via GCash; the GCash statement covers up to ${w.coverage} and no line fits${r['Payee GCash No.'] ? ` (payee ${r['Payee GCash No.']}, ${r['Amount Requested']})` : ''}. Check the GCash number and amount, or paste the statement of the wallet actually used.` },
  'gcash-waiting': { key: 'gcash-waiting', title: 'Sent by GCash, waiting for the next GCash statement',
    groupFix: 'Nothing to do yet: these release once a GCash statement covering the send date is pasted in GCASH IMPORT and applied.',
    fix: (r, w) => `Sent ${w.sent} via GCash; the GCash statement covers up to ${w.coverage}. Paste a newer one, then apply.` },
}

export function issuesFor(r, bankWaiting) {
  const out = []
  const st = String(r['Status'] || '').trim()
  if (st === 'Sent, waiting for approval/posting') {
    const w = bankWaiting?.[r['Request ID']]
    const rule = SENT_RULES[w?.state || 'waiting']
    out.push({ key: rule.key, title: rule.title, fix: rule.fix(r, w || {}), groupFix: rule.groupFix, owner: w?.state === 'overdue' ? "Accounts Payable / Ma'am Mia" : rule.key === 'sent-waiting' ? "Ma'am Mia (RCBC)" : 'Accounts Payable (Ma\'am Cherry)', info: rule.key === 'sent-waiting' || rule.key === 'check-out' || rule.key === 'gcash-waiting' })
  }
  const rule = STATUS_RULES[st]
  if (rule) out.push({ key: rule.key, title: rule.title, fix: rule.fix(r), groupFix: rule.groupFix, note: rule.note ? rule.note(r) : '', owner: r['Next Action By'] || '' })

  const check = String(r['Reconciliation Check'] || '').trim()
  if (check && check !== 'OK') {
    for (const part of check.split(/;\s*/).filter(Boolean)) {
      const c = CHECK_RULES.find(x => x.re.test(part))
      out.push(c
        ? { key: c.key, title: c.title, fix: c.fix(r, part), owner: 'Accounts Payable (Ma\'am Cherry)' }
        : { key: `other:${part}`, title: part, fix: 'Open the request in the tracker sheet and check the reconciliation columns.', owner: 'Accounts Payable (Ma\'am Cherry)' })
    }
  }
  return out
}

// Group all requests' issues by type for the Overview panel.
export function groupIssues(headers, rows, bankWaiting) {
  const groups = new Map()
  for (const row of rows) {
    const r = rowObj(headers, row)
    for (const is of issuesFor(r, bankWaiting)) {
      if (!groups.has(is.key)) groups.set(is.key, { key: is.key, title: is.title, groupFix: is.groupFix, info: is.info, items: [], total: 0 })
      const g = groups.get(is.key)
      g.items.push({ id: r['Request ID'], row, r, fix: is.fix, note: is.note, owner: is.owner })
      g.total += Math.abs(num(r['Open Balance']))
    }
  }
  const order = ['match-found', 'sent-overdue', 'gcash-overdue', 'rel-vs-req', 'no-ref', 'ref-not-in-book', 'book-differs', 'bank-differs', 'not-in-bank', 'receipts-mismatch', 'payback', 'overdue', 'partial', 'receipts-missing', 'no-statement', 'to-send', 'processing', 'auth-hold', 'returned', 'for-liquidation', 'release', 'authorization', 'sent-waiting', 'gcash-waiting', 'check-out']
  return [...groups.values()].sort((a, b) => {
    const ia = order.indexOf(a.key), ib = order.indexOf(b.key)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
  })
}
