'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import { Btn, Badge, TableCard, Table, Th, Td, Tr, Modal, Field, Loading, Empty, Toast } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Plus, Trash2, Info } from 'lucide-react'
import type { Group, Member, Auction } from '@/types'

export default function AuctionsPage() {
  const supabase = createClient()
  const { can, firm } = useFirm()
  const { toast, show, hide } = useToast()

  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading,  setLoading]  = useState(true)
  const [addOpen,  setAddOpen]  = useState(false)
  const [saving,   setSaving]   = useState(false)

  const [form, setForm] = useState({
    group_id: '', month: '', auction_date: '', winner_id: '',
    total_pot: '', bid_amount: '', dividend: '', discount: ''
  })
  const [eligible, setEligible] = useState<Member[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [g, m, a] = await Promise.all([
      supabase.from('groups').select('*').neq('status','archived').order('name'),
      supabase.from('members').select('*').eq('status','active'),
      supabase.from('auctions').select('*').order('id', { ascending: false }),
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function calcDividend(pot: string, bid: string, groupId: string) {
    const g = groups.find(x => x.id === +groupId)
    if (!g || !pot || !bid) return
    const numMembers = members.filter(m => m.group_id === g.id).length || 1
    const disc = +pot - +bid
    const div  = Math.round(disc / numMembers)
    setForm(f => ({ ...f, discount: String(disc), dividend: String(div) }))
  }

  function loadEligible(groupId: string) {
    if (!groupId) return
    const g = groups.find(x => x.id === +groupId)
    if (!g) return
    const done      = auctions.filter(a => a.group_id === +groupId).length
    const winnerIds = auctions.filter(a => a.group_id === +groupId).map(a => a.winner_id)
    const gMembers  = members.filter(m => m.group_id === +groupId && !winnerIds.includes(m.id))
    setEligible(gMembers)
    setForm(f => ({
      ...f, group_id: groupId, month: String(done + 1),
      total_pot: String(g.chit_value), bid_amount: '', dividend: '', discount: ''
    }))
  }

  async function handleSave() {
    if (!form.group_id || !form.winner_id || !form.bid_amount) {
      show('Fill in all required fields.', 'error'); return
    }
    setSaving(true)
    const { error } = await supabase.from('auctions').insert({
      group_id: +form.group_id, month: +form.month,
      auction_date: form.auction_date || null,
      winner_id: +form.winner_id,
      bid_amount: +form.bid_amount, firm_id: firm!.id, total_pot: +form.total_pot, dividend: +form.dividend
    })
    setSaving(false)
    if (error) { show(error.message, 'error'); return }
    show('Auction recorded! 🎉'); setAddOpen(false)
    setForm({ group_id:'',month:'',auction_date:'',winner_id:'',total_pot:'',bid_amount:'',dividend:'',discount:'' })
    load()
  }

  async function del(id: number) {
    if (!confirm('Delete this auction?')) return
    await supabase.from('auctions').delete().eq('id', id)
    show('Deleted.'); load()
  }

  if (loading) return <Loading />

  return (
    <div>
      <div className="p-4 rounded-xl border mb-5 text-sm"
        style={{ background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.3)', color: 'var(--gold)' }}>
        📌 Each month, members bid the lowest amount they'll accept. Discount ÷ Members = Dividend (deducted from next contribution).
      </div>

      <TableCard title={`All Auctions (${auctions.length})`}
        actions={can('recordAuction') ? <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}><Plus size={14}/> Record Auction</Btn> : undefined}>
        {auctions.length === 0
          ? <Empty icon="🔨" text="No auctions recorded yet." />
          : <Table>
              <thead><tr>
                {['Group','Month','Date','Winner','Bid Amount','Discount','Dividend/Member','Total Pot','Action'].map(h => <Th key={h}>{h}</Th>)}
              </tr></thead>
              <tbody>
                {auctions.map(a => {
                  const g = groups.find(x => x.id === a.group_id)
                  const w = members.find(x => x.id === a.winner_id)
                  return (
                    <Tr key={a.id}>
                      <Td><span className="font-semibold">{g?.name || `Group #${a.group_id}`}</span></Td>
                      <Td><Badge variant="blue">Month {a.month}</Badge></Td>
                      <Td>{fmtDate(a.auction_date)}</Td>
                      <Td>👑 <span className="font-semibold">{w?.name || `Member #${a.winner_id}`}</span></Td>
                      <Td right>{fmt(a.bid_amount)}</Td>
                      <Td right><span style={{ color: 'var(--red)' }}>−{fmt(Number(a.total_pot) - Number(a.bid_amount))}</span></Td>
                      <Td right><span style={{ color: 'var(--green)' }}>+{fmt(a.dividend)}</span></Td>
                      <Td right>{fmt(a.total_pot)}</Td>
                      <Td>
                        {can('deleteAuction') && <Btn size="sm" variant="danger" onClick={() => del(a.id)}><Trash2 size={13}/></Btn>}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
        }
      </TableCard>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Record Auction">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Chit Group" className="col-span-2">
            <select className={inputClass} style={inputStyle} value={form.group_id}
              onChange={e => loadEligible(e.target.value)}>
              <option value="">Select group</option>
              {groups.map(g => {
                const done = auctions.filter(a => a.group_id === g.id).length
                return <option key={g.id} value={g.id}>{g.name} (Month {done + 1})</option>
              })}
            </select>
          </Field>
          <Field label="Month No.">
            <input className={inputClass} style={{ ...inputStyle, opacity: 0.7 }}
              value={form.month} readOnly />
          </Field>
          <Field label="Auction Date">
            <input className={inputClass} style={inputStyle} type="date" value={form.auction_date}
              onChange={e => setForm(f => ({...f, auction_date: e.target.value}))} />
          </Field>
          <Field label="Winner (Bidder)" className="col-span-2">
            <select className={inputClass} style={inputStyle} value={form.winner_id}
              onChange={e => setForm(f => ({...f, winner_id: e.target.value}))}>
              <option value="">Select winner</option>
              {eligible.map(m => <option key={m.id} value={m.id}>{m.name} (#{m.ticket_no})</option>)}
            </select>
          </Field>
          <Field label="Total Pot (₹)">
            <input className={inputClass} style={inputStyle} type="number" value={form.total_pot}
              onChange={e => { setForm(f => ({...f, total_pot: e.target.value})); calcDividend(e.target.value, form.bid_amount, form.group_id) }} />
          </Field>
          <Field label="Winning Bid (₹)">
            <input className={inputClass} style={inputStyle} type="number" value={form.bid_amount}
              placeholder="Amount winner receives"
              onChange={e => { setForm(f => ({...f, bid_amount: e.target.value})); calcDividend(form.total_pot, e.target.value, form.group_id) }} />
          </Field>
          <Field label="Dividend / Member (₹)">
            <input className={inputClass} style={{ ...inputStyle, opacity: 0.7, color: 'var(--green)' }}
              value={form.dividend} readOnly />
          </Field>
          <Field label="Discount (₹)">
            <input className={inputClass} style={{ ...inputStyle, opacity: 0.7, color: 'var(--red)' }}
              value={form.discount} readOnly />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleSave}>Record Auction</Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
