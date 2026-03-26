'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import { Card, Loading, Badge, StatCard, Btn } from '@/components/ui'
import { Gavel, Settings2, Calendar, Users, DollarSign, ArrowLeft } from 'lucide-react'
import type { Group, Auction, Member } from '@/types'

export default function GroupLedgerPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const { firm } = useFirm()

  const groupId = Number(params.id)

  const [group,          setGroup]          = useState<Group | null>(null)
  const [auctionHistory, setAuctionHistory] = useState<Auction[]>([])
  const [members,        setMembers]        = useState<Member[]>([])
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    async function load() {
      if (!firm) return
      
      const [gRes, mRes, aRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', groupId).eq('firm_id', firm.id).single(),
        supabase.from('members').select('*').eq('group_id', groupId),
        supabase.from('auctions').select('*').eq('group_id', groupId).order('month')
      ])

      if (!gRes.data) { router.push('/groups'); return }
      
      setGroup(gRes.data)
      setMembers(mRes.data || [])
      setAuctionHistory(aRes.data || [])
      setLoading(false)
    }
    load()
  }, [firm, groupId, router, supabase])

  if (loading) return <Loading />
  if (!group)  return null

  const totalDividends = auctionHistory.reduce((s, a) => s + Number(a.dividend), 0)
  const totalPayouts   = auctionHistory.reduce((s, a) => s + Number(a.bid_amount), 0)
  const monthsCompleted = auctionHistory.length
  
  return (
    <div className="space-y-6 max-w-5xl pb-10">
      
      {/* ── Page Header ─────────────────────────────── */}
      <div className="flex items-center justify-between border-b pb-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/groups')} 
            className="p-2.5 rounded-xl border hover:bg-[var(--surface2)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50 mb-1">
              <Gavel size={12} /> Group Ledger
            </div>
            <h1 className="text-2xl font-bold">{group.name}</h1>
          </div>
        </div>
        <Btn onClick={() => router.push(`/groups/${groupId}/settings`)} icon={Settings2}>Group Rules</Btn>
      </div>

      {/* ── Quick Stats ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Progress" value={`${monthsCompleted} / ${group.duration}`} sub="Months completed" color="blue" />
        <StatCard label="Members" value={group.num_members} sub="Total tickets" color="gold" />
        <StatCard label="Total Dividends" value={fmt(totalDividends)} sub="Distributed to members" color="green" />
        <StatCard label="Total Payouts" value={fmt(totalPayouts)} sub="Paid to winners" color="red" />
      </div>

      {/* ── Auction History ─────────────────────────────── */}
      <Card title="Auction Ledger" subtitle="Month-by-month financial breakdown of all auctions">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Month</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Winner</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Bid Amount</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Dividend</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Each Pays</th>
              </tr>
            </thead>
            <tbody>
              {auctionHistory.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 opacity-50 italic">No auctions held yet. Go to Auctions to hold one.</td></tr>
              ) : auctionHistory.map((a) => {
                const winner = members.find(m => m.id === a.winner_id)
                const monthlyDue = group.chit_value / group.duration
                const eachPays = monthlyDue - Number(a.dividend)
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-[var(--surface2)]" style={{ borderColor: 'var(--border)' }}>
                    <td style={{ padding: '12px 14px' }}>
                       <Badge variant="gray" className="font-mono font-bold">Month {a.month}</Badge>
                    </td>
                    <td style={{ padding: '12px 14px' }} className="font-medium">
                       {winner ? (
                         <div className="flex items-center gap-2">
                            <span className="text-sm">👑 {winner.name}</span>
                            <span className="text-[10px] opacity-40">#{winner.ticket_no}</span>
                         </div>
                       ) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} className="font-mono font-bold text-red-500">{fmt(a.bid_amount)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--gold)' }} className="font-mono">{fmt(a.dividend)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} className="font-mono font-black text-green-500">{fmt(eachPays)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Summary Info ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <Card title="Group Overview" subtitle="Core contract details">
            <div className="p-5 space-y-3">
               <div className="flex justify-between text-sm">
                  <span className="opacity-60">Chit Value</span>
                  <span className="font-bold">{fmt(group.chit_value)}</span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="opacity-60">Monthly Contribution</span>
                  <span className="font-bold">{fmt(group.monthly_contribution)}</span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="opacity-60">Start Date</span>
                  <span className="font-bold">{fmtDate(group.start_date)}</span>
               </div>
               <div className="flex justify-between text-sm">
                  <span className="opacity-60">Duration</span>
                  <span className="font-bold">{group.duration} Months</span>
               </div>
            </div>
         </Card>

         <Card title="Payment Status" subtitle="Group collection health">
            <div className="p-5 flex flex-col items-center justify-center text-center">
                <div className="text-3xl mb-2">📊</div>
                <div className="text-sm font-semibold">Ledger View Active</div>
                <p className="text-xs opacity-60 mt-1">This page provides a financial snapshot. For member-specific payments, visit the Payments section.</p>
                <Btn variant="secondary" size="sm" className="mt-4" onClick={() => router.push('/payments')}>Go to Payments</Btn>
            </div>
         </Card>
      </div>

    </div>
  )
}
