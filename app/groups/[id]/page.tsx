'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, cn } from '@/lib/utils'
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
    const toInsert = []
    let nextTicket = +form.ticket_no || 1

    for (let i = 0; i < count; i++) {
        while(usedTickets.has(nextTicket)) nextTicket++
        toInsert.push({
            person_id,
            group_id: groupId,
            firm_id: firm.id,
            ticket_no: nextTicket,
            created_by: userData.user?.id
        })
        usedTickets.add(nextTicket)
    }

    const { error } = await supabase.from('members').insert(toInsert)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    
    showToast(`${count > 1 ? count + ' tickets' : 'Member'} added successfully!`)
    setAddOpen(false)
    setForm({ name: '', nickname: '', phone: '', address: '', ticket_no: '', person_id: '', tickets: '1' })
    load()
    setSaving(false)
  }

  async function deleteMember(id: number) {
    if (!confirm('Remove this member from the group?')) return
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) showToast(error.message, 'error')
    else { showToast('Member removed.'); load() }
  }

  if (loading || !group) return <Loading />

  // Financial aggregates
  const totalMonths = group.duration
  const monthsCompleted = auctionHistory.length
  const totalPayouts = auctionHistory.reduce((s, a) => s + Number(a.net_payout || 0), 0)
  const totalDividends = auctionHistory.reduce((s, a) => s + (Number(a.dividend || 0) * group.num_members), 0)
  const totalComm = commissions.reduce((s, c) => s + Number(c.commission_amt || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/groups')} className="flex items-center gap-1 text-xs font-bold text-[var(--gold)] hover:opacity-70 mb-2">
            <ArrowLeft size={14} /> BACK TO GROUPS
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-black text-[var(--text)]">{group.name}</h1>
            <Badge variant={group.status === 'active' ? 'green' : 'gray'}>{group.status}</Badge>
            {group.auction_scheme === 'ACCUMULATION' && <Badge variant="blue">Accumulation Scheme</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          {members.length < group.num_members && (
            <Btn variant="primary" onClick={() => setAddOpen(true)} icon={UserPlus}>Add Member</Btn>
          )}
          <Btn variant="secondary" onClick={() => router.push(`/groups/${groupId}/settings`)} icon={Settings2}>Settings</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Progress" value={`${monthsCompleted} / ${totalMonths}`} sub="Months completed" color="blue" />
        <StatCard label="Members" value={`${members.length} / ${group.num_members}`} sub={`${group.num_members - members.length} vacant slots`} color="gold" />
        {group.auction_scheme === 'ACCUMULATION' ? (
          <>
            <StatCard label="Surplus Pool" value={fmt(group.accumulated_surplus)} sub="Accumulated savings" color="green" />
            <StatCard label="Closure Target" value={fmt(group.chit_value)} sub="Closing early soon" color="red" />
          </>
        ) : (
          <>
            <StatCard label="Total Dividends" value={fmt(totalDividends)} sub="Distributed" color="green" />
            <StatCard label="Total Payouts" value={fmt(totalPayouts)} sub="Paid to winners" color="red" />
          </>
        )}
        <StatCard label="Total Commission" value={fmt(totalComm)} sub="Firm earnings" color="blue" />
      </div>

      <Card title="Auction Ledger" subtitle="Breakdown of all previous auctions">
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
                <tr><td colSpan={7} className="text-center py-12 opacity-50 italic">No auctions held yet.</td></tr>
              ) : auctionHistory.map((a) => {
                const winner = members.find(m => m.id === a.winner_id)
                const monthlyDue = group.chit_value / group.duration
                const eachPays = monthlyDue - Number(a.dividend || 0)
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-[var(--surface2)]" style={{ borderColor: 'var(--border)' }}>
                    <td style={{ padding: '12px 14px' }}><Badge variant="gray" className="font-mono font-bold">Month {a.month}</Badge></td>
                    <td style={{ padding: '12px 14px' }} className="font-medium">
                       {winner ? (
                         <div className="flex items-center gap-2">
                            <span className="text-sm">👑 {winner.persons?.name} {winner.persons?.nickname && `(${winner.persons.nickname})`}</span>
                            <span className="text-[10px] opacity-40">#{winner.ticket_no}</span>
                         </div>
                       ) : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} className="font-mono font-bold text-red-500">{fmt(a.bid_amount)}</td>
                    {group.auction_scheme === 'ACCUMULATION' ? (
                       <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--gold)' }} className="font-mono font-bold">+{fmt(Number(a.total_pot || 0) - Number(a.bid_amount || 0))}</td>
                    ) : (
                       <td style={{ padding: '12px 14px', textAlign: 'right', color: 'var(--gold)' }} className="font-mono">{fmt(a.dividend)}</td>
                    )}
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} className="font-mono font-black text-green-500">{fmt(a.net_payout || a.bid_amount)}</td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }} className="font-mono font-bold">{fmt(eachPays)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Member List" subtitle={`${members.length} enrollments`}>
        <Table>
          <thead><Tr><Th>Ticket</Th><Th>Name</Th><Th>Phone</Th><Th>Status</Th><Th right>Actions</Th></Tr></thead>
          <tbody>
            {members.length === 0 ? (
              <Tr><Td colSpan={5} className="text-center py-12 opacity-50 italic">No members yet.</Td></Tr>
            ) : members.map((m) => (
              <Tr key={m.id}>
                <Td><Badge variant="gray" className="font-mono font-bold">#{m.ticket_no}</Badge></Td>
                <Td className="font-semibold">
                  {m.persons?.name} {m.persons?.nickname && <span className="text-xs opacity-50 ml-1">({m.persons.nickname})</span>}
                  {auctionHistory.some(a => a.winner_id === m.id) && ' 👑'}
                </Td>
                <Td className="text-xs font-mono">{m.persons?.phone || '—'}</Td>
                <Td>{m.status === 'foreman' ? <Badge variant="blue">Foreman</Badge> : <Badge variant="green">Active</Badge>}</Td>
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Enroll Member">
        <div className="flex gap-1 p-1 rounded-xl mb-5 bg-[var(--surface2)]">
          {(['new','existing'] as const).map(t => (
            <button key={t} type="button" onClick={() => setAddTab(t)} className={cn("flex-1 py-2 rounded-lg text-sm font-bold transition-all", addTab === t ? 'bg-[var(--gold)] text-white shadow-sm' : 'text-[var(--text3)]')}>
              {t === 'new' ? 'New Person' : 'From Registry'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {addTab === 'existing' ? (
            <Field label="Select from Registry" className="col-span-2">
              <select className={inputClass} style={inputStyle} value={form.person_id} onChange={e => setForm(f => ({...f, person_id: e.target.value}))}>
                <option value="">— Choose Person —</option>
                {allPersons.map(p => (
                  <option key={p.id} value={p.id}>{p.name} {p.nickname ? `(${p.nickname})` : ''} — {p.phone || 'No phone'}</option>
                ))}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Full Name"><input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full name" /></Field>
              <Field label="Nickname"><input className={inputClass} style={inputStyle} value={form.nickname} onChange={e => setForm(f => ({...f, nickname: e.target.value}))} placeholder="JD" /></Field>
              <Field label="Phone"><input className={inputClass} style={inputStyle} value={form.phone} type="tel" maxLength={10} onChange={e => setForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} placeholder="10 digits" /></Field>
              <Field label="Address"><input className={inputClass} style={inputStyle} value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="City/Town" /></Field>
            </>
          )}

          <div className="col-span-2 grid grid-cols-2 gap-4 pt-4 border-t mt-2" style={{ borderColor: 'var(--border)' }}>
             <Field label="Target Ticket #"><input className={inputClass} style={inputStyle} type="number" value={form.ticket_no} onChange={e => setForm(f => ({...f, ticket_no: e.target.value}))} placeholder="Next available" /></Field>
             <Field label="No. of Tickets"><input className={inputClass} style={inputStyle} type="number" min="1" max={group.num_members - members.length} value={form.tickets} onChange={e => setForm(f => ({...f, tickets: e.target.value}))} /></Field>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleAddMember}>Add {+form.tickets > 1 ? `${form.tickets} Tickets` : 'Member'}</Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
