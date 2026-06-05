import React, { useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { useApp } from '../../store/AppContext'
import { fmt, today, typeBadge } from '../../utils/format'

const DEBIT_NORMAL = new Set(['Asset', 'Expense'])

function balanceToColumns(type, balance) {
  if (DEBIT_NORMAL.has(type)) {
    return balance >= 0 ? { debit: balance, credit: 0 } : { debit: 0, credit: -balance }
  }
  return balance >= 0 ? { debit: 0, credit: balance } : { debit: -balance, credit: 0 }
}

function netToColumns(type, grossDr, grossCr) {
  if (DEBIT_NORMAL.has(type)) {
    const net = grossDr - grossCr
    return net >= 0 ? { debit: net, credit: 0 } : { debit: 0, credit: -net }
  }
  const net = grossCr - grossDr
  return net >= 0 ? { debit: 0, credit: net } : { debit: -net, credit: 0 }
}

function getPeriodRange(period, start, end) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  switch (period) {
    case 'monthly':
      return [new Date(y, m, 1).toISOString().slice(0, 10), new Date(y, m + 1, 0).toISOString().slice(0, 10)]
    case 'quarterly': {
      const q = Math.floor(m / 3)
      return [new Date(y, q * 3, 1).toISOString().slice(0, 10), new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10)]
    }
    case 'annually':
      return [`${y}-01-01`, `${y}-12-31`]
    case 'custom':
      return [start, end]
    default:
      return null
  }
}

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']

const PERIOD_BTNS = [
  { id: 'all',       label: 'All Time' },
  { id: 'monthly',   label: 'This Month' },
  { id: 'quarterly', label: 'This Quarter' },
  { id: 'annually',  label: 'This Year' },
  { id: 'custom',    label: 'Custom Range' },
]

