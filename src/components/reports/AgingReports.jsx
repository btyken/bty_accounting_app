import React, { useState } from 'react'
import { useApp } from '../../store/AppContext'
import { fmt } from '../../utils/format'

const BUCKETS = [
  { id: 'current', label: 'Current (Not Yet Due)' },
  { id: '1-30',    label: '1–30 Days' },
  { id: '31-60',   label: '31–60 Days' },
  { id: '61-90',   label: '61–90 Days' },
  { id: '91+',     label: '91+ Days' },
]

function daysDiff(dateStr) {
  if (!dateStr) return 0
  const d = new Date(dateStr + 'T00:00:00')
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.floor((now - d) / 86400000)
}

function ageBucket(days) {
  if (days <= 0)  return 'current'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '91+'
}

const BUCKET_COLOR = { current: '#166534', '1-30': '#92400e', '31-60': '#b45309', '61-90': '#991b1b', '91+': '#7f1d1d' }
const BUCKET_BG    = { current: '#f0fdf4', '1-30': '#fefce8', '31-60': '#fff7ed', '61-90': '#fef2f2', '91+': '#fef2f2' }

function BucketBadge({ bucket }) {
  const b = BUCKETS.find(b => b.id === bucket)
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, background: BUCKET_BG[bucket], color: BUCKET_COLOR[bucket], fontSize: 11.5, fontWeight: 600 }}>
      {b?.label}
    </span>
  )
}

