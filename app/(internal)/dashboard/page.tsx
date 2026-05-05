'use client'
 
 import { useEffect, useState, useMemo, useRef } from 'react'
 import { useRouter } from 'next/navigation'
 import { createClient } from '@/lib/supabase/client'
 import { useFirm } from '@/lib/firm/context'
 import { fmt, fmtDate, fmtMonth, getToday, getGroupDisplayName } from '@/lib/utils'
 import { 
   Users, Layers, TrendingUp, DollarSign, Wallet, ShieldCheck, 
   ArrowUpRight, Clock, Info, ShieldAlert, AlertTriangle, BarChart3,
   Gavel, CheckCircle2, Settings2, BookOpen, ChevronLeft, ChevronRight
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
   const [firms,    setFirms]    = useState<Firm[]>([])
   const [firmsLoaded, setFirmsLoaded] = useState(false)
 
   const [dashboardStats, setDashboardStats] = useState<any>(null)
   const [trends, setTrends] = useState<any[]>([])
   const [winnerInsightsRpc, setWinnerInsightsRpc] = useState<any>(null)
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
         const [g, a, p, dStats, collTrends, wInsights, totalG, totalM] = await Promise.all([
           withFirmScope(supabase.from('groups').select('id, name, auction_scheme').neq('status','archived'), targetId).is('deleted_at', null),
           withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_discount, dividend, winner_id, status, is_payout_settled, payout_amount, payout_date, members!winner_id(id, ticket_no, persons(id, name))'), targetId).is('deleted_at', null).order('month', { ascending: false }).limit(10),
           withFirmScope(supabase.from('payments').select('id, amount, payment_date, created_at, members!member_id(persons(id, name))'), targetId).is('deleted_at', null).order('payment_date', { ascending: false }).limit(5),
           supabase.rpc('get_firm_dashboard_stats', { p_firm_id: targetId }),
           supabase.rpc('get_firm_collection_trends', { p_firm_id: targetId }),
           supabase.rpc('get_firm_winner_insights', { p_firm_id: targetId }),
           withFirmScope(supabase.from('groups').select('id', { count: 'exact', head: true }), targetId).is('deleted_at', null),
           withFirmScope(supabase.from('members').select('id', { count: 'exact', head: true }), targetId).is('deleted_at', null)
         ])
 
         setGroups(g.data || [])
         setAuctions(a.data || [])
         setPayments(p.data || [])
         setDashboardStats(dStats.data)
         setTrends(collTrends.data || [])
         setWinnerInsightsRpc(wInsights.data)
         setTotalCounts({ 
           groups: totalG.count || 0, 
           members: totalM.count || 0 
         })
 
         if (isSuper && !firmsLoaded) {
           const { data: f } = await supabase.from('firms').select('id, name').order('name')
           setFirms(f || [])
           setFirmsLoaded(true)
         }
       } catch (err) {
         console.error('Dash load error', err)
       } finally {
         setLoading(false)
       }
     }
     load()
   }, [supabase, isSuper, switchedFirmId, firm?.id, dashboardStats === null, firmsLoaded])
 
   const { stats, chartData, groupSeries, onboardingSteps } = useMemo(() => {
     const s = dashboardStats || {}
     
     const stats = {
       totalChitValue: s.totalChitValue || 0,
       collectedToday: s.collectedToday || 0,
       totalOutstanding: s.totalOutstanding || 0,
       activeMembersCount: s.totalActiveMembers || s.totalMembers || 0,
       totalMembersCount: totalCounts.members || s.totalMembers || 0,
       activeGroupsCount: groups.length,
       totalGroupsCount: totalCounts.groups || groups.length
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
       { id: '3', title: t('onboarding_step3_title'), desc: t('onboarding_step3_desc'), link: '/groups', completed: stats.totalGroupsCount > 0, icon: Layers },
       { id: '4', title: t('onboarding_step4_title'), desc: t('onboarding_step4_desc'), link: '/groups', completed: auctions.length > 0, icon: Gavel },
       { id: '5', title: t('onboarding_step5_title'), desc: t('onboarding_step5_desc'), link: '/collection', completed: payments.length > 0, icon: Wallet },
       { id: '6', title: t('onboarding_step6_title'), desc: t('onboarding_step6_desc'), link: '/payments', completed: false, icon: DollarSign },
       { id: '7', title: t('onboarding_step7_title'), desc: t('onboarding_step7_desc'), link: '/reports', completed: false, icon: BarChart3 },
     ]
 
     return { stats, chartData, groupSeries, onboardingSteps }
   }, [groups, dashboardStats, trends, firm, t])
 
   if (loading) return <Loading />
 
   return (
     <div className="space-y-8">
       <div className="flex items-center justify-between px-2">
         <h1 className="text-3xl font-black text-slate-900 tracking-tight">{t('dash_overview')}</h1>
         {isSuper && <Badge variant="danger">{t('dash_super_view')}</Badge>}
       </div>
 
       <div className="relative group overflow-hidden rounded-[2.5rem] p-8 bg-slate-50 border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:bg-white">
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
           <div className="lg:col-span-3 flex flex-col justify-center">
               <h2 className="text-2xl font-black text-slate-900 mb-2">
                 {t('dash_welcome_back')}, {firm?.name || profile?.full_name || 'User'}!
               </h2>
               <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mb-8">
                 {isSuper 
                   ? t('dash_super_plane_desc')
                   : t('dash_firm_plane_desc')}
               </p>
               <div className="flex flex-wrap gap-3">
                  <Btn variant="primary" className="text-xs font-bold uppercase tracking-widest" icon={Users} onClick={() => router.push('/members')}>{t('dash_manage_reg')}</Btn>
                  <Btn variant="secondary" className="text-xs font-bold uppercase tracking-widest bg-white" icon={Layers} onClick={() => router.push('/groups')}>{t('dash_view_groups')}</Btn>
                  <Btn variant="ghost" icon={Info} onClick={() => setShowHelpModal(true)} className="text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900">
                    {t('onboarding_title')}
                  </Btn>
               </div>
           </div>
           <div className="hidden lg:flex items-center justify-center">
              <TrendingUp size={100} className="text-slate-100" />
           </div>
         </div>
       </div>
 
       {/* Quick Help Modal */}
       <Modal 
         open={showHelpModal} 
         onClose={() => setShowHelpModal(false)}
         title={t('onboarding_steps_guide')}
       >
         <div className="space-y-6 py-4">
           <p className="text-sm text-slate-400 font-medium px-2">{t('onboarding_subtitle')}</p>
           <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto px-1 pr-2 custom-scrollbar">
             {onboardingSteps.map((step) => {
               const Icon = step.icon
               return (
                 <Link 
                   href={step.link} 
                   key={step.id} 
                   onClick={() => setShowHelpModal(false)}
                   className={`flex items-center gap-4 p-5 rounded-3xl border transition-all ${step.completed ? 'bg-emerald-50 border-emerald-100 opacity-60' : 'bg-slate-50 border-slate-100 hover:border-slate-900 hover:bg-white'}`}
                 >
                   <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center ${step.completed ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border'}`}>
                     {step.completed ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                   </div>
                   <div className="flex-1 min-w-0">
                     <h4 className={`font-bold text-sm mb-0.5 ${step.completed ? 'text-emerald-700 line-through opacity-40' : 'text-slate-900'}`}>{step.title}</h4>
                     <p className="text-xs text-slate-400 line-clamp-1">{step.desc}</p>
                   </div>
                   <ArrowUpRight size={16} className="text-slate-300" />
                 </Link>
               )
             })}
           </div>
           <Btn variant="primary" className="w-full text-xs font-bold uppercase tracking-widest" onClick={() => { setShowHelpModal(false); router.push('/help') }} icon={BookOpen}>
             {t('onboarding_knowledge_base')}
           </Btn>
         </div>
       </Modal>
 
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard label={t('report_today_title')} value={fmt(stats.collectedToday)} icon={DollarSign} sub={t('dash_today_collected')} color="success" />
         <StatCard label={t('market_debt_label')} value={fmt(stats.totalOutstanding)} icon={Wallet} sub={t('dash_total_receivable')} color="danger" />
         <StatCard label={t('nav_groups')} value={`${stats.activeGroupsCount} / ${stats.totalGroupsCount}`} icon={Layers} sub={t('dash_live_status')} color="info" />
         <StatCard label={t('nav_members')} value={`${stats.activeMembersCount} / ${stats.totalMembersCount}`} icon={Users} sub={t('dash_live_status')} color="accent" />
       </div>
 
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2">
           <LineAnalytics 
             title={t('dash_collection_perf')}
             data={chartData} 
             series={groupSeries} 
             height={300} 
             xKey="month" 
           />
         </div>
         <div>
           <TableCard title={t('dash_recent_activity')} subtitle={t('dash_realtime_feed')}>
             <Table>
               <thead><Tr><Th className="text-xs font-bold uppercase tracking-wider">{t('date')}</Th><Th className="text-xs font-bold uppercase tracking-wider">{t('nav_members')}</Th><Th right className="text-xs font-bold uppercase tracking-wider">{t('amount')}</Th></Tr></thead>
               <tbody>
                 {payments.map(p => (
                   <Tr key={p.id}>
                     <Td className="whitespace-nowrap font-medium text-[var(--text2)] text-[10px] leading-tight">
                        <div>{fmtDate(p.payment_date)}</div>
                        <div className="text-[var(--text3)] mt-0.5">{new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                      </Td>
                     <Td>
                        <div className="font-bold text-sm text-slate-900">{(p.members as any)?.persons?.name}</div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">{t('receipt_received')}</div>
                     </Td>
                     <Td right className="text-emerald-600 font-bold text-sm font-mono">{fmt(p.amount)}</Td>
                   </Tr>
                 ))}
                 {payments.length === 0 && <Tr><Td colSpan={3} className="text-center py-12 text-slate-300 italic text-sm">{t('dash_no_recent_payments')}</Td></Tr>}
               </tbody>
             </Table>
           </TableCard>
         </div>
       </div>
     </div>
   )
 }
