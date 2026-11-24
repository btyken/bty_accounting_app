import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useAuth } from '../store/AuthContext'
import Modal from './ui/Modal'
import { issuesFor, groupIssues, rowObj, peso } from './tracker/fixes'
import EntryForm, { newRequestInitial, stepInitial, receiptInitial } from './tracker/EntryForms'
import {
  RefreshCw, ExternalLink, Search, AlertTriangle, Sheet, Clock, CheckCircle2, Plug, Wrench, ChevronDown, ChevronRight, User, Plus, FilePlus2, ClipboardCheck, Send, Wallet, Pencil, CheckCircle,
} from 'lucide-react'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1gV5PH9xsEuVpbINpkSCy-a4Wcrm3ZpBtDKuuzazkRLA/edit'

// Keep one copy per browser tab so switching pages doesn't refetch every time.
let memo = { data: null, at: 0 }

const TABS = [
  { id: 'overview',       label: 'Overview' },
  { id: 'requests',       label: 'Requests' },
  { id: 'receipts',       label: 'Receipts' },
  { id: 'unliquidated',   label: 'Unliquidated' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'bank',           label: 'Bank Recon' },
]

// Columns shown in the Requests table (by header text in the REQUESTS tab).
const REQUEST_COLS = [
  'Request ID', 'Status', 'Date Requested', 'Requested By', 'Request Type', 'Payee / Supplier', 'Purpose / Particulars',
  'Amount Requested', 'Amount Released', 'Open Balance', 'Release Date', 'Next Action By', 'Reconciliation Check',
]
const UNLIQ_COLS = [
  'Request ID', 'Aging', 'Requested By', 'Purpose', 'Release Date', 'Amount Released', 'Receipts',
  'Change Returned', 'Unliquidated Balance', 'Days Outstanding', 'Status',
]
const RECON_COLS = [
  'Request ID', 'Result', 'Release Date', 'Requested By', 'Payee', 'Reference No.', 'Amount Requested',
  'Amount Released', 'Amount in Disbursement Book', 'Amount in Bank Statement', 'Receipts Total', 'Open Balance',
]
const RECEIPT_COLS = [
  'Request ID', 'Receipt Date', 'OR / Invoice No.', 'Supplier Name', 'Account Title', 'Amount (receipt total)',
  'VATABLE SALES', 'VAT (Input Tax)', 'Expense Amount (net of VAT)', 'Expanded Withholding Tax', 'Vendor List Check',
]
const BANK_COLS = [
  'Posted Date', 'Status', 'Description', 'Debit', 'Credit', 'Transaction ID', 'Request ID', 'Remarks',
  'Bank Amount (group)', 'Book Amount (group)', 'Running Balance',
]
const SHORT = {
  'Payee / Supplier': 'Payee', 'Purpose / Particulars': 'Purpose', 'Bank / GCash Reference No.': 'Reference',
  'Reconciliation Check': 'Recon Check', 'Bank Confirmed Manually (tick only if no statement is imported, e.g. GCash)': 'Bank Confirmed Manually',
}

const isAmount = (v) => /^\(?-?[\d,]+\.\d{2}\)?$/.test(String(v).trim()) || String(v).trim() === '-'
const isAmountHeader = (h) => /amount|balance|total|debit|credit|charges|receipts|released|returned|vat|tax|advanced|cleared|minus/i.test(h) && !/date|from|to$|by/i.test(h)

function tone(text) {
  const t = String(text).toLowerCase()
  if (!t) return 'badge-gray'
  if (/^(ok|closed|matched|approved|processed|fully liquidated|reconciled)/.test(t)) return 'badge-green'
  if (/overdue|differs|not recorded|not equal|rejected|does not|missing|issue|error/.test(t)) return 'badge-red'
  if (/partial|waiting|pending|on hold|open|returned|inflow/.test(t)) return 'badge-gold'
  return 'badge-gray'
}

function StatusBadge({ text }) {
  if (!text) return <span className="text-muted">—</span>
  return <span className={`badge ${tone(text)} badge-plain`} title={text}>{text}</span>
}

