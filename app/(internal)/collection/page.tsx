'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, getToday, cn, getGroupDisplayName } from '@/lib/utils'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'

import {
  TableCard, Table, Th, Td, Tr,
  Loading, Empty, Badge, StatCard, Btn, Modal, Field, Toast,
  inputClass, inputStyle
} from '@/components/ui'
import { downloadCSV } from '@/lib/utils/csv'
import { useToast } from '@/lib/hooks/useToast'
import { Printer, Phone, MapPin, Search, FileSpreadsheet, ShieldAlert, AlertTriangle, AlertCircle, MessageSquare, ExternalLink, CreditCard } from 'lucide-react'
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
  isOverdue: boolean;
}

export default function CollectionPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, profile } = useFirm()
  const router = useRouter()
  const { t } = useI18n()
  const { toast, show, hide } = useToast()

  const [groups, setGroups] = useState<Group[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const [payModal, setPayModal] = useState<CollectionItem | null>(null)
  const [payForm, setPayForm] = useState({ amount: '', date: getToday(), mode: 'Cash', note: '', isManual: false, manualAllocations: {} as Record<string, string> })

  const load = useCallback(async () => {
    if (!firm) return
    setLoading(true)
    const [g, m, a, p] = await Promise.all([
      supabase.from('groups').select('*').eq('firm_id', firm.id).neq('status', 'archived'),
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

      const fStatus = getMemberFinancialStatus(m, g, auctions, payments);
      const totalBalance = fStatus.balance;
      const overdueMonthsCount = fStatus.missedCount;

      const mDues = fStatus.streak.filter(d => d.status === 'danger' || d.status === 'info')
        .map(d => ({ ...d, group: g, isAuctioned: d.status === 'danger' }));

      return totalBalance > 0.01 ? {
        member: m, person: m.persons, group: g, dues: mDues,
        totalBalance,
        overdueCount: overdueMonthsCount,
        isOverdue: overdueMonthsCount > 0
      } : null;
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
    ).sort((a, b) => b.totalBalance - a.totalBalance);
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
      const bal = due.due - due.paid;
      if (bal <= 0.01) continue;

      const toPay = Math.min(remaining, bal);
      remaining -= toPay;

      finalPayments.push({
        firm_id: firm.id,
        member_id: due.memberId,
        group_id: due.group.id,
        month: due.month,
        amount: toPay,
        status: (due.paid + toPay) >= (due.due - 0.01) ? 'paid' : 'partial',
        amount_due: due.due,
        balance_due: Math.max(0, due.due - due.paid - toPay),
        payment_date: payForm.date,
        mode: payForm.mode,
        payment_type: (due.paid + toPay) >= (due.due - 0.01) ? 'full' : 'partial',
        collected_by: profile?.id || null,
        note: payForm.note
      });
    }

    if (finalPayments.length === 0) { show('No allocations made', 'error'); setSaving(false); return; }

    const { error } = await supabase.from('payments').insert(finalPayments);
    if (error) { show(error.message, 'error'); }
    else {
      show(`Collected ₹${amount}! Distribution handled.`);
      setPayModal(null);
      router.refresh();
      load();
    }
    setSaving(false);
  }

  const handleWhatsAppReminder = (p: any) => {
    const phone = p.person.phone ? p.person.phone.replace(/[^\d]/g, '') : ''
    if (!phone) return show('No phone number found', 'error')

    const isAcc = (p as any).memberships?.some((m: any) => m.group?.auction_scheme === 'ACCUMULATION')
    const term = isAcc ? 'Pending Contribution' : 'Outstanding Due'
    const text = `Hi ${p.person.name}, Reminder from ${firm?.name}. ${term}: ₹${p.totalBalance.toLocaleString('en-IN')}. Please clear it at the earliest. Thank you!`
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-8 pb-20">
      <div className="mesh-gradient rounded-[3rem] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 relative z-10">
          <div className="glass-card p-4 rounded-3xl flex flex-col justify-center border-white/20">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-60 mb-1">Total Reach</div>
            <div className="text-2xl font-black text-white italic">{fmt(stats.totalOut)}</div>
          </div>
          <div className="glass-card p-4 rounded-3xl flex flex-col justify-center border-white/20">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-60 mb-1">Pending Visits</div>
            <div className="text-2xl font-black text-white italic">{filtered.length}</div>
          </div>
          <div className="glass-card p-4 rounded-3xl flex flex-col justify-center border-white/20 hidden sm:flex">
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white opacity-60 mb-1">Critical {'>'}3m</div>
             <div className="text-2xl font-black text-white italic">{stats.critical}</div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-[var(--surface)] p-3 rounded-[2rem] neumo-out no-print" id="tour-coll-search">
        <div className="flex-1 relative">
          <input className={inputClass} style={{ ...inputStyle, paddingLeft: 44, height: 54, border: 'none' }}
            placeholder="Search name, phone, area..." value={search} onChange={e => setSearch(e.target.value)} />
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 opacity-20" />
        </div>
        <Btn variant="secondary" onClick={() => window.print()} icon={Printer} className="hidden sm:flex">Print Hub</Btn>
      </div>

      {/* Field View (Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.length === 0 ? (
          <div className="col-span-full"><Empty text="Clean slate! No pending collections." /></div>
        ) : filtered.map((x, idx) => (
          <div key={x.person.id} className="bg-[var(--surface)] rounded-[2.5rem] neumo-out transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl overflow-hidden flex flex-col border border-white/5">
            <div className="p-7 flex-1">
              <div className="flex justify-between items-start gap-3 mb-6">
                <div>
                  <div className="font-black text-2xl tracking-tighter leading-none italic uppercase">{x.person.name}</div>
                  <div className="text-[10px] font-bold opacity-40 mt-2 flex items-center gap-1.5 uppercase tracking-widest"><MapPin size={12} /> {x.person.address || 'Unknown Area'}</div>
                </div>
                {x.overdueCount >= 3 ? (
                  <div className="bg-[var(--danger)] text-white text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-lg shadow-red-500/20">Critical</div>
                ) : (
                  <div className="bg-[var(--accent-dim)] text-[var(--accent)] text-[9px] font-black px-3 py-1 rounded-full uppercase border border-[var(--accent-border)]">{x.overdueCount} Months</div>
                )}
              </div>

              <div className="space-y-2.5 mb-8">
                {(x as any).memberships.map((m: any) => (
                  <div key={m.member.id} className="flex justify-between items-center text-[11px] bg-[var(--surface2)] neumo-in px-4 py-3 rounded-2xl border border-white/5 font-bold">
                    <span className="opacity-50 uppercase tracking-tighter">{getGroupDisplayName(m.group, t)} · M {m.dues[0]?.month || '—'}</span>
                    <span className="font-black italic">{fmt(m.totalBalance)}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-end justify-between pt-6 border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <div className="text-[9px] uppercase opacity-30 font-black tracking-[0.2em] mb-1">
                    {(x as any).memberships?.some((m: any) => m.group?.auction_scheme === 'ACCUMULATION') ? 'Advance Target' : 'Liquidation Due'}
                  </div>
                  <div className={cn("text-3xl font-black italic tracking-tighter", x.isOverdue ? "text-[var(--danger)]" : "text-[#0ea5e9]")}>{fmt(x.totalBalance)}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleWhatsAppReminder(x)} className="w-12 h-12 rounded-2xl neumo-out flex items-center justify-center text-[#25D366] hover:bg-[#25D366]/5 transition-all active:neumo-in active:scale-90">
                    <MessageSquare size={20} fill="currentColor" />
                  </button>
                  <a href={`tel:${x.person.phone}`} className="w-12 h-12 rounded-2xl neumo-out flex items-center justify-center text-[var(--info)] hover:bg-[var(--info-dim)] transition-all active:neumo-in active:scale-90">
                    <Phone size={20} />
                  </a>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setPayForm({ amount: String(x.totalBalance), date: getToday(), mode: 'Cash', note: '', isManual: false, manualAllocations: {} });
                setPayModal(x);
              }}
              className="w-full py-5 bg-[var(--accent)] text-white font-black text-xs uppercase tracking-[0.2em] hover:brightness-110 active:brightness-90 transition-all flex items-center justify-center gap-2"
              id={idx === 0 ? "tour-coll-pay" : undefined}
            >
              <CreditCard size={18} />
              Record Payment
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
                  value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Date"><input className={inputClass} style={inputStyle} type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} /></Field>
                <Field label="Mode">
                  <select className={inputClass} style={inputStyle} value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}>
                    <option>Cash</option><option>UPI</option><option>GPay</option>
                  </select>
                </Field>
              </div>
              <Field label="Short Note (Optional)">
                <textarea className={inputClass} style={{ ...inputStyle, height: 60 }} placeholder="House locked, paid later etc"
                  value={payForm.note} onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} />
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

