import React, { useState, useEffect } from 'react'
import Modal from './Modal'

export default function DeleteAllModal({ open, onClose, onConfirm, label }) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (!open) setText('')
  }, [open])

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Delete All ${label}`}
      size="modal-sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger"
            disabled={text.toLowerCase() !== 'delete'}
            onClick={handleConfirm}
          >
            Delete All
          </button>
        </>
      }
    >
      <div style={{
        marginBottom: 16, padding: '12px 14px',
        background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: 8, color: '#991b1b', fontSize: 13,
      }}>
        ⚠️ This will permanently delete <strong>all {label.toLowerCase()}</strong> and cannot be undone.
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">
          Type <strong style={{ color: 'var(--red)' }}>delete</strong> to confirm
        </label>
        <input
          className="form-input"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="delete"
          autoFocus
          onKeyDown={e => e.key === 'Enter' && text.toLowerCase() === 'delete' && handleConfirm()}
        />
      </div>
    </Modal>
  )
}