function useTracker(userId) {
  const [state, setState] = useState({ data: memo.data, at: memo.at, loading: !memo.data, error: null })

  const load = useCallback(async (fresh = false) => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const r = await fetch(`/api/tracker${fresh ? '?fresh=1' : ''}`, { headers: { 'x-bty-user': userId || '' } })
      let body = null
      try { body = await r.json() } catch { /* not JSON */ }
      if (!r.ok || !body || body.error) throw new Error((body && body.error) || `http_${r.status}`)
      memo = { data: body, at: Date.now() }
      setState({ data: body, at: memo.at, loading: false, error: null })
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e.message }))
    }
  }, [userId])

  useEffect(() => {
    if (!memo.data || Date.now() - memo.at > 60_000) load(false)
  }, [load])

  return { ...state, reload: () => load(true) }
}

function ago(ts) {
  if (!ts) return ''
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/* ─────────────────────────────────────────────────────────── */

export default function RequisitionTracker() {
  const { currentUser, isAdmin } = useAuth()
  const { data, loading, error, reload } = useTracker(currentUser?.id)
  const [tab, setTab] = useState('overview')
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [detail, setDetail] = useState(null)
  const [form, setForm] = useState(null)
  const [toast, setToast] = useState('')
  const canWrite = !!data?.canWrite

  const openStep = (kind, row) => {
    const headers = data.requests.headers
    const r = rowObj(headers, row)
    const id = r['Request ID']
    const ctx = {}
    if (kind === 'release') {
      const wht = parseFloat(String(r['Withholding Tax on Receipts'] || '0').replace(/,/g, '')) || 0
      ctx.expected = wht > 0 ? `${r['Amount Requested']} less ${r['Withholding Tax on Receipts']} withholding tax` : r['Amount Requested']
    }
    ctx.summary = `${id} · ${r['Requested By']} · ${r['Purpose / Particulars']} · ₱${r['Amount Requested']} · ${r['Status']}`
    const initial = kind === 'receipt' ? receiptInitial(r) : stepInitial(headers, row, kind)
    if (kind === 'release' && !initial.amountReleased) initial.amountReleased = String(r['Amount Requested'] || '').replace(/,/g, '')
    setDetail(null)
    setForm({ kind, requestId: id, initial, context: ctx })
  }
  const openNewRequest = () => setForm({ kind: 'newRequest', initial: newRequestInitial(), context: {} })
  const openNewReceipt = () => {
    const h = data.requests.headers
    const requestOptions = data.requests.rows
      .map(row => rowObj(h, row))
      .filter(r => r['Authorization'] !== 'Rejected')
      .map(r => ({ id: r['Request ID'], purpose: r['Purpose / Particulars'], payee: r['Payee / Supplier'], account: r['Account to Charge'] }))
      .reverse()
    setForm({ kind: 'receipt', initial: { ...receiptInitial({}), supplier: '', requestId: '' }, context: { requestOptions } })
  }
  const onSaved = (res, f) => {
    setForm(null)
    const what = { newRequest: 'New request', request: 'Request details', process: 'Processing', release: 'Release', liquidate: 'Liquidation', receipt: 'Receipt' }[f.kind]
    setToast(`${what} saved to the sheet${res.requestId ? ` · ${res.requestId}` : ''}. Refreshing…`)
    setTimeout(() => setToast(''), 5000)
    reload()
  }

  useEffect(() => { setQ(''); setStatusFilter('') }, [tab])

  const sheetUrl = data?.sheetUrl || SHEET_URL

  const toolbar = (
    <div className="tracker-toolbar">
      <div className="tracker-source">
        <span className="tracker-source-icon"><Sheet size={16} /></span>
        <div>
          <div className="tracker-source-name">ACCOUNTING – Requisition, Release &amp; Reconciliation 2026</div>
          <div className="tracker-source-meta">
            <Clock size={11} /> {data ? `Synced ${ago(data.generatedAt)}` : 'Not synced yet'} · read-only, edit in Google Sheets
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={reload} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> {loading ? 'Syncing…' : 'Refresh'}
        </button>
        <a className="btn btn-primary btn-sm" href={sheetUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={13} /> Open in Google Sheets
        </a>
      </div>
    </div>
  )

  if (!data) {
    return (
      <div>
        {toolbar}
        <div className="card">
          {loading && !error && <div className="empty"><div className="empty-icon"><RefreshCw size={30} className="spin" /></div><p>Loading the tracker…</p></div>}
          {error && <ConnectionError error={error} isAdmin={isAdmin} onRetry={reload} />}
        </div>
      </div>
    )
  }

  return (
    <div>
      {toolbar}
      {error && (
        <div className="tracker-alert"><AlertTriangle size={15} /> Couldn't refresh ({error}). Showing the last copy loaded.</div>
      )}
      {toast && <div className="tracker-toast"><CheckCircle size={15} /> {toast}</div>}
      {!canWrite && (
        <div className="tracker-note">Entry from the app turns on once the sheet script is updated. Until then this page is read-only.</div>
      )}
      {form && (
        <EntryForm form={form} lists={data.lists} userId={currentUser?.id} onClose={() => setForm(null)} onSaved={onSaved} />
      )}

      <div className="tabs">
        {TABS.map(t => (
          <div key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'requests' && <span className="tab-count">{data.requests?.rows?.length || 0}</span>}
            {t.id === 'unliquidated' && <span className="tab-count">{data.unliquidated?.rows?.length || 0}</span>}
          </div>
        ))}
      </div>

      {tab === 'overview' && <Overview data={data} onGo={setTab} onOpen={(row) => setDetail({ headers: data.requests.headers, row })} />}

      {tab === 'requests' && canWrite && (
        <div className="tab-actions">
          <button className="btn btn-primary" onClick={openNewRequest}><Plus size={15} /> New request</button>
          <span className="text-muted text-sm">Open a request to process, release, liquidate or add receipts.</span>
        </div>
      )}
      {tab === 'requests' && (
        <SheetTable
          table={data.requests}
          columns={REQUEST_COLS}
          statusColumn="Status"
          badgeColumns={['Status', 'Authorization', 'Reconciliation Check']}
          q={q} setQ={setQ} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          onRow={(row) => setDetail({ headers: data.requests.headers, row })}
          empty="No requests in the sheet yet."
        />
      )}

      {tab === 'receipts' && (
        <>
          {canWrite && (
            <div className="tab-actions">
              <button className="btn btn-primary" onClick={openNewReceipt}><FilePlus2 size={15} /> Add receipt</button>
              <span className="text-muted text-sm">VAT split, withholding tax and journal postings calculate in the sheet.</span>
            </div>
          )}
          {data.receipts
            ? <SheetTable table={data.receipts} columns={RECEIPT_COLS} badgeColumns={['Vendor List Check']} q={q} setQ={setQ} empty="No receipts recorded yet." />
            : <div className="card"><p className="text-muted">Receipts appear here once the sheet script is updated.</p></div>}
        </>
      )}

      {tab === 'unliquidated' && (
        <>
          <Summary items={data.unliquidated?.summary} />
          <SheetTable
            title="Advances released through the tracker"
            table={data.unliquidated}
            columns={UNLIQ_COLS}
            statusColumn="Aging"
            badgeColumns={['Aging', 'Status']}
            q={q} setQ={setQ} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            empty="No open cash advances."
          />
          {data.unliquidated?.book?.rows?.length > 0 && (
            <SheetTable
              title="Older advances still on the books (account 1851, DISBURSEMENT 2026)"
              table={data.unliquidated.book}
              badgeColumns={['Aging']}
              q={q}
              compact
            />
          )}
        </>
      )}

      {tab === 'reconciliation' && (
        <>
          <Summary items={data.reconciliation?.summary} />
          <SheetTable
            table={data.reconciliation}
            columns={RECON_COLS}
            statusColumn="Result"
            badgeColumns={['Result']}
            q={q} setQ={setQ} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            empty="No released requests yet."
          />
        </>
      )}

      {tab === 'bank' && (
        <>
          <Summary items={data.bankRecon?.summary} />
          <SheetTable
            table={data.bankRecon}
            columns={BANK_COLS}
            statusColumn="Status"
            badgeColumns={['Status']}
            q={q} setQ={setQ} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            empty="No bank statement imported yet."
          />
          {data.bankRecon?.missingFromBank?.rows?.some(r => !/^none/i.test(String(r[0]))) && (
            <SheetTable
              title="In the book, not in the bank"
              table={{ ...data.bankRecon.missingFromBank, rows: data.bankRecon.missingFromBank.rows.filter(r => !/^none/i.test(String(r[0]))) }}
              q={q}
              compact
            />
          )}
        </>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.row[0]} · ${detail.row[6] || ''}` : ''} size="modal-lg"
        footer={detail && canWrite ? <StepActions headers={detail.headers} row={detail.row} onStep={openStep} /> : null}>
        {detail && <DetailFixes headers={detail.headers} row={detail.row} />}
        {detail && (
          <div className="detail-grid">
            {detail.headers.map((h, i) => h && (
              <div key={i} className="detail-item">
                <div className="detail-label">{SHORT[h] || h}</div>
                <div className="detail-value">{detail.row[i] || <span className="text-muted">—</span>}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ── Step buttons for one request ─────────────────────────── */

function StepActions({ headers, row, onStep }) {
  const r = rowObj(headers, row)
  const approved = r['Authorization'] === 'Approved'
  const rejected = r['Authorization'] === 'Rejected'
  const released = !!String(r['Release Date'] || '').trim()
  const isCA = r['Request Type'] === 'Cash Advance'
  return (
    <div className="step-actions">
      <button className="btn btn-secondary btn-sm" onClick={() => onStep('request', row)}><Pencil size={13} /> Edit details</button>
      <button className="btn btn-secondary btn-sm" onClick={() => onStep('process', row)}><ClipboardCheck size={13} /> Processing</button>
      <button className="btn btn-secondary btn-sm" onClick={() => onStep('release', row)} disabled={!approved}
        title={approved ? '' : rejected ? 'Rejected by Ma\'am Mia' : 'Waiting for Ma\'am Mia\'s approval in the sheet'}>
        <Send size={13} /> Release
      </button>
      {isCA && <button className="btn btn-secondary btn-sm" onClick={() => onStep('liquidate', row)} disabled={!released}><Wallet size={13} /> Liquidation</button>}
      <button className="btn btn-primary btn-sm" onClick={() => onStep('receipt', row)} disabled={rejected}><FilePlus2 size={13} /> Add receipt</button>
    </div>
  )
}

/* ── Recommended fixes ───────────────────────────────────── */

function NeedsAttention({ data, onOpen }) {
  const headers = data.requests?.headers || []
  const rows = data.requests?.rows || []
  const groups = useMemo(() => groupIssues(headers, rows), [headers, rows])
  const [open, setOpen] = useState(() => new Set(groups.slice(0, 1).map(g => g.key)))
  const toggle = (k) => setOpen(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-head">
        <h3><Wrench size={15} style={{ verticalAlign: -2, marginRight: 8 }} />Needs attention</h3>
        <span className="chip">{groups.length === 0 ? 'All clear' : `${groups.reduce((n, g) => n + g.items.length, 0)} items · ${groups.length} type${groups.length === 1 ? '' : 's'}`}</span>
      </div>
      {groups.length === 0 && (
        <div className="fix-clear"><CheckCircle2 size={16} /> Every request is closed or reconciled. Nothing to fix.</div>
      )}
      {groups.map(g => {
        const isOpen = open.has(g.key)
        const sameFix = g.items.every(it => it.fix === g.items[0].fix)
        const shared = g.groupFix && g.items.length > 1 ? g.groupFix : (sameFix ? g.items[0].fix : null)
        return (
          <div key={g.key} className={`fix-group${isOpen ? ' open' : ''}`}>
            <button className="fix-head" onClick={() => toggle(g.key)}>
              {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              <span className="fix-title">{g.title}</span>
              <span className="fix-meta">{g.items.length} request{g.items.length === 1 ? '' : 's'}{g.total > 0 ? ` · ${peso(g.total)} open` : ''}</span>
            </button>
            {isOpen && (
              <div className="fix-body">
                {shared && <div className="fix-text"><strong>Recommended fix:</strong> {shared}</div>}
                <div className="fix-items">
                  {g.items.map(it => (
                    <div key={it.id} className="fix-item" onClick={() => onOpen(it.row)}>
                      <div className="fix-item-head">
                        <span className="fix-id">{it.id}</span>
                        <span className="fix-purpose">{it.r['Purpose / Particulars']}</span>
                        <span className="fix-amt">{it.r['Open Balance'] && it.r['Open Balance'] !== '-' ? `${peso(parseFloat(String(it.r['Open Balance']).replace(/[(),]/g, '')))} open` : ''}</span>
                      </div>
                      {!shared && <div className="fix-text small">{it.fix}</div>}
                      {shared && it.note && shared !== it.fix && <div className="fix-text small">{it.note}</div>}
                      {it.owner && <div className="fix-owner"><User size={11} /> {it.owner}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DetailFixes({ headers, row }) {
  const issues = issuesFor(rowObj(headers, row))
  if (issues.length === 0) {
    return <div className="fix-clear" style={{ marginBottom: 14 }}><CheckCircle2 size={16} /> No open issues on this request.</div>
  }
  return (
    <div className="fix-box">
      <div className="fix-box-title"><Wrench size={14} /> What to do</div>
      {issues.map((is, i) => (
        <div key={i} className="fix-box-item">
          <div className="fix-box-issue">{is.title}</div>
          <div className="fix-text small">{is.fix}</div>
          {is.owner && <div className="fix-owner"><User size={11} /> {is.owner}</div>}
        </div>
      ))}
    </div>
  )
}

/* ── Overview ─────────────────────────────────────────────── */

function Overview({ data, onGo, onOpen }) {
  const pos = data.position || []
  const find = (re) => pos.find(p => re.test(p.measure))
  const tiles = [
    { label: 'Waiting for processing', m: find(/waiting for processing/i), go: 'requests' },
    { label: 'Waiting for authorization', m: find(/waiting for authorization/i), go: 'requests' },
    { label: 'Approved, waiting for release', m: find(/waiting for release/i), go: 'requests' },
    { label: 'Unliquidated cash advances', m: find(/not yet liquidated/i), go: 'unliquidated', warn: true },
  ]
  const recon = data.reconciliation?.summary || []
  const bank = data.bankRecon?.summary || []

  return (
    <div>
      <div className="grid-4">
        {tiles.map(t => (
          <div key={t.label} className="card stat-tile" onClick={() => onGo(t.go)}>
            <div className="stat-head"><div className="card-title">{t.label}</div></div>
            <div className="stat-row">
              <div className={`card-value${t.warn && t.m && t.m.count !== '0' ? ' red' : ''}`}>{t.m?.amount && t.m.amount !== '-' ? `₱${t.m.amount}` : '₱0.00'}</div>
            </div>
            <div className="stat-foot">{t.m ? `${t.m.count} request${t.m.count === '1' ? '' : 's'}` : 'Not in sheet'}</div>
          </div>
        ))}
      </div>

      <NeedsAttention data={data} onOpen={onOpen} />

      <div className="grid-2-1">
        <div className="card">
          <div className="card-head"><h3>Current position</h3><span className="chip">As of today</span></div>
          {pos.length === 0
            ? <p className="text-muted">The DASHBOARD tab's "Current position" block wasn't found.</p>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Measure</th><th className="text-right">Count</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {pos.map(p => (
                      <tr key={p.measure}>
                        <td style={p.measure.startsWith('of which') ? { paddingLeft: 30, color: 'var(--muted)' } : undefined}>{p.measure}</td>
                        <td className="text-right">{p.count}</td>
                        <td className="text-right">{p.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <MiniSummary title="Reconciliation" items={recon} onClick={() => onGo('reconciliation')} />
          <MiniSummary title="Bank recon" items={bank} onClick={() => onGo('bank')} />
        </div>
      </div>
    </div>
  )
}

function MiniSummary({ title, items, onClick }) {
  return (
    <div className="card stat-tile" onClick={onClick}>
      <div className="card-head" style={{ marginBottom: 10 }}><h3>{title}</h3></div>
      {(items || []).map(it => (
        <div key={it.label} className="mini-row">
          <span>{it.label}</span><strong>{it.value}</strong>
        </div>
      ))}
      {(!items || items.length === 0) && <p className="text-muted text-sm">No summary in the sheet.</p>}
    </div>
  )
}

function Summary({ items }) {
  if (!items || items.length === 0) return null
  return (
    <div className="summary-strip">
      {items.map(it => (
        <div key={it.label} className="summary-pill">
          <span>{it.label}</span><strong>{it.value}</strong>
        </div>
      ))}
    </div>
  )
}

/* ── Generic sheet table ───────────────────────────────────── */

function SheetTable({ title, table, columns, statusColumn, badgeColumns = [], q, setQ, statusFilter, setStatusFilter, onRow, empty, compact }) {
  const headers = table?.headers || []
  const rows = table?.rows || []
  const idx = useMemo(() => {
    const list = columns
      ? columns.map(c => headers.indexOf(c)).filter(i => i >= 0)
      : headers.map((h, i) => (h ? i : -1)).filter(i => i >= 0)
    return list
  }, [headers, columns])
  const statusIdx = statusColumn ? headers.indexOf(statusColumn) : -1
  const statuses = useMemo(
    () => (statusIdx >= 0 ? [...new Set(rows.map(r => r[statusIdx]).filter(Boolean))].sort() : []),
    [rows, statusIdx],
  )

  const filtered = rows.filter(r => {
    if (statusFilter && statusIdx >= 0 && r[statusIdx] !== statusFilter) return false
    if (q) {
      const needle = q.toLowerCase()
      if (!r.some(c => String(c).toLowerCase().includes(needle))) return false
    }
    return true
  })

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      {(title || setQ) && (
        <div className="card-head">
          {title ? <h3>{title}</h3> : <span />}
          {setQ && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="search-box">
                <Search size={14} />
                <input placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
              </div>
              {statuses.length > 0 && (
                <select className="form-input form-input-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="">All {statusColumn.toLowerCase()}</option>
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {rows.length === 0
        ? <div className="empty"><div className="empty-icon"><CheckCircle2 size={30} /></div><p>{empty || 'Nothing here.'}</p></div>
        : (
          <>
            <div className={`table-wrap tracker-table${compact ? ' compact' : ''}`}>
              <table>
                <thead>
                  <tr>{idx.map(i => <th key={i} className={isAmountHeader(headers[i]) ? 'text-right' : ''}>{SHORT[headers[i]] || headers[i]}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((r, ri) => (
                    <tr key={ri} onClick={onRow ? () => onRow(r) : undefined} style={onRow ? { cursor: 'pointer' } : undefined}>
                      {idx.map(i => {
                        const h = headers[i], v = r[i]
                        if (badgeColumns.includes(h)) return <td key={i}><StatusBadge text={v} /></td>
                        const right = isAmountHeader(h) && isAmount(v)
                        return <td key={i} className={right ? 'text-right' : ''} title={String(v).length > 40 ? v : undefined}>{v}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-foot">
              {filtered.length === rows.length ? `${rows.length} rows` : `${filtered.length} of ${rows.length} rows`}
              {onRow && ' · click a row for all details'}
            </div>
          </>
        )}
    </div>
  )
}

/* ── Errors / setup ───────────────────────────────────────── */

function ConnectionError({ error, isAdmin, onRetry }) {
  if (error === 'not_configured' || error === 'http_404') {
    return (
      <div className="empty">
        <div className="empty-icon"><Plug size={32} /></div>
        <p style={{ fontWeight: 600, color: 'var(--ink)' }}>The tracker isn't connected yet.</p>
        <p className="text-sm">
          {isAdmin
            ? 'Deploy the Apps Script in the tracker sheet and set TRACKER_URL and TRACKER_KEY on Vercel (see google-apps-script/Code.gs).'
            : 'Ask an admin to finish connecting the Google Sheet.'}
        </p>
        <a className="btn btn-secondary btn-sm" href={SHEET_URL} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open the sheet instead</a>
      </div>
    )
  }
  const msg = {
    unauthorized: 'Your login could not be verified. Sign out and sign in again.',
    sheet_unauthorized: 'The sheet rejected the connection key. Check that TRACKER_KEY matches in the Apps Script and on Vercel.',
    sheet_unreachable: 'The Google Sheet could not be reached. Try again in a minute.',
    bad_sheet_response: 'The Google Sheet sent back something unexpected. Check the Apps Script deployment (Who has access: Anyone).',
  }[error] || `Something went wrong (${error}).`
  return (
    <div className="empty">
      <div className="empty-icon"><AlertTriangle size={32} /></div>
      <p>{msg}</p>
      <button className="btn btn-secondary btn-sm" onClick={onRetry}><RefreshCw size={13} /> Try again</button>
    </div>
  )
}
