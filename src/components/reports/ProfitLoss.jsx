import React from 'react'
import { useApp } from '../../store/AppContext'
import { fmt } from '../../utils/format'
import PieChart from '../ui/PieChart'

const COLORS = [
  '#111111', '#1e40af', '#dc2626', '#d97706', '#065f46',
  '#7c3aed', '#be185d', '#0e7490', '#047857', '#9a3412',
  '#3730a3', '#6b21a8',
]

function ChartSection({ title, slices, totalLabel, totalValue, totalCls }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="section-header">{title}</div>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 220, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <PieChart slices={slices} />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>Hover slice for details</div>
        </div>
        <div style={{ flex: 1, minWidth: 260 }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: 14 }}></th>
                <th>Account</th>
                <th className="text-right">Amount</th>
                <th className="text-right">%</th>
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {slices.map(row => (
                <tr key={row.label}>
                  <td><div style={{ width: 12, height: 12, borderRadius: 2, background: row.color }} /></td>
                  <td>{row.label}</td>
                  <td className="text-right">{fmt(row.value)}</td>
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
                <td><strong>{totalLabel}</strong></td>
                <td className={`text-right ${totalCls}`}><strong>{fmt(totalValue)}</strong></td>
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

export default function ProfitLoss() {
  const { data } = useApp()
  const revenueAccs = data.accounts.filter(a => a.type === 'Revenue')
  const expenseAccs = data.accounts.filter(a => a.type === 'Expense')
  const totalRevenue  = revenueAccs.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = expenseAccs.reduce((s, a) => s + a.balance, 0)
  const netIncome = totalRevenue - totalExpenses

  const revenueSlices = revenueAccs
    .filter(a => a.balance > 0)
    .map((a, i) => ({ label: a.name, value: a.balance, color: COLORS[i % COLORS.length], pct: totalRevenue ? a.balance / totalRevenue * 100 : 0 }))

  const expenseSlices = expenseAccs
    .filter(a => a.balance > 0)
    .map((a, i) => ({ label: a.name, value: a.balance, color: COLORS[i % COLORS.length], pct: totalExpenses ? a.balance / totalExpenses * 100 : 0 }))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Financial Report</div>
        <h2 style={{ fontSize: 22, margin: '4px 0' }}>Profit &amp; Loss Statement</h2>
        <div className="text-muted text-sm">
          As of {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {revenueSlices.length > 0 && (
        <ChartSection
          title="💰 Revenue Breakdown"
          slices={revenueSlices}
          totalLabel="Total Revenue"
          totalValue={totalRevenue}
          totalCls="amount-pos"
        />
      )}

      {expenseSlices.length > 0 && (
        <ChartSection
          title="💸 Expense Breakdown"
          slices={expenseSlices}
          totalLabel="Total Expenses"
          totalValue={totalExpenses}
          totalCls="amount-neg"
        />
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <tbody>
              <tr><td colSpan={2}><div className="report-section-title">💰 Income</div></td></tr>
              {revenueAccs.map(a => (
                <tr key={a.id} className="report-row report-group">
                  <td>{a.code} — {a.name}</td>
                  <td className={`text-right ${a.balance >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(a.balance)}</td>
                </tr>
              ))}
              <tr className="report-row report-subtotal">
                <td>Total Income</td>
                <td className={`text-right ${totalRevenue >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(totalRevenue)}</td>
              </tr>

              <tr><td colSpan={2} style={{ height: 12 }} /></tr>

              <tr><td colSpan={2}><div className="report-section-title">💸 Expenses</div></td></tr>
              {expenseAccs.map(a => (
                <tr key={a.id} className="report-row report-group">
                  <td>{a.code} — {a.name}</td>
                  <td className={`text-right ${a.balance > 0 ? 'amount-neg' : 'amount-pos'}`}>
                    {a.balance > 0 ? `(${fmt(a.balance)})` : fmt(a.balance)}
                  </td>
                </tr>
              ))}
              <tr className="report-row report-subtotal">
                <td>Total Expenses</td>
                <td className="text-right amount-neg">({fmt(totalExpenses)})</td>
              </tr>

              <tr><td colSpan={2} style={{ height: 12 }} /></tr>

              <tr className="report-total">
                <td>NET INCOME</td>
                <td className={`text-right ${netIncome >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(netIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
