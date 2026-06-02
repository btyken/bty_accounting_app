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
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #111111 0%, #000000 100%)',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.35)',
        width: 400, maxWidth: '90vw', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #111111, #333333)',
          padding: '32px 36px 28px', textAlign: 'center',
        }}>
          <img src={logo} alt="BTY Logo" style={{ width: 56, height: 56, marginBottom: 8, objectFit: 'contain' }} />
          <div style={{ color: '#fff', fontSize: 22, fontWeight: 700, letterSpacing: '-.3px' }}>
            <span style={{ color: '#ffffff' }}>●</span> BTY Accounting App
          </div>
          <div style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }}>Accounting Platform</div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '32px 36px 36px' }}>
          <div style={{ marginBottom: 8, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>Sign in</div>
          <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>Enter your credentials to access your books.</div>

          {loginError && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', marginBottom: 18, color: '#dc2626', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              ⚠️ {loginError}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              autoComplete="username"
              autoFocus
              onChange={e => { setUsername(e.target.value); setLoginError('') }}
              placeholder="Enter your username"
              style={{
                width: '100%', padding: '10px 14px', border: '1.5px solid #e5e7eb',
                borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = '#111111'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                autoComplete="current-password"
                onChange={e => { setPassword(e.target.value); setLoginError('') }}
                placeholder="Enter your password"
                style={{
                  width: '100%', padding: '10px 42px 10px 14px', border: '1.5px solid #e5e7eb',
                  borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color .15s',
                }}
                onFocus={e => e.target.style.borderColor = '#111111'}
                onBlur={e => e.target.style.borderColor = '#e5e7eb'}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af',
                }}
              >
                {showPw ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px', background: loading ? '#555555' : '#111111',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? '⏳ Signing in…' : '🔓 Sign In'}
          </button>

          <div style={{ marginTop: 20, padding: '12px 14px', background: '#f3f4f6', borderRadius: 8, fontSize: 12, color: '#374151' }}>
            <strong>Default credentials:</strong> username <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>admin</code> / password <code style={{ background: '#e5e7eb', padding: '1px 5px', borderRadius: 4 }}>admin123</code>
          </div>
        </form>
      </div>
    </div>
  )
}
