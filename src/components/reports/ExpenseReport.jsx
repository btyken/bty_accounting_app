import React, { useState } from 'react'
import { useApp } from '../../store/AppContext'
import { fmt, today } from '../../utils/format'
import { DEPARTMENTS } from '../../data/defaults'
import PieChart from '../ui/PieChart'
import { exportToExcel } from '../../utils/exportExcel'
import { ClipboardList, Download } from 'lucide-react'

const DEPT_COLORS = [
  '#111111', '#1e40af', '#dc2626', '#d97706', '#065f46',
  '#7c3aed', '#be185d', '#0e7490', '#047857', '#9a3412',
  '#3730a3', '#6b21a8', '#0c4a6e', '#166534', '#92400e',
  '#4c1d95', '#831843',
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const QUARTERS = ['Q1 (Jan–Mar)','Q2 (Apr–Jun)','Q3 (Jul–Sep)','Q4 (Oct–Dec)']

function getRange(period, year, monthIdx, quarterIdx) {
  switch (period) {
    case 'weekly': {
      const now = new Date()
      const diff = (now.getDay() + 6) % 7
      const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
      const sun = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff + 6)
      return [mon.toISOString().slice(0,10), sun.toISOString().slice(0,10)]
    }
    case 'monthly':
      return [
        new Date(year, monthIdx, 1).toISOString().slice(0,10),
        new Date(year, monthIdx + 1, 0).toISOString().slice(0,10),
      ]
    case 'quarterly':
      return [
        new Date(year, quarterIdx * 3, 1).toISOString().slice(0,10),
        new Date(year, quarterIdx * 3 + 3, 0).toISOString().slice(0,10),
      ]
    case 'annually':
      return [`${year}-01-01`, `${year}-12-31`]
    default:
      return null
  }
}


