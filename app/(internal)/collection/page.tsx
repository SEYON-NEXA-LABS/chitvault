'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { fmt, getToday, cn, getGroupDisplayName } from '@/lib/utils'
import {
  TableCard, Table, Th, Td, Tr,
  Loading, Empty, Badge, Btn, Modal, Field, Toast, Pagination
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Printer, Phone, MapPin, Search, MessageSquare, CreditCard, ChevronLeft, ChevronRight, History, LayoutGrid, ListChecks, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { MemberLedger } from '@/components/features/MemberLedger'
import { fmtDate } from '@/lib/utils'

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
  const { t } = useI18n()
  const { toast, show, hide } = useToast()

  const [data, setData] = useState<CollectionItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const isSuper = role === 'superadmin'
  const [viewMode, setViewMode] = useState<'workspace' | 'audit'>('workspace')
  const [showAll, setShowAll] = useState(false)
  const [auditData, setAuditData] = useState<any[]>([])
  const [historyModal, setHistoryModal] = useState<CollectionItem | null>(null)
  
  const [payModal, setPayModal] = useState<CollectionItem | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', date: getToday(), mode: 'Cash', note: '' })

  const load = useCallback(async (p_search = search, p_page = page) => {
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) {
      // Safety: If firm isn't loaded yet, try again after a brief wait
      // but don't hang the UI forever.
      setTimeout(() => setLoading(false), 3000)
      return
    }
    
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
          id, amount, payment_date, created_at, mode, month,
          groups(name),
          persons:person_id(name)
        `, { count: 'exact' }), targetId).is('deleted_at', null)

        if (p_search) {
          // Search in person name via join is tricky in simple select, 
          // usually payments table has person_id
          // For now, simple limit for audit log
        }

        const { data: lData, count } = await q
          .order('created_at', { ascending: false })
          .range((p_page - 1) * ITEMS_PER_PAGE, p_page * ITEMS_PER_PAGE - 1)
        
        setAuditData(lData || [])
        setTotalCount(count || 0)
      }
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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const stats = useMemo(() => {
    const totalOut = data.reduce((s: number, x: CollectionItem) => s + Number(x.total_balance), 0);
    const critical = data.filter((x: CollectionItem) => x.overdue_count >= 3).length;
    return { totalOut, critical };
  }, [data]);

  async function handlePay() {
    if (!payModal || !firm) return;
    const amount = Number(payForm.amount);
    if (amount <= 0) { show('Enter a valid amount', 'error'); return; }

    setSaving(true);
    const targetId = isSuper ? switchedFirmId : firm.id
    let remaining = amount;
    const finalPayments = [];

    const allDues = payModal.memberships.flatMap((m: any) => (m.dues || []).map((d: any) => ({ ...d, memberId: m.member.id, groupId: m.group.id })))
      .sort((a: any, b: any) => a.month - b.month);

    for (const due of allDues) {
      if (remaining <= 0) break;
      const bal = due.amount_due - due.amount_paid;
      if (bal <= 0.01) continue;

      const toPay = Math.min(remaining, bal);
      remaining -= toPay;

      finalPayments.push({
        firm_id: targetId,
        member_id: due.memberId,
        group_id: due.groupId,
        month: due.month,
        amount: toPay,
        status: (due.amount_paid + toPay) >= (due.amount_due - 0.01) ? 'paid' : 'partial',
        amount_due: due.amount_due,
        balance_due: Math.max(0, due.amount_due - due.amount_paid - toPay),
        payment_date: payForm.date,
        mode: payForm.mode,
        payment_type: (due.amount_paid + toPay) >= (due.amount_due - 0.01) ? 'full' : 'partial',
        collected_by: profile?.id || null,
        note: payForm.note
      });
    }

    // Handle Advance / Surplus if remaining > 0
    if (remaining > 0.01 && payModal.memberships.length > 0) {
      const firstM = payModal.memberships[0];
      const currentLatest = firstM.latestMonth || 0;
      const duration = firstM.group?.duration || 0;
      
      let targetMonth = currentLatest + 1;
      let isSettlement = false;

      if (targetMonth > duration && duration > 0) {
        targetMonth = 0; // Use month 0 or last month for post-closure surplus
        isSettlement = true;
      }
      
      finalPayments.push({
        firm_id: targetId,
        member_id: firstM.member.id,
        group_id: firstM.group.id,
        month: targetMonth,
        amount: remaining,
        status: 'paid',
        amount_due: 0,
        balance_due: 0,
        payment_date: payForm.date,
        mode: payForm.mode,
        payment_type: isSettlement ? 'settlement' : 'advance',
        collected_by: profile?.id || null,
        note: (isSettlement ? `SURPLUS: ${payForm.note}` : `ADVANCE: ${payForm.note}`).trim()
      });
      remaining = 0;
    }

    if (finalPayments.length === 0) { show('No allocations made', 'error'); setSaving(false); return; }

    const { error } = await supabase.from('payments').insert(finalPayments);
    if (error) { show(error.message, 'error'); }
    else {
      show(`Collected ₹${amount}! Receipt recorded.`);
      setPayModal(null);
      load();
    }
    setSaving(false);
  }

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
              </Tr>
            </thead>
            <tbody>
              {auditData.length === 0 ? <Tr><Td colSpan={4}><Empty text="No recent activity." /></Td></Tr> : auditData.map(p => (
                <Tr key={p.id}>
                  <Td className="whitespace-nowrap font-medium opacity-50 text-xs">{fmtDate(p.payment_date || p.created_at)}</Td>
                  <Td>
                    <div className="font-black text-[var(--text)]">{p.persons?.name}</div>
                    <div className="text-xs uppercase tracking-widest font-bold text-indigo-500/60 mt-0.5">{p.groups?.name} <span className="opacity-20 mx-1">/</span> M{p.month}</div>
                  </Td>
                  <Td right className="text-xl font-black text-emerald-500 tracking-tighter">+{fmt(p.amount)}</Td>
                  <Td><Badge variant="gray" className="text-xs">{p.mode}</Badge></Td>
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
                            <Btn size="sm" variant="primary" icon={CreditCard} onClick={() => {
                                setPayForm({ amount: String(x.total_balance), date: getToday(), mode: 'Cash', note: '' });
                                setPayModal(x);
                            }}>Collect</Btn>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableCard>
            <div className="mt-4">
              <Pagination 
                current={page} 
                total={totalCount} 
                pageSize={ITEMS_PER_PAGE} 
                onPageChange={setPage} 
              />
            </div>
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
                <button onClick={() => { setPayForm({ amount: String(x.total_balance), date: getToday(), mode: 'Cash', note: '' }); setPayModal(x); }} className="w-full py-4 bg-[var(--accent)] text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
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
        </>
      )}

      {payModal && (
        <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Collection" size="md">
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)]">
              <div className="font-bold text-lg">{payModal.person_name}</div>
              <div className={cn("text-xl font-black mt-2", payModal.is_overdue ? "text-[var(--danger)]" : "text-[#0ea5e9]")}>{fmt(payModal.total_balance)}</div>
              
              {/* Live Calculation Summary */}
              {payForm.amount && !isNaN(Number(payForm.amount)) && (
                <div className="mt-3 pt-3 border-t border-dashed border-[var(--border)]">
                  {(() => {
                    const diff = payModal.total_balance - Number(payForm.amount);
                    if (Math.abs(diff) < 0.01) return <Badge variant="success" className="text-xs">Full Settlement</Badge>;
                    if (diff > 0) return (
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-[var(--text3)] uppercase tracking-widest">Remaining</span>
                        <span className="text-[var(--danger)]">{fmt(diff)}</span>
                      </div>
                    );
                    return (
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-[var(--text3)] uppercase tracking-widest">Advance / Surplus</span>
                        <span className="text-emerald-500">{fmt(Math.abs(diff))}</span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Amount Collected"><input className={cn(inputClass, "text-2xl")} type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date"><input className={inputClass} type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} /></Field>
                <Field label="Mode"><select className={inputClass} value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}><option>Cash</option><option>UPI</option></select></Field>
              </div>
              <Field label="Note"><textarea className={inputClass} style={{ height: 60 }} value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} /></Field>
            </div>
            <div className="flex gap-3 pt-4"><Btn variant="secondary" className="flex-1" onClick={() => setPayModal(null)}>Cancel</Btn><Btn variant="primary" className="flex-[2]" loading={saving} onClick={handlePay}>Confirm Collection</Btn></div>
          </div>
        </Modal>
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
