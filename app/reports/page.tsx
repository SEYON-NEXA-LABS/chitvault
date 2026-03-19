'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge, Loading, Btn } from '@/components/ui'
import type { Group, Member, Auction, Payment } from '@/types'
import { Printer } from 'lucide-react'

export default function ReportsPage() {
  const supabase = createClient()
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [g, m, a, p] = await Promise.all([
          supabase.from('groups').select('*'),
          supabase.from('members').select('*'),
          supabase.from('auctions').select('*'),
          supabase.from('payments').select('*'),
        ])

        if (g.error) throw new Error(`Failed to load groups: ${g.error.message}`)
        if (m.error) throw new Error(`Failed to load members: ${m.error.message}`)
        if (a.error) throw new Error(`Failed to load auctions: ${a.error.message}`)
        if (p.error) throw new Error(`Failed to load payments: ${p.error.message}`)

        setGroups(g.data || [])
        setMembers(m.data || [])
        setAuctions(a.data || [])
        setPayments(p.data || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  // Render loading or error states first
  if (loading) return <Loading />
  if (error) return <div className="p-4 rounded-lg bg-red-100 text-red-700">Error: {error}</div>

  // Safely calculate statistics
  const paidPayments = payments.filter(p => p.status === 'paid');
  const totalCollected = paidPayments.reduce((s, p) => s + Number(p.amount), 0)

  const outstandingReport = members
    .map(member => {
      try {
        const group = groups.find(g => g.id === member.group_id)
        if (!group || group.status === 'archived' || !['active', 'defaulter'].includes(member.status || '')) {
          return null
        }

        const groupAuctions = auctions.filter(a => a.group_id === member.group_id)
        if (groupAuctions.length === 0) return null

        const memberPayments = payments.filter(p => p.member_id === member.id)
        let totalOutstanding = 0
        const pendingMonths: number[] = []
        const relevantAuctions = member.exit_month ? groupAuctions.filter(a => a.month <= member.exit_month!) : groupAuctions

        for (const auction of relevantAuctions) {
          const month = auction.month
          const paymentsForMonth = memberPayments.filter(p => p.month === month).reduce((sum, p) => sum + Number(p.amount), 0)
          const dueForMonth = group.amount || 0
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
      } catch (e) {
        // In case of an unexpected error with a single member, log it and continue
        console.error(`Failed to process report for member ${member.id}:`, e)
        return null
      }
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
    </div>
  )
}
