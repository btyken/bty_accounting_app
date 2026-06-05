import React, { useState, useMemo, useEffect } from 'react'
import { useApp } from '../store/AppContext'
import { useAuth } from '../store/AuthContext'
import { fmt, today, uid, statusBadge } from '../utils/format'
import { generateInvoiceHTML, printInvoice } from '../utils/invoicePrint'
import Modal from './ui/Modal'
import ImportModal from './import/ImportModal'
import DeleteAllModal from './ui/DeleteAllModal'
import { Trash2, Upload, Printer, FileText, X } from 'lucide-react'

const BLANK_ITEM = () => ({ id: uid(), skuCode: '', description: '', qty: 1, rate: 0, amount: 0 })

function newForm(nextNum) {
  const due = new Date(); due.setDate(due.getDate() + 30)
  return {
    number:        nextNum,
    customer:      '',
    billToAddress: '',
    shipToName:    '',
    shipToAddress: '',
    salesPerson:   '',
    terms:         '',
    shipVia:       '',
    customerNo:    '',
    shippingCost:  0,
    date:          today(),
    dueDate:       due.toISOString().split('T')[0],
    notes:         '',
    status:        'draft',
    lineItems:     [BLANK_ITEM()],
  }
}

const TABS = ['all', 'draft', 'sent', 'paid', 'overdue']

