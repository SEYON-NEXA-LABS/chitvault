'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth } from '@/lib/utils'
import { StatCard, Card, Loading, Badge } from '@/components/ui'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { inputClass, inputStyle } from '@/components/ui'
import type { Group, Member, Auction, Payment, Firm } from '@/types'

export default function DashboardPage() {
  const supabase = createClient()
  const { firm, role } = useFirm()
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [firms,    setFirms]    = useState<Firm[]>([])
  const [selectedFirmId, setSelectedFirmId] = useState<string | 'all'>('all')

  const isSuper = role === 'superadmin'

  useEffect(() => {
    async function load() {
      if (groups.length === 0) setLoading(true)
      const targetId = isSuper ? selectedFirmId : firm?.id
      
      const [g, m, a, p] = await Promise.all([
        withFirmScope(supabase.from('groups').select('*').neq('status','archived'), targetId),
        withFirmScope(supabase.from('members').select('*, persons(*)'), targetId),
        withFirmScope(supabase.from('auctions').select('*'), targetId).order('id', { ascending: false }).limit(10),
        withFirmScope(supabase.from('payments').select('*'), targetId),
      ])

      setGroups(g.data || [])
      setMembers(m.data || [])
      setAuctions(a.data || [])
      setPayments(p.data || [])

      if (isSuper && firms.length === 0) {
        const { data: f } = await supabase.from('firms').select('*').order('name')
        setFirms(f || [])
      }
      setLoading(false)
    }
    load()
  }, [supabase, isSuper, selectedFirmId, firm, firms.length])

  const stats = useMemo(() => {
    const totalChitValue = groups.reduce((s, g) => s + Number(g.chit_value), 0)
    
    // 1. Today's Collections
    const today = new Date().toISOString().split('T')[0]
    const todayColl = payments.filter(p => p.payment_date === today).reduce((s, p) => s + Number(p.amount), 0)

    // 2. Pending Collections (logic similar to ReportUpcomingPay)
    const totalPending = members.reduce((sum, member) => {
      const group = groups.find(g => g.id === member.group_id)
      if (!group || !['active', 'defaulter', 'foreman'].includes(member.status)) return sum
      
      const gAucs = auctions.filter(a => a.group_id === member.group_id)
      const currentMonth = Math.min(group.duration, gAucs.length + 1)
      const mPays = payments.filter(p => p.member_id === member.id && p.group_id === group.id)
      
      let mTotalDue = 0
      for (let month = 1; month <= currentMonth; month++) {
        const prevMonthAuc = gAucs.find(a => a.month === month - 1)
        const div = prevMonthAuc ? Number(prevMonthAuc.dividend || 0) : 0
        mTotalDue += (Number(group.monthly_contribution) - div)
      }
      
      const mTotalPaid = mPays.reduce((s, p) => s + Number(p.amount), 0)
      const pending = Math.max(0, mTotalDue - mTotalPaid)
      
      return sum + pending
    }, 0)

    // 3. Defaulter Count
    const defaulters = members.filter(m => m.status === 'defaulter').length

    return { totalChitValue, todayColl, totalPending, defaulters }
  }, [groups, members, auctions, payments])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      
      {/* Header with Firm Filter */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-[var(--text)]">Dashboard</h1>
        {isSuper && (
          <div className="w-64">
             <select 
               className={inputClass} 
               style={inputStyle}
               value={selectedFirmId} 
               onChange={e => setSelectedFirmId(e.target.value)}
             >
               <option value="all">All Firms (Global)</option>
               {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
             </select>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Groups" value={groups.length} sub={`Value ${fmt(stats.totalChitValue)}`} color="gold" />
        <StatCard label="Today's Collection" value={fmt(stats.todayColl)} sub="Payments received today" color="green" />
        <Link href="/reports?type=upcoming_pay" className="block transition-transform hover:scale-[1.02]">
          <StatCard label="Total Pending" value={fmt(stats.totalPending)} sub="Click to see breakdown" color="red" />
        </Link>
        <Link href="/reports?type=defaulters" className="block transition-transform hover:scale-[1.02]">
          <StatCard label="Defaulter Members" value={stats.defaulters} sub="Critical follow-up needed" color="blue" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Auctions */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Recent Auctions
          </div>
          {auctions.length === 0
            ? <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text3)' }}>No auctions yet</div>
            : <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Group','Month','Winner','Bid','Dividend','Date'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auctions.map(a => {
                    const g = groups.find(x => x.id === a.group_id)
                    const w = members.find(x => x.id === a.winner_id)
                    return (
                      <tr key={a.id} className="hover:bg-[var(--surface2)] transition-colors">
                        <td className="px-4 py-3" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                          {g?.name || `Group #${a.group_id}`}
                        </td>
                        <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                          <Badge variant="blue">{fmtMonth(a.month, g?.start_date)}</Badge>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                          👑 {w?.persons?.name || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                          {fmt(a.bid_amount)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--green)', borderBottom: '1px solid var(--border)' }}>
                          {fmt(a.dividend)}/m
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                          {fmtDate(a.auction_date)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          }
        </Card>

        {/* Group Progress */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Group Progress
          </div>
          <div className="p-5 space-y-4">
            {groups.length === 0
              ? <div className="text-center text-sm py-6" style={{ color: 'var(--text3)' }}>No groups yet</div>
              : groups.map(g => {
                  const done = auctions.filter(a => a.group_id === g.id).length
                  const pct  = Math.round(done / g.duration * 100)
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{g.name}</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>{done}/{g.duration} mo</span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs" style={{ color: 'var(--text3)' }}>{fmt(g.chit_value)}</span>
                        <span className="text-xs" style={{ color: 'var(--text3)' }}>{pct}% complete</span>
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </Card>

      </div>
    </div>
  )
}
