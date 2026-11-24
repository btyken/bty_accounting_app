/**
 * BTY Accounting App ↔ "ACCOUNTING – Requisition, Release & Reconciliation 2026"
 *
 * The sheet is the database. The app reads it (doGet) and writes requisition
 * entries into it (doPost). Writes only ever touch the typing columns:
 *   REQUESTS B–Z and AJ–AL (never A or the formula columns AA–AI)
 *   RECEIPTS A–S (never the tax-breakdown formula columns T+)
 * Release is proven by the bank statement: requests marked "sent to bank"
 * (AJ–AL) are matched to BANK RECON lines and release + authorization are
 * filled from the bank (Ma'am Mia approves inside RCBC).
 * Every write is recorded in the APP LOG tab (created on first use).
 *
 * Install / update: Extensions > Apps Script, paste this file, keep TRACKER_KEY
 * equal to the TRACKER_KEY env var on Vercel, then
 * Deploy > Manage deployments > (pencil) > Version: New version > Deploy.
 */

const TRACKER_KEY = 'PASTE_THE_KEY_HERE'

const REQ_FIRST_ROW = 5
const REQ_MAX_ROW = 2000
const RCPT_FIRST_ROW = 5

// Field name → REQUESTS column (1-based). Grouped by the step that may write it.
const REQ_FIELDS = {
  request: {
    dateRequested: 2, requestedBy: 3, department: 4, requestType: 5, payee: 6,
    purpose: 7, account: 8, amountRequested: 9, dateNeeded: 10,
  },
  process: { processedDate: 11, processingResult: 12, apNotes: 13 },
  release: {
    releaseDate: 16, releasedFrom: 17, referenceNo: 18, amountReleased: 19,
    bankCharges: 20, bankConfirmedManually: 21,
  },
  liquidate: {
    liquidationDate: 22, changeReturned: 23, changeReturnedTo: 24,
    paidBackToEmployee: 25, paidBackDate: 26,
  },
  sent: { sentDate: 36, channel: 37, checkNo: 38 },
  authorization: { authorization: 14, authorizationDate: 15 },
}
const REQ_WIDTH = 38
const CHANNELS = ['InstaPay', 'PesoNET', 'Check', 'GCash', 'Cash', 'Other']

const RCPT_FIELDS = {
  requestId: 1, receiptDate: 2, orNo: 3, supplier: 4, tin: 5, supplierCategory: 6,
  account: 7, amount: 8, vatRegistered: 9, nonVatPortion: 10, exempt: 11, discount: 12,
  discountBasis: 13, otherCharges: 14, vatableAsPrinted: 15, vatAsPrinted: 16,
  receiptType: 17, whtRate: 18, particulars: 19,
}

const DATE_FIELDS = ['dateRequested', 'dateNeeded', 'processedDate', 'releaseDate', 'liquidationDate', 'paidBackDate', 'receiptDate', 'sentDate', 'authorizationDate']
const NUMBER_FIELDS = ['amountRequested', 'amountReleased', 'bankCharges', 'changeReturned', 'paidBackToEmployee',
  'amount', 'nonVatPortion', 'exempt', 'discount', 'otherCharges', 'vatableAsPrinted', 'vatAsPrinted']
const BOOL_FIELDS = ['bankConfirmedManually', 'vatRegistered']

// Strict dropdowns: value must be in the SETTINGS list (blank allowed).
const LIST_CHECKS = {
  department: 'departments', requestType: 'requestTypes', account: 'accounts',
  processingResult: 'processingResults', releasedFrom: 'cashAccounts', changeReturnedTo: 'cashAccounts',
  discountBasis: 'discountBases', receiptType: 'receiptTypes', supplierCategory: 'supplierCategories',
  whtRate: 'whtRates', channel: 'channels', authorization: 'authorization',
}

/* ─────────────────────────── READ ─────────────────────────── */

function doGet(e) {
  const key = e && e.parameter && e.parameter.key
  if (!key || key !== TRACKER_KEY) return json_({ error: 'unauthorized' })

  const cache = CacheService.getScriptCache()
  const cached = cache.get('tracker')
  if (cached && !(e.parameter.fresh === '1')) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON)

  const text = JSON.stringify(snapshot_())
  try { cache.put('tracker', text, 60) } catch (err) { /* over 100 KB: skip cache */ }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON)
}

