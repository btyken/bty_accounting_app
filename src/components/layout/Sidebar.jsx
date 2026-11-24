import React from 'react'
import { useAuth } from '../../store/AuthContext'
import { LogOut, ShieldCheck, User, Users } from 'lucide-react'
import { NAV } from './nav'
import logoFull from '../../assets/logo-full.svg'
import logoMark from '../../assets/logo-mark-dark.svg'

export default function Sidebar({ page, onNavigate, collapsed }) {
  const { currentUser, logout, isAdmin, reportAccess } = useAuth()

  return (
    <nav className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <img src={logoFull} alt="Spartan BTY Inc." className="brand-logo" />
        <img src={logoMark} alt="Spartan BTY Inc." className="brand-logo-mark" />
        <div className="brand-sub">Accounting</div>
      </div>

      <div className="sidebar-scroll">
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
                  title={collapsed ? label : undefined}
                >
                  <span className="nav-icon"><Icon size={17} strokeWidth={1.75} /></span>
                  <span className="nav-label">{label}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Footer: user + outlined actions (Shuffle-style) */}
      <div className="sidebar-footer">
        <div className="user-chip" title={collapsed ? currentUser?.username : undefined}>
          <div className="avatar">{currentUser?.username?.[0]?.toUpperCase() || '?'}</div>
          <div className="user-meta">
            <div className="user-name">{currentUser?.username}</div>
            <div className="user-role">
              {currentUser?.role === 'admin'
                ? <><ShieldCheck size={11} strokeWidth={2} /> Admin</>
                : <><User size={11} strokeWidth={2} /> Member</>}
            </div>
          </div>
        </div>

        {isAdmin && (
          <button
            className={`side-btn side-btn-ink${page === 'users' ? ' active' : ''}`}
            onClick={() => onNavigate('users')}
            title={collapsed ? 'User Management' : undefined}
          >
            <Users size={16} strokeWidth={1.9} />
            <span className="nav-label">User Management</span>
          </button>
        )}
        <button className="side-btn side-btn-danger" onClick={logout} title={collapsed ? 'Sign Out' : undefined}>
          <LogOut size={16} strokeWidth={1.9} />
          <span className="nav-label">Sign Out</span>
        </button>
      </div>
    </nav>
  )
}
