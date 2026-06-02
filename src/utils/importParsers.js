import * as XLSX from 'xlsx'
import { uid, normalizeDate } from './format'

// ── Template definitions ──────────────────────────────────────
export const IMPORT_TEMPLATES = {
  accounts: {
    label: 'Chart of Accounts',
    headers: ['Code', 'Name', 'Type', 'Balance'],
    sample: [
      ['1050', 'Petty Cash', 'Asset', 500],
      ['4200', 'Consulting Revenue', 'Revenue', 0],
      ['6600', 'Travel Expense', 'Expense', 0],
    ],
    notes: 'Type must be: Asset, Liability, Equity, Revenue, or Expense',
  },
  invoices: {
    label: 'Invoices',
    headers: ['InvoiceNumber', 'Customer', 'Date', 'DueDate', 'Description', 'Qty', 'Rate', 'Notes', 'Status'],
    sample: [
      ['INV-0001', 'Acme Corp', '2024-01-15', '2024-02-15', 'Web Development', 10, 150, 'Net 30', 'sent'],
      ['INV-0001', 'Acme Corp', '2024-01-15', '2024-02-15', 'Design Services', 5, 100, 'Net 30', 'sent'],
      ['INV-0002', 'Beta LLC', '2024-02-01', '2024-03-01', 'Consulting', 8, 200, '', 'paid'],
    ],
    notes: 'Multiple rows with same InvoiceNumber = multiple line items. Status: draft, sent, paid, overdue',
  },
  expenses: {
    label: 'Expenses',
    headers: ['Date', 'Vendor', 'Category', 'Amount', 'PaymentMethod', 'Department', 'Description'],
    sample: [
      ['2024-01-10', 'Office Depot', 'Office Supplies', 85.50, 'Credit Card', 'Office Administration Department', 'Printer paper and pens'],
      ['2024-01-15', 'WeWork', 'Rent Expense', 2000, 'Bank Transfer', 'Executive Department', 'Monthly office rent'],
      ['2024-01-20', 'Google Ads', 'Marketing & Advertising', 450, 'Credit Card', 'Marketing Department', 'Ad spend Jan'],
    ],
    notes: 'Category must match an account name in your Chart of Accounts. Department is optional.',
  },
  transactions: {
    label: 'Journal Entries',
    headers: ['Reference', 'Date', 'Description', 'Department', 'Account', 'Debit', 'Credit'],
    sample: [
      ['JE-001', '2024-01-01', 'Opening entry', 'Executive Department', 'Cash', 5000, 0],
      ['JE-001', '2024-01-01', 'Opening entry', '', "Owner's Equity", 0, 5000],
      ['JE-002', '2024-01-05', 'Equipment purchase', 'Office Administration Department', 'Equipment', 1200, 0],
      ['JE-002', '2024-01-05', 'Equipment purchase', '', 'Cash', 0, 1200],
    ],
    notes: 'Multiple rows with same Reference = one journal entry. Debits must equal Credits per Reference. Department applies to the whole entry (set on first row).',
  },
}

// ── Download template ─────────────────────────────────────────
export function downloadTemplate(type) {
  const t = IMPORT_TEMPLATES[type]
  if (!t) return
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.sample])

  // Column widths
  ws['!cols'] = t.headers.map(() => ({ wch: 22 }))

  // Add notes row
  XLSX.utils.sheet_add_aoa(ws, [['NOTE: ' + t.notes]], { origin: { r: t.sample.length + 2, c: 0 } })

  XLSX.utils.book_append_sheet(wb, ws, t.label)
  XLSX.writeFile(wb, `template_${type}.xlsx`)
}

// ── Parse uploaded file ───────────────────────────────────────
export function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: false })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsBinaryString(file)
  })
}

// ── Normalize header ──────────────────────────────────────────
function normH(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g, '')
}

