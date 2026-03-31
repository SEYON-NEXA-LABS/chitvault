'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, cn } from '@/lib/utils'
import {
  TableCard, Table, Th, Td, Tr,
  Loading, Empty, Badge, StatCard, Btn
} from '@/components/ui'
import { downloadCSV } from '@/lib/utils/csv'
import { Printer, Phone, MapPin, Search, FileSpreadsheet } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
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
  const supabase = createClient()
  const { firm } = useFirm()
  const { t } = useI18n()
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')

  const load = useCallback(async () => {
    if (!firm) return
    setLoading(true)
    const [g, m, a, p] = await Promise.all([
      supabase.from('groups').select('*').eq('firm_id', firm.id).neq('status','archived'),
      supabase.from('members').select('*, persons(*)').eq('firm_id', firm.id),
      supabase.from('auctions').select('*').eq('firm_id', firm.id).order('month'),
      supabase.from('payments').select('*').eq('firm_id', firm.id)
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }, [firm, supabase])

  useEffect(() => { load() }, [load])

  const reportData: any[] = useMemo(() => {
    // 1. Calculate membership-level balances
    const balances = members.map(m => {
      if (!m.persons) return null;
      const g = groups.find(x => x.id === m.group_id);
      if (!g) return null;

      const gAucs = auctions.filter(a => a.group_id === g.id);
      const gPays = payments.filter(p => p.member_id === m.id && p.group_id === g.id);
      const currentMonth = Math.min(g.duration, gAucs.length + 1);
      
      const mDues: any[] = [];
      for (let month = 1; month <= currentMonth; month++) {
        const auc = gAucs.find(a => a.month === month - 1);
        const dividend = auc ? Number(auc.dividend || 0) : 0;
        const amountDue = Number(g.monthly_contribution) - dividend;
        const amountPaid = gPays.filter(p => p.month === month).reduce((s, p) => s + Number(p.amount), 0);
        const balance = Math.max(0, amountDue - amountPaid);
        if (balance > 0.01) {
          mDues.push({ group: g, month, amountDue, amountPaid, balance, isAuctioned: !!auc });
        }
      }

      const totalBalance = mDues.reduce((s, d) => s + d.balance, 0);
      return totalBalance > 0.01 ? { member: m, person: m.persons, group: g, dues: mDues, totalBalance } : null;
    }).filter(Boolean);

    // 2. Group by Person
    const personMap = new Map<number, any>();
    balances.forEach((item: any) => {
      const pId = item.person.id;
      if (!personMap.has(pId)) {
        personMap.set(pId, { person: item.person, totalBalance: 0, items: [] });
      }
      const pData = personMap.get(pId);
      pData.totalBalance += item.totalBalance;
      pData.items.push(item);
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

  const handleExportCSV = () => {
    const csvData: any[] = [];
    filtered.forEach(p => {
      p.items.forEach((item: any) => {
        csvData.push({
          'Person Name': p.person.name,
          'Phone': p.person.phone || '',
          'Address': p.person.address || '',
          'Group Name': item.group.name,
          'Ticket No': item.member.ticket_no,
          'Outstanding Amount': item.totalBalance,
          'Unpaid Months': item.dues.map((d: any) => d.month).join(', ')
        });
      });
    });
    downloadCSV(csvData, 'collection_report');
  };

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('total_outstanding')} value={fmt(stats.totalOut)} color="danger" />
        <StatCard label={t('all_people')} value={filtered.length} color="accent" />
        <StatCard label={t('due_date')} value={stats.critical} color="danger" />
      </div>

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-[var(--surface)] p-3 rounded-2xl border no-print" style={{ borderColor: 'var(--border)' }}>
        <div className="flex-1 max-w-md relative">
           <input className={inputClass} style={{ ...inputStyle, paddingLeft: 40 }} 
            placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
           <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30" />
        </div>
        <div className="flex gap-2">
           <Btn variant="secondary" onClick={handleExportCSV} icon={FileSpreadsheet} title={t('export_people')}>CSV</Btn>
           <Btn variant="secondary" onClick={() => window.print()} icon={Printer}>{t('print')}</Btn>
        </div>
      </div>

      <TableCard title={`Consolidated Collection Report — ${fmtDate(new Date().toISOString())}`} subtitle={`${filtered.length} persons with active dues`}>
        <Table>
          <thead>
            <Tr>
              <Th>Person / Contact</Th>
              <Th>Area / Address</Th>
              <Th>Group Breakdowns</Th>
              <Th right>Total Outstanding</Th>
            </Tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={4}><Empty text="No pending collections found!" /></Td></Tr>
            ) : filtered.map(x => (
              <Tr key={x.person.id}>
                <Td>
                   <div className="font-bold text-base">{x.person.name}</div>
                   <div className="flex items-center gap-1.5 mt-0.5">
                      <Phone size={10} className="opacity-30" />
                      <a href={`tel:${x.person.phone}`} className="text-[11px] font-mono font-bold text-[var(--info)]">{x.person.phone || '—'}</a>
                   </div>
                </Td>
                <Td>
                   <div className="flex items-start gap-1.5 opacity-60 text-xs max-w-[200px]">
                      <MapPin size={12} className="opacity-half mt-0.5 flex-shrink-0" />
                      {x.person.address || '—'}
                   </div>
                </Td>
                <Td>
                    <div className="space-y-1.5">
                       {x.items.map((item: any) => (
                         <div key={item.member.id} className="text-[10px] bg-[var(--surface2)] p-1.5 rounded-lg border border-transparent hover:border-[var(--border)] transition-all">
                            <div className="flex justify-between items-center mb-1">
                               <span className="font-bold">{item.group.name} (#{item.member.ticket_no})</span>
                               <span className="font-mono font-bold">{fmt(item.totalBalance)}</span>
                            </div>
                            <div className="flex flex-wrap gap-1">
                               {item.dues.map((d: any) => (
                                 <Badge key={d.month} variant={d.isAuctioned ? 'danger' : 'accent'} className="text-[8px] px-1 py-0 shadow-sm">
                                    {fmtMonth(d.month, item.group.start_date)}{!d.isAuctioned && '*'}
                                 </Badge>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                </Td>
                <Td right>
                   <div className={cn("font-black font-mono text-lg", x.totalBalance > 10000 ? "text-[var(--danger)]" : "text-[var(--text)]")}>
                      {fmt(x.totalBalance)}
                   </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
        <div className="p-4 bg-[var(--surface2)] mt-5 rounded-bl-2xl rounded-br-2xl text-[10px] opacity-50 italic">
          * Yellow badges (M*) are upcoming dues before auction. Red badges indicate overdue after auction.
        </div>
      </TableCard>

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

const inputClass = 'w-full px-3 py-2.5 rounded-lg border text-base outline-none transition-colors focus:border-[var(--accent)] font-medium'
const inputStyle = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }
