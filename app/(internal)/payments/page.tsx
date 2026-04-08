'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate, fmtMonth, getToday, cn, getGroupDisplayName } from '@/lib/utils'
import { Btn, Badge, Card, Loading, Empty, Toast, Chip, Modal, Field, StatCard, Table, Th, Td, Tr, TableCard } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { useFirm } from '@/lib/firm/context'
import { logActivity } from '@/lib/utils/logger'
import { useI18n } from '@/lib/i18n/context'
import type { Group, Member, Auction, Payment, Person, Firm } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { getMemberFinancialStatus, FinancialStatus } from '@/lib/utils/chitLogic'
import { CreditCard, Search, History, ChevronRight, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'

interface PersonSummary {
  person: Person;
  memberships: {
    member: Member;
    group: Group;
    status: FinancialStatus;
  }[];
  overallTotalDue: number;
  overallTotalPaid: number;
  overallTotalBalance: number;
  lastPaymentDate: string | null;
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PaymentsPageContent />
    </Suspense>
  )
}

function PaymentsPageContent() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, profile, role, can, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const { toast, show: showToast, hide: hideToast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qPersonId = searchParams.get('personId')

  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [saving,   setSaving]   = useState(false)
  const [firms,    setFirms]    = useState<Firm[]>([])

  const isSuper = role === 'superadmin'

  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [showOnlyPaid, setShowOnlyPaid] = useState(false)

  const [payModal, setPayModal] = useState<PersonSummary | null>(null)
  const [payForm,  setPayForm]  = useState({ amount: '', date: getToday(), mode: 'Cash', note: '', isManual: false, manualAllocations: {} as Record<string, string> })
  const [historyModal, setHistoryModal] = useState<PersonSummary | null>(null)
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<number>>(new Set())

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id

    const [g, m, a, p] = await Promise.all([
      withFirmScope(supabase.from('groups').select('*').neq('status','archived'), targetId).is('deleted_at', null).order('name'),
      withFirmScope(supabase.from('members').select('*, persons(*)'), targetId).is('deleted_at', null),
      withFirmScope(supabase.from('auctions').select('*'), targetId).is('deleted_at', null).order('month'),
      withFirmScope(supabase.from('payments').select('*'), targetId).is('deleted_at', null).order('payment_date', { ascending: false }),
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setPayments(p.data || [])

    if (isSuper && firms.length === 0) {
      const { data: f } = await supabase.from('firms').select('*').order('name')
      setFirms(f || [])
    }
    setLoading(false)
    setSelectedPaymentIds(new Set())
  }, [supabase, isSuper, switchedFirmId, firm, firms.length])

  useEffect(() => { load(true) }, [load])

  const personSummaries: PersonSummary[] = useMemo(() => {
    const personMap = new Map<number, PersonSummary>();

    members.forEach((m: Member) => {
      if (!m.persons) return;
      const group = groups.find((g: Group) => g.id === m.group_id);
      if (!group) return;

      const fStatus = getMemberFinancialStatus(m, group, auctions, payments);
      const pId = m.person_id;

      if (!personMap.has(pId)) {
        personMap.set(pId, {
          person: m.persons,
          memberships: [],
          overallTotalDue: 0,
          overallTotalPaid: 0,
          overallTotalBalance: 0,
          lastPaymentDate: null
        });
      }

      const pSummary = personMap.get(pId)!;
      pSummary.memberships.push({ member: m, group, status: fStatus });
      pSummary.overallTotalDue += fStatus.totalDue;
      pSummary.overallTotalPaid += fStatus.totalPaid;
      pSummary.overallTotalBalance += fStatus.balance;

      const mPays = payments.filter(p => p.member_id === m.id && p.group_id === group.id);
      const lastPay = mPays[0];
      if (lastPay && (!pSummary.lastPaymentDate || lastPay.payment_date! > pSummary.lastPaymentDate!)) {
        pSummary.lastPaymentDate = lastPay.payment_date;
      }
    });

    return Array.from(personMap.values());
  }, [members, groups, auctions, payments]);

  // Handle URL-based Auto-selection
  useEffect(() => {
    if (qPersonId && personSummaries.length > 0 && !payModal) {
      const target = personSummaries.find(s => String(s.person.id) === qPersonId)
      if (target && target.overallTotalBalance > 0.01) {
        setPayForm({ 
          amount: String(target.overallTotalBalance), 
          date: getToday(), 
          mode: 'Cash', 
          note: 'Quick collection from registry', 
          isManual: false, 
          manualAllocations: {} 
        });
        setPayModal(target);
      }
    }
  }, [qPersonId, personSummaries, payModal])

  const filtered = useMemo(() => {
    return personSummaries.filter((s: PersonSummary) => {
      const matchSearch = s.person.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.person.phone && s.person.phone.includes(search));
      
      if (!matchSearch) return false;
      if (showOnlyPaid && dateRange.start && dateRange.end) {
        const hasPaymentInRange = payments.some(p => 
          s.memberships.some(ms => ms.member.id === p.member_id) && 
          p.payment_date! >= dateRange.start && 
          p.payment_date! <= dateRange.end
        );
        if (!hasPaymentInRange) return false;
      }
      return true;
    }).sort((a, b) => b.overallTotalBalance - a.overallTotalBalance);
  }, [personSummaries, search, showOnlyPaid, dateRange, payments]);

  const stats = useMemo(() => {
    const today = getToday();
    const collectedToday = payments.filter((p: Payment) => p.payment_date === today).reduce((s, p) => s + Number(p.amount), 0);
    let collectedInRange = 0;
    if (dateRange.start && dateRange.end) {
      collectedInRange = payments.filter((p: Payment) => 
        p.payment_date! >= dateRange.start && p.payment_date! <= dateRange.end
      ).reduce((s, p) => s + Number(p.amount), 0);
    }
    const totalOut = personSummaries.reduce((s, p) => s + p.overallTotalBalance, 0);
    return { collectedToday, totalOut, collectedInRange };
  }, [payments, personSummaries, dateRange]);

  async function handlePay() {
    if (!payModal || !firm) return;
    const amount = Number(payForm.amount);
    if (amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    
    setSaving(true);
    let remaining = amount;
    const finalPayments: any[] = [];

    if (payForm.isManual) {
      for (const [key, val] of Object.entries(payForm.manualAllocations)) {
        const amt = Number(val);
        if (amt <= 0) continue;
        const [mId, month] = key.split('-').map(Number);
        const m = payModal.memberships.find(x => x.member.id === mId);
        const streakItem = m?.status.streak.find(d => d.month === month);
        if (!m || !streakItem) continue;

        finalPayments.push({
          firm_id: firm.id, member_id: mId, group_id: m.group.id, month: month,
          amount: amt, payment_date: payForm.date, mode: payForm.mode,
          collected_by: profile?.id || null, note: payForm.note,
          status: (streakItem.paid + amt) >= (streakItem.due - 0.01) ? 'paid' : 'partial',
          amount_due: streakItem.due,
          balance_due: Math.max(0, streakItem.due - streakItem.paid - amt),
          payment_type: (streakItem.paid + amt) >= (streakItem.due - 0.01) ? 'full' : 'partial',
        });
      }
    } else {
      // Auto-distribution logic
      const allStreak = payModal.memberships.flatMap(ms => 
        ms.status.streak.filter(d => (ms.group.auction_scheme === 'ACCUMULATION' ? d.status === 'danger' : (d.status === 'danger' || d.status === 'info')))
          .map(d => ({ ...d, memberId: ms.member.id, groupId: ms.group.id }))
      ).sort((a, b) => a.month - b.month);

      for (const due of allStreak) {
        if (remaining <= 0) break;
        const bal = Math.max(0, due.due - due.paid);
        if (bal <= 0.01) continue;
        const toPay = Math.min(remaining, bal);
        remaining -= toPay;
        finalPayments.push({
          firm_id: firm.id, member_id: due.memberId, group_id: due.groupId, month: due.month,
          amount: toPay, payment_date: payForm.date, mode: payForm.mode,
          collected_by: profile?.id || null, note: payForm.note,
          status: (due.paid + toPay) >= (due.due - 0.01) ? 'paid' : 'partial',
          amount_due: due.due,
          balance_due: Math.max(0, due.due - due.paid - toPay),
          payment_type: (due.paid + toPay) >= (due.due - 0.01) ? 'full' : 'partial',
        });
      }

      // Residual -> First ticket's next month
      if (remaining > 0.01 && payModal.memberships.length > 0) {
        const ms = payModal.memberships[0];
        const nextMonth = ms.status.streak.filter(d => d.paid > 0 || d.due > 0).length + 1;
        if (nextMonth <= ms.group.duration) {
          finalPayments.push({
            firm_id: firm.id, member_id: ms.member.id, group_id: ms.group.id, month: nextMonth,
            amount: remaining, payment_date: payForm.date, mode: payForm.mode,
            collected_by: profile?.id || null, note: payForm.note,
            status: remaining >= (ms.group.monthly_contribution - 0.01) ? 'paid' : 'partial',
            amount_due: ms.group.monthly_contribution,
            balance_due: Math.max(0, ms.group.monthly_contribution - remaining),
            payment_type: remaining >= (ms.group.monthly_contribution - 0.01) ? 'full' : 'partial',
          });
        }
      }
    }

    if (finalPayments.length === 0) { showToast('No allocations made', 'error'); setSaving(false); return; }
    const { data: created, error } = await supabase.from('payments').insert(finalPayments).select();
    if (error) { showToast(error.message, 'error'); }
    else { 
      showToast(`Recorded ${finalPayments.length} payment segments!`, 'success'); 
      await logActivity(firm.id, 'PAYMENT_RECORDED', 'payment', created?.[0]?.id || null, { person_name: payModal.person.name, total_amount: amount });
      setPayModal(null); load(); 
    }
    setSaving(false);
  }

  const handleDeletePayment = async (id: number) => {
    if (!can('deletePayment')) return;
    if (!confirm('Move this payment record to trash?')) return;
    const { error } = await supabase.from('payments').update({ deleted_at: new Date() }).eq('id', id).eq('firm_id', firm?.id);
    if (error) showToast(error.message, 'error'); else { showToast('Payment removed!', 'success'); load(); }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedPaymentIds)
    if (ids.length === 0 || !can('deletePayment')) return;
    if (!confirm(`Trash ${ids.length} records?`)) return;
    const { error } = await supabase.from('payments').update({ deleted_at: new Date() }).in('id', ids).eq('firm_id', firm?.id);
    if (error) showToast(error.message, 'error'); else { showToast('Payments trashed!', 'success'); load(); }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-[var(--text)]">{t('nav_payments')}</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Collected Today" value={fmt(stats.collectedToday)} color="success" />
        {dateRange.start && dateRange.end && <StatCard label="Collected in Range" value={fmt(stats.collectedInRange)} color="info" />}
        <StatCard label="Total Outstanding" value={fmt(stats.totalOut)} color="danger" />
        <StatCard label="Total Persons" value={personSummaries.length} color="accent" />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 bg-[var(--surface)] p-4 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
        <div className="flex-1 relative">
           <input className={inputClass} style={{ ...inputStyle, paddingLeft: 40 }} 
            placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
           <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input type="date" className={inputClass} style={{ ...inputStyle, width: 'auto' }} value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} />
          <span className="opacity-30">to</span>
          <input type="date" className={inputClass} style={{ ...inputStyle, width: 'auto' }} value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} />
          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
            <input type="checkbox" checked={showOnlyPaid} onChange={e => setShowOnlyPaid(e.target.checked)} />
            Show only paid
          </label>
        </div>
      </div>

      <TableCard title="Collection Ledger (Person-Centric)" subtitle="Manage total individual dues tracked across multiple tickets.">
        <Table>
          <thead><Tr>
            <Th>Person / Active Tickets</Th>
            <Th className="hidden md:table-cell">Last Activity</Th>
            <Th className="hidden sm:table-cell">Account Status</Th>
            <Th right>Total Balance</Th>
            <Th right>Action</Th>
          </Tr></thead>
          <tbody>
            {filtered.length === 0 ? <Tr><Td colSpan={5}><Empty text="No matching persons found." /></Td></Tr> : filtered.map(s => (
              <Tr key={s.person.id}>
                <Td>
                  <div className="font-bold text-base cursor-pointer hover:text-[var(--accent)]" onClick={() => router.push(`/members/${s.person.id}`)}>{s.person.name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.memberships.map(m => (
                      <Badge key={m.member.id} variant="gray" className="text-[9px] lowercase opacity-70">
                        {getGroupDisplayName(m.group, t)} (#{m.member.ticket_no})
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td className="hidden md:table-cell text-xs">{s.lastPaymentDate ? fmtDate(s.lastPaymentDate) : '—'}</Td>
                <Td className="hidden sm:table-cell">
                  <Badge variant={s.overallTotalBalance <= 0.01 ? "success" : "danger"}>
                    {s.overallTotalBalance <= 0.01 ? "Clear Account" : `${s.memberships.filter(m => m.status.balance > 0).length} Tickets Pending`}
                  </Badge>
                </Td>
                <Td right className={cn("font-bold font-mono text-base", s.overallTotalBalance > 0.01 ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                  {fmt(s.overallTotalBalance)}
                </Td>
                <Td right><div className="flex gap-1 justify-end">
                  <Btn size="sm" variant="ghost" icon={History} onClick={() => setHistoryModal(s)}>Ledger</Btn>
                  <Btn size="sm" variant="primary" icon={CreditCard} onClick={() => {
                    setPayForm({ amount: String(s.overallTotalBalance), date: getToday(), mode: 'Cash', note: '', isManual: false, manualAllocations: {} });
                    setPayModal(s);
                  }}>Collect</Btn>
                </div></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableCard>

      {payModal && (
        <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Consolidated Payment" size="lg">
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface2)]">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xl font-bold">{payModal.person.name.charAt(0)}</div>
              <div className="flex-1"><div className="font-bold text-lg">{payModal.person.name}</div><div className="text-xs opacity-50">{payModal.person.phone}</div></div>
              <div className="text-right">
                 <div className="text-[10px] uppercase opacity-40 font-bold tracking-widest">To Collect</div>
                 <div className="text-xl font-black text-[var(--danger)]">{fmt(payModal.overallTotalBalance)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                 <div className="text-xs font-bold uppercase opacity-40">Allocated Dues</div>
                 <label className="flex items-center gap-2 text-xs cursor-pointer select-none"><input type="checkbox" checked={payForm.isManual} onChange={e => setPayForm(f => ({ ...f, isManual: e.target.checked }))} /><span className="font-bold">Manual Allocation</span></label>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
                {payModal.memberships.flatMap(ms => ms.status.streak.filter(d => (d.status === 'danger' || (ms.group.auction_scheme === 'DIVIDEND' && d.status === 'info'))).map(d => {
                  const key = `${ms.member.id}-${d.month}`;
                  const bal = Math.max(0, d.due - d.paid);
                  return (
                    <div key={key} className="flex items-center justify-between p-2.5 rounded-lg text-xs bg-[var(--surface2)]">
                      <div><div className="font-bold">{getGroupDisplayName(ms.group, t)} · {fmtMonth(d.month, ms.group.start_date)}</div><div className="text-[9px] opacity-40">Ticket #{ms.member.ticket_no}</div></div>
                      <div className="flex items-center gap-4">
                        <div className="text-right min-w-[80px]"><div className="font-bold text-[var(--danger)]">{fmt(bal)}</div><div className="text-[9px] opacity-40 font-mono">DUE: {fmt(d.due)}</div></div>
                        {payForm.isManual && <input className={cn(inputClass, "w-20")} style={{ ...inputStyle, padding: '4px' }} type="number" value={payForm.manualAllocations[key] || ''} onChange={e => {
                          const next = { ...payForm.manualAllocations, [key]: e.target.value };
                          const total = Object.values(next).reduce((s, v) => s + Number(v || 0), 0);
                          setPayForm(f => ({ ...f, manualAllocations: next, amount: String(total) }));
                        }} />}
                      </div>
                    </div>
                  )
                }))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
              <Field label="Total Amount Received"><input className={inputClass} style={inputStyle} type="number" readOnly={payForm.isManual} value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Payment Date"><input className={inputClass} style={inputStyle} type="date" value={payForm.date} onChange={e => setPayForm(f => ({...f, date: e.target.value}))} /></Field>
                <Field label="Mode"><select className={inputClass} style={inputStyle} value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value})) as any}><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option></select></Field>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4"><Btn variant="secondary" onClick={() => setPayModal(null)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={handlePay}>Confirm Payment</Btn></div>
          </div>
        </Modal>
      )}

      {historyModal && (
        <Modal open={!!historyModal} onClose={() => { setHistoryModal(null); setSelectedPaymentIds(new Set()) }} title="Consolidated Personal Ledger" size="lg">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <div><div className="font-bold text-xl">{historyModal.person.name}</div><div className="text-xs opacity-50">Combined History</div></div>
               {selectedPaymentIds.size > 0 && <Btn variant="danger" size="sm" icon={Trash2} onClick={handleBulkDelete}>Delete ({selectedPaymentIds.size})</Btn>}
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <Table>
                <thead><Tr><Th className="w-10"><input type="checkbox" checked={selectedPaymentIds.size > 0} onChange={() => {
                  const ids = payments.filter(p => historyModal.memberships.some(ms => ms.member.id === p.member_id)).map(p => p.id);
                  if (selectedPaymentIds.size === ids.length) setSelectedPaymentIds(new Set()); else setSelectedPaymentIds(new Set(ids));
                }} /></Th><Th>Date</Th><Th>Ticket/Month</Th><Th right>Amount</Th><Th right></Th></Tr></thead>
                <tbody>
                  {payments.filter(p => historyModal.memberships.some(ms => ms.member.id === p.member_id)).map(p => {
                    const g = groups.find(x => x.id === p.group_id);
                    const isS = selectedPaymentIds.has(p.id);
                    return (
                      <Tr key={p.id} className={cn(isS ? "bg-[var(--accent-dim)]" : "")}>
                        <Td><input type="checkbox" checked={isS} onChange={() => {
                          const next = new Set(selectedPaymentIds); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); setSelectedPaymentIds(next);
                        }} /></Td>
                        <Td>{fmtDate(p.payment_date)}</Td>
                        <Td className="text-xs"><div className="font-bold">{g ? getGroupDisplayName(g, t) : '—'}</div><div className="opacity-50">{fmtMonth(p.month, g?.start_date)}</div></Td>
                        <Td right className="font-bold text-[var(--success)]">{fmt(p.amount)}</Td>
                        <Td right>{can('deletePayment') && <button onClick={() => handleDeletePayment(p.id)} className="text-[var(--danger)] opacity-50 hover:opacity-100"><Trash2 size={14}/></button>}</Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border)' }}><Btn variant="secondary" onClick={() => setHistoryModal(null)}>Close</Btn></div>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
