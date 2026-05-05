'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { fmt, fmtMonth, cn } from '@/lib/utils'
import { Badge, Table, Th, Td, Tr, Loading, Empty, TableCard } from '@/components/ui'
import { CheckCircle } from 'lucide-react'
import type { Auction, Payment, Group, Member } from '@/types'

interface MemberLedgerProps {
  personId: number
  firmId: string
  onClose?: () => void
}

/**
 * MemberLedger component provides a comprehensive history of all tickets
 * associated with a person, including historical/archived ones.
 */
export function MemberLedger({ personId, firmId }: MemberLedgerProps) {
  const supabase = createClient()
  const router = useRouter()
  const [memberships, setMemberships] = useState<any[]>([])
  const [selectedMid, setSelectedMid] = useState<number | null>(null)
  const [details, setDetails] = useState<{ auctions: Auction[], payments: Payment[] }>({ auctions: [], payments: [] })
  const [loading, setLoading] = useState(true)
  const [loadingDetails, setLoadingDetails] = useState(false)

  // 1. Load ALL memberships (includes active, archived, exited)
  useEffect(() => {
    async function loadMemberships() {
      setLoading(true)
      const { data, error } = await withFirmScope(
        supabase.from('members').select(`
          id, ticket_no, status, group_id,
          groups:group_id(id, name, chit_value, duration, monthly_contribution, status, start_date, auction_scheme)
        `), 
        firmId
      ).eq('person_id', personId).is('deleted_at', null)

      if (data) {
        setMemberships(data)
        if (data.length > 0) setSelectedMid(data[0].id)
      }
      setLoading(false)
    }
    loadMemberships()
  }, [personId, firmId, supabase])

  // 2. Load Details for selected Ticket
  useEffect(() => {
    if (!selectedMid) return
    async function loadDetails() {
      setLoadingDetails(true)
      const m = memberships.find(x => x.id === selectedMid)
      if (!m) return
      
      const [a, p] = await Promise.all([
        withFirmScope(supabase.from('auctions').select('id, month, dividend, winner_id'), firmId)
          .eq('group_id', m.group_id)
          .is('deleted_at', null)
          .order('month'),
        withFirmScope(supabase.from('payments').select('id, amount, month'), firmId)
          .eq('member_id', selectedMid)
          .is('deleted_at', null)
          .order('month', { ascending: false })
          .limit(100)
      ])
      
      setDetails({ auctions: a.data || [], payments: p.data || [] })
      setLoadingDetails(false)
    }
    loadDetails()
  }, [selectedMid, memberships, firmId, supabase])

  if (loading) return <div className="p-10"><Loading /></div>
  if (memberships.length === 0) return <div className="p-10 text-center"><Empty text="Ex-member? We found no active or historical tickets for this person." /></div>

  const activeM = memberships.find(m => m.id === selectedMid)
  const group = activeM?.groups as unknown as Group
  // All ticket IDs this person holds in the selected group (handles multi-ticket members)
  const personMemberIds = new Set(
    memberships.filter(m => m.group_id === activeM?.group_id).map(m => m.id)
  )

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[500px]">
      {/* Ticket Sidebar */}
      <div className="w-full lg:w-64 space-y-2 border-r pr-4" style={{ borderColor: 'var(--border)' }}>
        <div className="text-xs font-bold uppercase opacity-40 tracking-widest mb-4">Tickets History ({memberships.length})</div>
        {memberships.map(m => (
          <div 
            key={m.id}
            onClick={() => setSelectedMid(m.id)}
            className={cn(
              "p-3 rounded-xl border-2 transition-all cursor-pointer",
              selectedMid === m.id ? "border-[var(--accent)] bg-[var(--accent-dim)]" : "border-transparent bg-[var(--surface2)] hover:border-[var(--border)]"
            )}
          >
            <div className="font-bold text-sm truncate hover:text-[var(--accent)] transition-colors" onClick={(e) => { e.stopPropagation(); router.push(`/groups/${m.group_id}`); }}>{m.groups.name}</div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-mono opacity-60">Ticket #{m.ticket_no}</span>
              <Badge variant={m.groups.status === 'active' ? 'success' : 'gray'} className="text-xs uppercase px-1 py-0">{m.groups.status}</Badge>
            </div>
          </div>
        ))}
      </div>

      {/* Ledger Content */}
      <div className="flex-1">
        {loadingDetails ? <Loading /> : group && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-[var(--surface2)] p-4 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
              <div>
                 <div className="text-xs font-bold opacity-40 uppercase tracking-widest">Selected Account</div>
                 <div className="text-lg font-black">{group.name} (#{activeM.ticket_no})</div>
              </div>
              <div className="text-right">
                 <div className="text-xs font-bold opacity-40 uppercase tracking-widest">Total Value</div>
                 <div className="text-lg font-black text-[var(--accent)]">{fmt(group.chit_value)}</div>
              </div>
            </div>

            <TableCard title="Payment Timeline" subtitle="Months with multiple partial payments are summarized for clarity.">
              <Table>
                <thead><tr><Th>Month</Th><Th>Auction Status</Th><Th right>Amt Due</Th><Th right>Amt Paid</Th><Th right>Net Balance</Th></tr></thead>
                <tbody>
                  {Array.from({ length: group.duration }, (_, i) => i + 1).map(m => {
                    const auc = details.auctions.find(ax => ax.month === m)
                    const pays = details.payments.filter(px => px.month === m)
                    const totalPaid = pays.reduce((s, p) => s + Number(p.amount), 0)
                    
                    const isAcc = group.auction_scheme === 'ACCUMULATION'
                    const due = Number(group.monthly_contribution) - (isAcc ? 0 : (auc?.dividend || 0))
                    const bal = Math.max(0, due - totalPaid)
                    
                    return (
                      <Tr key={m}>
                        <Td className="font-bold text-xs">M{m} <span className="opacity-40 font-normal ml-1">({fmtMonth(m, group.start_date)})</span></Td>
                        <Td>
                           {auc ? (
                             <div className="flex items-center gap-1">
                               <CheckCircle size={12} className="text-[var(--success)]" />
                               <span className="text-xs font-medium">Winner: {personMemberIds.has(auc.winner_id) ? 'YOU 👑' : 'Other'}</span>
                             </div>
                           ) : <span className="text-xs opacity-20 uppercase font-black">Upcoming</span>}
                        </Td>
                        <Td right className="font-mono text-xs opacity-60 font-bold">{fmt(due)}</Td>
                        <Td right className={cn("font-bold font-mono", totalPaid >= (due - 0.01) ? "text-[var(--success)]" : "text-[var(--warning)]")}>
                          {fmt(totalPaid)}
                          {pays.length > 1 && <div className="text-xs font-medium opacity-40">({pays.length} parts)</div>}
                        </Td>
                        <Td right className={cn("font-black font-mono", bal > 0.01 ? "text-[var(--danger)]" : "text-[var(--success)] opacity-20")}>
                          {bal > 0.01 ? fmt(bal) : 'SETTLED ✓'}
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </TableCard>
          </div>
        )}
      </div>
    </div>
  )
}
