import React from 'react'
import { useAuth } from '../../store/AuthContext'
import {
  LayoutDashboard, BookOpen, ArrowLeftRight, Edit3, FileText, CreditCard, Wallet,
  Hash, BookMarked, FileBarChart2, TrendingUp, Scale, ClipboardList, CalendarRange,
  Users, LogOut, ShieldCheck, User,
} from 'lucide-react'

const NAV = [
  { section: 'Overview', items: [{ id: 'dashboard', Icon: LayoutDashboard, label: 'Dashboard' }] },
  {
    section: 'Accounting',
    items: [
      { id: 'accounts',     Icon: BookOpen,        label: 'Chart of Accounts' },
      { id: 'transactions', Icon: ArrowLeftRight,  label: 'Journal Entry' },
      { id: 'adjusting',   Icon: Edit3,            label: 'Adjusting Entries' },
    ],
  },
  {
    section: 'Money In / Out',
    items: [
      { id: 'invoices',  Icon: FileText,  label: 'Invoices' },
      { id: 'expenses',  Icon: CreditCard, label: 'Expenses' },
      { id: 'pettycash', Icon: Wallet,    label: 'Petty Cash' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { id: 'trialbalance', Icon: Hash,          label: 'Trial Balance' },
      { id: 'gl',           Icon: BookMarked,    label: 'General Ledger' },
      { id: 'financial',    Icon: FileBarChart2, label: 'Financial Statements' },
      { id: 'pl',           Icon: TrendingUp,    label: 'Profit & Loss' },
      { id: 'balance',      Icon: Scale,         label: 'Balance Sheet' },
      { id: 'expreport',    Icon: ClipboardList, label: 'Expense Report' },
      { id: 'aging',        Icon: CalendarRange, label: 'Aging Reports' },
    ],
  },
]

export default function Sidebar({ page, onNavigate }) {
  const { currentUser, logout, isAdmin, reportAccess } = useAuth()

  return (
    <nav className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'linear-gradient(135deg,#b8923f,#9a7a32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ color: '#0b0b0c', fontWeight: 900, fontSize: 14, letterSpacing: '-0.5px' }}>S</span>
          </div>
          <div>
            <div style={{ color: 'var(--side-text-hi)', fontWeight: 700, fontSize: 12.5, letterSpacing: '.06em' }}>SPARTAN BTY</div>
            <div style={{ color: 'var(--side-text)', fontSize: 10, marginTop: 1 }}>Accounting</div>
          </div>
        </div>
      </div>

      {NAV.map(({ section, items }) => {
        const visibleItems = section === 'Reports'
          ? items.filter(({ id }) => reportAccess.includes(id))
          : items
        if (visibleItems.length === 0) return null
        return (
          <div className="sidebar-section" key={section}>
            <div className="sidebar-label">{section}</div>
            {visibleItems.map(({ id, Icon, label }) => (
              <div
                key={id}
                className={`nav-item${page === id ? ' active' : ''}`}
                onClick={() => onNavigate(id)}
              >
                <span className="nav-icon">
                  <Icon size={15} strokeWidth={1.75} style={{ color: page === id ? 'var(--gold)' : 'var(--side-text)' }} />
                </span>
                {label}
              </div>
            ))}
          </div>
        )
      })}

      {/* Settings — admin only */}
      {isAdmin && (
        <div className="sidebar-section">
          <div className="sidebar-label">Settings</div>
          <div
            className={`nav-item${page === 'users' ? ' active' : ''}`}
            onClick={() => onNavigate('users')}
          >
            <span className="nav-icon">
              <Users size={15} strokeWidth={1.75} style={{ color: page === 'users' ? 'var(--gold)' : 'var(--side-text)' }} />
            </span>
            User Management
          </div>
        </div>
      )}

      {/* User info + logout */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,.07)', padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', background: 'rgba(184,146,63,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: 'var(--gold)', flexShrink: 0,
          }}>
            {currentUser?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: 'var(--side-text-hi)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.username}
            </div>
            <div style={{ color: 'var(--side-text)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              {currentUser?.role === 'admin'
                ? <><ShieldCheck size={10} strokeWidth={2} /> Admin</>
                : <><User size={10} strokeWidth={2} /> Member</>
              }
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,.05)',
            border: '1px solid rgba(255,255,255,.1)', borderRadius: 6,
            color: 'var(--side-text)', fontSize: 12.5, cursor: 'pointer', fontWeight: 500,
            transition: 'background .15s, color .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.color = 'var(--side-text-hi)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = 'var(--side-text)'; }}
        >
          <LogOut size={12} strokeWidth={1.75} />
          Sign Out
        </button>
      </div>
    </nav>
  )
}
