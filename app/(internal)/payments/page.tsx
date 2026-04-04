'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate, fmtMonth, cn } from '@/lib/utils'
import { Btn, Badge, Card, Loading, Empty, Toast, Chip, Modal, Field, StatCard, Table, Th, Td, Tr, TableCard } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { useFirm } from '@/lib/firm/context'
import { logActivity } from '@/lib/utils/logger'
import type { Group, Member, Auction, Payment, Person, Firm } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { CreditCard, Search, History, ChevronRight, AlertCircle, CheckCircle2, Trash2 } from 'lucide-react'

interface MemberDue {
  group: Group;
  month: number;
  amountDue: number;
  amountPaid: number;
  balance: number;
  isAuctioned: boolean;
  dividend: number;
}

interface MemberSummary {
  member: Member;
  group: Group;
  dues: MemberDue[];
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
}

interface PersonSummary {
  person: Person;
  memberships: MemberSummary[];
  overallTotalDue: number;
  overallTotalPaid: number;
  overallTotalBalance: number;
  lastPaymentDate: string | null;
}

export default function PaymentsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const { toast, show, hide } = useToast()
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
  const [payForm,  setPayForm]  = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'Cash', note: '', isManual: false, manualAllocations: {} as Record<string, string> })
  const [historyModal, setHistoryModal] = useState<PersonSummary | null>(null)

  const load = useCallback(async (isInitial = false) => {
    if (isInitial && groups.length === 0) setLoading(true)
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
  }, [supabase, isSuper, switchedFirmId, firm, firms.length])

  useEffect(() => { load(true) }, [load])

  const personSummaries: PersonSummary[] = useMemo(() => {
    // 1. Calculate membership-level summaries first
    const mSummaries = members.map((m: Member) => {
      if (!m.persons) return null;
      const group = groups.find((g: Group) => g.id === m.group_id);
      if (!group) return null;

      const gAucs = auctions.filter((a: Auction) => a.group_id === group.id);
      const mPays = payments.filter((p: Payment) => p.member_id === m.id && p.group_id === group.id);
      const currentMonth = Math.min(group.duration, gAucs.length + 1);
      
      const mDues: MemberDue[] = [];
      let mTotalDue = 0;
      for (let month = 1; month <= currentMonth; month++) {
        // Dividend Calculation (Next Month Rule):
        // Month 1 is always full. Month 2 is reduced by Auction 1's dividend.
        const prevMonthAuc = gAucs.find((a: Auction) => a.month === month - 1);
        const dividend = prevMonthAuc ? Number(prevMonthAuc.dividend || 0) : 0;
        
        const amountDue = Number(group.monthly_contribution) - dividend;
        const amountPaid = mPays.filter((p: Payment) => p.month === month).reduce((s: number, p: Payment) => s + Number(p.amount), 0);
        
        // Month-level balance for display (not for total sum to avoid Math.max issues)
        const displayBalance = Math.max(0, amountDue - amountPaid);
        
        mTotalDue += amountDue;
        
        if (displayBalance > 0.01 || amountPaid > 0) {
          mDues.push({ group, month, amountDue, amountPaid, balance: displayBalance, isAuctioned: !!gAucs.find(a => a.month === month), dividend });
        }
      }

      const mTotalPaid = mPays.reduce((s, p) => s + Number(p.amount), 0);
      const mNetBalance = Math.max(0, mTotalDue - mTotalPaid);

      return {
        member: m, group, dues: mDues,
        totalDue: mTotalDue,
        totalPaid: mTotalPaid,
        totalBalance: mNetBalance,
      };
    }).filter(Boolean) as MemberSummary[];

    // 2. Group by Person
    const personMap = new Map<number, PersonSummary>();
    mSummaries.forEach((ms: MemberSummary) => {
      const pId = ms.member.person_id;
      if (!personMap.has(pId)) {
        personMap.set(pId, {
          person: ms.member.persons!,
          memberships: [],
          overallTotalDue: 0,
          overallTotalPaid: 0,
          overallTotalBalance: 0,
          lastPaymentDate: null
        });
      }
      const pSummary = personMap.get(pId)!;
      pSummary.memberships.push(ms);
      pSummary.overallTotalDue += ms.totalDue;
      pSummary.overallTotalPaid += ms.totalPaid;
      pSummary.overallTotalBalance += ms.totalBalance;
      
      const lastPay = payments.filter(p => p.member_id === ms.member.id)[0];
      if (lastPay && (!pSummary.lastPaymentDate || lastPay.payment_date! > pSummary.lastPaymentDate)) {
        pSummary.lastPaymentDate = lastPay.payment_date;
      }
    });

    return Array.from(personMap.values());
  }, [members, groups, auctions, payments]);

  // Handle URL-based Auto-selection (from Collection Registry)
  useEffect(() => {
    if (qPersonId && personSummaries.length > 0 && !payModal) {
      const target = personSummaries.find(s => String(s.person.id) === qPersonId)
      if (target && target.overallTotalBalance > 0.01) {
        setPayForm({ 
          amount: String(target.overallTotalBalance), 
          date: new Date().toISOString().split('T')[0], 
          mode: 'Cash', 
          note: 'Quick collection from registry', 
          isManual: false, 
          manualAllocations: {} 
        });
        setPayModal(target);
      }
    }
  }, [qPersonId, personSummaries.length, payModal])

  const filtered = useMemo(() => {
    return personSummaries.filter((s: PersonSummary) => {
      const matchSearch = s.person.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.person.phone && s.person.phone.includes(search));
      
      if (!matchSearch) return false;

      if (showOnlyPaid && dateRange.start && dateRange.end) {
        // Person must have at least one payment in the range
        const hasPaymentInRange = payments.some(p => 
          s.memberships.some(ms => ms.member.id === p.member_id) && 
          p.payment_date! >= dateRange.start && 
          p.payment_date! <= dateRange.end
        );
        if (!hasPaymentInRange) return false;
      }

      return true;
    }).sort((a: PersonSummary, b: PersonSummary) => b.overallTotalBalance - a.overallTotalBalance);
  }, [personSummaries, search, showOnlyPaid, dateRange, payments]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const collectedToday = payments.filter((p: Payment) => p.payment_date === today).reduce((s: number, p: Payment) => s + Number(p.amount), 0);
    
    let collectedInRange = 0;
    if (dateRange.start && dateRange.end) {
      collectedInRange = payments.filter((p: Payment) => 
        p.payment_date! >= dateRange.start && p.payment_date! <= dateRange.end
      ).reduce((s: number, p: Payment) => s + Number(p.amount), 0);
    }

    const totalOut = personSummaries.reduce((s: number, p: PersonSummary) => s + p.overallTotalBalance, 0);
    return { collectedToday, totalOut, collectedInRange };
  }, [payments, personSummaries, dateRange]);

  async function handlePay() {
    if (!payModal || !firm) return;
    const amount = Number(payForm.amount);
    if (amount <= 0) { show('Enter a valid amount', 'error'); return; }
    
    setSaving(true);
    let remaining = amount;
    const finalPayments = [];

    if (payForm.isManual) {
      // Use manual allocations
      for (const [key, val] of Object.entries(payForm.manualAllocations)) {
        const amt = Number(val);
        if (amt <= 0) continue;
        
        const [mId, month] = key.split('-').map(Number);
        const m = payModal.memberships.find(x => x.member.id === mId);
        const due = m?.dues.find(d => d.month === month);
        if (!m || !due) continue;

        finalPayments.push({
          firm_id: firm.id,
          member_id: mId,
          group_id: m.group.id,
          month: month,
          amount: amt,
          status: (due.amountPaid + amt) >= due.amountDue ? 'paid' : 'partial',
          amount_due: due.amountDue,
          balance_due: Math.max(0, due.amountDue - due.amountPaid - amt),
          payment_date: payForm.date,
          mode: payForm.mode,
          payment_type: (due.amountPaid + amt) >= due.amountDue ? 'full' : 'partial',
          note: payForm.note
        });
      }
    } else {
      // Auto-distribution logic
      // All dues of this person across all memberships, sorted by month
      const allDues = payModal.memberships.flatMap(m => m.dues.map(d => ({ ...d, memberId: m.member.id })))
        .sort((a, b) => a.month - b.month);

      for (const due of allDues) {
        if (remaining <= 0) break;
        if (due.balance <= 0) continue;

        const toPay = Math.min(remaining, due.balance);
        remaining -= toPay;

        finalPayments.push({
          firm_id: firm.id,
          member_id: due.memberId,
          group_id: due.group.id,
          month: due.month,
          amount: toPay,
          status: (due.amountPaid + toPay) >= due.amountDue ? 'paid' : 'partial',
          amount_due: due.amountDue,
          balance_due: Math.max(0, due.amountDue - due.amountPaid - toPay),
          payment_date: payForm.date,
          mode: payForm.mode,
          payment_type: (due.amountPaid + toPay) >= due.amountDue ? 'full' : 'partial',
          note: payForm.note
        });
      }

      // Residual amount goes to the first membership's next month
      if (remaining > 0 && payModal.memberships.length > 0) {
        const ms = payModal.memberships[0];
        const nextMonth = (ms.dues.length > 0 ? Math.max(...ms.dues.map(d => d.month)) : 0) + 1;
        if (nextMonth <= ms.group.duration) {
          finalPayments.push({
            firm_id: firm.id,
            member_id: ms.member.id,
            group_id: ms.group.id,
            month: nextMonth,
            amount: remaining,
            status: remaining >= ms.group.monthly_contribution ? 'paid' : 'partial',
            amount_due: ms.group.monthly_contribution,
            balance_due: Math.max(0, ms.group.monthly_contribution - remaining),
            payment_date: payForm.date,
            mode: payForm.mode,
            payment_type: remaining >= ms.group.monthly_contribution ? 'full' : 'partial',
            note: payForm.note
          });
        }
      }
    }

    if (finalPayments.length === 0) { show('No allocations made', 'error'); setSaving(false); return; }

    const { data: created, error } = await supabase.from('payments').insert(finalPayments).select();
    if (error) { show(error.message, 'error'); }
    else { 
      show(`Recorded ${finalPayments.length} payment segments!`); 
      
      if (payModal.person) {
        await logActivity(
          firm.id,
          'PAYMENT_RECORDED',
          'payment',
          created?.[0]?.id || null,
          { 
            person_name: payModal.person.name, 
            total_amount: amount, 
            segments: finalPayments.length 
          }
        );
      }

      setPayModal(null); 
      load(); 
    }
    setSaving(false);
  }

  async function handleDeletePayment(paymentId: number) {
    if (!can('deletePayment')) return;
    if (!window.confirm('Are you sure you want to move this payment record to trash?')) return;
    
    // Get details for logging BEFORE delete
    const payment = payments.find(p => p.id === paymentId);
    
    // Double-guard delete with firm_id for SaaS isolation
    const { error } = await supabase.from('payments').update({ deleted_at: new Date() }).eq('id', paymentId).eq('firm_id', firm?.id);
    if (error) {
      show(error.message, 'error');
    } else {
      show('Payment moved to trash!');
      if (payment && firm) {
        await logActivity(
          firm.id,
          'PAYMENT_ARCHIVED',
          'payment',
          paymentId,
          { amount: payment.amount, month: payment.month }
        );
      }
      load();
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-[var(--text)]">Payments Ledger</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Collected Today" value={fmt(stats.collectedToday)} color="success" />
        {dateRange.start && dateRange.end && (
          <StatCard label="Collected in Range" value={fmt(stats.collectedInRange)} color="info" />
        )}
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
          <div className="flex items-center gap-2">
            <input type="date" className={inputClass} style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 13 }} 
              value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} />
            <span className="opacity-30">to</span>
            <input type="date" className={inputClass} style={{ ...inputStyle, width: 'auto', padding: '6px 10px', fontSize: 13 }} 
              value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} />
          </div>
          
          {(dateRange.start || dateRange.end) && (
            <button onClick={() => setDateRange({ start: '', end: '' })} className="text-[10px] uppercase font-bold text-[var(--danger)] hover:underline">
              Clear
            </button>
          )}

          <div className="h-6 w-px bg-[var(--border)] mx-1 hidden md:block" />

          <label className="flex items-center gap-2 text-xs font-bold whitespace-nowrap cursor-pointer select-none">
            <input type="checkbox" checked={showOnlyPaid} onChange={e => setShowOnlyPaid(e.target.checked)} />
            Show only paid
          </label>
        </div>
      </div>

      <TableCard title="Collection Ledger (Person-Centric)" subtitle="Manage total individual dues, track payment history, and distribute lump-sum payments across all tickets.">
        <Table>
          <thead>
            <Tr>
              <Th>Person / Active Tickets</Th>
              <Th className="hidden md:table-cell">Last Activity</Th>
              <Th className="hidden sm:table-cell">Account Status</Th>
              <Th right>Total Balance</Th>
              {dateRange.start && dateRange.end && <Th right>Paid in Range</Th>}
              <Th right>Action</Th>
            </Tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={5}><Empty text="No matching persons found." /></Td></Tr>
            ) : filtered.map(s => (
              <Tr key={s.person.id}>
                <Td>
                  <div className="font-bold text-base">{s.person.name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.memberships.map(m => (
                      <Badge key={m.member.id} variant="gray" className="text-[9px] lowercase opacity-70">
                        {m.group.name} (#{m.member.ticket_no})
                      </Badge>
                    ))}
                  </div>
                </Td>
                <Td className="hidden md:table-cell">
                   {s.lastPaymentDate ? (
                     <div className="text-xs">
                        {fmtDate(s.lastPaymentDate)}
                        <div className="text-[10px] opacity-40">Latest payment</div>
                     </div>
                   ) : <span className="text-xs opacity-30">—</span>}
                </Td>
                <Td className="hidden sm:table-cell">
                  {s.overallTotalBalance <= 0.01 ? (
                    <Badge variant="success">Clear Account</Badge>
                  ) : (
                    <Badge variant="danger">{s.memberships.filter(m => m.totalBalance > 0).length} Tickets Pending</Badge>
                  )}
                </Td>
                <Td right>
                   <div className={cn("font-bold font-mono text-base", s.overallTotalBalance > 0.01 ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                      {fmt(s.overallTotalBalance)}
                   </div>
                </Td>
                {dateRange.start && dateRange.end && (
                   <Td right>
                      <div className="font-mono font-bold text-[var(--success)]">
                        {(() => {
                           const collected = payments.filter(p => 
                             s.memberships.some(ms => ms.member.id === p.member_id) && 
                             p.payment_date! >= dateRange.start && 
                             p.payment_date! <= dateRange.end
                           ).reduce((sum, p) => sum + Number(p.amount), 0);
                           return fmt(collected);
                        })()}
                      </div>
                   </Td>
                 )}
                <Td right>
                  <div className="flex gap-1 justify-end">
                    <Btn size="sm" variant="ghost" icon={History} onClick={() => setHistoryModal(s)}>Ledger</Btn>
                    <Btn size="sm" variant="primary" icon={CreditCard} onClick={() => {
                        setPayForm({ amount: String(s.overallTotalBalance), date: new Date().toISOString().split('T')[0], mode: 'Cash', note: '', isManual: false, manualAllocations: {} });
                        setPayModal(s);
                    }}>Collect</Btn>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableCard>

      {payModal && (
        <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Consolidated Payment" size="lg">
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--surface2)]">
              <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xl font-bold">
                {payModal.person.name.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="font-bold text-lg">{payModal.person.name}</div>
                <div className="text-xs opacity-50 font-mono tracking-tight">
                  {payModal.person.phone} · {payModal.memberships.length} active tickets
                </div>
              </div>
              <div className="text-right">
                 <div className="text-[10px] uppercase opacity-40">Total Outstanding</div>
                 <div className="text-xl font-black text-[var(--danger)]">{fmt(payModal.overallTotalBalance)}</div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                 <div className="text-xs font-bold uppercase opacity-40">Outstanding Dues</div>
                 <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                    <input type="checkbox" checked={payForm.isManual} onChange={e => setPayForm(f => ({ ...f, isManual: e.target.checked }))} />
                    <span className="font-bold">Manual Allocation</span>
                 </label>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border p-2" style={{ borderColor: 'var(--border)' }}>
                {payModal.memberships.flatMap(m => m.dues.filter(d=>d.balance > 0.01).map(d => {
                  const key = `${m.member.id}-${d.month}`;
                  return (
                    <div key={key} className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--surface2)] text-xs border border-transparent hover:border-[var(--border)] transition-all">
                      <div className="flex-1">
                         <div className="font-bold">{m.group.name} · {fmtMonth(d.month, m.group.start_date)}</div>
                         <div className="text-[9px] opacity-40">Ticket #{m.member.ticket_no}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right min-w-[80px]">
                           <div className="font-bold text-[var(--danger)]">{fmt(d.balance)}</div>
                           <div className="text-[9px] opacity-40 font-mono">Bal: {fmt(d.amountDue)}</div>
                        </div>
                        {payForm.isManual && (
                          <div className="w-24">
                             <input 
                               className={inputClass} 
                               style={{ ...inputStyle, padding: '4px 8px', fontSize: '11px' }} 
                               type="number"
                               placeholder="Amt"
                               value={payForm.manualAllocations[key] || ''}
                               onChange={e => {
                                 const val = e.target.value;
                                 setPayForm(f => {
                                   const next = { ...f.manualAllocations, [key]: val };
                                   const newTotal = Object.values(next).reduce((s, v) => s + Number(v || 0), 0);
                                   return { ...f, manualAllocations: next, amount: String(newTotal) };
                                 });
                               }}
                             />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
              <div className="space-y-4">
                <Field label="Total Amount Received">
                  <input className={inputClass} style={inputStyle} type="number" 
                    readOnly={payForm.isManual}
                    value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} />
                  <p className="text-[10px] opacity-40 italic mt-1">
                    {payForm.isManual ? "* This is the sum of manual allocations defined above." : "* Amount will be automatically distributed starting from oldest dues."}
                  </p>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Payment Date">
                    <input className={inputClass} style={inputStyle} type="date" 
                      value={payForm.date} onChange={e => setPayForm(f => ({...f, date: e.target.value}))} />
                  </Field>
                  <Field label="Mode">
                    <select className={inputClass} style={inputStyle} 
                      value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}>
                      <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Cheque</option>
                    </select>
                  </Field>
                </div>
              </div>
              <Field label="Note / Remarks">
                <textarea className={cn(inputClass, "h-full min-h-[120px] text-xs resize-none")} style={inputStyle} 
                  placeholder="e.g. Received total cash at home for all tickets" 
                  value={payForm.note} onChange={e => setPayForm(f => ({...f, note: e.target.value}))} />
              </Field>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Btn variant="secondary" onClick={() => setPayModal(null)}>Cancel</Btn>
              <Btn variant="primary" loading={saving} onClick={handlePay}>Confirm & Distribute Payment</Btn>
            </div>
          </div>
        </Modal>
      )}

      {historyModal && (
        <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title="Consolidated Personal Ledger" size="lg">
          <div className="space-y-6">
            <div className="text-center">
               <div className="font-bold text-xl">{historyModal.person.name}</div>
               <div className="text-xs opacity-50">Combined History for {historyModal.memberships.length} tickets</div>
            </div>
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <Table>
                <thead>
                  <Tr>
                    <Th>Date</Th>
                    <Th>Target Ticket/Month</Th>
                    <Th>Mode</Th>
                    <Th right>Amount</Th>
                    {can('deletePayment') && <Th className="w-10">{""}</Th>}
                  </Tr>
                </thead>
                <tbody>
                  {payments.filter(p => historyModal.memberships.some(ms => ms.member.id === p.member_id)).map(p => {
                    const group = groups.find(g => g.id === p.group_id);
                    return (
                      <Tr key={p.id}>
                        <Td>{fmtDate(p.payment_date)}</Td>
                        <Td className="text-xs">
                           <div className="font-bold">{group?.name}</div>
                           <div className="opacity-50 text-[10px]">{fmtMonth(p.month, group?.start_date)}</div>
                        </Td>
                        <Td><Badge variant="gray" className="text-[8px] uppercase">{p.mode}</Badge></Td>
                        <Td right className="font-bold text-[var(--success)]">{fmt(p.amount)}</Td>
                        {can('deletePayment') && (
                          <Td right>
                            <button 
                              onClick={() => handleDeletePayment(Number(p.id))} 
                              className="p-1.5 hover:bg-[var(--danger-dim)] text-[var(--danger)] rounded-md transition-colors opacity-70 hover:opacity-100"
                              title="Delete Payment"
                            >
                              <Trash2 size={14} />
                            </button>
                          </Td>
                        )}
                      </Tr>
                    );
                  })}
                  {!payments.some(p => historyModal.memberships.some(ms => ms.member.id === p.member_id)) && (
                    <Tr><Td colSpan={4} className="text-center py-10 opacity-30">No payments recorded yet.</Td></Tr>
                  )}
                </tbody>
              </Table>
            </div>
            <div className="flex justify-end pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="secondary" onClick={() => setHistoryModal(null)}>Close</Btn>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