function snapshot_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  return {
    generatedAt: new Date().toISOString(),
    sheetUrl: ss.getUrl(),
    canWrite: true,
    position: currentPosition_(ss),
    lists: lists_(ss),
    requests: table_(ss, 'REQUESTS', 4, 1, REQ_WIDTH),
    bank: bankStatus_(ss),
    receipts: table_(ss, 'RECEIPTS', 4, 1, 36),
    unliquidated: Object.assign(
      { summary: summary_(ss, 'UNLIQUIDATED') },
      table_(ss, 'UNLIQUIDATED', 4, 1, 12),
      { book: table_(ss, 'UNLIQUIDATED', 4, 14, 20) }
    ),
    reconciliation: Object.assign({ summary: summary_(ss, 'RECONCILIATION') }, table_(ss, 'RECONCILIATION', 4, 1, 15)),
    bankRecon: Object.assign(
      { summary: summary_(ss, 'BANK RECON') },
      table_(ss, 'BANK RECON', 4, 1, 15),
      { missingFromBank: table_(ss, 'BANK RECON', 4, 21, 27) }
    ),
  }
}

// Header row + every following row until column `firstCol` goes blank.
function table_(ss, name, headerRow, firstCol, lastCol) {
  const sh = ss.getSheetByName(name)
  if (!sh) return { headers: [], rows: [] }
  const width = lastCol - firstCol + 1
  const last = sh.getLastRow()
  const headers = sh.getRange(headerRow, firstCol, 1, width).getDisplayValues()[0]
  if (last <= headerRow) return { headers, rows: [] }
  const values = sh.getRange(headerRow + 1, firstCol, last - headerRow, width).getDisplayValues()
  const rows = []
  for (const r of values) {
    if (String(r[0]).trim() === '') break
    rows.push(r)
  }
  return { headers, rows }
}

// Row 3 of a tab holds label / value pairs (e.g. "Open advances", "15", ...).
function summary_(ss, name) {
  const sh = ss.getSheetByName(name)
  if (!sh) return []
  const r = sh.getRange(3, 1, 1, sh.getLastColumn()).getDisplayValues()[0]
  const pairs = []
  for (let i = 0; i < r.length - 1; i++) {
    if (r[i] !== '' && r[i + 1] !== '' && isNaN(Number(String(r[i]).replace(/[,()-]/g, '') || 'x'))) {
      pairs.push({ label: r[i], value: r[i + 1] })
      i++
    }
  }
  return pairs
}

// DASHBOARD: the "CURRENT POSITION (as of today)" block in columns B:D.
function currentPosition_(ss) {
  const sh = ss.getSheetByName('DASHBOARD')
  if (!sh) return []
  const v = sh.getRange(1, 2, Math.min(sh.getLastRow(), 120), 3).getDisplayValues()
  const start = v.findIndex(r => String(r[0]).indexOf('CURRENT POSITION') === 0)
  if (start < 0) return []
  const out = []
  for (let i = start + 2; i < v.length; i++) {
    if (String(v[i][0]).trim() === '') break
    out.push({ measure: String(v[i][0]).trim(), count: v[i][1], amount: v[i][2] })
  }
  return out
}

// Dropdown lists, read from the same ranges the sheet's data validation uses.
function lists_(ss) {
  const st = ss.getSheetByName('SETTINGS')
  const col = (a1) => st.getRange(a1).getDisplayValues().map(r => String(r[0]).trim()).filter(Boolean)
  const vendors = []
  const vs = ss.getSheetByName('VENDORS')
  if (vs) {
    const v = vs.getRange('A5:G300').getDisplayValues()
    for (const r of v) {
      const name = String(r[0]).trim()
      if (name) vendors.push({ name: name, tin: r[2], vat: r[4], wht: r[6] })
    }
  }
  return {
    requestTypes: col('A2:A4'),
    departments: col('B2:B40'),
    processingResults: col('C2:C4'),
    authorization: col('D2:D4'),
    discountBases: col('E2:E4'),
    receiptTypes: col('F2:F3'),
    supplierCategories: col('G2:G4'),
    accounts: col('H2:H400'),
    cashAccounts: col('I2:I60'),
    whtRates: col('K10:K15'),
    channels: CHANNELS,
    vendors: vendors,
  }
}

/* ─────────────────────────── WRITE ─────────────────────────── */

