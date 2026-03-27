'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import {
  TableCard, Table, Th, Td, Tr,
  Loading, Empty, Badge, StatCard, Btn
} from '@/components/ui'
import { Printer, Phone, MapPin, AlertCircle } from 'lucide-react'
import type { Group, Member, Auction, Payment } from '@/types'

interface PendingItem {
  member: Member;
  group: Group;
  unpaidAucs: Auction[];
  totalDue: number;
  paidCount: number;
}

export default function CollectionPage() {
  const supabase = createClient()
  const { firm } = useFirm()
  const [groups,  setGroups]  = useState<Group[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [auctions,setAuctions] = useState<Auction[]>([])
  const [payments,setPayments] = useState<Payment[]>([])
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      if (!firm) return
      const [g, m, a, p] = await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('members').select('*, persons(*)'),
        supabase.from('auctions').select('*'),
        supabase.from('payments').select('*').eq('status', 'paid')
      ])
      setGroups(g.data || [])
      setMembers(m.data || [])
      setAuctions(a.data || [])
      setPayments(p.data || [])
      setLoading(false)
    }
    load()
  }, [firm, supabase])

  const report = useMemo(() => {
    const list: PendingItem[] = []
    
    groups.forEach(g => {
       const gAucs = auctions.filter(a => a.group_id === g.id)
       const gMembers = members.filter(m => m.group_id === g.id)
       
       gMembers.forEach(m => {
          const mPayments = payments.filter(p => p.member_id === m.id && p.group_id === g.id)
          const paidMonths = mPayments.map(p => p.month)
          const unpaidAucs = gAucs.filter(a => !paidMonths.includes(a.month))
          
          if (unpaidAucs.length > 0) {
             const monthlyDue = g.monthly_contribution
             const totalDue = unpaidAucs.reduce((s, a) => s + (monthlyDue - Number(a.dividend || 0)), 0)
             
             list.push({
                member: m,
                group: g,
                unpaidAucs,
                totalDue,
                paidCount: paidMonths.length
             })
          }
       })
    })
    return list.sort((a,b) => b.totalDue - a.totalDue)
  }, [groups, members, auctions, payments])

  const pending = report.filter(x => x.unpaidAucs.length < 3)
  const defaults = report.filter(x => x.unpaidAucs.length >= 3)
  
  const totalPending = pending.reduce((s, x) => s + x.totalDue, 0)
  const totalDefault = defaults.reduce((s, x) => s + x.totalDue, 0)
  const today = fmtDate(new Date().toISOString())

  const thead = (
    <tr>
      <Th>Member</Th>
      <Th>Phone</Th>
      <Th className="hidden lg:table-cell">Area</Th>
      <Th className="hidden sm:table-cell">Paid/Pending</Th>
      <Th className="hidden md:table-cell">Pending Months</Th>
      <Th className="hidden xl:table-cell">Amount Breakdown</Th>
      <Th right>Total Due</Th>
      <Th>Action</Th>
    </tr>
  )

  function Row({ x, isDefaulter }: { x: PendingItem; isDefaulter: boolean }) {
    const p = x.member.persons
    return (
      <Tr style={isDefaulter ? { background: 'rgba(246,109,122,0.04)' } : undefined}>
        <Td>
          <div className="font-semibold text-xs md:text-sm">
            {p?.name || x.member.id}
            {isDefaulter && <span className="ml-1 text-[9px] text-red-500 font-bold uppercase">⚠ Defaulter</span>}
          </div>
          <div className="text-[10px] opacity-50">
            {x.group.name} · #{x.member.ticket_no}
          </div>
        </Td>
        <Td>
          <a href={`tel:${p?.phone}`} className="text-[var(--blue)] font-bold text-xs">
            {p?.phone || '—'}
          </a>
        </Td>
        <Td className="hidden lg:table-cell text-xs opacity-60">{p?.address || '—'}</Td>
        <Td className="hidden sm:table-cell">
          <div className="flex items-center gap-1">
            <Badge variant="green">✓{x.paidCount}</Badge>
            <Badge variant="red">⚠{x.unpaidAucs.length}</Badge>
          </div>
        </Td>
        <Td className="hidden md:table-cell">
          <div className="flex flex-wrap gap-0.5">
            {x.unpaidAucs.map(a => (
              <Badge key={a.month} variant="gray" className="text-[9px]">M{a.month}</Badge>
            ))}
          </div>
        </Td>
        <Td className="hidden xl:table-cell">
          <div className="text-[10px] opacity-50">
            {x.unpaidAucs.map(a => (
              <div key={a.month}>M{a.month}: {fmt(Number(x.group.monthly_contribution) - Number(a.dividend))}</div>
            ))}
          </div>
        </Td>
        <Td right><span className="font-bold font-mono text-red-500 text-xs md:text-sm">{fmt(x.totalDue)}</span></Td>
        <Td>
          {!isDefaulter
            ? <Btn size="sm" variant="primary">Pay</Btn>
            : <Btn size="sm" variant="danger">Notice</Btn>}
        </Td>
      </Tr>
    )
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Pending Members"  value={pending.length}     color="red"  />
        <StatCard label="Amount to Collect" value={fmt(totalPending)} color="red"  />
        <StatCard label="Defaulters"        value={defaults.length}   sub={fmt(totalDefault) + ' outstanding'} color="red" />
        <StatCard label="Report Date"       value={today}             color="gold" />
      </div>

      <div className="flex justify-end no-print">
        <Btn variant="secondary" onClick={() => window.print()} icon={Printer}>Print Report</Btn>
      </div>

      <div className="space-y-6">
        {report.length === 0 ? (
           <Empty icon="🌱" text="No pending collections found! Everyone is up to date." />
        ) : (
           <>
              {pending.length > 0 && (
                <TableCard title={`📋 Collection Report — ${pending.length} Pending`}>
                  <Table>
                    <thead>{thead}</thead>
                    <tbody>
                      {pending.map(x => <Row key={`${x.member.id}-${x.group.id}`} x={x} isDefaulter={false} />)}
                    </tbody>
                  </Table>
                </TableCard>
              )}

              {defaults.length > 0 && (
                <TableCard title={`⚠ Defaulters List — ${defaults.length} Records`}>
                  <Table>
                    <thead>{thead}</thead>
                    <tbody>
                      {defaults.map(x => <Row key={`${x.member.id}-${x.group.id}`} x={x} isDefaulter={true} />)}
                    </tbody>
                  </Table>
                </TableCard>
              )}
           </>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>
    </div>
  )
}