export default function ExpenseReport() {
  const { data, accName } = useApp()
  const now = new Date()

  const [period, setPeriod]       = useState('monthly')
  const [year, setYear]           = useState(now.getFullYear())
  const [monthIdx, setMonthIdx]   = useState(now.getMonth())
  const [quarterIdx, setQuarterIdx] = useState(Math.floor(now.getMonth() / 3))

  const range = getRange(period, year, monthIdx, quarterIdx)
  const inRange = (date) => !range || (date >= range[0] && date <= range[1])

  // Collect all expenses (direct + from journal entries)
  const directExpenses = data.expenses.filter(e => inRange(e.date))

  const journalExpenses = (data.transactions || [])
    .filter(txn => inRange(txn.date))
    .map(txn => ({
      id: txn.id,
      date: txn.date,
      ref: txn.ref,
      vendor: txn.description,
      accounts: txn.entries
        .map(e => data.accounts.find(a => a.id === e.accountId)?.name)
        .filter(Boolean)
        .join(', '),
      department: txn.department || '',
      amount: txn.entries.reduce((s, e) => s + (e.debit || 0), 0),
      isJournal: true,
    }))

  const allExpenses = [...directExpenses, ...journalExpenses]
  const grandTotal  = allExpenses.reduce((s, e) => s + e.amount, 0)

  // Department breakdown
  const deptMap = {}
  allExpenses.forEach(e => {
    const key = e.department || 'Unassigned'
    deptMap[key] = (deptMap[key] || 0) + e.amount
  })

  const deptRows = Object.entries(deptMap)
    .map(([label, value], i) => ({
      label,
      value,
      pct: grandTotal ? (value / grandTotal * 100) : 0,
      color: DEPT_COLORS[DEPARTMENTS.indexOf(label) % DEPT_COLORS.length] || '#9ca3af',
    }))
    .sort((a, b) => b.value - a.value)

  const yearOptions = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) yearOptions.push(y)

  const periodLabel = {
    weekly: `This Week (${range?.[0]} – ${range?.[1]})`,
    monthly: `${MONTHS[monthIdx]} ${year}`,
    quarterly: `${QUARTERS[quarterIdx]} ${year}`,
    annually: `Year ${year}`,
  }[period] || ''

  const handleExport = () => {
    const rows = [...allExpenses].sort((a, b) => b.date.localeCompare(a.date)).map(e => ({
      Date: e.date,
      Ref: e.number || e.ref || '',
      'Vendor / Description': e.vendor,
      Account: e.isJournal ? (e.accounts || '') : accName(e.accountId),
      Department: e.department || '',
      Source: e.isJournal ? 'Journal Entry' : 'Direct',
      Amount: e.amount,
    }))
    exportToExcel([{ name: 'Expense Report', rows }], `ExpenseReport_${periodLabel.replace(/[^a-zA-Z0-9]/g, '_')}`)
  }

  return (
    <div>
      {/* Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header">Report Period</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {['weekly','monthly','quarterly','annually'].map(p => (
            <button
              key={p}
              className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p)}
              style={{ textTransform: 'capitalize' }}
            >
              {p === 'weekly' ? 'Weekly' : p === 'monthly' ? 'Monthly' : p === 'quarterly' ? 'Quarterly' : 'Annually'}
            </button>
          ))}

          {period !== 'weekly' && (
            <select className="form-select" style={{ width: 'auto' }} value={year} onChange={e => setYear(+e.target.value)}>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          {period === 'monthly' && (
            <select className="form-select" style={{ width: 'auto' }} value={monthIdx} onChange={e => setMonthIdx(+e.target.value)}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          )}

          {period === 'quarterly' && (
            <select className="form-select" style={{ width: 'auto' }} value={quarterIdx} onChange={e => setQuarterIdx(+e.target.value)}>
              {QUARTERS.map((q, i) => <option key={q} value={i}>{q}</option>)}
            </select>
          )}
        </div>
        {range && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--muted)' }}>
            Showing: <strong>{periodLabel}</strong> &nbsp;|&nbsp; {range[0]} — {range[1]}
          </div>
        )}
      </div>

      {/* Export button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button className="btn btn-secondary" onClick={handleExport} disabled={allExpenses.length === 0}>
          <Download size={13} /> Export Excel
        </button>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="card"><div className="card-title">Total Expenses</div><div className="card-value red">{fmt(grandTotal)}</div></div>
        <div className="card"><div className="card-title">Direct Expenses</div><div className="card-value">{fmt(directExpenses.reduce((s,e)=>s+e.amount,0))}</div></div>
        <div className="card"><div className="card-title">Via Journal Entries</div><div className="card-value">{fmt(journalExpenses.reduce((s,e)=>s+e.amount,0))}</div></div>
      </div>

      {allExpenses.length === 0
        ? (
          <div className="card">
            <div className="empty">
              <div className="empty-icon"><ClipboardList size={32} /></div>
              <p>No expenses found for this period.</p>
            </div>
          </div>
        )
        : (
          <>
            {/* Department breakdown */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="section-header">Expense by Department</div>
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Pie chart */}
                <div style={{ minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <PieChart slices={deptRows} />
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Hover slice for details</div>
                </div>

                {/* Legend + table */}
                <div style={{ flex: 1, minWidth: 280 }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 14 }}></th>
                        <th>Department</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">%</th>
                        <th style={{ width: 120 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptRows.map(row => (
                        <tr key={row.label}>
                          <td><div style={{ width: 12, height: 12, borderRadius: 2, background: row.color }} /></td>
                          <td>{row.label}</td>
                          <td className="text-right amount-neg">{fmt(row.value)}</td>
                          <td className="text-right"><strong>{row.pct.toFixed(1)}%</strong></td>
                          <td>
                            <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${row.pct}%`, background: row.color, borderRadius: 4 }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="tr-total">
                        <td></td>
                        <td><strong>Total</strong></td>
                        <td className="text-right amount-neg"><strong>{fmt(grandTotal)}</strong></td>
                        <td className="text-right"><strong>100%</strong></td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Expense list */}
            <div className="card">
              <div className="section-header">Expense Transactions — {periodLabel}</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th><th>Ref</th><th>Vendor / Description</th>
                      <th>Account</th><th>Department</th><th>Source</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...allExpenses].sort((a,b) => b.date.localeCompare(a.date)).map(e => (
                      <tr key={e.id}>
                        <td className="text-muted">{e.date}</td>
                        <td className="text-muted">{e.number || e.ref || '—'}</td>
                        <td><strong>{e.vendor}</strong></td>
                        <td>
                          {e.isJournal
                            ? <span className="text-muted text-sm">{e.accounts || '—'}</span>
                            : <span className="badge badge-yellow">{accName(e.accountId)}</span>
                          }
                        </td>
                        <td className="text-muted">{e.department || '—'}</td>
                        <td>
                          {e.isJournal
                            ? <span className="badge badge-blue">Journal Entry</span>
                            : <span className="badge badge-gray">Direct</span>
                          }
                        </td>
                        <td className="text-right amount-neg"><strong>{fmt(e.amount)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      }
    </div>
  )
}
