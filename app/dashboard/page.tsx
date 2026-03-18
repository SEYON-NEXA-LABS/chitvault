'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate } from '@/lib/utils'
import { StatCard, Card, Loading, Badge } from '@/components/ui'
import type { Group, Member, Auction, Payment } from '@/types'

export default function DashboardPage() {
  const supabase = createClient()
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const [g, m, a, p] = await Promise.all([
        supabase.from('groups').select('*').neq('status','archived'),
        supabase.from('members').select('*'),
        supabase.from('auctions').select('*').order('id', { ascending: false }).limit(6),
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
  const totalChitValue = groups.reduce((s, g) => s + Number(g.chit_value), 0)

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Groups"    value={groups.length}   sub={`Total value ${fmt(totalChitValue)}`} color="gold" />
        <StatCard label="Total Members"    value={members.length}  sub="Across all groups"  color="blue"  />
        <StatCard label="Total Collected"  value={fmt(totalCollected)} sub="All payments" color="green" />
        <StatCard label="Total Auctions"   value={auctions.length} sub="Showing last 6"     color="gold"  />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Auctions */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Recent Auctions
          </div>
          {auctions.length === 0
            ? <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text3)' }}>No auctions yet</div>
            : <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Group','Month','Winner','Bid','Dividend','Date'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auctions.map(a => {
                    const g = groups.find(x => x.id === a.group_id)
                    const w = members.find(x => x.id === a.winner_id)
                    return (
                      <tr key={a.id} className="hover:bg-[var(--surface2)] transition-colors">
                        <td className="px-4 py-3" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                          {g?.name || `Group #${a.group_id}`}
                        </td>
                        <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                          <Badge variant="blue">M{a.month}</Badge>
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                          👑 {w?.name || '—'}
                        </td>
                        <td className="px-4 py-3 font-mono" style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
                          {fmt(a.bid_amount)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--green)', borderBottom: '1px solid var(--border)' }}>
                          {fmt(a.dividend)}/m
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                          {fmtDate(a.auction_date)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          }
        </Card>

        {/* Group Progress */}
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            Group Progress
          </div>
          <div className="p-5 space-y-4">
            {groups.length === 0
              ? <div className="text-center text-sm py-6" style={{ color: 'var(--text3)' }}>No groups yet</div>
              : groups.map(g => {
                  const done = auctions.filter(a => a.group_id === g.id).length
                  const pct  = Math.round(done / g.duration * 100)
                  return (
                    <div key={g.id}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{g.name}</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--text2)' }}>{done}/{g.duration} mo</span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div className="progress-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs" style={{ color: 'var(--text3)' }}>{fmt(g.chit_value)}</span>
                        <span className="text-xs" style={{ color: 'var(--text3)' }}>{pct}% complete</span>
                      </div>
                    </div>
                  )
                })
            }
          </div>
        </Card>

      </div>
    </div>
  )
}
