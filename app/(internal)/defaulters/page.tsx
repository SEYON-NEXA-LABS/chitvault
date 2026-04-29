'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, cn } from '@/lib/utils'
import {
  Btn, Badge, TableCard, Table, Th, Td, Tr, inputClass, inputStyle,
  Loading, Empty, Toast, StatCard
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import {
  ShieldAlert, AlertTriangle, AlertCircle, Phone,
  Search, MessageCircle, Info, TrendingUp, Layers
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'
import type { Group, Member, Auction, Payment, Person } from '@/types'

export default function DefaultersPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const { toast, show, hide } = useToast()

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGroup, setFilterGroup] = useState('')
  const [activeTab, setActiveTab] = useState<'ACCUMULATION' | 'DIVIDEND_SHARE'>('ACCUMULATION')
  const [groups, setGroups] = useState<Group[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id

    const [g, m, a, p] = await Promise.all([
      withFirmScope(supabase.from('groups').select('id, name, auction_scheme, monthly_contribution, start_date, duration, num_members, status').neq('status', 'closed'), targetId),
      withFirmScope(supabase.from('members').select('id, ticket_no, group_id, person_id, status, persons(id, name, phone)').in('status', ['active', 'foreman', 'defaulter']), targetId),
      withFirmScope(supabase.from('auctions').select('id, group_id, month, dividend, status, auction_date').is('deleted_at', null), targetId),
      withFirmScope(supabase.from('payments').select('id, member_id, group_id, month, amount, payment_type, payment_date, created_at').is('deleted_at', null), targetId)
    ])

    const groupsList = g.data || []
    const membersList = m.data || []
    const auctionsList = a.data || []
    const paymentsList = p.data || []

    setGroups(groupsList)

    const defaulters: any[] = []
    membersList.forEach((mem: any) => {
      const grp = groupsList.find((gx: any) => gx.id === mem.group_id)
      if (!grp) return

      const status = getMemberFinancialStatus(mem, grp, auctionsList, paymentsList)

      if (status.balance > 0.01) {
        defaulters.push({
          member: mem,
          person: mem.persons,
          group: grp,
          status,
          scheme: grp.auction_scheme?.toUpperCase() || 'DIVIDEND_SHARE'
        })
      }
    })

    defaulters.sort((a, b) => b.status.missedCount - a.status.missedCount)
    setData(defaulters)
    setLoading(false)
  }, [supabase, firm, role, switchedFirmId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    return data.filter(x => {
      const matchesSearch = x.person.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        x.person.phone?.includes(searchTerm)
      const matchesGroup = !filterGroup || x.group.id === +filterGroup
      const matchesScheme = x.scheme === activeTab
      return matchesSearch && matchesGroup && matchesScheme
    })
  }, [data, searchTerm, filterGroup, activeTab])

  // Stats per active tab
  const tabData = data.filter(x => x.scheme === activeTab)
  const stats = {
    totalArrears: tabData.reduce((s, x) => s + x.status.balance, 0),
    criticalCount: tabData.filter(x => x.status.missedCount >= 3).length,
    warningCount: tabData.filter(x => x.status.missedCount < 3).length
  }

  const sendWhatsApp = (x: any) => {
    const msg = `Hello ${x.person.name}, this is a reminder from Your Chit Firm regarding ${x.group.name}. You have an outstanding balance of ₹${Math.round(x.status.balance)} for ${x.status.missedCount} month(s). Please clear your dues at the earliest. Thank you!`
    window.open(`https://wa.me/${x.person.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const markAsDefaulter = async (memberId: number) => {
    if (!confirm('Marking this member as an official Defaulter will flag them globally in the system. Proceed?')) return
    const { error } = await supabase.from('members').update({ status: 'defaulter' }).eq('id', memberId)
    if (error) show(error.message, 'error')
    else { show('Member status updated'); load() }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] tracking-tight italic">
            DEFAULTERS <span className="text-[var(--accent)] font-display not-italic">COMMAND CENTER</span>
          </h1>
          <p className="text-xs opacity-50 mt-1 font-medium uppercase tracking-widest">Real-time risk audit & recovery</p>
        </div>
        <Btn variant="secondary" size="sm" onClick={() => load()}>Refresh Registry</Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label={`${activeTab === 'DIVIDEND_SHARE' ? 'Dividend' : 'Accum.'} Arrears`} value={fmt(stats.totalArrears)} color="danger" />
        <StatCard label="Critical Assets" value={stats.criticalCount} color="danger" />
        <StatCard label="Warning Assets" value={stats.warningCount} color="info" />
      </div>

      {/* Modern Tabs */}
      <div className="flex p-1 bg-[var(--surface2)] rounded-2xl border border-[var(--border)] max-w-md">
        <button
          onClick={() => setActiveTab('ACCUMULATION')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
            activeTab === 'ACCUMULATION' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm border border-[var(--border)]" : "opacity-40 hover:opacity-100"
          )}
        >
          <Layers size={14} /> Accumulation
        </button>
        <button
          onClick={() => setActiveTab('DIVIDEND_SHARE')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
            activeTab === 'DIVIDEND_SHARE' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm border border-[var(--border)]" : "opacity-40 hover:opacity-100"
          )}
        >
          <TrendingUp size={14} /> Dividend Scheme
        </button>
      </div>

      <TableCard
        title={`${activeTab === 'DIVIDEND_SHARE' ? 'Dividend' : 'Accumulation'} Risk Discovery`}
        subtitle={`Automated aging analysis specifically for ${activeTab.toLowerCase()} models.`}
      >
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30" />
            <input className={inputClass} style={{ ...inputStyle, paddingLeft: '2.5rem' }}
              placeholder="Filter by name or phone..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className={inputClass} style={{ ...inputStyle, width: '220px' }}
            value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
            <option value="">Filter by Group</option>
            {groups.filter(g => (g.auction_scheme?.toUpperCase() || 'DIVIDEND_SHARE') === activeTab).map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <Empty icon={activeTab === 'DIVIDEND_SHARE' ? '📉' : '🏦'} title="Clean Registry" subtitle={`No ${activeTab.toLowerCase()} defaults detected for current filters.`} />
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Member / Person</Th>
                <Th>Group Identity</Th>
                <Th>Aging Analysis</Th>
                <Th right>Outstanding</Th>
                <Th className="text-center">Priority Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filtered.map(x => (
                <Tr key={`${x.member.id}-${x.group.id}`}>
                  <Td>
                    <div className="font-black text-base flex items-center gap-2 text-[var(--text)]">
                      {x.person.name}
                      {x.member.status === 'defaulter' && <Badge variant="danger" className="text-[9px] uppercase font-black">Official Defaulter</Badge>}
                    </div>
                    <div className="text-[11px] opacity-40 font-medium flex items-center gap-1.5 mt-0.5 uppercase tracking-tighter">
                      <Phone size={10} strokeWidth={3} /> {x.person.phone || 'No Contact'}
                    </div>
                  </Td>
                  <Td>
                    <div className="font-bold text-[var(--text)]">{x.group.name}</div>
                    <div className="text-[10px] opacity-40 uppercase font-black tracking-widest mt-0.5">Ticket #{x.member.ticket_no}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-col gap-1.5">
                      {x.status.missedCount >= 3 ? (
                        <Badge variant="danger" className="w-fit flex items-center gap-1.5 py-1 px-2.5 bg-red-500/10 text-red-500 border-red-500/20">
                          <ShieldAlert size={12} strokeWidth={2.5} /> {x.status.missedCount} MONTHS CRITICAL
                        </Badge>
                      ) : x.status.missedCount === 2 ? (
                        <Badge variant="danger" className="w-fit flex items-center gap-1.5 py-1 px-2.5 bg-orange-500/10 text-orange-500 border-orange-500/20">
                          <AlertTriangle size={12} strokeWidth={2.5} /> {x.status.missedCount} MONTHS WARNING
                        </Badge>
                      ) : (
                        <Badge variant="accent" className="w-fit flex items-center gap-1.5 py-1 px-2.5 bg-blue-500/10 text-blue-500 border-blue-500/20">
                          <AlertCircle size={12} strokeWidth={2.5} /> {x.status.missedCount} MONTH ARREARS
                        </Badge>
                      )}
                      <div className="flex gap-0.5 mt-0.5">
                        {x.status.streak.slice(0, 12).map((s: any, idx: number) => (
                          <div key={idx} className={cn(
                            "w-1.5 h-1.5 rounded-full ring-1 ring-[var(--border)]",
                            s.status === 'success' ? "bg-green-500" : s.status === 'danger' ? "bg-red-500" : s.status === 'info' ? "bg-blue-500" : "bg-gray-300 opacity-20"
                          )} title={`Month ${s.month}: ${s.status}`} />
                        ))}
                      </div>
                    </div>
                  </Td>
                  <Td right>
                    <div className="font-mono font-black text-xl text-[var(--danger)] leading-none italic">
                      {fmt(x.status.balance)}
                    </div>
                    <div className="text-[9px] opacity-30 font-bold uppercase tracking-tight mt-1">Total Due: {fmt(x.status.totalDue)}</div>
                  </Td>
                  <Td className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Btn size="sm" variant="secondary" icon={MessageCircle}
                        style={{ color: '#25D366' }} onClick={() => sendWhatsApp(x)}>Remind</Btn>
                      <Btn size="sm" variant="secondary" icon={Phone}
                        onClick={() => window.open(`tel:${x.person.phone}`)}>Call</Btn>
                      {x.member.status !== 'defaulter' && (
                        <Btn size="sm" variant="danger" icon={ShieldAlert}
                          onClick={() => markAsDefaulter(x.member.id)}>Mark</Btn>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableCard>

      <div className="bg-[var(--surface2)] rounded-2xl p-6 border border-[var(--border)] flex items-start gap-4">
        <div className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-[var(--accent)] shadow-sm">
          <Info size={24} />
        </div>
        <div>
          <h4 className="text-sm font-black uppercase tracking-widest text-[var(--text)] italic">Understanding Arrears by Scheme</h4>
          <p className="text-xs opacity-50 mt-1 leading-relaxed max-w-2xl font-medium uppercase tracking-tighter">
            **Dividend Scheme**: Members are considered in arrears for the current month if their auction hasn&apos;t occurred yet, as the dividend is not yet applied.
            **Accumulation Scheme**: Future months are never considered arrears. Only completed auction months contribute to the outstanding balance.
          </p>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}