function doPost(e) {
  let body
  try { body = JSON.parse(e.postData.contents) } catch (err) { return json_({ error: 'bad_request' }) }
  if (!body || body.key !== TRACKER_KEY) return json_({ error: 'unauthorized' })

  const lock = LockService.getScriptLock()
  if (!lock.tryLock(20000)) return json_({ error: 'busy', message: 'The sheet is busy. Try again in a few seconds.' })
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet()
    const lists = lists_(ss)
    const data = body.data || {}
    let result
    switch (body.action) {
      case 'addRequest':    result = addRequest_(ss, lists, data); break
      case 'updateRequest': result = updateRequest_(ss, lists, body.step, data); break
      case 'addReceipt':    result = addReceipt_(ss, lists, data); break
      case 'markSent':      result = markSent_(ss, lists, data); break
      case 'markNotApproved': result = markNotApproved_(ss, lists, data); break
      case 'proposeMatches': return json_(Object.assign({ ok: true }, proposeMatches_(ss)))
      case 'applyMatches':  result = applyMatches_(ss, lists, data); break
      default: return json_({ error: 'unknown_action' })
    }
    SpreadsheetApp.flush()
    try {
      log_(ss, body.user || '(unknown)', body.action + (body.step ? ':' + body.step : ''), result.requestId, result.sheet + '!' + result.row, data)
    } catch (logErr) { /* the entry is saved; never report it as failed because of the log */ }
    CacheService.getScriptCache().remove('tracker')
    return json_({ ok: true, requestId: result.requestId, row: result.row, applied: result.applied })
  } catch (err) {
    return json_({ error: 'invalid', message: String(err && err.message || err) })
  } finally {
    lock.releaseLock()
  }
}

function addRequest_(ss, lists, data) {
  const sh = ss.getSheetByName('REQUESTS')
  ;['dateRequested', 'requestedBy', 'department', 'requestType', 'purpose', 'account', 'amountRequested'].forEach(f => {
    if (data[f] === undefined || data[f] === null || String(data[f]).trim() === '') throw new Error('Missing ' + f)
  })
  // First empty row by Date Requested (column B). Other columns, e.g. the U tick box, are pre-filled.
  const b = sh.getRange(REQ_FIRST_ROW, 2, REQ_MAX_ROW - REQ_FIRST_ROW + 1, 1).getValues()
  let idx = -1
  for (let i = 0; i < b.length; i++) { if (b[i][0] === '' || b[i][0] === null) { idx = i; break } }
  if (idx < 0) throw new Error('REQUESTS is full (row ' + REQ_MAX_ROW + ')')
  const row = REQ_FIRST_ROW + idx
  writeFields_(sh, row, REQ_FIELDS.request, data, lists)
  return { sheet: 'REQUESTS', row: row, requestId: 'RQ-' + ('00000' + (row - 4)).slice(-5) }
}

function updateRequest_(ss, lists, step, data) {
  const map = REQ_FIELDS[step]
  if (!map || step === 'sent' || step === 'authorization') throw new Error('Unknown step ' + step)
  const sh = ss.getSheetByName('REQUESTS')
  const row = findRequestRow_(sh, data.requestId)
  if (step === 'release') {
    const auth = String(sh.getRange(row, 14).getDisplayValue()).trim()
    if (auth === 'Rejected') throw new Error(data.requestId + ' is marked Rejected. Clear that first if it was approved after all.')
  }
  writeFields_(sh, row, map, data, lists)
  // Manual release (GCash / cash / corrections): the release itself is the approval.
  if (step === 'release' && data.releaseDate) {
    const auth = String(sh.getRange(row, 14).getDisplayValue()).trim()
    if (!auth || auth === 'On hold') {
      sh.getRange(row, 14).setValue('Approved')
      sh.getRange(row, 15).setValue(toDate_(data.releaseDate, 'releaseDate'))
    }
  }
  return { sheet: 'REQUESTS', row: row, requestId: data.requestId }
}

