'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import { Card, Loading, Badge, StatCard, Btn, ProgressBar } from '@/components/ui'
import { Gavel, Settings2, Calendar, Users, DollarSign, ArrowLeft, Calculator } from 'lucide-react'
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
  const [selectedMember, setSelectedMember] = useState<number | null>(null)

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
              {group.auction_scheme && (
                <>
                  <span className="mx-2">•</span>
                  <Badge variant={group.auction_scheme === 'ACCUMULATION' ? 'gold' : 'blue'}>
                    {group.auction_scheme === 'ACCUMULATION' ? 'Surplus Accumulation' : 'Dividend Share'}
                  </Badge>
                </>
              )}
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
        {group.auction_scheme === 'ACCUMULATION' ? (
          <>
            <StatCard label="Surplus Pool" value={fmt(group.accumulated_surplus)} sub="Accumulated savings" color="green" />
            <StatCard label="Closure Target" value={fmt(group.chit_value)} sub="Closing early soon" color="red" />
          </>
        ) : (
          <>
            <StatCard label="Total Dividends" value={fmt(totalDividends)} sub="Distributed to members" color="green" />
            <StatCard label="Total Payouts" value={fmt(totalPayouts)} sub="Paid to winners" color="red" />
          </>
        )}
      </div>

      {group.auction_scheme === 'ACCUMULATION' && (
        <Card className="p-4 border-[1.5px]" style={{ borderColor: 'var(--gold)', background: 'rgba(201,168,76,0.05)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide opacity-70">🚀 Early Closure Progress</span>
            <span className="text-sm font-bold">{Math.round((Number(group.accumulated_surplus) / Number(group.chit_value)) * 100)}%</span>
          </div>
          <ProgressBar pct={Math.min(100, (Number(group.accumulated_surplus) / Number(group.chit_value)) * 100)} />
          <p className="text-[10px] mt-2 opacity-60">
            Once surplus reaches {fmt(group.chit_value)}, the firm can pay the last members from this pool and close the group early.
          </p>
        </Card>
      )}

      {/* ── Auction History ─────────────────────────────── */}
      <Card title="Auction Ledger" subtitle="Month-by-month financial breakdown of all auctions">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Month</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Winner</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Bid Amount</th>
                {group.auction_scheme === 'ACCUMULATION' ? (
                   <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>To Surplus</th>
                ) : (
                   <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Dividend</th>
                )}
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Net Payout</th>
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
                    {group.auction_scheme === 'ACCUMULATION' ? (
                       <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--gold)' }} className="font-mono font-bold">+{fmt(Number(a.total_pot) - Number(a.bid_amount))}</td>
                    ) : (
                       <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--gold)' }} className="font-mono">{fmt(a.dividend)}</td>
                    )}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} className="font-mono font-black text-green-500">{fmt(a.net_payout || a.bid_amount)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} className="font-mono font-semibold text-[var(--text2)]">
                       {(() => {
                          const monthlyDue = group.chit_value / group.duration
                          return fmt(monthlyDue - Number(a.dividend))
                       })()}
                    </td>
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

         <Card title={
           <div className="flex items-center gap-2">
             <Calculator size={16} className="text-[var(--gold)]" />
             Settlement Manager
           </div>
         } subtitle="Individual member account balance">
            <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider opacity-50">Select Member to Settle</label>
                    <select className="w-full bg-[var(--surface2)] border-[var(--border)] rounded-lg text-sm p-2"
                      value={selectedMember || ''}
                      onChange={e => setSelectedMember(Number(e.target.value))}>
                      <option value="">Select a member...</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>#{m.ticket_no} — {m.name}</option>
                      ))}
                    </select>
                </div>

                {selectedMember && (() => {
                  const m = members.find(x => x.id === selectedMember)
                  if (!m) return null
                  const wonAuction = auctionHistory.find(a => a.winner_id === m.id)
                  const totalDue = (group.chit_value / group.duration) * monthsCompleted
                  const divs = auctionHistory.reduce((s, a) => s + Number(a.dividend), 0)
                  const netDue = totalDue - divs
                  
                  return (
                    <div className="bg-[var(--surface2)] p-4 rounded-xl border-l-[3px] border-l-[var(--gold)] space-y-3">
                       <div className="flex justify-between items-center text-xs">
                          <span className="opacity-60">Status</span>
                          {wonAuction ? <Badge variant="gold">Winner (Month {wonAuction.month})</Badge> : <Badge variant="blue">Non-Prized Member</Badge>}
                       </div>

                       <div className="space-y-1.5 pt-1">
                          <div className="flex justify-between text-xs">
                             <span className="opacity-50">Total Expected Pay:</span>
                             <span className="font-mono">{fmt(totalDue)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                             <span className="opacity-50">Dividends Received:</span>
                             <span className="font-mono text-[var(--green)]">−{fmt(divs)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-bold pt-2 border-t mt-2" style={{ borderColor: 'var(--border)' }}>
                             <span>Member's Contribution:</span>
                             <span className="text-[var(--blue)]">{fmt(netDue)}</span>
                          </div>
                       </div>

                       {wonAuction && (
                         <div className="p-2.5 bg-green-500/10 rounded-lg space-y-1">
                            <div className="flex justify-between text-xs">
                               <span className="font-semibold text-green-700">Winner Payout:</span>
                               <span className="font-mono font-bold text-green-700">{fmt(wonAuction.net_payout || wonAuction.bid_amount)}</span>
                            </div>
                         </div>
                       )}

                       {!wonAuction && group.auction_scheme === 'ACCUMULATION' && (
                         <div className="p-2.5 bg-blue-500/10 rounded-lg">
                            <p className="text-[10px] leading-relaxed text-blue-700 font-medium">
                               This member will receive **{fmt(group.chit_value)}** once the surplus pool reaches {fmt(group.chit_value)}. 🚀
                            </p>
                         </div>
                       )}
                    </div>
                  )
                })()}
            </div>
         </Card>
      </div>

    </div>
  )
}
