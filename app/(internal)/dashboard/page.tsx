'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { cn, fmt, fmtDate, fmtMonth, getToday, getGroupDisplayName } from '@/lib/utils'
import { 
  Users, Layers, TrendingUp, DollarSign, Wallet, ShieldCheck, 
  ArrowUpRight, Clock, Info, ShieldAlert, AlertTriangle, BarChart3,
  Gavel, CheckCircle2, Settings2, BookOpen, ChevronLeft, ChevronRight,
  Activity, Calendar, ArrowRight, Plus
} from 'lucide-react'
import { haptics } from '@/lib/utils/haptics'
import Link from 'next/link'
import { StatCard, Card, Loading, Badge, LineAnalytics, TableCard, Table, Th, Td, Tr, Btn, Modal } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { useTerminology } from '@/lib/hooks/useTerminology'
import type { Group, Auction, Payment, Firm } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, switchedFirmId, profile } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  const [showHelpModal, setShowHelpModal] = useState(false)
  
  const [groups,   setGroups]   = useState<Group[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [winnerInsightsRpc, setWinnerInsightsRpc] = useState<any>(null)
  const [dailyTrends, setDailyTrends] = useState<any[]>([])
  const [totalCounts, setTotalCounts] = useState({ groups: 0, members: 0 })
  const isSuper = role === 'superadmin'

  useEffect(() => {
    async function load() {
      if (!dashboardStats) setLoading(true)
      const targetId = isSuper ? switchedFirmId : firm?.id
      if (!targetId) {
        setLoading(false)
        return
      }

      try {
        const [g, a, p, dStats, collTrends, wInsights, dTrends, totalG, totalM] = await Promise.all([
          withFirmScope(supabase.from('groups').select('id, name, auction_scheme').neq('status','archived'), targetId).is('deleted_at', null),
          withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_discount, dividend, winner_id, status, is_payout_settled, payout_amount, payout_date, members!winner_id(id, ticket_no, persons(id, name))'), targetId).is('deleted_at', null).order('month', { ascending: false }).limit(10),
          withFirmScope(supabase.from('payments').select('id, amount, payment_date, created_at, members!member_id(persons(id, name))'), targetId).is('deleted_at', null).order('payment_date', { ascending: false }).limit(8),
          supabase.rpc('get_firm_dashboard_stats', { p_firm_id: targetId }),
          supabase.rpc('get_firm_collection_trends', { p_firm_id: targetId }),
          supabase.rpc('get_firm_winner_insights', { p_firm_id: targetId }),
          supabase.rpc('get_firm_daily_trends', { p_firm_id: targetId }),
          withFirmScope(supabase.from('groups').select('id', { count: 'exact', head: true }), targetId).is('deleted_at', null),
          withFirmScope(supabase.from('members').select('id', { count: 'exact', head: true }), targetId).is('deleted_at', null)
        ])

        setGroups(g.data || [])
        setAuctions(a.data || [])
        setPayments(p.data || [])
        setDashboardStats(dStats.data)
        setTrends(collTrends.data || [])
        setWinnerInsightsRpc(wInsights.data)
        setDailyTrends(dTrends.data || [])
        setTotalCounts({ 
          groups: totalG.count || 0, 
          members: totalM.count || 0 
        })
      } catch (err) {
        console.error('Dash load error', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, isSuper, switchedFirmId, firm?.id, dashboardStats === null])

  const { stats, chartData, groupSeries, onboardingSteps } = useMemo(() => {
    const s = dashboardStats || {}
    
    const stats = {
      totalChitValue: s.totalChitValue || 0,
      collectedToday: s.collectedToday || 0,
      totalReceivable: s.totalReceivable || 0,
      totalPayable: s.totalPayable || 0,
      todayVariance: s.todayVariance || 0,
      activeGroupsCount: s.activeGroups || groups.length,
      totalMembersCount: totalCounts.members || s.totalMembers || 0
    }

    const trendMap = new Map<string, any>()
    const groupSet = new Set<string>()

    ;(trends || []).forEach((t: any) => {
      const m = t.month
      if (!trendMap.has(m)) trendMap.set(m, { month: m })
      const entry = trendMap.get(m)
      entry[t.group_name] = Number(t.actual)
      groupSet.add(t.group_name)
    })

    const chartData = Array.from(trendMap.values()).sort((a, b) => a.month.localeCompare(b.month))
    const groupSeries = Array.from(groupSet)

    const onboardingSteps = [
      { id: '1', title: t('onboarding_step1_title'), desc: t('onboarding_step1_desc'), link: '/settings', completed: !!firm, icon: Settings2 },
      { id: '2', title: t('onboarding_step2_title'), desc: t('onboarding_step2_desc'), link: '/members', completed: stats.totalMembersCount > 0, icon: Users },
      { id: '3', title: t('onboarding_step3_title'), desc: t('onboarding_step3_desc'), link: '/groups', completed: stats.activeGroupsCount > 0, icon: Layers },
      { id: '4', title: t('onboarding_step4_title'), desc: t('onboarding_step4_desc'), link: '/groups', completed: auctions.length > 0, icon: Gavel },
      { id: '5', title: t('onboarding_step5_title'), desc: t('onboarding_step5_desc'), link: '/collection', completed: payments.length > 0, icon: Wallet },
      { id: '6', title: t('onboarding_step6_title'), desc: t('onboarding_step6_desc'), link: '/payments', completed: false, icon: DollarSign },
      { id: '7', title: t('onboarding_step7_title'), desc: t('onboarding_step7_desc'), link: '/reports', completed: false, icon: BarChart3 },
    ]

    return { stats, chartData, groupSeries, onboardingSteps }
  }, [groups, dashboardStats, trends, firm, t, totalCounts, auctions.length, payments.length])

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] tracking-tighter leading-none">{t('dash_overview')}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="gray" className="py-0.5 px-2 text-[9px] font-black bg-[var(--surface2)]">
              {firm?.name || 'Vault'}
            </Badge>
            <span className="text-[10px] font-bold text-[var(--text3)] tracking-wider">
              {new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSuper && <Badge variant="danger" className="py-1 px-3 font-bold">{t('dash_super_view')}</Badge>}
          <Btn variant="secondary" size="sm" className="text-xs font-bold" icon={Activity} onClick={() => router.push('/reports/activity')}>Audit Logs</Btn>
        </div>
      </div>

      {/* Welcome Hero Section - High Fidelity Glassmorphism */}
      <Card className="relative overflow-hidden p-4 bg-[var(--surface2)] border-[var(--border)] group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[var(--accent-dim)] to-transparent rounded-full blur-[80px] opacity-20 -translate-y-1/2 translate-x-1/2 group-hover:opacity-30 transition-opacity duration-700" />
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 relative z-10">
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[var(--text)] text-[var(--bg)] flex items-center justify-center font-bold text-lg">v</div>
              <h2 className="text-xl font-extrabold text-[var(--text)] tracking-tight">
                {t('dash_welcome_back')}, <span className="text-[var(--accent)]">{profile?.full_name?.split(' ')[0] || 'Partner'}</span>
              </h2>
            </div>
            <p className="text-xs font-medium text-[var(--text3)] mb-4 max-w-xl opacity-60">
              {isSuper ? t('dash_super_plane_desc') : t('dash_firm_plane_desc')}
            </p>
            <div className="flex items-center gap-2">
              <Btn variant="primary" size="sm" className="px-4 text-xs font-bold" icon={Users} onClick={() => router.push('/members')}>{t('dash_manage_reg')}</Btn>
              <Btn variant="secondary" size="sm" className="px-4 text-xs font-bold bg-white" icon={Layers} onClick={() => router.push('/groups')}>{t('dash_view_groups')}</Btn>
              <button 
                onClick={() => setShowHelpModal(true)}
                className="text-xs font-bold text-[var(--text3)] hover:text-[var(--text)] ml-2"
              >
                {t('onboarding_title')}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label={t('report_today_title')} value={fmt(stats.collectedToday)} icon={DollarSign} sub={t('dash_today_collected')} color="success" compact />
        <StatCard label="Total Receivable" value={fmt(stats.totalReceivable)} icon={Wallet} sub="Pending from Members" color="danger" compact />
        <StatCard label="Pending Payouts" value={fmt(stats.totalPayable)} icon={Gavel} sub="Owed to Winners" color="warning" compact />
        <StatCard 
          label="Cash Variance" 
          value={fmt(Math.abs(stats.todayVariance))} 
          icon={Activity} 
          sub={stats.todayVariance === 0 ? "Perfect Match" : (stats.todayVariance > 0 ? "Surplus Cash" : "Shortage Detected")} 
          color={stats.todayVariance === 0 ? "success" : "danger"} 
          compact
        />
      </div>

      {/* Trends & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <Card 
          title="Daily Reconciliation" 
          subtitle="7-Day Pulse (System vs Physical)"
          headerAction={
            <button onClick={() => router.push('/reports/today_collection')} className="p-2 hover:bg-[var(--surface2)] rounded-xl transition-colors">
              <ArrowUpRight size={20} />
            </button>
          }
          className="flex flex-col h-full bg-white shadow-sm border-[var(--border)]"
        >
          <div className="flex flex-col h-full justify-between">
            <div>
              <div className="flex items-end justify-between h-52 gap-4 mb-8 max-w-2xl mx-auto">
                {dailyTrends.map((d: any, i: number) => {
                  const max = Math.max(...dailyTrends.map((x: any) => Math.max(Number(x.expected), Number(x.actual))), 100)
                  const hExp = (Number(d.expected) / max) * 100
                  const hAct = (Number(d.actual) / max) * 100
                  return (
                    <div key={i} className="flex-1 group relative h-full flex flex-col justify-end">
                      <div className="flex items-end gap-1.5 h-full">
                        <div 
                          className="flex-1 bg-slate-100 group-hover:bg-slate-200 rounded-t-[6px] transition-all"
                          style={{ height: `${Math.max(8, hExp)}%` }}
                        />
                        <div 
                          className="flex-1 bg-[var(--success)] rounded-t-[6px] transition-all shadow-sm"
                          style={{ height: `${Math.max(8, hAct)}%` }}
                        />
                      </div>
                      <div className="mt-2 text-[9px] font-bold text-center tracking-tight opacity-40">{d.label}</div>
                      
                      <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-5 rounded-2xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 whitespace-nowrap z-50 shadow-2xl border border-white/10">
                        <div className="flex flex-col gap-3">
                          <div className="text-[10px] font-black tracking-widest opacity-40 border-b border-white/10 pb-2 mb-1 text-center">{fmtDate(d.day)}</div>
                          <div className="flex justify-between gap-10">
                            <span className="opacity-50 font-medium tracking-wide">System Expected:</span>
                            <span className="font-mono">{fmt(d.expected)}</span>
                          </div>
                          <div className="flex justify-between gap-10">
                            <span className="opacity-50 font-medium tracking-wide">Physical Actual:</span>
                            <span className="font-mono text-emerald-400">{fmt(d.actual)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
              <div className="flex gap-10">
                <div>
                  <div className="text-[10px] font-black text-[var(--text3)] tracking-widest mb-1.5 leading-none">Weekly Actual</div>
                  <div className="text-3xl font-black text-[var(--text)] tracking-tighter">
                    {fmt(dailyTrends.reduce((s, d) => s + Number(d.actual), 0))}
                  </div>
                </div>
                <div className="hidden sm:block">
                  <div className="text-[10px] font-black text-[var(--text3)] tracking-widest mb-1.5 leading-none">Weekly Variance</div>
                  <div className={cn("text-3xl font-black tracking-tighter", dailyTrends.reduce((s, d) => s + (Number(d.actual) - Number(d.expected)), 0) < 0 ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                    {fmt(Math.abs(dailyTrends.reduce((s, d) => s + (Number(d.actual) - Number(d.expected)), 0)))}
                  </div>
                </div>
              </div>
              <Btn variant="primary" size="sm" onClick={() => router.push('/cashbook')} className="h-10 w-10 p-0 rounded-md shadow-sm">
                <ArrowRight size={22} />
              </Btn>
            </div>
          </div>
        </Card>

        <LineAnalytics 
          title={t('dash_collection_perf')}
          data={chartData} 
          series={groupSeries} 
          height={440} 
          xKey="month" 
        />
      </div>

      {/* Activity & Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <TableCard title={t('dash_recent_activity')} subtitle={t('dash_realtime_feed')}>
            <Table>
              <thead>
                <Tr className="bg-[var(--surface2)]/30">
                  <Th className="text-[11px] font-bold py-2 px-3">{t('date')}</Th>
                  <Th className="text-[11px] font-bold">{t('nav_members')}</Th>
                  <Th right className="text-[11px] font-bold px-3">{t('amount')}</Th>
                </Tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map(p => (
                  <Tr key={p.id} className="hover:bg-[var(--surface2)]/50 group/row">
                    <Td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[var(--surface2)] flex items-center justify-center group-hover/row:bg-white group-hover/row:text-[var(--accent)] transition-all">
                          <Calendar size={14} strokeWidth={2} />
                        </div>
                        <div>
                          <div className="text-[var(--text)] font-bold text-sm">{fmtDate(p.payment_date)}</div>
                          <div className="text-[10px] font-medium opacity-50">{new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="font-bold text-sm text-[var(--text)]">{(p.members as any)?.persons?.name}</div>
                      <div className="text-[10px] font-medium opacity-50">{t('receipt_received')}</div>
                    </Td>
                    <Td right className="px-3">
                      <span className="text-emerald-600 font-bold text-sm font-mono">{fmt(p.amount)}</span>
                    </Td>
                  </Tr>
                ))}
                {payments.length === 0 && (
                  <Tr><Td colSpan={3} className="text-center py-20 text-slate-300 italic text-sm">{t('dash_no_recent_payments')}</Td></Tr>
                )}
              </tbody>
            </Table>
          </TableCard>
        </div>

        <div className="lg:col-span-4">
          <Card className="p-4 bg-[var(--surface2)] border-[var(--border)] h-full flex flex-col justify-between group">
            <div className="relative z-10">
              <h3 className="text-[11px] font-bold mb-6 opacity-40">Firm Intelligence</h3>
              <div className="space-y-6">
                <div className="group/metric">
                  <div className="text-[10px] font-bold mb-1 opacity-60">Top Borrower</div>
                  <div className="text-xl font-extrabold text-[var(--text)] tracking-tight">
                    {winnerInsightsRpc?.topBorrower?.name || '---'}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600 mt-1.5 bg-emerald-50 w-fit px-2 py-0.5 rounded">
                    {fmt(winnerInsightsRpc?.topBorrower?.totalDiscount || 0)} Discount Recovery
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="group/metric">
                    <div className="text-[10px] font-bold mb-1 opacity-60">Early Birds</div>
                    <div className="text-2xl font-extrabold text-[var(--text)]">{winnerInsightsRpc?.earlyBirdCount || 0}</div>
                  </div>
                  <div className="group/metric">
                    <div className="text-[10px] font-bold mb-1 opacity-60">Peak Bid</div>
                    <div className="text-2xl font-extrabold text-[var(--text)]">{fmt(winnerInsightsRpc?.highestSingleDiscount || 0)}</div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200">
                  <div className="text-[10px] font-bold mb-4 opacity-60">Operations</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => router.push('/collection')} className="p-3 rounded-xl bg-white border border-[var(--border)] hover:border-slate-900 transition-all text-left shadow-sm">
                      <Wallet size={14} className="text-emerald-500 mb-1.5" />
                      <div className="text-[10px] font-bold text-[var(--text)]">Collect</div>
                    </button>
                    <button onClick={() => router.push('/groups?add=true')} className="p-3 rounded-xl bg-white border border-[var(--border)] hover:border-slate-900 transition-all text-left shadow-sm">
                      <Plus size={14} className="text-blue-500 mb-1.5" />
                      <div className="text-[10px] font-bold text-[var(--text)]">New Group</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <Btn variant="primary" size="sm" className="relative z-10 w-full mt-6 text-xs font-bold" icon={ArrowRight} onClick={() => router.push('/reports')}>
              Analytics Hub
            </Btn>
          </Card>
        </div>
      </div>

      <Modal 
        open={showHelpModal} 
        onClose={() => setShowHelpModal(false)}
        title={t('onboarding_steps_guide')}
      >
        <div className="space-y-6 py-4">
          <p className="text-sm font-medium px-2 opacity-60 tracking-widest text-[10px]">{t('onboarding_subtitle')}</p>
          <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto px-1 pr-2 custom-scrollbar">
            {onboardingSteps.map((step) => {
              const Icon = step.icon
              return (
                <Link 
                  href={step.link} 
                  key={step.id} 
                  onClick={() => setShowHelpModal(false)}
                   className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${step.completed ? 'bg-emerald-50 border-emerald-100 opacity-60' : 'bg-[var(--surface2)] border-[var(--border)] hover:border-slate-900 hover:bg-white shadow-sm'}`}
                >
                   <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${step.completed ? 'bg-emerald-500 text-white' : 'bg-white border shadow-sm'}`}>
                    {step.completed ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-black text-[10px] tracking-widest mb-1 ${step.completed ? 'text-emerald-700 line-through opacity-40' : 'text-[var(--text)]'}`}>{step.title}</h4>
                    <p className="text-[10px] font-bold text-[var(--text3)] truncate">{step.desc}</p>
                  </div>
                  <ArrowUpRight size={16} className="text-slate-300" />
                </Link>
              )
            })}
          </div>
          <Btn variant="primary" className="w-full text-[10px] font-black tracking-widest h-12 shadow-lg shadow-blue-200" onClick={() => { setShowHelpModal(false); router.push('/help') }} icon={BookOpen}>
            {t('onboarding_knowledge_base')}
          </Btn>
        </div>
      </Modal>
    </div>
  )
}