function markSent_(ss, lists, data) {
  const ids = Array.isArray(data.requestIds) ? data.requestIds : []
  if (ids.length === 0) throw new Error('Pick at least one request')
  if (data.sentDate && !data.channel) throw new Error('Pick the channel (InstaPay, PesoNET, Check…)')
  if (data.channel === 'Check' && !String(data.checkNo || '').trim()) throw new Error('Enter the check number')
  const sh = ss.getSheetByName('REQUESTS')
  const rows = ids.map(id => {
    const row = findRequestRow_(sh, id)
    const r = sh.getRange(row, 1, 1, REQ_WIDTH).getDisplayValues()[0]
    if (r[15]) throw new Error(id + ' is already released (' + r[15] + ')')
    if (r[13] === 'Rejected') throw new Error(id + ' is Rejected')
    if (data.sentDate && r[11] !== 'Processed') throw new Error(id + ' is not processed yet')
    return row
  })
  const vals = { sentDate: data.sentDate || '', channel: data.sentDate ? data.channel : '', checkNo: data.sentDate && data.channel === 'Check' ? String(data.checkNo).trim() : '' }
  rows.forEach(row => writeFields_(sh, row, REQ_FIELDS.sent, vals, lists))
  return { sheet: 'REQUESTS', row: rows.join(','), requestId: ids.join(', ') }
}

function markNotApproved_(ss, lists, data) {
  const sh = ss.getSheetByName('REQUESTS')
  const row = findRequestRow_(sh, data.requestId)
  if (sh.getRange(row, 16).getDisplayValue()) throw new Error(data.requestId + ' is already released')
  const status = data.status === 'On hold' ? 'On hold' : 'Rejected'
  writeFields_(sh, row, REQ_FIELDS.authorization, { authorization: status, authorizationDate: data.date || '' }, lists)
  if (data.note) {
    const cur = String(sh.getRange(row, 13).getDisplayValue())
    sh.getRange(row, 13).setValue((cur ? cur + ' | ' : '') + data.note)
  }
  return { sheet: 'REQUESTS', row: row, requestId: data.requestId }
}

function addReceipt_(ss, lists, data) {
  const req = ss.getSheetByName('REQUESTS')
  findRequestRow_(req, data.requestId) // must exist
  ;['receiptDate', 'supplier', 'account', 'amount'].forEach(f => {
    if (data[f] === undefined || data[f] === null || String(data[f]).trim() === '') throw new Error('Missing ' + f)
  })
  const sh = ss.getSheetByName('RECEIPTS')
  const max = sh.getMaxRows()
  const a = sh.getRange(RCPT_FIRST_ROW, 1, max - RCPT_FIRST_ROW + 1, 1).getValues()
  let idx = -1
  for (let i = 0; i < a.length; i++) { if (a[i][0] === '' || a[i][0] === null) { idx = i; break } }
  if (idx < 0) throw new Error('RECEIPTS is full')
  const row = RCPT_FIRST_ROW + idx
  writeFields_(sh, row, RCPT_FIELDS, data, lists)
  return { sheet: 'RECEIPTS', row: row, requestId: data.requestId }
}

function findRequestRow_(sh, requestId) {
  const m = /^RQ-(\d{5})$/.exec(String(requestId || '').trim())
  if (!m) throw new Error('Bad Request ID ' + requestId)
  const row = parseInt(m[1], 10) + 4
  if (row < REQ_FIRST_ROW || row > REQ_MAX_ROW) throw new Error('Request ID out of range')
  const id = String(sh.getRange(row, 1).getDisplayValue()).trim()
  if (id !== requestId) throw new Error(requestId + ' not found')
  return row
}

// Writes only the fields present in `data`; "" clears a cell.
// Every value is converted and checked first; nothing is written unless all pass.
function writeFields_(sh, row, map, data, lists) {
  const writes = []
  Object.keys(map).forEach(f => {
    if (!(f in data)) return
    let v = data[f]
    if (v === null || v === undefined) v = ''
    if (DATE_FIELDS.indexOf(f) >= 0) v = toDate_(v, f)
    else if (NUMBER_FIELDS.indexOf(f) >= 0) v = toNumber_(v, f)
    else if (BOOL_FIELDS.indexOf(f) >= 0) v = v === true || v === 'true' || v === 'TRUE'
    else v = String(v).trim()
    const listName = LIST_CHECKS[f]
    if (listName && v !== '' && lists[listName].indexOf(v) < 0) throw new Error('"' + v + '" is not a valid ' + f)
    writes.push([map[f], v])
  })
  writes.forEach(w => sh.getRange(row, w[0]).setValue(w[1]))
}

function toDate_(v, f) {
  if (v === '') return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v))
  if (!m) throw new Error('Bad date for ' + f + ': ' + v)
  return new Date(+m[1], +m[2] - 1, +m[3])
}

