import { clsx, type ClassValue } from 'clsx'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ChitVault'
export const APP_BRAND = process.env.NEXT_PUBLIC_APP_BRAND || 'SEYON'
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0'
export const APP_DEVELOPER = 'SEYON NEXA LABS'
export const SUPPORT_EMAIL = 'seyonnexalabs@gmail.com'
export const SUPERADMIN_EMAIL = 'seyonnexalabs@gmail.com'

// Format Indian Rupees
export function fmt(n: number | string | null | undefined): string {
  const num = Number(String(n || 0).replace(/[^\d.-]/g, ''))
  if (isNaN(num)) return '₹0'
  return '₹' + num.toLocaleString('en-IN')
}

// Format date to Indian format
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  })
}

// Calculate completion date from start + duration
export function completionDate(startDate: string, duration: number): Date {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + duration - 1)
  return d
}

// Get remaining months
export function remainingMonths(startDate: string, duration: number, done: number): number {
  return duration - done
}

// Compute amount due for a member in a given month
export function amountDue(monthlyContribution: number, dividend: number): number {
  return monthlyContribution - dividend
}

// Format month index to include MMM-YY
export function fmtMonth(m: number, start?: string | null): string {
  if (!start) return `M${m}`
  const d = new Date(start)
  d.setMonth(d.getMonth() + m - 1)
  const mon = d.toLocaleString('en-IN', { month: 'short' })
  const yr = d.getFullYear().toString().slice(-2)
  return `M${m} (${mon}-${yr})`
}

// Get today's date in local YYYY-MM-DD format
export function getToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
