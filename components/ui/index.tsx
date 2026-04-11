'use client'

import { cn } from '@/lib/utils'
import { X }  from 'lucide-react'
import { useEffect, useRef } from 'react'

// ── Badge ─────────────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'danger' | 'accent' | 'info' | 'gray'

export function Badge({ variant = 'gray', children, className }: {
  variant?: BadgeVariant; children: React.ReactNode; className?: string
}) {
  const styles: Record<BadgeVariant, React.CSSProperties> = {
    success: { background: 'var(--success-dim)', color: 'var(--success)' },
    danger:  { background: 'var(--danger-dim)',   color: 'var(--danger)'  },
    accent:  { background: 'var(--accent-dim)',   color: 'var(--accent)' },
    info:    { background: 'var(--info-dim)',     color: 'var(--info)'  },
    gray:    { background: 'var(--surface3)',     color: 'var(--text2)' },
  }
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider', className)}
      style={styles[variant]}>
      {children}
    </span>
  )
}

// ── Button ────────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost'

export function Btn({ variant = 'secondary', size = 'md', loading, icon: Icon, children, className, ...props }: {
  variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'
  icon?: any; loading?: boolean; children?: React.ReactNode; className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-black rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0.5 active:neumo-in neumo-out active:scale-95'
  const sizes = { sm: 'px-4 py-2 text-[12px] uppercase tracking-widest', md: 'px-6 py-3 text-[14px] uppercase tracking-widest', lg: 'px-8 py-4 text-base uppercase tracking-widest' }
  const styles: Record<BtnVariant, React.CSSProperties> = {
    primary:   { background: 'var(--accent)',      color: '#ffffff', border: 'none' },
    secondary: { background: 'var(--surface)',  color: 'var(--text)', border: '1px solid var(--border)' },
    danger:    { background: 'var(--danger-dim)',   color: 'var(--danger)',  border: '1px solid var(--danger)' },
    success:     { background: 'var(--success-dim)', color: 'var(--success)', border: '1px solid var(--success)' },
    ghost:     { background: 'transparent',      color: 'var(--text)', boxShadow: 'none' },
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

export function Card({ title, subtitle, headerAction, children, className, style, glass, onClick }: {
  title?: React.ReactNode; subtitle?: React.ReactNode; headerAction?: React.ReactNode
  children: React.ReactNode; className?: string; style?: React.CSSProperties; glass?: boolean; onClick?: () => void
}) {
  return (
    <div className={cn('rounded-[2rem] border transition-all duration-300', glass ? 'glass-card' : 'neumo-out', className)}
      onClick={onClick}
      style={{ background: glass ? undefined : 'var(--surface)', borderColor: 'var(--border)', cursor: onClick ? 'pointer' : 'default', ...style }}>
      {(title || subtitle || headerAction) && (
        <div className="px-5 py-4 border-b flex items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            {title && <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text)' }}>{title}</h3>}
            {subtitle && <p className="text-xs opacity-60 mt-0.5" style={{ color: 'var(--text2)' }}>{subtitle}</p>}
          </div>
          {headerAction && <div className="flex shrink-0 items-center gap-2">{headerAction}</div>}
        </div>
      )}
      <div className={cn((title || subtitle || headerAction) ? 'p-0' : 'p-0')}>
        {children}
      </div>
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
    <Card className={cn("p-6 overflow-hidden relative group", onClick && "cursor-pointer active:scale-95")} glass onClick={onClick}>
      <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)] opacity-[0.03] rounded-full -mr-16 -mt-16 blur-3xl group-hover:opacity-10 transition-opacity" />
      <div className="flex items-start justify-between relative z-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 opacity-70" style={{ color: 'var(--text)' }}>{label}</div>
          <div className="text-3xl font-black tracking-tighter" style={{ color: colors[color] }}>{value}</div>
          {sub && <div className="text-[10px] font-bold mt-1 opacity-60 uppercase tracking-widest" style={{ color: 'var(--text)' }}>{sub}</div>}
        </div>
        {Icon && (
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-[var(--surface2)] neumo-out group-hover:scale-110" 
            style={{ 
              background: bgColors[color], 
              color: colors[color] 
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
    <th className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left whitespace-nowrap',
      right && 'text-right', className)}
      style={{ background: 'var(--surface2)', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}
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
      className={cn('px-4 py-3 text-sm', right && 'text-right font-mono', className)}
      data-label={label}
      onClick={onClick}
      style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)', cursor: onClick ? 'pointer' : 'default', ...style }}
      {...props}
    >
      {children}
    </td>
  )
}

export function Tr({ children, className, style, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('transition-colors hover:bg-[var(--surface2)]', className)} style={style} {...props}>
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
export function Modal({ open, onClose, title, children, size = 'md', persist = false }: {
  open: boolean; onClose: () => void; title: string
  children: React.ReactNode; size?: 'sm' | 'md' | 'lg'; persist?: boolean
}) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { 
      if (e.key === 'Escape' && !persist) onClose() 
    }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, persist])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !persist) onClose() }}>
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
    <div className={cn('flex flex-col gap-2', className)}>
      <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 px-1" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      {children}
      {error && <span className="text-[10px] font-bold uppercase tracking-wide px-1" style={{ color: 'var(--danger)' }}>{error}</span>}
    </div>
  )
}

