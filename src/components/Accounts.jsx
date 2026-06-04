import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { fmt, typeBadge, uid } from '../utils/format'
import { ACCOUNT_TYPES } from '../data/defaults'
import Modal from './ui/Modal'
import ImportModal from './import/ImportModal'
import DeleteAllModal from './ui/DeleteAllModal'
import { Trash2, Upload } from 'lucide-react'

const BLANK = { code: '', name: '', type: 'Asset', balance: 0 }

export default function Accounts() {
  const { data, addAccount, updateAccount, deleteAccount, importAccounts, clearAccounts } = useApp()
  const { isAdmin } = useAuth()
  const [modal, setModal]         = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [form, setForm]           = useState(BLANK)
  const [err, setErr]             = useState('')

  const openNew = () => { setEditing(null); setForm(BLANK); setErr(''); setModal(true) }
  const openEdit = (acc) => { setEditing(acc.id); setForm({ code: acc.code, name: acc.name, type: acc.type, balance: acc.balance }); setErr(''); setModal(true) }

  const save = () => {
    if (!form.code.trim()) return setErr('Account code is required.')
    if (!form.name.trim()) return setErr('Account name is required.')
    if (editing) {
      updateAccount(editing, { ...form, balance: parseFloat(form.balance) || 0 })
    } else {
      addAccount({ ...form, balance: parseFloat(form.balance) || 0 })
    }
    setModal(false)
  }

  const del = (id) => {
    if (!confirm('Delete this account?')) return
    deleteAccount(id)
  }

  const TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20 }}>
        {isAdmin && (
          <button className="btn btn-danger" onClick={() => setDeleteAllOpen(true)}><Trash2 size={13} /> Delete All</button>
        )}
        <button className="btn btn-secondary" onClick={() => setImportOpen(true)}><Upload size={13} /> Import Excel</button>
        <button className="btn btn-primary" onClick={openNew}>+ New Account</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Account Name</th><th>Type</th>
                <th className="text-right">Balance</th><th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {TYPES.map(type => {
                const accs = data.accounts.filter(a => a.type === type).sort((a, b) => a.code.localeCompare(b.code))
                if (!accs.length) return null
                return (
                  <React.Fragment key={type}>
                    <tr className="acc-type-header"><td colSpan={5}>{type}s</td></tr>
                    {accs.map(a => (
                      <tr key={a.id}>
                        <td className="text-muted">{a.code}</td>
                        <td><strong>{a.name}</strong></td>
                        <td><span className={`badge ${typeBadge(a.type)}`}>{a.type}</span></td>
                        <td className="text-right">{fmt(a.balance)}</td>
                        <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(a)}>Edit</button>{' '}
                          <button className="btn btn-danger btn-sm" onClick={() => del(a.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? 'Edit Account' : 'New Account'}
        size="modal-sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save Account</button>
          </>
        }
      >
        {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}
        <div className="form-group">
          <label className="form-label">Account Number</label>
          <input className="form-input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="e.g. 1050" />
        </div>
        <div className="form-group">
          <label className="form-label">Account Name</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Petty Cash" />
        </div>
        <div className="form-group">
          <label className="form-label">Account Type</label>
          <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Opening Balance (₱)</label>
          <input className="form-input" type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
        </div>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type="accounts"
        onImport={importAccounts}
      />

      {/* Delete All Modal */}
      <DeleteAllModal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={clearAccounts}
        label="Chart of Accounts"
      />
    </div>
  )
}
