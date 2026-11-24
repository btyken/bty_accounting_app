import React, { useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import { Save, AlertTriangle, Info } from 'lucide-react'

/* Entry forms that write into the tracker sheet (the database).
   Each form posts to /api/tracker; the Apps Script validates and writes
   only the typing columns, then the page reloads from the sheet. */

// REQUESTS header text ↔ field name used by the sheet script.
export const REQ_HEADER = {
  dateRequested: 'Date Requested', requestedBy: 'Requested By', department: 'Department',
  requestType: 'Request Type', payee: 'Payee / Supplier', purpose: 'Purpose / Particulars',
  account: 'Account to Charge', amountRequested: 'Amount Requested', dateNeeded: 'Date Needed',
  processedDate: 'Processed Date', processingResult: 'Processing Result', apNotes: 'Accounts Payable Notes',
  releaseDate: 'Release Date', releasedFrom: 'Released From', referenceNo: 'Bank / GCash Reference No.',
  amountReleased: 'Amount Released', bankCharges: 'Bank Charges',
  bankConfirmedManually: 'Bank Confirmed Manually (tick only if no statement is imported, e.g. GCash)',
  liquidationDate: 'Liquidation Date', changeReturned: 'Change Returned (sukli)', changeReturnedTo: 'Change Returned To',
  paidBackToEmployee: 'Paid Back to Employee', paidBackDate: 'Paid Back Date',
}

const STEP_FIELDS = {
  request:   ['dateRequested', 'requestedBy', 'department', 'requestType', 'payee', 'purpose', 'account', 'amountRequested', 'dateNeeded'],
  process:   ['processedDate', 'processingResult', 'apNotes'],
  release:   ['releaseDate', 'releasedFrom', 'referenceNo', 'amountReleased', 'bankCharges', 'bankConfirmedManually'],
  liquidate: ['liquidationDate', 'changeReturned', 'changeReturnedTo', 'paidBackToEmployee', 'paidBackDate'],
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// "10/27/2026" → "2026-10-27"
const toIso = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(s || '').trim())
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : ''
}
// "2,209.00" / "-" → "2209.00" / ""
const toAmt = (s) => {
  const t = String(s ?? '').trim()
  if (!t || t === '-') return ''
  return t.replace(/,/g, '')
}
const isDate = (f) => /date/i.test(f)
const isAmt = (f) => /amount|charges|changeReturned$|paidBackToEmployee|discount$|nonVat|exempt|otherCharges|AsPrinted/.test(f)

export function valuesFromRow(headers, row, step) {
  const out = {}
  for (const f of STEP_FIELDS[step]) {
    const i = headers.indexOf(REQ_HEADER[f])
    const v = i >= 0 ? row[i] : ''
    if (f === 'bankConfirmedManually') out[f] = String(v).toUpperCase() === 'TRUE'
    else if (isDate(f)) out[f] = toIso(v)
    else if (isAmt(f)) out[f] = toAmt(v)
    else out[f] = v || ''
  }
  return out
}

export async function postToSheet(userId, payload) {
  const r = await fetch('/api/tracker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bty-user': userId || '' },
    body: JSON.stringify(payload),
  })
  let body = null
  try { body = await r.json() } catch { /* not JSON */ }
  if (!r.ok || !body || body.error) {
    const msg = body?.message || {
      busy: 'The sheet is busy. Try again in a few seconds.',
      unauthorized: 'Your login could not be verified. Sign out and sign in again.',
      not_configured: 'The tracker connection is not set up.',
      sheet_unreachable: 'The Google Sheet could not be reached. Try again.',
    }[body?.error] || `Could not save (${body?.error || r.status}).`
    throw new Error(msg)
  }
  return body
}

/* ── Field helpers ─────────────────────────────────────────── */

function F({ label, hint, children, span }) {
  return (
    <div className="form-group" style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label className="form-label">{label}</label>
      {children}
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  )
}
const Select = ({ value, onChange, options, placeholder = 'Select…', allowBlank = true }) => (
  <select className="form-input" value={value} onChange={e => onChange(e.target.value)}>
    {allowBlank && <option value="">{placeholder}</option>}
    {value && !options.includes(value) && <option value={value}>{value} (not in list)</option>}
    {options.map(o => <option key={o} value={o}>{o}</option>)}
  </select>
)