function toNumber_(v, f) {
  if (v === '') return ''
  const n = Number(String(v).replace(/,/g, ''))
  if (!isFinite(n)) throw new Error('Bad amount for ' + f + ': ' + v)
  return Math.round(n * 100) / 100
}

function log_(ss, user, action, requestId, where, data) {
  let sh = ss.getSheetByName('APP LOG')
  if (!sh) {
    sh = ss.insertSheet('APP LOG')
    sh.appendRow(['Timestamp', 'User (app login)', 'Action', 'Request ID', 'Cell row', 'Values written'])
    sh.setFrozenRows(1)
    sh.getRange(1, 1, 1, 6).setFontWeight('bold')
  }
  sh.appendRow([new Date(), user, action, requestId || '', where, JSON.stringify(data)])
}


/* ───────────────────── BANK STATEMENT MATCHING ───────────────────── */

const LAG_BANKING_DAYS = { InstaPay: 1, PesoNET: 2, Other: 2 } // checks: never "overdue"

function asDate_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return isNaN(v) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate())
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || ''))
  return m ? new Date(+m[3], +m[1] - 1, +m[2]) : null
}
function asNum_(v) {
  if (typeof v === 'number') return v
  const t = String(v || '').replace(/[,\s]/g, '')
  if (!t || t === '-') return 0
  const neg = /^\(.*\)$/.test(t)
  const n = parseFloat(t.replace(/[()]/g, ''))
  return isNaN(n) ? 0 : (neg ? -n : n)
}
function iso_(d) { return d ? d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2) : '' }
function cents_(n) { return Math.round(n * 100) }
function bankingDaysAfter_(from, to) { // weekdays strictly after `from`, up to and including `to`
  if (!from || !to || to <= from) return 0
  let n = 0
  const d = new Date(from.getTime())
  while (true) { d.setDate(d.getDate() + 1); if (d > to) break; const w = d.getDay(); if (w !== 0 && w !== 6) n++ }
  return n
}
function digits_(s) { return String(s || '').replace(/\D/g, '').replace(/^0+/, '') }

// Bank lines from BANK RECON (already de-duplicated and grouped by the sheet).
function bankPayments_(ss) {
  const sh = ss.getSheetByName('BANK RECON')
  if (!sh || sh.getLastRow() < 5) return { payments: [], coverage: {} }
  const v = sh.getRange(5, 1, sh.getLastRow() - 4, 15).getValues()
  const groups = {}
  const coverage = {}
  v.forEach((r, i) => {
    const account = String(r[0] || '').trim()
    const posted = asDate_(r[1])
    if (!account || !posted) return
    if (!coverage[account] || posted > coverage[account]) coverage[account] = posted
    const debit = asNum_(r[3])
    if (!(debit > 0)) return
    const desc = String(r[2] || '').toUpperCase()
    const line = { account: account, posted: posted, desc: desc, debit: debit, checkNo: String(r[6] || '').trim(),
      txnId: String(r[7] || '').trim(), payOrder: String(r[8] || '').trim(), group: String(r[10] || r[7] || '').trim(), row: i + 5 }
    if (/INWARD CLEARING/.test(desc)) {        // each check stands alone
      const key = 'CHK:' + account + ':' + (line.checkNo || line.txnId)
      groups[key] = { key: key, type: 'Check', lines: [line] }
      return
    }
    const key = account + ':' + line.group
    if (!groups[key]) groups[key] = { key: key, lines: [] }
    groups[key].lines.push(line)
  })
  const payments = []
  Object.keys(groups).forEach(k => {
    const g = groups[k]
    const isFee = (l) => /CHARGE/.test(l.desc) || (l.debit <= 25 && g.lines.some(o => o !== l && o.debit > 25))
    const principal = g.lines.filter(l => !isFee(l))
    const fees = g.lines.filter(isFee)
    if (principal.length === 0) return
    principal.sort((a, b) => a.posted - b.posted || b.debit - a.debit)
    const p0 = principal[0]
    let type = g.type
    if (!type) type = /INSTAPAY/.test(p0.desc) ? 'InstaPay' : (/EPCSP-OUT/.test(p0.payOrder + ' ' + p0.group) ? 'PesoNET' : 'Other')
    let initiated = null
    if (type === 'InstaPay') {
      const m = /^(\d{2})(\d{2})(20\d{2})/.exec(p0.group)
      if (m) initiated = new Date(+m[3], +m[1] - 1, +m[2])
    }
    payments.push({
      key: g.key, type: type, account: p0.account, posted: p0.posted, initiated: initiated,
      amount: principal.reduce((s, l) => s + l.debit, 0), fee: fees.reduce((s, l) => s + l.debit, 0),
      feePosted: fees.length ? fees.map(f => f.posted).sort((a, b) => b - a)[0] : null,
      txnId: p0.txnId, checkNo: p0.checkNo, txnIds: principal.map(l => l.txnId), desc: p0.desc,
    })
  })
  return { payments: payments, coverage: coverage }
}

