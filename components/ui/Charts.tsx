'use client'

import { 
  ResponsiveContainer, 
  LineChart, Line, 
  AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, 
  PieChart, Pie, Cell,
  BarChart, Bar,
  Legend
} from 'recharts'
import { Card } from './index'
import { fmt } from '@/lib/utils'

const COLORS = ['#3ecf8e', '#3b82f6', '#f43f5e', '#eab308', '#a855f7', '#64748b']

// ── Shared Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--surface)] border border-[var(--border)] p-3 rounded-xl shadow-2xl text-xs">
        <p className="font-bold mb-1" style={{ color: 'var(--text)' }}>{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center gap-2" style={{ color: p.color || p.fill }}>
            <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span>{p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// ── Line Analytics ─────────────────────────────────────────────────────────────
export function LineAnalytics({ title, data, dataKey, expectedKey, xKey, height = 300 }: {
  title: string; data: any[]; dataKey: string; expectedKey?: string; xKey: string; height?: number
}) {
  return (
    <Card className="p-4 overflow-hidden">
      <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-40">{title}</h3>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis 
              dataKey={xKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text3)', fontSize: 10 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text3)', fontSize: 10 }}
              tickFormatter={(v: number) => `₹${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {expectedKey && (
              <Area 
                type="monotone" 
                dataKey={expectedKey} 
                name="Target"
                stroke="var(--border)" 
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="transparent" 
              />
            )}
            <Area 
              type="monotone" 
              dataKey={dataKey} 
              name="Actual"
              stroke="var(--accent)" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorValue)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ── Pie Distribution ───────────────────────────────────────────────────────────
export function PieDistribution({ title, data, dataKey, nameKey, height = 300 }: {
  title: string; data: any[]; dataKey: string; nameKey: string; height?: number
}) {
  return (
    <Card className="p-4 overflow-hidden">
      <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-40">{title}</h3>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey={dataKey}
              nameKey={nameKey}
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              align="center" 
              iconType="circle"
              wrapperStyle={{ fontSize: 10, paddingTop: 20 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

// ── Bar Analytics ──────────────────────────────────────────────────────────────
export function BarAnalytics({ title, data, dataKey, xKey, height = 300 }: {
  title: string; data: any[]; dataKey: string; xKey: string; height?: number
}) {
  return (
    <Card className="p-4 overflow-hidden">
      <h3 className="text-xs font-black uppercase tracking-widest mb-4 opacity-40">{title}</h3>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
            <XAxis 
              dataKey={xKey} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text3)', fontSize: 10 }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text3)', fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey={dataKey} 
              radius={[4, 4, 0, 0]} 
              fill="var(--info)"
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
