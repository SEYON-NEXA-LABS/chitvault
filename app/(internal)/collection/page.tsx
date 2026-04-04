'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, cn } from '@/lib/utils'
import {
  TableCard, Table, Th, Td, Tr,
  Loading, Empty, Badge, StatCard, Btn, Modal, Field, Toast
} from '@/components/ui'
import { downloadCSV } from '@/lib/utils/csv'
import { useToast } from '@/lib/hooks/useToast'
import { Printer, Phone, MapPin, Search, FileSpreadsheet, ShieldAlert, AlertTriangle, AlertCircle, MessageSquare, ExternalLink, CreditCard } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { useRouter } from 'next/navigation'
import type { Group, Member, Auction, Payment, Person } from '@/types'

interface MemberDue {
  group: Group;
  month: number;
  amountDue: number;
  amountPaid: number;
  balance: number;
  isAuctioned: boolean;
}

interface CollectionItem {
  member: Member;
  person: Person;
  dues: MemberDue[];
  totalBalance: number;
  overdueCount: number;
}

export default function CollectionPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm } = useFirm()
  const router = useRouter()
  const { t } = useI18n()
  const { toast, show, hide } = useToast()

  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [saving,   setSaving]   = useState(false)

  const [payModal, setPayModal] = useState<CollectionItem | null>(null)
  const [payForm,  setPayForm]  = useState({ amount: '', date: new Date().toISOString().split('T')[0], mode: 'Cash', note: '', isManual: false, manualAllocations: {} as Record<string, string> })

  const load = useCallback(async () => {
    if (!firm) return
    setLoading(true)
    const [g, m, a, p] = await Promise.all([
      supabase.from('groups').select('*').eq('firm_id', firm.id).neq('status','archived'),
      supabase.from('members').select('*, persons(*)').eq('firm_id', firm.id).is('deleted_at', null),
      supabase.from('auctions').select('*').eq('firm_id', firm.id).is('deleted_at', null).order('month'),
      supabase.from('payments').select('*').eq('firm_id', firm.id).is('deleted_at', null)
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }, [firm, supabase])

  useEffect(() => { load() }, [load])

  const reportData: CollectionItem[] = useMemo(() => {
    // 1. Calculate membership-level balances
    const balances = members.map(m => {
      if (!m.persons) return null;
      const g = groups.find(x => x.id === m.group_id);
      if (!g) return null;

      const gAucs = auctions.filter(a => a.group_id === g.id);
      const gPays = payments.filter(p => p.member_id === m.id && p.group_id === g.id);
      const currentMonth = Math.min(g.duration, gAucs.length + 1);
      
      const mDues: MemberDue[] = [];
      for (let month = 1; month <= currentMonth; month++) {
        const prevMonthAuc = gAucs.find(a => a.month === month - 1);
        const dividend = prevMonthAuc ? Number(prevMonthAuc.dividend || 0) : 0;
        const amountDue = Number(g.monthly_contribution) - dividend;
        const amountPaid = gPays.filter(p => p.month === month).reduce((s, p) => s + Number(p.amount), 0);
        const balance = Math.max(0, amountDue - amountPaid);
        if (balance > 0.01) {
          mDues.push({ group: g, month, amountDue, amountPaid, balance, isAuctioned: !!gAucs.find(a => a.month === month) });
        }
      }

      const totalBalance = mDues.reduce((s, d) => s + d.balance, 0);
      return totalBalance > 0.01 ? { member: m, person: m.persons, group: g, dues: mDues, totalBalance, overdueCount: mDues.length } : null;
    }).filter(Boolean) as any[];

    // 2. Group by Person
    const personMap = new Map<number, CollectionItem>();
    balances.forEach((item: any) => {
      const pId = item.person.id;
      if (!personMap.has(pId)) {
        personMap.set(pId, { 
            person: item.person, 
            totalBalance: 0, 
            dues: [], 
            member: item.member, // placeholder for high-level ref
            overdueCount: 0,
            memberships: [] 
        } as any);
      }
      const pData = personMap.get(pId) as any;
      pData.totalBalance += item.totalBalance;
      pData.overdueCount = Math.max(pData.overdueCount, item.overdueCount);
      pData.memberships.push(item);
    });

    return Array.from(personMap.values());
  }, [members, groups, auctions, payments]);

  const filtered = useMemo(() => {
    return reportData.filter(x => 
      x.person.name.toLowerCase().includes(search.toLowerCase()) ||
      (x.person.phone && x.person.phone.includes(search)) ||
      (x.person.address && x.person.address.toLowerCase().includes(search.toLowerCase()))
    ).sort((a,b) => b.totalBalance - a.totalBalance);
  }, [reportData, search]);

  const stats = useMemo(() => {
    const totalOut = filtered.reduce((s, x) => s + x.totalBalance, 0);
    const critical = filtered.filter(x => x.overdueCount >= 3).length;
    return { totalOut, critical };
  }, [filtered]);

  async function handlePay() {
    if (!payModal || !firm) return;
    const amount = Number(payForm.amount);
    if (amount <= 0) { show('Enter a valid amount', 'error'); return; }
    
    setSaving(true);
    let remaining = amount;
    const finalPayments = [];

    // Auto-distribution logic
    const allDues = (payModal as any).memberships.flatMap((m: any) => m.dues.map((d: any) => ({ ...d, memberId: m.member.id })))
        .sort((a: any, b: any) => a.month - b.month);

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

    if (finalPayments.length === 0) { show('No allocations made', 'error'); setSaving(false); return; }

    const { error } = await supabase.from('payments').insert(finalPayments);
    if (error) { show(error.message, 'error'); }
    else { 
      show(`Collected ₹${amount}! Distribution handled.`); 
      setPayModal(null); 
      load(); 
    }
    setSaving(false);
  }

  const handleWhatsAppReminder = (p: any) => {
    const phone = p.person.phone ? p.person.phone.replace(/[^\d]/g, '') : ''
    if (!phone) return show('No phone number found', 'error')
    
    const text = `Hi ${p.person.name}, Reminder from ${firm?.name}. Outstanding: ₹${p.totalBalance.toLocaleString('en-IN')}. Please clear your dues at the earliest. Thank you!`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-20">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" id="tour-coll-stat">
        <StatCard label="Total Reach" value={fmt(stats.totalOut)} color="danger" />
        <StatCard label="Pending Visits" value={filtered.length} color="accent" />
        <StatCard label="Critical (>3m)" value={stats.critical} color="danger" />
      </div>

      <div className="flex gap-4 items-center bg-[var(--surface)] p-3 rounded-2xl border no-print" style={{ borderColor: 'var(--border)' }} id="tour-coll-search">
        <div className="flex-1 relative">
           <input className={inputClass} style={{ ...inputStyle, paddingLeft: 40 }} 
            placeholder="Search name, phone, area..." value={search} onChange={e => setSearch(e.target.value)} />
           <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30" />
        </div>
        <Btn variant="secondary" onClick={() => window.print()} icon={Printer} className="hidden sm:flex">Print Hub</Btn>
      </div>

      {/* Field View (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         {filtered.length === 0 ? (
           <div className="col-span-full"><Empty text="Clean slate! No pending collections." /></div>
         ) : filtered.map((x, idx) => (
           <div key={x.person.id} className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col">
              <div className="p-5 flex-1">
                 <div className="flex justify-between items-start gap-3 mb-4">
                    <div>
                       <div className="font-bold text-lg leading-tight">{x.person.name}</div>
                       <div className="text-xs opacity-50 mt-1 flex items-center gap-1"><MapPin size={12}/> {x.person.address || 'Unknown Area'}</div>
                    </div>
                    {x.overdueCount >= 3 ? (
                       <div className="bg-[var(--danger-dim)] text-[var(--danger)] text-[10px] font-black px-2 py-1 rounded-lg uppercase animate-pulse">Critical</div>
                    ) : (
                       <Badge variant="accent" className="text-[9px] uppercase tracking-wider">{x.overdueCount} Months</Badge>
                    )}
                 </div>

                 <div className="space-y-2 mb-6">
                    {(x as any).memberships.map((m: any) => (
                       <div key={m.member.id} className="flex justify-between items-center text-xs bg-[var(--surface2)] px-3 py-2 rounded-xl">
                          <span className="opacity-60">{m.group.name} (#{m.member.ticket_no})</span>
                          <span className="font-bold">{fmt(m.totalBalance)}</span>
                       </div>
                    ))}
                 </div>

                 <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div>
                       <div className="text-[10px] uppercase opacity-40 font-bold tracking-widest">To Collect</div>
                       <div className="text-xl font-black text-[var(--danger)]">{fmt(x.totalBalance)}</div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleWhatsAppReminder(x)} className="w-10 h-10 rounded-full border border-[var(--border)] flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/10 transition-colors">
                          <MessageSquare size={18} fill="currentColor" />
                       </button>
                       <a href={`tel:${x.person.phone}`} className="w-10 h-10 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--info)] hover:bg-[var(--info-dim)]">
                          <Phone size={18} />
                       </a>
                    </div>
                 </div>
              </div>
              <button 
                onClick={() => {
                   setPayForm({ amount: String(x.totalBalance), date: new Date().toISOString().split('T')[0], mode: 'Cash', note: '', isManual: false, manualAllocations: {} });
                   setPayModal(x);
                }}
                className="w-full py-4 bg-[var(--accent)] text-white font-bold text-sm uppercase tracking-widest hover:bg-[var(--accent-hover)] transition-colors flex items-center justify-center gap-2"
                id={idx === 0 ? "tour-coll-pay" : undefined}
              >
                 <CreditCard size={18} />
                 Record Collection
              </button>
           </div>
         ))}
      </div>

      {payModal && (
        <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Field Collection Entry" size="md">
           <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)]">
                 <div className="text-xs uppercase opacity-40 font-bold mb-1">Collecting From</div>
                 <div className="font-bold text-lg">{payModal.person.name}</div>
                 <div className="text-xl font-black text-[var(--danger)] mt-2">{fmt(payModal.totalBalance)} <span className="text-[10px] opacity-40 font-normal">outstanding</span></div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                 <Field label="Amount Collected">
                    <input className={inputClass} style={{ ...inputStyle, fontSize: 24, padding: '15px' }} type="number" 
                      value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} />
                 </Field>
                 <div className="grid grid-cols-2 gap-4">
                    <Field label="Date"><input className={inputClass} style={inputStyle} type="date" value={payForm.date} onChange={e => setPayForm(f => ({...f, date: e.target.value}))} /></Field>
                    <Field label="Mode">
                       <select className={inputClass} style={inputStyle} value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}>
                          <option>Cash</option><option>UPI</option><option>GPay</option>
                       </select>
                    </Field>
                 </div>
                 <Field label="Short Note (Optional)">
                    <textarea className={inputClass} style={{ ...inputStyle, height: 60 }} placeholder="House locked, paid later etc" 
                      value={payForm.note} onChange={e => setPayForm(f => ({...f, note: e.target.value}))} />
                 </Field>
              </div>

              <div className="flex gap-3 pt-4">
                 <Btn variant="secondary" className="flex-1" onClick={() => setPayModal(null)}>Cancel</Btn>
                 <Btn variant="primary" className="flex-[2]" loading={saving} onClick={handlePay}>Confirm Collection</Btn>
              </div>
           </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; padding: 0 !important; }
          .page-break { page-break-after: always; }
        }
      `}</style>
    </div>
  )
}

const inputClass = 'w-full px-4 py-3 rounded-2xl border text-base outline-none transition-all focus:ring-2 focus:ring-[var(--accent)] font-medium shadow-sm'
const inputStyle = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }
