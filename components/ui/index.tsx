'use client'

import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { useEffect, useRef, isValidElement } from 'react'
import { haptics } from '@/lib/utils/haptics'

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'danger' | 'accent' | 'info' | 'gray' | 'warning'

export function Badge({ variant = 'gray', children, className }: {
  variant?: BadgeVariant; children: React.ReactNode; className?: string
}) {
  const styles: Record<BadgeVariant, React.CSSProperties> = {
    success: { background: 'var(--success-dim)', color: 'var(--success)' },
    danger:  { background: 'var(--danger-dim)',   color: 'var(--danger)'  },
    accent:  { background: 'var(--accent-dim)',   color: 'var(--accent)' },
    info:    { background: 'var(--info-dim)',     color: 'var(--info)'  },
    gray:    { background: 'var(--surface3)',     color: 'var(--text2)' },
    warning: { background: 'var(--warning-dim)',  color: 'var(--warning)' },
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider', className)}
      style={styles[variant]}>
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'

export function Btn({ variant = 'secondary', size = 'md', loading, icon: Icon, children, className, style, ...props }: {
  variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'
  icon?: any; loading?: boolean; children?: React.ReactNode; className?: string; style?: React.CSSProperties
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95'
  const sizes = { 
    sm: 'px-4 py-2 text-xs uppercase tracking-widest', 
    md: 'px-6 py-3 text-sm uppercase tracking-widest', 
    lg: 'px-8 py-4 text-base uppercase tracking-widest' 
  }
  
  // Style variants using classes where possible to allow overrides
  const variantClasses: Record<BtnVariant, string> = {
    primary:   'bg-[var(--accent)] text-white border-none',
    secondary: 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]',
    danger:    'bg-[var(--danger-dim)] text-[var(--danger)] border border-[var(--danger)]',
    success:   'bg-[var(--success-dim)] text-[var(--success)] border border-[var(--success)]',
    ghost:     'bg-transparent text-[var(--text)]'
  }

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    haptics.light()
    if (props.onClick) props.onClick(e)
  }

  return (
    <button 
      className={cn(base, sizes[size], variantClasses[variant], className, "group relative")} 
      style={style} 
      {...props} 
      title={undefined}
      onClick={handleClick}
    >
      {loading ? <span className="spinner" /> : (
        <>
          {Icon && (isValidElement(Icon) ? Icon : <Icon size={size === 'sm' ? 14 : 16} />)}
          {children}
        </>
      )}
      {props.title && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap bg-slate-900 text-white text-xs font-medium px-2.5 py-1.5 rounded-md z-50 shadow-xl">
          {props.title}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </button>
  )
}

export function Card({ title, subtitle, headerAction, children, className, style, glass, onClick }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; headerAction?: React.ReactNode
  children: React.ReactNode; className?: string; style?: React.CSSProperties; glass?: boolean; onClick?: () => void
}) {
  return (
    <div className={cn('rounded-3xl border transition-all duration-300', glass ? 'glass-card' : 'bg-[var(--surface)]', className)}
      onClick={onClick}
      style={{ borderColor: 'var(--border)', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {(title || subtitle || headerAction) && (
        <div className="px-6 py-4 border-b flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            {title && <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {headerAction && <div className="flex shrink-0 items-center gap-2">{headerAction}</div>}
        </div>
      )}
      <div className="p-0">{children}</div>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color = 'accent', icon: Icon, onClick }: {
  label: string; value: string | number; sub?: string
  color?: 'accent' | 'success' | 'danger' | 'info' | 'warning'
  icon?: any; onClick?: () => void
}) {
  const colors = { accent: 'var(--accent)', success: 'var(--success)', danger: 'var(--danger)', info: 'var(--info)', warning: 'var(--warning)' }
  const bgColors = { 
    accent: 'var(--accent-dim)', 
    success: 'var(--success-dim)', 
    danger: 'var(--danger-dim)', 
    info: 'var(--info-dim)',
    warning: 'var(--warning-dim)'
  }
  
  return (
    <Card className={cn("p-6 overflow-hidden relative group bg-white", onClick && "cursor-pointer active:scale-95")} onClick={onClick}>
      <div className="flex items-start justify-between relative z-10">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2 text-slate-400">{label}</div>
          <div className="text-2xl sm:text-3xl font-black tracking-tighter truncate" style={{ color: colors[color] }}>{value}</div>
          {sub && <div className="text-xs font-medium mt-1 text-slate-400 uppercase tracking-widest">{sub}</div>}
        </div>
        {Icon && (
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110 shadow-sm border" 
            style={{ 
              background: bgColors[color], 
              color: colors[color],
              borderColor: 'rgba(0,0,0,0.05)'
            }}>
            <Icon size={22} strokeWidth={2.5} />
          </div>
        )}
      </div>
    </Card>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ children, className, responsive, ...props }: {
  responsive?: boolean
} & React.TableHTMLAttributes<HTMLTableElement>) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const checkScroll = () => {
      const hasScroll = el.scrollWidth > el.clientWidth
      const isAtEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10
      el.classList.toggle('has-scroll-right', hasScroll && !isAtEnd)
    }

    checkScroll()
    el.addEventListener('scroll', checkScroll)
    window.addEventListener('resize', checkScroll)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [])

  return (
    <div ref={containerRef} className={cn(
      'scroll-shadow-container overflow-x-auto transition-all',
      responsive && 'table-responsive-cards',
      className
    )}>
      <table className="w-full border-collapse text-sm" {...props}>{children}</table>
    </div>
  )
}

export function Th({ children, right, className, ...props }: { children?: React.ReactNode; right?: boolean } & React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn('px-6 py-4 text-xs font-bold uppercase tracking-widest text-left whitespace-nowrap bg-slate-50 text-slate-400',
      right && 'text-right', className)}
      style={{ borderBottom: '1px solid var(--border)' }}
      {...props}>
      {children}
    </th>
  )
}

