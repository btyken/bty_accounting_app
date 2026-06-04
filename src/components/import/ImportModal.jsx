import React, { useState, useRef, useCallback } from 'react'
import { useApp } from '../../store/AppContext'
import Modal from '../ui/Modal'
import {
  IMPORT_TEMPLATES,
  downloadTemplate,
  parseFile,
  parseAccounts,
  parseInvoices,
  parseExpenses,
  parseTransactions,
} from '../../utils/importParsers'
import { fmt } from '../../utils/format'
import { AlertTriangle, Upload } from 'lucide-react'

const LABELS = {
  accounts:     'Chart of Accounts',
  invoices:     'Invoices',
  expenses:     'Expenses',
  transactions: 'Journal Entries',
}

export default function ImportModal({ open, onClose, type, onImport }) {
  const { data } = useApp()
  const fileRef  = useRef()

  const [step,      setStep]      = useState('upload')   // upload | preview | done
  const [dragging,  setDragging]  = useState(false)
  const [fileName,  setFileName]  = useState('')
  const [records,   setRecords]   = useState([])
  const [errors,    setErrors]    = useState([])
  const [warnings,  setWarnings]  = useState([])
  const [mode,      setMode]      = useState('append')   // append | replace
  const [importing, setImporting] = useState(false)

  const reset = () => {
    setStep('upload'); setFileName(''); setRecords([]); setErrors([]); setWarnings([]); setMode('append')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => { reset(); onClose() }

  const parse = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setErrors(['Only .xlsx, .xls, and .csv files are supported.'])
      setStep('preview')
      return
    }
    setFileName(file.name)
    try {
      const rows = await parseFile(file)
      let result
      if (type === 'accounts')     result = parseAccounts(rows)
      else if (type === 'invoices') result = parseInvoices(rows)
      else if (type === 'expenses') result = parseExpenses(rows, data.accounts)
      else                          result = parseTransactions(rows, data.accounts)
      setRecords(result.records)
      setErrors(result.errors || [])
      setWarnings(result.warnings || [])
      setStep('preview')
    } catch (e) {
      setErrors([`Failed to parse file: ${e.message}`])
      setStep('preview')
    }
  }, [type, data.accounts])

  const onFileChange = (e) => { if (e.target.files[0]) parse(e.target.files[0]) }
  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files[0]) parse(e.dataTransfer.files[0])
  }

  const doImport = () => {
    if (!records.length) return
    setImporting(true)
    setTimeout(() => {
      onImport(records, mode)
      setImporting(false)
      setStep('done')
    }, 300)
  }

  const tpl = IMPORT_TEMPLATES[type]

  // ── Preview table columns per type ──────────────────────────
  const PreviewTable = () => {
    if (!records.length) return null
    if (type === 'accounts') return (
      <table><thead><tr><th>Code</th><th>Name</th><th>Type</th><th className="text-right">Balance</th></tr></thead>
        <tbody>{records.slice(0, 20).map((r, i) => (
          <tr key={i}><td>{r.code}</td><td>{r.name}</td><td>{r.type}</td><td className="text-right">{fmt(r.balance)}</td></tr>
        ))}</tbody></table>
    )
    if (type === 'invoices') return (
      <table><thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Lines</th><th className="text-right">Total</th><th>Status</th></tr></thead>
        <tbody>{records.slice(0, 20).map((r, i) => (
          <tr key={i}><td>{r.number}</td><td>{r.customer}</td><td>{r.date}</td>
            <td>{r.lineItems.length}</td><td className="text-right">{fmt(r.total)}</td>
            <td><span className={`badge badge-${r.status === 'paid' ? 'green' : r.status === 'sent' ? 'blue' : 'gray'}`}>{r.status}</span></td>
          </tr>
        ))}</tbody></table>
    )
    if (type === 'expenses') return (
      <table><thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th>Department</th><th>Method</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{records.slice(0, 20).map((r, i) => {
          const acc = data.accounts.find(a => a.id === r.accountId)
          return (
            <tr key={i}><td>{r.date}</td><td>{r.vendor}</td>
              <td>{acc ? acc.name : '—'}</td><td>{r.department || '—'}</td><td>{r.method}</td>
              <td className="text-right amount-neg">{fmt(r.amount)}</td>
            </tr>
          )
        })}</tbody></table>
    )
    if (type === 'transactions') return (
      <table><thead><tr><th>Reference</th><th>Date</th><th>Description</th><th>Department</th><th>Entries</th><th>Balance</th></tr></thead>
        <tbody>{records.slice(0, 20).map((r, i) => {
          const dr = r.entries.reduce((s,e)=>s+e.debit,0)
          const cr = r.entries.reduce((s,e)=>s+e.credit,0)
          const ok = Math.abs(dr-cr) < 0.01
          return (
            <tr key={i} style={r.unbalanced ? { background:'#fffbeb' } : {}}>
              <td>{r.ref}</td><td>{r.date}</td><td>{r.description}</td>
              <td>{r.department || '—'}</td>
              <td>{r.entries.length} lines</td>
              <td>{ok
                ? <span className="badge badge-green">OK</span>
                : <span className="badge badge-yellow"><AlertTriangle size={10} /> Unbalanced</span>
              }</td>
            </tr>
          )
        })}</tbody></table>
    )
    return null
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Import ${LABELS[type]} from Excel`}
      size="modal-lg"
      footer={
        step === 'upload' ? (
          <button className="btn btn-secondary" onClick={handleClose}>Cancel</button>
        ) : step === 'preview' ? (
          <>
            <button className="btn btn-secondary" onClick={reset}>← Back</button>
            {records.length > 0 && (
              <button className="btn btn-primary" onClick={doImport} disabled={importing}>
                {importing ? 'Importing…' : `Import ${records.length} record${records.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </>
        ) : (
          <button className="btn btn-primary" onClick={handleClose}>Done</button>
        )
      }
    >

      {/* ── STEP: UPLOAD ─────────────────────────────── */}
      {step === 'upload' && (
        <>
          {/* Drop zone */}
          <div
            className={`import-zone${dragging ? ' drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current.click()}
          >
            <div className="import-zone-icon"><Upload size={32} /></div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Drop your Excel file here or click to browse</div>
            <div className="text-muted text-sm">Supports .xlsx, .xls, .csv</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onFileChange} />
          </div>

          {/* Template download */}
          <div style={{ marginTop: 20 }}>
            <div className="section-header" style={{ fontSize: 13 }}>Download Template</div>
            <p className="text-muted text-sm" style={{ marginBottom: 10 }}>
              Use our pre-formatted template to ensure your data imports correctly.
            </p>
            <div className="template-btns">
              <button className="btn btn-secondary btn-sm" onClick={() => downloadTemplate(type)}>
                ⬇️ Download {LABELS[type]} Template (.xlsx)
              </button>
            </div>
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--bg)', borderRadius: 6, fontSize: 12.5 }}>
              <strong>Expected columns:</strong>{' '}
              <code style={{ background: '#e5e7eb', padding: '1px 6px', borderRadius: 4, fontSize: 11.5 }}>
                {tpl?.headers.join(', ')}
              </code>
              <div className="text-muted" style={{ marginTop: 6 }}>{tpl?.notes}</div>
            </div>
          </div>
        </>
      )}

      {/* ── STEP: PREVIEW ────────────────────────────── */}
      {step === 'preview' && (
        <>
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{fileName}</span>
            {records.length > 0 && (
              <span className="import-stat">{records.length} record{records.length !== 1 ? 's' : ''} ready</span>
            )}
            {warnings.length > 0 && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:6, background:'#fef3c7', color:'#92400e', fontWeight:600, fontSize:13 }}>
                {warnings.length} unbalanced
              </span>
            )}
            {errors.length > 0 && (
              <span className="import-err">{errors.length} skipped</span>
            )}
          </div>

          {/* Errors (hard — rows skipped) */}
          {errors.length > 0 && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 14px', marginBottom: 10, fontSize: 12.5 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--neg)' }}>Skipped rows (missing required data):</div>
              {errors.map((e, i) => <div key={i} style={{ color: '#7f1d1d' }}>• {e}</div>)}
            </div>
          )}

          {/* Warnings (soft — imported but flagged) */}
          {warnings.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', marginBottom: 14, fontSize: 12.5 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={13} /> Unbalanced entries — imported but flagged for review:</div>
              <div style={{ maxHeight: 120, overflowY: 'auto' }}>
                {warnings.map((w, i) => <div key={i} style={{ color: '#78350f' }}>• {w}</div>)}
              </div>
            </div>
          )}

          {/* Import mode */}
          {records.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                {['append', 'replace'].map(m => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', padding: '8px 14px', borderRadius: 6, border: `2px solid ${mode === m ? 'var(--gold)' : 'var(--border)'}`, background: mode === m ? 'var(--gold-soft)' : 'var(--card)' }}>
                    <input type="radio" name="import-mode" value={m} checked={mode === m} onChange={() => setMode(m)} style={{ accentColor: 'var(--gold)' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>{m === 'append' ? 'Append' : 'Replace All'}</div>
                      <div className="text-muted text-sm">{m === 'append' ? 'Add to existing records' : 'Overwrite all existing records'}</div>
                    </div>
                  </label>
                ))}
              </div>

              {mode === 'replace' && (
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 14px', marginBottom: 14, fontSize: 12.5, color: '#92400e' }}>
                  <strong>Replace mode</strong> will delete all existing {LABELS[type].toLowerCase()} and account balances will be recalculated.
                </div>
              )}

              {/* Preview table */}
              <div className="section-header" style={{ fontSize: 13 }}>
                Preview {records.length > 20 ? `(showing first 20 of ${records.length})` : `(${records.length} records)`}
              </div>
              <div className="import-preview table-wrap">
                <PreviewTable />
              </div>
            </>
          )}

          {records.length === 0 && errors.length === 0 && (
            <div className="empty"><div className="empty-icon"><Upload size={28} /></div><p>No valid records found in file.</p></div>
          )}
        </>
      )}

      {/* ── STEP: DONE ───────────────────────────────── */}
      {step === 'done' && (
        <div className="empty">
          <div className="empty-icon"><Upload size={32} /></div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Import Complete!</div>
          <p>{records.length} {LABELS[type].toLowerCase()} imported.</p>
          {warnings.length > 0 && (
            <div style={{ marginTop: 12, padding: '10px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
              {warnings.length} unbalanced {LABELS[type].toLowerCase()} were imported and flagged. Review them in the Transactions list.
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
