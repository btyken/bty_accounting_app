import React, { useState } from 'react'
import { useApp } from '../../store/AppContext'
import { fmt, today, uid, pad } from '../../utils/format'
import { DEPARTMENTS } from '../../data/defaults'
import Modal from '../ui/Modal'
import { Edit3, X } from 'lucide-react'

const AJE_TYPES = [
  'Accrued Revenue',
  'Accrued Expense',
  'Prepaid Expense Amortization',
  'Unearned Revenue Adjustment',
  'Depreciation / Amortization',
  'Bad Debt Expense',
  'Inventory Adjustment',
  'Interest Accrual',
  'Other',
]

const BLANK_ENTRY = () => ({ id: uid(), accountId: '', debit: '', credit: '' })

export default function AdjustingEntries() {
  const { data, addTransaction, deleteTransaction } = useApp()

  const adjustingEntries = [...(data.transactions || [])]
    .filter(t => t.isAdjusting)
    .reverse()

  const nextRef = () => {
    const max = adjustingEntries.reduce((m, t) => {
      const num = parseInt((t.ref || '').replace(/[^\d]/g, '')) || 0
      return Math.max(m, num)
    }, 0)
    return 'AJE-' + pad(max + 1)
  }

  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({ date: today(), ref: '', ajType: 'Accrued Expense', description: '', department: '', entries: [BLANK_ENTRY(), BLANK_ENTRY()] })
  const [err, setErr]     = useState('')

  const openNew = () => {
    setForm({ date: today(), ref: nextRef(), ajType: 'Accrued Expense', description: '', department: '', entries: [BLANK_ENTRY(), BLANK_ENTRY()] })
    setErr('')
    setModal(true)
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const updateEntry = (id, key, val) =>
    setForm(f => ({ ...f, entries: f.entries.map(e => e.id === id ? { ...e, [key]: val } : e) }))
  const addEntry    = () => setForm(f => ({ ...f, entries: [...f.entries, BLANK_ENTRY()] }))
  const removeEntry = (id) => setForm(f => ({ ...f, entries: f.entries.filter(e => e.id !== id) }))

  const totalDebit  = form.entries.reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0)
  const totalCredit = form.entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01

  const save = () => {
    if (!form.date)             return setErr('Date is required.')
    if (!form.ref.trim())       return setErr('Reference is required.')
    if (!form.description.trim()) return setErr('Description is required.')
    const entries = form.entries.filter(e => e.accountId && (parseFloat(e.debit) || parseFloat(e.credit)))
    if (entries.length < 2)     return setErr('At least two entries required.')
    if (!balanced)              return setErr('Debits must equal credits.')
    addTransaction({
      id: uid(),
      date: form.date,
      ref: form.ref,
      description: form.description,
      department: form.department,
      ajType: form.ajType,
      isAdjusting: true,
      entries: entries.map(e => ({ accountId: e.accountId, debit: parseFloat(e.debit) || 0, credit: parseFloat(e.credit) || 0 })),
    })
    setModal(false)
  }

  const accountOptions = () => {
    const types = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']
    return types.flatMap(t => {
      const accs = data.accounts.filter(a => a.type === t)
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

  return (
    <div>
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#0369a1', lineHeight: 1.6 }}>
        <strong>About Adjusting Entries</strong> — Posted at period-end to record accruals, deferrals, depreciation, and other adjustments before preparing financial statements. These use the same double-entry mechanism as journal entries but are tagged separately for reporting clarity.
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-primary" onClick={openNew}>+ New Adjusting Entry</button>
      </div>

      <div className="card">
        {adjustingEntries.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Edit3 size={32} /></div>
            <p>No adjusting entries posted yet.</p>
            <button className="btn btn-primary" onClick={openNew}>+ New Adjusting Entry</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Reference</th><th>Type</th><th>Description</th>
                  <th>Department</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th></th>
                </tr>
              </thead>
              <tbody>
                {adjustingEntries.map(t => (
                  <tr key={t.id}>
                    <td className="text-muted">{t.date}</td>
                    <td><strong>{t.ref}</strong></td>
                    <td><span className="badge badge-blue">{t.ajType || 'Other'}</span></td>
                    <td>{t.description}</td>
                    <td className="text-muted">{t.department || '—'}</td>
                    <td className="text-right">{fmt(t.entries.reduce((s, e) => s + (e.debit  || 0), 0))}</td>
                    <td className="text-right">{fmt(t.entries.reduce((s, e) => s + (e.credit || 0), 0))}</td>
                    <td>
                      <button className="btn btn-danger btn-xs" onClick={() => {
                        if (confirm('Delete this adjusting entry? Account balances will be reversed.'))
                          deleteTransaction(t.id)
                      }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="New Adjusting Entry"
        size="modal-lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={!balanced && form.entries.some(e => e.accountId)}
            >
              Post Adjusting Entry
            </button>
          </>
        }
      >
        {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}

        <div className="grid-3">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Reference #</label>
            <input className="form-input" value={form.ref} onChange={e => setField('ref', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Adjusting Entry Type</label>
            <select className="form-select" value={form.ajType} onChange={e => setField('ajType', e.target.value)}>
              {AJE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="e.g. Accrued salaries for December" />
          </div>
          <div className="form-group">
            <label className="form-label">Department</label>
            <select className="form-select" value={form.department} onChange={e => setField('department', e.target.value)}>
              <option value="">— Optional —</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
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
        <button className="btn btn-secondary btn-sm" onClick={addEntry}>+ Add Line</button>

        <div style={{ marginTop: 12, fontSize: 13, padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: balanced ? 'var(--pos-bg)' : 'var(--neg-bg)', color: balanced ? 'var(--pos)' : 'var(--neg)' }}>
          Debits: <strong>{fmt(totalDebit)}</strong> &nbsp;|&nbsp; Credits: <strong>{fmt(totalCredit)}</strong>
          &nbsp; {balanced ? 'Balanced' : 'Not balanced'}
        </div>
      </Modal>
    </div>
  )
}
