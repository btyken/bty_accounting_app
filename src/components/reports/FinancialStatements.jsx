import React, { useState } from 'react'
import { useApp } from '../../store/AppContext'
import { fmt, today, uid } from '../../utils/format'

const TABS = [
  { id: 'income',   label: 'Income Statement'   },
  { id: 'balance',  label: 'Balance Sheet'       },
  { id: 'cashflow', label: 'Cash Flow Statement' },
  { id: 'closing',  label: 'Closing Entries'     },
]

function ReportHeader({ title, subtitle }) {
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>Financial Statement</div>
      <h2 style={{ fontSize: 22, margin: '4px 0' }}>{title}</h2>
      <div className="text-muted text-sm">{subtitle || `As of ${dateStr}`}</div>
    </div>
  )
}

// ── Income Statement ──────────────────────────────────────────────
function IncomeStatement({ data }) {
  const revenueAccs = data.accounts.filter(a => a.type === 'Revenue')
  const cogsAccs    = data.accounts.filter(a => a.type === 'Expense' && parseInt(a.code || '0') < 6000)
  const opExpAccs   = data.accounts.filter(a => a.type === 'Expense' && parseInt(a.code || '0') >= 6000)
  const allExpAccs  = data.accounts.filter(a => a.type === 'Expense')

  const totalRevenue  = revenueAccs.reduce((s, a) => s + a.balance, 0)
  const totalCOGS     = cogsAccs.reduce((s, a) => s + a.balance, 0)
  const grossProfit   = totalRevenue - totalCOGS
  const totalOpExp    = opExpAccs.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = allExpAccs.reduce((s, a) => s + a.balance, 0)
  const netIncome     = totalRevenue - totalExpenses

  const hasCOGS  = cogsAccs.some(a => a.balance !== 0)
  const hasOpExp = opExpAccs.length > 0

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <ReportHeader title="Income Statement" />
      <div className="card">
        <div className="table-wrap">
          <table>
            <tbody>
              {/* Revenue */}
              <tr><td colSpan={2}><div className="report-section-title">💰 Revenue</div></td></tr>
              {revenueAccs.map(a => (
                <tr key={a.id} className="report-row report-group">
                  <td>{a.code} — {a.name}</td>
                  <td className={`text-right ${a.balance >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(a.balance)}</td>
                </tr>
              ))}
              <tr className="report-row report-subtotal">
                <td>Total Revenue</td>
                <td className={`text-right ${totalRevenue >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(totalRevenue)}</td>
              </tr>

              {/* COGS (accounts 5000–5999) */}
              {hasCOGS && (
                <>
                  <tr><td colSpan={2} style={{ height: 10 }} /></tr>
                  <tr><td colSpan={2}><div className="report-section-title">📦 Cost of Goods Sold</div></td></tr>
                  {cogsAccs.map(a => (
                    <tr key={a.id} className="report-row report-group">
                      <td>{a.code} — {a.name}</td>
                      <td className="text-right">{a.balance > 0 ? `(${fmt(a.balance)})` : fmt(a.balance)}</td>
                    </tr>
                  ))}
                  <tr className="report-row report-subtotal">
                    <td>Total COGS</td>
                    <td className="text-right amount-neg">({fmt(totalCOGS)})</td>
                  </tr>
                  <tr className="report-row report-subtotal" style={{ fontWeight: 700, background: 'var(--green-light)' }}>
                    <td>Gross Profit</td>
                    <td className={`text-right ${grossProfit >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(grossProfit)}</td>
                  </tr>
                </>
              )}

              {/* Operating Expenses (accounts 6000+) */}
              {hasOpExp && (
                <>
                  <tr><td colSpan={2} style={{ height: 10 }} /></tr>
                  <tr><td colSpan={2}><div className="report-section-title">💸 {hasCOGS ? 'Operating Expenses' : 'Expenses'}</div></td></tr>
                  {opExpAccs.map(a => (
                    <tr key={a.id} className="report-row report-group">
                      <td>{a.code} — {a.name}</td>
                      <td className="text-right">{a.balance > 0 ? `(${fmt(a.balance)})` : fmt(a.balance)}</td>
                    </tr>
                  ))}
                  <tr className="report-row report-subtotal">
                    <td>{hasCOGS ? 'Total Operating Expenses' : 'Total Expenses'}</td>
                    <td className="text-right amount-neg">({fmt(hasCOGS ? totalOpExp : totalExpenses)})</td>
                  </tr>
                </>
              )}

              {/* If no COGS split, show all expenses together */}
              {!hasCOGS && !hasOpExp && allExpAccs.length > 0 && (
                <>
                  <tr><td colSpan={2} style={{ height: 10 }} /></tr>
                  <tr><td colSpan={2}><div className="report-section-title">💸 Expenses</div></td></tr>
                  {allExpAccs.map(a => (
                    <tr key={a.id} className="report-row report-group">
                      <td>{a.code} — {a.name}</td>
                      <td className="text-right">{a.balance > 0 ? `(${fmt(a.balance)})` : fmt(a.balance)}</td>
                    </tr>
                  ))}
                  <tr className="report-row report-subtotal">
                    <td>Total Expenses</td>
                    <td className="text-right amount-neg">({fmt(totalExpenses)})</td>
                  </tr>
                </>
              )}

              <tr><td colSpan={2} style={{ height: 14 }} /></tr>
              <tr className="report-total">
                <td>NET INCOME / (LOSS)</td>
                <td className={`text-right ${netIncome >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(netIncome)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Balance Sheet ─────────────────────────────────────────────────
function BalanceSheetView({ data }) {
  const revenueTotal = data.accounts.filter(a => a.type === 'Revenue').reduce((s, a) => s + a.balance, 0)
  const expenseTotal = data.accounts.filter(a => a.type === 'Expense').reduce((s, a) => s + a.balance, 0)
  const netIncome    = revenueTotal - expenseTotal

  const currentAssets    = data.accounts.filter(a => a.type === 'Asset'     && parseInt(a.code || '0') < 1400)
  const nonCurrentAssets = data.accounts.filter(a => a.type === 'Asset'     && parseInt(a.code || '0') >= 1400)
  const currentLiabs     = data.accounts.filter(a => a.type === 'Liability' && parseInt(a.code || '0') < 2100)
  const nonCurrentLiabs  = data.accounts.filter(a => a.type === 'Liability' && parseInt(a.code || '0') >= 2100)
  const equities         = data.accounts.filter(a => a.type === 'Equity')

  const totalCurrentAssets    = currentAssets.reduce((s, a) => s + a.balance, 0)
  const totalNonCurrentAssets = nonCurrentAssets.reduce((s, a) => s + a.balance, 0)
  const totalAssets           = totalCurrentAssets + totalNonCurrentAssets
  const totalCurrentLiabs     = currentLiabs.reduce((s, a) => s + a.balance, 0)
  const totalNonCurrentLiabs  = nonCurrentLiabs.reduce((s, a) => s + a.balance, 0)
  const totalLiabilities      = totalCurrentLiabs + totalNonCurrentLiabs
  const totalEquity           = equities.reduce((s, a) => s + a.balance, 0) + netIncome
  const totalLiabEquity       = totalLiabilities + totalEquity
  const balanced              = Math.abs(totalAssets - totalLiabEquity) < 0.01

  const AccRow = ({ acc }) => (
    <tr className="report-row report-group">
      <td>{acc.code} — {acc.name}</td>
      <td className="text-right">{fmt(acc.balance)}</td>
    </tr>
  )

  const SubGroup = ({ label, accounts, total }) => accounts.length === 0 ? null : (
    <>
      <tr>
        <td colSpan={2} style={{ paddingLeft: 14, paddingTop: 10, paddingBottom: 2, fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          {label}
        </td>
      </tr>
      {accounts.map(a => <AccRow key={a.id} acc={a} />)}
      <tr className="report-row" style={{ background: '#f9fafb' }}>
        <td style={{ paddingLeft: 28 }}>Total {label}</td>
        <td className="text-right" style={{ fontWeight: 600 }}>{fmt(total)}</td>
      </tr>
    </>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <ReportHeader title="Balance Sheet" />
      <div className="card">
        <div className="table-wrap">
          <table>
            <tbody>
              {/* Assets */}
              <tr><td colSpan={2}><div className="report-section-title">🏦 Assets</div></td></tr>
              <SubGroup label="Current Assets"    accounts={currentAssets}    total={totalCurrentAssets} />
              <SubGroup label="Non-Current Assets" accounts={nonCurrentAssets} total={totalNonCurrentAssets} />
              <tr className="report-row report-subtotal">
                <td>TOTAL ASSETS</td>
                <td className="text-right">{fmt(totalAssets)}</td>
              </tr>

              <tr><td colSpan={2} style={{ height: 16 }} /></tr>

              {/* Liabilities */}
              <tr><td colSpan={2}><div className="report-section-title">📋 Liabilities</div></td></tr>
              <SubGroup label="Current Liabilities"     accounts={currentLiabs}    total={totalCurrentLiabs} />
              <SubGroup label="Non-Current Liabilities" accounts={nonCurrentLiabs} total={totalNonCurrentLiabs} />
              <tr className="report-row report-subtotal">
                <td>TOTAL LIABILITIES</td>
                <td className="text-right">{fmt(totalLiabilities)}</td>
              </tr>

              <tr><td colSpan={2} style={{ height: 16 }} /></tr>

              {/* Equity */}
              <tr><td colSpan={2}><div className="report-section-title">💼 Equity</div></td></tr>
              {equities.map(a => <AccRow key={a.id} acc={a} />)}
              {netIncome !== 0 && (
                <tr className="report-row report-group">
                  <td>Net Income (Current Period)</td>
                  <td className={`text-right ${netIncome >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(netIncome)}</td>
                </tr>
              )}
              <tr className="report-row report-subtotal">
                <td>TOTAL EQUITY</td>
                <td className="text-right">{fmt(totalEquity)}</td>
              </tr>

              <tr><td colSpan={2} style={{ height: 16 }} /></tr>

              <tr className="report-total">
                <td>TOTAL LIABILITIES + EQUITY</td>
                <td className={`text-right ${balanced ? 'amount-pos' : 'amount-neg'}`}>{fmt(totalLiabEquity)}</td>
              </tr>
              <tr>
                <td colSpan={2} className="text-muted text-sm" style={{ paddingTop: 6 }}>
                  {balanced ? '✅ Balance sheet balances' : '⚠️ Out of balance — check your entries'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Cash Flow Statement ───────────────────────────────────────────
function CashFlowStatement({ data }) {
  const cashAcc = data.accounts.find(a => a.id === 'a1' || a.code === '1000')
  const cashId  = cashAcc?.id

  // Direct sources (not posted as journal entries)
  const cashFromCustomers = data.invoices
    .filter(i => i.status === 'paid')
    .reduce((s, i) => s + i.total, 0)

  const cashPaidExpenses = data.expenses.reduce((s, e) => s + e.amount, 0)

  // Journal entries that touch cash
  let operatingJE = 0, investingJE = 0, financingJE = 0
  const opLines  = []
  const invLines = []
  const finLines = []

  ;(data.transactions || []).forEach(txn => {
    const cashEntries = txn.entries.filter(e => e.accountId === cashId)
    if (!cashEntries.length) return

    const cashDelta = cashEntries.reduce((s, e) => s + (e.debit - e.credit), 0)
    if (Math.abs(cashDelta) < 0.01) return

    const nonCashEntries = txn.entries.filter(e => e.accountId !== cashId)
    let opWt = 0, invWt = 0, finWt = 0

    nonCashEntries.forEach(nce => {
      const acc  = data.accounts.find(a => a.id === nce.accountId)
      const code = parseInt(acc?.code || '0')
      const wt   = nce.debit + nce.credit

      if (!acc || acc.type === 'Revenue' || acc.type === 'Expense') {
        opWt += wt
      } else if (acc.type === 'Asset' && code < 1400) {
        opWt += wt
      } else if (acc.type === 'Asset' && code >= 1400) {
        invWt += wt
      } else if (acc.type === 'Liability' && code < 2100) {
        opWt += wt
      } else {
        finWt += wt
      }
    })

    const total = (opWt + invWt + finWt) || 1
    const label  = txn.description || txn.ref

    if (opWt > 0) {
      const p = (opWt / total) * cashDelta
      operatingJE += p
      opLines.push({ label, amount: p })
    }
    if (invWt > 0) {
      const p = (invWt / total) * cashDelta
      investingJE += p
      invLines.push({ label, amount: p })
    }
    if (finWt > 0) {
      const p = (finWt / total) * cashDelta
      financingJE += p
      finLines.push({ label, amount: p })
    }
  })

  const totalOperating = cashFromCustomers - cashPaidExpenses + operatingJE
  const totalInvesting = investingJE
  const totalFinancing = financingJE
  const netChange      = totalOperating + totalInvesting + totalFinancing
  const endingCash     = cashAcc?.balance || 0
  const beginningCash  = endingCash - netChange

  const AmtCell = ({ amount }) => (
    <td className={`text-right ${amount >= 0 ? 'amount-pos' : 'amount-neg'}`}>
      {amount >= 0 ? fmt(amount) : `(${fmt(Math.abs(amount))})`}
    </td>
  )

  const SectionTotal = ({ label, amount }) => (
    <tr className="report-row report-subtotal">
      <td>{label}</td>
      <AmtCell amount={amount} />
    </tr>
  )

  const DetailRow = ({ label, amount }) => (
    <tr className="report-row report-group">
      <td style={{ paddingLeft: 32 }}>{label}</td>
      <AmtCell amount={amount} />
    </tr>
  )

  const EmptyRow = () => (
    <tr className="report-row report-group">
      <td style={{ paddingLeft: 32, color: 'var(--text-muted)' }}>No activity recorded</td>
      <td className="text-right text-muted">—</td>
    </tr>
  )

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <ReportHeader title="Cash Flow Statement" />

      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#0369a1' }}>
        ℹ️ <strong>Hybrid method.</strong> Operating activities include paid invoices and direct expenses. Journal entries are classified by contra-account type (operating / investing / financing).
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <tbody>
              {/* Operating */}
              <tr><td colSpan={2}><div className="report-section-title">⚙️ Operating Activities</div></td></tr>
              {cashFromCustomers > 0 && <DetailRow label="Cash received from customers" amount={cashFromCustomers} />}
              {cashPaidExpenses  > 0 && <DetailRow label="Cash paid for expenses"       amount={-cashPaidExpenses} />}
              {opLines.map((l, i) => <DetailRow key={i} label={l.label} amount={l.amount} />)}
              {cashFromCustomers === 0 && cashPaidExpenses === 0 && opLines.length === 0 && <EmptyRow />}
              <SectionTotal label="Net Cash from Operating Activities" amount={totalOperating} />

              <tr><td colSpan={2} style={{ height: 14 }} /></tr>

              {/* Investing */}
              <tr><td colSpan={2}><div className="report-section-title">🏗️ Investing Activities</div></td></tr>
              {invLines.length === 0 && <EmptyRow />}
              {invLines.map((l, i) => <DetailRow key={i} label={l.label} amount={l.amount} />)}
              <SectionTotal label="Net Cash from Investing Activities" amount={totalInvesting} />

              <tr><td colSpan={2} style={{ height: 14 }} /></tr>

              {/* Financing */}
              <tr><td colSpan={2}><div className="report-section-title">💼 Financing Activities</div></td></tr>
              {finLines.length === 0 && <EmptyRow />}
              {finLines.map((l, i) => <DetailRow key={i} label={l.label} amount={l.amount} />)}
              <SectionTotal label="Net Cash from Financing Activities" amount={totalFinancing} />

              <tr><td colSpan={2} style={{ height: 18 }} /></tr>

              <tr className="report-row report-subtotal">
                <td>Net Increase / (Decrease) in Cash</td>
                <AmtCell amount={netChange} />
              </tr>
              <tr className="report-row report-group">
                <td style={{ paddingLeft: 32 }}>Cash, Beginning of Period</td>
                <td className="text-right">{fmt(beginningCash)}</td>
              </tr>
              <tr className="report-total">
                <td>Cash, End of Period</td>
                <td className={`text-right ${endingCash >= 0 ? 'amount-pos' : 'amount-neg'}`}>{fmt(endingCash)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Closing Entries ───────────────────────────────────────────────
function ClosingEntries({ data, addTransaction }) {
  const [confirm, setConfirm] = useState(false)
  const [posted,  setPosted]  = useState(false)

  const revenueAccs = data.accounts.filter(a => a.type === 'Revenue' && a.balance !== 0)
  const expenseAccs = data.accounts.filter(a => a.type === 'Expense' && a.balance !== 0)
  const retainedEarnings = data.accounts.find(a =>
    a.id === 'a9' || a.name?.toLowerCase().includes('retained')
  )

  const totalRevenue  = revenueAccs.reduce((s, a) => s + a.balance, 0)
  const totalExpenses = expenseAccs.reduce((s, a) => s + a.balance, 0)
  const netIncome     = totalRevenue - totalExpenses
  const hasActivity   = revenueAccs.length > 0 || expenseAccs.length > 0

  const thisYear      = new Date().getFullYear()
  const alreadyPosted = (data.transactions || []).some(t => t.ref === `CLOSE-${thisYear}`)

  const doPost = () => {
    const entries = []

    // Dr each Revenue account → zero out credit balances
    revenueAccs.forEach(a => {
      entries.push({ accountId: a.id, debit: a.balance, credit: 0 })
    })

    // Cr each Expense account → zero out debit balances
    expenseAccs.forEach(a => {
      entries.push({ accountId: a.id, debit: 0, credit: a.balance })
    })

    // Net to Retained Earnings
    if (retainedEarnings) {
      if (netIncome >= 0) {
        entries.push({ accountId: retainedEarnings.id, debit: 0, credit: netIncome })
      } else {
        entries.push({ accountId: retainedEarnings.id, debit: Math.abs(netIncome), credit: 0 })
      }
    }

    addTransaction({
      id: uid(),
      date: today(),
      ref: `CLOSE-${thisYear}`,
      description: `Year-End Closing Entries — FY ${thisYear}`,
      department: '',
      entries,
    })

    setPosted(true)
    setConfirm(false)
  }

  const isPosted = posted || alreadyPosted

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <ReportHeader title="Closing Entries" subtitle={`Fiscal Year ${new Date().getFullYear()}`} />

      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 6, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#0369a1', lineHeight: 1.6 }}>
        <strong>About Closing Entries</strong><br />
        Year-end closing entries zero out all Revenue and Expense accounts and transfer the net income (or loss) to Retained Earnings — resetting the income statement for the new fiscal period.
      </div>

      {isPosted && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 16px', marginBottom: 20, color: '#166534', fontSize: 13 }}>
          ✅ Closing entries for FY {thisYear} have been posted. Revenue and expense accounts have been transferred to Retained Earnings. To reverse, delete the <strong>CLOSE-{thisYear}</strong> journal entry in Transactions.
        </div>
      )}

      {!hasActivity ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon">✅</div>
            <p>All revenue and expense accounts are already at zero. No closing entries needed.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Step 1: Close Revenue */}
          {revenueAccs.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="section-header">Step 1 — Close Revenue Accounts</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                Debit each revenue account to bring its credit balance to zero, crediting Retained Earnings.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr>
                  </thead>
                  <tbody>
                    {revenueAccs.map(a => (
                      <tr key={a.id}>
                        <td>{a.code} — {a.name}</td>
                        <td className="text-right amount-neg">{fmt(a.balance)}</td>
                        <td className="text-right text-muted">—</td>
                      </tr>
                    ))}
                    {retainedEarnings && (
                      <tr>
                        <td>{retainedEarnings.code} — {retainedEarnings.name}</td>
                        <td className="text-right text-muted">—</td>
                        <td className="text-right amount-pos">{fmt(totalRevenue)}</td>
                      </tr>
                    )}
                    <tr className="tr-total">
                      <td>Totals</td>
                      <td className="text-right">{fmt(totalRevenue)}</td>
                      <td className="text-right">{fmt(totalRevenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 2: Close Expenses */}
          {expenseAccs.length > 0 && (
            <div className="card" style={{ marginBottom: 18 }}>
              <div className="section-header">Step 2 — Close Expense Accounts</div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
                Credit each expense account to bring its debit balance to zero, debiting Retained Earnings.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr>
                  </thead>
                  <tbody>
                    {retainedEarnings && (
                      <tr>
                        <td>{retainedEarnings.code} — {retainedEarnings.name}</td>
                        <td className="text-right amount-neg">{fmt(totalExpenses)}</td>
                        <td className="text-right text-muted">—</td>
                      </tr>
                    )}
                    {expenseAccs.map(a => (
                      <tr key={a.id}>
                        <td>{a.code} — {a.name}</td>
                        <td className="text-right text-muted">—</td>
                        <td className="text-right amount-pos">{fmt(a.balance)}</td>
                      </tr>
                    ))}
                    <tr className="tr-total">
                      <td>Totals</td>
                      <td className="text-right">{fmt(totalExpenses)}</td>
                      <td className="text-right">{fmt(totalExpenses)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Step 3: Net Effect */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="section-header">Step 3 — Net Effect on Retained Earnings</div>
            <table>
              <tbody>
                <tr className="report-row report-group">
                  <td>Total Revenue Closed</td>
                  <td className="text-right amount-pos">{fmt(totalRevenue)}</td>
                </tr>
                <tr className="report-row report-group">
                  <td>Total Expenses Closed</td>
                  <td className="text-right amount-neg">({fmt(totalExpenses)})</td>
                </tr>
                <tr className="report-total">
                  <td>Net {netIncome >= 0 ? 'Income' : 'Loss'} → Retained Earnings</td>
                  <td className={`text-right ${netIncome >= 0 ? 'amount-pos' : 'amount-neg'}`}>
                    {netIncome >= 0 ? fmt(netIncome) : `(${fmt(Math.abs(netIncome))})`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Warnings */}
          {!retainedEarnings && (
            <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 6, padding: '10px 16px', marginBottom: 16, color: '#991b1b', fontSize: 13 }}>
              ⚠️ <strong>Retained Earnings account not found.</strong> Add a "Retained Earnings" (type: Equity) account to your Chart of Accounts before posting.
            </div>
          )}

          {/* Post Button */}
          {!isPosted && retainedEarnings && (
            <div style={{ textAlign: 'center', paddingBottom: 24 }}>
              {!confirm ? (
                <button className="btn btn-primary" style={{ padding: '10px 28px', fontSize: 14 }} onClick={() => setConfirm(true)}>
                  📋 Post Closing Entries
                </button>
              ) : (
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 8, padding: '20px 24px', display: 'inline-block', maxWidth: 500, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14 }}>⚠️ Confirm Posting Closing Entries</div>
                  <p style={{ fontSize: 13, color: '#78350f', marginBottom: 16, lineHeight: 1.6 }}>
                    This will post a journal entry (<strong>CLOSE-{thisYear}</strong>) that zeroes out all revenue and expense accounts and transfers the net {netIncome >= 0 ? 'income' : 'loss'} of <strong>{fmt(Math.abs(netIncome))}</strong> to Retained Earnings. You can undo this by deleting the entry from Transactions.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    <button className="btn btn-secondary" onClick={() => setConfirm(false)}>Cancel</button>
                    <button className="btn btn-primary" onClick={doPost}>✓ Confirm & Post</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function FinancialStatements() {
  const { data, addTransaction } = useApp()
  const [tab, setTab] = useState('income')

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 24 }}>
        {TABS.map(t => (
          <div key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'income'   && <IncomeStatement    data={data} />}
      {tab === 'balance'  && <BalanceSheetView   data={data} />}
      {tab === 'cashflow' && <CashFlowStatement  data={data} />}
      {tab === 'closing'  && <ClosingEntries     data={data} addTransaction={addTransaction} />}
    </div>
  )
}
