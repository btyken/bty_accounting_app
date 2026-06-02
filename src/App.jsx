import React, { useState } from 'react'
import { AppProvider, useApp } from './store/AppContext'
import { AuthProvider, useAuth } from './store/AuthContext'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import LoginScreen from './components/auth/LoginScreen'
import UserManagement from './components/auth/UserManagement'
import Dashboard from './components/Dashboard'
import Accounts from './components/Accounts'
import Transactions from './components/Transactions'
import Invoices from './components/Invoices'
import Expenses from './components/Expenses'
import ProfitLoss from './components/reports/ProfitLoss'
import BalanceSheet from './components/reports/BalanceSheet'

const PRINT_PAGES = ['pl', 'balance']

function AppInner() {
  const { currentUser, users } = useAuth()
  const { appReady } = useApp()
  const [page, setPage] = useState('dashboard')

  if (!appReady || (!currentUser && users === null)) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1a2e1a', color: '#fff', fontSize: 16, gap: 12,
      }}>
        <span style={{ fontSize: 28 }}>📊</span> Loading…
      </div>
    )
  }

  // Not logged in — show login screen
  if (!currentUser) return <LoginScreen />

  const topbarActions = PRINT_PAGES.includes(page)
    ? <button className="btn btn-secondary" onClick={() => window.print()}>🖨 Print</button>
    : null

  const renderPage = () => {
    switch (page) {
      case 'dashboard':    return <Dashboard onNavigate={setPage} />
      case 'accounts':     return <Accounts />
      case 'transactions': return <Transactions />
      case 'invoices':     return <Invoices />
      case 'expenses':     return <Expenses />
      case 'pl':           return <ProfitLoss />
      case 'balance':      return <BalanceSheet />
      case 'users':        return <UserManagement />
      default:             return <Dashboard onNavigate={setPage} />
    }
  }

  return (
    <div className="app">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="main">
        <Topbar page={page} actions={topbarActions} />
        <div className="content">
          {renderPage()}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppInner />
      </AppProvider>
    </AuthProvider>
  )
}
