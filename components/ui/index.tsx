'use client'

import { cn } from '@/lib/utils'
import { X }  from 'lucide-react'
import { useEffect, useRef } from 'react'

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = 'green' | 'red' | 'gold' | 'blue' | 'gray'

export function Badge({ variant = 'gray', children, className }: {
  variant?: BadgeVariant; children: React.ReactNode; className?: string
}) {
  const styles: Record<BadgeVariant, React.CSSProperties> = {
    green: { background: 'var(--green-dim)', color: 'var(--green)' },
    red:   { background: 'var(--red-dim)',   color: 'var(--red)'   },
    gold:  { background: 'rgba(201,168,76,0.15)', color: 'var(--gold)' },
    blue:  { background: 'var(--blue-dim)',  color: 'var(--blue)'  },
    gray:  { background: 'var(--surface3)',  color: 'var(--text2)' },
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider', className)}
      style={styles[variant]}>
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'green' | 'ghost'

export function Btn({ variant = 'secondary', size = 'md', loading, icon: Icon, children, className, ...props }: {
  variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'
  icon?: any; loading?: boolean; children: React.ReactNode; className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-[13px]', md: 'px-4 py-2 text-[15px]', lg: 'px-5 py-3 text-base' }
  const styles: Record<BtnVariant, React.CSSProperties> = {
    primary:   { background: 'var(--gold)',      color: '#ffffff' },
    secondary: { background: 'var(--surface2)',  color: 'var(--text)', border: '1px solid var(--border)' },
    danger:    { background: 'var(--red-dim)',   color: 'var(--red)',  border: '1px solid rgba(246,109,122,0.3)' },
    green:     { background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(62,207,142,0.3)' },
    ghost:     { background: 'transparent',      color: 'var(--text)' },
  }
  return (
    <button className={cn(base, sizes[size], className)} style={styles[variant]} {...props}>
      {loading ? <span className="spinner" /> : (
        <>
          {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
          {children}
        </>
      )}
    </button>
  )
}

export function Card({ title, subtitle, children, className, style }: {
  title?: React.ReactNode; subtitle?: React.ReactNode
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <div className={cn('rounded-2xl border', className)}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)', ...style }}>
      {(title || subtitle) && (
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          {title && <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>{title}</h3>}
          {subtitle && <p className="text-xs opacity-60 mt-0.5" style={{ color: 'var(--text2)' }}>{subtitle}</p>}
        </div>
      )}
      <div className={cn((title || subtitle) ? 'p-0' : 'p-0')}>
        {children}
      </div>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color = 'gold' }: {
  label: string; value: string | number; sub?: string
  color?: 'gold' | 'green' | 'red' | 'blue'
}) {
  const colors = { gold: 'var(--gold)', green: 'var(--green)', red: 'var(--red)', blue: 'var(--blue)' }
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--text3)' }}>{label}</div>
      <div className="font-mono text-2xl font-semibold" style={{ color: colors[color] }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>{sub}</div>}
    </Card>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, right, className }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <th className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left whitespace-nowrap',
      right && 'text-right', className)}
      style={{ background: 'var(--surface2)', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
      {children}
    </th>
  )
}

export function Td({ children, right, className, style, colSpan }: {
  children: React.ReactNode; right?: boolean; className?: string; style?: React.CSSProperties; colSpan?: number
}) {
  return (
    <td colSpan={colSpan} className={cn('px-4 py-3 text-sm', right && 'text-right font-mono', className)}
      style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)', ...style }}>
      {children}
    </td>
  )
}

export function Tr({ children, className, style }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties
}) {
  return (
    <tr className={cn('transition-colors hover:bg-[var(--surface2)]', className)} style={style}>
      {children}
    </tr>
  )
}

// ── Table Card (card + header + table) ────────────────────────────────────────
export function TableCard({ title, subtitle, actions, children }: {
  title: React.ReactNode; subtitle?: React.ReactNode
  actions?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden mb-5">
      <div className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }: {
  open: boolean; onClose: () => void; title: string
  children: React.ReactNode; size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={cn('w-full rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto', sizes[size])}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-display text-lg" style={{ color: 'var(--text)' }}>{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors"
            style={{ color: 'var(--text3)' }}><X size={18} /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  )
}

// ── Form Field ────────────────────────────────────────────────────────────────
export function Field({ label, error, children, className }: {
  label: string; error?: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
        {label}
      </label>
      {children}
      {error && <span className="text-xs" style={{ color: 'var(--red)' }}>{error}</span>}
    </div>
  )
}

export const inputClass = 'w-full px-3 py-2.5 rounded-lg border text-base outline-none transition-colors focus:border-[var(--gold)] font-medium'
export const inputStyle = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }

// ── Progress Bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="progress-bar-wrap w-20 inline-block">
      <div className="progress-bar" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────────────────────────
export function Loading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16"
      style={{ color: 'var(--text2)' }}>
      <span className="spinner" />
      <span className="text-sm">{text}</span>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function Empty({ icon = '📭', text, action }: {
  icon?: string; text: string; action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16" style={{ color: 'var(--text3)' }}>
      <div className="text-4xl opacity-40">{icon}</div>
      <p className="text-sm">{text}</p>
      {action}
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
export function Toast({ msg, type, onClose }: {
  msg: string; type: 'success' | 'error'; onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium"
      style={{
        background: 'var(--surface)',
        borderColor: type === 'success' ? 'rgba(62,207,142,0.5)' : 'rgba(246,109,122,0.5)',
        color: type === 'success' ? 'var(--green)' : 'var(--red)',
      }}>
      {type === 'success' ? '✓' : '✗'} {msg}
    </div>
  )
}

// ── Chip row ──────────────────────────────────────────────────────────────────
export function Chip({ active, onClick, children }: {
  active?: boolean; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button onClick={onClick}
      className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
      style={active
        ? { background: 'rgba(201,168,76,0.15)', borderColor: 'var(--gold)', color: 'var(--gold)' }
        : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text2)' }}>
      {children}
    </button>
  )
}
export * from './PinOverlay'
