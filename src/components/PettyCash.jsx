import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { fmt, today, getDateRange } from '../utils/format'
import { DEPARTMENTS } from '../data/defaults'
import Modal from './ui/Modal'

const BLANK = { date: today(), payee: '', purpose: '', amount: '', department: '', receiptNo: '' }

const PERIODS = [
  { id: 'all',       label: 'All' },
  { id: 'weekly',    label: 'This Week' },
  { id: 'monthly',   label: 'This Month' },
  { id: 'quarterly', label: 'This Quarter' },
  { id: 'annually',  label: 'This Year' },
]

export default function PettyCash() {
  const { data, addPettyCash, deletePettyCash } = useApp()
  const [modal, setModal]   = useState(false)
  const [form, setForm]     = useState(BLANK)
  const [err, setErr]       = useState('')
  const [period, setPeriod] = useState('all')

  const pettyCash = data.pettyCash || []

  const openNew = () => { setForm({ ...BLANK, date: today() }); setErr(''); setModal(true) }
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.date)    return setErr('Date is required.')
    if (!form.payee)   return setErr('Payee is required.')
    if (!form.purpose) return setErr('Purpose is required.')
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return setErr('Enter a valid amount.')
    addPettyCash({ ...form, amount })
    setModal(false)
  }

  const range = getDateRange(period)
  const inRange = (date) => !range || (date >= range[0] && date <= range[1])
  const filtered = pettyCash.filter(p => inRange(p.date))

  const total     = filtered.reduce((s, p) => s + p.amount, 0)
  const allTotal  = pettyCash.reduce((s, p) => s + p.amount, 0)
  const thisMonth = today().slice(0, 7)
  const monthTotal = pettyCash.filter(p => p.date.startsWith(thisMonth)).reduce((s, p) => s + p.amount, 0)

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
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
        <button className="btn btn-primary" onClick={openNew}>+ Add Petty Cash Entry</button>
      </div>

      <div className="card">
        {filtered.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon">💵</div>
              <p>No petty cash transactions for this period.</p>
              <button className="btn btn-primary" onClick={openNew}>+ Add Petty Cash Entry</button>
            </div>
          )
          : (
            <>
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
                Period Total: <span style={{ color: 'var(--red)' }}>{fmt(total)}</span>
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
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save Entry</button>
          </>
        }
      >
        {err && <div className="form-error" style={{ marginBottom: 12 }}>⚠️ {err}</div>}
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Amount (₱)</label>
            <input className="form-input" type="number" min="0" step="0.01" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Payee</label>
            <input className="form-input" value={form.payee} onChange={e => setField('payee', e.target.value)} placeholder="Who was paid?" />
          </div>
          <div className="form-group">
            <label className="form-label">Receipt #</label>
            <input className="form-input" value={form.receiptNo} onChange={e => setField('receiptNo', e.target.value)} placeholder="OR / Receipt number" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Purpose / Description</label>
          <input className="form-input" value={form.purpose} onChange={e => setField('purpose', e.target.value)} placeholder="What was it for?" />
        </div>
        <div className="form-group">
          <label className="form-label">Department</label>
          <select className="form-select" value={form.department} onChange={e => setField('department', e.target.value)}>
            <option value="">— Select Department —</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </Modal>
    </div>
  )
}
