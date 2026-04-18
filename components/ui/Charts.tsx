'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Card } from './index'
import { fmt, cn } from '@/lib/utils'

const COLORS = ['#3ecf8e', '#3b82f6', '#f43f5e', '#eab308', '#a855f7', '#64748b']

function useIsMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted
}

// ── SVG Math Helpers ──────────────────────────────────────────────────────────
/**
 * Generates a smooth cubic bezier path from points
 */
function getBezierPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return ''
  
  let d = `M ${points[0].x},${points[0].y}`
  
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i]
    const next = points[i + 1]
    
    // Control points for smoothing
    const cp1x = curr.x + (next.x - curr.x) / 2
    const cp1y = curr.y
    const cp2x = curr.x + (next.x - curr.x) / 2
    const cp2y = next.y
    
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`
  }
  
  return d
}

// ── Shared Tooltip ─────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, x, y, data, colors }: any) => {
  if (!active || !data) return null
  
  return (
    <div 
      className="absolute z-50 pointer-events-none bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl shadow-2xl text-[10px] min-w-[140px] transition-all duration-75"
      style={{ 
        left: x, 
        top: y, 
        transform: 'translate(-50%, calc(-100% - 15px))',
        opacity: active ? 1 : 0
      }}
    >
      <p className="font-black mb-2 uppercase tracking-widest opacity-40">{data.label}</p>
      <div className="space-y-1.5">
        {data.values.map((v: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors[v.key] || COLORS[i % COLORS.length] }} />
              <span className="font-bold opacity-70 whitespace-nowrap">{v.name}</span>
            </div>
            <span className="font-black font-mono">{fmt(v.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Legend ────────────────────────────────────────────────────────────────────
const ChartLegend = ({ series, hidden, onToggle, colors }: any) => {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 mt-4">
      {series.map((s: string, i: number) => (
        <button
          key={s}
          onClick={() => onToggle(s)}
          className={cn(
            "flex items-center gap-1.5 transition-all text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
            hidden.has(s) ? "opacity-30 border-transparent" : "opacity-100 border-[var(--border)] bg-[var(--surface2)]"
          )}
        >
          <div className="w-2 h-2 rounded-full shadow-sm" style={{ background: colors[s] || COLORS[i % COLORS.length] }} />
          {s}
        </button>
      ))}
    </div>
  )
}

// ── TrendArea (Refactored to SVG) ─────────────────────────────────────────────
export function LineAnalytics({ 
  title, data, series, dataKey, xKey, height = 300 
}: {
  title: string; data: any[]; series?: string[]; dataKey?: string; xKey: string; height?: number
}) {
  const activeSeries = series || (dataKey ? [dataKey] : [])
  const mounted = useIsMounted()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const toggleSeries = (s: string) => {
    const next = new Set(hidden)
    if (next.has(s)) next.delete(s)
    else next.add(s)
    setHidden(next)
  }

  const seriesColors = useMemo(() => {
    const m: any = {}
    activeSeries.forEach((s, i) => m[s] = COLORS[i % COLORS.length])
    return m
  }, [activeSeries])

  // Calculate scales and paths
  const { paths, grid, labels } = useMemo(() => {
    if (!data.length || !mounted) return { paths: [], grid: [], labels: [] }
    
    const visibleSeries = activeSeries.filter(s => !hidden.has(s))
    const allValues = data.flatMap(d => visibleSeries.map(s => Number(d[s] || 0)))
    const maxVal = Math.max(...allValues, 100) * 1.1 // 10% padding
    
    const padding = { top: 20, right: 10, bottom: 30, left: 40 }
    const w = 800 // Virtual width
    const h = 400 // Virtual height
    
    // X, Y scaling functions
    const scaleX = (i: number) => (i / (data.length - 1)) * (w - padding.left - padding.right) + padding.left
    const scaleY = (v: number) => h - padding.bottom - (v / maxVal) * (h - padding.top - padding.bottom)

    const resultPaths = visibleSeries.map(s => {
      const points = data.map((d, i) => ({ x: scaleX(i), y: scaleY(Number(d[s] || 0)) }))
      const baseLine = h - padding.bottom
      
      const linePath = getBezierPath(points)
      const areaPath = linePath + ` L ${points[points.length-1].x},${baseLine} L ${points[0].x},${baseLine} Z`
      
      return { key: s, line: linePath, area: areaPath, color: seriesColors[s] }
    })

    // Grid lines (horizontal)
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map(p => ({
      y: scaleY(maxVal * p),
      val: maxVal * p
    }))

    // X Labels
    const xLabels = data.filter((_, i) => i % Math.max(1, Math.floor(data.length / 6)) === 0).map((d, i) => ({
      x: scaleX(data.indexOf(d)),
      label: d[xKey]
    }))

    return { paths: resultPaths, grid: gridLines, labels: xLabels }
  }, [data, mounted, hidden, activeSeries, seriesColors, xKey])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !data.length) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const idx = Math.round((x / rect.width) * (data.length - 1))
    const entry = data[Math.max(0, Math.min(idx, data.length - 1))]
    
    if (entry) {
      const xPos = (idx / (data.length - 1)) * rect.width
      const yPos = e.clientY - rect.top
      
      setHover({
        idx,
        x: Math.max(70, Math.min(rect.width - 70, xPos)), // Clamp to prevent edge overflow
        y: Math.max(10, yPos),
        data: {
          label: entry[xKey],
          values: activeSeries.filter(s => !hidden.has(s)).map(s => ({
            name: s,
            key: s,
            value: Number(entry[s] || 0)
          }))
        }
      })
    }
  }

  return (
    <Card className="p-6 relative overflow-hidden group/chart" style={{ minWidth: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">{title}</h3>
      </div>
      
      <div 
        ref={containerRef}
        className="relative cursor-crosshair select-none"
        style={{ height, width: '100%' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <svg viewBox="0 0 800 400" className="w-full h-full overflow-visible" preserveAspectRatio="none">
          {/* Grid Lines */}
          {grid.map((g, i) => (
            <g key={i}>
              <line x1="40" y1={g.y} x2="800" y2={g.y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
              <text x="0" y={g.y + 4} fill="var(--text)" fontSize="12" className="opacity-30 font-bold">
                {g.val >= 1000 ? (g.val/1000).toFixed(0) + 'k' : g.val.toFixed(0)}
              </text>
            </g>
          ))}

          {/* Paths */}
          {paths.map(p => (
            <g key={p.key}>
              <path d={p.area} fill={p.color} fillOpacity="0.05" />
              <path d={p.line} fill="none" stroke={p.color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}

          {/* X Labels */}
          {labels.map((l, i) => (
            <text key={i} x={l.x} y="395" textAnchor="middle" fill="var(--text)" fontSize="12" className="opacity-30 font-bold uppercase tracking-widest">
              {l.label}
            </text>
          ))}

          {/* Scanner Line */}
          {hover && (
            <line 
              x1={(hover.idx / (data.length - 1)) * 800} 
              y1="20" 
              x2={(hover.idx / (data.length - 1)) * 800} 
              y2="370" 
              stroke="var(--accent)" 
              strokeWidth="1" 
              strokeDasharray="4 4" 
            />
          )}
        </svg>

        {hover && (
          <ChartTooltip 
            active={true} 
            x={hover.x} 
            y={Math.max(50, hover.y)} 
            data={hover.data} 
            colors={seriesColors} 
          />
        )}
      </div>

      <ChartLegend 
        series={activeSeries} 
        hidden={hidden} 
        onToggle={toggleSeries} 
        colors={seriesColors} 
      />
    </Card>
  )
}

// ── StatusRing (Pie Distribution) ─────────────────────────────────────────────
export function PieDistribution({ title, description, data, dataKey, nameKey, height = 300 }: {
  title: string; description?: string; data: any[]; dataKey: string; nameKey: string; height?: number
}) {
  const mounted = useIsMounted()
  if (!mounted) return <div style={{ height }} />

  const total = data.reduce((s, d) => s + Number(d[dataKey] || 0), 0)
  const radius = 70
  const circumference = 2 * Math.PI * radius
  
  let currentOffset = 0

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">{title}</h3>
        {description && <p className="text-[10px] font-medium opacity-30 mt-1">{description}</p>}
      </div>
      <div className="flex flex-col md:flex-row items-center justify-around gap-8" style={{ minHeight: height - 80 }}>
        <div className="relative w-[180px] h-[180px]">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            {data.map((entry, i) => {
              const val = Number(entry[dataKey])
              const pct = (val / total) * 100
              const strokeVal = (pct * circumference) / 100
              const offset = (currentOffset * circumference) / 100
              currentOffset += pct
              
              return (
                <circle
                  key={i}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="transparent"
                  stroke={entry.color || COLORS[i % COLORS.length]}
                  strokeWidth="24"
                  strokeDasharray={`${strokeVal} ${circumference}`}
                  strokeDashoffset={-offset}
                  className="transition-all hover:opacity-80 cursor-pointer"
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-black">{total}</span>
            <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">Records</span>
          </div>
        </div>

        <div className="space-y-3 min-w-[140px]">
          {data.map((entry, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-[10px] font-black uppercase tracking-tight opacity-60">{entry[nameKey]}</span>
              </div>
              <span className="text-sm font-black italic">{entry[dataKey]}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

// ── BarAnalytics (Redirect to TrendArea for simplicity or generic Bar) ─────────
export function BarAnalytics({ title, data, dataKey, xKey, height = 300 }: {
  title: string; data: any[]; dataKey: string; xKey: string; height?: number
}) {
  return (
    <Card className="p-6">
       <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-4 opacity-40">{title}</h3>
       <div className="flex items-end justify-between gap-2 px-2" style={{ height: height - 60 }}>
          {data.map((d, i) => {
             const max = Math.max(...data.map(x => Number(x[dataKey])), 1)
             const h = (Number(d[dataKey]) / max) * 100
             return (
                <div key={i} className="flex-1 group relative">
                   <div 
                      className="w-full bg-[var(--accent)] rounded-t-lg transition-all group-hover:opacity-80"
                      style={{ height: `${h}%` }}
                   />
                   <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[var(--surface)] border border-[var(--border)] px-2 py-1 rounded-md text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {fmt(Number(d[dataKey]))}
                   </div>
                   <div className="mt-2 text-[9px] font-black uppercase tracking-widest opacity-30 origin-left text-center overflow-hidden text-ellipsis whitespace-nowrap">
                      {d[xKey]}
                   </div>
                </div>
             )
          })}
       </div>
    </Card>
  )
}
