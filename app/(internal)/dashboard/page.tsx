'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth } from '@/lib/utils'
import { StatCard, Card, Loading, Badge, LineAnalytics, PieDistribution, OnboardingWidget } from '@/components/ui'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { inputClass, inputStyle } from '@/components/ui'
import type { Group, Member, Auction, Payment, Firm } from '@/types'

export default function DashboardPage() {
  const supabase = createClient()
  const { firm, role, switchedFirmId } = useFirm()
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [firms,    setFirms]    = useState<Firm[]>([])

  const isSuper = role === 'superadmin'

  useEffect(() => {
    async function load() {
      if (groups.length === 0) setLoading(true)
      const targetId = isSuper ? switchedFirmId : firm?.id
      
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
  }, [supabase, isSuper, switchedFirmId, firm, firms.length])

  const { stats, chartData, groupDist, onboardingSteps } = useMemo(() => {
    const totalChitValue = groups.reduce((s, g) => s + Number(g.chit_value), 0)
    
    // 1. Today's Collections
    const today = new Date().toISOString().split('T')[0]
    const todayColl = payments.filter(p => p.payment_date === today).reduce((s, p) => s + Number(p.amount), 0)

    // 2. Pending Collections
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

    // 4. Chart Data (Last 6 Months)
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      return d.toISOString().substring(0, 7) // YYYY-MM
    })

    const collectionTrends = last6Months.map(month => {
      const amt = payments
        .filter(p => p.payment_date?.startsWith(month))
        .reduce((sum, p) => sum + Number(p.amount), 0)
      return { month: month.substring(5), amount: amt }
    })

    // 5. Group Distribution
    const distData = [
      { name: 'Dividend (Comm)', value: groups.filter(g => g.auction_scheme === 'DIVIDEND').length },
      { name: 'Accumulation', value: groups.filter(g => g.auction_scheme === 'ACCUMULATION').length }
    ]

    // 6. Onboarding Steps
    const onboardingSteps = [
      { id: '1', title: 'Create a Group', desc: 'Set up your first chit scheme', link: '/groups', completed: groups.length > 0 },
      { id: '2', title: 'Add Members', desc: 'Register at least 5 people', link: '/members', completed: members.length >= 5 },
      { id: '3', title: 'Start Auction', desc: 'Record your first monthly bidding', link: '/auctions', completed: auctions.length > 0 },
      { id: '4', title: 'Collect Payments', desc: 'Record your first member payment', link: '/payments', completed: payments.length > 0 },
    ]

    return { 
      stats: { totalChitValue, todayColl, totalPending, defaulters },
      chartData: collectionTrends,
      groupDist: distData,
      onboardingSteps
    }
  }, [groups, members, auctions, payments])


  if (loading) return <Loading />

  const isNewFirm = !chartData.some(d => d.amount > 0) || chartData.length < 2

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-[var(--text)]">Dashboard Overview</h1>
        {isSuper && <Badge variant="danger">SUPERADMIN VIEW</Badge>}
      </div>

      {/* Modern Greeting & Onboarding */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="tour-welcome">
        <div className="lg:col-span-2 flex flex-col justify-center">
            <h2 className="text-4xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
              Welcome back, <span className="text-[var(--accent)]">{firm?.name || 'Partner'}</span>
            </h2>
            <p className="text-lg opacity-40 font-medium mt-2">Here is what is happening with your chit funds today.</p>
        </div>
        {(isNewFirm || !chartData.every(c => c.amount > 0)) && (
          <div className="lg:col-span-1" id="tour-onboarding">
            <OnboardingWidget steps={onboardingSteps} />
          </div>
        )}
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="tour-stats">
        <StatCard label="Active Groups" value={groups.length} sub={`Value ${fmt(stats.totalChitValue)}`} color="accent" />
        <StatCard label="Today's Collection" value={fmt(stats.todayColl)} sub="Payments received today" color="success" />
        <Link href="/reports?type=upcoming_pay" className="block transition-transform hover:scale-[1.02]">
          <StatCard label="Total Pending" value={fmt(stats.totalPending)} sub="Click to see breakdown" color="danger" />
        </Link>
        <Link href="/reports?type=defaulters" className="block transition-transform hover:scale-[1.02]">
          <StatCard label="Defaulter Members" value={stats.defaulters} sub="Critical follow-up needed" color="info" />
        </Link>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="tour-analytics">
        <div className="lg:col-span-2">
          <LineAnalytics 
            title="Monthly Collection Trend" 
            data={chartData} 
            dataKey="amount" 
            xKey="month" 
          />
        </div>
        <div className="lg:col-span-1">
          <PieDistribution 
            title="Group Scheme Mix" 
            data={groupDist} 
            dataKey="value" 
            nameKey="name" 
          />
        </div>
      </div>

      {/* Group Overview Section */}
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>Group Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.length === 0 ? (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}>
              No active groups found. Create one to get started.
            </div>
          ) : (
            groups.map(g => {
              const done = auctions.filter(a => a.group_id === g.id).length
              const pct = Math.round((done / g.duration) * 100)
              const isAcc = g.auction_scheme === 'ACCUMULATION'
              
              return (
                <Link key={g.id} href={`/groups/${g.id}`} className="block group">
                  <Card className="h-full relative overflow-hidden transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1 border-t-4"
                        style={{ borderTopColor: isAcc ? 'var(--info)' : 'var(--accent)' }}>
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-lg leading-tight mb-1" style={{ color: 'var(--text)' }}>
                            {g.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            <Badge variant={isAcc ? "info" : "accent"}>
                              {g.auction_scheme}
                            </Badge>
                            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text3)' }}>
                              {g.duration} Months
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black block" style={{ color: 'var(--text)' }}>
                            {fmt(g.chit_value)}
                          </span>
                          <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text3)' }}>
                            Chit Value
                          </span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 font-medium">
                          <span style={{ color: 'var(--text2)' }}>Progress</span>
                          <span style={{ color: 'var(--text)' }}>{done} / {g.duration} Months</span>
                        </div>
                        <div className="progress-bar-wrap h-1.5">
                          <div className="progress-bar" style={{ width: `${pct}%`, background: isAcc ? 'var(--info)' : 'var(--accent)' }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: 'var(--text3)' }}>
                            Contribution
                          </span>
                          <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                            {fmt(g.monthly_contribution)} /m
                          </span>
                        </div>
                        {isAcc ? (
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: 'var(--info)' }}>
                              Group Surplus
                            </span>
                            <span className="text-sm font-bold" style={{ color: 'var(--info)' }}>
                              {fmt(g.accumulated_surplus)}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: 'var(--text3)' }}>
                              Status
                            </span>
                            <Badge variant="success" className="text-[10px]">Active</Badge>
                          </div>
                        )}
                      </div>

                      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-4 h-4" style={{ color: 'var(--text2)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </div>
                    </div>
                  </Card>
                </Link>
              )
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5">
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
                          <Badge variant="info">{fmtMonth(a.month, g?.start_date)}</Badge>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                          👑 {w?.persons?.name || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                          {fmt(a.bid_amount)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
                          {g?.auction_scheme === 'ACCUMULATION' 
                            ? <span style={{ color: 'var(--accent)' }}>+{fmt(a.bid_amount)} <span className="text-[9px] font-bold">SURPLUS</span></span>
                            : <span style={{ color: 'var(--success)' }}>{fmt(a.dividend)}/m</span>}
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
      </div>
    </div>
  )
}
