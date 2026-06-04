import React, { useState, useMemo } from 'react'
import { useApp } from '../../store/AppContext'
import { fmt, today, typeBadge } from '../../utils/format'
import { BookMarked } from 'lucide-react'

function getDefaultDates() {
  const end = today()
  const d = new Date()
  d.setMonth(0, 1)
  return [d.toISOString().slice(0, 10), end]
}

const SOURCE_BADGE = {
  Journal: 'badge-blue',
  Expense: 'badge-yellow',
  Invoice: 'badge-green',
}

export default function GeneralLedger() {
  const { data } = useApp()
  const [selectedAccId, setSelectedAccId] = useState('all')
  const [[startDate, endDate], setRange] = useState(getDefaultDates)

  const ledgers = useMemo(() => {
    const buildEntries = (accId) => {
      const entries = []

      ;(data.transactions || []).forEach(txn => {
        txn.entries.forEach(e => {
          if (e.accountId !== accId) return
          entries.push({
            date: txn.date,
            ref: txn.ref,
            description: txn.description,
            department: txn.department || '',
            source: 'Journal',
            debit: e.debit || 0,
            credit: e.credit || 0,
          })
        })
      })

      ;(data.expenses || []).forEach(exp => {
        if (exp.accountId === accId) {
          entries.push({
            date: exp.date,
            ref: exp.number,
            description: exp.vendor + (exp.description ? ` — ${exp.description}` : ''),
            department: exp.department || '',
            source: 'Expense',
            debit: exp.amount,
            credit: 0,
          })
        }
        if (accId === 'a1') {
          entries.push({
            date: exp.date,
            ref: exp.number,
            description: `Expense — ${exp.vendor}`,
            department: exp.department || '',
            source: 'Expense',
            debit: 0,
            credit: exp.amount,
          })
        }
      })

      ;(data.invoices || []).filter(i => i.status === 'paid').forEach(inv => {
        if (accId === 'a1') {
          entries.push({
            date: inv.date,
            ref: inv.number,
            description: `Invoice payment — ${inv.customer}`,
            department: '',
            source: 'Invoice',
            debit: inv.total,
            credit: 0,
          })
        }
        if (accId === 'a10') {
          entries.push({
            date: inv.date,
            ref: inv.number,
            description: `Sales revenue — ${inv.customer}`,
            department: '',
            source: 'Invoice',
            debit: 0,
            credit: inv.total,
          })
        }
      })

      return entries.sort((a, b) => a.date.localeCompare(b.date))
    }

    const netDelta = (acc, entries) =>
      entries.reduce((s, e) =>
        (acc.type === 'Asset' || acc.type === 'Expense')
          ? s + e.debit - e.credit
          : s + e.credit - e.debit
      , 0)

    const accounts = selectedAccId === 'all'
      ? data.accounts
      : data.accounts.filter(a => a.id === selectedAccId)

    return accounts.map(acc => {
      const allEntries = buildEntries(acc.id)
      const initialBalance = acc.balance - netDelta(acc, allEntries)
      const priorEntries = allEntries.filter(e => e.date < startDate)
      const rangeEntries = allEntries.filter(e => e.date >= startDate && e.date <= endDate)
      const openingBalance = initialBalance + netDelta(acc, priorEntries)

      let running = openingBalance
      const rows = rangeEntries.map(e => {
        running += (acc.type === 'Asset' || acc.type === 'Expense')
          ? e.debit - e.credit
          : e.credit - e.debit
        return { ...e, balance: running }
      })

      const closingBalance = running
      if (selectedAccId === 'all' && rows.length === 0 && openingBalance === 0) return null

      return { acc, openingBalance, rows, closingBalance }
    }).filter(Boolean)
  }, [selectedAccId, startDate, endDate, data])

  const totalDebits = ledgers.reduce((s, l) => s + l.rows.reduce((r, e) => r + e.debit, 0), 0)
  const totalCredits = ledgers.reduce((s, l) => s + l.rows.reduce((r, e) => r + e.credit, 0), 0)

  return (
    <div>
      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header">Filters</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, minWidth: 280 }}>
            <label className="form-label">Account</label>
            <select
              className="form-select"
              value={selectedAccId}
              onChange={e => setSelectedAccId(e.target.value)}
            >
              <option value="all">All Accounts</option>
              {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].flatMap(type => {
                const accs = data.accounts
                  .filter(a => a.type === type)
                  .sort((a, b) => a.code.localeCompare(b.code))
                if (!accs.length) return []
                return [
                  <option key={`h-${type}`} disabled>── {type}s ──</option>,
                  ...accs.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  )),
                ]
              })}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From</label>
            <input
              className="form-input"
              type="date"
              value={startDate}
              onChange={e => setRange([e.target.value, endDate])}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To</label>
            <input
              className="form-input"
              type="date"
              value={endDate}
              onChange={e => setRange([startDate, e.target.value])}
            />
          </div>
          <button
            className="btn btn-secondary"
            style={{ marginBottom: 0 }}
            onClick={() => setRange(getDefaultDates())}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {ledgers.length > 0 && (
        <div className="grid-3" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-title">Accounts Shown</div>
            <div className="card-value">{ledgers.length}</div>
          </div>
          <div className="card">
            <div className="card-title">Total Debits</div>
            <div className="card-value">{fmt(totalDebits)}</div>
          </div>
          <div className="card">
            <div className="card-title">Total Credits</div>
            <div className="card-value">{fmt(totalCredits)}</div>
          </div>
        </div>
      )}

      {ledgers.length === 0 && (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><BookMarked size={32} /></div>
            <p>No ledger entries found for the selected period.</p>
          </div>
        </div>
      )}

      {ledgers.map(({ acc, openingBalance, rows, closingBalance }) => (
        <div key={acc.id} className="card" style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            marginBottom: 14, paddingBottom: 12, borderBottom: '2px solid var(--border)',
          }}>
            <div>
              <div className="text-muted text-sm">{acc.code}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{acc.name}</div>
              <span
                className={`badge ${typeBadge(acc.type)}`}
                style={{ marginTop: 6, display: 'inline-block' }}
              >
                {acc.type}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="text-muted text-sm">Closing Balance</div>
              <div style={{
                fontSize: 22, fontWeight: 700,
                color: closingBalance < 0 ? 'var(--neg)' : 'var(--text)',
              }}>
                {fmt(closingBalance)}
              </div>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Ref</th>
                  <th>Description</th>
                  <th>Dept</th>
                  <th>Source</th>
                  <th className="text-right">Debit</th>
                  <th className="text-right">Credit</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: '#f3f4f6' }}>
                  <td className="text-muted text-sm">{startDate}</td>
                  <td colSpan={6} style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
                    Opening Balance
                  </td>
                  <td className="text-right font-bold">{fmt(openingBalance)}</td>
                </tr>

                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 18 }}>
                      No transactions in this period.
                    </td>
                  </tr>
                ) : rows.map((row, i) => (
                  <tr key={i}>
                    <td className="text-muted">{row.date}</td>
                    <td><strong>{row.ref || '—'}</strong></td>
                    <td>{row.description}</td>
                    <td className="text-muted text-sm">{row.department || '—'}</td>
                    <td>
                      <span className={`badge ${SOURCE_BADGE[row.source] || 'badge-gray'}`}>
                        {row.source}
                      </span>
                    </td>
                    <td className="text-right">{row.debit ? fmt(row.debit) : '—'}</td>
                    <td className="text-right">{row.credit ? fmt(row.credit) : '—'}</td>
                    <td className="text-right font-bold">{fmt(row.balance)}</td>
                  </tr>
                ))}

                <tr style={{ background: 'var(--gold-soft)', fontWeight: 700 }}>
                  <td className="text-muted text-sm">{endDate}</td>
                  <td colSpan={6} style={{ textAlign: 'right', paddingRight: 14, color: 'var(--muted)' }}>
                    Closing Balance
                  </td>
                  <td className="text-right">{fmt(closingBalance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