function requestRows_(ss) {
  const sh = ss.getSheetByName('REQUESTS')
  const last = Math.min(sh.getLastRow(), REQ_MAX_ROW)
  if (last < REQ_FIRST_ROW) return []
  const v = sh.getRange(REQ_FIRST_ROW, 1, last - REQ_FIRST_ROW + 1, REQ_WIDTH).getValues()
  const out = []
  v.forEach((r, i) => {
    const id = String(r[0] || '').trim()
    if (!id) return
    out.push({
      id: id, row: REQ_FIRST_ROW + i, requestedBy: r[2], type: r[4], payee: String(r[5] || '').trim().toUpperCase(), purpose: r[6],
      amount: asNum_(r[8]), processing: r[11], auth: String(r[13] || '').trim(), released: asDate_(r[15]), ref: String(r[17] || '').trim(),
      fee: r[19], wht: asNum_(r[34]), sent: asDate_(r[35]), channel: String(r[36] || '').trim(), checkNo: String(r[37] || '').trim(),
    })
  })
  return out
}

function expected_(q) { return q.type !== 'Cash Advance' && q.wht > 0 ? q.amount - q.wht : q.amount }

function proposeMatches_(ss) {
  const bank = bankPayments_(ss)
  const reqs = requestRows_(ss)
  const usedTxn = {}
  reqs.forEach(q => { if (q.ref) usedTxn[q.ref] = q.id })
  const open = bank.payments.filter(p => !p.txnIds.some(t => usedTxn[t]))
  const pending = reqs.filter(q => q.sent && !q.released && !q.ref && q.auth !== 'Rejected' && ['GCash', 'Cash'].indexOf(q.channel) < 0)
  const proposals = []
  const taken = {}

  const typeOk = (q, p) => q.channel === 'Other' || !q.channel || q.channel === p.type
  const fits = (q, p, amount) => typeOk(q, p) && Math.abs(cents_(p.amount) - cents_(amount)) === 0 && p.posted >= q.sent

  const strength = (qs, p) => {
    const q = qs[0]
    if (p.type === 'Check') return digits_(q.checkNo) && digits_(q.checkNo) === digits_(p.checkNo) ? 'exact' : 'possible'
    if (p.type === 'InstaPay' && p.initiated) return p.initiated.getTime() === q.sent.getTime() ? 'exact' : 'possible'
    // PesoNET / other: exact amount, posted within 10 days of sending
    return (p.posted - q.sent) / 86400000 <= 10 ? 'exact' : 'possible'
  }

  // 1) Checks by check number (amount must match too)
  pending.filter(q => q.channel === 'Check').forEach(q => {
    const p = open.find(p => p.type === 'Check' && digits_(p.checkNo) && digits_(p.checkNo) === digits_(q.checkNo))
    if (!p) return
    if (Math.abs(cents_(p.amount) - cents_(expected_(q))) !== 0) {
      proposals.push(build_([q], p, 'review', 'Check ' + q.checkNo + ' cleared for ' + p.amount.toFixed(2) + ', request expects ' + expected_(q).toFixed(2)))
    } else proposals.push(build_([q], p, 'exact', 'Check no. ' + q.checkNo))
    taken[p.key] = true; q._done = true
  })

  // 2) Single requests
  pending.filter(q => !q._done).forEach(q => {
    const cands = open.filter(p => !taken[p.key] && fits(q, p, expected_(q)))
    if (cands.length === 0) return
    const ranked = cands.map(p => ({ p: p, s: strength([q], p) })).sort((a, b) => (a.s === 'exact' ? 0 : 1) - (b.s === 'exact' ? 0 : 1) || a.p.posted - b.p.posted)
    const exacts = ranked.filter(x => x.s === 'exact')
    const pick = ranked[0]
    const conf = exacts.length === 1 ? 'exact' : 'choose'
    proposals.push(build_([q], pick.p, conf, conf === 'exact' ? reason_(pick.p) : cands.length + ' bank lines have this amount: pick the right one', ranked.slice(1).map(x => alt_(x.p))))
    if (conf === 'exact') taken[pick.p.key] = true
    q._done = true
  })

  // 3) Batches: requests sent the same day through the same channel (same payee first, then all)
  const rest = pending.filter(q => !q._done)
  const tryBatch = (qs, label) => {
    if (qs.length < 2) return false
    const total = qs.reduce((s, q) => s + expected_(q), 0)
    const cands = open.filter(p => !taken[p.key] && fits(qs[0], p, total))
    if (cands.length === 0) return false
    const exact = cands.filter(p => strength(qs, p) === 'exact')
    const pick = (exact[0] || cands[0])
    const conf = exact.length === 1 ? 'exact' : 'choose'
    proposals.push(build_(qs, pick, conf, 'Batch: ' + qs.length + ' requests ' + label + ' = ' + total.toFixed(2) + ' in one transfer. ' + reason_(pick), cands.filter(p => p !== pick).map(alt_)))
    if (conf === 'exact') taken[pick.key] = true
    qs.forEach(q => { q._done = true })
    return true
  }
  const byDay = {}
  rest.forEach(q => { const k = iso_(q.sent) + '|' + q.channel; (byDay[k] = byDay[k] || []).push(q) })
  Object.keys(byDay).forEach(k => {
    const day = byDay[k]
    const byPayee = {}
    day.forEach(q => { (byPayee[q.payee] = byPayee[q.payee] || []).push(q) })
    Object.keys(byPayee).forEach(py => tryBatch(byPayee[py], 'to ' + (py || 'the same payee')))
    tryBatch(day.filter(q => !q._done), 'sent ' + k.split('|')[0])
  })

  // 4) Bank fees that posted later (PesoNET) for requests already released from the statement
  const byTxn = {}
  bank.payments.forEach(p => p.txnIds.forEach(t => { byTxn[t] = p }))
  const feeGroups = {}
  reqs.filter(q => q.released && q.ref && (q.fee === '' || q.fee === null) && byTxn[q.ref] && byTxn[q.ref].fee > 0)
    .forEach(q => { (feeGroups[q.ref] = feeGroups[q.ref] || []).push(q) })
  Object.keys(feeGroups).forEach(t => {
    const p = byTxn[t]; const qs = feeGroups[t]
    proposals.push({ id: 'fee:' + t, kind: 'fee', confidence: 'exact', requestIds: qs.map(q => q.id), reason: 'Bank charge ' + p.fee.toFixed(2) + ' posted ' + iso_(p.feePosted),
      bank: summary_p_(p), writes: splitFees_(qs, p.fee).map((f, i) => ({ requestId: qs[i].id, values: { bankCharges: f } })) })
  })

  // Waiting / overdue (for the app)
  return { proposals: proposals, waiting: waiting_(reqs, bank, proposals) }
}

