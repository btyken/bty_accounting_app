import React from 'react'
import { useApp } from '../store/AppContext'
import { fmt, getLast6Months, statusBadge } from '../utils/format'
import {
  FileText, CreditCard, TrendingUp, Scale, CheckCircle2, ArrowRight, ArrowUpRight,
  ArrowDownRight, BookOpen, CalendarRange,
} from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthName = (ym) => MONTHS[parseInt(ym.slice(5), 10) - 1] || ym.slice(5)

// Month-over-month change, as a pill. `goodWhenUp` flips the colour for expenses.
function Delta({ cur, prev, goodWhenUp = true }) {
  if (!prev) return null
  const pct = ((cur - prev) / Math.abs(prev)) * 100
  if (!isFinite(pct)) return null
  const up = pct >= 0
  const good = up === goodWhenUp
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`delta ${good ? 'up' : 'down'}`} title="vs last month">
      <Icon size={11} strokeWidth={2.4} />{Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// Small area sparkline from a list of values.
function Spark({ values, color = 'var(--ink)' }) {
  const w = 200, h = 46, pad = 3
  const max = Math.max(...values), min = Math.min(...values, 0)
  const range = max - min || 1
  const pts = values.map((v, i) => [
    (i / Math.max(values.length - 1, 1)) * w,
    h - pad - ((v - min) / range) * (h - pad * 2),
  ])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const area = `${line} L${w},${h} L0,${h} Z`
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={area} fill="var(--gold-tint)" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

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

  const monthlyData = months.map(m => {
    const income  = invoices.filter(i => i.status === 'paid' && i.date.startsWith(m)).reduce((s, i) => s + i.total, 0)
    const expense = allExpenses.filter(e => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0)
    return { key: m, month: monthName(m), income, expense, net: income - expense }
  })
  const maxBar = Math.max(...monthlyData.flatMap(m => [m.income, m.expense]), 1)
  const cur  = monthlyData[monthlyData.length - 1]
  const prev = monthlyData[monthlyData.length - 2]

  const recentExpenses = [...allExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid').slice(0, 5)
  const margin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0

  return (
    <div>
      {/* ── Stat tiles ─────────────────────────────────── */}
      <div className="grid-4">
        <div className="card stat-tile" onClick={() => onNavigate('gl')}>
          <div className="stat-head">
            <div className="card-title">Cash Balance</div>
            <span className="stat-link"><ArrowUpRight size={16} /></span>
          </div>
          <div className="card-value blue">{fmt(cash)}</div>
          <div className="progress"><div style={{ width: '100%', background: 'var(--gold)' }} /></div>
          <div className="stat-foot">Cash account · open General Ledger</div>
        </div>

        <div className="card stat-tile" onClick={() => onNavigate('pl')}>
          <div className="stat-head">
            <div className="card-title">Total Revenue</div>
            <span className="stat-link"><ArrowUpRight size={16} /></span>
          </div>
          <div className="stat-row">
            <div className="card-value green">{fmt(totalRevenue)}</div>
            <Delta cur={cur.income} prev={prev.income} />
          </div>
          <Spark values={monthlyData.map(m => m.income)} />
        </div>

        <div className="card stat-tile" onClick={() => onNavigate('expreport')}>
          <div className="stat-head">
            <div className="card-title">Total Expenses</div>
            <span className="stat-link"><ArrowUpRight size={16} /></span>
          </div>
          <div className="stat-row">
            <div className="card-value red">{fmt(totalExpenses)}</div>
            <Delta cur={cur.expense} prev={prev.expense} goodWhenUp={false} />
          </div>
          <Spark values={monthlyData.map(m => m.expense)} color="var(--gold-deep)" />
        </div>

        <div className="card stat-tile" onClick={() => onNavigate('pl')}>
          <div className="stat-head">
            <div className="card-title">Net Income</div>
            <span className="stat-link"><ArrowUpRight size={16} /></span>
          </div>
          <div className="stat-row">
            <div className={`card-value ${netIncome >= 0 ? 'green' : 'red'}`}>{fmt(netIncome)}</div>
            <Delta cur={cur.net} prev={prev.net} />
          </div>
          <div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, margin))}%` }} /></div>
          <div className="stat-foot">Net margin {totalRevenue > 0 ? `${margin.toFixed(1)}%` : '—'}</div>
        </div>
      </div>

      {/* ── Chart + quick actions ──────────────────────── */}
      <div className="grid-2-1">
        <div className="card">
          <div className="card-head">
            <h3>Income vs Expenses</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="legend">
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--ink)' }} /> Income</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--gold-bright)' }} /> Expenses</div>
              </div>
              <span className="chip">Last 6 months</span>
            </div>
          </div>
          <div className="bar-chart">
            {monthlyData.map(m => (
              <div className="bar-col" key={m.key}>
                <div className="bar-pair">
                  <div className="bar bar-income" style={{ height: `${(m.income / maxBar * 160).toFixed(1)}px` }} title={`${m.month} income: ${fmt(m.income)}`} />
                  <div className="bar bar-expense" style={{ height: `${(m.expense / maxBar * 160).toFixed(1)}px` }} title={`${m.month} expenses: ${fmt(m.expense)}`} />
                </div>
                <div className="bar-label">{m.month}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
            <span className="text-muted text-sm">
              This month: <strong style={{ color: 'var(--ink)' }}>{fmt(cur.income)}</strong> in · <strong style={{ color: 'var(--ink)' }}>{fmt(cur.expense)}</strong> out
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('pl')}>View P&amp;L <ArrowRight size={13} /></button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Quick Actions</h3></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {[
              { label: 'Create New Invoice',   Icon: FileText,      page: 'invoices',     primary: true },
              { label: 'Record Expense',       Icon: CreditCard,    page: 'expenses' },
              { label: 'New Journal Entry',    Icon: BookOpen,      page: 'transactions' },
              { label: 'Profit & Loss',        Icon: TrendingUp,    page: 'pl' },
              { label: 'Financial Statements', Icon: Scale,         page: 'financial' },
            ].map(({ label, Icon, page, primary }) => (
              <button key={page} className={`quick-action${primary ? ' primary' : ''}`} onClick={() => onNavigate(page)}>
                <span className="qa-icon"><Icon size={16} strokeWidth={1.9} /></span>
                {label}
                <ArrowRight size={15} className="qa-arrow" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tables ─────────────────────────────────────── */}
      <div className="grid-2" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="card-head">
            <h3>Outstanding Invoices</h3>
            <span className="badge badge-gold">{fmt(outstanding)}</span>
          </div>
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
          <div style={{ marginTop: 14, textAlign: 'right' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('aging')}><CalendarRange size={13} /> AR Aging <ArrowRight size={13} /></button>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Recent Expenses</h3></div>
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
          <div style={{ marginTop: 14, textAlign: 'right' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('expreport')}>Expense Report <ArrowRight size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
