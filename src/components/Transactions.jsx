import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { fmt, today, uid, pad, getDateRange } from '../utils/format'
import { DEPARTMENTS } from '../data/defaults'
import Modal from './ui/Modal'
import ImportModal from './import/ImportModal'
import DeleteAllModal from './ui/DeleteAllModal'
import { Trash2, Upload, ArrowLeftRight, Search, X } from 'lucide-react'

const BLANK_ENTRY = () => ({ id: uid(), accountId: '', debit: '', credit: '' })

const PERIODS = [
  { id: 'all',       label: 'All' },
  { id: 'weekly',    label: 'This Week' },
  { id: 'monthly',   label: 'This Month' },
  { id: 'quarterly', label: 'This Quarter' },
  { id: 'annually',  label: 'This Year' },
  { id: 'custom',    label: 'Custom Range' },
]

export default function Transactions() {
  const { data, addTransaction, updateTransactionMeta, deleteTransaction, importTransactions, clearTransactions } = useApp()
  const { isAdmin } = useAuth()
  const [modal, setModal]     = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [form, setForm]       = useState({ date: today(), ref: '', description: '', department: '', entries: [BLANK_ENTRY(), BLANK_ENTRY()] })
  const [err, setErr]         = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [period, setPeriod]   = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  const openNew = () => {
    setForm({
      date: today(),
      ref: 'JE-' + pad(data.transactions.length + 1),
      description: '',
      department: '',
      entries: [BLANK_ENTRY(), BLANK_ENTRY()],
    })
    setErr(''); setModal(true)
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const updateEntry = (id, key, val) =>
    setForm(f => ({ ...f, entries: f.entries.map(e => e.id === id ? { ...e, [key]: val } : e) }))
  const addEntry    = () => setForm(f => ({ ...f, entries: [...f.entries, BLANK_ENTRY()] }))
  const removeEntry = (id) => setForm(f => ({ ...f, entries: f.entries.filter(e => e.id !== id) }))

  const totalDebit  = form.entries.reduce((s, e) => s + (parseFloat(e.debit) || 0), 0)
  const totalCredit = form.entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
  const balanced    = Math.abs(totalDebit - totalCredit) < 0.01

  const save = () => {
    if (!form.date)        return setErr('Date is required.')
    if (!form.ref.trim())  return setErr('Reference is required.')
    if (!form.description.trim()) return setErr('Description is required.')
    const entries = form.entries.filter(e => e.accountId && (parseFloat(e.debit) || parseFloat(e.credit)))
    if (entries.length < 2) return setErr('At least two entries required.')
    if (!balanced)          return setErr('Debits must equal credits.')
    addTransaction({ id: uid(), date: form.date, ref: form.ref, description: form.description, department: form.department, entries: entries.map(e => ({ accountId: e.accountId, debit: parseFloat(e.debit)||0, credit: parseFloat(e.credit)||0 })) })
    setModal(false)
  }

  const accountOptions = () => {
    const types = ['Asset','Liability','Equity','Revenue','Expense']
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

  const activeRange = period === 'custom'
    ? (dateFrom && dateTo ? [dateFrom, dateTo] : null)
    : getDateRange(period)
  const inDateRange = (date) => !activeRange || (date >= activeRange[0] && date <= activeRange[1])

  const visibleTransactions = [...data.transactions]
    .reverse()
    .filter(t =>
      (!deptFilter || (t.department || '') === deptFilter) &&
      inDateRange(t.date)
    )

  return (
    <div>
      {/* Filter bar */}
      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {/* Period buttons */}
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
          {/* Department + actions */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              style={{ width: 'auto', minWidth: 200 }}
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {isAdmin && (
              <button className="btn btn-danger" onClick={() => setDeleteAllOpen(true)}><Trash2 size={13} /> Delete All</button>
            )}
            <button className="btn btn-secondary" onClick={() => setImportOpen(true)}><Upload size={13} /> Import Excel</button>
            <button className="btn btn-primary" onClick={openNew}>+ Journal Entry</button>
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
        {period !== 'all' && period !== 'custom' && activeRange && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>
            Showing: <strong>{activeRange[0]}</strong> — <strong>{activeRange[1]}</strong>
            &nbsp;·&nbsp; {visibleTransactions.length} result{visibleTransactions.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      <div className="card">
        {data.transactions.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon"><ArrowLeftRight size={32} /></div>
              <p>No journal entries yet.</p>
              <button className="btn btn-primary" onClick={openNew}>+ New Journal Entry</button>
            </div>
          )
          : visibleTransactions.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon"><Search size={32} /></div>
              <p>No journal entries match the selected filters.</p>
            </div>
          )
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Reference</th><th>Description</th><th>Department</th>
                    <th className="text-right">Debit</th><th className="text-right">Credit</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTransactions.map(t => (
                    <tr key={t.id}>
                      <td className="text-muted">{t.date}</td>
                      <td><strong>{t.ref}</strong></td>
                      <td>{t.description}</td>
                      <td>
                        <select
                          className="form-select"
                          style={{ fontSize: 12, padding: '3px 6px', minWidth: 160 }}
                          value={t.department || ''}
                          onChange={e => updateTransactionMeta(t.id, { department: e.target.value })}
                        >
                          <option value="">— None —</option>
                          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </td>
                      <td className="text-right">{fmt(t.entries.reduce((s,e)=>s+(e.debit||0),0))}</td>
                      <td className="text-right">{fmt(t.entries.reduce((s,e)=>s+(e.credit||0),0))}</td>
                      <td>
                        <button className="btn btn-danger btn-xs" onClick={() => { if (confirm('Delete this journal entry? Account balances will be reversed.')) deleteTransaction(t.id) }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* Journal Entry Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="New Journal Entry"
        size="modal-lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={!balanced && form.entries.some(e=>e.accountId)}>Post Entry</button>
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
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={e => setField('description', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Department</label>
          <select className="form-select" value={form.department} onChange={e => setField('department', e.target.value)}>
            <option value="">— Select Department (optional) —</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
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

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type="transactions"
        onImport={importTransactions}
      />

      {/* Delete All Modal */}
      <DeleteAllModal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={clearTransactions}
        label="Transactions"
      />
    </div>
  )
}