export default function TrialBalance() {
  const { data } = useApp()
  const todayStr = today()

  const [period, setPeriod]           = useState('all')
  const [customStart, setCustomStart] = useState(todayStr.slice(0, 8) + '01')
  const [customEnd,   setCustomEnd]   = useState(todayStr)
  const [hideZero, setHideZero]       = useState(false)

  const range = useMemo(
    () => getPeriodRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  )

  const rows = useMemo(() => {
    if (!range) {
      return data.accounts.map(acc => ({
        ...acc,
        ...balanceToColumns(acc.type, acc.balance || 0),
      }))
    }

    const [s, e] = range
    const inRange = (d) => d >= s && d <= e

    const act = {}
    data.accounts.forEach(a => { act[a.id] = { dr: 0, cr: 0 } })

    ;(data.transactions || []).forEach(txn => {
      if (!inRange(txn.date)) return
      txn.entries.forEach(en => {
        if (!act[en.accountId]) act[en.accountId] = { dr: 0, cr: 0 }
        act[en.accountId].dr += en.debit  || 0
        act[en.accountId].cr += en.credit || 0
      })
    })

    ;(data.expenses || []).forEach(exp => {
      if (!inRange(exp.date)) return
      if (act[exp.accountId]) act[exp.accountId].dr += exp.amount
      if (act['a1'])           act['a1'].cr          += exp.amount
    })

    return data.accounts.map(acc => {
      const { dr, cr } = act[acc.id] || { dr: 0, cr: 0 }
      return { ...acc, ...netToColumns(acc.type, dr, cr) }
    })
  }, [data, range])

  const displayed = hideZero ? rows.filter(r => r.debit || r.credit) : rows

  const totalDr = displayed.reduce((s, r) => s + r.debit,  0)
  const totalCr = displayed.reduce((s, r) => s + r.credit, 0)
  const diff    = Math.abs(totalDr - totalCr)
  const ok      = diff < 0.01

  const periodLabel = !range
    ? `As of ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`
    : `Period: ${range[0]} – ${range[1]}`

  // ── Exports ────────────────────────────────────────────────
  const exportCSV = () => {
    const lines = [
      'Code,Account Name,Type,Debit,Credit',
      ...displayed.map(r =>
        `${r.code},"${r.name}",${r.type},${r.debit.toFixed(2)},${r.credit.toFixed(2)}`
      ),
      `,,TOTAL,${totalDr.toFixed(2)},${totalCr.toFixed(2)}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `trial-balance-${todayStr}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportXLSX = () => {
    const title = `Trial Balance — ${periodLabel}`
    const wsData = [
      [title],
      [],
      ['Code', 'Account Name', 'Type', 'Debit', 'Credit'],
      ...displayed.map(r => [r.code, r.name, r.type, r.debit, r.credit]),
      [],
      ['', '', 'TOTAL', totalDr, totalCr],
    ]
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws['!cols'] = [{ wch: 10 }, { wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Trial Balance')
    XLSX.writeFile(wb, `trial-balance-${todayStr}.xlsx`)
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Report title */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
          Financial Report
        </div>
        <h2 style={{ fontSize: 22, margin: '4px 0' }}>Trial Balance</h2>
        <div className="text-muted text-sm">{periodLabel}</div>
      </div>

      {/* Period controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header">Reporting Period</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIOD_BTNS.map(p => (
            <button
              key={p.id}
              className={`btn btn-sm ${period === p.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                Start Date
              </label>
              <input
                className="form-input"
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                End Date
              </label>
              <input
                className="form-input"
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                style={{ width: 160 }}
              />
            </div>
          </div>
        )}

        {range && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
            Showing: <strong>{range[0]} – {range[1]}</strong>
            <span style={{ marginLeft: 10, fontSize: 12 }}>
              (net activity from journal entries &amp; direct expenses)
            </span>
          </div>
        )}

        <label style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
          cursor: 'pointer', fontSize: 13, width: 'fit-content',
        }}>
          <input
            type="checkbox"
            checked={hideZero}
            onChange={e => setHideZero(e.target.checked)}
            style={{ accentColor: 'var(--gold)', width: 14, height: 14 }}
          />
          Hide zero-balance accounts
        </label>
      </div>

      {/* Summary cards */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Total Debits</div>
          <div className="card-value" style={{ color: 'var(--ink)' }}>{fmt(totalDr)}</div>
        </div>
        <div className="card">
          <div className="card-title">Total Credits</div>
          <div className="card-value">{fmt(totalCr)}</div>
        </div>
        <div className="card">
          <div className="card-title">Balance Status</div>
          <div className="card-value" style={{ fontSize: 18, color: ok ? 'var(--pos)' : 'var(--neg)' }}>
            {ok ? 'Balanced' : `Off by ${fmt(diff)}`}
          </div>
        </div>
      </div>

      {!ok && (
        <div style={{
          background: 'var(--neg-bg)', border: '1px solid #fecaca', borderRadius: 'var(--radius-sm)',
          padding: '12px 18px', marginBottom: 20, color: 'var(--neg)', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          Trial balance is out of balance by {fmt(diff)}. Review your journal entries for missing or unequal debit/credit lines.
        </div>
      )}

      {/* Export buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>
          ⬇️ Export CSV
        </button>
        <button className="btn btn-secondary btn-sm" onClick={exportXLSX}>
          ⬇️ Export Excel (.xlsx)
        </button>
      </div>

      {/* Trial balance table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 82 }}>Code</th>
                <th>Account Name</th>
                <th style={{ width: 110 }}>Type</th>
                <th className="text-right" style={{ width: 148 }}>Debit (₱)</th>
                <th className="text-right" style={{ width: 148 }}>Credit (₱)</th>
              </tr>
            </thead>
            <tbody>
              {ACCOUNT_TYPES.map(type => {
                const typeRows = displayed
                  .filter(r => r.type === type)
                  .sort((a, b) => String(a.code).localeCompare(String(b.code)))
                if (!typeRows.length) return null
                const tDr = typeRows.reduce((s, r) => s + r.debit,  0)
                const tCr = typeRows.reduce((s, r) => s + r.credit, 0)
                return (
                  <React.Fragment key={type}>
                    <tr className="acc-type-header">
                      <td colSpan={5}>{type === 'Liability' ? 'Liabilities' : type === 'Equity' ? 'Equity' : type + 's'}</td>
                    </tr>
                    {typeRows.map(row => (
                      <tr key={row.id}>
                        <td className="text-muted">{row.code}</td>
                        <td><strong>{row.name}</strong></td>
                        <td>
                          <span className={`badge ${typeBadge(row.type)}`}>{row.type}</span>
                        </td>
                        <td className="text-right">
                          {row.debit > 0
                            ? <strong>{fmt(row.debit)}</strong>
                            : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                        <td className="text-right">
                          {row.credit > 0
                            ? <strong style={{ color: 'var(--ink)' }}>{fmt(row.credit)}</strong>
                            : <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f9fafb', borderTop: '1px solid var(--border)' }}>
                      <td colSpan={3} style={{ paddingLeft: 28, fontWeight: 600, fontSize: 12.5 }}>
                        Subtotal — {type === 'Liability' ? 'Liabilities' : type === 'Equity' ? 'Equity' : type + 's'}
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        {tDr > 0 ? fmt(tDr) : '—'}
                      </td>
                      <td className="text-right" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {tCr > 0 ? fmt(tCr) : '—'}
                      </td>
                    </tr>
                    <tr><td colSpan={5} style={{ height: 8 }} /></tr>
                  </React.Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--gold-soft)', borderTop: '2px solid var(--gold)' }}>
                <td colSpan={3} style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15 }}>
                  TOTAL
                </td>
                <td
                  className="text-right"
                  style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15, color: ok ? 'inherit' : 'var(--neg)' }}
                >
                  {fmt(totalDr)}
                </td>
                <td
                  className="text-right"
                  style={{ padding: '10px 14px', fontWeight: 700, fontSize: 15, color: ok ? 'var(--text)' : 'var(--neg)' }}
                >
                  {fmt(totalCr)}
                </td>
              </tr>
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: '6px 14px', fontSize: 12, color: ok ? 'var(--muted)' : 'var(--neg)' }}
                >
                  {ok
                    ? 'Total debits equal total credits — books are in balance'
                    : `Out of balance — difference of ${fmt(diff)}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
