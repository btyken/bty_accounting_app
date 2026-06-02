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

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const cached = loadCache()
  const [data,    setData]    = useState(cached)
  const [appReady, setAppReady] = useState(!!cached)

  useEffect(() => {
    const unsub = onSnapshot(APP_DOC, (snap) => {
      if (snap.exists()) {
        const d = snap.data()
        // Migrate: add pettyCash array if missing from older data
        const migrated = d.pettyCash ? d : { pettyCash: [], ...d }
        if (!d.pettyCash) setDoc(APP_DOC, migrated)
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
  const nextInvoiceNum = useCallback(() =>
    'INV-' + pad(data.invoices.length + 1), [data])

  const addInvoice = useCallback((inv) => {
    const newInv = { id: uid(), number: nextInvoiceNum(), status: 'draft', ...inv }
    persist({ ...data, invoices: [...data.invoices, newInv] })
  }, [data, persist, nextInvoiceNum])

  const updateInvoice = useCallback((id, changes) => {
    const next = { ...data }
    next.invoices = data.invoices.map(i => {
      if (i.id !== id) return i
      const updated = { ...i, ...changes }
      if (changes.status === 'paid' && i.status !== 'paid') {
        next.accounts = data.accounts.map(a => {
          if (a.id === 'a1')  return { ...a, balance: a.balance + i.total }
          if (a.id === 'a10') return { ...a, balance: a.balance + i.total }
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
  const nextExpNum = useCallback(() =>
    'EXP-' + pad(data.expenses.length + 1), [data])

  const addExpense = useCallback((exp) => {
    const newExp = { id: uid(), number: nextExpNum(), ...exp }
    const next = { ...data }
    next.expenses = [...data.expenses, newExp]
    next.accounts = data.accounts.map(a => {
      if (a.id === exp.accountId) return { ...a, balance: a.balance + exp.amount }
      if (a.id === 'a1')          return { ...a, balance: a.balance - exp.amount }
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
      if (a.id === exp.accountId) return { ...a, balance: a.balance - exp.amount }
      if (a.id === 'a1')          return { ...a, balance: a.balance + exp.amount }
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
          if (a.id === exp.accountId) return { ...a, balance: a.balance - exp.amount }
          if (a.id === 'a1')          return { ...a, balance: a.balance + exp.amount }
          return a
        })
      })
    }
    records.forEach(exp => {
      accounts = accounts.map(a => {
        if (a.id === exp.accountId) return { ...a, balance: a.balance + exp.amount }
        if (a.id === 'a1')          return { ...a, balance: a.balance - exp.amount }
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
      return { ...a, balance: a.balance + delta }
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
      return { ...a, balance: a.balance - delta }
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
            return { ...a, balance: a.balance - delta }
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
          return { ...a, balance: a.balance + delta }
        })
      })
    })
    next.accounts = accounts
    next.transactions = mode === 'replace' ? records : [...data.transactions, ...records]
    persist(next)
  }, [data, persist])

  // ── Petty Cash ───────────────────────────────────────────────
  const nextPCNum = useCallback(() =>
    'PC-' + pad((data.pettyCash?.length || 0) + 1), [data])

  const addPettyCash = useCallback((item) => {
    const newItem = { id: uid(), number: nextPCNum(), ...item }
    persist({ ...data, pettyCash: [...(data.pettyCash || []), newItem] })
  }, [data, persist, nextPCNum])

  const deletePettyCash = useCallback((id) => {
    persist({ ...data, pettyCash: (data.pettyCash || []).filter(p => p.id !== id) })
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
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
