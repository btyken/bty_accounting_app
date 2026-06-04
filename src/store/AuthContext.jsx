import React, { createContext, useContext, useState, useEffect } from 'react'
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

export const REPORT_OPTIONS = [
  { id: 'trialbalance', label: 'Trial Balance' },
  { id: 'gl',           label: 'General Ledger' },
  { id: 'financial',    label: 'Financial Statements' },
  { id: 'pl',           label: 'Profit & Loss' },
  { id: 'balance',      label: 'Balance Sheet' },
  { id: 'expreport',    label: 'Expense Report' },
  { id: 'aging',        label: 'Aging Reports' },
]
const ALL_REPORT_IDS = REPORT_OPTIONS.map(r => r.id)

async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + 'qb-salt-2024')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

const SESSION = {
  get:   () => { try { return JSON.parse(localStorage.getItem('qb_session')) } catch { return null } },
  set:   (v) => localStorage.setItem('qb_session', JSON.stringify(v)),
  clear: () => localStorage.removeItem('qb_session'),
}

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [users,       setUsers]       = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loginError,  setLoginError]  = useState('')

  useEffect(() => {
    // Restore session from local storage
    const session = SESSION.get()
    if (session) setCurrentUser(session)

    // Listen to users collection in Firestore
    const unsub = onSnapshot(collection(db, 'users'), async (snap) => {
      if (snap.empty) {
        // Migrate existing localStorage users, or create default admin
        const localUsers = (() => {
          try { return JSON.parse(localStorage.getItem('qb_users')) } catch { return null }
        })()

        if (localUsers && localUsers.length > 0) {
          await Promise.all(localUsers.map(u => setDoc(doc(db, 'users', u.id), u)))
        } else {
          const hash = await hashPassword('admin123')
          const defaultAdmin = {
            id: uid(),
            username: 'admin',
            passwordHash: hash,
            role: 'admin',
            createdAt: new Date().toISOString(),
          }
          await setDoc(doc(db, 'users', defaultAdmin.id), defaultAdmin)
        }
      } else {
        setUsers(snap.docs.map(d => d.data()))
      }
    })

    return unsub
  }, [])

  const login = async (username, password) => {
    setLoginError('')
    if (!username || !password) {
      setLoginError('Please enter your username and password.')
      return false
    }
    const hash = await hashPassword(password)
    const user = users?.find(
      u => u.username.toLowerCase() === username.toLowerCase() && u.passwordHash === hash
    )
    if (!user) {
      setLoginError('Incorrect username or password.')
      return false
    }
    const session = { id: user.id, username: user.username, role: user.role }
    setCurrentUser(session)
    SESSION.set(session)
    return true
  }

  const logout = () => {
    setCurrentUser(null)
    SESSION.clear()
  }

  const addUser = async (username, password, role = 'user') => {
    if (!username.trim()) return { error: 'Username is required.' }
    if (password.length < 6) return { error: 'Password must be at least 6 characters.' }
    const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase())
    if (exists) return { error: 'Username already exists.' }
    const hash = await hashPassword(password)
    const newUser = {
      id: uid(),
      username: username.trim(),
      passwordHash: hash,
      role,
      createdAt: new Date().toISOString(),
    }
    await setDoc(doc(db, 'users', newUser.id), newUser)
    return { success: true }
  }

  const deleteUser = async (id) => {
    if (users.filter(u => u.role === 'admin').length === 1 &&
        users.find(u => u.id === id)?.role === 'admin') {
      return { error: 'Cannot delete the only admin account.' }
    }
    await deleteDoc(doc(db, 'users', id))
    return { success: true }
  }

  const changePassword = async (id, newPassword) => {
    if (!newPassword || newPassword.length < 6) return { error: 'Password must be at least 6 characters.' }
    try {
      const hash = await hashPassword(newPassword)
      await updateDoc(doc(db, 'users', id), { passwordHash: hash })
      return { success: true }
    } catch (e) {
      return { error: e.message || 'Failed to update password.' }
    }
  }

  const changeRole = async (id, newRole) => {
    if (newRole === 'user' && users.filter(u => u.role === 'admin').length === 1 &&
        users.find(u => u.id === id)?.role === 'admin') {
      return { error: 'Cannot demote the only admin account.' }
    }
    try {
      await updateDoc(doc(db, 'users', id), { role: newRole })
      return { success: true }
    } catch (e) {
      return { error: e.message || 'Failed to update role.' }
    }
  }

  const updateUserReportAccess = async (userId, reportIds) => {
    try {
      await updateDoc(doc(db, 'users', userId), { reportAccess: reportIds })
      return { success: true }
    } catch (e) {
      return { error: e.message || 'Failed to update report access.' }
    }
  }

  const isAdmin = currentUser?.role === 'admin'
  // When users haven't loaded yet, default to full access to avoid flicker on page load
  const reportAccess = isAdmin || users === null
    ? ALL_REPORT_IDS
    : (users.find(u => u.id === currentUser?.id)?.reportAccess ?? [])

  return (
    <AuthContext.Provider value={{
      users, currentUser, loginError, setLoginError,
      login, logout, addUser, deleteUser, changePassword, changeRole,
      updateUserReportAccess, reportAccess,
      isAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
