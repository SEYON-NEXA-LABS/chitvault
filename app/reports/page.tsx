'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge, Loading, ProgressBar, Btn } from '@/components/ui'
import type { Group, Member, Auction, Payment } from '@/types'
import { Printer } from 'lucide-react'

export default function ReportsPage() {
  const supabase = createClient()
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [g, m, a, p] = await Promise.all([
        supabase.from('groups').select('*'),
        supabase.from('members').select('*'),
        supabase.from('auctions').select('*'),
        supabase.from('payments').select('*'),
      ])
      setGroups(g.data || [])
      setMembers(m.data || [])
      setAuctions(a.data || [])
      setPayments(p.data || [])
      setLoading(false)
    }
    load()
  }, [supabase])

  if (loading) return <Loading />

  const paidPayments = payments.filter(p => p.status === 'paid');
  const totalCollected = paidPayments.reduce((s, p) => s + Number(p.amount), 0)
  const totalAuctions  = auctions.length
  const avgBid = totalAuctions > 0
    ? Math.round(auctions.reduce((s, a) => s + Number(a.bid_amount), 0) / totalAuctions) : 0
  const totalDiv = auctions.reduce((s, a) => s + Number(a.dividend), 0)

  const outstandingReport = members
    .map(member => {
      const group = groups.find(g => g.id === member.group_id)
      if (!group || group.status === 'archived' || !['active', 'defaulter'].includes(member.status)) {
        return null
      }
      const groupAuctions = auctions.filter(a => a.group_id === member.group_id)
      if (groupAuctions.length === 0) {
        return null
      }
      const memberPayments = payments.filter(p => p.member_id === member.id)
      let totalOutstanding = 0
      const pendingMonths: number[] = []
      const relevantAuctions = member.exit_month 
        ? groupAuctions.filter(a => a.month <= member.exit_month!)
        : groupAuctions

      for (const auction of relevantAuctions) {
        const month = auction.month
        const paymentsForMonth = memberPayments
          .filter(p => p.month === month)
          .reduce((sum, p) => sum + Number(p.amount), 0)
        const dueForMonth = group.amount
        const outstandingForMonth = dueForMonth - paymentsForMonth
        if (outstandingForMonth > 0.01) {
          totalOutstanding += outstandingForMonth
          pendingMonths.push(month)
        }
      }

      if (totalOutstanding > 0) {
        return {
          memberId: member.id,
          memberName: member.name,
          groupName: group.name,
          ticketNo: member.ticket_no,
          pendingMonths: pendingMonths.sort((a, b) => a - b),
          totalOutstanding,
        }
      }
      return null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => b.totalOutstanding - a.totalOutstanding)
  
  const totalOutstanding = outstandingReport.reduce((sum, item) => sum + item.totalOutstanding, 0)

  return (
    <div className="space-y-5">
      <style jsx global>{`
        @media print {
          body > #__next > div > main > div > :not(.printable) {
            display: none;
          }
          .card-actions {
            display: none !important;
          }
          @page {
            margin: 1cm;
          }
        }
      `}</style>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Collected"     value={fmt(totalCollected)}  color="green" />
        <StatCard label="Total Outstanding"   value={fmt(totalOutstanding)} color="red" />
        <StatCard label="Total Auctions"      value={totalAuctions}        color="blue"  />
        <StatCard label="Avg Bid Amount"      value={avgBid > 0 ? fmt(avgBid) : '—'} color="gold" />
        <StatCard label="Total Dividend Given" value={fmt(totalDiv)}      color="green" />
      </div>

      <TableCard 
        className="printable"
        title="Outstanding Collection Report"
        actions={<Btn size="sm" onClick={() => window.print()}><Printer size={14}/> Print</Btn>}>
        <Table>
          <thead><tr>
            <Th>Member</Th>
            <Th>Group · Ticket</Th>
            <Th>Pending Months</Th>
            <Th right>Outstanding Amount</Th>
          </tr></thead>
          <tbody>
            {outstandingReport.length === 0 && <Tr><Td colSpan={4} className="text-center py-5">🎉 No outstanding collections!</Td></Tr>}
            {outstandingReport.map(item => (
              <Tr key={item.memberId}>
                <Td><span className="font-semibold">{item.memberName}</span></Td>
                <Td>{item.groupName} · #{item.ticketNo}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {item.pendingMonths.map(m => <Badge key={m} variant="red">M{m}</Badge>)}
                  </div>
                </Td>
                <Td right><span className="font-semibold">{fmt(item.totalOutstanding)}</span></Td>
              </Tr>
            ))}
             <Tr>
                <Td colSpan={3} right><strong className="text-sm">Total Outstanding</strong></Td>
                <Td right><strong className="text-lg">{fmt(totalOutstanding)}</strong></Td>
              </Tr>
          </tbody>
        </Table>
      </TableCard>

      <TableCard title="Group Summary Report">
        <Table>
          <thead><tr>
            {['Group','Members','Months Done','Collected','Pending','Avg Bid','Progress'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody>
            {groups.filter(g => g.status !== 'archived').map(g => {
              const gAucs   = auctions.filter(a => a.group_id === g.id)
              const collected = paidPayments.filter(p => p.group_id === g.id).reduce((s, p) => s + Number(p.amount), 0)
              
              const outstandingInGroup = outstandingReport
                .filter(item => item.groupName === g.name)
                .reduce((sum, item) => sum + item.totalOutstanding, 0);

              const avgBidG   = gAucs.length > 0 ? Math.round(gAucs.reduce((s, a) => s + Number(a.bid_amount), 0) / gAucs.length) : 0
              const pct       = Math.round(gAucs.length / g.duration * 100)
              return (
                <Tr key={g.id}>
                  <Td><span className="font-semibold">{g.name}</span></Td>
                  <Td>{members.filter(m => m.group_id === g.id).length}</Td>
                  <Td>{gAucs.length}/{g.duration}</Td>
                  <Td right><span style={{ color: 'var(--green)' }}>{fmt(collected)}</span></Td>
                  <Td>{outstandingInGroup > 0 ? <Badge variant="red">{fmt(outstandingInGroup)}</Badge> : <Badge variant="green">✓</Badge>}</Td>
                  <Td right>{avgBidG > 0 ? fmt(avgBidG) : '—'}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={pct} />
                      <span className="text-xs" style={{ color: 'var(--text3)' }}>{pct}%</span>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>

      <TableCard title="Top Members by Payment">
        <Table>
          <thead><tr>{['Member','Group','Total Paid','Status'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
          <tbody>
            {members
              .map(m => ({
                ...m,
                totalPaid: paidPayments.filter(p => p.member_id === m.id).reduce((s, p) => s + Number(p.amount), 0),
                won: auctions.some(a => a.winner_id === m.id && a.group_id === m.group_id)
              }))
              .sort((a, b) => b.totalPaid - a.totalPaid)
              .slice(0, 10)
              .map(m => {
                const g = groups.find(x => x.id === m.group_id)
                return (
                  <Tr key={m.id}>
                    <Td><span className="font-semibold">{m.name}{m.won ? ' 👑' : ''}</span></Td>
                    <Td>{g?.name || '—'}</Td>
                    <Td right><span style={{ color: 'var(--green)' }}>{fmt(m.totalPaid)}</span></Td>
                    <Td>{m.won ? <Badge variant="gold">Auction Won</Badge> : <Badge variant="gray">Active</Badge>}</Td>
                  </Tr>
                )
              })}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}
