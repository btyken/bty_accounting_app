import React, { useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import logo from '../../assets/logo.svg'

export default function LoginScreen() {
  const { login, loginError, setLoginError } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    await login(username, password)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* ── Left panel — mirrors the sidebar ── */}
      <div style={{
        width: 260,
        minWidth: 260,
        background: '#111111',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 28px',
        color: '#b0b0b0',
      }}>
        {/* Logo — identical to the sidebar */}
        <div style={{ width: '100%', borderBottom: '1px solid rgba(255,255,255,.08)', paddingBottom: 20, marginBottom: 28 }}>
          <img
            src={logo}
            alt="Spartan BTY Inc."
            style={{ width: '100%', maxWidth: 160, display: 'block', margin: '0 auto', filter: 'invert(1)' }}
          />
        </div>

        {/* Nav items (decorative, matching sidebar look) */}
        {[
          { section: 'Overview',      items: [{ icon: '📊', label: 'Dashboard' }] },
          { section: 'Accounting',    items: [{ icon: '📒', label: 'Chart of Accounts' }, { icon: '↕️', label: 'Transactions' }] },
          { section: 'Money In/Out',  items: [{ icon: '🧾', label: 'Invoices' }, { icon: '💳', label: 'Expenses' }, { icon: '💵', label: 'Petty Cash' }] },
          { section: 'Reports',       items: [{ icon: '📈', label: 'Profit & Loss' }, { icon: '⚖️', label: 'Balance Sheet' }] },
        ].map(({ section, items }) => (
          <div key={section} style={{ width: '100%', marginBottom: 4 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.08em', color: '#555', padding: '6px 0 4px' }}>
              {section}
            </div>
            {items.map(({ icon, label }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 6,
                color: '#666', fontSize: 13,
              }}>
                <span style={{ width: 20, textAlign: 'center', fontSize: 14 }}>{icon}</span>
                {label}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* ── Right panel — content area ── */}
      <div style={{
        flex: 1,
        background: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,.12)',
          width: '100%',
          maxWidth: 400,
          padding: '32px 36px 36px',
        }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Sign in</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
            Enter your credentials to continue.
          </div>

          {loginError && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7,
              padding: '10px 14px', marginBottom: 18, color: '#dc2626', fontSize: 13,
            }}>
              ⚠️ {loginError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                value={username}
                autoComplete="username"
                autoFocus
                onChange={e => { setUsername(e.target.value); setLoginError('') }}
                placeholder="Enter your username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  onChange={e => { setPassword(e.target.value); setLoginError('') }}
                  placeholder="Enter your password"
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#9ca3af',
                    lineHeight: 1,
                  }}
                  tabIndex={-1}
                >
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center', marginTop: 6 }}
            >
              {loading ? '⏳ Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{
            marginTop: 22,
            padding: '11px 14px',
            background: '#f3f4f6',
            borderRadius: 7,
            fontSize: 12,
            color: '#374151',
            borderLeft: '3px solid #111111',
          }}>
            <strong>Default credentials</strong><br />
            <span style={{ color: '#6b7280' }}>Username:</span>{' '}
            <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>admin</code>
            {'  '}
            <span style={{ color: '#6b7280' }}>Password:</span>{' '}
            <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>admin123</code>
          </div>
        </div>
      </div>
    </div>
  )
}
