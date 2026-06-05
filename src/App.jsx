import React, { useState } from 'react'
import { Printer, Lock } from 'lucide-react'
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
import ExpenseReport from './components/reports/ExpenseReport'
import GeneralLedger from './components/reports/GeneralLedger'
import TrialBalance from './components/reports/TrialBalance'
import FinancialStatements from './components/reports/FinancialStatements'
import AdjustingEntries from './components/reports/AdjustingEntries'
import AgingReports from './components/reports/AgingReports'
import PettyCash from './components/PettyCash'

const PRINT_PAGES  = ['pl', 'expreport', 'gl', 'trialbalance', 'financial', 'aging']
const REPORT_PAGES = ['pl', 'expreport', 'gl', 'trialbalance', 'financial', 'aging']

function AccessRestricted() {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '40px auto' }}>
      <div className="empty">
        <div className="empty-icon"><Lock size={32} /></div>
        <p style={{ fontWeight: 600 }}>Access Restricted</p>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
          You don't have permission to view this report.<br />Contact your administrator to request access.
        </p>
      </div>
    </div>
  )
}

function AppInner() {
  const { currentUser, users, isAdmin, reportAccess } = useAuth()
  const { appReady } = useApp()
  const [page, setPage] = useState('dashboard')

  if (!appReady || (!currentUser && users === null)) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111111', color: '#fff', fontSize: 16, gap: 12,
      }}>
        Loading…
      </div>
    )
  }

  // Not logged in — show login screen
  if (!currentUser) return <LoginScreen />

  const topbarActions = PRINT_PAGES.includes(page)
    ? <button className="btn btn-secondary" onClick={() => window.print()}><Printer size={14} /> Print</button>
    : null

  const renderPage = () => {
    if (!isAdmin && REPORT_PAGES.includes(page) && !reportAccess.includes(page)) {
      return <AccessRestricted />
    }
    switch (page) {
      case 'dashboard':    return <Dashboard onNavigate={setPage} />
      case 'accounts':     return <Accounts />
      case 'transactions': return <Transactions />
      case 'invoices':     return <Invoices />
      case 'expenses':     return <Expenses />
      case 'pl':           return <ProfitLoss />
      case 'expreport':    return <ExpenseReport />
      case 'financial':    return <FinancialStatements />
      case 'gl':           return <GeneralLedger />
      case 'trialbalance': return <TrialBalance />
      case 'adjusting':    return <AdjustingEntries />
      case 'aging':        return <AgingReports />
      case 'pettycash':    return <PettyCash />
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
