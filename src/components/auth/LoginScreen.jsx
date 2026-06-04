import React, { useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import logo from '../../assets/name-logo.svg'

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
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000000',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: '40px 24px',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,.4)',
        width: '100%',
        maxWidth: 400,
        padding: '36px 36px 40px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={logo}
            alt="Spartan BTY Inc."
            style={{ width: 260, display: 'block', margin: '0 auto' }}
          />
        </div>

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
      </div>
    </div>
  )
}
