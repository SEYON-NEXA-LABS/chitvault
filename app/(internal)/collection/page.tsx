'use client'

import { useEffect, useState, useMemo, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { fmt, getToday, cn, getGroupDisplayName } from '@/lib/utils'
import {
  TableCard, Table, Th, Td, Tr,
  Loading, Empty, Badge, Btn, Modal, Field, Toast
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Printer, Phone, MapPin, Search, MessageSquare, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

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
        setData(rpcData || [])
        setTotalCount(rpcData?.[0]?.total_count || 0)
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
  }, [search, page, load])

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

  const Pagination = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex justify-center items-center gap-2 mt-8 no-print">
        <Btn variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} icon={ChevronLeft} />
        <div className="flex gap-1">
          {[...Array(totalPages)].map((_, i) => {
            const p = i + 1;
            if (totalPages > 5 && Math.abs(p - page) > 2 && p !== 1 && p !== totalPages) return (p === 2 || p === totalPages - 1) ? <span key={p} className="px-2 opacity-30">...</span> : null;
            return (
              <button 
                key={p} 
                onClick={() => setPage(p)}
                className={cn(
                  "w-10 h-10 rounded-xl font-bold transition-all",
                  page === p ? "bg-[var(--accent)] text-white shadow-lg" : "hover:bg-[var(--surface2)] text-[var(--text2)] opacity-60"
                )}
              >
                {p}
              </button>
            )
          })}
        </div>
        <Btn variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} icon={ChevronRight} />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="mesh-gradient rounded-[3rem] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 relative z-10">
          <Stat value={fmt(stats.totalOut)} label="Total Reach" />
          <Stat value={totalCount} label="Registry Size" />
          <Stat value={stats.critical} label="Critical >3m" hideOnMobile />
        </div>
      </div>

      <div className="flex gap-4 items-center bg-[var(--surface)] p-3 rounded-[2rem] neumo-out no-print">
        <div className="flex-1 relative">
          <input className={inputClass} style={inputStyle} 
            placeholder="Search name, phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" />
        </div>
        <Btn variant="secondary" onClick={() => window.print()} icon={Printer} className="hidden sm:flex">Print Hub</Btn>
      </div>

      {loading ? <Loading /> : (
        <>
          <div className="hidden lg:block">
            <TableCard title="Collection Workspace" subtitle="High-density server-optimized view">
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
                          {x.overdue_count >= 3 && <Badge variant="danger" className="py-0 px-1 text-[8px]">CRITICAL</Badge>}
                        </div>
                        <div className="text-[10px] opacity-40 font-mono flex items-center gap-1"><Phone size={10} /> {x.person_phone || '—'}</div>
                      </Td>
                      <Td>
                        <div className="space-y-1">
                            {x.memberships.map((m: any) => (
                              <div key={m.member.id} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold opacity-40 uppercase truncate max-w-[150px]">{getGroupDisplayName(m.group, t)}</span>
                                <div className="flex flex-wrap gap-0.5">
                                  {(m.dues || []).map((d: any) => (
                                    <Badge key={d.month} variant={d.auction_status === 'confirmed' ? 'danger' : 'gray'} className="text-[7px] py-0 px-0.5 border-0">M{d.month}</Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </Td>
                      <Td right className={cn("font-black font-mono text-lg", x.is_overdue ? "text-[var(--danger)]" : "text-[var(--accent)]")}>
                        {fmt(x.total_balance)}
                      </Td>
                      <Td right>
                        <div className="flex justify-end gap-1">
                          <Btn size="sm" variant="ghost" icon={MessageSquare} onClick={() => handleWhatsAppReminder(x)} className="text-[#25D366]" />
                          <Btn size="sm" variant="primary" icon={CreditCard} onClick={() => {
                              setPayForm({ amount: String(x.total_balance), date: getToday(), mode: 'Cash', note: '' });
                              setPayModal(x);
                          }}>Collect</Btn>
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
              <div key={x.person_id} className="bg-[var(--surface)] rounded-[2.5rem] neumo-out overflow-hidden flex flex-col border border-white/5">
                <div className="p-7 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <div onClick={() => router.push(`/members/${x.person_id}`)}>
                        <div className="font-black text-2xl tracking-tighter italic uppercase">{x.person_name}</div>
                        <div className="text-[10px] font-bold opacity-40 mt-1 flex items-center gap-1 uppercase tracking-widest"><MapPin size={12} /> {x.person_address || 'Unknown'}</div>
                    </div>
                    <Badge variant={x.overdue_count >= 3 ? 'danger' : 'accent'}>{x.overdue_count} Months</Badge>
                  </div>
                  <div className="space-y-2 mb-8">
                    {x.memberships.map((m: any) => (
                      <div key={m.member.id} className="flex flex-col gap-1 bg-[var(--surface2)] neumo-in px-4 py-3 rounded-2xl border border-white/5 font-bold">
                          <div className="flex justify-between text-[11px]">
                            <span className="opacity-50 truncate max-w-[150px] text-xs leading-none">{getGroupDisplayName(m.group, t)}</span>
                            <span>{fmt(m.totalBalance)}</span>
                          </div>
                          <div className="flex gap-1">{(m.dues || []).map((d: any) => <Badge key={d.month} variant={d.auction_status === 'confirmed' ? 'danger' : 'gray'} className="text-[8px] py-0 px-1 border-0">M{d.month}</Badge>)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end justify-between pt-6 border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                    <div>
                        <div className="text-[9px] uppercase opacity-30 font-black mb-1">Total Outstanding</div>
                        <div className={cn("text-3xl font-black italic", x.is_overdue ? "text-[var(--danger)]" : "text-[#0ea5e9]")}>{fmt(x.total_balance)}</div>
                    </div>
                    <div className="flex gap-2">
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

          <Pagination />
        </>
      )}

      {payModal && (
        <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Collection" size="md">
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)]">
              <div className="font-bold text-lg">{payModal.person_name}</div>
              <div className={cn("text-xl font-black mt-2", payModal.is_overdue ? "text-[var(--danger)]" : "text-[#0ea5e9]")}>{fmt(payModal.total_balance)}</div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Amount Collected"><input className={inputClass} style={{ fontSize: 24 }} type="number" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} /></Field>
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

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}

function Stat({ value, label, hideOnMobile }: any) {
  return (
    <div className={cn("glass-card p-4 rounded-3xl flex flex-col justify-center border-white/20", hideOnMobile && "hidden sm:flex")}>
      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-60 mb-1">{label}</div>
      <div className="text-2xl font-black text-white italic">{value}</div>
    </div>
  )
}
