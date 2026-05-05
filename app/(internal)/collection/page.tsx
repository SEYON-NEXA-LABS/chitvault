'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { fmt, cn, getGroupDisplayName, fmtDate } from '@/lib/utils'
import { Loading, Empty, Badge, Btn, Modal, Toast, Pagination } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import {
  Printer, Search, History, LayoutGrid, Trash2,
  ChevronDown, CreditCard, MessageSquare, AlertCircle,
  TrendingUp, UsersRound, Phone
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { withFirmScope } from '@/lib/supabase/firmQuery'

import { RecordCollectionModal } from '@/components/features/RecordCollectionModal'

const ITEMS_PER_PAGE = 20

interface CollectionItem {
  person_id: number
  person_name: string
  person_phone: string
  total_balance: number
  overdue_count: number
  is_overdue: boolean
  memberships: any[]
  total_count: number
}

export default function CollectionPage() {
  return <Suspense fallback={<Loading />}><CollectionContent /></Suspense>
}

function CollectionContent() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, switchedFirmId } = useFirm()
  const searchParams = useSearchParams()
  const { t } = useI18n()
  const { toast, show, hide } = useToast()

  const [data, setData] = useState<CollectionItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [selectedGroupId, setSelectedGroupId] = useState(searchParams.get('group_id') || '')
  const [groups, setGroups] = useState<any[]>([])
  const [showAll, setShowAll] = useState(false)
  const [viewMode, setViewMode] = useState<'workspace' | 'audit'>('workspace')
  const [auditData, setAuditData] = useState<any[]>([])
  const [historyModal, setHistoryModal] = useState<CollectionItem | null>(null)
  const [payModal, setPayModal] = useState<CollectionItem | null>(null)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const isSuper = role === 'superadmin'
  const isOwner = role === 'owner' || isSuper

  useEffect(() => {
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return
    supabase.from('groups').select('id, name, slug').eq('firm_id', targetId).order('name')
      .then(({ data }: any) => setGroups(data || []))
  }, [supabase, firm, isSuper, switchedFirmId])

  const load = useCallback(async () => {
    const targetId = isSuper ? switchedFirmId : firm?.id
    setLoading(true)
    try {
      if (viewMode === 'workspace') {
        const { data: rpcData, error } = await supabase.rpc('get_collection_workspace', {
          p_firm_id: targetId || null,
          p_search: search || '',
          p_group_id: selectedGroupId ? Number(selectedGroupId) : null,
          p_limit: ITEMS_PER_PAGE,
          p_offset: (page - 1) * ITEMS_PER_PAGE
        })
        if (error) { show(error.message, 'error'); return }
        let finalData = rpcData || []
        if (!showAll) finalData = finalData.filter((x: any) => x.total_balance > 0.1)
        setData(finalData)
        setTotalCount(rpcData?.[0]?.total_count || 0)
      } else {
        let q = withFirmScope(supabase.from('payments').select(`
          id, amount, payment_date, created_at, mode, month, group_id,
          groups:group_id(id, name), members:member_id(persons:person_id(name))
        `, { count: 'exact' }), targetId).is('deleted_at', null)
        if (selectedGroupId) q = q.eq('group_id', selectedGroupId)
        if (dateRange.start) q = q.gte('payment_date', dateRange.start)
        if (dateRange.end) q = q.lte('payment_date', dateRange.end)
        const { data: lData, count } = await q.order('created_at', { ascending: false })
          .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)
        setAuditData(lData || [])
        setTotalCount(count || 0)
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, isSuper, switchedFirmId, firm, search, page, show, viewMode, selectedGroupId, dateRange, showAll])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  async function revertPayment(id: number) {
    if (!confirm('Revert this payment?')) return
    const { error } = await supabase.from('payments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) show(error.message, 'error')
    else { show('Reverted!', 'success'); load() }
  }

  const stats = useMemo(() => ({
    totalOut: data.reduce((s, x) => s + Number(x.total_balance), 0),
    critical: data.filter(x => x.overdue_count >= 3).length,
  }), [data])

  return (
    <div className="space-y-8 pb-24">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-5">
        {[
          { label: 'Total Outstanding', value: fmt(stats.totalOut), icon: TrendingUp, bg: 'bg-blue-600' },
          { label: 'Registry Size', value: totalCount, icon: UsersRound, bg: 'bg-violet-600' },
          { label: 'Critical Dues', value: stats.critical, icon: AlertCircle, bg: 'bg-rose-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{s.label}</p>
              <p className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{s.value}</p>
            </div>
            <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg', s.bg)}>
              <s.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-center no-print">
        <div className="flex p-1 bg-slate-100 rounded-2xl">
          {(['workspace', 'audit'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={cn('px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all',
                viewMode === v ? 'bg-white shadow text-slate-900' : 'text-slate-400 hover:text-slate-700')}>
              {v === 'workspace' ? <><LayoutGrid size={12} className="inline mr-1.5" />Workspace</> : <><History size={12} className="inline mr-1.5" />Audit</>}
            </button>
          ))}
        </div>

        <div className="flex-1 relative min-w-[200px]">
          <input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-blue-500 transition-all"
            placeholder="Search by name, phone..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
        </div>

        <select className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-blue-500"
          value={selectedGroupId} onChange={e => { setSelectedGroupId(e.target.value); setPage(1) }}>
          <option value="">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        {viewMode === 'workspace' && (
          <button onClick={() => setShowAll(!showAll)}
            className={cn('px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all',
              showAll ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-400')}>
            {showAll ? 'All Members' : 'Dues Only'}
          </button>
        )}

        {viewMode === 'audit' && (
          <div className="flex gap-2">
            <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
              value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
            <input type="date" className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none"
              value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
          </div>
        )}

        <Btn variant="secondary" icon={Printer} onClick={() => window.print()} className="rounded-2xl hidden sm:flex">Print</Btn>
      </div>

      {/* Content */}
      {loading ? <Loading /> : viewMode === 'audit' ? (
        <AuditTable data={auditData} isOwner={isOwner} onRevert={revertPayment} />
      ) : (
        <div className="space-y-3">
          {data.length === 0
            ? <Empty text="No pending dues found." />
            : data.map(person => (
                <MemberAccordion
                  key={person.person_id}
                  person={person}
                  t={t}
                  onCollect={() => setPayModal(person)}
                  onHistory={() => setHistoryModal(person)}
                  onWhatsApp={() => {
                    const phone = person.person_phone?.replace(/[^\d]/g, '')
                    if (!phone) return show('No phone recorded.', 'error')
                    const msg = `Hi ${person.person_name}, you have ₹${person.total_balance.toLocaleString('en-IN')} outstanding with ${firm?.name}.`
                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                  }}
                />
              ))
          }
        </div>
      )}

      <div className="flex justify-center">
        <Pagination current={page} total={totalCount} pageSize={ITEMS_PER_PAGE} onPageChange={setPage} />
      </div>

      {payModal && (
        <RecordCollectionModal personId={payModal.person_id} initialData={payModal}
          onClose={() => setPayModal(null)} onSuccess={load} />
      )}
      {historyModal && (
        <DuesSnapshotModal person={historyModal} onClose={() => setHistoryModal(null)} t={t} />
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}

// ── Member Accordion Card ────────────────────────────────────────────────────

function MemberAccordion({ person, t, onCollect, onHistory, onWhatsApp }: {
  person: CollectionItem, t: any,
  onCollect: () => void, onHistory: () => void, onWhatsApp: () => void
}) {
  const [open, setOpen] = useState(false)

  const allDues = person.memberships.flatMap(m => m.dues || [])
  const pendingDues = allDues.filter(d => (d.amount_due - d.amount_paid) > 0.1)
  const earliestMonth = pendingDues.length > 0 ? Math.min(...pendingDues.map(d => d.month)) : null

  return (
    <div className={cn(
      'bg-white border rounded-3xl overflow-hidden transition-all duration-200',
      open ? 'border-blue-200 shadow-xl shadow-blue-500/5' : 'border-slate-100 shadow-sm hover:border-slate-200 hover:shadow-md'
    )}>
      {/* Member Header Row */}
      <div
        className="flex items-center gap-4 px-6 py-5 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        {/* Expand toggle */}
        <div className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all',
          open ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'
        )}>
          <ChevronDown size={16} className={cn('transition-transform duration-300', open && 'rotate-180')} />
        </div>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-blue-500/20">
          {person.person_name.charAt(0).toUpperCase()}
        </div>

        {/* Name + phone */}
        <div className="flex-1 min-w-0">
          <div className="font-black text-slate-900 uppercase tracking-tight truncate flex items-center gap-3">
            {person.person_name}
            {person.overdue_count >= 3 && (
              <span className="text-[9px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Critical</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Phone size={11} className="text-slate-300" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {person.person_phone || 'No phone recorded'}
            </span>
          </div>
        </div>

        {/* Pending since */}
        {earliestMonth && (
          <div className="hidden sm:flex flex-col items-center px-4 border-l border-slate-100">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Since</span>
            <span className="text-lg font-black text-rose-500 tracking-tighter">M{earliestMonth}</span>
          </div>
        )}

        {/* Groups count */}
        <div className="hidden sm:flex flex-col items-center px-4 border-l border-slate-100">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Groups</span>
          <span className="text-lg font-black text-slate-900">{person.memberships.length}</span>
        </div>

        {/* Total outstanding */}
        <div className="flex flex-col items-end px-4 border-l border-slate-100">
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Outstanding</span>
          <span className={cn('text-xl font-black tracking-tighter', person.is_overdue ? 'text-rose-600' : 'text-blue-600')}>
            {fmt(person.total_balance)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pl-4 border-l border-slate-100 shrink-0" onClick={e => e.stopPropagation()}>
          <button onClick={onHistory} className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 transition-all">
            <History size={16} />
          </button>
          <button onClick={onWhatsApp} className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-emerald-50 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-all">
            <MessageSquare size={16} />
          </button>
          <button onClick={onCollect} className="h-9 px-5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20">
            <CreditCard size={14} /> Collect
          </button>
        </div>
      </div>

      {/* Expanded: Group Panels */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          {person.memberships.map((m: any) => (
            <GroupPanel key={m.member.id} membership={m} t={t} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Group Panel with Month Timeline ─────────────────────────────────────────

function GroupPanel({ membership: m, t }: { membership: any, t: any }) {
  const dues = m.dues || []
  const groupBalance = dues.reduce((s: number, d: any) => s + (d.amount_due - d.amount_paid), 0)
  const pendingDues = dues.filter((d: any) => (d.amount_due - d.amount_paid) > 0.1)
  const earliestMonth = pendingDues.length > 0 ? Math.min(...pendingDues.map((d: any) => d.month)) : null

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-4">
      {/* Group Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{getGroupDisplayName(m.group, t)}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {m.group?.slug}
            {earliestMonth && <span className="ml-2 text-rose-500">· Pending since M{earliestMonth}</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Group Balance</p>
          <p className={cn('text-lg font-black tracking-tighter', groupBalance > 0 ? 'text-rose-600' : 'text-emerald-600')}>
            {groupBalance > 0 ? fmt(groupBalance) : '✓ Cleared'}
          </p>
        </div>
      </div>

      {/* Month Timeline Chips */}
      <div className="flex flex-wrap gap-2">
        {dues.map((d: any) => {
          const balance = d.amount_due - d.amount_paid
          const isPaid = balance <= 0.1
          const isPartial = !isPaid && d.amount_paid > 0

          return (
            <div
              key={d.month}
              title={`Month ${d.month} · Due: ${fmt(d.amount_due)} · Paid: ${fmt(d.amount_paid)} · Balance: ${fmt(balance)}`}
              className={cn(
                'flex flex-col items-center px-3 py-2 rounded-xl border-2 transition-all min-w-[64px] cursor-default',
                isPaid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : isPartial
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              )}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">M{d.month}</span>
              <span className="text-sm font-black tracking-tighter mt-0.5">
                {isPaid ? '✓' : fmt(balance)}
              </span>
              {isPartial && <span className="text-[8px] font-black uppercase tracking-widest opacity-60">Partial</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Dues Snapshot Modal ───────────────────────────────────────────────────────
// Lightweight alternative to full MemberLedger — reads from already-loaded data

function DuesSnapshotModal({ person, onClose, t }: { person: CollectionItem; onClose: () => void; t: any }) {
  const allDues = person.memberships.flatMap((m: any) =>
    (m.dues || []).map((d: any) => ({
      ...d,
      groupName: m.group?.name || '—',
      groupSlug: m.group?.slug || '',
    }))
  )
  const totalDue = allDues.reduce((s: number, d: any) => s + (d.amount_due - d.amount_paid), 0)
  const paidCount = allDues.filter((d: any) => (d.amount_due - d.amount_paid) <= 0.1).length

  return (
    <Modal open={true} onClose={onClose} title={`Dues — ${person.person_name}`} size="md">
      <div className="space-y-5">
        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Outstanding', value: fmt(person.total_balance), color: 'text-rose-600' },
            { label: 'Pending', value: `${allDues.length - paidCount} months`, color: 'text-amber-600' },
            { label: 'Groups', value: person.memberships.length, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className={cn('text-xl font-black tracking-tighter mt-1', s.color)}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Per-group breakdown */}
        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {person.memberships.map((m: any) => {
            const dues: any[] = m.dues || []
            const groupBal = dues.reduce((s: number, d: any) => s + (d.amount_due - d.amount_paid), 0)
            const pendingDues = dues.filter((d: any) => (d.amount_due - d.amount_paid) > 0.1)

            return (
              <div key={m.member?.id} className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{m.group?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{m.group?.slug}</p>
                  </div>
                  <p className={cn('text-base font-black tracking-tighter', groupBal > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {groupBal > 0 ? fmt(groupBal) : '✓ Clear'}
                  </p>
                </div>

                {pendingDues.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {pendingDues.map((d: any) => {
                      const bal = d.amount_due - d.amount_paid
                      const isPartial = d.amount_paid > 0
                      return (
                        <div key={d.month}
                          className={cn(
                            'flex flex-col items-center px-2.5 py-1.5 rounded-xl border text-center min-w-[52px]',
                            isPartial ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                          )}>
                          <span className="text-[9px] font-black uppercase tracking-wider">M{d.month}</span>
                          <span className="text-xs font-black mt-0.5">{fmt(bal)}</span>
                          {isPartial && <span className="text-[7px] font-black uppercase opacity-60">Partial</span>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">All months settled ✓</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}

// ── Audit Table ──────────────────────────────────────────────────────────────

function AuditTable({ data, isOwner, onRevert }: { data: any[], isOwner: boolean, onRevert: (id: number) => void }) {
  if (data.length === 0) return <Empty text="No payments in this period." />
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-900 text-slate-400">
            {['Date', 'Member', 'Group · Month', 'Amount', 'Mode', ''].map(h => (
              <th key={h} className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-[0.25em]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map(p => (
            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 text-[11px] font-bold text-slate-500 whitespace-nowrap">{fmtDate(p.payment_date)}</td>
              <td className="px-6 py-4 font-black text-slate-900 uppercase italic tracking-tight text-sm">
                {p.members?.persons?.name || 'Unknown'}
              </td>
              <td className="px-6 py-4 text-xs font-bold text-blue-600 uppercase">{p.groups?.name} · M{p.month}</td>
              <td className="px-6 py-4 font-black text-emerald-600 text-lg tracking-tighter">+{fmt(p.amount)}</td>
              <td className="px-6 py-4">
                <span className="bg-slate-100 text-slate-600 text-[10px] font-black uppercase px-2 py-1 rounded-lg">{p.mode}</span>
              </td>
              <td className="px-6 py-4 text-right">
                {isOwner && (
                  <button onClick={() => onRevert(p.id)}
                    className="w-8 h-8 rounded-lg hover:bg-rose-50 hover:text-rose-600 text-slate-300 flex items-center justify-center transition-all ml-auto">
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
