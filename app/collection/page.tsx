'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge, Loading, Empty, Btn } from '@/components/ui'
import { Printer } from 'lucide-react'
import type { Group, Member, Auction, Payment } from '@/types'

interface PendingItem {
  member: Member
  group:  Group
  unpaidAucs: Auction[]
  totalDue:   number
  paidCount:  number
  isDefaulter: boolean
}

export default function CollectionPage() {
  const supabase  = createClient()
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<PendingItem[]>([])
  const [defaults, setDefaults] = useState<PendingItem[]>([])
  const today = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })

  useEffect(() => {
    async function load() {
      const [g, m, a, p] = await Promise.all([
        supabase.from('groups').select('*').neq('status','archived'),
        supabase.from('members').select('*'),
        supabase.from('auctions').select('*').order('month'),
        supabase.from('payments').select('*').eq('status','paid'),
      ])
      const groups   = g.data || []
      const members  = m.data || []
      const auctions = a.data || []
      const payments = p.data || []

      const pendItems: PendingItem[] = []
      const defItems:  PendingItem[] = []

      groups.forEach(grp => {
        const gAucs   = auctions.filter(a => a.group_id === grp.id)
        const gMembers = members.filter(m => m.group_id === grp.id)
        gMembers.forEach(mem => {
          if (mem.status === 'exited') return
          const mPaid    = payments.filter(p => p.member_id === mem.id && p.group_id === grp.id)
          const paidMos  = mPaid.map(p => p.month)
          const relevant = mem.transfer_from_id
            ? gAucs.filter(a => a.month > (members.find(x => x.id === mem.transfer_from_id)?.exit_month || 0))
            : gAucs
          const unpaid = relevant.filter(a => !paidMos.includes(a.month))
          if (!unpaid.length) return
          const totalDue = unpaid.reduce((s, a) =>
            s + Number(grp.monthly_contribution) - Number(a.dividend), 0)
          const item: PendingItem = {
            member: mem, group: grp, unpaidAucs: unpaid,
            totalDue, paidCount: mPaid.length, isDefaulter: mem.status === 'defaulter'
          }
          if (mem.status === 'defaulter') defItems.push(item)
          else pendItems.push(item)
        })
      })

      pendItems.sort((a, b) => b.totalDue - a.totalDue)
      defItems.sort((a, b) => b.totalDue - a.totalDue)
      setPending(pendItems)
      setDefaults(defItems)
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Loading />

  const totalPending = pending.reduce((s, x) => s + x.totalDue, 0)
  const totalDefault = defaults.reduce((s, x) => s + x.totalDue, 0)

  const thead = (
    <tr>
      {['Member','Phone','Area','Paid/Pending','Pending Months','Amount Breakdown','Total Due','Action'].map(h => <Th key={h}>{h}</Th>)}
    </tr>
  )

  function Row({ x, isDefaulter }: { x: PendingItem; isDefaulter: boolean }) {
    return (
      <Tr style={isDefaulter ? { background: 'rgba(246,109,122,0.04)' } : undefined}>
        <Td>
          <div className="font-semibold">
            {x.member.name}
            {isDefaulter && <span className="ml-1 text-xs" style={{ color: 'var(--red)' }}>⚠ Defaulter</span>}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
            {x.group.name} · #{x.member.ticket_no}
          </div>
          {x.member.notes && (
            <div className="text-xs mt-0.5" style={{ color: 'var(--red)' }}>📝 {x.member.notes}</div>
          )}
        </Td>
        <Td>
          <a href={`tel:${x.member.phone}`} style={{ color: 'var(--blue)', textDecoration: 'none', fontWeight: 500 }}>
            📞 {x.member.phone || '—'}
          </a>
        </Td>
        <Td>{x.member.address || '—'}</Td>
        <Td>
          <div className="flex items-center gap-1">
            <Badge variant="green">✓{x.paidCount}</Badge>
            <Badge variant="red">⚠{x.unpaidAucs.length}</Badge>
          </div>
        </Td>
        <Td>
          <div className="flex flex-wrap gap-0.5">
            {x.unpaidAucs.map(a => (
              <span key={a.month} className="inline-block rounded px-1.5 py-0.5 text-xs font-bold"
                style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
                M{a.month}
              </span>
            ))}
          </div>
        </Td>
        <Td>
          <div className="text-xs space-y-0.5" style={{ color: 'var(--text3)' }}>
            {x.unpaidAucs.map(a => (
              <div key={a.month}>M{a.month}: {fmt(Number(x.group.monthly_contribution) - Number(a.dividend))}</div>
            ))}
          </div>
        </Td>
        <Td right><span className="font-bold font-mono" style={{ color: 'var(--red)' }}>{fmt(x.totalDue)}</span></Td>
        <Td>
          {!isDefaulter
            ? <Btn size="sm" variant="green">Pay</Btn>
            : <span className="text-xs" style={{ color: 'var(--red)' }}>Legal/Notice</span>}
        </Td>
      </Tr>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label="Pending Members"  value={pending.length}     color="red"  />
        <StatCard label="Amount to Collect" value={fmt(totalPending)} color="red"  />
        <StatCard label="Defaulters"        value={defaults.length}   sub={fmt(totalDefault) + ' outstanding'} color="red" />
        <StatCard label="Report Date"       value={today}             color="gold" />
      </div>

      <div className="flex justify-end mb-4 no-print">
        <Btn variant="secondary" onClick={() => window.print()}>
          <Printer size={14} /> Print Report
        </Btn>
      </div>

      {/* Pending */}
      {pending.length > 0
        ? <TableCard title="📋 Pending Collection List"
            subtitle={`${pending.length} members · ${fmt(totalPending)} to collect`}>
            <Table>
              <thead>{thead}</thead>
              <tbody>
                {pending.map((x, i) => <Row key={i} x={x} isDefaulter={false} />)}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--surface2)' }}>
                  <td colSpan={6} className="px-4 py-3 text-right font-semibold text-sm"
                    style={{ color: 'var(--text)' }}>Total to Collect</td>
                  <td className="px-4 py-3 text-right font-bold font-mono text-base"
                    style={{ color: 'var(--red)' }}>{fmt(totalPending)}</td>
                  <td />
                </tr>
              </tfoot>
            </Table>
          </TableCard>
        : <div className="text-center py-20">
            <div className="text-5xl mb-4">🎉</div>
            <div className="font-semibold text-lg" style={{ color: 'var(--green)' }}>All Payments Collected!</div>
          </div>
      }

      {/* Defaulters */}
      {defaults.length > 0 && (
        <TableCard title="⚠ Defaulters — Outstanding Debt"
          subtitle={`${defaults.length} defaulters · ${fmt(totalDefault)} outstanding`}>
          <Table>
            <thead>{thead}</thead>
            <tbody>
              {defaults.map((x, i) => <Row key={i} x={x} isDefaulter={true} />)}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(246,109,122,0.06)' }}>
                <td colSpan={6} className="px-4 py-3 text-right font-semibold text-sm"
                  style={{ color: 'var(--red)' }}>Total Outstanding</td>
                <td className="px-4 py-3 text-right font-bold font-mono text-base"
                  style={{ color: 'var(--red)' }}>{fmt(totalDefault)}</td>
                <td />
              </tr>
            </tfoot>
          </Table>
        </TableCard>
      )}
    </div>
  )
}