// ── Parse accounts ────────────────────────────────────────────
export function parseAccounts(rows) {
  if (rows.length < 2) return { records: [], errors: [] }
  const headers = rows[0].map(normH)
  const errors = []
  const records = []
  const VALID_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense']

  rows.slice(1).forEach((row, i) => {
    if (row.every(c => c === '' || c === null || c === undefined)) return
    const get = (key) => {
      const idx = headers.indexOf(normH(key))
      return idx >= 0 ? row[idx] : ''
    }
    const code = String(get('code') || get('accountnumber') || get('acccode') || '').trim()
    const name = String(get('name') || get('accountname') || '').trim()
    const type = String(get('type') || get('accounttype') || '').trim()
    const balance = parseFloat(get('balance') || get('openingbalance') || 0) || 0

    if (!name) { errors.push(`Row ${i + 2}: Missing account name`); return }
    if (!VALID_TYPES.includes(type.toLowerCase())) {
      errors.push(`Row ${i + 2}: Invalid type "${type}" — must be Asset, Liability, Equity, Revenue, or Expense`)
      return
    }

    records.push({
      id: uid(),
      code: code || String(1000 + records.length),
      name,
      type: type.charAt(0).toUpperCase() + type.slice(1).toLowerCase(),
      balance,
    })
  })
  return { records, errors }
}

// ── Parse invoices ────────────────────────────────────────────
export function parseInvoices(rows) {
  if (rows.length < 2) return { records: [], errors: [] }
  const headers = rows[0].map(normH)
  const errors = []
  const byNumber = {}

  rows.slice(1).forEach((row, i) => {
    if (row.every(c => c === '' || c === null || c === undefined)) return
    const get = (key) => {
      const idx = headers.indexOf(normH(key))
      return idx >= 0 ? row[idx] : ''
    }
    const number   = String(get('invoicenumber') || get('number') || get('invoice') || '').trim()
    const customer = String(get('customer') || get('customername') || get('client') || '').trim()
    const date     = normalizeDate(get('date') || get('invoicedate') || '')
    const dueDate  = normalizeDate(get('duedate') || get('due') || '')
    const desc     = String(get('description') || get('item') || '').trim()
    const qty      = parseFloat(get('qty') || get('quantity') || 1) || 1
    const rate     = parseFloat(get('rate') || get('price') || get('amount') || 0) || 0
    const notes    = String(get('notes') || get('memo') || '').trim()
    const status   = String(get('status') || 'draft').trim().toLowerCase()

    if (!customer) { errors.push(`Row ${i + 2}: Missing customer name`); return }
    if (!date)     { errors.push(`Row ${i + 2}: Missing or invalid date`); return }

    const key = number || `AUTO-${i}`
    if (!byNumber[key]) {
      byNumber[key] = {
        id: uid(),
        number: number || `IMP-${String(Object.keys(byNumber).length + 1).padStart(4, '0')}`,
        customer,
        date,
        dueDate,
        lineItems: [],
        notes,
        status: ['draft', 'sent', 'paid', 'overdue'].includes(status) ? status : 'draft',
        total: 0,
      }
    }
    byNumber[key].lineItems.push({ description: desc, qty, rate, amount: qty * rate })
  })

  const records = Object.values(byNumber).map(inv => ({
    ...inv,
    total: inv.lineItems.reduce((s, l) => s + l.amount, 0),
  }))

  return { records, errors }
}

// ── Parse expenses ────────────────────────────────────────────
export function parseExpenses(rows, accounts) {
  if (rows.length < 2) return { records: [], errors: [] }
  const headers = rows[0].map(normH)
  const errors = []
  const records = []

  rows.slice(1).forEach((row, i) => {
    if (row.every(c => c === '' || c === null || c === undefined)) return
    const get = (key) => {
      const idx = headers.indexOf(normH(key))
      return idx >= 0 ? row[idx] : ''
    }
    const date       = normalizeDate(get('date') || '')
    const vendor     = String(get('vendor') || get('payee') || get('vendorname') || '').trim()
    const category   = String(get('category') || get('account') || get('expensetype') || '').trim()
    const amount     = parseFloat(get('amount') || 0)
    const method     = String(get('paymentmethod') || get('method') || 'Cash').trim()
    const department = String(get('department') || get('dept') || '').trim()
    const desc       = String(get('description') || get('notes') || get('memo') || '').trim()

    if (!date)   { errors.push(`Row ${i + 2}: Missing or invalid date`); return }
    if (!vendor) { errors.push(`Row ${i + 2}: Missing vendor`); return }
    if (!amount || amount <= 0) { errors.push(`Row ${i + 2}: Invalid amount`); return }

    // Match category to account
    const acc = accounts.find(a =>
      a.name.toLowerCase() === category.toLowerCase() ||
      a.code === category
    )
    if (!acc && category) {
      errors.push(`Row ${i + 2}: Account "${category}" not found — will use first expense account`)
    }
    const fallbackAcc = accounts.find(a => a.type === 'Expense')
    const accountId = acc?.id || fallbackAcc?.id || ''

    records.push({
      id: uid(),
      number: `IMP-${String(records.length + 1).padStart(4, '0')}`,
      date,
      vendor,
      accountId,
      amount,
      method: method || 'Cash',
      department,
      description: desc,
    })
  })

  return { records, errors }
}

// ── Parse journal entries ─────────────────────────────────────
// Grouping logic: a blank reference or '↳' means this row is a
// continuation of the previous entry. A new non-empty reference
// starts a new entry. This matches the template format we export.
export function parseTransactions(rows, accounts) {
  if (rows.length < 2) return { records: [], errors: [] }
  const headers  = rows[0].map(normH)
  const errors   = []
  const warnings = []
  const entries  = []   // ordered list of logical journal entries

  let current = null

  rows.slice(1).forEach((row, i) => {
    if (row.every(c => c === '' || c === null || c === undefined)) return
    const get = (key) => {
      const idx = headers.indexOf(normH(key))
      return idx >= 0 ? row[idx] : ''
    }

    const rawRef = String(get('reference') || get('ref') || get('journalentry') || '').trim()
    const isContinuation = rawRef === '' || rawRef === '↳'
    const ref        = isContinuation ? (current?.ref || `JE-IMP-${i}`) : rawRef
    const date       = normalizeDate(get('date') || '')
    const desc       = String(get('description') || get('memo') || '').trim()
    const department = String(get('department') || get('dept') || '').trim()
    const accStr     = String(get('account') || get('accountname') || get('accountcode') || '').trim()
    const debit      = parseFloat(get('debit')  || get('dr') || 0) || 0
    const credit     = parseFloat(get('credit') || get('cr') || 0) || 0

    if (!date) { errors.push(`Row ${i + 2}: Missing date — skipped`); return }

    const acc = accounts.find(a =>
      a.name.toLowerCase() === accStr.toLowerCase() || a.code === accStr
    )
    const accountId = acc ? acc.id : accStr   // preserve raw code if not in chart

    if (!isContinuation || !current) {
      // Start a new journal entry
      current = { id: uid(), ref, date, description: desc || ref, department, entries: [] }
      entries.push(current)
    } else if (department && !current.department) {
      current.department = department
    }
    current.entries.push({ accountId, debit, credit })
  })

  const records = []
  entries.forEach(txn => {
    const totalDebit  = txn.entries.reduce((s, e) => s + e.debit,  0)
    const totalCredit = txn.entries.reduce((s, e) => s + e.credit, 0)
    const diff = Math.abs(totalDebit - totalCredit)
    if (diff > 0.01) {
      warnings.push(
        `Entry ${txn.ref}: Debits (${totalDebit.toFixed(2)}) ≠ Credits (${totalCredit.toFixed(2)}) — imported with warning`
      )
      records.push({ ...txn, unbalanced: true })
    } else {
      records.push(txn)
    }
  })

  return { records, errors, warnings }
}