export default function Invoices() {
  const { data, addInvoice, updateInvoice, deleteInvoice, importInvoices, nextInvoiceNum, clearInvoices } = useApp()
  const { isAdmin } = useAuth()
  const [tab, setTab]           = useState('all')
  const [modal, setModal]       = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [form, setForm]         = useState(() => newForm('INV-0001'))
  const [err, setErr]           = useState('')
  const [saving, setSaving]     = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [viewInv, setViewInv]   = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(''), 4000)
    return () => clearTimeout(t)
  }, [successMsg])

  const customerHistory = useMemo(() => {
    const seen = new Map()
    ;[...data.invoices].reverse().forEach(inv => {
      if (!inv.customer) return
      const key = inv.customer.toLowerCase()
      if (!seen.has(key)) {
        seen.set(key, {
          customer:      inv.customer,
          billToAddress: inv.billToAddress || '',
          shipToName:    inv.shipToName    || '',
          shipToAddress: inv.shipToAddress || '',
          customerNo:    inv.customerNo    || '',
          terms:         inv.terms         || '',
        })
      }
    })
    return [...seen.values()]
  }, [data.invoices])

  const openNew = () => { setForm(newForm(nextInvoiceNum())); setErr(''); setModal(true) }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const updateItem = (id, key, val) => {
    setForm(f => ({
      ...f,
      lineItems: f.lineItems.map(item => {
        if (item.id !== id) return item
        const next = { ...item, [key]: val }
        next.amount = (parseFloat(next.qty) || 0) * (parseFloat(next.rate) || 0)
        return next
      }),
    }))
  }
  const addItem    = () => setForm(f => ({ ...f, lineItems: [...f.lineItems, BLANK_ITEM()] }))
  const removeItem = (id) => setForm(f => ({ ...f, lineItems: f.lineItems.filter(i => i.id !== id) }))

  const subtotal  = form.lineItems.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.rate) || 0), 0)
  const shipping  = parseFloat(form.shippingCost) || 0
  const grandTotal = subtotal + shipping

  const save = async () => {
    if (!form.customer.trim()) return setErr('Customer name is required.')
    if (!form.date)             return setErr('Invoice date is required.')
    const lineItems = form.lineItems.filter(i => i.description || i.rate || i.skuCode)
    if (!lineItems.length)      return setErr('Add at least one line item.')
    setSaving(true)
    await new Promise(r => setTimeout(r, 700))
    addInvoice({ ...form, lineItems, total: grandTotal })
    setSaving(false)
    setModal(false)
    setSuccessMsg(`Invoice ${form.number} created successfully!`)
  }

  const filtered = tab === 'all' ? data.invoices : data.invoices.filter(i => i.status === tab)

  return (
    <div>
      {successMsg && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 9999,
          background: '#16a34a', color: '#fff', borderRadius: 8,
          padding: '12px 20px', fontWeight: 600, fontSize: 14,
          boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>✓</span> {successMsg}
        </div>
      )}
      <div className="tabs">
        {TABS.map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}{' '}
            ({t === 'all' ? data.invoices.length : data.invoices.filter(i => i.status === t).length})
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
        {isAdmin && (
          <button className="btn btn-danger" onClick={() => setDeleteAllOpen(true)}><Trash2 size={13} /> Delete All</button>
        )}
        <button className="btn btn-secondary" onClick={() => setImportOpen(true)}><Upload size={13} /> Import Excel</button>
        <button className="btn btn-primary" onClick={openNew}>+ New Invoice</button>
      </div>

      <div className="card">
        {filtered.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon"><FileText size={32} /></div>
              <p>No invoices found.</p>
              <button className="btn btn-primary" onClick={openNew}>+ Create Invoice</button>
            </div>
          )
          : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Invoice #</th><th>Customer</th><th>Date</th>
                    <th>Due Date</th><th className="text-right">Amount</th>
                    <th>Status</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered].reverse().map(inv => (
                    <tr key={inv.id}>
                      <td><strong>{inv.number}</strong></td>
                      <td>{inv.customer}</td>
                      <td className="text-muted">{inv.date}</td>
                      <td className="text-muted">{inv.dueDate || '—'}</td>
                      <td className="text-right"><strong>{fmt(inv.total)}</strong></td>
                      <td><span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span></td>
                      <td className="text-right" style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => setViewInv(inv)}>View</button>{' '}
                        {inv.status !== 'paid' && (
                          <>
                            <button className="btn btn-secondary btn-xs" onClick={() => updateInvoice(inv.id, { status: 'sent' })}>Send</button>{' '}
                            <button className="btn btn-primary btn-xs" onClick={() => updateInvoice(inv.id, { status: 'paid' })}>Mark Paid</button>{' '}
                          </>
                        )}
                        {inv.status === 'paid' && (
                          <button className="btn btn-warning btn-xs" onClick={() => { if (confirm('Revert to draft? This will reverse the cash and revenue entries.')) updateInvoice(inv.id, { status: 'draft' }) }}>Revert</button>
                        )}{' '}
                        <button className="btn btn-danger btn-xs" onClick={() => { if (confirm('Delete invoice?')) deleteInvoice(inv.id) }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      {/* View Invoice Modal */}
      {viewInv && (
        <Modal
          open={!!viewInv}
          onClose={() => setViewInv(null)}
          title={`Sales Order — ${viewInv.number}`}
          size="modal-xl"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setViewInv(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => printInvoice(viewInv)}>
                <Printer size={13} /> Print / Download PDF
              </button>
            </>
          }
        >
          <iframe
            srcDoc={generateInvoiceHTML(viewInv)}
            style={{ width: '100%', height: 560, border: '1px solid #e5e7eb', borderRadius: 4 }}
            title="Invoice Preview"
          />
        </Modal>
      )}

      {/* New Invoice Modal */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="New Invoice"
        size="modal-xl"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setModal(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ minWidth: 140 }}>
              {saving ? 'Creating invoice…' : 'Save Invoice'}
            </button>
          </>
        }
      >
        {err && <div className="form-error" style={{ marginBottom: 12 }}>{err}</div>}

        {/* Order Info */}
        <div className="grid-3" style={{ marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Invoice Date</label>
            <input className="form-input" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Customer No.</label>
            <input className="form-input" value={form.customerNo} onChange={e => setField('customerNo', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        {/* Bill To / Ship To */}
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">Bill To Name *</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  value={form.customer}
                  onChange={e => { setField('customer', e.target.value); setShowHistory(true) }}
                  onFocus={() => setShowHistory(true)}
                  onBlur={() => setTimeout(() => setShowHistory(false), 150)}
                  placeholder="Customer / Company"
                />
                {showHistory && (() => {
                  const matches = customerHistory.filter(c =>
                    !form.customer.trim() || c.customer.toLowerCase().includes(form.customer.toLowerCase())
                  )
                  return matches.length > 0 ? (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
                      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
                    }}>
                      <div style={{ padding: '6px 12px 4px', fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f3f4f6' }}>
                        Recent Customers
                      </div>
                      {matches.map(c => (
                        <div
                          key={c.customer}
                          onMouseDown={() => {
                            setForm(f => ({ ...f, ...c }))
                            setShowHistory(false)
                          }}
                          style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f9fafb' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                          onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{c.customer}</div>
                          {c.billToAddress && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }}>
                              {c.billToAddress.split('\n')[0]}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Bill To Address</label>
              <textarea className="form-textarea" style={{ minHeight: 72 }} value={form.billToAddress} onChange={e => setField('billToAddress', e.target.value)} placeholder="Street, City, Province, Country&#10;Phone" />
            </div>
          </div>
          <div>
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label">Ship To Name</label>
              <input className="form-input" value={form.shipToName} onChange={e => setField('shipToName', e.target.value)} placeholder="If different from Bill To" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ship To Address</label>
              <textarea className="form-textarea" style={{ minHeight: 72 }} value={form.shipToAddress} onChange={e => setField('shipToAddress', e.target.value)} placeholder="Street, City, Province, Country&#10;Phone" />
            </div>
          </div>
        </div>

        {/* Order details row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sales Person</label>
            <input className="form-input" value={form.salesPerson} onChange={e => setField('salesPerson', e.target.value)} placeholder="Name" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Terms</label>
            <input className="form-input" value={form.terms} onChange={e => setField('terms', e.target.value)} placeholder="e.g. Net 30" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ship Via</label>
            <input className="form-input" value={form.shipVia} onChange={e => setField('shipVia', e.target.value)} placeholder="Courier / Carrier" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Shipping Cost (₱)</label>
            <input className="form-input" type="number" min="0" step="0.01" value={form.shippingCost} onChange={e => setField('shippingCost', e.target.value)} />
          </div>
        </div>

        {/* Line Items */}
        <div className="form-group">
          <label className="form-label">Line Items</label>
          <table className="line-items">
            <thead>
              <tr>
                <th style={{ width: '14%' }}>SKU Code</th>
                <th style={{ width: '37%' }}>Description</th>
                <th style={{ width: '11%' }}>Qty</th>
                <th style={{ width: '16%' }}>Rate (₱)</th>
                <th style={{ width: '16%' }}>Amount</th>
                <th style={{ width: '6%' }}></th>
              </tr>
            </thead>
            <tbody>
              {form.lineItems.map(item => (
                <tr key={item.id}>
                  <td><input className="form-input" value={item.skuCode} onChange={e => updateItem(item.id, 'skuCode', e.target.value)} placeholder="SKU" /></td>
                  <td><input className="form-input" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Description" /></td>
                  <td><input className="form-input" type="number" value={item.qty} min="0" onChange={e => updateItem(item.id, 'qty', e.target.value)} /></td>
                  <td><input className="form-input" type="number" value={item.rate} min="0" step="0.01" onChange={e => updateItem(item.id, 'rate', e.target.value)} /></td>
                  <td style={{ fontWeight: 600 }}>{fmt((parseFloat(item.qty)||0)*(parseFloat(item.rate)||0))}</td>
                  <td><button className="del-btn" onClick={() => removeItem(item.id)}><X size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Line</button>
        </div>

        <div className="invoice-totals">
          <table>
            <tbody>
              <tr><td className="text-muted">Subtotal:</td><td className="text-right">{fmt(subtotal)}</td></tr>
              <tr><td className="text-muted">Shipping:</td><td className="text-right">{fmt(shipping)}</td></tr>
              <tr className="total-row"><td>Total:</td><td className="text-right">{fmt(grandTotal)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Method of Payment / Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="e.g. BANK REMITTANCE — shown on the invoice footer" />
        </div>
      </Modal>

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        type="invoices"
        onImport={importInvoices}
      />

      {/* Delete All Modal */}
      <DeleteAllModal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        onConfirm={clearInvoices}
        label="Invoices"
      />
    </div>
  )
}
