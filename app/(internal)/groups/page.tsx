'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, getGroupDisplayName, getToday, cn } from '@/lib/utils'
import { haptics } from '@/lib/utils/haptics'
import {
  Btn, Badge, TableCard, Table, Th, Td, Tr,
  Modal, Field, Loading, Empty, Toast, ProgressBar, Card, StatCard
} from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { logActivity } from '@/lib/utils/logger'
import { downloadCSV } from '@/lib/utils/csv'
import { ChevronDown, ChevronRight, Plus, Archive, RotateCcw, Trash2, Settings2, Gavel, FileSpreadsheet, Info, AlertTriangle, Activity, TrendingUp, CheckCircle2, Users } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Group, Auction, Payment, Firm } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { CascadeDeleteModal } from '@/components/features/CascadeDeleteModal'

const initialFormState = {
  name: '', chit_value: '', num_members: '', duration: '',
  monthly_contribution: '', start_date: getToday(),
  auction_scheme: 'ACCUMULATION' as any,
  min_bid_pct: '5', max_bid_pct: '40',
  commission_type: 'percent_of_chit', commission_value: '5',
  dividend_strategy: 'pro_n',
  commission_recipient: 'foreman',
  dividend_rule: 'equal_split',
  discount_cap_pct: '40',
  dividend_split_pct: '50',
  surplus_split_pct: '50',
  step_amount: '0'
}

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

  const [form, setForm] = useState(initialFormState)
  const [saving, setSaving] = useState(false)
  const [totalGroupCount, setTotalGroupCount] = useState(0)

  const [delModal, setDelModal] = useState<{ open: boolean, id: number | null, name: string }>({ open: false, id: null, name: '' })

  const [groupSummaries, setGroupSummaries] = useState<any[]>([])

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return

    try {
      const [g, summaries, totalG] = await Promise.all([
        withFirmScope(supabase.from('groups').select('id, name, chit_value, num_members, duration, monthly_contribution, start_date, status, auction_scheme, firms(name)').neq('status', 'archived'), targetId).is('deleted_at', null).order('id'),
        supabase.rpc('get_firm_group_summaries', { p_firm_id: targetId }),
        withFirmScope(supabase.from('groups').select('id', { count: 'exact', head: true }), targetId).is('deleted_at', null)
      ])
      
      setGroups((g.data as any) || [])
      setGroupSummaries(summaries.data || [])
      setTotalGroupCount(totalG.count || 0)

      if (isSuper && firms.length === 0) {
        const { data: f } = await supabase.from('firms').select('id, name').order('name')
        setFirms(f || [])
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, isSuper, switchedFirmId, firm?.id])

  useEffect(() => { load(true) }, [load])

  useEffect(() => {
    if (firm?.enabled_schemes?.length === 1) {
      setForm(f => ({ ...f, auction_scheme: firm.enabled_schemes[0] as any }))
    }
  }, [firm?.enabled_schemes])

  const groupStats = useCallback((g: Group) => {
    const summary = groupSummaries?.find(s => s.id === g.id) || { auctions_done: 0, payments_made: 0 }
    const done = Number(summary.auctions_done)
    const paid = Number(summary.payments_made)
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
  }, [groupSummaries])

  const active = useMemo(() => {
    return groups.filter(g => { const s = groupStats(g); return !s.isComplete })
  }, [groups, groupStats])

  const completed = useMemo(() => {
    return groups.filter(g => { const s = groupStats(g); return s.isComplete })
  }, [groups, groupStats])


  async function loadArchived() {
    setArchLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    const { data } = await withFirmScope(supabase.from('groups').select('id, name, chit_value, num_members, duration, monthly_contribution, start_date, status, auction_scheme, firms(name)').eq('status', 'archived'), targetId).is('deleted_at', null).order('id')
    setArchived(data || [])
    setArchLoading(false)
  }

  async function handleSave() {
    if (!firm) return
    if (!form.name || !form.chit_value || !form.start_date) {
      showToast('Group name, value and start date are required.', 'error')
      return
    }

    // Standard 5% cap for foreman commission
    const commVal = +form.commission_value || 0
    if (form.commission_type === 'percent_of_chit' && commVal > 5) {
      showToast('Foreman commission cannot exceed 5% of the chit value', 'error')
      return
    }
    if (form.commission_type === 'fixed_amount' && form.chit_value && commVal > (+form.chit_value * 0.05)) {
      showToast('Foreman commission cannot exceed 5% of the chit value (' + fmt(+form.chit_value * 0.05) + ')', 'error')
      return
    }

    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('groups').insert({
      name: form.name,
      chit_value: +form.chit_value,
      num_members: +form.num_members,
      duration: +form.duration,
      monthly_contribution: +form.monthly_contribution,
      start_date: form.start_date,
      status: 'active',
      firm_id: firm.id,
      auction_scheme: form.auction_scheme,
      accumulated_surplus: 0,
      created_by: userData.user?.id,
      min_bid_pct: (+form.min_bid_pct || 5) / 100,
      max_bid_pct: (+form.max_bid_pct || 40) / 100,
      commission_type: form.commission_type,
      commission_value: +form.commission_value,
      dividend_strategy: form.dividend_strategy,
      commission_recipient: form.commission_recipient,
      dividend_rule: form.dividend_rule,
      discount_cap_pct: (+form.discount_cap_pct || 40) / 100,
      dividend_split_pct: (+form.dividend_split_pct || 50) / 100,
      surplus_split_pct: (+form.surplus_split_pct || 50) / 100,
      step_amount: +form.step_amount || 0
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
        'First Auction Date': fmtDate(g.start_date),
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
    haptics.heavy()
    const { error } = await supabase.from('groups').update({ status: 'archived' }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else { showToast('Group archived'); load() }
  }

  async function archiveAll() {
    if (!confirm(`Archive all ${completed.length} completed groups?`)) return
    haptics.heavy()
    const ids = completed.map(g => g.id)
    const { error } = await supabase.from('groups').update({ status: 'archived' }).in('id', ids)
    if (error) showToast(error.message, 'error')
    else { showToast('Groups archived'); load() }
  }

  async function del(id: number) {
    if (!can('deleteGroup')) return
    const g = groups.find(x => x.id === id) || archived.find(x => x.id === id)
    setDelModal({ open: true, id, name: g?.name || 'this group' })
  }

  async function confirmDelete() {
    const id = delModal.id
    if (!id) return
    setSaving(true)
    const { error } = await supabase.from('groups').update({ deleted_at: new Date() }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Group moved to trash!');
      if (firm) {
        await logActivity(firm.id, 'GROUP_ARCHIVED', 'group', id, { id });
      }
      load()
      setDelModal({ open: false, id: null, name: '' })
    }
    setSaving(false)
  }

  const GroupTable = ({ list, showArchBtn }: { list: Group[], showArchBtn: boolean }) => (
    <Table responsive>
      <thead>
        <Tr className="bg-[var(--surface2)]/30">
          {isSuper && <Th className="text-[11px] font-bold py-2 px-3">{t('firm')}</Th>}
          <Th className="text-[11px] font-bold py-2">{t('group')}</Th>
          <Th right className="text-[11px] font-bold">{t('value')}</Th>
          <Th className="hidden sm:table-cell text-[11px] font-bold">{t('members')}</Th>
          <Th right className="hidden md:table-cell text-[11px] font-bold">{t('monthly')}</Th>
          <Th className="text-[11px] font-bold">{t('progress')}</Th>
          <Th className="hidden lg:table-cell text-[11px] font-bold">{t('status')}</Th>
          <Th className="hidden xl:table-cell text-[11px] font-bold">{t('ends')}</Th>
          <Th className="hidden md:table-cell text-[11px] font-bold">{t('pending')}</Th>
          <Th right className="text-[11px] font-bold px-3">{t('action')}</Th>
        </Tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {list.map((g, idx) => {
          const s = groupStats(g)
          return (
            <Tr key={g.id} className="hover:bg-[var(--surface2)]/50 group/row transition-colors">
              {isSuper && <Td label="Firm" className="px-3"><Badge variant="gray" className="text-[10px] font-bold">{g.firms?.name}</Badge></Td>}
              <Td label="Group">
                <div className="flex flex-col">
                  <Link href={`/groups/${g.id}`} className="font-bold text-sm text-[var(--text)] hover:text-[var(--accent)] transition-colors" id={idx === 0 ? "tour-group-card" : undefined}>
                    {getGroupDisplayName(g, t)}
                  </Link>
                  <span className="text-[10px] font-medium text-[var(--text3)] opacity-60">{g.auction_scheme?.replace('_', ' ')}</span>
                </div>
              </Td>
              <Td label="Chit Value" right>
                <div className="font-bold text-sm text-[var(--text)] font-mono">{fmt(g.chit_value)}</div>
              </Td>
              <Td label="Members" className="hidden sm:table-cell">
                <div className="flex items-center gap-1.5 font-bold text-xs">
                  <Users size={12} className="text-[var(--text3)]" />
                  {g.num_members}
                </div>
              </Td>
              <Td label="Monthly" right className="hidden md:table-cell">
                <div className="font-bold text-xs text-[var(--text3)]">{fmt(g.monthly_contribution)}</div>
              </Td>
              <Td label="Progress">
                <div className="flex items-center gap-3">
                  <div className="hidden md:block w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-[10px] font-black tracking-tighter" style={{ color: 'var(--text2)' }}>{s.done}/{g.duration}</span>
                </div>
              </Td>
              <Td label="Status" className="hidden lg:table-cell">
                {s.pct >= 100
                  ? <Badge variant="success" className="text-[10px] font-bold">{t('completed')}</Badge>
                  : s.done > 0
                    ? <Badge variant="info" className="text-[10px] font-bold">{g.duration - s.done} {t('mo_left')}</Badge>
                    : <Badge variant="gray" className="text-[10px] font-bold">{t('not_started')}</Badge>}
              </Td>
              <Td label="Ends" className="hidden xl:table-cell text-xs font-medium text-[var(--text3)] opacity-60">{s.endDate}</Td>
              <Td label="Pending" className="hidden md:table-cell">
                {s.pending > 0
                  ? <Badge variant="danger" className="text-[10px] font-bold">{s.pending} {t('pending')}</Badge>
                  : <Badge variant="success" className="text-[10px] font-bold">{t('all_paid')}</Badge>}
              </Td>
              <Td label="Action" right className="px-3">
                <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                  <Btn size="sm" variant="secondary" className="h-7 w-7 p-0 rounded-lg" onClick={() => router.push(`/groups/${g.id}`)}>
                    <ChevronRight size={14} />
                  </Btn>
                  {showArchBtn && can('archiveGroup') && (
                    <Btn size="sm" variant="secondary" className="h-7 w-7 p-0 rounded-lg text-[var(--accent)]" onClick={() => archive(g.id)}>
                      <Archive size={14} />
                    </Btn>
                  )}
                  {can('deleteGroup') && (
                    <Btn size="sm" variant="danger" className="h-7 w-7 p-0 rounded-lg" onClick={() => del(g.id)}>
                      <Trash2 size={14} />
                    </Btn>
                  )}
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
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] tracking-tighter leading-none">{t('active_groups')}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="accent" className="py-0.5 px-2 text-[10px] font-bold">
              {active.length} {t('active_groups')}
            </Badge>
            <span className="text-[11px] font-medium text-[var(--text3)]">
              {totalGroupCount} Total Registered
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && <Btn variant="secondary" size="sm" className="text-xs font-bold" onClick={handleExport} icon={FileSpreadsheet}>Export CSV</Btn>}
          {can('createGroup') && <Btn variant="primary" size="sm" className="text-xs font-bold px-4" onClick={() => setAddOpen(true)} icon={Plus} id="tour-group-add">{t('new_group')}</Btn>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Portfolio" value={active.length} icon={Activity} sub="Ongoing Auctions" color="accent" compact />
        <StatCard label="Total Value" value={fmt(active.reduce((s, g) => s + g.chit_value, 0))} icon={TrendingUp} sub="Cumulative Chit Value" color="success" compact />
        <StatCard label="Registry Capacity" value={active.reduce((s, g) => s + g.num_members, 0)} icon={Users} sub="Total Member Slots" color="info" compact />
        <StatCard label="Ready to Archive" value={completed.length} icon={CheckCircle2} sub="Term Completed" color="warning" compact />
      </div>

      {/* Active */}
      <TableCard title={
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold text-[var(--text2)] opacity-40">{t('active_groups')}</div>
          <div className="text-[11px] font-bold text-[var(--text2)] opacity-40">Live Registry</div>
        </div>
      }>
        <div id="tour-group-list">
          {active.length === 0
            ? <Empty icon="🏦" text={t('no_active_groups')} action={
              <Btn variant="primary" onClick={() => setAddOpen(true)}>+ {t('new_group')}</Btn>
            } />
            : <GroupTable list={active} showArchBtn={false} />}
        </div>
      </TableCard>

      {/* Completed */}
      {completed.length > 0 && (
        <TableCard 
          title={
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[var(--success)]" />
              <div className="text-[10px] font-black tracking-wider">{t('groups_ready_arch')}</div>
            </div>
          }
          subtitle={t('groups_ready_arch_desc')}
          actions={
            <Btn size="sm" variant="secondary" className="text-[9px] font-black tracking-wider bg-[var(--accent-dim)] text-[var(--accent)] border-none hover:bg-[var(--accent)] hover:text-white" onClick={archiveAll}>
              <Archive size={12} className="mr-1.5" /> {t('archive_all')}
            </Btn>
          }
        >
          <GroupTable list={completed} showArchBtn={true} />
        </TableCard>
      )}

      {/* Archived — on demand */}
      <Card className="overflow-hidden border-[var(--border)] shadow-sm bg-[var(--surface)]">
        <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--surface2)]/50 transition-colors"
          onClick={() => {
            if (!showArch) { setShowArch(true); loadArchived() }
            else setShowArch(false)
          }}>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
              <Archive size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-wider text-[var(--text)]">{t('archived_groups_label')}</div>
              <div className="text-[10px] font-bold mt-0.5 text-[var(--text3)] tracking-wider opacity-60">{t('archived_click_load')}</div>
            </div>
          </div>
          <div className="text-[var(--text3)]">
            {showArch ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>
        </button>
        {showArch && (
          <div className="border-t border-[var(--border)]">
            {archLoading ? <Loading text={t('arch_loading')} /> :
              archived.length === 0
                ? <Empty icon="📦" text={t('archived_no_groups')} />
                : <div className="p-0"><GroupTable list={archived} showArchBtn={false} /></div>}
          </div>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('groups_create_title')}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t('group_name')}><input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. SEP2026-A" /></Field>
          <Field label={`${t('chit_value')} (₹)`}><input className={inputClass} style={inputStyle} value={form.chit_value} type="number" onChange={e => setForm(f => ({ ...f, chit_value: e.target.value }))} placeholder="100000" /></Field>
          {(!firm?.enabled_schemes || firm.enabled_schemes.length > 1) && (
            <Field label={t('scheme')}>
              <select className={inputClass} style={inputStyle} value={form.auction_scheme} onChange={e => setForm(f => ({ ...f, auction_scheme: e.target.value as any }))}>
                {[
                  { id: 'ACCUMULATION', label: 'Surplus Model (Accumulation)' },
                  { id: 'BOUNDED_AUCTION', label: 'Bounded Auction' },
                  { id: 'DIVIDEND_SHARE', label: 'Dividend Model (Conventional)' },
                  { id: 'FIXED_ROTATION', label: 'Fixed Rotation' },
                  { id: 'HYBRID_SPLIT', label: 'Hybrid Split' },
                  { id: 'LOTTERY', label: 'Lottery Model' },
                  { id: 'SEALED_TENDER', label: 'Sealed Tender' },
                  { id: 'STEPPED_INSTALLMENT', label: 'Stepped Installment' }
                ].map(scheme => {
                  if (firm?.enabled_schemes && !firm.enabled_schemes.includes(scheme.id)) return null;
                  return <option key={scheme.id} value={scheme.id}>{scheme.label}</option>
                })}
              </select>
            </Field>
          )}
          <Field label={t('total_members')}><input className={inputClass} style={inputStyle} value={form.num_members} type="number" onChange={e => setForm(f => ({ ...f, num_members: e.target.value }))} placeholder="20" /></Field>
          <Field label={t('duration_months')}><input className={inputClass} style={inputStyle} value={form.duration} type="number" onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="20" /></Field>
          <Field label={t('monthly_installment')}><input className={inputClass} style={inputStyle} value={form.monthly_contribution} type="number" onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))} placeholder="5000" /></Field>
          <Field label={t('start_date')}><input className={inputClass} style={inputStyle} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required /></Field>

          <div className="col-span-1 md:col-span-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <h3 className="tracking-widest text-[var(--text3)] mb-3 flex items-center gap-2">
              <Gavel size={14} /> {t('rules_comm_header')}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('min_discount')}>
                <input className={inputClass} style={inputStyle} type="number" value={form.min_bid_pct} onChange={e => setForm(f => ({ ...f, min_bid_pct: e.target.value }))} placeholder="5" />
              </Field>
              <Field label={t('max_discount')}>
                <input className={inputClass} style={inputStyle} type="number" value={form.max_bid_pct} onChange={e => setForm(f => ({ ...f, max_bid_pct: e.target.value }))} placeholder="40" />
              </Field>
              <Field label="Discount Cap (%)">
                <input className={inputClass} style={inputStyle} type="number" value={form.discount_cap_pct} onChange={e => setForm(f => ({ ...f, discount_cap_pct: e.target.value }))} placeholder="40" />
              </Field>
              <Field label={t('commission_type')}>
                <select className={inputClass} style={inputStyle} value={form.commission_type} onChange={e => setForm(f => ({ ...f, commission_type: e.target.value }))}>
                  <option value="percent_of_chit">Percent of Chit Value</option>
                  <option value="percent_of_discount">Percent of Auction Discount</option>
                  <option value="fixed_amount">Fixed Amount</option>
                </select>
                <div className="text-[10px] mt-1.5 opacity-60 font-medium leading-tight">
                  {form.commission_type === 'percent_of_chit' && t('comm_chit_desc')}
                  {form.commission_type === 'percent_of_discount' && t('comm_auction_desc')}
                  {form.commission_type === 'fixed_amount' && t('comm_fixed_desc')}
                </div>
              </Field>
              <Field label={t('commission_val')}>
                <input className={inputClass} style={inputStyle} type="number" value={form.commission_value} onChange={e => setForm(f => ({ ...f, commission_value: e.target.value }))} placeholder="5" />
                <div className="text-[10px] mt-1.5 font-bold text-[var(--accent)] flex items-center gap-1">
                  <Info size={10} />
                  {form.commission_type === 'percent_of_chit' && `Example: ${fmt((+form.chit_value || 0) * (+form.commission_value || 0) / 100)} / month`}
                  {form.commission_type === 'percent_of_discount' && `Example: ₹500 at ₹50,000 bid`}
                  {form.commission_type === 'fixed_amount' && `Flat ₹${form.commission_value || 0} per month`}
                </div>
              </Field>

              <Field label="Recipient">
                <select className={inputClass} style={inputStyle} value={form.commission_recipient} onChange={e => setForm(f => ({ ...f, commission_recipient: e.target.value as any }))}>
                  <option value="foreman">Foreman</option>
                  <option value="firm">Firm</option>
                </select>
              </Field>

              <Field label="Dividend Strategy" className="col-span-2">
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, dividend_strategy: 'standard' }))}
                    className={cn("text-left px-2 py-2 rounded-lg border transition-all", 
                      form.dividend_strategy === 'standard' ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] bg-[var(--surface2)] opacity-70')}>
                    <div className="font-bold text-[10px]">Standard (N)</div>
                    <div className="text-[8px] opacity-60 leading-tight">Comm from Pool<br/>Split by All</div>
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, dividend_strategy: 'pro_n1' }))}
                    className={cn("text-left px-2 py-2 rounded-lg border transition-all", 
                      form.dividend_strategy === 'pro_n1' ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] bg-[var(--surface2)] opacity-70')}>
                    <div className="font-bold text-[10px]">Professional (N-1)</div>
                    <div className="text-[8px] opacity-60 leading-tight">Comm from Winner<br/>Split by Non-Winners</div>
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, dividend_strategy: 'pro_n' }))}
                    className={cn("text-left px-2 py-2 rounded-lg border transition-all", 
                      form.dividend_strategy === 'pro_n' ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] bg-[var(--surface2)] opacity-70')}>
                    <div className="font-bold text-[10px]">Winner Pays (N)</div>
                    <div className="text-[8px] opacity-60 leading-tight">Comm from Winner<br/>Split by All</div>
                  </button>
                </div>
              </Field>


              {form.auction_scheme === 'HYBRID_SPLIT' && (
                <>
                  <Field label="Dividend Share (%)">
                    <input className={inputClass} style={inputStyle} type="number" value={form.dividend_split_pct} 
                      onChange={e => setForm(f => ({ ...f, dividend_split_pct: e.target.value, surplus_split_pct: String(100 - +e.target.value) }))} />
                  </Field>
                  <Field label="Surplus Share (%)">
                    <input className={inputClass} style={inputStyle} type="number" value={form.surplus_split_pct} 
                      onChange={e => setForm(f => ({ ...f, surplus_split_pct: e.target.value, dividend_split_pct: String(100 - +e.target.value) }))} />
                  </Field>
                </>
              )}

              {form.auction_scheme === 'STEPPED_INSTALLMENT' && (
                <Field label="Monthly Step Amount (₹)" className="col-span-2">
                  <input className={inputClass} style={inputStyle} type="number" value={form.step_amount} 
                    onChange={e => setForm(f => ({ ...f, step_amount: e.target.value }))} placeholder="e.g. 100" />
                </Field>
              )}
            </div>
            <p className="text-[10px] opacity-40 mt-4 italic">
              * The &quot;Min Discount&quot; is usually your commission rate (e.g., 5%).
              The winner must sacrifice at least this amount to the group.
            </p>
          </div>
        </div>
        <div className="flex justify-between items-center mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <button type="button" onClick={() => setForm({...initialFormState, start_date: getToday()})} className="text-xs font-bold text-[var(--text3)] hover:text-[var(--text)] transition-colors flex items-center gap-1.5 px-2 py-1">
            <RotateCcw size={12} /> Reset to Defaults
          </button>
          <div className="flex gap-3">
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>{t('cancel')}</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSave}>{t('create_group')}</Btn>
          </div>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}

      <CascadeDeleteModal 
        open={delModal.open}
        onClose={() => setDelModal({ open: false, id: null, name: '' })}
        onConfirm={confirmDelete}
        title={`Move "${delModal.name}" to Trash?`}
        targetId={delModal.id || ''}
        targetType="group"
        loading={saving}
      />
    </div>
  )
}
