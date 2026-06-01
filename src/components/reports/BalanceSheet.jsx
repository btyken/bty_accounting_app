import React from 'react'
import { useApp } from '../../store/AppContext'
import { fmt } from '../../utils/format'

function Section({ title, icon, accounts, extras = [] }) {
  const total = accounts.reduce((s, a) => s + a.balance, 0) + extras.reduce((s, r) => s + r.val, 0)
  return (
    <>
      <tr><td colSpan={2}><div className="report-section-title">{icon} {title}</div></td></tr>
      {accounts.map(a => (
        <tr key={a.id} className="report-row report-group">
          <td>{a.code} — {a.name}</td>
          <td className="text-right">{fmt(a.balance)}</td>
        </tr>
      ))}
      {extras.map(r => (
        <tr key={r.name} className="report-row report-group">
          <td>{r.name}</td>
          <td className="text-right">{fmt(r.val)}</td>
        </tr>
      ))}
      <tr className="report-row report-subtotal">
        <td>Total {title}</td>
        <td className="text-right">{fmt(total)}</td>
      </tr>
      <tr><td colSpan={2} style={{ height: 12 }} /></tr>
    </>
  )
}

export default function BalanceSheet() {
  const { data } = useApp()
  const assets      = data.accounts.filter(a => a.type === 'Asset')
  const liabilities = data.accounts.filter(a => a.type === 'Liability')
  const equities    = data.accounts.filter(a => a.type === 'Equity')

  const revenueTotal = data.accounts.filter(a => a.type === 'Revenue').reduce((s, a) => s + a.balance, 0)
  const expenseTotal = data.accounts.filter(a => a.type === 'Expense').reduce((s, a) => s + a.balance, 0)
  const netIncome    = revenueTotal - expenseTotal

  const totalAssets      = assets.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0)
  const totalEquity      = equities.reduce((s, a) => s + a.balance, 0) + netIncome
  const totalLiabEquity  = totalLiabilities + totalEquity
  const balanced         = Math.abs(totalAssets - totalLiabEquity) < 0.01

  return (
    <div className="card" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Financial Report</div>
        <h2 style={{ fontSize: 22, margin: '4px 0' }}>Balance Sheet</h2>
        <div className="text-muted text-sm">
          As of {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <tbody>
            <Section title="Assets"      icon="🏦" accounts={assets} />
            <Section title="Liabilities" icon="📋" accounts={liabilities} />
            <Section
              title="Equity"
              icon="💼"
              accounts={equities}
              extras={netIncome !== 0 ? [{ name: 'Net Income (Current Period)', val: netIncome }] : []}
            />

            <tr className="report-total">
              <td>TOTAL LIABILITIES + EQUITY</td>
              <td className={`text-right ${balanced ? 'amount-pos' : 'amount-neg'}`}>{fmt(totalLiabEquity)}</td>
            </tr>
            <tr>
              <td className="text-muted text-sm" style={{ paddingTop: 6 }}>
                {balanced ? '✅ Balance sheet balances' : '⚠️ Out of balance — check your entries'}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
