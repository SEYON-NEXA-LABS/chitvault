'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import { 
  Btn, Badge, TableCard, Table, Th, Td, Tr, inputClass, inputStyle,
  Loading, Empty, Toast, StatCard 
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { 
  ShieldAlert, AlertTriangle, AlertCircle, Phone, 
  Search, FileSpreadsheet, MessageCircle, MoreVertical,
  CheckCircle2
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { withFirmScope } from '@/lib/supabase/firmQuery'
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
  const [groups, setGroups] = useState<Group[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
    
    // Fetch all required data to calculate aging
    const [g, m, a, p] = await Promise.all([
      withFirmScope(supabase.from('groups').select('*').neq('status','closed'), targetId),
      withFirmScope(supabase.from('members').select('*, persons(*)').in('status',['active','foreman','defaulter']), targetId),
      withFirmScope(supabase.from('auctions').select('*'), targetId),
      withFirmScope(supabase.from('payments').select('*'), targetId)
    ])

    const groupsList = g.data || []
    const membersList = m.data || []
    const auctionsList = a.data || []
    const paymentsList = p.data || []

    setGroups(groupsList)

    // Calculate Arrears per Member
    const defaulters: any[] = []

    membersList.forEach((mem: any) => {
      const grp = groupsList.find((gx: any) => gx.id === mem.group_id)
      if (!grp) return

      const gAucs = auctionsList.filter((ax: any) => ax.group_id === grp.id)
      const mPays = paymentsList.filter((px: any) => px.member_id === mem.id && px.group_id === grp.id)
      
      // Determine current business month (max auctioned month + 1)
      const currentMonth = Math.min(grp.duration, gAucs.length + 1)
      
      let totalDue = 0
      let missedMonths: number[] = []
      
      for (let month = 1; month <= currentMonth; month++) {
        // Month N installment depends on Auction N-1 dividend
        const prevAuc = gAucs.find((ax: any) => ax.month === month - 1)
        const div = prevAuc ? Number(prevAuc.dividend || 0) : 0
        const monthDue = Number(grp.monthly_contribution) - div
        
        const monthPaid = mPays.filter((px: any) => px.month === month).reduce((s: number, px: any) => s + Number(px.amount), 0)
        
        if (monthDue - monthPaid > 0.01) {
            totalDue += (monthDue - monthPaid)
            missedMonths.push(month)
        }
      }

      if (totalDue > 0.01) {
        defaulters.push({
          member: mem,
          person: mem.persons,
          group: grp,
          totalDue,
          aging: missedMonths.length,
          missedMonths
        })
      }
    })

    // Sort by aging (most critical first)
    defaulters.sort((a, b) => b.aging - a.aging)
    setData(defaulters)
    setLoading(false)
  }, [supabase, firm, role, switchedFirmId])

  useEffect(() => { load() }, [load])

  const filtered = data.filter(x => {
    const matchesSearch = x.person.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          x.person.phone?.includes(searchTerm)
    const matchesGroup = !filterGroup || x.group.id === +filterGroup
    return matchesSearch && matchesGroup
  })

  // Stats
  const critical = data.filter(x => x.aging >= 3).length
  const warning = data.filter(x => x.aging === 2).length
  const arrears = data.filter(x => x.aging === 1).length

  const sendWhatsApp = (x: any) => {
    const msg = `Hello ${x.person.name}, this is a reminder from Your Chit Firm regarding ${x.group.name}. You have an outstanding balance of ₹${Math.round(x.totalDue)} for ${x.aging} month(s). Please clear your dues at the earliest. Thank you!`
    window.open(`https://wa.me/${x.person.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank')
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-[var(--accent)] flex items-center gap-3">
          <ShieldAlert size={32} />
          Defaulters Command Center
        </h1>
        <Btn variant="secondary" size="sm" onClick={() => load()}>Refresh List</Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Critical (3+ Mo)" value={critical} color="danger" />
        <StatCard label="Warning (2 Mo)" value={warning} color="info" />
        <StatCard label="Arrears (1 Mo)" value={arrears} color="accent" />
      </div>

      <TableCard title="Risk Discovery & Follow-up Registry" subtitle="Automated aging analysis across all active groups.">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
             <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
             <input className={inputClass} style={{ ...inputStyle, paddingLeft: '2.5rem' }} 
               placeholder="Search by name or phone..." 
               value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <select className={inputClass} style={{ ...inputStyle, width: '200px' }}
            value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <Empty icon="🎉" text="No pending dues found for these filters!" />
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Member / Person</Th>
                <Th>Group / Ticket</Th>
                <Th>Months Overdue</Th>
                <Th right>Total Arrears</Th>
                <Th className="text-center">Priority Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {filtered.map(x => (
                <Tr key={`${x.member.id}-${x.group.id}`}>
                  <Td>
                    <div className="font-bold flex items-center gap-2">
                       {x.person.name}
                       {x.member.status === 'defaulter' && <Badge variant="danger" className="text-[9px]">OFFICIAL DEFAULTER</Badge>}
                    </div>
                    <div className="text-[11px] opacity-60 flex items-center gap-1.5 mt-0.5">
                       <Phone size={10} /> {x.person.phone || 'No Phone'}
                    </div>
                  </Td>
                  <Td>
                    <div className="font-semibold">{x.group.name}</div>
                    <div className="text-[10px] opacity-50">Ticket No. #{x.member.ticket_no}</div>
                  </Td>
                  <Td>
                    {x.aging >= 3 ? (
                      <Badge variant="danger" className="animate-pulse flex items-center gap-1.5">
                        <ShieldAlert size={12} /> {x.aging} Months CRITICAL
                      </Badge>
                    ) : x.aging === 2 ? (
                      <Badge variant="danger" className="opacity-80 flex items-center gap-1.5 bg-orange-500 border-orange-500">
                        <AlertTriangle size={12} /> {x.aging} Months Warning
                      </Badge>
                    ) : (
                      <Badge variant="accent" className="flex items-center gap-1.5">
                        <AlertCircle size={12} /> {x.aging} Month Arrears
                      </Badge>
                    )}
                  </Td>
                  <Td right className="font-mono font-bold text-lg text-[var(--danger)]">
                    {fmt(x.totalDue)}
                  </Td>
                  <Td className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Btn size="sm" variant="secondary" icon={MessageCircle} 
                        style={{ color: '#25D366' }} onClick={() => sendWhatsApp(x)}>Remind</Btn>
                      <Btn size="sm" variant="secondary" icon={Phone} 
                        onClick={() => window.open(`tel:${x.person.phone}`)}>Call</Btn>
                      {x.member.status !== 'defaulter' && (
                        <Btn size="sm" variant="danger" icon={ShieldAlert}
                          onClick={() => markAsDefaulter(x.member.id)}>Mark D.</Btn>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableCard>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
