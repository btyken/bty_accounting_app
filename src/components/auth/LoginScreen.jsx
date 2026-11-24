import React, { useState } from 'react'
import { useAuth } from '../../store/AuthContext'
import logo from '../../assets/name-logo.svg'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

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
    <div className="login-page">
      <div className="login-card">
        <img src={logo} alt="Spartan BTY Inc." className="login-logo" />

        <div className="login-title">Welcome back</div>
        <div className="login-sub">Sign in to Spartan BTY Accounting.</div>

        {loginError && (
          <div className="login-error">
            <AlertCircle size={15} strokeWidth={2} /> {loginError}
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
                style={{ paddingRight: 44 }}
              />
              <button
                type="button"
                className="pw-toggle"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn btn-primary login-btn">
            {loading ? <><Loader2 size={16} className="spin" /> Signing in…</> : 'Sign In'}
          </button>
        </form>
      </div>
      <div className="login-foot">© {new Date().getFullYear()} Spartan BTY Inc.</div>
    </div>
  )
}
