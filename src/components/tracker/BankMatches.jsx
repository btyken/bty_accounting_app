import React, { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import { postToSheet } from './EntryForms'
import { peso } from './fixes'
import { Landmark, AlertTriangle, CheckCircle2, RefreshCw, Clock } from 'lucide-react'

/* "Apply bank statement": the script proposes which bank lines released which
   requests (Ma'am Mia approves inside RCBC; the statement is the proof).
   Exact matches come pre-ticked; ambiguous ones need a pick. Nothing is written
   until Ma'am Cherry clicks Apply. */

const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function BankLine({ b }) {
  return (
    <span className="bank-line">
      <strong>{b.type}</strong> {b.txnId}{b.checkNo ? ` · check ${b.checkNo}` : ''} · {peso(b.amount)}
      {b.fee > 0 ? ` + ${peso(b.fee)} fee` : ''} · posted {fmtDate(b.posted)}
    </span>
  )
}

export default function BankMatches({ userId, requestsById, coverage, onClose, onApplied }) {
  const [state, setState] = useState({ loading: true, error: '', proposals: [], waiting: [] })
  const [picked, setPicked] = useState({})   // proposal id -> true
  const [choice, setChoice] = useState({})   // proposal id -> bank key
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const load = async () => {
    setState(s => ({ ...s, loading: true, error: '' }))
    try {
      const res = await postToSheet(userId, { action: 'proposeMatches', data: {} })
      const proposals = res.proposals || []
      setState({ loading: false, error: '', proposals, waiting: res.waiting || [] })
      setPicked(Object.fromEntries(proposals.filter(p => p.confidence === 'exact').map(p => [p.id, true])))
      setChoice({})
    } catch (e) {
      setState(s => ({ ...s, loading: false, error: e.message }))
    }
  }
  useEffect(() => { load() }, [])

  const groups = useMemo(() => ({
    exact: state.proposals.filter(p => p.kind === 'release' && p.confidence === 'exact'),
    choose: state.proposals.filter(p => p.kind === 'release' && p.confidence !== 'exact'),
    fees: state.proposals.filter(p => p.kind === 'fee'),
    overdue: state.waiting.filter(w => w.state === 'overdue'),
    waiting: state.waiting.filter(w => w.state === 'waiting' || w.state === 'check-not-encashed'),
  }), [state])

  const selectedIds = Object.keys(picked).filter(k => picked[k])
  const missingPick = selectedIds.filter(id => groups.choose.some(p => p.id === id) && !choice[id])

  const apply = async () => {
    setSaveError('')
    if (missingPick.length) { setSaveError('Pick the bank line for every ticked "needs your pick" item first.'); return }
    setSaving(true)
    try {
      const res = await postToSheet(userId, { action: 'applyMatches', data: { ids: selectedIds, choices: choice } })
      onApplied(res, selectedIds.length)
    } catch (e) {
      setSaveError(e.message)
      setSaving(false)
    }
  }

  const reqLabel = (id) => {
    const r = requestsById[id] || {}
    return (
      <div className="match-req" key={id}>
        <span className="fix-id">{id}</span>
        <span className="fix-purpose">{r['Requested By']} · {r['Purpose / Particulars']}</span>
        <span className="fix-amt">{r['Amount Requested'] ? `₱${r['Amount Requested']}` : ''}</span>
      </div>
    )
  }

  const Proposal = ({ p }) => {
    const all = [p.bank, ...(p.alternatives || [])]
    return (
      <div className={`match-card${picked[p.id] ? ' on' : ''}`}>
        <label className="match-tick">
          <input type="checkbox" checked={!!picked[p.id]} onChange={e => setPicked(s => ({ ...s, [p.id]: e.target.checked }))} />
        </label>
        <div className="match-body">
          {p.requestIds.map(reqLabel)}
          {p.kind === 'fee' ? (
            <div className="match-bank">Bank charge to record: <strong>{p.reason}</strong></div>
          ) : p.confidence === 'exact' ? (
            <div className="match-bank"><Landmark size={13} /> <BankLine b={p.bank} /></div>
          ) : (
            <div className="match-choose">
              <div className="match-hint">{p.reason}</div>
              {all.map(b => (
                <label key={b.key} className="radio-row">
                  <input type="radio" name={p.id} checked={choice[p.id] === b.key}
                    onChange={() => { setChoice(s => ({ ...s, [p.id]: b.key })); setPicked(s => ({ ...s, [p.id]: true })) }} />
                  <BankLine b={b} />
                </label>
              ))}
            </div>
          )}
          {p.kind === 'release' && p.confidence === 'exact' && <div className="match-hint">{p.reason}</div>}
        </div>
      </div>
    )
  }

  const footer = (
    <>
      <button className="btn btn-secondary" onClick={load} disabled={state.loading || saving}><RefreshCw size={14} /> Re-check</button>
      <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Close</button>
      <button className="btn btn-primary" onClick={apply} disabled={saving || state.loading || selectedIds.length === 0}>
        {saving ? 'Writing to sheet…' : `Apply ${selectedIds.length} selected`}
      </button>
    </>
  )

  return (
    <Modal open onClose={saving ? () => {} : onClose} size="modal-lg" title="Apply bank statement" footer={footer}>
      <div className="form-context">
        <Landmark size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>Bank statement covers up to <strong>{coverage ? fmtDate(coverage) : '—'}</strong> (paste new exports in BANK IMPORT every Mon / Wed / Fri). Applying fills Release Date, Released From, Reference No., Amount, Bank Charges and Authorization = Approved from the bank line.</span>
      </div>
      {saveError && <div className="form-error"><AlertTriangle size={14} /> {saveError}</div>}
      {state.loading && <div className="empty"><div className="empty-icon"><RefreshCw size={28} className="spin" /></div><p>Reading the bank statement…</p></div>}
      {state.error && <div className="form-error"><AlertTriangle size={14} /> {state.error}</div>}

      {!state.loading && !state.error && (
        <>
          {groups.exact.length + groups.choose.length + groups.fees.length === 0 && (
            <div className="fix-clear"><CheckCircle2 size={16} /> No new matches. Every sent request found in the statement is already recorded.</div>
          )}
          {groups.exact.length > 0 && <h4 className="match-h">Ready: exact matches ({groups.exact.length})</h4>}
          {groups.exact.map(p => <Proposal key={p.id} p={p} />)}
          {groups.choose.length > 0 && <h4 className="match-h">Needs your pick ({groups.choose.length})</h4>}
          {groups.choose.map(p => <Proposal key={p.id} p={p} />)}
          {groups.fees.length > 0 && <h4 className="match-h">Bank charges that posted later ({groups.fees.length})</h4>}
          {groups.fees.map(p => <Proposal key={p.id} p={p} />)}

          {groups.overdue.length > 0 && (
            <>
              <h4 className="match-h warn"><AlertTriangle size={14} /> Sent, but not in the statement yet ({groups.overdue.length})</h4>
              <div className="match-note">The statement already covers enough banking days after these were sent. Check in RCBC whether Ma'am Mia approved them or whether they failed.</div>
              {groups.overdue.map(w => (
                <div key={w.requestId} className="match-wait">
                  {reqLabel(w.requestId)}
                  <div className="match-hint">Sent {fmtDate(w.sent)} via {w.channel} · {w.bankingDaysCovered} banking day(s) covered since</div>
                </div>
              ))}
            </>
          )}
          {groups.waiting.length > 0 && (
            <>
              <h4 className="match-h muted"><Clock size={14} /> Still waiting: normal ({groups.waiting.length})</h4>
              {groups.waiting.map(w => (
                <div key={w.requestId} className="match-wait">
                  {reqLabel(w.requestId)}
                  <div className="match-hint">{w.state === 'check-not-encashed' ? `Check ${w.checkNo} issued ${fmtDate(w.sent)}, not yet encashed` : `Sent ${fmtDate(w.sent)} via ${w.channel}: waiting for Ma'am Mia / posting`}</div>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </Modal>
  )
}
