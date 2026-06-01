import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { fmt, today } from '../utils/format'
import { PAYMENT_METHODS } from '../data/defaults'
import Modal from './ui/Modal'
import ImportModal from './import/ImportModal'

const BLANK = { date: today(), amount: '', vendor: '', accountId: '', method: 'Cash', description: '' }

export default function Expenses() {
  const { data, addExpense, deleteExpense, importExpenses, accName } = useApp()
  const [modal, setModal]     = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm]       = useState(BLANK)
  const [err, setErr]         = useState('')

  const expenseAccounts = data.accounts.filter(a => a.type === 'Expense')
  const openNew = () => {
    setForm({ ...BLANK, date: today(), accountId: expenseAccounts[0]?.id || '' })
    setErr(''); setModal(true)
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const save = () => {
    if (!form.date)    return setErr('Date is required.')
    if (!form.vendor)  return setErr('Vendor is required.')
    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) return setErr('Enter a valid amount.')
    addExpense({ ...form, amount })
    setModal(false)
  }

  const total = data.expenses.reduce((s, e) => s + e.amount, 0)
  const thisMonth = today().slice(0, 7)
  const monthTotal = data.expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0)

  return (
    <div>
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-title">Total Expenses</div><div className="card-value red">{fmt(total)}</div></div>
        <div className="card"><div className="card-title">This Month</div><div className="card-value red">{fmt(monthTotal)}</div></div>
        <div className="card"><div className="card-title">Count</div><div className="card-value">{data.expenses.length}</div></div>
        <div className="card"><div className="card-title">Avg Expense</div><div className="card-value">{data.expenses.length ? fmt(total / data.expenses.length) : '$0.00'}</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>⬆️ Import Excel</button>
        <button className="btn btn-primary" onClick={openNew}>+ Record Expense</button>
      </div>

      <div className="card">
        {data.expenses.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon">💳</div>
              <p>No expenses recorded yet.</p>
              <button className="btn btn-primary" onClick={openNew}>+ Record Expense</button>
            </div>
          )
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Ref #</th><th>Vendor</th><th>Category</th>
                    <th>Method</th><th>Description</th><th className="text-right">Amount</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.expenses].reverse().map(e => (
                    <tr key={e.id}>
                      <td className="text-muted">{e.date}</td>
                      <td className="text-muted">{e.number}</td>
                      <td><strong>{e.vendor}</strong></td>
                      <td><span className="badge badge-yellow">{accName(e.accountId)}</span></td>
                      <td className="text-muted">{e.method}</td>
                      <td className="text-muted">{e.description || '—'}</td>
                      <td className="text-right amount-neg"><strong>{fmt(e.amount)}</strong></td>
                      <td>
                        <button className="btn btn-danger btn-xs" onClick={() => { if (confirm('Delete expense?')) deleteExpense(e.id) }}>Delete</button>
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
            <label className="form-label">Amount ($)</label>
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
        <div className="form-group">
          <label className="form-label">Category (Account)</label>
          <select className="form-select" value={form.accountId} onChange={e => setField('accountId', e.target.value)}>
            {expenseAccounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
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
    </div>
  )
}