function summary_p_(p) {
  return { key: p.key, type: p.type, account: p.account, posted: iso_(p.posted), initiated: iso_(p.initiated), amount: Math.round(p.amount * 100) / 100,
    fee: Math.round(p.fee * 100) / 100, txnId: p.txnId, checkNo: p.checkNo, desc: p.desc }
}
function alt_(p) { return summary_p_(p) }
function reason_(p) {
  if (p.type === 'InstaPay' && p.initiated) return 'InstaPay sent ' + iso_(p.initiated) + ', posted ' + iso_(p.posted) + ' (' + bankingDaysAfter_(p.initiated, p.posted) + ' banking days for approval)'
  if (p.type === 'PesoNET') return 'PesoNET posted ' + iso_(p.posted)
  return p.type + ' posted ' + iso_(p.posted)
}
function splitFees_(qs, fee) {
  const c = cents_(fee); const n = qs.length; const base = Math.floor(c / n); let rem = c - base * n
  return qs.map(() => { const x = base + (rem > 0 ? 1 : 0); rem--; return x / 100 })
}
function build_(qs, p, confidence, reason, alternatives) {
  const fees = splitFees_(qs, p.fee)
  return {
    id: 'rel:' + p.key + ':' + qs.map(q => q.id).join('+'), kind: 'release', confidence: confidence, reason: reason,
    requestIds: qs.map(q => q.id), bank: summary_p_(p), alternatives: alternatives || [],
    writes: qs.map((q, i) => ({ requestId: q.id, values: {
      releaseDate: iso_(p.posted), releasedFrom: p.account, referenceNo: p.txnId, amountReleased: Math.round(expected_(q) * 100) / 100,
      bankCharges: p.fee > 0 ? fees[i] : '', authorization: 'Approved', authorizationDate: iso_(p.posted),
    } })),
  }
}

