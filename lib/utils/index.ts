import { clsx, type ClassValue } from 'clsx'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Format Indian Rupees
export function fmt(n: number | string | null | undefined): string {
  return '₹' + Number(n || 0).toLocaleString('en-IN')
}

// Format date to Indian format
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
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

// App name from env
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ChitVault'
