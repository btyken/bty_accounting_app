import {
  LayoutDashboard, BookOpen, ArrowLeftRight, Edit3, FileText, CreditCard, Wallet,
  Hash, BookMarked, FileBarChart2, TrendingUp, ClipboardList, CalendarRange, Users,
} from 'lucide-react'

export const NAV = [
  { section: 'Overview', items: [{ id: 'dashboard', Icon: LayoutDashboard, label: 'Dashboard' }] },
  {
    section: 'Accounting',
    items: [
      { id: 'accounts',     Icon: BookOpen,       label: 'Chart of Accounts' },
      { id: 'transactions', Icon: ArrowLeftRight, label: 'Journal Entry' },
      { id: 'adjusting',    Icon: Edit3,          label: 'Adjusting Entries' },
    ],
  },
  {
    section: 'Money In / Out',
    items: [
      { id: 'invoices',  Icon: FileText,   label: 'Invoices' },
      { id: 'expenses',  Icon: CreditCard, label: 'Expenses' },
      { id: 'pettycash', Icon: Wallet,     label: 'Petty Cash' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { id: 'trialbalance', Icon: Hash,          label: 'Trial Balance' },
      { id: 'gl',           Icon: BookMarked,    label: 'General Ledger' },
      { id: 'financial',    Icon: FileBarChart2, label: 'Financial Statements' },
      { id: 'pl',           Icon: TrendingUp,    label: 'Profit & Loss' },
      { id: 'expreport',    Icon: ClipboardList, label: 'Expense Report' },
      { id: 'aging',        Icon: CalendarRange, label: 'Aging Reports' },
    ],
  },
]

export const SETTINGS_NAV = { section: 'Settings', items: [{ id: 'users', Icon: Users, label: 'User Management' }] }

export const TITLES = {
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

export function sectionOf(page) {
  for (const group of [...NAV, SETTINGS_NAV]) {
    if (group.items.some(i => i.id === page)) return group.section
  }
  return ''
}
