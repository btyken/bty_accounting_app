import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { fmt, today, uid, getDateRange, getLast6Months } from '../utils/format'
import { DEPARTMENTS } from '../data/defaults'
import Modal from './ui/Modal'
import PieChart from './ui/PieChart'
import DeleteAllModal from './ui/DeleteAllModal'
import { Trash2, Wallet, X } from 'lucide-react'

const BLANK_ENTRY = () => ({ id: uid(), accountId: '', debit: '', credit: '' })
const BLANK = { date: today(), payee: '', purpose: '', department: '', receiptNo: '', entries: [BLANK_ENTRY(), BLANK_ENTRY()] }

const PERIODS = [
  { id: 'all',       label: 'All' },
  { id: 'weekly',    label: 'This Week' },
  { id: 'monthly',   label: 'This Month' },
  { id: 'quarterly', label: 'This Quarter' },
  { id: 'annually',  label: 'This Year' },
  { id: 'custom',    label: 'Custom Range' },
]

const DEPT_COLORS = [
  '#111111', '#1e40af', '#dc2626', '#d97706', '#065f46',
  '#7c3aed', '#be185d', '#0e7490', '#047857', '#9a3412',
  '#3730a3', '#6b21a8', '#0c4a6e', '#166534', '#92400e',
  '#4c1d95', '#831843',
]

