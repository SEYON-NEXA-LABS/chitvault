'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, cn } from '@/lib/utils'
import { Card, Loading, Badge, StatCard, Btn, ProgressBar, Modal, Field, Toast, Empty, Table, Th, Td, Tr } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Gavel, Settings2, Calendar, Users, DollarSign, ArrowLeft, Calculator, Plus, UserPlus, Info, Trash2, MapPin, Phone } from 'lucide-react'
import type { Group, Auction, Member, ForemanCommission, Person } from '@/types'

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
  const [showAdv,        setShowAdv]        = useState(false)
  
  const { toast, show: showToast, hide: hideToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addTab, setAddTab] = useState<'new'|'existing'>('new')
  const [form, setForm] = useState({ name: '', nickname: '', phone: '', address: '', ticket_no: '', person_id: '', tickets: '1' })
  const [allPersons, setAllPersons] = useState<Person[]>([])

  const load = useCallback(async () => {
    if (!firm) return
    
    const [gRes, mRes, aRes, pRes, fcRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).eq('firm_id', firm.id).single(),
      supabase.from('members').select('*, persons(*)').eq('group_id', groupId).order('ticket_no'),
      supabase.from('auctions').select('*').eq('group_id', groupId).order('month'),
      supabase.from('persons').select('*').eq('firm_id', firm.id).order('name'),
      supabase.from('foreman_commissions').select('*').eq('group_id', groupId).order('month')
    ])

    if (!gRes.data) { router.push('/groups'); return }
    
    setGroup(gRes.data)
    setMembers(mRes.data || [])
    setAuctionHistory(aRes.data || [])
    setAllPersons(pRes.data || [])
    setCommissions(fcRes.data || [])
    setLoading(false)
  }, [firm, groupId, router, supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (addOpen && members.length < (group?.num_members || 0)) {
       const used = new Set(members.map(m => m.ticket_no))
       let gap = 1
       while(used.has(gap)) gap++
       setForm(f => ({ ...f, ticket_no: String(gap) }))
    }
  }, [addOpen, members, group])

  async function handleAddMember() {
    if (!firm || !group) return
    const count = Math.max(1, +form.tickets || 1)
    if (members.length + count > group.num_members) {
      showToast(`Only ${group.num_members - members.length} spots left!`, 'error')
      return
    }
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()

    let person_id: number | null = null
    
    if (addTab === 'existing' && form.person_id) {
       person_id = +form.person_id
    } else {
       // Create new person
       const { data: pData, error: pErr } = await supabase.from('persons')
         .insert({
           name: form.name,
           nickname: form.nickname,
           phone: form.phone,
           address: form.address,
           firm_id: firm.id,
           created_by: userData.user?.id
         })
         .select()
         .single()
       if (pErr) { showToast(pErr.message, 'error'); setSaving(false); return }
       person_id = pData.id
    }

    const usedTickets = new Set(members.map(m => m.ticket_no))
    const insertPayload = []
    let currentTicket = +form.ticket_no
    for (let i = 0; i < count; i++) {
       while(usedTickets.has(currentTicket)) currentTicket++
       insertPayload.push({
          firm_id: firm.id,
          group_id: group.id,
          person_id: person_id,
          ticket_no: currentTicket,
          status: 'active',
          created_by: userData.user?.id
       })
       usedTickets.add(currentTicket)
    }

    const { error: mErr } = await supabase.from('members').insert(insertPayload)
    
    setSaving(false)
    if (mErr) { showToast(mErr.message, 'error'); return }
    showToast('Member(s) added successfully!', 'success'); setAddOpen(false); load()
  }

  async function deleteMember(id: number) {
     if(!confirm('Are you sure?')) return
     const { error } = await supabase.from('members').delete().eq('id', id)
     if(error) showToast(error.message, 'error')
     else { showToast('Removed!', 'success'); load() }
  }

  if (loading || !group) return <Loading />

  const totalDividends = auctionHistory.reduce((s, a) => s + Number(a.dividend || 0), 0)
  const totalPayouts   = auctionHistory.reduce((s, a) => s + Number(a.net_payout || 0), 0)
  const totalComm      = commissions.reduce((s, c) => s + Number(c.commission_amt || 0), 0)
  const monthsCompleted = auctionHistory.length
  const totalMonths     = group.duration

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/groups')} className="p-2.5 rounded-xl hover:bg-[var(--surface2)] transition-colors border" style={{ borderColor: 'var(--border)' }}>
             <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-[var(--text)]">{group.name}</h1>
            <div className="flex gap-2 mt-1">
              <Badge variant={group.status === 'active' ? 'green' : 'gray'}>{group.status}</Badge>
              {group.auction_scheme === 'ACCUMULATION' && <Badge variant="blue">Accumulation</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {members.length < group.num_members && (
            <Btn variant="primary" onClick={() => setAddOpen(true)} icon={UserPlus}>Add Member</Btn>
          )}
          <Btn variant="secondary" onClick={() => router.push(`/groups/${groupId}/settings`)} icon={Settings2}>Settings</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard label="Progress" value={`${monthsCompleted}/${totalMonths}`} color="blue" />
        <StatCard label="Vacant" value={group.num_members - members.length} color="gold" />
        {group.auction_scheme === 'ACCUMULATION' ? (
          <>
            <StatCard label="Pool" value={fmt(group.accumulated_surplus)} color="green" />
            <StatCard label="Target" value={fmt(group.chit_value)} color="red" />
          </>
        ) : (
          <>
            <StatCard label="Dividends" value={fmt(totalDividends)} color="green" />
            <StatCard label="Payouts" value={fmt(totalPayouts)} color="red" />
          </>
        )}
        <StatCard label="Earnings" value={fmt(totalComm)} color="blue" />
      </div>

      <Card title="Auction Ledger">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Month</th>
                <th style={{ padding: '12px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Winner</th>
                <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Bid</th>
                <th className="hidden md:table-cell" style={{ padding: '12px 10px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Div/Surplus</th>
                <th style={{ padding: '12px 10px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Payout</th>
                <th className="hidden sm:table-cell" style={{ padding: '12px 10px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Each Pays</th>
              </tr>
            </thead>
            <tbody>
              {auctionHistory.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 opacity-50 italic">No auctions held yet.</td></tr>
              ) : auctionHistory.map((a) => {
                const winner = members.find(m => m.id === a.winner_id)
                const monthlyDue = group.chit_value / group.duration
                const eachPays = monthlyDue - Number(a.dividend || 0)
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-[var(--surface2)]" style={{ borderColor: 'var(--border)' }}>
                    <td style={{ padding: '12px 10px' }}><Badge variant="gray" className="font-mono text-[10px]">{fmtMonth(a.month, group.start_date)}</Badge></td>
                    <td style={{ padding: '12px 10px' }}>
                       {winner ? (
                         <div className="flex flex-col">
                            <span className="text-xs font-bold truncate max-w-[80px] md:max-w-full">{winner.persons?.name}</span>
                            <span className="text-[9px] opacity-40 italic">Ticket #{winner.ticket_no}</span>
                         </div>
                       ) : '—'}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }} className="font-mono font-bold text-red-500">{fmt(a.bid_amount)}</td>
                    <td className="hidden md:table-cell font-mono text-right" style={{ padding: '12px 10px', color: 'var(--gold)' }}>
                       {group.auction_scheme === 'ACCUMULATION' ? `+${fmt(Number(a.total_pot || 0) - Number(a.bid_amount || 0))}` : fmt(a.dividend)}
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'right' }} className="font-mono font-black text-green-500">{fmt(a.net_payout || a.bid_amount)}</td>
                    <td className="hidden sm:table-cell font-mono font-bold text-right" style={{ padding: '12px 10px' }}>{fmt(eachPays)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Member List" subtitle={`${members.length} enrollments`}>
        <Table>
          <thead><tr><Th>#</Th><Th>Name</Th><Th className="hidden md:table-cell">Phone</Th><Th className="hidden sm:table-cell">Status</Th><Th right>Actions</Th></tr></thead>
          <tbody>
            {members.length === 0 ? (
              <Tr><Td colSpan={5} className="text-center py-12 opacity-50 italic">No members yet.</Td></Tr>
            ) : members.map((m) => (
              <Tr key={m.id}>
                <Td><span className="font-mono font-black text-[10px] bg-[var(--surface2)] px-1.5 py-0.5 rounded">{m.ticket_no}</span></Td>
                <Td className="font-semibold text-xs md:text-sm">
                  {m.persons?.name}
                  {auctionHistory.some(a => a.winner_id === m.id) && <span className="ml-1" title="Won previously">👑</span>}
                </Td>
                <Td className="hidden md:table-cell text-xs font-mono">{m.persons?.phone || '—'}</Td>
                <Td className="hidden sm:table-cell">{m.status === 'foreman' ? <Badge variant="blue">Foreman</Badge> : <Badge variant="green">Active</Badge>}</Td>
                <Td right>
                   <div className="flex justify-end gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => setSelectedMember(m.id)} icon={Info}>Details</Btn>
                      {auctionHistory.length === 0 && <Btn size="sm" variant="danger" onClick={() => deleteMember(m.id)} icon={Trash2}>Remove</Btn>}
                   </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Group Enrollment" size="lg">
         <div className="flex gap-1 mb-5 bg-[var(--surface2)] p-1 rounded-xl">
            <button onClick={() => setAddTab('new')} className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-all", addTab === 'new' ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)]")}>New Person</button>
            <button onClick={() => setAddTab('existing')} className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-all", addTab === 'existing' ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)]")}>From Registry</button>
         </div>
         <div className="grid grid-cols-2 gap-4">
            {addTab === 'existing' ? (
                <Field label="Search Registry" className="col-span-2">
                   <select className={inputClass} style={inputStyle} value={form.person_id} onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))}>
                      <option value="">Select a person...</option>
                      {allPersons.map(p => <option key={p.id} value={p.id}>{p.name} {p.phone && `(${p.phone})`}</option>)}
                   </select>
                </Field>
            ) : (
                <>
                  <Field label="Full Name"><input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
                  <Field label="Nickname"><input className={inputClass} style={inputStyle} value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} /></Field>
                  <Field label="Phone"><input className={inputClass} style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
                  <Field label="Address"><input className={inputClass} style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
                </>
            )}
            <Field label="Start Ticket #"><input className={inputClass} style={inputStyle} type="number" value={form.ticket_no} onChange={e => setForm(f => ({ ...f, ticket_no: e.target.value }))} /></Field>
            <Field label="No. of Tickets"><input className={inputClass} style={inputStyle} type="number" value={form.tickets} onChange={e => setForm(f => ({ ...f, tickets: e.target.value }))} /></Field>
         </div>
         <div className="flex justify-end gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={handleAddMember}>Enroll Member</Btn>
         </div>
      </Modal>

      {selectedMember && (() => {
        const m = members.find(x => x.id === selectedMember)
        if (!m) return null
        return (
          <Modal open={!!selectedMember} onClose={() => setSelectedMember(null)} title="Member Details">
             <div className="space-y-4">
                <div className="bg-[var(--surface2)] p-4 rounded-2xl flex items-center gap-4">
                   <div className="w-12 h-12 rounded-full bg-[var(--gold)] flex items-center justify-center text-white text-xl font-bold">{m.persons?.name.charAt(0)}</div>
                   <div>
                      <div className="font-bold text-lg">{m.persons?.name}</div>
                      <div className="text-xs opacity-50">Ticket #{m.ticket_no} · {m.status}</div>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                   <div className="p-3 border rounded-xl" style={{borderColor:'var(--border)'}}><div className="opacity-40 mb-1 uppercase tracking-tighter">Phone</div><div className="font-bold">{m.persons?.phone || '—'}</div></div>
                   <div className="p-3 border rounded-xl" style={{borderColor:'var(--border)'}}><div className="opacity-40 mb-1 uppercase tracking-tighter">Joined</div><div className="font-bold">{fmtDate(m.created_at)}</div></div>
                </div>
                <p className="text-[10px] opacity-40 px-1 italic">Address: {m.persons?.address || 'Not provided'}</p>
             </div>
             <div className="flex justify-end mt-6">
                <Btn variant="secondary" onClick={() => setSelectedMember(null)}>Close</Btn>
             </div>
          </Modal>
        )
      })()}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
