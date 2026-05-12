'use client'

import React, { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { fmt, cn, getGroupDisplayName, fmtDate } from '@/lib/utils'
import { Loading, Empty, Badge, Btn, Modal, Toast, Pagination, Table, TableCard, Th, Td, Tr, Tabs } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import {
  Search, UsersRound, TrendingUp, AlertCircle, Printer, MessageCircle, Wallet, History, ChevronDown, LayoutGrid,
  Phone, MessageSquare, CreditCard, Trash2
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { withFirmScope } from '@/lib/supabase/firmQuery'

import { RecordCollectionModal } from '@/components/features/RecordCollectionModal'
import { printPaymentReceipt, printCollectionsReport } from '@/lib/utils/print'

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
        
        setGroups(prev => {
          const seen = new Set(prev.map((g: any) => g.id))
          const merged = [...prev]
          finalData.forEach((person: any) => {
            ;(person.memberships || []).forEach((m: any) => {
              if (m.group?.id && !seen.has(m.group.id)) {
                seen.add(m.group.id)
                merged.push({ id: m.group.id, name: m.group.name, slug: m.group.slug })
              }
            })
          })
          return merged.sort((a: any, b: any) => a.name.localeCompare(b.name))
        })
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
    <div className="space-y-8 pb-24 printable">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4 no-print">
        {[
          { label: 'Total Outstanding', value: fmt(stats.totalOut), icon: TrendingUp, color: 'accent' as const },
          { label: 'Registry Size', value: totalCount, icon: UsersRound, color: 'info' as const },
          { label: 'Critical Dues', value: stats.critical, icon: AlertCircle, color: 'danger' as const },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-[var(--border)] shadow-sm p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold tracking-tight text-[var(--text3)]">{s.label}</p>
              <p className="text-3xl font-black text-[var(--text)] tracking-tighter mt-2">{s.value}</p>
            </div>
            <div className={cn('w-10 h-10 rounded-md flex items-center justify-center border shadow-sm', 
              s.color === 'accent' ? 'bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent)]/10' :
              s.color === 'info' ? 'bg-[var(--info-dim)] text-[var(--info)] border-[var(--info)]/10' :
              'bg-[var(--danger-dim)] text-[var(--danger)] border-[var(--danger)]/10'
            )}>
              <s.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-[var(--border)] shadow-sm p-4 flex flex-wrap gap-4 items-center no-print">
        <Tabs 
          tabs={[
            { id: 'workspace', label: 'Workspace', icon: LayoutGrid },
            { id: 'audit', label: 'Audit', icon: History }
          ]} 
          active={viewMode} 
          onChange={(v: any) => setViewMode(v)} 
        />

        <div className="flex-1 relative min-w-[200px]">
          <input className="w-full pl-10 pr-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-md text-sm outline-none focus:border-[var(--accent)] transition-all font-medium"
            placeholder="Search by name, phone..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }} />
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text3)]" />
        </div>

        <select className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-xs font-bold text-[var(--text2)] outline-none focus:border-[var(--accent)]"
          value={selectedGroupId} onChange={e => { setSelectedGroupId(e.target.value); setPage(page) }}>
          <option value="">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>

        {viewMode === 'workspace' && (
          <button onClick={() => setShowAll(!showAll)}
            className={cn('px-4 py-2 rounded-md text-[10px] font-black tracking-wider border transition-all',
              showAll ? 'bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)]' : 'bg-[var(--surface2)] border-[var(--border)] text-[var(--text3)]')}>
            {showAll ? 'All Members' : 'Dues Only'}
          </button>
        )}

        {viewMode === 'audit' && (
          <div className="flex gap-2">
            <input type="date" className="bg-[var(--surface2)] border border-[var(--border)] rounded-md px-3 py-2 text-xs outline-none"
              value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
            <input type="date" className="bg-[var(--surface2)] border border-[var(--border)] rounded-md px-3 py-2 text-xs outline-none"
              value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
          </div>
        )}

        <Btn variant="secondary" icon={Printer} onClick={() => printCollectionsReport(firm, data, t)} className="hidden sm:flex">Print</Btn>
      </div>

      {/* Content */}
      {loading ? <Loading /> : viewMode === 'audit' ? (
        <div className="no-print">
          <AuditTable data={auditData} isOwner={isOwner} onRevert={revertPayment} firm={firm} t={t} />
        </div>
      ) : (
        <TableCard title="Collection Workspace" subtitle="Manage outstanding dues and record payments">
          <Table>
            <thead>
              <Tr>
                <Th>Subscriber</Th>
                <Th>Groups / Pending Months</Th>
                <Th right>Balance</Th>
                <Th right>Actions</Th>
              </Tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <Tr><Td colSpan={4} className="py-20 text-center"><Empty text="No pending dues found." /></Td></Tr>
              ) : data.map(person => (
                <Tr key={person.person_id}>
                  <Td className="align-top">
                    <div className="font-black text-[var(--text)] tracking-tight">{person.person_name}</div>
                    <div className="text-[var(--text3)] font-bold mt-0.5">{person.person_phone}</div>
                  </Td>
                  <Td className="align-top">
                    <div className="space-y-1.5">
                      {person.memberships.map((m: any) => {
                        const pendingDues = (m.dues || []).filter((d: any) => (d.amount_due - d.amount_paid) > 0.1);
                        const groupBal = pendingDues.reduce((s: number, d: any) => s + (d.amount_due - d.amount_paid), 0);
                        const months = pendingDues.map((d: any) => `M${d.month}`).join(', ');
                        
                        return (
                          <div key={m.member.id} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[var(--text2)] font-black tracking-tight">{m.group?.name}</span>
                              <span className="text-[var(--text3)] font-bold">[{months}]</span>
                            </div>
                            <span className="text-[var(--text3)] font-black">{fmt(groupBal)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Td>
                  <Td right className="align-top">
                    <div className="font-black text-[var(--text)]">{fmt(person.total_balance)}</div>
                  </Td>
                  <Td right className="align-top">
                    <div className="flex justify-end gap-2">
                      <Btn variant="secondary" size="sm" onClick={() => {
                        const phone = person.person_phone?.replace(/[^\d]/g, '')
                        if (!phone) return show('No phone recorded.', 'error')
                        const msg = `Hi ${person.person_name}, you have ₹${person.total_balance.toLocaleString('en-IN')} outstanding with ${firm?.name}.`
                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
                      }} className="h-8 w-8 p-0" icon={MessageCircle} />
                      <Btn variant="secondary" size="sm" onClick={() => setHistoryModal(person)} className="h-8 w-8 p-0" icon={History} />
                      <Btn variant="primary" size="sm" onClick={() => setPayModal(person)} className="h-8 px-4" icon={Wallet}>Collect</Btn>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <Pagination current={page} total={totalCount} pageSize={ITEMS_PER_PAGE} onPageChange={setPage} />
          </div>
        </TableCard>
      )}

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

// ── Audit Table ──────────────────────────────────────────────────────────────

function AuditTable({ data, isOwner, onRevert, firm, t }: { data: any[], isOwner: boolean, onRevert: (id: number) => void, firm: any, t: any }) {
  if (data.length === 0) return <Empty text="No payments in this period." />
  return (
    <TableCard title="Payment Audit" subtitle="Real-time transaction log and receipt management">
      <Table>
        <thead>
          <Tr>
            <Th>Date</Th>
            <Th>Member</Th>
            <Th>Group · Month</Th>
            <Th right>Amount</Th>
            <Th>Mode</Th>
            <Th right>Actions</Th>
          </Tr>
        </thead>
        <tbody>
          {data.map(p => (
            <Tr key={p.id}>
              <Td>
                <div className="font-bold text-[var(--text)]">{fmtDate(p.payment_date)}</div>
                <div className="text-[10px] text-[var(--text3)] mt-0.5">{new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
              </Td>
              <Td className="font-black text-[var(--text)] tracking-tight">
                {p.members?.persons?.name || 'Unknown'}
              </Td>
              <Td className="font-bold text-[var(--accent)]">{p.groups?.name} · M{p.month}</Td>
              <Td right className="font-black text-emerald-600 text-base">+{fmt(p.amount)}</Td>
              <Td>
                <Badge variant="gray">{p.mode}</Badge>
              </Td>
              <Td right>
                <div className="flex justify-end gap-2">
                  <Btn variant="secondary" size="sm" onClick={() => {
                    printPaymentReceipt(firm, p.members?.persons?.name || '...', [p], p.amount, p.payment_date, p.mode, t)
                  }} className="h-8 w-8 p-0" icon={Printer} />
                  {isOwner && (
                    <Btn variant="danger" size="sm" onClick={() => onRevert(p.id)} className="h-8 w-8 p-0" icon={Trash2} />
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}

// ── Dues Snapshot Modal ───────────────────────────────────────────────────────

function DuesSnapshotModal({ person, onClose, t }: { person: CollectionItem; onClose: () => void; t: any }) {
  const allDues = person.memberships.flatMap((m: any) =>
    (m.dues || []).map((d: any) => ({
      ...d,
      groupName: m.group?.name || '—',
      groupSlug: m.group?.slug || '',
    }))
  )
  const paidCount = allDues.filter((d: any) => (d.amount_due - d.amount_paid) <= 0.1).length

  return (
    <Modal open={true} onClose={onClose} title={`Dues — ${person.person_name}`} size="md">
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Outstanding', value: fmt(person.total_balance), color: 'danger' as const },
            { label: 'Pending', value: `${allDues.length - paidCount} months`, color: 'warning' as const },
            { label: 'Groups', value: person.memberships.length, color: 'accent' as const },
          ].map(s => (
            <div key={s.label} className="bg-[var(--surface2)] rounded-lg p-4 text-center border border-[var(--border)]">
              <p className="text-[10px] font-bold tracking-wider text-[var(--text3)]">{s.label}</p>
              <p className="text-xl font-black tracking-tighter mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
          {person.memberships.map((m: any) => {
            const dues: any[] = m.dues || []
            const groupBal = dues.reduce((s: number, d: any) => s + (d.amount_due - d.amount_paid), 0)
            const pendingDues = dues.filter((d: any) => (d.amount_due - d.amount_paid) > 0.1)

            return (
              <div key={m.member?.id} className="bg-[var(--surface2)] rounded-lg border border-[var(--border)] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-[var(--text)] tracking-tight">{m.group?.name}</p>
                    <p className="text-[10px] font-bold text-[var(--text3)] tracking-wider mt-0.5">{m.group?.slug}</p>
                  </div>
                  <p className={cn('text-lg font-black tracking-tighter', groupBal > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {groupBal > 0 ? fmt(groupBal) : '✓ Clear'}
                  </p>
                </div>

                {pendingDues.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pendingDues.map((d: any) => {
                      const bal = d.amount_due - d.amount_paid
                      const isPartial = d.amount_paid > 0
                      return (
                        <div key={d.month}
                          className={cn(
                            'flex flex-col items-center px-3 py-2 rounded-md border text-center min-w-[60px]',
                            isPartial ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                          )}>
                          <span className="text-[9px] font-black tracking-wider">M{d.month}</span>
                          <span className="text-sm font-black mt-0.5">{fmt(bal)}</span>
                          {isPartial && <span className="text-[8px] font-black tracking-wider opacity-60">Partial</span>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] font-bold text-emerald-600 tracking-wider">All months settled ✓</p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
