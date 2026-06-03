import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { fmt, today, getDateRange } from '../utils/format'
import { PAYMENT_METHODS, DEPARTMENTS } from '../data/defaults'
import Modal from './ui/Modal'
import ImportModal from './import/ImportModal'
import DeleteAllModal from './ui/DeleteAllModal'

const BLANK = { date: today(), amount: '', vendor: '', accountId: '', method: 'Cash', description: '', department: '' }

const PERIODS = [
  { id: 'all',       label: 'All' },
  { id: 'weekly',    label: 'This Week' },
  { id: 'monthly',   label: 'This Month' },
  { id: 'quarterly', label: 'This Quarter' },
  { id: 'annually',  label: 'This Year' },
]

export default function Expenses() {
  const { data, addExpense, updateExpenseMeta, deleteExpense, importExpenses, updateTransactionMeta, accName, clearExpenses } = useApp()
  const { isAdmin } = useAuth()
  const [modal, setModal]         = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [form, setForm]           = useState(BLANK)
  const [err, setErr]             = useState('')
  const [period, setPeriod]       = useState('all')
  const [deptFilter, setDeptFilter] = useState('')
  const [view, setView]           = useState('all')  // 'all' | 'direct' | 'journal'

  const expenseAccounts = data.accounts.filter(a => a.type === 'Expense')

  const openNew = () => {
    setForm({ ...BLANK, date: today(), accountId: expenseAccounts[0]?.id || '' })
    setErr(''); setModal(true)
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.date)   return setErr('Date is required.')
    if (!form.vendor) return setErr('Vendor is required.')
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return setErr('Enter a valid amount.')
    addExpense({ ...form, amount })
    setModal(false)
  }

  // Date range filter
  const range = getDateRange(period)
  const inRange = (date) => !range || (date >= range[0] && date <= range[1])

  const matchesDept = (dept) => !deptFilter || (dept || '') === deptFilter

  // Direct expenses filtered by period + department
  const filteredExpenses = data.expenses.filter(e => inRange(e.date) && matchesDept(e.department))

  // ALL journal entries as rows — one per transaction, regardless of account type
  const journalRows = (data.transactions || [])
    .filter(txn => inRange(txn.date) && matchesDept(txn.department))
    .map(txn => ({
      id: txn.id,
      txnId: txn.id,
      date: txn.date,
      ref: txn.ref,
      vendor: txn.description,
      department: txn.department || '',
      amount: txn.entries.reduce((s, e) => s + (e.debit || 0), 0),
      accounts: txn.entries
        .map(e => data.accounts.find(a => a.id === e.accountId)?.name)
        .filter(Boolean)
        .join(', '),
      isJournal: true,
    }))

  const viewData =
    view === 'direct'  ? filteredExpenses :
    view === 'journal' ? journalRows :
    [...filteredExpenses, ...journalRows].sort((a, b) => b.date.localeCompare(a.date))

  const total = viewData.reduce((s, e) => s + e.amount, 0)
  const count = viewData.length
  const avg   = count ? total / count : 0

  const thisMonth  = today().slice(0, 7)
  const monthTotal = [
    ...data.expenses.filter(e => e.date.startsWith(thisMonth)),
    ...(data.transactions || []).filter(t => t.date.startsWith(thisMonth))
      .map(t => ({ amount: t.entries.reduce((s, e) => s + (e.debit || 0), 0) })),
  ].reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-title">Total Expenses</div><div className="card-value red">{fmt(total)}</div></div>
        <div className="card"><div className="card-title">This Month</div><div className="card-value red">{fmt(monthTotal)}</div></div>
        <div className="card"><div className="card-title">Count</div><div className="card-value">{count}</div></div>
        <div className="card"><div className="card-title">Avg Expense</div><div className="card-value">{count ? fmt(avg) : '₱0.00'}</div></div>
      </div>

      {/* Period filter + department filter + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
          <select
            className="form-select"
            style={{ width: 'auto', minWidth: 180 }}
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {isAdmin && (
            <button className="btn btn-danger" onClick={() => setDeleteAllOpen(true)}>🗑 Delete All</button>
          )}
          <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>⬆️ Import Excel</button>
          <button className="btn btn-primary" onClick={openNew}>+ Record Expense</button>
        </div>
      </div>

      {/* Source tabs */}
      <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
        {[
          { id: 'all',     label: `All (${filteredExpenses.length + journalRows.length})` },
          { id: 'direct',  label: `Direct Expenses (${filteredExpenses.length})` },
          { id: 'journal', label: `Journal Entries (${journalRows.length})` },
        ].map(t => (
          <div key={t.id} className={`tab${view === t.id ? ' active' : ''}`} onClick={() => setView(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Expenses table */}
      <div className="card" style={{ borderTopLeftRadius: 0 }}>
        {viewData.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon">💳</div>
              <p>{view === 'journal' ? 'No journal entries for this period.' : 'No expenses recorded for this period.'}</p>
              {view !== 'journal' && <button className="btn btn-primary" onClick={openNew}>+ Record Expense</button>}
            </div>
          )
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Ref #</th><th>Vendor / Description</th>
                    <th>{view === 'journal' ? 'Accounts' : 'Category'}</th>
                    <th>Department</th><th>Source</th>
                    {view !== 'journal' && <th>Method</th>}
                    <th className="text-right">Amount</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {viewData.map(e => (
                    <tr key={e.id}>
                      <td className="text-muted">{e.date}</td>
                      <td className="text-muted">{e.number || e.ref || '—'}</td>
                      <td><strong>{e.vendor}</strong></td>
                      <td>
                        {e.isJournal
                          ? <span className="text-muted text-sm">{e.accounts || '—'}</span>
                          : <span className="badge badge-yellow">{accName(e.accountId)}</span>
                        }
                      </td>
                      <td>
                        {e.isJournal ? (
                          <select
                            className="form-select"
                            style={{ fontSize: 12, padding: '3px 6px', minWidth: 160 }}
                            value={e.department || ''}
                            onChange={ev => updateTransactionMeta(e.txnId, { department: ev.target.value })}
                          >
                            <option value="">— None —</option>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        ) : (
                          <select
                            className="form-select"
                            style={{ fontSize: 12, padding: '3px 6px', minWidth: 160 }}
                            value={e.department || ''}
                            onChange={ev => updateExpenseMeta(e.id, { department: ev.target.value })}
                          >
                            <option value="">— None —</option>
                            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        )}
                      </td>
                      <td>
                        {e.isJournal
                          ? <span className="badge badge-blue">Journal Entry</span>
                          : <span className="badge badge-gray">Direct</span>
                        }
                      </td>
                      {view !== 'journal' && <td className="text-muted">{e.isJournal ? '—' : e.method}</td>}
                      <td className="text-right amount-neg"><strong>{fmt(e.amount)}</strong></td>
                      <td>
                        {!e.isJournal && (
                          <button className="btn btn-danger btn-xs" onClick={() => { if (confirm('Delete expense?')) deleteExpense(e.id) }}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* New Expense Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Record Expense"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save Expense</button>
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
            <label className="form-label">Vendor / Payee</label>
            <input className="form-input" value={form.vendor} onChange={e => setField('vendor', e.target.value)} placeholder="Vendor name" />
          </div>
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="form-select" value={form.method} onChange={e => setField('method', e.target.value)}>
              {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Category (Account)</label>
            <select className="form-select" value={form.accountId} onChange={e => setField('accountId', e.target.value)}>
              {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
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
          <label className="form-label">Description</label>
          <textarea className="form-textarea" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="What was this expense for?" />
        </div>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type="expenses"
        onImport={importExpenses}
      />

      {/* Delete All Modal */}
      <DeleteAllModal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={clearExpenses}
        label="Expenses"
      />
    </div>
  )
}
