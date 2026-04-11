'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, getToday, getGroupDisplayName } from '@/lib/utils'
import { 
  Users, Layers, TrendingUp, DollarSign, Wallet, ShieldCheck, 
  ArrowUpRight, Clock, Info, ShieldAlert, AlertTriangle, BarChart3
} from 'lucide-react'
import { StatCard, Card, Loading, Badge, LineAnalytics, TableCard, Table, Th, Td, Tr, Btn } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { useTerminology } from '@/lib/hooks/useTerminology'
import { useUsage } from '@/lib/hooks/useUsage'
import type { Group, Auction, Payment, Firm } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  
  const [groups,   setGroups]   = useState<Group[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [firms,    setFirms]    = useState<Firm[]>([])
  const [firmsLoaded, setFirmsLoaded] = useState(false)

  const [dashboardStats, setDashboardStats] = useState<any>(null)
  const [trends, setTrends] = useState<any[]>([])
  const [winnerInsightsRpc, setWinnerInsightsRpc] = useState<any>(null)
  const isSuper = role === 'superadmin'
  const { data: usageData } = useUsage(isSuper ? switchedFirmId : firm?.id)

  useEffect(() => {
    async function load() {
      if (!dashboardStats) setLoading(true)
      const targetId = isSuper ? switchedFirmId : firm?.id
      if (!targetId) return

      try {
        const [g, a, p, dStats, collTrends, wInsights] = await Promise.all([
          withFirmScope(supabase.from('groups').select('id, name, auction_scheme').neq('status','archived'), targetId).is('deleted_at', null),
          withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_discount, dividend, winner_id, status, members!winner_id(id, ticket_no, persons(id, name))'), targetId).is('deleted_at', null).order('month', { ascending: false }).limit(10),
          withFirmScope(supabase.from('payments').select('id, amount, payment_date, created_at, members!member_id(persons(id, name))'), targetId).is('deleted_at', null).order('payment_date', { ascending: false }).limit(5),
          supabase.rpc('get_firm_dashboard_stats', { p_firm_id: targetId }),
          supabase.rpc('get_firm_collection_trends', { p_firm_id: targetId }),
          supabase.rpc('get_firm_winner_insights', { p_firm_id: targetId })
        ])

        setGroups(g.data || [])
        setAuctions(a.data || [])
        setPayments(p.data || [])
        setDashboardStats(dStats.data)
        setTrends(collTrends.data || [])
        setWinnerInsightsRpc(wInsights.data)

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
  }, [supabase, isSuper, switchedFirmId, firm])

  const { stats, chartData, groupSeries, onboardingSteps } = useMemo(() => {
    const s = dashboardStats || {}
    
    const stats = {
      totalChitValue: s.totalChitValue || 0,
      collectedToday: s.collectedToday || 0,
      totalOutstanding: s.totalOutstanding || 0,
      activeMembers: s.totalMembers || 0,
      activeGroups: groups.length
    }

    const trendMap = new Map<string, any>()
    const groupSet = new Set<string>()

    ;(trends || []).forEach((t: any) => {
      const m = t.month.substring(5)
      if (!trendMap.has(m)) trendMap.set(m, { month: m })
      const entry = trendMap.get(m)
      entry[t.group_name] = Number(t.actual)
      groupSet.add(t.group_name)
    })

    const chartData = Array.from(trendMap.values()).sort((a, b) => a.month.localeCompare(b.month))
    const groupSeries = Array.from(groupSet)

    const onboardingSteps = [
      { id: '1', title: t('onboarding_step1_title'), desc: t('onboarding_step1_desc'), link: '/settings', completed: !!firm },
      { id: '2', title: t('onboarding_step2_title'), desc: t('onboarding_step2_desc'), link: '/groups', completed: groups.length > 0 },
      { id: '3', title: t('onboarding_step3_title'), desc: t('onboarding_step3_desc'), link: '/members', completed: stats.activeMembers >= 5 },
      { id: '4', title: t('onboarding_step4_title'), desc: t('onboarding_step4_desc'), link: '/payments', completed: stats.collectedToday > 0 },
    ]

    return { stats, chartData, groupSeries, onboardingSteps }
  }, [groups, dashboardStats, trends, firm, t])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-[var(--text)]">{t('dash_overview')}</h1>
        {isSuper && <Badge variant="danger">{t('dash_super_view')}</Badge>}
      </div>

      <div className="relative group overflow-hidden rounded-[3rem] p-8 bg-[var(--surface2)] border-2 shadow-xl" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
          <div className="lg:col-span-3 flex flex-col justify-center">
              <h2 className="text-3xl font-black mb-2">Welcome back, {firm?.name}!</h2>
              <p className="opacity-60 font-medium mb-6">Manage your collections and monitor group growth in one place.</p>
              <div className="flex flex-wrap gap-4">
                 <Btn variant="primary" icon={Users} onClick={() => router.push('/members')}>Manage Registry</Btn>
                 <Btn variant="secondary" icon={Layers} onClick={() => router.push('/groups')}>View Groups</Btn>
              </div>
          </div>
          <div className="hidden lg:flex items-center justify-center">
             <TrendingUp size={120} className="opacity-10 text-[var(--accent)]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Collection" value={fmt(stats.collectedToday)} icon={DollarSign} sub="+12%" color="success" />
        <StatCard label="Market Debt" value={fmt(stats.totalOutstanding)} icon={Wallet} sub="Action" color="danger" />
        <StatCard label="Active Groups" value={stats.activeGroups} icon={Layers} color="info" />
        <StatCard label="Total Subscribers" value={stats.activeMembers} icon={Users} color="accent" />
        {(role === 'owner' || isSuper) && (
          <StatCard 
            label="Data Egress (Est)" 
            value={usageData ? (usageData.egress.total_estimate / (1024 * 1024)).toFixed(1) + ' MB' : '0 MB'} 
            icon={BarChart3} 
            color="warning" 
            sub="Monthly Usage"
            onClick={() => router.push('/usage')}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LineAnalytics 
            title="Collection Performance"
            data={chartData} 
            series={groupSeries} 
            height={300} 
            xKey="month" 
          />
        </div>
        <div>
          <TableCard title="Recent Activity" subtitle="Real-time collection & auction feed">
            <Table>
              <thead><Tr><Th>Type</Th><Th right>Amount</Th></Tr></thead>
              <tbody>
                {payments.map(p => (
                  <Tr key={p.id}>
                    <Td>
                       <div className="font-bold text-xs">{(p.members as any)?.persons?.name}</div>
                       <div className="text-[9px] opacity-40 uppercase tracking-tighter">Receipt Received</div>
                    </Td>
                    <Td right className="text-[var(--success)] font-bold">{fmt(p.amount)}</Td>
                  </Tr>
                ))}
                {payments.length === 0 && <Tr><Td colSpan={2} className="text-center py-10 opacity-40 italic">No recent payments.</Td></Tr>}
              </tbody>
            </Table>
          </TableCard>
        </div>
      </div>
    </div>
  )
}
