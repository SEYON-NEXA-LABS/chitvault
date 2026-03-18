'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, cn } from '@/lib/utils'
import {
  Btn, Badge, Card, TableCard, Table, Th, Td, Tr,
  Modal, Field, Loading, Empty, Toast, ProgressBar
} from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { ChevronDown, ChevronRight, Plus, Archive, RotateCcw, Trash2, Settings2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Group, Auction, Payment } from '@/types'

export default function GroupsPage() {
  const supabase = createClient()
  const { can } = useFirm()
  const router = useRouter()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [groups,   setGroups]   = useState<Group[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [archived, setArchived] = useState<Group[]>([])
  const [showArch, setShowArch] = useState(false)
  const [archLoading, setArchLoading] = useState(false)
  const [addOpen,  setAddOpen]  = useState(false)

  const [form, setForm] = useState({
    name: '', chit_value: '', num_members: '', duration: '',
    monthly_contribution: '', start_date: ''
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [g, a, p] = await Promise.all([
      supabase.from('groups').select('*').neq('status','archived').order('id'),
      supabase.from('auctions').select('group_id,month'),
      supabase.from('payments').select('group_id,status'),
    ])
    setGroups(g.data || [])
    setAuctions(a.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function groupStats(g: Group) {
    const done    = auctions.filter(a => a.group_id === g.id).length
    const paid    = payments.filter(p => p.group_id === g.id && p.status === 'paid').length
    const pending = Math.max(0, done * g.num_members - paid)
    const pct     = Math.round(done / g.duration * 100)
    const isComplete = done >= g.duration && pending === 0
    let endDate = '—'
    if (g.start_date) {
      const d = new Date(g.start_date)
      d.setMonth(d.getMonth() + g.duration - 1)
      endDate = fmtDate(d.toISOString().split('T')[0])
    }
    return { done, pending, pct, isComplete, endDate }
  }

  const active    = groups.filter(g => { const s = groupStats(g); return !s.isComplete })
  const completed = groups.filter(g => { const s = groupStats(g); return s.isComplete  })

  async function loadArchived() {
    setArchLoading(true)
    const { data } = await supabase.from('groups').select('*').eq('status','archived').order('id')
    setArchived(data || [])
    setArchLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase.from('groups').insert({
      name: form.name, chit_value: +form.chit_value, num_members: +form.num_members,
      duration: +form.duration, monthly_contribution: +form.monthly_contribution,
      start_date: form.start_date || null, status: 'active', firm_id: firmId!
    })
    setSaving(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Group created!'); setAddOpen(false)
    setForm({ name:'',chit_value:'',num_members:'',duration:'',monthly_contribution:'',start_date:'' })
    load()
  }

  async function archive(id: number) {
    if (!confirm('Archive this group?')) return
    await supabase.from('groups').update({ status: 'archived' }).eq('id', id)
    showToast('Group archived. 📦'); load()
  }

  async function archiveAll() {
    if (!confirm('Archive all completed groups?')) return
    const ids = completed.map(g => g.id)
    if (!ids.length) return
    await supabase.from('groups').update({ status: 'archived' }).in('id', ids)
    showToast(`${ids.length} groups archived.`); load()
  }

  async function unarchive(id: number) {
    await supabase.from('groups').update({ status: 'active', firm_id: firmId! }).eq('id', id)
    showToast('Group restored.'); loadArchived(); load()
  }

  async function del(id: number) {
    if (!confirm('Permanently delete this group and all its data?')) return
    await supabase.from('groups').delete().eq('id', id)
    showToast('Deleted.'); load()
  }

  const GroupTable = ({ list, showArchBtn }: { list: Group[], showArchBtn: boolean }) => (
    <Table>
      <thead>
        <tr>
          {['Group','Chit Value','Members','Monthly','Done','Progress','Status','End Date','Payments','Actions'].map(h => <Th key={h}>{h}</Th>)}
        </tr>
      </thead>
      <tbody>
        {list.map(g => {
          const s = groupStats(g)
          return (
            <Tr key={g.id}>
              <Td><span className="font-semibold">{g.name}</span></Td>
              <Td right>{fmt(g.chit_value)}</Td>
              <Td>{g.num_members}</Td>
              <Td right>{fmt(g.monthly_contribution)}</Td>
              <Td>{s.done}/{g.duration}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <ProgressBar pct={s.pct} />
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>{s.pct}%</span>
                </div>
              </Td>
              <Td>
                {s.pct >= 100
                  ? <Badge variant="green">Completed ✓</Badge>
                  : s.done > 0
                    ? <Badge variant="blue">{g.duration - s.done} mo left</Badge>
                    : <Badge variant="gray">Not started</Badge>}
              </Td>
              <Td>{s.endDate}</Td>
              <Td>
                {s.pending > 0
                  ? <Badge variant="red">{s.pending} pending</Badge>
                  : <Badge variant="green">All paid</Badge>}
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  {can('editGroup') && (
                    <Btn size="sm" variant="ghost" onClick={() => router.push(`/groups/${g.id}`)}
                      style={{ color: 'var(--blue)', border: '1px solid rgba(91,138,245,0.3)' }}>
                      <Settings2 size={12} /> Rules
                    </Btn>
                  )}
                  {showArchBtn && can('archiveGroup') && (
                    <Btn size="sm" variant="ghost" onClick={() => archive(g.id)}
                      style={{ color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.3)' }}>
                      <Archive size={12} /> Archive
                    </Btn>
                  )}
                  {can('deleteGroup') && <Btn size="sm" variant="danger" onClick={() => del(g.id)}><Trash2 size={12} /></Btn>}
                </div>
              </Td>
            </Tr>
          )
        })}
      </tbody>
    </Table>
  )

  if (loading) return <Loading />

  return (
    <div>
      {/* Active */}
      <TableCard title={`Active Groups (${active.length})`}
        actions={can('createGroup') ? <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}><Plus size={14} /> New Group</Btn> : undefined}>
        {active.length === 0
          ? <Empty icon="🏦" text="No active groups. Create your first group." action={
              <Btn variant="primary" onClick={() => setAddOpen(true)}>+ New Group</Btn>
            } />
          : <GroupTable list={active} showArchBtn={false} />}
      </TableCard>

      {/* Completed */}
      {completed.length > 0 && (
        <TableCard title={`✅ Completed — Ready to Archive (${completed.length})`}
          subtitle="All auctions done & all payments collected."
          actions={<Btn size="sm" onClick={archiveAll} style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid rgba(201,168,76,0.3)' }}>
            <Archive size={12} /> Archive All
          </Btn>}>
          <GroupTable list={completed} showArchBtn={true} />
        </TableCard>
      )}

      {/* Archived — on demand */}
      <Card className="overflow-hidden">
        <button className="w-full flex items-center justify-between px-5 py-4 text-left"
          style={{ color: 'var(--text2)' }}
          onClick={() => {
            if (!showArch) { setShowArch(true); loadArchived() }
            else setShowArch(false)
          }}>
          <div>
            <div className="font-semibold text-sm">📦 Archived Groups</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>Click to load</div>
          </div>
          {showArch ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>
        {showArch && (
          archLoading ? <Loading text="Loading archived groups..." /> :
          archived.length === 0
            ? <Empty icon="📦" text="No archived groups yet." />
            : <Table>
                <thead><tr>{['Group','Chit Value','Members','Months','Start Date','Actions'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {archived.map(g => (
                    <Tr key={g.id} style={{ opacity: 0.7 }}>
                      <Td><span className="font-semibold">{g.name}</span> <Badge variant="gray" className="ml-1 text-xs">Archived</Badge></Td>
                      <Td right>{fmt(g.chit_value)}</Td>
                      <Td>{g.num_members}</Td>
                      <Td>{g.duration}</Td>
                      <Td>{fmtDate(g.start_date)}</Td>
                      <Td>
                        <div className="flex gap-1.5">
                          <Btn size="sm" variant="secondary" onClick={() => unarchive(g.id)}>
                            <RotateCcw size={12} /> Restore
                          </Btn>
                          <Btn size="sm" variant="danger" onClick={() => del(g.id)}>
                            <Trash2 size={12} />
                          </Btn>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
        )}
      </Card>

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Create New Chit Group">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Group Name" className="col-span-2">
            <input className={inputClass} style={inputStyle} value={form.name}
              onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Kumari Group A" />
          </Field>
          <Field label="Chit Value (₹)">
            <input className={inputClass} style={inputStyle} type="number" value={form.chit_value}
              onChange={e => setForm(f => ({...f, chit_value: e.target.value}))} placeholder="100000" />
          </Field>
          <Field label="No. of Members">
            <input className={inputClass} style={inputStyle} type="number" value={form.num_members}
              onChange={e => setForm(f => ({...f, num_members: e.target.value}))} placeholder="20" />
          </Field>
          <Field label="Duration (months)">
            <input className={inputClass} style={inputStyle} type="number" value={form.duration}
              onChange={e => setForm(f => ({...f, duration: e.target.value}))} placeholder="20" />
          </Field>
          <Field label="Monthly Contribution (₹)">
            <input className={inputClass} style={inputStyle} type="number" value={form.monthly_contribution}
              onChange={e => setForm(f => ({...f, monthly_contribution: e.target.value}))} placeholder="5000" />
          </Field>
          <Field label="Start Date" className="col-span-2">
            <input className={inputClass} style={inputStyle} type="date" value={form.start_date}
              onChange={e => setForm(f => ({...f, start_date: e.target.value}))} />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleSave}>Create Group</Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
