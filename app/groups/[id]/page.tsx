'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import { Card, Loading, Badge, StatCard, Btn, ProgressBar, Modal, Field, Toast, Empty, Table, Th, Td, Tr } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Gavel, Settings2, Calendar, Users, DollarSign, ArrowLeft, Calculator, Plus, UserPlus, Info, Trash2 } from 'lucide-react'
import type { Group, Auction, Member, ForemanCommission } from '@/types'

export default function GroupLedgerPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const { firm } = useFirm()

  const groupId = Number(params.id)

  const [group,          setGroup]          = useState<Group | null>(null)
  const [auctionHistory, setAuctionHistory] = useState<Auction[]>([])
  const [members,        setMembers]        = useState<Member[]>([])
  const [commissions,    setCommissions]    = useState<ForemanCommission[]>([])
  const [loading,        setLoading]        = useState(true)
  const [selectedMember, setSelectedMember] = useState<number | null>(null)
  
  const { toast, show: showToast, hide: hideToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addTab, setAddTab] = useState<'new'|'existing'>('new')
  const [form, setForm] = useState({ name: '', phone: '', address: '', ticket_no: '', existing_id: '', tickets: '1' })
  const [allFirmMembers, setAllFirmMembers] = useState<any[]>([])

  const load = useCallback(async () => {
    if (!firm) return
    
    const [gRes, mRes, aRes, fRes, fcRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).eq('firm_id', firm.id).single(),
      supabase.from('members').select('*').eq('group_id', groupId).order('ticket_no'),
      supabase.from('auctions').select('*').eq('group_id', groupId).order('month'),
      supabase.from('members').select('id, name, phone, address, contact_id').eq('firm_id', firm.id),
      supabase.from('foreman_commissions').select('*').eq('group_id', groupId).order('month')
    ])

    if (!gRes.data) { router.push('/groups'); return }
    
    setGroup(gRes.data)
    setMembers(mRes.data || [])
    setAuctionHistory(aRes.data || [])
    setAllFirmMembers(fRes.data || [])
    setCommissions(fcRes.data || [])
    setLoading(false)
  }, [firm, groupId, router, supabase])

  useEffect(() => { load() }, [load])

  async function handleAddMember() {
    if (!firm || !group) return
    const count = Math.max(1, +form.tickets || 1)
    if (members.length + count > group.num_members) {
      showToast(`Only ${group.num_members - members.length} spots left!`, 'error')
      return
    }
    setSaving(true)

    // Data to insert
    let name = form.name, phone = form.phone, address = form.address, contact_id: any = null
    
    if (addTab === 'existing' && form.existing_id) {
       const src = allFirmMembers.find(m => m.id === +form.existing_id)
       if (src) {
         name = src.name; phone = src.phone || ''; address = src.address || ''; contact_id = src.contact_id || src.id
       }
    }

    const usedTickets = new Set(members.map(m => m.ticket_no))
    const toInsert = []
    let nextTicket = +form.ticket_no || 1

    for (let i = 0; i < count; i++) {
        while(usedTickets.has(nextTicket)) nextTicket++
        toInsert.push({
            name, phone, address, contact_id,
            group_id: groupId, firm_id: firm.id,
            ticket_no: nextTicket
        })
        usedTickets.add(nextTicket)
    }

    const { data: ins, error } = await supabase.from('members').insert(toInsert).select()

    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    
    // If new person, set their own ID as contact_id for the first one, then update others
    if (addTab === 'new' && ins && ins.length > 0) {
        const first = ins[0]
        await supabase.from('members').update({ contact_id: first.id }).in('id', ins.map(x => x.id))
    }

    showToast(count > 1 ? `${count} tickets added!` : 'Member added!')
    setAddOpen(false)
    setForm({ name: '', phone: '', address: '', ticket_no: '', existing_id: '', tickets: '1' })
    setSaving(false)
    load()
  }

  async function deleteMember(id: number) {
    if (!confirm('Remove this member from the group?')) return
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Member removed.')
    load()
  }

  if (loading) return <Loading />
  if (!group)  return null

  const totalDividends = auctionHistory.reduce((s, a) => s + Number(a.dividend), 0)
  const totalPayouts   = auctionHistory.reduce((s, a) => s + Number(a.bid_amount), 0)
  const totalComm      = commissions.reduce((s, c) => s + Number(c.commission_amt), 0)
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
        <div className="flex gap-2">
          {members.length < group.num_members && (
            <Btn variant="primary" onClick={() => setAddOpen(true)} icon={UserPlus}>Add Member</Btn>
          )}
          <Btn variant="secondary" onClick={() => router.push(`/groups/${groupId}/settings`)} icon={Settings2}>Settings</Btn>
        </div>
      </div>

      {/* ── Quick Stats ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Progress" value={`${monthsCompleted} / ${group.duration}`} sub="Months completed" color="blue" />
        <StatCard label="Members" value={`${members.length} / ${group.num_members}`} sub={`${group.num_members - members.length} vacant slots`} color="gold" />
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
        <StatCard label="Total Commission" value={fmt(totalComm)} sub="Firm/Foreman earnings" color="blue" />
      </div>

      {/* ── Vacant Slots Alert ─────────────────────────────── */}
      {members.length < group.num_members && auctionHistory.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
           <div className="flex items-center gap-3 text-blue-700">
              <Users size={20} />
              <div>
                 <div className="font-bold text-sm">Group is not yet full</div>
                 <div className="text-xs opacity-80">You have {group.num_members - members.length} tickets remaining to be filled.</div>
              </div>
           </div>
           <Btn size="sm" variant="primary" onClick={() => setAddOpen(true)}>Add Members Now</Btn>
        </div>
      )}

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
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Commission</th>
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
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} className="font-mono text-xs opacity-70">
                       {(() => {
                          const c = commissions.find(c => c.auction_id === a.id)
                          return c ? fmt(c.commission_amt) : '—'
                       })()}
                    </td>
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
                             <span>Member&apos;s Contribution:</span>
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

      {/* ── Member Directory ─────────────────────────────── */}
      <Card title="Member List" subtitle={`${members.length} members enrolled`}>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Ticket</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Name</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Phone</th>
                <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 opacity-50 italic">No members added to this group yet.</td></tr>
              ) : members.map((m) => (
                <Tr key={m.id}>
                  <Td>
                    <Badge variant="gray" className="font-mono font-bold">#{m.ticket_no}</Badge>
                  </Td>
                  <Td className="font-semibold">{m.name} {auctionHistory.some(a => a.winner_id === m.id) && '👑'}</Td>
                  <Td>{m.phone || '—'}</Td>
                  <Td>
                    {m.status === 'foreman' ? <Badge variant="blue">Foreman</Badge> : <Badge variant="green">Active</Badge>}
                  </Td>
                  <Td right>
                     <div className="flex justify-end gap-1">
                        <Btn size="sm" variant="ghost" onClick={() => setSelectedMember(m.id)}><Info size={14}/></Btn>
                        {auctionHistory.length === 0 && (
                           <Btn size="sm" variant="danger" onClick={() => deleteMember(m.id)}><Trash2 size={14}/></Btn>
                        )}
                     </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      {/* ── Add Member Modal ─────────────────────────────── */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Member to Group">
        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--surface2)' }}>
          {(['new','existing'] as const).map(t => (
            <button key={t} onClick={() => setAddTab(t)}
              className="flex-1 py-2 rounded-lg text-sm transition-all"
              style={addTab === t
                ? { background: 'var(--gold)', color: '#0d0f14', fontWeight: 700 }
                : { background: 'transparent', color: 'var(--text2)' }}>
              {t === 'new' ? 'New Person' : 'Existing Person'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {addTab === 'existing' ? (
            <Field label="Select Existing Person" className="col-span-2">
              <select className={inputClass} style={inputStyle}
                value={form.existing_id} onChange={e => setForm(f => ({...f, existing_id: e.target.value}))}>
                <option value="">— Choose —</option>
                {[...new Map(allFirmMembers.filter(m => m.name !== 'Foreman')
                  .map(m => [m.phone || m.name, m])).values()].map(m => (
                  <option key={m.id} value={m.id}>{m.name}{m.phone ? ` — ${m.phone}` : ''}</option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Full Name" className="col-span-2">
                <input className={inputClass} style={inputStyle} value={form.name}
                  onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Member name" />
              </Field>
              <Field label="Phone">
                <input className={inputClass} style={inputStyle} value={form.phone} type="tel" maxLength={10} 
                  onChange={e => setForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} placeholder="10 digits" />
              </Field>
              <Field label="Address">
                <input className={inputClass} style={inputStyle} value={form.address}
                  onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="City/Area" />
              </Field>
            </>
          )}

          <div className="col-span-2 grid grid-cols-2 gap-4 pt-2 border-t mt-2" style={{ borderColor: 'var(--border)' }}>
             <Field label="Starting Ticket #">
                <input className={inputClass} style={inputStyle} type="number" value={form.ticket_no}
                  onChange={e => setForm(f => ({...f, ticket_no: e.target.value}))} placeholder="Auto" />
             </Field>
             <Field label="No. of Tickets">
                <input className={inputClass} style={inputStyle} type="number" min="1" max={group.num_members - members.length} value={form.tickets}
                  onChange={e => setForm(f => ({...f, tickets: e.target.value}))} />
             </Field>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleAddMember}>Add {+form.tickets > 1 ? `${form.tickets} Tickets` : 'Member'}</Btn>
        </div>
      </Modal>

      {toast && <Toast msg={(toast as any).msg} type={(toast as any).type} onClose={hideToast} />}
    </div>
  )
}