function waiting_(reqs, bank, proposals) {
  const inProposal = {}
  proposals.forEach(pr => pr.requestIds.forEach(id => { inProposal[id] = true }))
  const anyCoverage = Object.keys(bank.coverage).map(k => bank.coverage[k]).sort((a, b) => b - a)[0] || null
  return reqs.filter(q => q.sent && !q.released && q.auth !== 'Rejected').map(q => {
    const noStatement = q.channel === 'GCash' || q.channel === 'Cash'
    const days = bankingDaysAfter_(q.sent, anyCoverage)
    const lag = LAG_BANKING_DAYS[q.channel]
    const overdue = !noStatement && q.channel !== 'Check' && lag !== undefined && days >= lag && !inProposal[q.id]
    return { requestId: q.id, sent: iso_(q.sent), channel: q.channel, checkNo: q.checkNo, coverage: iso_(anyCoverage), bankingDaysCovered: days,
      state: noStatement ? 'no-statement' : inProposal[q.id] ? 'match-found' : overdue ? 'overdue' : q.channel === 'Check' ? 'check-not-encashed' : 'waiting' }
  })
}

function bankStatus_(ss) {
  try {
    const r = proposeMatches_(ss)
    const cov = r.waiting.length ? r.waiting[0].coverage : ''
    return { coverage: cov || coverageOnly_(ss), waiting: r.waiting, proposals: r.proposals.length, exact: r.proposals.filter(p => p.confidence === 'exact').length }
  } catch (err) { return { error: String(err && err.message || err) } }
}
function coverageOnly_(ss) {
  const c = bankPayments_(ss).coverage
  const d = Object.keys(c).map(k => c[k]).sort((a, b) => b - a)[0]
  return iso_(d || null)
}

function applyMatches_(ss, lists, data) {
  const wanted = Array.isArray(data.ids) ? data.ids : []
  if (wanted.length === 0) throw new Error('Nothing selected')
  const choice = data.choices || {} // proposal id -> alternative bank key chosen by the user
  const current = proposeMatches_(ss).proposals
  const bank = bankPayments_(ss).payments
  const reqs = requestRows_(ss)
  const sh = ss.getSheetByName('REQUESTS')
  const plan = []
  wanted.forEach(id => {
    let pr = current.find(p => p.id === id)
    if (!pr) throw new Error('That match is no longer available (statement or sheet changed). Refresh and try again.')
    if (pr.confidence === 'choose' && !choice[id]) throw new Error('Pick which bank line belongs to ' + pr.requestIds.join(', '))
    if (choice[id] && pr.kind === 'release' && choice[id] !== pr.bank.key) {
      const p = bank.find(b => b.key === choice[id])
      if (!p || !pr.alternatives.some(a => a.key === p.key)) throw new Error('Chosen bank line is not one of the options')
      pr = build_(pr.requestIds.map(rid => reqs.find(q => q.id === rid)), p, 'exact', 'chosen')
    }
    plan.push(pr)
  })
  const usedKeys = {}
  plan.forEach(pr => { if (pr.kind === 'release') { if (usedKeys[pr.bank.key]) throw new Error('The same bank line was picked twice'); usedKeys[pr.bank.key] = true } })
  // validate all, then write
  const writes = []
  plan.forEach(pr => pr.writes.forEach(w => {
    const row = findRequestRow_(sh, w.requestId)
    const map = pr.kind === 'fee' ? { bankCharges: 20 } : Object.assign({}, REQ_FIELDS.release, REQ_FIELDS.authorization)
    writes.push([row, map, w.values])
  }))
  writes.forEach(w => writeFields_(sh, w[0], w[1], w[2], lists))
  const ids = plan.reduce((a, pr) => a.concat(pr.requestIds), [])
  return { sheet: 'REQUESTS', row: writes.map(w => w[0]).join(','), requestId: ids.join(', '), applied: plan.length }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