/* ── The form modal ────────────────────────────────────────── */

const TITLES = {
  newRequest: 'New request',
  request: 'Edit request details',
  process: 'Processing',
  release: 'Manual release (GCash / cash / correction)',
  sent: 'Sent to bank',
  notApproved: 'Not approved in RCBC',
  liquidate: 'Liquidation',
  receipt: 'Add receipt',
}

export default function EntryForm({ form, lists, userId, onClose, onSaved }) {
  // form = { kind: 'newRequest'|'request'|'process'|'release'|'liquidate'|'receipt', requestId?, initial, context }
  const L = lists || {}
  const vendors = L.vendors || []
  const [v, setV] = useState(() => {
    const init = { ...form.initial }
    if (form.kind === 'receipt' && init.supplier) {
      const vd = vendors.find(x => x.name.toUpperCase() === init.supplier.toUpperCase())
      if (vd) { init.tin = init.tin || vd.tin || ''; if (/^yes/i.test(vd.vat || '')) init.vatRegistered = true }
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (val) => setV(s => ({ ...s, [k]: val }))
  const vendorNames = useMemo(() => vendors.map(x => x.name), [vendors])
  const ctx = form.context || {}

  const pickSupplier = (name) => {
    const up = name.toUpperCase()
    const vd = vendors.find(x => x.name.toUpperCase() === up)
    setV(s => ({
      ...s, supplier: up,
      ...(vd && !s.tin ? { tin: vd.tin || '' } : {}),
      ...(vd && /^yes/i.test(vd.vat || '') ? { vatRegistered: true } : {}),
      ...(vd && /^no/i.test(vd.vat || '') ? { vatRegistered: false } : {}),
    }))
  }

  const save = async () => {
    setError('')
    setSaving(true)
    try {
      let payload
      const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, typeof x === 'string' ? x.trim() : x]))
      if (form.kind === 'newRequest') payload = { action: 'addRequest', data: clean(v) }
      else if (form.kind === 'sent') payload = { action: 'markSent', data: clean({ ...v, requestIds: form.requestIds }) }
      else if (form.kind === 'notApproved') payload = { action: 'markNotApproved', data: clean({ ...v, requestId: form.requestId }) }
      else if (form.kind === 'receipt') {
        const requestId = form.requestId || v.requestId
        if (!requestId) throw new Error('Pick the request this receipt belongs to.')
        payload = { action: 'addReceipt', data: clean({ ...v, requestId }) }
      }
      else payload = { action: 'updateRequest', step: form.kind, data: clean({ ...v, requestId: form.requestId }) }
      const res = await postToSheet(userId, payload)
      onSaved(res, form)
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const k = form.kind
  const footer = (
    <>
      <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
      <button className="btn btn-primary" onClick={save} disabled={saving}>
        <Save size={14} /> {saving ? 'Saving to sheet…' : 'Save to sheet'}
      </button>
    </>
  )

  return (
    <Modal open onClose={saving ? () => {} : onClose} size="modal-lg"
      title={`${TITLES[k]}${form.requestId ? ` · ${form.requestId}` : form.requestIds ? ` · ${form.requestIds.length} request${form.requestIds.length === 1 ? '' : 's'}` : ''}`} footer={footer}>
      {ctx.summary && <div className="form-context"><Info size={14} /> {ctx.summary}</div>}
      {error && <div className="form-error"><AlertTriangle size={14} /> {error}</div>}

      {(k === 'newRequest' || k === 'request') && (
        <div className="form-grid">
          <F label="Date requested *"><input className="form-input" type="date" value={v.dateRequested} onChange={e => set('dateRequested')(e.target.value)} /></F>
          <F label="Date needed"><input className="form-input" type="date" value={v.dateNeeded} onChange={e => set('dateNeeded')(e.target.value)} /></F>
          <F label="Requested by *"><input className="form-input" value={v.requestedBy} onChange={e => set('requestedBy')(e.target.value.toUpperCase())} placeholder="Employee name" /></F>
          <F label="Department *"><Select value={v.department} onChange={set('department')} options={L.departments || []} /></F>
          <F label="Request type *" hint="Cash Advance: money given before spending. Reimbursement: employee already paid. Direct Payment: bill or invoice paid straight to the supplier.">
            <Select value={v.requestType} onChange={set('requestType')} options={L.requestTypes || []} />
          </F>
          <F label="Payee / supplier" hint="Pick from VENDORS if listed; type a new name otherwise.">
            <input className="form-input" list="vendor-list" value={v.payee} onChange={e => set('payee')(e.target.value.toUpperCase())} placeholder="Who receives the money" />
          </F>
          <F label="Purpose / particulars *" span><input className="form-input" value={v.purpose} onChange={e => set('purpose')(e.target.value.toUpperCase())} placeholder="e.g. UNIT 2 MERALCO BILLING FTP 101526 TO 111426" /></F>
          <F label="Account to charge *"><Select value={v.account} onChange={set('account')} options={L.accounts || []} /></F>
          <F label="Amount requested *" hint="For a supplier payment: the full invoice amount, before withholding tax.">
            <input className="form-input" type="number" step="0.01" min="0" value={v.amountRequested} onChange={e => set('amountRequested')(e.target.value)} />
          </F>
        </div>
      )}

      {k === 'sent' && (
        <div className="form-grid">
          <F label="Requests" span>
            <div className="sent-list">{(ctx.rows || []).map(r => (
              <div key={r.id} className="match-req"><span className="fix-id">{r.id}</span><span className="fix-purpose">{r.purpose}</span><span className="fix-amt">₱{r.amount}</span></div>
            ))}</div>
            {ctx.total && <div className="field-hint">Total {ctx.total}. If these go out as one transfer, the bank line must equal this total.</div>}
          </F>
          <F label="Date sent / set up in RCBC *"><input className="form-input" type="date" value={v.sentDate} onChange={e => set('sentDate')(e.target.value)} /></F>
          <F label="Channel *" hint="InstaPay posts once Ma'am Mia approves; PesoNET takes 1–2 banking days; checks release when encashed.">
            <Select value={v.channel} onChange={set('channel')} options={L.channels || ['InstaPay', 'PesoNET', 'Check', 'GCash', 'Cash', 'Other']} />
          </F>
          {v.channel === 'Check' && <F label="Check no. *"><input className="form-input" value={v.checkNo} onChange={e => set('checkNo')(e.target.value.trim())} placeholder="e.g. 1200000703" /></F>}
          {(v.channel === 'GCash' || v.channel === 'Cash') && (
            <F label=" " span><div className="form-context" style={{ margin: 0 }}><Info size={14} /> GCash and cash have no imported statement: after sending, open the request and use “Manual release”.</div></F>
          )}
        </div>
      )}

      {k === 'notApproved' && (
        <div className="form-grid">
          <F label="Result in RCBC"><Select value={v.status} onChange={set('status')} options={['Rejected', 'On hold']} allowBlank={false} /></F>
          <F label="Date"><input className="form-input" type="date" value={v.date} onChange={e => set('date')(e.target.value)} /></F>
          <F label="Reason / note (added to Accounts Payable notes)" span><input className="form-input" value={v.note} onChange={e => set('note')(e.target.value)} placeholder="e.g. Declined in RCBC: wrong account number" /></F>
        </div>
      )}

      {k === 'process' && (
        <div className="form-grid">
          <F label="Processed date"><input className="form-input" type="date" value={v.processedDate} onChange={e => set('processedDate')(e.target.value)} /></F>
          <F label="Processing result"><Select value={v.processingResult} onChange={set('processingResult')} options={L.processingResults || []} /></F>
          <F label="Accounts Payable notes" span><textarea className="form-input" rows={3} value={v.apNotes} onChange={e => set('apNotes')(e.target.value)} placeholder="Reason if returned or on hold" /></F>
        </div>
      )}

      {k === 'release' && (
        <div className="form-grid">
          <F label="Release date"><input className="form-input" type="date" value={v.releaseDate} onChange={e => set('releaseDate')(e.target.value)} /></F>
          <F label="Released from"><Select value={v.releasedFrom} onChange={set('releasedFrom')} options={L.cashAccounts || []} /></F>
          <F label="Bank / GCash reference no." hint="The bank's Transaction ID. If one transfer pays several requests, use the same reference on each.">
            <input className="form-input" value={v.referenceNo} onChange={e => set('referenceNo')(e.target.value.trim())} />
          </F>
          <F label="Amount released" hint={ctx.expected ? `Expected: ${ctx.expected}` : undefined}>
            <input className="form-input" type="number" step="0.01" min="0" value={v.amountReleased} onChange={e => set('amountReleased')(e.target.value)} />
          </F>
          <F label="Bank charges"><input className="form-input" type="number" step="0.01" min="0" value={v.bankCharges} onChange={e => set('bankCharges')(e.target.value)} /></F>
          <F label=" ">
            <label className="check-row"><input type="checkbox" checked={!!v.bankConfirmedManually} onChange={e => set('bankConfirmedManually')(e.target.checked)} /> Bank confirmed manually (only for GCash or accounts with no imported statement)</label>
          </F>
        </div>
      )}

      {k === 'liquidate' && (
        <div className="form-grid">
          <F label="Liquidation date"><input className="form-input" type="date" value={v.liquidationDate} onChange={e => set('liquidationDate')(e.target.value)} /></F>
          <F label=" "><div className="field-hint" style={{ marginTop: 10 }}>Record the receipts themselves with “Add receipt”.</div></F>
          <F label="Change returned (sukli)"><input className="form-input" type="number" step="0.01" min="0" value={v.changeReturned} onChange={e => set('changeReturned')(e.target.value)} /></F>
          <F label="Change returned to"><Select value={v.changeReturnedTo} onChange={set('changeReturnedTo')} options={L.cashAccounts || []} /></F>
          <F label="Paid back to employee" hint="Only if receipts exceed the advance."><input className="form-input" type="number" step="0.01" min="0" value={v.paidBackToEmployee} onChange={e => set('paidBackToEmployee')(e.target.value)} /></F>
          <F label="Paid back date"><input className="form-input" type="date" value={v.paidBackDate} onChange={e => set('paidBackDate')(e.target.value)} /></F>
        </div>
      )}

      {k === 'receipt' && (
        <div className="form-grid">
          {!form.requestId && (
            <F label="Request *" span>
              <select className="form-input" value={v.requestId || ''} onChange={e => {
                const opt = (ctx.requestOptions || []).find(o => o.id === e.target.value)
                setV(s => ({ ...s, requestId: e.target.value, ...(opt ? { account: s.account || opt.account, particulars: s.particulars || opt.purpose } : {}) }))
                if (opt && opt.payee && !v.supplier) pickSupplier(opt.payee)
              }}>
                <option value="">Select the request…</option>
                {(ctx.requestOptions || []).map(o => <option key={o.id} value={o.id}>{o.id} · {o.purpose}</option>)}
              </select>
            </F>
          )}
          <F label="Receipt date *"><input className="form-input" type="date" value={v.receiptDate} onChange={e => set('receiptDate')(e.target.value)} /></F>
          <F label="OR / invoice no."><input className="form-input" value={v.orNo} onChange={e => set('orNo')(e.target.value)} /></F>
          <F label="Supplier name *" hint="Picking a VENDORS name fills the TIN and VAT setting.">
            <input className="form-input" list="vendor-list" value={v.supplier} onChange={e => pickSupplier(e.target.value)} />
          </F>
          <F label="TIN"><input className="form-input" value={v.tin} onChange={e => set('tin')(e.target.value)} placeholder="000-000-000-00000" /></F>
          <F label="Supplier category"><Select value={v.supplierCategory} onChange={set('supplierCategory')} options={L.supplierCategories || []} /></F>
          <F label="Account title *"><Select value={v.account} onChange={set('account')} options={L.accounts || []} /></F>
          <F label="Amount (receipt total) *"><input className="form-input" type="number" step="0.01" min="0" value={v.amount} onChange={e => set('amount')(e.target.value)} /></F>
          <F label="Receipt type"><Select value={v.receiptType} onChange={set('receiptType')} options={L.receiptTypes || []} /></F>
          <F label=" ">
            <label className="check-row"><input type="checkbox" checked={!!v.vatRegistered} onChange={e => set('vatRegistered')(e.target.checked)} /> VAT-registered supplier</label>
          </F>
          <F label="Withholding tax rate" hint="Supplier payments only. Blank uses the supplier's default in VENDORS."><Select value={v.whtRate} onChange={set('whtRate')} options={L.whtRates || []} placeholder="Default from VENDORS" /></F>
          <F label="Particulars" span><input className="form-input" value={v.particulars} onChange={e => set('particulars')(e.target.value)} /></F>
          <details className="form-more" style={{ gridColumn: '1 / -1' }}>
            <summary>Less common: discounts, exempt, other charges, VAT as printed</summary>
            <div className="form-grid" style={{ marginTop: 12 }}>
              <F label="Non-VAT portion (mixed receipts only)"><input className="form-input" type="number" step="0.01" value={v.nonVatPortion} onChange={e => set('nonVatPortion')(e.target.value)} /></F>
              <F label="Exempt / zero-rated"><input className="form-input" type="number" step="0.01" value={v.exempt} onChange={e => set('exempt')(e.target.value)} /></F>
              <F label="Discount"><input className="form-input" type="number" step="0.01" value={v.discount} onChange={e => set('discount')(e.target.value)} /></F>
              <F label="Discount basis"><Select value={v.discountBasis} onChange={set('discountBasis')} options={L.discountBases || []} /></F>
              <F label="Other charges (delivery, service, tips)"><input className="form-input" type="number" step="0.01" value={v.otherCharges} onChange={e => set('otherCharges')(e.target.value)} /></F>
              <F label="VATable sales as printed"><input className="form-input" type="number" step="0.01" value={v.vatableAsPrinted} onChange={e => set('vatableAsPrinted')(e.target.value)} /></F>
              <F label="VAT as printed"><input className="form-input" type="number" step="0.01" value={v.vatAsPrinted} onChange={e => set('vatAsPrinted')(e.target.value)} /></F>
            </div>
          </details>
        </div>
      )}

      <datalist id="vendor-list">{vendorNames.map(n => <option key={n} value={n} />)}</datalist>
      <div className="form-foot-note">Saved straight into the tracker sheet. Formulas, Ma'am Mia's authorization and everything else in the sheet stay untouched.</div>
    </Modal>
  )
}

export function sentInitial() { return { sentDate: today(), channel: 'InstaPay', checkNo: '' } }
export function notApprovedInitial() { return { status: 'Rejected', date: today(), note: '' } }

export function newRequestInitial() {
  return { dateRequested: today(), requestedBy: '', department: '', requestType: '', payee: '', purpose: '', account: '', amountRequested: '', dateNeeded: '' }
}
export function stepInitial(headers, row, step) {
  const v = valuesFromRow(headers, row, step)
  if (step === 'process' && !v.processedDate) v.processedDate = today()
  if (step === 'process' && !v.processingResult) v.processingResult = 'Processed'
  if (step === 'release' && !v.releaseDate) v.releaseDate = today()
  if (step === 'liquidate' && !v.liquidationDate) v.liquidationDate = today()
  return v
}
export function receiptInitial(r) {
  return {
    receiptDate: today(), orNo: '', supplier: String(r['Payee / Supplier'] || '').toUpperCase(), tin: '', supplierCategory: '',
    account: r['Account to Charge'] || '', amount: '', vatRegistered: false, nonVatPortion: '', exempt: '', discount: '',
    discountBasis: '', otherCharges: '', vatableAsPrinted: '', vatAsPrinted: '', receiptType: 'Receipt', whtRate: '', particulars: r['Purpose / Particulars'] || '',
  }
}