export function Td({ children, right, label, className, style, colSpan, onClick, ...props }: {
  children?: React.ReactNode; right?: boolean; label?: string; className?: string; style?: React.CSSProperties; colSpan?: number; onClick?: () => void
} & React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td 
      colSpan={colSpan} 
      className={cn('px-6 py-4 text-sm font-medium text-slate-700', right && 'text-right font-bold text-slate-900', className)}
      data-label={label}
      onClick={onClick}
      style={{ borderBottom: '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default', ...style }}
      {...props}
    >
      {children}
    </td>
  )
}

export function Tr({ children, className, style, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('transition-colors hover:bg-slate-50', className)} style={style} {...props}>
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
    <Card className="overflow-hidden mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b gap-3"
        style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="font-black text-sm uppercase tracking-tight text-slate-900">{title}</div>
          {subtitle && <div className="text-xs text-slate-400 mt-0.5">{subtitle}</div>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md', persist = false }: {
  open: boolean; onClose: () => void; title: string
  children: React.ReactNode; size?: 'sm' | 'md' | 'lg'; persist?: boolean
}) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  useEffect(() => {
    if (open) haptics.light()
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { 
      if (e.key === 'Escape' && !persist) onClose() 
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, persist])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !persist) onClose() }}>
      <div className={cn('w-full rounded-t-3xl sm:rounded-2xl border shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300 sm:animate-none bg-white', sizes[size])}
        style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-black text-lg uppercase tracking-tight text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-50 transition-colors text-slate-400">
            <X size={20} />
          </button>
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
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">
        {label}
      </label>
      {children}
      {error && <span className="text-xs font-bold text-red-600 px-1">{error}</span>}
    </div>
  )
}

export const inputClass = 'w-full px-4 py-3.5 rounded-2xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--accent-dim)] font-bold bg-slate-50 border-slate-200 text-slate-900'
export const inputStyle = { }