export default function PettyCash() {
  const { data, addPettyCash, deletePettyCash, clearPettyCash } = useApp()
  const { isAdmin } = useAuth()
  const [modal, setModal]         = useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [form, setForm]           = useState(BLANK)
  const [err, setErr]             = useState('')
  const [period, setPeriod]       = useState('all')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo,   setDateTo]     = useState('')

  const pettyCash = data.pettyCash || []

  const openNew = () => { setForm({ ...BLANK, date: today(), entries: [BLANK_ENTRY(), BLANK_ENTRY()] }); setErr(''); setModal(true) }
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const updateEntry = (id, key, val) =>
    setForm(f => ({ ...f, entries: f.entries.map(e => e.id === id ? { ...e, [key]: val } : e) }))
  const addEntry    = () => setForm(f => ({ ...f, entries: [...f.entries, BLANK_ENTRY()] }))
  const removeEntry = (id) => setForm(f => ({ ...f, entries: f.entries.filter(e => e.id !== id) }))

  const totalDebit  = form.entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0)
  const totalCredit = form.entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01

  const save = () => {
    if (!form.date)    return setErr('Date is required.')
    if (!form.payee)   return setErr('Payee is required.')
    if (!form.purpose) return setErr('Purpose is required.')
    const entries = form.entries.filter(e => e.accountId && (parseFloat(e.debit) || parseFloat(e.credit)))
    if (entries.length < 2) return setErr('At least two entries required.')
    if (!balanced)          return setErr('Debits must equal credits.')
    const amount = totalDebit
    addPettyCash({ ...form, amount, entries: entries.map(e => ({ accountId: e.accountId, debit: parseFloat(e.debit)||0, credit: parseFloat(e.credit)||0 })) })
    setModal(false)
  }

  const accountOptions = () => {
    const types = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']
    return types.flatMap(t => {
      const accs = (data.accounts || []).filter(a => a.type === t)
      if (!accs.length) return []
      return [{ isGroup: true, label: `${t}s` }, ...accs]
    })
  }

  const renderAccountSelect = (entry) => (
    <select className="form-select" value={entry.accountId} onChange={e => updateEntry(entry.id, 'accountId', e.target.value)}>
      <option value="">— Select account —</option>
      {accountOptions().map((opt, i) =>
        opt.isGroup
          ? <optgroup key={`g-${i}`} label={opt.label} />
          : <option key={opt.id} value={opt.id}>{opt.code} — {opt.name}</option>
      )}
    </select>
  )

  const range = period === 'custom'
    ? (dateFrom && dateTo ? [dateFrom, dateTo] : null)
    : getDateRange(period)
  const inRange = (date) => !range || (date >= range[0] && date <= range[1])
  const filtered = pettyCash.filter(p => inRange(p.date))

  const total     = filtered.reduce((s, p) => s + p.amount, 0)
  const allTotal  = pettyCash.reduce((s, p) => s + p.amount, 0)
  const thisMonth = today().slice(0, 7)
  const monthTotal = pettyCash.filter(p => p.date.startsWith(thisMonth)).reduce((s, p) => s + p.amount, 0)

  // Department breakdown
  const deptMap = {}
  filtered.forEach(p => {
    const key = p.department || 'Unassigned'
    deptMap[key] = (deptMap[key] || 0) + p.amount
  })
  const deptRows = Object.entries(deptMap)
    .map(([label, value]) => ({
      label,
      value,
      pct: total ? (value / total * 100) : 0,
      color: DEPT_COLORS[DEPARTMENTS.indexOf(label) % DEPT_COLORS.length] ?? '#9ca3af',
    }))
    .sort((a, b) => b.value - a.value)

  // Monthly trend (last 6 months, always from all records)
  const months = getLast6Months()
  const monthlyData = months.map(m => ({
    month: m.slice(5),
    total: pettyCash.filter(p => p.date.startsWith(m)).reduce((s, p) => s + p.amount, 0),
  }))
  const maxBar = Math.max(...monthlyData.map(m => m.total), 1)

  // Top payees from filtered set
  const payeeMap = {}
  filtered.forEach(p => {
    if (!payeeMap[p.payee]) payeeMap[p.payee] = { amount: 0, count: 0 }
    payeeMap[p.payee].amount += p.amount
    payeeMap[p.payee].count  += 1
  })
  const topPayees = Object.entries(payeeMap)
    .map(([payee, v]) => ({ payee, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  return (
    <div>
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-title">Total Disbursed</div><div className="card-value red">{fmt(allTotal)}</div></div>
        <div className="card"><div className="card-title">This Month</div><div className="card-value red">{fmt(monthTotal)}</div></div>
        <div className="card"><div className="card-title">Records</div><div className="card-value">{pettyCash.length}</div></div>
        <div className="card"><div className="card-title">Period Total</div><div className="card-value red">{fmt(total)}</div></div>
      </div>

      {/* Period filter + action */}
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button
                key={p.id}
                className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {isAdmin && (
              <button className="btn btn-danger" onClick={() => setDeleteAllOpen(true)}><Trash2 size={13} /> Delete All</button>
            )}
            <button className="btn btn-primary" onClick={openNew}>+ Add Petty Cash Entry</button>
          </div>
        </div>

        {/* Custom date inputs */}
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>From</span>
            <input
              className="form-input"
              type="date"
              style={{ width: 'auto' }}
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>To</span>
            <input
              className="form-input"
              type="date"
              style={{ width: 'auto' }}
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
            {dateFrom && dateTo && (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Showing {dateFrom} — {dateTo}
              </span>
            )}
          </div>
        )}

        {/* Active range label for preset periods */}
        {period !== 'all' && period !== 'custom' && range && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            Showing: <strong>{range[0]}</strong> — <strong>{range[1]}</strong>
            &nbsp;·&nbsp; {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Charts & Reports — only when there's data */}
      {filtered.length > 0 && (
        <>
          {/* Monthly Trend */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="section-header">Monthly Disbursements — Last 6 Months</div>
            <div className="bar-chart">
              {monthlyData.map(m => (
                <div className="bar-col" key={m.month}>
                  <div className="bar-pair">
                    <div
                      className="bar"
                      style={{ height: `${(m.total / maxBar * 100).toFixed(1)}px`, background: '#dc2626', width: 28 }}
                      title={`${m.month}: ${fmt(m.total)}`}
                    />
                  </div>
                  <div className="bar-label">{m.month}</div>
                </div>
              ))}
            </div>
            <div className="legend">
              <div className="legend-item"><div className="legend-dot" style={{ background: '#dc2626' }} /> Petty Cash</div>
            </div>
          </div>

          <div className="grid-2" style={{ marginBottom: 18 }}>
            {/* Department Breakdown */}
            <div className="card">
              <div className="section-header">Disbursement by Department</div>
              {deptRows.length > 0 ? (
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 160, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <PieChart slices={deptRows} />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Hover for details</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: 14 }}></th>
                          <th>Department</th>
                          <th className="text-right">Amount</th>
                          <th className="text-right">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deptRows.map(row => (
                          <tr key={row.label}>
                            <td><div style={{ width: 10, height: 10, borderRadius: 2, background: row.color }} /></td>
                            <td style={{ fontSize: 12 }}>{row.label}</td>
                            <td className="text-right amount-neg" style={{ fontSize: 12 }}>{fmt(row.value)}</td>
                            <td className="text-right" style={{ fontSize: 12 }}><strong>{row.pct.toFixed(1)}%</strong></td>
                          </tr>
                        ))}
                        <tr className="tr-total">
                          <td></td>
                          <td><strong>Total</strong></td>
                          <td className="text-right amount-neg"><strong>{fmt(total)}</strong></td>
                          <td className="text-right"><strong>100%</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>No department data.</p>
              )}
            </div>

            {/* Top Payees */}
            <div className="card">
              <div className="section-header">Top Payees — Period</div>
              {topPayees.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>Payee</th>
                      <th className="text-right">Txns</th>
                      <th className="text-right">Total</th>
                      <th style={{ width: 100 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPayees.map(p => (
                      <tr key={p.payee}>
                        <td><strong>{p.payee}</strong></td>
                        <td className="text-right text-muted">{p.count}</td>
                        <td className="text-right amount-neg">{fmt(p.amount)}</td>
                        <td>
                          <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${total ? (p.amount / total * 100) : 0}%`, background: '#dc2626', borderRadius: 4 }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: 'var(--muted)', fontSize: 13 }}>No payee data.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Transactions Table */}
      <div className="card">
        {filtered.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon"><Wallet size={32} /></div>
              <p>No petty cash transactions for this period.</p>
              <button className="btn btn-primary" onClick={openNew}>+ Add Petty Cash Entry</button>
            </div>
          )
          : (
            <>
              <div className="section-header">Transactions</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Ref #</th><th>Payee</th><th>Purpose</th>
                      <th>Department</th><th>Receipt #</th>
                      <th className="text-right">Amount</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filtered].reverse().map(p => (
                      <tr key={p.id}>
                        <td className="text-muted">{p.date}</td>
                        <td className="text-muted">{p.number}</td>
                        <td><strong>{p.payee}</strong></td>
                        <td>{p.purpose}</td>
                        <td className="text-muted">{p.department || '—'}</td>
                        <td className="text-muted">{p.receiptNo || '—'}</td>
                        <td className="text-right amount-neg"><strong>{fmt(p.amount)}</strong></td>
                        <td>
                          <button className="btn btn-danger btn-xs" onClick={() => { if (confirm('Delete petty cash entry?')) deletePettyCash(p.id) }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 14, textAlign: 'right', fontWeight: 700, fontSize: 15 }}>
                Period Total: <span style={{ color: 'var(--neg)' }}>{fmt(total)}</span>
              </div>
            </>
          )
        }
      </div>

      {/* New Entry Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Petty Cash Entry"
        size="modal-lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={!balanced && form.entries.some(e => e.accountId)}>Save Entry</button>
          </>
        }
      >
        {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Receipt #</label>
            <input className="form-input" value={form.receiptNo} onChange={e => setField('receiptNo', e.target.value)} placeholder="OR / Receipt number" />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Payee</label>
            <input className="form-input" value={form.payee} onChange={e => setField('payee', e.target.value)} placeholder="Who was paid?" />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" value={form.department} onChange={e => setField('department', e.target.value)}>
              <option value="">— Select Department —</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Purpose / Description</label>
          <input className="form-input" value={form.purpose} onChange={e => setField('purpose', e.target.value)} placeholder="What was it for?" />
        </div>

        <label className="form-label">Entries</label>
        <table className="line-items">
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Account</th>
              <th style={{ width: '20%' }}>Debit (₱)</th>
              <th style={{ width: '20%' }}>Credit (₱)</th>
              <th style={{ width: '10%' }}></th>
            </tr>
          </thead>
          <tbody>
            {form.entries.map(entry => (
              <tr key={entry.id}>
                <td>{renderAccountSelect(entry)}</td>
                <td><input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={entry.debit} onChange={e => updateEntry(entry.id, 'debit', e.target.value)} /></td>
                <td><input className="form-input" type="number" min="0" step="0.01" placeholder="0.00" value={entry.credit} onChange={e => updateEntry(entry.id, 'credit', e.target.value)} /></td>
                <td><button className="del-btn" onClick={() => removeEntry(entry.id)}><X size={13} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn btn-secondary btn-sm" onClick={addEntry}>+ Add Entry</button>

        <div style={{ marginTop: 12, fontSize: 13, padding: '8px 12px', borderRadius: 6, background: balanced ? 'var(--pos-bg)' : 'var(--neg-bg)', color: balanced ? 'var(--pos)' : 'var(--neg)' }}>
          Debits: <strong>{fmt(totalDebit)}</strong> &nbsp;|&nbsp; Credits: <strong>{fmt(totalCredit)}</strong>
          &nbsp; {balanced ? 'Balanced' : 'Not balanced'}
        </div>
      </Modal>

      {/* Delete All Modal */}
      <DeleteAllModal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={clearPettyCash}
        label="Petty Cash Entries"
      />
    </div>
  )
}
