import React, { useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import Modal from '../ui/Modal'
import { Eye, EyeOff, ShieldCheck, User, KeyRound } from 'lucide-react'

const BLANK = { username: '', password: '', role: 'user' }

export default function UserManagement() {
  const { users, currentUser, addUser, deleteUser, changePassword, isAdmin } = useAuth()
  const [modal,    setModal]    = useState(false)
  const [pwModal,  setPwModal]  = useState(null)  // user id
  const [form,     setForm]     = useState(BLANK)
  const [newPw,    setNewPw]    = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [err,      setErr]      = useState('')
  const [success,  setSuccess]  = useState('')

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = async () => {
    setErr('')
    const res = await addUser(form.username, form.password, form.role)
    if (res.error) return setErr(res.error)
    setSuccess(`User "${form.username}" created.`)
    setForm(BLANK)
    setModal(false)
    setTimeout(() => setSuccess(''), 3000)
  }

  const handleDelete = async (user) => {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return
    const res = deleteUser(user.id)
    if (res.error) alert(res.error)
  }

  const handleChangePw = async () => {
    setErr('')
    const res = await changePassword(pwModal, newPw)
    if (res.error) return setErr(res.error)
    setSuccess('Password updated.')
    setNewPw(''); setPwModal(null)
    setTimeout(() => setSuccess(''), 3000)
  }

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 500 }}>
        <div className="empty">
          <div className="empty-icon"><ShieldCheck size={32} /></div>
          <p>Only admins can manage users.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {success && (
        <div style={{ background: '#f0f0f0', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 16px', marginBottom: 18, color: '#374151', fontWeight: 500, fontSize: 13 }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => { setForm(BLANK); setErr(''); setModal(true) }}>+ Add User</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map(user => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.username}</strong>
                    {user.username === currentUser?.username && (
                      <span className="badge badge-green" style={{ marginLeft: 8 }}>You</span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${user.role === 'admin' ? 'badge-blue' : 'badge-gray'}`}>
                      {user.role === 'admin' ? <><ShieldCheck size={11} /> Admin</> : <><User size={11} /> Member</>}
                    </span>
                  </td>
                  <td className="text-muted text-sm">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-PH') : '—'}
                  </td>
                  <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setNewPw(''); setErr(''); setShowPw(false); setPwModal(user.id) }}
                    >
                      <KeyRound size={12} /> Change Password
                    </button>{' '}
                    {user.username !== currentUser?.username && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(user)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Add New User"
        size="modal-sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd}>Create User</button>
          </>
        }
      >
        {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}
        <div className="form-group">
          <label className="form-label">Username</label>
          <input className="form-input" value={form.username} onChange={e => setField('username', e.target.value)} placeholder="e.g. juan.dela.cruz" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">Password</label>
          <input className="form-input" type="password" value={form.password} onChange={e => setField('password', e.target.value)} placeholder="Minimum 6 characters" />
        </div>
        <div className="form-group">
          <label className="form-label">Role</label>
          <select className="form-select" value={form.role} onChange={e => setField('role', e.target.value)}>
            <option value="user">User — can view and edit records</option>
            <option value="admin">Admin — can also manage users</option>
          </select>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        open={!!pwModal}
        onClose={() => setPwModal(null)}
        title={`Change Password — ${users?.find(u => u.id === pwModal)?.username || ''}`}
        size="modal-sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPwModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleChangePw}>Update Password</button>
          </>
        }
      >
        {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}
        <div className="form-group">
          <label className="form-label">New Password</label>
          <div style={{ position: 'relative' }}>
            <input
              className="form-input"
              type={showPw ? 'text' : 'password'}
              value={newPw}
              onChange={e => { setNewPw(e.target.value); setErr('') }}
              placeholder="Minimum 6 characters"
              style={{ paddingRight: 40 }}
              autoFocus
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
