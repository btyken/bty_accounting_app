import React from 'react'
import { useApp } from '../../store/AppContext'
import { fmt } from '../../utils/format'

export default function ProfitLoss() {
  const { data } = useApp()
  const revenueAccs = data.accounts.filter(a => a.type === 'Revenue')
  const expenseAccs = data.accounts.filter(a => a.type === 'Expense')
  const totalRevenue  = revenueAccs.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = expenseAccs.reduce((s, a) => s + a.balance, 0)
  const netIncome = totalRevenue - totalExpenses

  return (
    <div className="card" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Financial Report</div>
        <h2 style={{ fontSize: 22, margin: '4px 0' }}>Profit &amp; Loss Statement</h2>
        <div className="text-muted text-sm">
          As of {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

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
  )
}
