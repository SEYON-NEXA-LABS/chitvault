import { clsx, type ClassValue } from 'clsx'

// Tailwind class merger
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'ChitVault'
export const APP_BRAND = process.env.NEXT_PUBLIC_APP_BRAND || 'CV'
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '3.1.0'
export const APP_COMMIT_ID = (process.env.NEXT_PUBLIC_COMMIT_ID || 'N/A').slice(0, 10)
export const APP_SLOGAN = ''
export const APP_DESCRIPTION = 'Advanced digital ledger for transparent chit fund management and secure auction auditing.'
export const APP_DEVELOPER = 'NVision Systems (Finance & Tech)'
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

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
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

/**
 * Compute amount due for a member in a given month.
 * In 'ACCUMULATION' scheme, members pay full contribution.
 * In 'DIVIDEND' scheme, dividend is subtracted.
 */
export function amountDue(monthlyContribution: number, dividend: number, scheme?: string): number {
  const isAcc = scheme?.toUpperCase() === 'ACCUMULATION'
  if (isAcc) return monthlyContribution
  return monthlyContribution - dividend
}

// Format month index to include MMM-YY
export function fmtMonth(m: number, start?: string | null): string {
  if (m === undefined || m === null || isNaN(m)) return '—'
  if (!start) return `M${m}`
  const d = new Date(start)
  if (isNaN(d.getTime())) return `M${m}`
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

// Project the next auction date
export function getNextAuctionDate(startDate: string, auctionsDone: number): string {
  const d = new Date(startDate)
  d.setMonth(d.getMonth() + auctionsDone)
  return fmtDate(d.toISOString())
}

/**
 * Converts a numerical amount into English words (Indian Numbering System).
 * @example 125000 -> "One Lakh Twenty Five Thousand Rupees Only"
 */
export function amtToWords(n: number | string | null | undefined): string {
  const num = Math.abs(Number(String(n || 0).replace(/[^\d.-]/g, '')))
  if (num === 0) return 'Zero Rupees Only'

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ]
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  const convert = (i: number): string => {
    if (i < 20) return a[i]
    if (i < 100) return b[Math.floor(i / 10)] + (i % 10 !== 0 ? ' ' + a[i % 10] : '')
    if (i < 1000) return a[Math.floor(i / 100)] + ' Hundred' + (i % 100 !== 0 ? ' and ' + convert(i % 100) : '')
    if (i < 100000) return convert(Math.floor(i / 1000)) + ' Thousand' + (i % 1000 !== 0 ? ' ' + convert(i % 1000) : '')
    if (i < 10000000) return convert(Math.floor(i / 100000)) + ' Lakh' + (i % 100000 !== 0 ? ' ' + convert(i % 100000) : '')
    return convert(Math.floor(i / 10000000)) + ' Crore' + (i % 10000000 !== 0 ? ' ' + convert(i % 10000000) : '')
  }

  const integerPart = Math.floor(num)
  const decimalPart = Math.round((num - integerPart) * 100)

  let res = convert(integerPart) + ' Rupees'
  if (decimalPart > 0) {
    res += ' and ' + convert(decimalPart) + ' Paise'
  }
  return res + ' Only'
}

/**
 * Appends the auction scheme to the group name for display.
 */
export function getGroupDisplayName(g: { name: string, auction_scheme: string }, t: (key: string) => string) {
  const scheme = g.auction_scheme === 'ACCUMULATION' ? 'ACC' : 'DIV'
  return `${g.name} (${scheme})`
}

/**
 * Generates a WhatsApp wa.me link for sending messages.
 */
export function getWhatsAppLink(phone: string | null | undefined, message: string): string {
  if (!phone) return '#'
  const cleanPhone = phone.replace(/\D/g, '')
  // Add 91 prefix if missing (assuming India for small-town pitch)
  const fullPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`
}
