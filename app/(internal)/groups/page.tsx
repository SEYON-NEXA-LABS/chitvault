'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import {
  Btn, Badge, TableCard, Table, Th, Td, Tr,
  Modal, Field, Loading, Empty, Toast, ProgressBar, Card
} from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { logActivity } from '@/lib/utils/logger'
import { downloadCSV } from '@/lib/utils/csv'
import { ChevronDown, ChevronRight, Plus, Archive, RotateCcw, Trash2, Settings2, Gavel, FileSpreadsheet } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Group, Auction, Payment, Firm } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'

export default function GroupsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const isSuper = role === 'superadmin'
  const isOwner = role === 'owner' || role === 'superadmin'
  const { t } = useI18n()
  const router = useRouter()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [groups, setGroups] = useState<Group[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [archived, setArchived] = useState<Group[]>([])
  const [showArch, setShowArch] = useState(false)
  const [archLoading, setArchLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [firms, setFirms] = useState<Firm[]>([])

  const [form, setForm] = useState({
    name: '', chit_value: '', num_members: '', duration: '',
    monthly_contribution: '', start_date: '',
    auction_scheme: 'ACCUMULATION' as 'DIVIDEND' | 'ACCUMULATION'
  })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id

    const [g, a, p] = await Promise.all([
      withFirmScope(supabase.from('groups').select('*, firms(name)').neq('status', 'archived'), targetId).is('deleted_at', null).order('id'),
      withFirmScope(supabase.from('auctions').select('group_id,month'), targetId).is('deleted_at', null),
      withFirmScope(supabase.from('payments').select('group_id,status'), targetId).is('deleted_at', null),
    ])
    setGroups((g.data as any) || [])
    setAuctions((a.data as any) || [])
    setPayments((p.data as any) || [])

    if (isSuper && firms.length === 0) {
      const { data: f } = await supabase.from('firms').select('*').order('name')
      setFirms(f || [])
    }
    setLoading(false)
  }, [supabase, isSuper, switchedFirmId, firm, firms.length])

  useEffect(() => { load(true) }, [load])

  const groupStats = useCallback((g: Group) => {
    const done = auctions.filter(a => a.group_id === g.id).length
    const paid = payments.filter(p => p.group_id === g.id && p.status === 'paid').length
    const pending = Math.max(0, done * g.num_members - paid)
    const pct = Math.round(done / g.duration * 100)
    const isComplete = done >= g.duration && pending === 0
    let endDate = '—'
    if (g.start_date) {
      const d = new Date(g.start_date)
      d.setMonth(d.getMonth() + g.duration - 1)
      endDate = fmtDate(d.toISOString().split('T')[0])
    }
    return { done, pending, pct, isComplete, endDate }
  }, [auctions, payments])

  const active = useMemo(() => {
    return groups.filter(g => { const s = groupStats(g); return !s.isComplete })
  }, [groups, groupStats])

  const completed = useMemo(() => {
    return groups.filter(g => { const s = groupStats(g); return s.isComplete })
  }, [groups, groupStats])


  async function loadArchived() {
    setArchLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    const { data } = await withFirmScope(supabase.from('groups').select('*, firms(name)').eq('status', 'archived'), targetId).is('deleted_at', null).order('id')
    setArchived(data || [])
    setArchLoading(false)
  }

  async function handleSave() {
    if (!firm) return
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('groups').insert({
      name: form.name,
      chit_value: +form.chit_value,
      num_members: +form.num_members,
      duration: +form.duration,
      monthly_contribution: +form.monthly_contribution,
      start_date: form.start_date || null,
      status: 'active',
      firm_id: firm.id,
      auction_scheme: form.auction_scheme,
      accumulated_surplus: 0,
      created_by: userData.user?.id
    })
    setSaving(false)
    if (error) { showToast(error.message, 'error'); return }
    showToast('Group created!'); setAddOpen(false); load()
  }

  const handleExport = () => {
    if (!isOwner) return
    const data = groups.map(g => {
      const s = groupStats(g)
      return {
        ID: g.id,
        'Group Name': g.name,
        'Chit Value': g.chit_value,
        'Capacity': g.num_members,
        'Duration': g.duration,
        'Monthly Pay': g.monthly_contribution,
        'Start Date': g.start_date || '—',
        'Scheme': g.auction_scheme,
        'Status': g.status,
        'Progress': `${s.done}/${g.duration}`,
        'End Date': s.endDate
      }
    })
    downloadCSV(data, 'groups_list')
  }

  async function archive(id: number) {
    if (!confirm('Archive this group? It will no longer show in active lists.')) return
    const { error } = await supabase.from('groups').update({ status: 'archived' }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else { showToast('Group archived'); load() }
  }

  async function archiveAll() {
    if (!confirm(`Archive all ${completed.length} completed groups?`)) return
    const ids = completed.map(g => g.id)
    const { error } = await supabase.from('groups').update({ status: 'archived' }).in('id', ids)
    if (error) showToast(error.message, 'error')
    else { showToast('Groups archived'); load() }
  }

  async function del(id: number) {
    if (!can('deleteGroup')) return
    if (!confirm('Are you sure you want to move this group to trash? It will be retrievable for 90 days.')) return
    const { error } = await supabase.from('groups').update({ deleted_at: new Date() }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else { 
      showToast('Group moved to trash!'); 
      if (firm) {
        await logActivity(firm.id, 'GROUP_ARCHIVED', 'group', id, { id });
      }
      load() 
    }
  }

  const GroupTable = ({ list, showArchBtn }: { list: Group[], showArchBtn: boolean }) => (
    <Table>
      <thead>
        <tr>
          {isSuper && <Th>Firm</Th>}
          <Th>Group</Th>
          <Th right>Value</Th>
          <Th className="hidden sm:table-cell">Members</Th>
          <Th right className="hidden md:table-cell">Monthly</Th>
          <Th>Progress</Th>
          <Th className="hidden lg:table-cell">Status</Th>
          <Th className="hidden xl:table-cell">Ends</Th>
          <Th className="hidden md:table-cell">Pending</Th>
          <Th>Action</Th>
        </tr>
      </thead>
      <tbody>
        {list.map(g => {
          const s = groupStats(g)
          return (
            <Tr key={g.id}>
              {isSuper && <Td><Badge variant="gray">{g.firms?.name}</Badge></Td>}
              <Td>
                <Link href={`/groups/${g.id}`} className="font-semibold hover:text-[var(--accent)] transition-colors">
                  {g.name}
                </Link>
              </Td>
              <Td right>{fmt(g.chit_value)}</Td>
              <Td className="hidden sm:table-cell">{g.num_members}</Td>
              <Td right className="hidden md:table-cell">{fmt(g.monthly_contribution)}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <div className="hidden md:block w-20"><ProgressBar pct={s.pct} /></div>
                  <span className="text-[10px] md:text-xs font-bold" style={{ color: 'var(--text2)' }}>{s.done}/{g.duration}</span>
                </div>
              </Td>
              <Td className="hidden lg:table-cell">
                {s.pct >= 100
                  ? <Badge variant="success">Completed ✓</Badge>
                  : s.done > 0
                    ? <Badge variant="info">{g.duration - s.done} mo left</Badge>
                    : <Badge variant="gray">Not started</Badge>}
              </Td>
              <Td className="hidden xl:table-cell">{s.endDate}</Td>
              <Td className="hidden md:table-cell">
                {s.pending > 0
                  ? <Badge variant="danger">{s.pending} pending</Badge>
                  : <Badge variant="success">All paid</Badge>}
              </Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <Btn size="sm" variant="ghost" icon={Gavel} onClick={() => router.push(`/groups/${g.id}`)}
                    style={{ color: 'var(--info)', border: '1px solid var(--info-dim)' }}>
                    View
                  </Btn>
                  {showArchBtn && can('archiveGroup') && (
                    <Btn size="sm" variant="ghost" onClick={() => archive(g.id)}
                      style={{ color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
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
    <div className="space-y-6">
      {/* Active */}
      <TableCard title={
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-[var(--text)]">{t('active_groups')}</h1>
          <div className="flex gap-2">
            {isOwner && <Btn variant="secondary" size="sm" onClick={handleExport} icon={FileSpreadsheet} title={t('export_people')}>CSV</Btn>}
            {can('createGroup') && <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)} icon={Plus}>{t('new_group')}</Btn>}
          </div>
        </div>
      }>
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
          actions={<Btn size="sm" onClick={archiveAll} style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
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
              : <div className="p-3"><GroupTable list={archived} showArchBtn={false} /></div>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Create Chit Group">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Group Name"><input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. SEP2026-A" /></Field>
          <Field label="Total Chit Value (₹)"><input className={inputClass} style={inputStyle} value={form.chit_value} type="number" onChange={e => setForm(f => ({ ...f, chit_value: e.target.value }))} placeholder="100000" /></Field>
          <Field label="Auction Scheme">
            <select className={inputClass} style={inputStyle} value={form.auction_scheme} onChange={e => setForm(f => ({ ...f, auction_scheme: e.target.value as any }))}>
              <option value="ACCUMULATION">SURPLUS MODEL (Fixed Payout)</option>
              <option value="DIVIDEND">DIVIDEND MODEL (Coming Soon)</option>
            </select>
          </Field>
          <Field label="Total Members"><input className={inputClass} style={inputStyle} value={form.num_members} type="number" onChange={e => setForm(f => ({ ...f, num_members: e.target.value }))} placeholder="20" /></Field>
          <Field label="Duration (Months)"><input className={inputClass} style={inputStyle} value={form.duration} type="number" onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="20" /></Field>
          <Field label="Monthly Installment (₹)"><input className={inputClass} style={inputStyle} value={form.monthly_contribution} type="number" onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))} placeholder="5000" /></Field>
          <Field label="Start Date"><input className={inputClass} style={inputStyle} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></Field>
        </div>
        <div className="flex justify-end gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleSave}>Create Group</Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
