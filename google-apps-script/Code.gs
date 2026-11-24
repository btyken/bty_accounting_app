/**
 * BTY Accounting App ↔ "ACCOUNTING – Requisition, Release & Reconciliation 2026"
 *
 * Read-only JSON feed of the tracker for the accounting app.
 * Install: in the tracker sheet, Extensions > Apps Script, paste this file,
 * set TRACKER_KEY below (the same value as the TRACKER_KEY env var on Vercel),
 * then Deploy > New deployment > Web app, Execute as: Me, Who has access: Anyone.
 *
 * Nothing in the sheet is ever changed by this script.
 */

const TRACKER_KEY = 'PASTE_THE_KEY_HERE'

function doGet(e) {
  const key = e && e.parameter && e.parameter.key
  if (!key || key !== TRACKER_KEY) return json_({ error: 'unauthorized' })

  const cache = CacheService.getScriptCache()
  const cached = cache.get('tracker')
  if (cached && !(e.parameter.fresh === '1')) return ContentService.createTextOutput(cached).setMimeType(ContentService.MimeType.JSON)

  const ss = SpreadsheetApp.getActiveSpreadsheet()
  const out = {
    generatedAt: new Date().toISOString(),
    sheetUrl: ss.getUrl(),
    position: currentPosition_(ss),
    requests: table_(ss, 'REQUESTS', 4, 1, 35),
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
  const text = JSON.stringify(out)
  try { cache.put('tracker', text, 60) } catch (err) { /* over 100 KB: skip cache */ }
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON)
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

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)
}
