import React from 'react'
import { useApp } from '../store/AppContext'
import { fmt, getLast6Months, statusBadge } from '../utils/format'
import { FileText, CreditCard, TrendingUp, Scale, CheckCircle2, ArrowRight } from 'lucide-react'

export default function Dashboard({ onNavigate }) {
  const { data, accName } = useApp()
  const { accounts, invoices, expenses } = data

  const journalExpenses = (data.transactions || []).flatMap(txn =>
    txn.entries
      .filter(e => {
        const acc = data.accounts.find(a => a.id === e.accountId)
        return acc?.type === 'Expense' && e.debit > 0
      })
      .map(e => ({ id: `${txn.id}-${e.accountId}`, date: txn.date, vendor: txn.description, accountId: e.accountId, amount: e.debit }))
  )
  const allExpenses = [...expenses, ...journalExpenses]

  const totalRevenue  = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalExpenses = allExpenses.reduce((s, e) => s + e.amount, 0)
  const netIncome     = totalRevenue - totalExpenses
  const outstanding   = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + i.total, 0)
  const cash          = accounts.find(a => a.id === 'a1')?.balance || 0

  const months = getLast6Months()

  const monthlyData = months.map(m => ({
    month:   m.slice(5),
    income:  invoices.filter(i => i.status === 'paid' && i.date.startsWith(m)).reduce((s, i) => s + i.total, 0),
    expense: allExpenses.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0),
  }))
  const maxBar = Math.max(...monthlyData.flatMap(m => [m.income, m.expense]), 1)

  const recentExpenses = [...allExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid').slice(0, 5)

  const kpiCards = [
    { title: 'Cash Balance',   value: cash,          cls: 'blue',  page: 'gl'        },
    { title: 'Total Revenue',  value: totalRevenue,  cls: 'green', page: 'pl'        },
    { title: 'Total Expenses', value: totalExpenses, cls: 'red',   page: 'expreport' },
    { title: 'Net Income',     value: netIncome,     cls: netIncome >= 0 ? 'green' : 'red', page: 'pl' },
  ]

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid-4">
        {kpiCards.map(({ title, value, cls, page }) => (
          <div
            className="card"
            key={title}
            onClick={() => onNavigate(page)}
            style={{ cursor: 'pointer', transition: 'box-shadow .15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
          >
            <div className="card-title">{title}</div>
            <div className={`card-value ${cls}`}>{fmt(value)}</div>
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
              View Report <ArrowRight size={10} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Bar Chart */}
        <div className="card">
          <div className="section-header">Income vs Expenses — Last 6 Months</div>
          <div className="bar-chart">
            {monthlyData.map(m => (
              <div className="bar-col" key={m.month}>
                <div className="bar-pair">
                  <div
                    className="bar bar-income"
                    style={{ height: `${(m.income / maxBar * 100).toFixed(1)}px` }}
                    title={`Income: ${fmt(m.income)}`}
                  />
                  <div
                    className="bar bar-expense"
                    style={{ height: `${(m.expense / maxBar * 100).toFixed(1)}px` }}
                    title={`Expenses: ${fmt(m.expense)}`}
                  />
                </div>
                <div className="bar-label">{m.month}</div>
              </div>
            ))}
          </div>
          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--ink)' }} /> Income</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#d4d4d0' }} /> Expenses</div>
          </div>
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('pl')}>View P&L Report →</button>
          </div>
        </div>

        {/* Outstanding Invoices */}
        <div className="card">
          <div className="section-header">Outstanding Invoices</div>
          {unpaidInvoices.length === 0
            ? <div className="empty"><div className="empty-icon"><CheckCircle2 size={32} /></div><p>All invoices paid!</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Customer</th><th>Invoice</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {unpaidInvoices.map(inv => (
                      <tr key={inv.id}>
                        <td>{inv.customer}</td>
                        <td className="text-muted">{inv.number}</td>
                        <td className="text-right">{fmt(inv.total)}</td>
                        <td><span className={`badge ${statusBadge(inv.status)}`}>{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Outstanding: <span style={{ color: 'var(--warn)' }}>{fmt(outstanding)}</span></strong>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('aging')}>View AR Aging →</button>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 18 }}>
        {/* Recent Expenses */}
        <div className="card">
          <div className="section-header">Recent Expenses</div>
          {recentExpenses.length === 0
            ? <div className="empty"><div className="empty-icon"><CreditCard size={32} /></div><p>No expenses yet</p></div>
            : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {recentExpenses.map(e => (
                      <tr key={e.id}>
                        <td className="text-muted">{e.date}</td>
                        <td>{e.vendor}</td>
                        <td className="text-muted">{accName(e.accountId)}</td>
                        <td className="text-right amount-neg">{fmt(e.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
          <div style={{ marginTop: 12, textAlign: 'right' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('expreport')}>View Expense Report →</button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <div className="section-header">Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            <button className="btn btn-primary w-full" onClick={() => onNavigate('invoices')}><FileText size={14} /> Create New Invoice</button>
            <button className="btn btn-secondary w-full" onClick={() => onNavigate('expenses')}><CreditCard size={14} /> Record Expense</button>
            <button className="btn btn-secondary w-full" onClick={() => onNavigate('transactions')}><ArrowRight size={14} /> New Journal Entry</button>
            <button className="btn btn-secondary w-full" onClick={() => onNavigate('pl')}><TrendingUp size={14} /> View P&amp;L Report</button>
            <button className="btn btn-secondary w-full" onClick={() => onNavigate('financial')}><Scale size={14} /> Financial Statements</button>
          </div>
        </div>
      </div>
    </div>
  )
}
