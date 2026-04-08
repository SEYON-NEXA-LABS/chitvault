'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, getToday, getGroupDisplayName } from '@/lib/utils'
import { 
  Users, Layers, TrendingUp, DollarSign, Wallet, ShieldCheck, 
  ArrowUpRight, ArrowDownRight, Clock, Info, ShieldAlert,
  Building, BadgeCheck, AlertTriangle
} from 'lucide-react'
import { logActivity } from '@/lib/utils/logger'
import { StatCard, Card, Loading, Badge, LineAnalytics, PieDistribution, OnboardingWidget, TableCard, Table, Th, Td, Tr, Btn } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'
import { inputClass, inputStyle } from '@/components/ui'
import { ArrowRight } from 'lucide-react'
import { useTerminology } from '@/lib/hooks/useTerminology'
import type { Group, Member, Auction, Payment, Firm } from '@/types'

export default function DashboardPage() {
  const supabase = createClient()
  const { firm, role, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
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
        withFirmScope(supabase.from('auctions').select('*'), targetId).order('month', { ascending: false }),
        withFirmScope(supabase.from('payments').select('*'), targetId).order('payment_date', { ascending: false }),
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
  }, [supabase, isSuper, switchedFirmId, firm, firms.length, groups.length])

  const { stats, chartData, groupDist, modeDist, statusDist, onboardingSteps, winnerInsights } = useMemo(() => {
    const totalChitValue = groups.reduce((s, g) => s + Number(g.chit_value), 0)
    
    // 1. Today's Collections
    const today = getToday()
    const todayColl = payments.filter(p => p.payment_date === today).reduce((s, p) => s + Number(p.amount), 0)

    let totalPending = 0
    let currentDue = 0
    let overdueDue = 0

    members.forEach((member) => {
      const group = groups.find(g => g.id === member.group_id)
      if (!group || !['active', 'defaulter', 'foreman'].includes(member.status)) return
      
      const gAucs = auctions.filter(a => Number(a.group_id) === Number(member.group_id) && a.status === 'confirmed')
      const gPays = payments.filter(p => Number(p.member_id) === Number(member.id) && Number(p.group_id) === Number(group.id))
      const isAcc = group.auction_scheme?.toUpperCase() === 'ACCUMULATION'
      const latestMonth = gAucs.length > 0 ? Math.max(...gAucs.map(a => Number(a.month))) : 0
      
      const financial = getMemberFinancialStatus(member, group, gAucs, gPays)
      
      if (financial.balance > 0.01) {
        totalPending += financial.balance
        
        // Categorize the balance for the dashboard cards
        financial.streak.forEach((s: any) => {
          const bal = s.due - s.paid
          if (bal > 0.01) {
            const hasAuctionHappened = gAucs.some(a => a.month === s.month)
            const isDueForScheme = isAcc ? hasAuctionHappened : (s.month <= latestMonth + 1)
            
            if (isDueForScheme) {
              if (hasAuctionHappened) {
                overdueDue += bal
              } else {
                currentDue += bal
              }
            }
          }
        })
      }
    })

    // 3. Defaulter Count
    const defaulters = members.filter(m => m.status === 'defaulter').length

    // 4. Chart Data (Last 6 Months)
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date()
      d.setMonth(d.getMonth() - (5 - i))
      return d.toISOString().substring(0, 7) // YYYY-MM
    })

    const collectionTrends = last6Months.map(monthStr => {
      const [y, m] = monthStr.split('-').map(Number)
      
      // Actual
      const actual = payments
        .filter(p => p.payment_date?.startsWith(monthStr))
        .reduce((sum, p) => sum + Number(p.amount), 0)

      // Expected (Target)
      let expected = 0
      groups.forEach(g => {
        if (!g.start_date) return
        const gStart = new Date(g.start_date)
        const auctionNum = (y - gStart.getFullYear()) * 12 + (m - gStart.getMonth()) + 1
        
        if (auctionNum >= 1 && auctionNum <= g.duration) {
          const isAcc = g.auction_scheme === 'ACCUMULATION'
          const installment = Number(g.monthly_contribution)
          const baseTotal = installment * g.num_members
          
          const auc = auctions.find(a => a.group_id === g.id && a.month === auctionNum)
          const hasAuctioned = auc && auc.status === 'confirmed'
          
          if (isAcc) {
             // For accumulation, we only "expect" money for the months auctioned
             if (hasAuctioned) expected += baseTotal
          } else {
             // For dividend, we expect it for the current cycle regardless of auction status
             const dividend = Number(auc?.dividend || 0)
             expected += baseTotal - (dividend * g.num_members)
          }
        }
      })

      return { month: monthStr.substring(5), actual, expected: Math.max(0, expected) }
    })

    // 5. Collection Mode Distribution
    const modes = ['Cash', 'UPI', 'Bank Transfer']
    const modeDist = modes.map(m => ({
      name: m,
      value: payments.filter(p => p.mode === m).reduce((s, p) => s + Number(p.amount), 0)
    })).filter(d => d.value > 0)

    // 6. Member Status Distribution
    const statuses = [
      { key: 'active', label: 'Active', color: 'var(--success)' },
      { key: 'defaulter', label: 'Defaulters', color: 'var(--danger)' },
      { key: 'exited', label: 'Exited', color: 'var(--text3)' },
      { key: 'foreman', label: 'Foreman', color: 'var(--info)' }
    ]
    const statusDist = statuses.map(s => ({
      name: s.label,
      value: members.filter(m => m.status === s.key).length
    })).filter(d => d.value > 0)

    // 7. Group Distribution
    const distData = [
      { name: t('dividend'), value: groups.filter(g => g.auction_scheme === 'DIVIDEND').length },
      { name: t('surplus'), value: groups.filter(g => g.auction_scheme === 'ACCUMULATION').length }
    ].filter(d => d.value > 0)

    // 8. Onboarding Steps
    const onboardingSteps = [
      { id: '1', title: t('onboarding_step1_title'), desc: t('onboarding_step1_desc'), link: '/settings', completed: !!firm },
      { id: '2', title: t('onboarding_step2_title'), desc: t('onboarding_step2_desc'), link: '/groups', completed: groups.length > 0 },
      { id: '3', title: t('onboarding_step3_title'), desc: t('onboarding_step3_desc'), link: '/members', completed: members.length >= 5 },
      { id: '4', title: t('onboarding_step4_title'), desc: t('onboarding_step4_desc'), link: '/payments', completed: payments.length > 0 },
    ]

    // 9. Winner Intelligence (Early Birds & High Discounts)
    const confirmedAucs = auctions.filter(a => a.status === 'confirmed' && a.winner_id != null)
    const personAgg = new Map<number, any>()
    confirmedAucs.forEach(a => {
      const m = members.find(mx => mx.id === a.winner_id)
      const g = groups.find(gx => gx.id === a.group_id)
      if (!m || !g) return
      const pId = m.person_id
      if (!personAgg.has(pId)) personAgg.set(pId, { person: m.persons, totalDiscount: 0, earlyBirdCount: 0, wins: 0 })
      const node = personAgg.get(pId)
      node.totalDiscount += Number(a.auction_discount)
      node.wins++
      if (a.month <= (g.duration / 4)) node.earlyBirdCount++
    })
    const winnerInsights = {
      topBorrower: Array.from(personAgg.values()).sort((a,b) => b.totalDiscount - a.totalDiscount)[0],
      earlyBirdCount: confirmedAucs.filter(a => {
        const g = groups.find(gx => gx.id === a.group_id)
        return g && a.month <= (g.duration / 4)
      }).length,
      highestSingleDiscount: confirmedAucs.length > 0 ? Math.max(...confirmedAucs.map(a => Number(a.auction_discount))) : 0
    }

    return { 
      stats: { totalChitValue, todayColl, totalPending, overdueDue, currentDue, defaulters },
      chartData: collectionTrends,
      groupDist: distData,
      modeDist,
      statusDist,
      onboardingSteps,
      winnerInsights
    }
  }, [groups, members, auctions, payments, firm, t])


  if (loading) return <Loading />

  const isNewFirm = !chartData.some(d => d.actual > 0) || chartData.length < 2

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-[var(--text)]">{t('dash_overview')}</h1>
        {isSuper && <Badge variant="danger">{t('dash_super_view')}</Badge>}
      </div>

      {/* Modern Greeting & Onboarding */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="tour-welcome">
        <div className="lg:col-span-3 flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-2">
               <BadgeCheck size={20} className="text-[var(--success)]" />
               <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">{t('dash_verified_firm')}</span>
            </div>
            <h2 className="text-4xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
              {t('dash_welcome')}, <span className="text-[var(--accent)]">{firm?.name || t('dash_partner')}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-4 mt-4">
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-[11px] font-bold uppercase tracking-wide">
                  <Building size={14} className="text-[var(--accent)]" />
                  <span className="opacity-40">ID:</span>
                  <span className="font-mono">{firm?.id.substring(0,8)}...</span>
               </div>
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-[11px] font-bold uppercase tracking-wide">
                  <Clock size={14} className="text-[var(--accent)]" />
                  <span className="opacity-40">{t('dash_since')}:</span>
                  <span>{fmtDate(firm?.created_at)}</span>
               </div>
               <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)] text-[11px] font-bold uppercase tracking-wide text-[var(--accent)]">
                  <BadgeCheck size={14} />
                  <span>{firm?.plan} {t('dash_enterprise')}</span>
               </div>
            </div>
        </div>
        {(isNewFirm || !chartData.every(c => c.actual > 0)) && (
          <div className="lg:col-span-1" id="tour-onboarding">
            <OnboardingWidget steps={onboardingSteps} />
          </div>
        )}
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="tour-stats">
        <StatCard label={t('active_groups')} value={groups.length} sub={`${t('value')} ${fmt(stats.totalChitValue)}`} color="accent" />
        <Link href="/reports?type=today_collection" className="block transition-transform hover:scale-[1.02]">
          <StatCard label={t('report_today_title')} value={fmt(stats.todayColl)} sub={t('report_today_desc')} color="success" />
        </Link>
        <Link href="/reports?type=upcoming_pay" className="block transition-transform hover:scale-[1.02]">
          <StatCard label={t('pending')} value={fmt(stats.overdueDue)} sub={t('dash_overdue_sub')} color="danger" />
        </Link>
        <Link href="/reports?type=upcoming_pay" className="block transition-transform hover:scale-[1.02]">
          <StatCard label={t('current_month_due')} value={fmt(stats.currentDue)} sub={t('dash_current_due_sub')} color="info" />
        </Link>
      </div>

      {/* Visual Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" id="tour-analytics">
        <div className="lg:col-span-2 md:col-span-2">
          {chartData.every(d => (d.actual || 0) === 0 && (d.expected || 0) === 0) ? (
            <Card className="h-[300px] flex flex-col items-center justify-center border-dashed">
               <div className="text-3xl mb-2">📊</div>
               <div className="text-xs font-bold uppercase opacity-40">{t('dash_no_trends')}</div>
               <p className="text-[10px] mt-1 opacity-60 px-10 text-center">{t('dash_no_trends_desc')}</p>
            </Card>
          ) : (
            <LineAnalytics 
              title={t('dash_collection_trends')} 
              data={chartData} 
              dataKey="actual"
              expectedKey="expected"
              xKey="month" 
            />
          )}
        </div>
        <div className="lg:col-span-1">
          <PieDistribution 
            title={t('dash_collection_modes')} 
            data={modeDist} 
            dataKey="value" 
            nameKey="name" 
          />
        </div>
        <div className="lg:col-span-1">
          <PieDistribution 
            title={t('dash_member_health')} 
            data={statusDist} 
            dataKey="value" 
            nameKey="name" 
          />
        </div>
      </div>
      {/* Winner & Market Intelligence */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/reports?type=auction_insights" className="lg:col-span-2 group">
          <Card className="h-full bg-gradient-to-br from-[var(--surface)] to-[var(--surface2)] border-l-4 border-l-[var(--danger)] overflow-hidden relative transition-all hover:shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl transition-all">
                  <ShieldAlert size={24} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-black italic tracking-tight uppercase">{t('dash_winner_intel').split(' ')[0]} <span className="text-red-500 not-italic font-display">{t('dash_winner_intel').split(' ').slice(1).join(' ')}</span></h3>
                  <p className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{t('dash_winner_intel_sub')}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                 <div>
                    <div className="text-[9px] uppercase font-bold opacity-30 mb-1">{t('dash_top_borrower')}</div>
                    <div className="text-lg font-black truncate">{winnerInsights.topBorrower?.person?.name || '—'}</div>
                    <div className="text-[10px] text-[var(--danger)] font-bold">{fmt(winnerInsights.topBorrower?.totalDiscount || 0)} {t('auction_discount')}</div>
                 </div>
                 <div>
                    <div className="text-[9px] uppercase font-bold opacity-30 mb-1">{t('dash_early_bird_payouts')}</div>
                    <div className="text-lg font-black">{winnerInsights.earlyBirdCount} <span className="text-[10px] font-medium opacity-40">{t('members')}</span></div>
                    <div className="text-[10px] text-[var(--accent)] font-bold">{t('dash_maturity')} (First 25%)</div>
                 </div>
                 <div className="hidden lg:block">
                    <div className="text-[9px] uppercase font-bold opacity-30 mb-1">{t('dash_highest_bid')}</div>
                    <div className="text-lg font-black">{fmt(winnerInsights.highestSingleDiscount)}</div>
                    <Badge variant="gray" className="text-[8px] uppercase">{t('dash_record_high')}</Badge>
                 </div>
              </div>
            </div>
            <ArrowRight className="absolute bottom-4 right-4 opacity-10 group-hover:opacity-100 transition-all group-hover:translate-x-1" size={24} />
          </Card>
        </Link>
        
        <Link href="/defaulters">
           <Card className="h-full border-l-4 border-l-[var(--warning)] hover:shadow-lg transition-all">
              <div className="p-6">
                 <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl transition-all">
                      <AlertTriangle size={24} strokeWidth={2.5} />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-widest italic">{t('dash_default_risk').split(' ')[0]} <span className="text-orange-500">{t('dash_default_risk').split(' ').slice(1).join(' ')}</span></h3>
                 </div>
                 <div className="text-3xl font-black mb-1">{stats.defaulters}</div>
                 <p className="text-[10px] opacity-50 font-medium uppercase leading-tight">{t('dash_default_risk_desc')}</p>
                 <Btn variant="secondary" size="sm" className="mt-4 w-full">{t('dash_audit_registry')}</Btn>
              </div>
           </Card>
        </Link>
      </div>

      {/* Group Overview Section */}
      <div>
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>{t('dash_group_overview')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {groups.length === 0 ? (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl" style={{ borderColor: 'var(--border)', color: 'var(--text3)' }}>
              {t('dash_no_groups')}
            </div>
          ) : (
            groups.map(g => {
              const gAucs = auctions.filter(a => a.group_id === g.id)
              const done = gAucs.filter(a => a.status === 'confirmed').length
              const hasDraft = gAucs.some(a => a.status === 'draft')
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
                            {getGroupDisplayName(g, t)}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text3)' }}>
                              {g.duration} {t('duration')}
                            </span>
                            {hasDraft && (
                              <Badge variant="danger" className="animate-pulse flex items-center gap-1 py-0 px-2 text-[9px] font-black uppercase tracking-tighter shadow-sm border border-red-200">
                                <AlertTriangle size={10} /> {t('dash_action_required')}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-black block" style={{ color: 'var(--text)' }}>
                            {fmt(g.chit_value)}
                          </span>
                          <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--text3)' }}>
                            {t('chit_value')}
                          </span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 font-medium">
                          <span style={{ color: 'var(--text2)' }}>{t('dash_progress')}</span>
                          <span style={{ color: 'var(--text)' }}>{done} / {g.duration} {t('duration')}</span>
                        </div>
                        <div className="progress-bar-wrap h-1.5">
                          <div className="progress-bar" style={{ width: `${pct}%`, background: isAcc ? 'var(--info)' : 'var(--accent)' }} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          <div className="text-[10px] uppercase opacity-40 font-bold tracking-wider">
                            {isAcc ? t('monthly_contribution') : t('after_div')}
                          </div>
                          <div className="text-xl font-black" style={{ color: 'var(--text)' }}>
                            {fmt(Number(g.monthly_contribution))}
                          </div>
                        </div>
                        {isAcc ? (
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: 'var(--info)' }}>
                              {term.groupSurplusLabel}
                            </span>
                            <span className="text-sm font-bold" style={{ color: 'var(--info)' }}>
                              {fmt(g.accumulated_surplus)}
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] uppercase font-bold block mb-0.5" style={{ color: 'var(--text3)' }}>
                              {t('status')}
                            </span>
                            <Badge variant="success" className="text-[10px]">{t('completed') || 'Active'}</Badge>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Collections */}
        <TableCard 
          title={t('dash_recent_collections')} 
          subtitle={t('dash_latest_payments')}
          actions={<Link href="/reports?type=today_collection" className="text-[10px] text-[var(--accent)] hover:underline uppercase font-bold">{t('dash_today_detail')}</Link>}
        >
          {payments.length === 0 ? (
            <div className="py-12 text-center opacity-40">
               <div className="text-3xl mb-2">💸</div>
               <div className="text-xs font-bold uppercase tracking-widest">{t('dash_no_payments')}</div>
               <p className="text-[10px] mt-1 px-10">{t('dash_no_payments_desc')}</p>
            </div>
          ) : (
            <Table>
              <thead>
                <Tr>
                  <Th>{t('dash_date_time')}</Th>
                  <Th>{t('dash_member_mode')}</Th>
                  <Th right>{t('amount')}</Th>
                </Tr>
              </thead>
              <tbody>
                {payments.slice(0, 5).map((p) => {
                  const m = members.find(x => x.id === p.member_id)
                  const entryTime = p.created_at ? new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
                  return (
                    <Tr key={p.id}>
                      <Td>
                        <div className="text-xs font-bold">{fmtDate(p.payment_date)}</div>
                        <div className="text-[9px] opacity-40 uppercase tracking-tighter">{t('dash_entered_at')} {entryTime}</div>
                      </Td>
                      <Td>
                        <div className="text-xs font-semibold truncate max-w-[120px]">{m?.persons?.name || 'Manual Entry'}</div>
                        <Badge variant="gray" className="text-[8px] py-0">{p.mode}</Badge>
                      </Td>
                      <Td right className="font-mono font-black text-[var(--success)]">{fmt(p.amount)}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </TableCard>

        {/* Recent Auctions */}
        <TableCard 
          title={t('dash_recent_auctions')} 
          subtitle={t('dash_latest_bids')}
          actions={<Link href="/reports?type=auction_sched" className="text-[10px] text-[var(--accent)] hover:underline uppercase font-bold">{t('dash_schedule')}</Link>}
        >
          {auctions.length === 0 ? (
            <div className="py-12 text-center opacity-40">
               <div className="text-3xl mb-2">⚖️</div>
               <div className="text-xs font-bold uppercase tracking-widest">{t('dash_no_auctions')}</div>
               <p className="text-[10px] mt-1 px-10">{t('dash_no_auctions_desc')}</p>
            </div>
          ) : (
            <Table>
              <thead>
                <Tr>
                  <Th>{t('dash_group_month')}</Th>
                  <Th>{t('winner')}</Th>
                  <Th right>{t('auction_discount')}</Th>
                </Tr>
              </thead>
              <tbody>
                {auctions.slice(0, 5).map((a) => {
                  const g = groups.find(x => x.id === a.group_id)
                  const w = members.find(x => x.id === a.winner_id)
                  return (
                    <Tr key={a.id}>
                      <Td>
                        <div className="text-xs font-bold truncate max-w-[150px]">{g ? getGroupDisplayName(g, t) : 'Group'}</div>
                        <Badge variant="info" className="text-[8px] py-0">{fmtMonth(a.month, g?.start_date)}</Badge>
                      </Td>
                      <Td>
                        <div className="text-xs font-semibold truncate max-w-[100px]">👑 {w?.persons?.name || '—'}</div>
                        <div className="text-[9px] opacity-40 uppercase tracking-tighter">Ticket #{w?.ticket_no}</div>
                      </Td>
                      <Td right className="font-mono font-black text-[var(--text)]">{fmt(a.auction_discount)}</Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </TableCard>
      </div>
    </div>
  )
}
