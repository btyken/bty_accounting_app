import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { doc, setDoc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { DEFAULT_ACCOUNTS } from '../data/defaults'
import { uid, pad } from '../utils/format'

const APP_DOC = doc(db, 'appData', 'main')

function migrateFromLocalStorage() {
  const get = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
  return {
    accounts:     get('qb_accounts')     || DEFAULT_ACCOUNTS,
    invoices:     get('qb_invoices')     || [],
    expenses:     get('qb_expenses')     || [],
    transactions: get('qb_transactions') || [],
    pettyCash:    [],
  }
}

const CACHE_KEY = 'qb_appdata_cache'

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) } catch { return null }
}

const r2 = (n) => Math.round(n * 100) / 100

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const cached = loadCache()
  const [data,    setData]    = useState(cached)
  const [appReady, setAppReady] = useState(!!cached)

  useEffect(() => {
    const unsub = onSnapshot(APP_DOC, (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        // Migrate: add missing fields from older data
        const needsMigration = !d.pettyCash || !('financialNotes' in d)
        // Clean up floating-point residuals on existing account balances
        const needsBalanceRounding = (d.accounts || []).some(a => a.balance !== Math.round(a.balance * 100) / 100)
        const migrated = {
          financialNotes: '',
          pettyCash: [],
          ...d,
          accounts: (d.accounts || []).map(a => ({ ...a, balance: r2(a.balance) })),
        }
        if (needsMigration || needsBalanceRounding) setDoc(APP_DOC, migrated)
        setData(migrated)
        localStorage.setItem(CACHE_KEY, JSON.stringify(migrated))
      } else {
        // First run: migrate from localStorage or use defaults
        const initial = migrateFromLocalStorage()
        setDoc(APP_DOC, initial)
        setData(initial)
        localStorage.setItem(CACHE_KEY, JSON.stringify(initial))
      }
      setAppReady(true)
    })
    return unsub
  }, [])

  const persist = useCallback((next) => {
    setData(next)
    setDoc(APP_DOC, next)
  }, [])

  // ── Accounts ────────────────────────────────────────────────
  const addAccount = useCallback((acc) => {
    persist({ ...data, accounts: [...data.accounts, { id: uid(), ...acc }] })
  }, [data, persist])

  const updateAccount = useCallback((id, changes) => {
    persist({ ...data, accounts: data.accounts.map(a => a.id === id ? { ...a, ...changes } : a) })
  }, [data, persist])

  const deleteAccount = useCallback((id) => {
    persist({ ...data, accounts: data.accounts.filter(a => a.id !== id) })
  }, [data, persist])

  const importAccounts = useCallback((records, mode) => {
    let accounts
    if (mode === 'replace') {
      accounts = records
    } else {
      const existing = new Set(data.accounts.map(a => a.code))
      accounts = [...data.accounts, ...records.filter(r => !existing.has(r.code))]
    }
    persist({ ...data, accounts })
  }, [data, persist])

  // ── Invoices ─────────────────────────────────────────────────
  const nextInvoiceNum = useCallback(() => {
    const max = data.invoices.reduce((m, i) => Math.max(m, parseInt(i.number?.replace(/\D/g, '')) || 0), 0)
    return 'INV-' + pad(max + 1)
  }, [data.invoices])

  const addInvoice = useCallback((inv) => {
    const newInv = { id: uid(), number: nextInvoiceNum(), status: 'draft', ...inv }
    persist({ ...data, invoices: [...data.invoices, newInv] })
  }, [data, persist, nextInvoiceNum])

  const updateInvoice = useCallback((id, changes) => {
    const next = { ...data }
    next.invoices = data.invoices.map(i => {
      if (i.id !== id) return i
      const updated = { ...i, ...changes }
      const goingPaid   = changes.status === 'paid' && i.status !== 'paid'
      const leavingPaid = changes.status && changes.status !== 'paid' && i.status === 'paid'
      if (goingPaid || leavingPaid) {
        const sign = goingPaid ? 1 : -1
        next.accounts = data.accounts.map(a => {
          if (a.id === 'a1'  || a.code === '1000') return { ...a, balance: r2(a.balance + sign * i.total) }
          if (a.id === 'a10' || a.code === '4000') return { ...a, balance: r2(a.balance + sign * i.total) }
          return a
        })
      }
      return updated
    })
    persist(next)
  }, [data, persist])

  const deleteInvoice = useCallback((id) => {
    persist({ ...data, invoices: data.invoices.filter(i => i.id !== id) })
  }, [data, persist])

  const importInvoices = useCallback((records, mode) => {
    const invoices = mode === 'replace' ? records : [...data.invoices, ...records]
    persist({ ...data, invoices })
  }, [data, persist])

  // ── Expenses ─────────────────────────────────────────────────
  const nextExpNum = useCallback(() => {
    const max = data.expenses.reduce((m, e) => Math.max(m, parseInt(e.number?.replace(/\D/g, '')) || 0), 0)
    return 'EXP-' + pad(max + 1)
  }, [data.expenses])

  const addExpense = useCallback((exp) => {
    const newExp = { id: uid(), number: nextExpNum(), ...exp }
    const next = { ...data }
    next.expenses = [...data.expenses, newExp]
    next.accounts = data.accounts.map(a => {
      if (a.id === exp.accountId)              return { ...a, balance: r2(a.balance + exp.amount) }
      if (a.id === 'a1' || a.code === '1000') return { ...a, balance: r2(a.balance - exp.amount) }
      return a
    })
    persist(next)
  }, [data, persist, nextExpNum])

  const updateExpenseMeta = useCallback((id, changes) => {
    persist({ ...data, expenses: data.expenses.map(e => e.id === id ? { ...e, ...changes } : e) })
  }, [data, persist])

  const deleteExpense = useCallback((id) => {
    const exp = data.expenses.find(e => e.id === id)
    if (!exp) return
    const next = { ...data }
    next.expenses = data.expenses.filter(e => e.id !== id)
    next.accounts = data.accounts.map(a => {
      if (a.id === exp.accountId)              return { ...a, balance: r2(a.balance - exp.amount) }
      if (a.id === 'a1' || a.code === '1000') return { ...a, balance: r2(a.balance + exp.amount) }
      return a
    })
    persist(next)
  }, [data, persist])

  const importExpenses = useCallback((records, mode) => {
    const next = { ...data }
    let accounts = [...next.accounts]
    if (mode === 'replace') {
      data.expenses.forEach(exp => {
        accounts = accounts.map(a => {
          if (a.id === exp.accountId)              return { ...a, balance: r2(a.balance - exp.amount) }
          if (a.id === 'a1' || a.code === '1000') return { ...a, balance: r2(a.balance + exp.amount) }
          return a
        })
      })
    }
    records.forEach(exp => {
      accounts = accounts.map(a => {
        if (a.id === exp.accountId)              return { ...a, balance: r2(a.balance + exp.amount) }
        if (a.id === 'a1' || a.code === '1000') return { ...a, balance: r2(a.balance - exp.amount) }
        return a
      })
    })
    next.accounts = accounts
    next.expenses = mode === 'replace' ? records : [...data.expenses, ...records]
    persist(next)
  }, [data, persist])

  // ── Transactions ─────────────────────────────────────────────
  const addTransaction = useCallback((txn) => {
    const next = { ...data }
    next.transactions = [...data.transactions, txn]
    next.accounts = data.accounts.map(a => {
      const entries = txn.entries.filter(e => e.accountId === a.id)
      if (!entries.length) return a
      const delta = entries.reduce((s, e) => {
        if (a.type === 'Asset' || a.type === 'Expense') return s + e.debit - e.credit
        return s + e.credit - e.debit
      }, 0)
      return { ...a, balance: r2(a.balance + delta) }
    })
    persist(next)
  }, [data, persist])

  const deleteTransaction = useCallback((id) => {
    const txn = data.transactions.find(t => t.id === id)
    if (!txn) return
    const next = { ...data }
    next.transactions = data.transactions.filter(t => t.id !== id)
    next.accounts = data.accounts.map(a => {
      const entries = txn.entries.filter(e => e.accountId === a.id)
      if (!entries.length) return a
      const delta = entries.reduce((s, e) => {
        if (a.type === 'Asset' || a.type === 'Expense') return s + e.debit - e.credit
        return s + e.credit - e.debit
      }, 0)
      return { ...a, balance: r2(a.balance - delta) }
    })
    persist(next)
  }, [data, persist])

  const updateTransactionMeta = useCallback((id, changes) => {
    persist({ ...data, transactions: data.transactions.map(t => t.id === id ? { ...t, ...changes } : t) })
  }, [data, persist])

  const importTransactions = useCallback((records, mode) => {
    const next = { ...data }
    let accounts = [...data.accounts]
    if (mode === 'replace') {
      data.transactions.forEach(txn => {
        txn.entries.forEach(e => {
          accounts = accounts.map(a => {
            if (a.id !== e.accountId) return a
            const delta = (a.type === 'Asset' || a.type === 'Expense')
              ? e.debit - e.credit : e.credit - e.debit
            return { ...a, balance: r2(a.balance - delta) }
          })
        })
      })
      next.transactions = []
    }
    records.forEach(txn => {
      txn.entries.forEach(e => {
        accounts = accounts.map(a => {
          if (a.id !== e.accountId) return a
          const delta = (a.type === 'Asset' || a.type === 'Expense')
            ? e.debit - e.credit : e.credit - e.debit
          return { ...a, balance: r2(a.balance + delta) }
        })
      })
    })
    next.accounts = accounts
    next.transactions = mode === 'replace' ? records : [...data.transactions, ...records]
    persist(next)
  }, [data, persist])

  // ── Petty Cash ───────────────────────────────────────────────
  const nextPCNum = useCallback(() => {
    const max = (data.pettyCash || []).reduce((m, p) => Math.max(m, parseInt(p.number?.replace(/\D/g, '')) || 0), 0)
    return 'PC-' + pad(max + 1)
  }, [data.pettyCash])

  const addPettyCash = useCallback((item) => {
    const newItem = { id: uid(), number: nextPCNum(), ...item }
    persist({ ...data, pettyCash: [...(data.pettyCash || []), newItem] })
  }, [data, persist, nextPCNum])

  const deletePettyCash = useCallback((id) => {
    persist({ ...data, pettyCash: (data.pettyCash || []).filter(p => p.id !== id) })
  }, [data, persist])

  // ── Clear All (admin only) ───────────────────────────────────
  const clearAccounts = useCallback(() => {
    if (!data) return
    persist({ ...data, accounts: [] })
  }, [data, persist])

  const clearInvoices = useCallback(() => {
    if (!data) return
    const paidInvoices = data.invoices.filter(i => i.status === 'paid')
    const accounts = data.accounts.map(a => {
      let balance = a.balance
      paidInvoices.forEach(inv => {
        if (a.id === 'a1')  balance -= inv.total
        if (a.id === 'a10') balance -= inv.total
      })
      return { ...a, balance }
    })
    persist({ ...data, accounts, invoices: [] })
  }, [data, persist])

  const clearExpenses = useCallback(() => {
    if (!data) return
    const accounts = data.accounts.map(a => {
      let balance = a.balance
      data.expenses.forEach(exp => {
        if (a.id === exp.accountId) balance -= exp.amount
        if (a.id === 'a1')          balance += exp.amount
      })
      return { ...a, balance }
    })
    persist({ ...data, accounts, expenses: [] })
  }, [data, persist])

  const clearTransactions = useCallback(() => {
    if (!data) return
    const accounts = data.accounts.map(a => {
      let balance = a.balance
      data.transactions.forEach(txn => {
        txn.entries.forEach(e => {
          if (e.accountId === a.id) {
            const delta = (a.type === 'Asset' || a.type === 'Expense')
              ? e.debit - e.credit : e.credit - e.debit
            balance -= delta
          }
        })
      })
      return { ...a, balance }
    })
    persist({ ...data, accounts, transactions: [] })
  }, [data, persist])

  const clearPettyCash = useCallback(() => {
    if (!data) return
    persist({ ...data, pettyCash: [] })
  }, [data, persist])

  const saveFinancialNotes = useCallback((notes) => {
    persist({ ...data, financialNotes: notes })
  }, [data, persist])

  const accName = useCallback((id) =>
    (data?.accounts.find(a => a.id === id) || {}).name || '—', [data])

  return (
    <AppContext.Provider value={{
      data,
      appReady,
      accName,
      addAccount, updateAccount, deleteAccount, importAccounts,
      addInvoice, updateInvoice, deleteInvoice, importInvoices, nextInvoiceNum,
      addExpense, updateExpenseMeta, deleteExpense, importExpenses, nextExpNum,
      addTransaction, updateTransactionMeta, deleteTransaction, importTransactions,
      addPettyCash, deletePettyCash, nextPCNum,
      saveFinancialNotes,
      clearAccounts, clearInvoices, clearExpenses, clearTransactions, clearPettyCash,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
