'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { fmt, getToday, cn, getGroupDisplayName, fmtDate, fmtDateTime } from '@/lib/utils'
import {
  TableCard, Table, Th, Td, Tr,
  Loading, Empty, Badge, Btn, Modal, Field, Toast, Pagination
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Printer, Phone, MapPin, Search, MessageSquare, CreditCard, ChevronLeft, ChevronRight, History, LayoutGrid, ListChecks, Eye, Trash2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { MemberLedger } from '@/components/features/MemberLedger'
import { RecordCollectionModal } from '@/components/features/RecordCollectionModal'

const ITEMS_PER_PAGE = 20
const inputClass = "w-full bg-[var(--surface2)] text-[var(--text)] px-4 py-2.5 rounded-xl border border-[var(--border)] focus:border-[var(--accent)] outline-none transition-all placeholder:opacity-30"
const inputStyle = {}

interface CollectionItem {
  person_id: number;
  person_name: string;
  person_phone: string;
  person_address: string;
  total_balance: number;
  overdue_count: number;
  is_overdue: boolean;
  memberships: any[];
  total_count: number;
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<Loading />}>
       <CollectionContent />
    </Suspense>
  )
}

function CollectionContent() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, switchedFirmId, profile } = useFirm()
  const router = useRouter()
  const searchParams = useSearchParams()
  const personIdParam = searchParams.get('person_id')
  const { t } = useI18n()
  const { toast, show, hide } = useToast()

  const [data, setData] = useState<CollectionItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const isSuper = role === 'superadmin'
  const isOwner = role === 'owner' || isSuper
  const [viewMode, setViewMode] = useState<'workspace' | 'audit'>('workspace')
  const [showAll, setShowAll] = useState(false)
  const [auditData, setAuditData] = useState<any[]>([])
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [historyModal, setHistoryModal] = useState<CollectionItem | null>(null)
  
  const [payModal, setPayModal] = useState<CollectionItem | null>(null)

  const load = useCallback(async (p_search = search, p_page = page) => {
    const targetId = isSuper ? switchedFirmId : firm?.id
    setLoading(true)
    try {
      if (viewMode === 'workspace') {
        const { data: rpcData, error } = await supabase.rpc('get_collection_workspace', {
          p_firm_id: targetId,
          p_search: p_search,
          p_limit: ITEMS_PER_PAGE,
          p_offset: (p_page - 1) * ITEMS_PER_PAGE
        })

        if (error) {
          console.error('RPC Error:', error)
          show(error.message, 'error')
        } else {
          let finalData = rpcData || []
          if (!showAll) {
            finalData = finalData.filter((x: any) => x.total_balance > 0.1)
          }
          setData(finalData)
          setTotalCount(rpcData?.[0]?.total_count || 0)
        }
      }

      if (viewMode === 'audit') {
        let q = withFirmScope(supabase.from('payments').select(`
          id, amount, payment_date, created_at, mode, month, group_id,
          groups:group_id(id, name),
          members:member_id(persons:person_id(name))
        `, { count: 'exact' }), targetId).is('deleted_at', null)

        const { data: lData, count } = await q
          .order('created_at', { ascending: false })
          .range((p_page - 1) * ITEMS_PER_PAGE, p_page * ITEMS_PER_PAGE - 1)
        
        setAuditData(lData || [])
        setTotalCount(count || 0)
      }

      // Always fetch a few recent payments for the "Recent Activity" footer
      const { data: rData } = await withFirmScope(
        supabase.from('payments').select(`
          id, amount, payment_date, created_at, mode, month, group_id,
          groups:group_id(id, name), 
          members:member_id(persons:person_id(name))
        `),
        targetId
      ).is('deleted_at', null).limit(5).order('created_at', { ascending: false })
      setRecentPayments(rData || [])
    } catch (err: any) {
      console.error('Fetch error:', err)
      show('Failed to connect to the database engine. Ensure the migration is applied.', 'error')
    } finally {
      setLoading(false)
    }
  }, [supabase, isSuper, switchedFirmId, firm, search, page, show])

  useEffect(() => {
    const timer = setTimeout(() => { load() }, 300)
    return () => clearTimeout(timer)
  }, [search, page, load, viewMode, showAll])

  useEffect(() => {
    if (personIdParam && data.length > 0 && !payModal) {
      const person = data.find(p => p.person_id === Number(personIdParam))
      if (person) {
        setPayModal(person);
      }
    }
  }, [personIdParam, data, payModal])

  async function revertPayment(id: number) {
    if (!confirm('Revert this payment? This will restore the balance.')) return
    const { error } = await supabase.from('payments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) show(error.message, 'error')
    else {
      show('Payment reverted!', 'success')
      load()
    }
  }

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const stats = useMemo(() => {
    const totalOut = data.reduce((s: number, x: CollectionItem) => s + Number(x.total_balance), 0);
    const critical = data.filter((x: CollectionItem) => x.overdue_count >= 3).length;
    return { totalOut, critical };
  }, [data]);



  const handleWhatsAppReminder = (p: CollectionItem) => {
    const phone = p.person_phone ? p.person_phone.replace(/[^\d]/g, '') : ''
    if (!phone) return show('No phone number found', 'error')
    const text = `Hi ${p.person_name}, Reminder from ${firm?.name}. Total Outstanding: ₹${p.total_balance.toLocaleString('en-IN')}. Please clear it at the earliest.`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }



  return (
    <div className="space-y-8 pb-20">
      <div className="mesh-gradient rounded-3xl p-6 shadow-2xl relative overflow-hidden">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 relative z-10">
          <Stat value={fmt(stats.totalOut)} label="Total Reach" />
          <Stat value={totalCount} label="Registry Size" />
          <Stat value={stats.critical} label="Critical >3m" hideOnMobile />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-[var(--surface)] p-3 rounded-2xl neumo-out no-print">
        {/* Tab Switcher */}
        <div className="flex p-1 bg-[var(--surface2)] rounded-xl border border-[var(--border)] shrink-0">
          <button 
            onClick={() => setViewMode('workspace')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
              viewMode === 'workspace' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm border border-[var(--border)]" : "opacity-40 hover:opacity-100"
            )}
          >
            <LayoutGrid size={14}/> Workspace
          </button>
          <button 
            onClick={() => setViewMode('audit')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
              viewMode === 'audit' ? "bg-[var(--surface)] text-indigo-500 shadow-sm border border-[var(--border)]" : "opacity-40 hover:opacity-100"
            )}
          >
            <History size={14}/> Audit Log
          </button>
        </div>

        {/* Search Bar - Fixed stretching */}
        <div className="flex-1 relative min-w-[200px]">
          <input 
            className={cn(inputClass, "pl-12")} 
            placeholder={viewMode === 'workspace' ? "Search dues, members..." : "Search receipts..."} 
            value={search} 
            onChange={e => { setSearch(e.target.value); setPage(1); }} 
          />
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-auto">
          {viewMode === 'workspace' && (
            <button 
              onClick={() => setShowAll(!showAll)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 shrink-0 h-[42px]",
                showAll ? "bg-[var(--accent-dim)] text-[var(--accent)] border-[var(--accent-border)]" : "bg-[var(--surface2)] border-[var(--border)] opacity-60"
              )}
            >
              <ListChecks size={14} /> {showAll ? "Full Registry" : "Due Only"}
            </button>
          )}
          <Btn variant="secondary" onClick={() => window.print()} icon={Printer} className="hidden sm:flex shrink-0 h-[42px]">Print</Btn>
        </div>
      </div>

      {loading ? <Loading /> : viewMode === 'audit' ? (
        <TableCard title="Recent Firm Receipts" subtitle="Audit trail of latest recorded payments">
          <Table>
            <thead>
              <Tr>
                <Th>Date</Th>
                <Th>Member / Group</Th>
                <Th right>Amount</Th>
                <Th>Mode</Th>
                <Th right>Action</Th>
              </Tr>
            </thead>
            <tbody>
              {auditData.length === 0 ? <Tr><Td colSpan={5}><Empty text="No recent activity." /></Td></Tr> : auditData.map(p => (
                <Tr key={p.id}>
                  <Td className="whitespace-nowrap font-medium opacity-80 text-[10px] leading-tight">
                    <div>{fmtDate(p.payment_date)}</div>
                    <div className="opacity-60">{new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                  </Td>
                   <Td>
                    <div className="font-black text-[var(--text)]">{p.persons?.name || p.members?.persons?.name || 'Unknown'}</div>
                    <div className="text-xs uppercase tracking-widest font-bold text-indigo-500/60 mt-0.5 cursor-pointer hover:text-[var(--accent)]" onClick={() => router.push(`/groups/${p.group_id}`)}>
                      {p.groups?.name} <span className="opacity-20 mx-1">/</span> M{p.month}
                    </div>
                  </Td>
                  <Td right className="text-xl font-black text-emerald-500 tracking-tighter">+{fmt(p.amount)}</Td>
                  <Td><Badge variant="gray" className="text-xs">{p.mode}</Badge></Td>
                  <Td right>
                    {isOwner && (
                      <Btn size="sm" variant="ghost" icon={Trash2} color="danger" onClick={() => revertPayment(p.id)} />
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
      ) : (
        <>
          <div className="hidden lg:block">
            <TableCard title="Collection Hub" subtitle="Centralized workspace for dues and audit">
              <Table>
                <thead>
                  <Tr>
                    <Th>Person</Th>
                    <Th>Group Breakdown</Th>
                    <Th right>Outstanding</Th>
                    <Th right>Actions</Th>
                  </Tr>
                </thead>
                <tbody>
                  {data.length === 0 ? <Tr><Td colSpan={4}><Empty text="Clean slate." /></Td></Tr> : data.map(x => (
                    <Tr key={x.person_id}>
                      <Td>
                        <div className="font-bold flex items-center gap-2 cursor-pointer hover:text-[var(--accent)]" onClick={() => router.push(`/members/${x.person_id}`)}>
                          {x.person_name}
                          {x.overdue_count >= 3 && <Badge variant="danger" className="py-0 px-1 text-xs">CRITICAL</Badge>}
                        </div>
                        <div className="text-xs opacity-40 font-mono flex items-center gap-1"><Phone size={10} /> {x.person_phone || '—'}</div>
                      </Td>
                      <Td>
                        <div className="space-y-1">
                            {x.memberships.map((m: any) => (
                              <div key={m.member.id} className="flex items-center gap-2">
                                <span className="text-xs font-bold opacity-40 uppercase truncate max-w-[150px]">{getGroupDisplayName(m.group, t)}</span>
                                <div className="flex flex-wrap gap-0.5">
                                  {(m.dues || []).map((d: any) => (
                                    <Badge key={d.month} variant={d.auction_status === 'confirmed' ? 'danger' : 'gray'} className="text-xs py-0 px-0.5 border-0">M{d.month}</Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </Td>
                      <Td right className={cn("font-black font-mono text-lg", x.is_overdue ? "text-[var(--danger)]" : "text-[var(--accent)]")}>
                        {x.total_balance > 0.01 ? fmt(x.total_balance) : <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 border-0">CLEAR</Badge>}
                      </Td>
                      <Td right>
                        <div className="flex justify-end gap-1">
                          <Btn size="sm" variant="ghost" icon={History} onClick={() => setHistoryModal(x)} className="text-indigo-500" />
                          <Btn size="sm" variant="ghost" icon={MessageSquare} onClick={() => handleWhatsAppReminder(x)} className="text-[#25D366]" />
                          {x.total_balance > 0.1 && (
                            <Btn size="sm" variant="primary" icon={CreditCard} onClick={() => setPayModal(x)}>Collect</Btn>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
            </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:hidden">
            {data.length === 0 ? (
              <div className="col-span-full"><Empty text="Clean slate!" /></div>
            ) : data.map(x => (
              <div key={x.person_id} className="bg-[var(--surface)] rounded-3xl neumo-out overflow-hidden flex flex-col border border-white/5">
                <div className="p-7 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div onClick={() => router.push(`/members/${x.person_id}`)}>
                        <div className="font-black text-2xl tracking-tighter italic uppercase">{x.person_name}</div>
                        <div className="text-xs font-bold opacity-40 mt-1 flex items-center gap-1 uppercase tracking-widest"><MapPin size={12} /> {x.person_address || 'Unknown'}</div>
                    </div>
                    <Badge variant={x.overdue_count >= 3 ? 'danger' : 'accent'}>{x.overdue_count} Months</Badge>
                  </div>
                  <div className="space-y-2 mb-8">
                    {x.memberships.map((m: any) => (
                      <div key={m.member.id} className="flex flex-col gap-1 bg-[var(--surface2)] neumo-in px-4 py-3 rounded-2xl border border-white/5 font-bold">
                          <div className="flex justify-between text-xs">
                            <span className="opacity-50 truncate max-w-[150px] text-xs leading-none">{getGroupDisplayName(m.group, t)}</span>
                            <span>{fmt(m.totalBalance)}</span>
                          </div>
                          <div className="flex gap-1">{(m.dues || []).map((d: any) => <Badge key={d.month} variant={d.auction_status === 'confirmed' ? 'danger' : 'gray'} className="text-xs py-0 px-1 border-0">M{d.month}</Badge>)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end justify-between pt-6 border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                    <div>
                        <div className="text-xs uppercase opacity-30 font-black mb-1">Total Outstanding</div>
                        <div className={cn("text-3xl font-black italic", x.is_overdue ? "text-[var(--danger)]" : "text-[#0ea5e9]")}>{fmt(x.total_balance)}</div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setHistoryModal(x)} className="w-10 h-10 rounded-xl neumo-out flex items-center justify-center text-indigo-500"><History size={18} /></button>
                        <button onClick={() => handleWhatsAppReminder(x)} className="w-10 h-10 rounded-xl neumo-out flex items-center justify-center text-[#25D366]"><MessageSquare size={18} fill="currentColor" /></button>
                        <a href={`tel:${x.person_phone}`} className="w-10 h-10 rounded-xl neumo-out flex items-center justify-center text-[var(--info)]"><Phone size={18} /></a>
                    </div>
                  </div>
                </div>
                <button onClick={() => setPayModal(x)} className="w-full py-4 bg-[var(--accent)] text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
                  <CreditCard size={18} /> Record Payment
                </button>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <Pagination 
              current={page} 
              total={totalCount} 
              pageSize={ITEMS_PER_PAGE} 
              onPageChange={setPage} 
            />
          </div>

          {recentPayments.length > 0 && (
            <div className="mt-12 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-widest opacity-40">Recent Activity</h3>
                <Btn variant="ghost" size="sm" onClick={() => setViewMode('audit')}>View Full Audit Log</Btn>
              </div>
              <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden shadow-sm">
                <Table>
                  <tbody>
                    {recentPayments.map(p => (
                      <Tr key={p.id}>
                        <Td className="whitespace-nowrap text-[10px] font-bold opacity-80 uppercase leading-tight">
                          <div>{fmtDate(p.payment_date)}</div>
                          <div className="text-[9px] opacity-60">{new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                        </Td>
                        <Td>
                          <div className="font-bold text-sm">{p.persons?.name || p.members?.persons?.name || 'Unknown'}</div>
                          <div className="text-[10px] opacity-40 uppercase tracking-tighter cursor-pointer hover:text-[var(--accent)]" onClick={() => router.push(`/groups/${p.group_id}`)}>
                            {p.groups?.name} · M{p.month}
                          </div>
                        </Td>
                        <Td right className="font-black text-[var(--success)]">+{fmt(p.amount)}</Td>
                        <Td right className="flex items-center justify-end gap-2">
                          <Badge variant="gray" className="text-[9px] uppercase">{p.mode}</Badge>
                          {isOwner && (
                            <Btn size="sm" variant="ghost" icon={Trash2} color="danger" onClick={() => revertPayment(p.id)} />
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </>
      )}

      {payModal && (
        <RecordCollectionModal 
          personId={payModal.person_id} 
          initialData={payModal}
          onClose={() => setPayModal(null)}
          onSuccess={() => load()}
        />
      )}

      {historyModal && (
        <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title={`Ledger - ${historyModal.person_name}`} size="lg">
           <MemberLedger personId={historyModal.person_id} firmId={isSuper ? switchedFirmId || '' : firm?.id || ''} />
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>

  )
}

function Stat({ value, label, hideOnMobile }: any) {
  return (
    <div className={cn("bg-[var(--surface)] p-5 rounded-2xl flex flex-col justify-center border border-[var(--border)] shadow-sm transition-transform hover:scale-[1.02]", hideOnMobile && "hidden sm:flex")}>
      <div className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text3)] mb-1">{label}</div>
      <div className="text-3xl font-black text-[var(--text)] tracking-tighter">{value}</div>
    </div>
  )
}
