/**
 * BTY Accounting App ↔ "ACCOUNTING – Requisition, Release & Reconciliation 2026"
 *
 * The sheet is the database. The app reads it (doGet) and writes requisition
 * entries into it (doPost). Writes only ever touch the typing columns:
 *   REQUESTS B–M and P–Z (never A, N–O authorization, or the formula columns AA+)
 *   RECEIPTS A–S (never the tax-breakdown formula columns T+)
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
}

const RCPT_FIELDS = {
  requestId: 1, receiptDate: 2, orNo: 3, supplier: 4, tin: 5, supplierCategory: 6,
  account: 7, amount: 8, vatRegistered: 9, nonVatPortion: 10, exempt: 11, discount: 12,
  discountBasis: 13, otherCharges: 14, vatableAsPrinted: 15, vatAsPrinted: 16,
  receiptType: 17, whtRate: 18, particulars: 19,
}

const DATE_FIELDS = ['dateRequested', 'dateNeeded', 'processedDate', 'releaseDate', 'liquidationDate', 'paidBackDate', 'receiptDate']
const NUMBER_FIELDS = ['amountRequested', 'amountReleased', 'bankCharges', 'changeReturned', 'paidBackToEmployee',
  'amount', 'nonVatPortion', 'exempt', 'discount', 'otherCharges', 'vatableAsPrinted', 'vatAsPrinted']
const BOOL_FIELDS = ['bankConfirmedManually', 'vatRegistered']

// Strict dropdowns: value must be in the SETTINGS list (blank allowed).
const LIST_CHECKS = {
  department: 'departments', requestType: 'requestTypes', account: 'accounts',
  processingResult: 'processingResults', releasedFrom: 'cashAccounts', changeReturnedTo: 'cashAccounts',
  discountBasis: 'discountBases', receiptType: 'receiptTypes', supplierCategory: 'supplierCategories',
  whtRate: 'whtRates',
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
    requests: table_(ss, 'REQUESTS', 4, 1, 35),
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
      default: return json_({ error: 'unknown_action' })
    }
    SpreadsheetApp.flush()
    try {
      log_(ss, body.user || '(unknown)', body.action + (body.step ? ':' + body.step : ''), result.requestId, result.sheet + '!' + result.row, data)
    } catch (logErr) { /* the entry is saved; never report it as failed because of the log */ }
    CacheService.getScriptCache().remove('tracker')
    return json_({ ok: true, requestId: result.requestId, row: result.row })
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
  if (!map) throw new Error('Unknown step ' + step)
  const sh = ss.getSheetByName('REQUESTS')
  const row = findRequestRow_(sh, data.requestId)
  if (step === 'release') {
    const auth = String(sh.getRange(row, 14).getDisplayValue()).trim()
    if (auth !== 'Approved') throw new Error(data.requestId + " is not approved yet (Authorization is '" + (auth || 'blank') + "'). Ma'am Mia approves in the sheet.")
  }
  writeFields_(sh, row, map, data, lists)
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

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
