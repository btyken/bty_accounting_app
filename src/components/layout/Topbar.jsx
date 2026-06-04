import React from 'react'

const TITLES = {
  dashboard:    'Dashboard',
  accounts:     'Chart of Accounts',
  transactions: 'Journal Entry',
  adjusting:    'Adjusting Entries',
  invoices:     'Invoices',
  expenses:     'Expenses',
  pl:           'Profit & Loss',
  balance:      'Balance Sheet',
  expreport:    'Expense Report',
  pettycash:    'Petty Cash Liquidation',
  financial:    'Financial Statements',
  gl:           'General Ledger',
  trialbalance: 'Trial Balance',
  aging:        'Aging Reports',
  users:        'User Management',
}

export default function Topbar({ page, actions }) {
  return (
    <div className="topbar">
      <div className="topbar-title">{TITLES[page] || page}</div>
      <div className="topbar-actions">{actions}</div>
    </div>
  )
}