export const inputClass = 'w-full px-4 py-3.5 rounded-2xl border text-sm outline-none transition-all focus:ring-2 focus:ring-[var(--accent-dim)] font-bold neumo-in'
export const inputStyle = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }

// ── Progress Bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ pct, color }: { pct: number; color?: 'success' | 'danger' | 'accent' | 'info' | 'gray' }) {
  const barColor = color ? `var(--${color})` : 'var(--accent)'
  return (
    <div className="progress-bar-wrap w-full">
      <div className="progress-bar" style={{ width: `${pct}%`, background: barColor }} />
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
export function Empty({ icon: Icon = '📭', title, text, subtitle, action }: {
  icon?: any; title?: string; text?: string; subtitle?: string; action?: React.ReactNode
}) {
  const mainTitle = title || text;
  return (
    <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6 select-none animate-in fade-in zoom-in-95 duration-500">
      <div className="relative group">
         <div className="w-24 h-24 rounded-[2rem] bg-[var(--surface2)] flex items-center justify-center text-[var(--accent)] mb-4 relative z-10 transition-all">
            {typeof Icon === 'string' ? (
               <span className="text-5xl opacity-50">{Icon}</span>
            ) : (
               <Icon size={40} strokeWidth={1} className="opacity-30" />
            )}
         </div>
      </div>
      <div className="max-w-xs space-y-1">
        <h3 className="text-lg font-black text-[var(--text)] tracking-tight opacity-90 italic">
           {mainTitle || 'No Records'}
        </h3>
        {subtitle && (
          <p className="text-xs font-medium opacity-40 leading-relaxed tracking-wide px-4">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="mt-4">{action}</div>}
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
        borderColor: type === 'success' ? 'var(--accent-border)' : 'rgba(246,109,122,0.5)',
        color: type === 'success' ? 'var(--success)' : 'var(--danger)',
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
        ? { background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' }
        : { background: 'transparent', borderColor: 'var(--border)', color: 'var(--text2)' }}>
      {children}
    </button>
  )
}

// ── Pagination ──────────────────────────────────────────────────────────────
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
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1 && total <= 25) return null

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-8 px-6 border-t mt-4 no-print" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-3">
        <select 
          value={pageSize} 
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className="text-[10px] font-black uppercase tracking-widest bg-[var(--surface2)] border px-2 py-1 rounded-lg outline-none"
        >
          <option value={25}>25 Per Page</option>
          <option value={50}>50 Per Page</option>
          <option value={100}>100 Per Page</option>
        </select>
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
          Showing {Math.min(total, (current - 1) * pageSize + 1)}-{Math.min(total, current * pageSize)} of {total}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Btn 
          size="sm" 
          variant="secondary" 
          disabled={current <= 1} 
          onClick={() => onPageChange(current - 1)}
          className="px-3"
        >
          Prev
        </Btn>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            const p = i + 1 // Simple pagination for now
            // If totalPages > 5, this logic would need to be smarter (e.g. windows), but keeping it simple for reports
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  "w-8 h-8 rounded-lg text-[10px] font-black transition-all",
                  current === p ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--surface2)] opacity-50"
                )}
              >
                {p}
              </button>
            )
          })}
          {totalPages > 5 && <span className="opacity-30">...</span>}
        </div>
        <Btn 
          size="sm" 
          variant="secondary" 
          disabled={current >= totalPages} 
          onClick={() => onPageChange(current + 1)}
          className="px-3"
        >
          Next
        </Btn>
      </div>
    </div>
  )
}

export * from './PinOverlay'
export * from './CSVImportModal'
export * from './CommandPalette'
export * from './Charts'
export * from './OnboardingWidget'
export * from './Tour'
export * from './NetworkStatus'
export * from './BottomNav'
export * from './UpdateNotification'
