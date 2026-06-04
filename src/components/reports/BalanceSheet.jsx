import React from 'react'
import { useApp } from '../../store/AppContext'
import { fmt } from '../../utils/format'
import PieChart from '../ui/PieChart'

const COLORS = [
  '#111111', '#1e40af', '#dc2626', '#d97706', '#065f46',
  '#7c3aed', '#be185d', '#0e7490', '#047857', '#9a3412',
  '#3730a3', '#6b21a8',
]

function Section({ title, accounts, extras = [] }) {
  const total = accounts.reduce((s, a) => s + a.balance, 0) + extras.reduce((s, r) => s + r.val, 0)
  return (
    <>
      <tr><td colSpan={2}><div className="report-section-title">{title}</div></td></tr>
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

  const assetPositive = assets.filter(a => a.balance > 0)
  const assetPositiveTotal = assetPositive.reduce((s, a) => s + a.balance, 0)
  const assetSlices = assetPositive
    .map((a, i) => ({ label: a.name, value: a.balance, color: COLORS[i % COLORS.length], pct: assetPositiveTotal ? a.balance / assetPositiveTotal * 100 : 0 }))

  const liabPositive = liabilities.filter(a => a.balance > 0)
  const liabPositiveTotal = liabPositive.reduce((s, a) => s + a.balance, 0)
  const liabSlices = liabPositive
    .map((a, i) => ({ label: a.name, value: a.balance, color: COLORS[i % COLORS.length], pct: liabPositiveTotal ? a.balance / liabPositiveTotal * 100 : 0 }))

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Financial Report</div>
        <h2 style={{ fontSize: 22, margin: '4px 0' }}>Balance Sheet</h2>
        <div className="text-muted text-sm">
          As of {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Pie charts row */}
      {(assetSlices.length > 0 || liabSlices.length > 0) && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          {assetSlices.length > 0 && (
            <div className="card">
              <div className="section-header">Assets Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <PieChart slices={assetSlices} />
                <div style={{ marginTop: 10, width: '100%' }}>
                  {assetSlices.map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{s.label}</span>
                      <strong>{s.pct.toFixed(1)}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {liabSlices.length > 0 && (
            <div className="card">
              <div className="section-header">Liabilities Breakdown</div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <PieChart slices={liabSlices} />
                <div style={{ marginTop: 10, width: '100%' }}>
                  {liabSlices.map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: 13 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{s.label}</span>
                      <strong>{s.pct.toFixed(1)}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card">
      <div className="table-wrap">
        <table>
          <tbody>
            <Section title="Assets"       accounts={assets} />
            <Section title="Liabilities"  accounts={liabilities} />
            <Section
              title="Equity"
              
              accounts={equities}
              extras={netIncome !== 0 ? [{ name: 'Net Income (Current Period)', val: netIncome }] : []}
            />

            <tr className="report-total">
              <td>TOTAL LIABILITIES + EQUITY</td>
              <td className={`text-right ${balanced ? 'amount-pos' : 'amount-neg'}`}>{fmt(totalLiabEquity)}</td>
            </tr>
            <tr>
              <td className="text-muted text-sm" style={{ paddingTop: 6 }}>
                {balanced ? 'Balance sheet balances' : 'Out of balance — check your entries'}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>
  )
}
