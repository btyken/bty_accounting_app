import React, { useState } from 'react'
import { useApp } from '../store/AppContext'
import { fmt, today, uid, statusBadge } from '../utils/format'
import { generateInvoiceHTML, printInvoice } from '../utils/invoicePrint'
import Modal from './ui/Modal'
import ImportModal from './import/ImportModal'

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
  const { data, addInvoice, updateInvoice, deleteInvoice, importInvoices, nextInvoiceNum } = useApp()
  const [tab, setTab]           = useState('all')
  const [modal, setModal]       = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [form, setForm]         = useState(() => newForm('INV-0001'))
  const [err, setErr]           = useState('')
  const [viewInv, setViewInv]   = useState(null)

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

  const save = () => {
    if (!form.customer.trim()) return setErr('Customer name is required.')
    if (!form.date)             return setErr('Invoice date is required.')
    const lineItems = form.lineItems.filter(i => i.description || i.rate || i.skuCode)
    if (!lineItems.length)      return setErr('Add at least one line item.')
    addInvoice({ ...form, lineItems, total: grandTotal })
    setModal(false)
  }

  const filtered = tab === 'all' ? data.invoices : data.invoices.filter(i => i.status === tab)

  return (
    <div>
      <div className="tabs">
        {TABS.map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}{' '}
            ({t === 'all' ? data.invoices.length : data.invoices.filter(i => i.status === t).length})
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>⬆️ Import Excel</button>
        <button className="btn btn-primary" onClick={openNew}>+ New Invoice</button>
      </div>

      <div className="card">
        {filtered.length === 0
          ? (
            <div className="empty">
              <div className="empty-icon">🧾</div>
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
                🖨️ Print / Download PDF
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
            <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={save}>Save Invoice</button>
          </>
        }
      >
        {err && <div className="form-error" style={{ marginBottom: 12 }}>⚠️ {err}</div>}

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
              <input className="form-input" value={form.customer} onChange={e => setField('customer', e.target.value)} placeholder="Customer / Company" />
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
                  <td><button className="del-btn" onClick={() => removeItem(item.id)}>✕</button></td>
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
    </div>
  )
}