// ── AR Aging ──────────────────────────────────────────────────────
function ARaging({ data }) {
  const unpaid = (data.invoices || []).filter(i => i.status !== 'paid')

  if (unpaid.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">✅</div>
          <p>No outstanding receivables — all invoices are paid!</p>
        </div>
      </div>
    )
  }

  // Group by customer
  const byCustomer = {}
  unpaid.forEach(inv => {
    const days   = daysDiff(inv.dueDate || inv.date)
    const bucket = ageBucket(days)
    if (!byCustomer[inv.customer]) {
      byCustomer[inv.customer] = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '91+': 0, total: 0, invoices: [] }
    }
    byCustomer[inv.customer][bucket] += inv.total
    byCustomer[inv.customer].total   += inv.total
    byCustomer[inv.customer].invoices.push({ ...inv, days, bucket })
  })

  const totals = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '91+': 0, total: 0 }
  Object.values(byCustomer).forEach(c => {
    BUCKETS.forEach(b => { totals[b.id] += c[b.id] })
    totals.total += c.total
  })

  return (
    <div>
      {/* Bucket summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {BUCKETS.map(b => (
          <div key={b.id} className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${BUCKET_COLOR[b.id]}` }}>
            <div className="card-title" style={{ color: BUCKET_COLOR[b.id] }}>{b.label}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: BUCKET_COLOR[b.id] }}>{fmt(totals[b.id])}</div>
          </div>
        ))}
      </div>

      {/* Detail table */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="section-header">AR Aging Detail — by Customer</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th><th>Invoice #</th><th>Invoice Date</th>
                <th>Due Date</th><th>Days Past Due</th><th>Status</th>
                <th className="text-right">Amount</th><th>Age</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(byCustomer).map(([customer, cdata]) => (
                <React.Fragment key={customer}>
                  {cdata.invoices
                    .sort((a, b) => b.days - a.days)
                    .map(inv => (
                      <tr key={inv.id}>
                        <td><strong>{inv.customer}</strong></td>
                        <td className="text-muted">{inv.number}</td>
                        <td className="text-muted">{inv.date}</td>
                        <td className="text-muted">{inv.dueDate || '—'}</td>
                        <td style={{ color: inv.days > 0 ? 'var(--red)' : '#166534', fontWeight: 600 }}>
                          {inv.days > 0 ? `${inv.days} days` : inv.days === 0 ? 'Due today' : 'Not yet due'}
                        </td>
                        <td>
                          <span className={`badge badge-${inv.status === 'overdue' ? 'red' : inv.status === 'sent' ? 'blue' : 'gray'}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="text-right amount-neg"><strong>{fmt(inv.total)}</strong></td>
                        <td><BucketBadge bucket={inv.bucket} /></td>
                      </tr>
                    ))
                  }
                  <tr style={{ background: '#f9fafb' }}>
                    <td colSpan={6} style={{ fontWeight: 700, paddingLeft: 28, color: 'var(--text-muted)', fontSize: 12 }}>
                      Subtotal — {customer}
                    </td>
                    <td className="text-right" style={{ fontWeight: 700 }}>{fmt(cdata.total)}</td>
                    <td></td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                <td colSpan={6}><strong>TOTAL RECEIVABLES</strong></td>
                <td className="text-right amount-neg"><strong>{fmt(totals.total)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Aging summary */}
      <div className="card">
        <div className="section-header">Aging Summary</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Age Bucket</th>
                <th className="text-right">Amount</th>
                <th className="text-right">% of Total</th>
                <th style={{ width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {BUCKETS.map(b => {
                const pct = totals.total ? (totals[b.id] / totals.total * 100) : 0
                return (
                  <tr key={b.id}>
                    <td style={{ color: BUCKET_COLOR[b.id], fontWeight: 600 }}>{b.label}</td>
                    <td className="text-right">{fmt(totals[b.id])}</td>
                    <td className="text-right">{pct.toFixed(1)}%</td>
                    <td>
                      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: BUCKET_COLOR[b.id], borderRadius: 4 }} />
                      </div>
                    </td>
                  </tr>
                )
              })}
              <tr className="tr-total">
                <td><strong>Total Receivables</strong></td>
                <td className="text-right amount-neg"><strong>{fmt(totals.total)}</strong></td>
                <td className="text-right"><strong>100%</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── AP Aging ──────────────────────────────────────────────────────
function APaging({ data }) {
  const apAccounts = data.accounts.filter(a => a.type === 'Liability')

  if (apAccounts.length === 0) {
    return (
      <div className="card">
        <div className="empty">
          <div className="empty-icon">📋</div>
          <p>No liability accounts found in the Chart of Accounts.</p>
        </div>
      </div>
    )
  }

  const apAccountIds = new Set(apAccounts.map(a => a.id))
  const totalAP = apAccounts.reduce((s, a) => s + a.balance, 0)

  // Collect transactions that credit liability accounts (= liability created)
  const payables = []
  ;(data.transactions || []).forEach(txn => {
    txn.entries.forEach(e => {
      if (!apAccountIds.has(e.accountId) || e.credit <= 0) return
      payables.push({
        id: `${txn.id}-${e.accountId}`,
        date: txn.date,
        ref: txn.ref,
        description: txn.description,
        accountId: e.accountId,
        amount: e.credit,
        daysOld: daysDiff(txn.date),
        bucket: ageBucket(daysDiff(txn.date)),
      })
    })
  })

  payables.sort((a, b) => b.daysOld - a.daysOld)

  const bucketTotals = { current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '91+': 0 }
  payables.forEach(e => { bucketTotals[e.bucket] += e.amount })

  const apAccName = (id) => apAccounts.find(a => a.id === id)?.name || '—'

  return (
    <div>
      <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#92400e' }}>
        ℹ️ <strong>AP Aging Note:</strong> This view is derived from journal entries that credit liability accounts. Account balances reflect the net outstanding amounts. For full AP management, post journal entries crediting your Accounts Payable accounts.
      </div>

      {/* AP account balances */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(apAccounts.length + 1, 4)}, 1fr)`, gap: 12, marginBottom: 20 }}>
        {apAccounts.map(a => (
          <div key={a.id} className="card" style={{ padding: '14px 16px' }}>
            <div className="card-title">{a.code} — {a.name}</div>
            <div className="card-value red" style={{ fontSize: 20 }}>{fmt(a.balance)}</div>
          </div>
        ))}
        <div className="card" style={{ padding: '14px 16px', background: '#111', color: '#fff' }}>
          <div className="card-title" style={{ color: '#aaa' }}>Total Payables</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f87171' }}>{fmt(totalAP)}</div>
        </div>
      </div>

      {payables.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">📋</div>
            <p>No payable transactions found in journal entries.<br />Post journal entries that credit liability accounts to see AP aging.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Bucket summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            {BUCKETS.map(b => (
              <div key={b.id} className="card" style={{ padding: '14px 16px', borderTop: `3px solid ${BUCKET_COLOR[b.id]}` }}>
                <div className="card-title" style={{ color: BUCKET_COLOR[b.id] }}>{b.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: BUCKET_COLOR[b.id] }}>{fmt(bucketTotals[b.id])}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-header">AP Transactions — Journal Entry Detail</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th><th>Reference</th><th>Description</th>
                    <th>Account</th><th>Days Since Posted</th>
                    <th className="text-right">Amount</th><th>Age</th>
                  </tr>
                </thead>
                <tbody>
                  {payables.map(e => (
                    <tr key={e.id}>
                      <td className="text-muted">{e.date}</td>
                      <td><strong>{e.ref}</strong></td>
                      <td>{e.description}</td>
                      <td><span className="badge badge-red">{apAccName(e.accountId)}</span></td>
                      <td style={{ color: e.daysOld > 60 ? 'var(--red)' : 'var(--text-muted)', fontWeight: e.daysOld > 60 ? 700 : 400 }}>
                        {e.daysOld} days
                      </td>
                      <td className="text-right amount-neg"><strong>{fmt(e.amount)}</strong></td>
                      <td><BucketBadge bucket={e.bucket} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg)', fontWeight: 700, borderTop: '2px solid var(--border)' }}>
                    <td colSpan={5}><strong>TOTAL (from JEs)</strong></td>
                    <td className="text-right amount-neg"><strong>{fmt(payables.reduce((s, e) => s + e.amount, 0))}</strong></td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function AgingReports() {
  const { data } = useApp()
  const [tab, setTab] = useState('ar')

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className={`tab${tab === 'ar' ? ' active' : ''}`} onClick={() => setTab('ar')}>
          AR Aging — Accounts Receivable
        </div>
        <div className={`tab${tab === 'ap' ? ' active' : ''}`} onClick={() => setTab('ap')}>
          AP Aging — Accounts Payable
        </div>
      </div>
      {tab === 'ar' && <ARaging data={data} />}
      {tab === 'ap' && <APaging data={data} />}
    </div>
  )
}
