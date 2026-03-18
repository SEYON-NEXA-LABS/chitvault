'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge, Loading, ProgressBar } from '@/components/ui'
import type { Group, Member, Auction, Payment } from '@/types'

export default function ReportsPage() {
  const supabase = createClient()
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const [g, m, a, p] = await Promise.all([
        supabase.from('groups').select('*'),
        supabase.from('members').select('*'),
        supabase.from('auctions').select('*'),
        supabase.from('payments').select('*').eq('status','paid'),
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

  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0)
  const totalAuctions  = auctions.length
  const avgBid = totalAuctions > 0
    ? Math.round(auctions.reduce((s, a) => s + Number(a.bid_amount), 0) / totalAuctions) : 0
  const totalDiv = auctions.reduce((s, a) => s + Number(a.dividend), 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Collected"    value={fmt(totalCollected)} color="green" />
        <StatCard label="Total Auctions"     value={totalAuctions}       color="blue"  />
        <StatCard label="Avg Bid Amount"     value={avgBid > 0 ? fmt(avgBid) : '—'} color="gold" />
        <StatCard label="Total Dividend Given" value={fmt(totalDiv)}     color="green" />
      </div>

      <TableCard title="Group Summary Report">
        <Table>
          <thead><tr>
            {['Group','Members','Months Done','Collected','Pending','Avg Bid','Progress'].map(h => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody>
            {groups.map(g => {
              const gAucs   = auctions.filter(a => a.group_id === g.id)
              const collected = payments.filter(p => p.group_id === g.id).reduce((s, p) => s + Number(p.amount), 0)
              const paidCount = payments.filter(p => p.group_id === g.id).length
              const expected  = gAucs.length * g.num_members
              const pending   = Math.max(0, expected - paidCount)
              const avgBidG   = gAucs.length > 0 ? Math.round(gAucs.reduce((s, a) => s + Number(a.bid_amount), 0) / gAucs.length) : 0
              const pct       = Math.round(gAucs.length / g.duration * 100)
              return (
                <Tr key={g.id}>
                  <Td><span className="font-semibold">{g.name}</span></Td>
                  <Td>{members.filter(m => m.group_id === g.id).length}</Td>
                  <Td>{gAucs.length}/{g.duration}</Td>
                  <Td right><span style={{ color: 'var(--green)' }}>{fmt(collected)}</span></Td>
                  <Td>{pending > 0 ? <Badge variant="red">{pending}</Badge> : <Badge variant="green">0</Badge>}</Td>
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
                totalPaid: payments.filter(p => p.member_id === m.id).reduce((s, p) => s + Number(p.amount), 0),
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