// ── Progress Bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color }: { pct: number; color?: 'success' | 'danger' | 'accent' | 'info' | 'gray' }) {
  const barColor = color ? `var(--${color})` : 'var(--accent)'
  return (
    <div className="progress-bar-wrap w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
      <div className="progress-bar h-full" style={{ width: `${pct}%`, background: barColor }} />
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────────────────────────
export function Loading({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
      <span className="spinner" />
      <span className="text-sm font-medium">{text}</span>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function Empty({ icon: Icon = '📭', title, text, subtitle, action }: {
  icon?: any; title?: string; text?: string; subtitle?: string; action?: React.ReactNode
}) {
  const mainTitle = title || text;
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-16 px-6 select-none">
      <div className="w-20 h-20 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200 mb-4 border border-slate-100">
        {typeof Icon === 'string' ? (
           <span className="text-4xl">{Icon}</span>
        ) : (
           <Icon size={32} strokeWidth={1} />
        )}
      </div>
      <div className="max-w-xs space-y-1">
        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
           {mainTitle || 'No Records'}
        </h3>
        {subtitle && (
          <p className="text-sm font-medium text-slate-400 leading-relaxed px-4">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="mt-6">{action}</div>}
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
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-6 py-3.5 rounded-2xl border shadow-2xl text-sm font-bold bg-white"
      style={{
        borderColor: type === 'success' ? 'var(--accent)' : 'var(--danger)',
        color: type === 'success' ? 'var(--accent)' : 'var(--danger)',
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
      className="px-4 py-1.5 rounded-full text-xs font-bold border transition-all uppercase tracking-widest"
      style={active
        ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' }
        : { background: 'white', borderColor: 'var(--border)', color: 'var(--text2)' }}>
      {children}
    </button>
  )
}

// ── Pagination ──────────────────────────────────────────────────────────────
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'

export function Pagination({ 
  current, 
  total, 
  pageSize, 
  onPageChange, 
  onPageSizeChange 
}: { 
  current: number; 
  total: number; 
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange?: (size: number) => void;
}) {
  const { t } = useI18n()
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1 && total <= pageSize) return null

  // Pagination Logic to match "1 2 3 ... 6" style
  const getPages = () => {
    const pages: (number | string)[] = []
    const delta = 2 // Number of pages to show around current

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 || 
        i === totalPages || 
        (i >= current - delta && i <= current + delta)
      ) {
        pages.push(i)
      } else if (
        (i === current - delta - 1) || 
        (i === current + delta + 1)
      ) {
        pages.push('...')
      }
    }
    return pages.filter((v, i, a) => a.indexOf(v) === i)
  }

  const start = Math.min(total, (current - 1) * pageSize + 1)
  const end = Math.min(total, current * pageSize)

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-6 px-8 border-t bg-slate-50 no-print" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <select 
            value={pageSize} 
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            className="text-xs font-bold uppercase tracking-widest bg-white border border-slate-200 px-3 py-1.5 rounded-xl outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        )}
        <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span>{t('pagination_showing') || 'SHOWING'}</span>
          <span className="text-slate-900">{start}</span>
          <span>—</span>
          <span className="text-slate-900">{end}</span>
          <span>OF</span>
          <span className="text-slate-900">{total}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-900 disabled:opacity-20 transition-all"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-2">
          {getPages().map((p, i) => (
            p === '...' ? (
              <span key={`dots-${i}`} className="text-xs text-slate-300 px-1">...</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(Number(p))}
                className={cn(
                  "w-10 h-10 rounded-xl text-xs font-bold transition-all border",
                  current === p 
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg" 
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-900 hover:text-slate-900"
                )}
              >
                {p}
              </button>
            )
          ))}
        </div>

        <button
          disabled={current >= totalPages}
          onClick={() => onPageChange(current + 1)}
          className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-white hover:text-slate-900 disabled:opacity-20 transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

export * from './PinOverlay'
export * from './CSVImportModal'
export * from './CommandPalette'
export * from './Charts'
export * from './NetworkStatus'
export * from './BottomNav'
export * from './UpdateNotification'
export * from './CookieConsent'
