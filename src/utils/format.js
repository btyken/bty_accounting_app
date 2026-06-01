export function fmt(n) {
  const v = parseFloat(n) || 0
  return (v < 0 ? '-₱' : '₱') + Math.abs(v).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function today() {
  return new Date().toISOString().split('T')[0]
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function pad(n, len = 4) {
  return String(n).padStart(len, '0')
}

export function getLast6Months() {
  const months = []
  const d = new Date()
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1)
    months.push(m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0'))
  }
  return months
}

export function statusBadge(s) {
  return { paid: 'badge-green', sent: 'badge-blue', draft: 'badge-gray', overdue: 'badge-red' }[s] || 'badge-gray'
}

export function typeBadge(t) {
  return {
    Asset: 'badge-blue',
    Liability: 'badge-red',
    Equity: 'badge-green',
    Revenue: 'badge-green',
    Expense: 'badge-yellow',
  }[t] || 'badge-gray'
}

// Normalize a date string from Excel (could be serial number or string)
export function normalizeDate(val) {
  if (!val) return ''
  if (typeof val === 'number') {
    // Excel serial date
    const date = new Date(Math.round((val - 25569) * 86400 * 1000))
    return date.toISOString().split('T')[0]
  }
  const s = String(val).trim()
  // Try to parse common formats
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  return s
}
