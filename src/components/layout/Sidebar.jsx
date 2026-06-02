import React from 'react'
import { useAuth } from '../../store/AuthContext'

const NAV = [
  { section: 'Overview', items: [{ id: 'dashboard', icon: '📊', label: 'Dashboard' }] },
  {
    section: 'Accounting',
    items: [
      { id: 'accounts',     icon: '📒', label: 'Chart of Accounts' },
      { id: 'transactions', icon: '↕️', label: 'Transactions' },
    ],
  },
  {
    section: 'Money In / Out',
    items: [
      { id: 'invoices', icon: '🧾', label: 'Invoices' },
      { id: 'expenses', icon: '💳', label: 'Expenses' },
    ],
  },
  {
    section: 'Reports',
    items: [
      { id: 'pl',      icon: '📈', label: 'Profit & Loss' },
      { id: 'balance', icon: '⚖️', label: 'Balance Sheet' },
    ],
  },
]

export default function Sidebar({ page, onNavigate }) {
  const { currentUser, logout, isAdmin } = useAuth()

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <span className="dot">●</span> BTY Accounting App
      </div>

      {NAV.map(({ section, items }) => (
        <div className="sidebar-section" key={section}>
          <div className="sidebar-label">{section}</div>
          {items.map(({ id, icon, label }) => (
            <div
              key={id}
              className={`nav-item${page === id ? ' active' : ''}`}
              onClick={() => onNavigate(id)}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </div>
          ))}
        </div>
      ))}

      {/* Settings — admin only */}
      {isAdmin && (
        <div className="sidebar-section">
          <div className="sidebar-label">Settings</div>
          <div
            className={`nav-item${page === 'users' ? ' active' : ''}`}
            onClick={() => onNavigate('users')}
          >
            <span className="nav-icon">👥</span>
            User Management
          </div>
        </div>
      )}

      {/* User info + logout — pinned to bottom */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,.08)', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: '#444444',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {currentUser?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser?.username}
            </div>
            <div style={{ color: '#6b8c6b', fontSize: 11, textTransform: 'capitalize' }}>
              {currentUser?.role === 'admin' ? '🛡 Admin' : '👤 User'}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '7px', background: 'rgba(255,255,255,.07)',
            border: '1px solid rgba(255,255,255,.12)', borderRadius: 6,
            color: '#cdd9cd', fontSize: 12.5, cursor: 'pointer', fontWeight: 500,
            transition: 'background .15s',
          }}
          onMouseOver={e => e.target.style.background = 'rgba(255,255,255,.13)'}
          onMouseOut={e => e.target.style.background = 'rgba(255,255,255,.07)'}
        >
          🚪 Sign Out
        </button>
      </div>
    </nav>
  )
}
