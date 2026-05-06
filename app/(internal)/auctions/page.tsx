'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtMonth, fmtDate, getGroupDisplayName } from '@/lib/utils'
import { Btn, TableCard, Table, Th, Td, Tr, Loading, Toast, Pagination, Modal } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import Link from 'next/link'
import { FileSpreadsheet, ChevronLeft, ChevronRight, ExternalLink, Calculator, Info, Printer, CheckCircle2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { downloadCSV } from '@/lib/utils/csv'
import { useTerminology } from '@/lib/hooks/useTerminology'
import type { Group, Member, Auction, ForemanCommission, Firm } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'

const PAGE_SIZE = 20

export default function AuctionsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  const { toast, show, hide } = useToast()

  const [groups,      setGroups]      = useState<Group[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [auctions,    setAuctions]    = useState<Auction[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [loading,     setLoading]     = useState(true)
  
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedAuctionForBreakdown, setSelectedAuctionForBreakdown] = useState<number | null>(null)
  const [settlingAuctionId, setSettlingAuctionId] = useState<number | null>(null)

  const handleMarkSettled = async (id: number) => {
    const { error } = await supabase
      .from('auctions')
      .update({ 
        is_payout_settled: true, 
        payout_date: new Date().toISOString().split('T')[0] 
      })
      .eq('id', id)
      .eq('firm_id', firm?.id)

    if (error) show(error.message, 'error')
    else {
      show(t('status_updated'), 'success')
      setSettlingAuctionId(null)
      load()
    }
  }

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
    if (!targetId) return

    try {
      // 1. Fetch Paginated Auctions (Precision Columns)
      const { data: aData, count } = await withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_date, payout_date, winner_id, auction_discount, dividend, net_payout, status, is_payout_settled, firms(name)', { count: 'exact' }), targetId)
        .is('deleted_at', null)
        .order('month', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      
      setAuctions(aData || [])
      setTotalCount(count || 0)

      const relevantGroupIds = Array.from(new Set(aData?.map((a: any) => a.group_id) || []))
      const relevantWinnerIds = Array.from(new Set(aData?.map((a: any) => a.winner_id) || []))

      // 2. Fetch Supporting Metadata (Only what we need for the current page)
      const [g, m, fc] = await Promise.all([
        withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, auction_scheme, start_date'), targetId)
          .in('id', relevantGroupIds)
          .is('deleted_at', null),
        withFirmScope(supabase.from('members').select('id, ticket_no, group_id, person_id, status, persons(id, name)'), targetId)
          .in('id', relevantWinnerIds),
        withFirmScope(supabase.from('foreman_commissions').select('id, auction_id, group_id, month, chit_value, auction_discount, discount, commission_amt, commission_type, commission_rate, net_dividend, per_member_div, paid_to, foreman_member_id'), targetId)
          .in('auction_id', aData?.map((a: any) => a.id) || [])
      ])
      
      setGroups(g.data || [])
      setMembers(m.data || [])
      setCommissions(fc.data || [])
    } finally {
      setLoading(false)
    }
  }, [supabase, firm?.id, role, switchedFirmId, page])

  useEffect(() => { load(true) }, [load])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const pageYield = useMemo(() => auctions.reduce((s, a) => s + Number(a.auction_discount || 0), 0), [auctions])
  const pagePayouts = useMemo(() => auctions.reduce((s, a) => s + Number(a.net_payout || 0), 0), [auctions])

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{t('auction_ledger')}</h1>
          <p className="text-sub mt-1">{t('auctions_history_log')}</p>
        </div>
        <div className="flex gap-2">
           <Btn variant="secondary" size="sm" onClick={() => downloadCSV(auctions, 'auctions')} icon={FileSpreadsheet}>CSV</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 no-print">
        <div className="bg-[var(--surface)] p-4 rounded-3xl neumo-out">
          <div className="text-sub mb-1 text-sm font-medium">{t('page_yield')}</div>
          <div className="text-2xl font-black text-[var(--accent)]">{fmt(pageYield)}</div>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-3xl neumo-out">
          <div className="text-sub mb-1 text-sm font-medium">{t('total_payouts')}</div>
          <div className="text-2xl font-black text-[var(--success)]">{fmt(pagePayouts)}</div>
        </div>
      </div>

      <TableCard title={t('auction_ledger')} subtitle={`${t('page')} ${page} ${t('of')} ${totalPages || 1} • ${t('total_records')}: ${totalCount}`}>
        <Table responsive>
          <thead><tr>
            <Th>{t('group')}</Th>
            <Th>{t('auction_month')}</Th>
            <Th>{t('winner')}</Th>
            <Th right>{t('bid_amount')}</Th>
            <Th right>{t('net_payout')}</Th>
            <Th right>{t('actions')}</Th>
          </tr></thead>
          <tbody>
            {auctions.map(a => {
              const g = groups.find(x => x.id === a.group_id)
              const w = members.find(x => x.id === a.winner_id)
              const c = commissions.find(x => x.auction_id === a.id)
              
              return (
                <Tr key={a.id}>
                  <Td label="Group">
                    <Link href={`/groups/${a.group_id}`} className="flex flex-col min-h-[48px] justify-center hover:opacity-70 transition-opacity">
                      <span className="text-sm font-semibold text-[var(--accent)]">{g ? getGroupDisplayName(g, t) : '—'}</span>
                      <span className="text-xs text-sub flex items-center gap-1">
                        {t('group')} <ExternalLink size={8} />
                      </span>
                    </Link>
                  </Td>
                  <Td label="Month">
                    <div className="flex flex-col min-h-[48px] justify-center">
                      <span className="text-sm font-bold text-[var(--text)]">{fmtMonth(a.month, g?.start_date)}</span>
                      <span className="text-xs text-sub">{a.auction_date ? fmtDate(a.auction_date) : t('no_date_set')}</span>
                    </div>
                  </Td>
                  <Td label="Winner">
                    <div className="flex flex-col min-h-[48px] justify-center">
                      <span className="text-sm font-semibold text-[var(--text)] truncate max-w-[100px]">👑 {w?.persons?.name || '—'}</span>
                      <span className="text-xs text-sub">{w ? `Ticket #${w.ticket_no}` : 'N/A'}</span>
                    </div>
                  </Td>
                  <Td label="Bid" right>
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      <span className="text-sm font-bold text-[var(--danger)]">{fmt(a.auction_discount)}</span>
                      <span className="text-xs text-sub">{t('winning_bid_label')}</span>
                    </div>
                  </Td>
                  <Td label="Payout" right>
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      <span className="text-sm font-bold text-[var(--success)]">{fmt(a.net_payout)}</span>
                      <span className="text-xs text-sub">
                        {a.is_payout_settled ? `${t('payout_amt')}: ${fmtDate(a.payout_date || '')}` : t('unsettled')}
                      </span>
                    </div>
                  </Td>
                  <Td label="Actions" right>
                    <div className="flex items-center justify-end gap-2">
                       {!a.is_payout_settled && (
                         <button 
                           onClick={() => setSettlingAuctionId(a.id)}
                           className="p-2 rounded-xl bg-[var(--success-dim)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white transition-all"
                           title={t('mark_as_settled') || 'Mark as Paid'}
                         >
                           <CheckCircle2 size={18} />
                         </button>
                       )}
                       <button 
                         onClick={() => setSelectedAuctionForBreakdown(a.id)}
                         className="p-2 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all"
                         title={t('view_breakdown')}
                       >
                         <Info size={18} />
                       </button>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
        
        <Pagination 
          current={page} 
          total={totalCount} 
          pageSize={PAGE_SIZE} 
          onPageChange={setPage} 
        />
      </TableCard>

      {/* Auction Breakdown Modal */}
      <Modal 
        open={!!selectedAuctionForBreakdown} 
        onClose={() => setSelectedAuctionForBreakdown(null)} 
        title={t('auction_calculation_breakdown')}
      >
        {(() => {
          const a = auctions.find(x => x.id === selectedAuctionForBreakdown)
          const c = commissions.find(x => x.auction_id === selectedAuctionForBreakdown)
          const g = groups.find(x => x.id === a?.group_id)
          if (!a || !g) return null

          return (
            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                 <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('gross_chit_value')}</span>
                    <span className="text-sm font-black">{fmt(c?.chit_value || (g.monthly_contribution * g.duration))}</span>
                 </div>
                 <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('winning_bid_label')}</span>
                    <span className="text-sm font-black text-[var(--danger)]">- {fmt(a.auction_discount)}</span>
                 </div>
                 <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{t('foreman_commission')}</span>
                    <span className="text-sm font-black text-orange-600">- {fmt(c?.commission_amt || 0)}</span>
                 </div>
                 <div className="flex justify-between items-center pt-2">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-900">{t('net_dividend_payout')}</span>
                    <span className="text-base font-black text-[var(--success)]">{fmt(c?.net_dividend || (Number(a.dividend || 0) * g.duration))}</span>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-white border border-slate-100 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t('dividend_per_head')}</div>
                    <div className="text-lg font-black text-[var(--accent)]">{fmt(c?.per_member_div || a.dividend)}</div>
                 </div>
                 <div className="p-4 bg-white border border-slate-100 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t('net_payout')}</div>
                    <div className="text-lg font-black text-[var(--success)]">{fmt(a.net_payout)}</div>
                 </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                 <Btn 
                   variant="primary" 
                   className="w-full py-6 rounded-2xl shadow-xl" 
                   icon={Printer} 
                   onClick={() => window.print()}
                 >
                   {t('settle_print_doc')}
                 </Btn>
              </div>
            </div>
          )
        })()}
      </Modal>

      <Modal
        open={!!settlingAuctionId}
        onClose={() => setSettlingAuctionId(null)}
        title={t('confirm_payout_title') || 'Confirm Payout'}
      >
        {(() => {
          const a = auctions.find(x => x.id === settlingAuctionId)
          const w = members.find(x => x.id === a?.winner_id)
          if (!a) return null

          return (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-[var(--success-dim)] text-[var(--success)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">{t('confirm_payout_q') || 'Proceed with Payout?'}</h3>
                <p className="text-sm text-slate-500">{t('confirm_payout_desc') || 'This will mark the auction as paid and record today as the payout date.'}</p>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t('winner')}</span>
                  <span className="text-sm font-black">{w?.persons?.name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t('payout_amt')}</span>
                  <span className="text-lg font-black text-[var(--success)]">{fmt(a.net_payout)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Btn variant="secondary" onClick={() => setSettlingAuctionId(null)}>
                  {t('cancel')}
                </Btn>
                <Btn variant="primary" onClick={() => handleMarkSettled(a.id)}>
                  {t('confirm_mark_settled')}
                </Btn>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* ── Single Auction Payout Voucher (Print Only) ── */}
      {selectedAuctionForBreakdown && (() => {
        const a = auctions.find(x => x.id === selectedAuctionForBreakdown)
        const c = commissions.find(x => x.auction_id === selectedAuctionForBreakdown)
        const g = groups.find(x => x.id === a?.group_id)
        const w = members.find(x => x.id === a?.winner_id)
        if (!a || !g) return null

        return (
          <div className="only-print p-12 bg-white text-black font-sans">
             {/* Header */}
             <div className="flex justify-between items-end mb-12 border-b-4 border-slate-900 pb-8">
                <div className="space-y-1">
                   <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">{t('auction_payout_voucher')}</h1>
                   <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                      <span>Ref: AUC-{g.name.slice(0,3)}-{a.month}</span>
                      <div className="w-1 h-1 rounded-full bg-slate-200" />
                      <span>{fmtDate(a.auction_date || '')}</span>
                   </div>
                </div>
                <div className="text-right">
                   <h2 className="text-xl font-black uppercase tracking-tight">{firm?.name || 'ChitVault Firm'}</h2>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{firm?.address || 'Auction Ledger Record'}</p>
                </div>
             </div>

             {/* Member & Group Info */}
             <div className="grid grid-cols-2 gap-12 mb-12">
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b pb-2">{t('winner')}</h4>
                   <div>
                      <div className="text-lg font-black">{w?.persons?.name || '—'}</div>
                      <div className="text-sm font-bold opacity-60">{t('ticket')} #{w?.ticket_no}</div>
                   </div>
                </div>
                <div className="space-y-4">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b pb-2">{t('group')}</h4>
                   <div>
                      <div className="text-lg font-black">{g.name}</div>
                      <div className="text-sm font-bold opacity-60">{t('month_no')} {a.month} of {g.duration}</div>
                   </div>
                </div>
             </div>

             {/* Calculation Box */}
             <div className="mb-12 border-2 border-slate-900 rounded-[2.5rem] overflow-hidden">
                <div className="bg-white border-b-2 border-slate-900 p-8 text-center">
                   <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('payout_amt')}</span>
                   <div className="text-6xl font-black tracking-tighter mt-1 text-slate-900">{fmt(a.net_payout)}</div>
                </div>
                <div className="p-10 space-y-6 bg-slate-50/50">
                   <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">{t('gross_chit_value')}</span>
                      <span className="text-lg font-black">{fmt(c?.chit_value || (g.monthly_contribution * g.duration))}</span>
                   </div>
                   <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">{t('winning_bid_label')}</span>
                      <span className="text-lg font-black text-slate-900">- {fmt(a.auction_discount)}</span>
                   </div>
                   <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                      <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">{t('foreman_commission')}</span>
                      <span className="text-lg font-black text-slate-900">- {fmt(c?.commission_amt || 0)}</span>
                   </div>
                   <div className="flex justify-between items-center pt-2">
                      <span className="text-sm font-black uppercase text-slate-900 tracking-[0.1em]">{t('net_payout')}</span>
                      <span className="text-2xl font-black text-slate-900">{fmt(a.net_payout)}</span>
                   </div>
                </div>
             </div>

             {/* Signatures */}
             <div className="grid grid-cols-2 gap-20 mt-32">
                <div className="text-center space-y-4">
                   <div className="h-px bg-slate-900 w-full" />
                   <p className="text-[10px] font-black uppercase tracking-widest">{t('settle_member_sign')}</p>
                </div>
                <div className="text-center space-y-4">
                   <div className="h-px bg-slate-900 w-full" />
                   <p className="text-[10px] font-black uppercase tracking-widest">{t('office_signature')}</p>
                </div>
             </div>

             <div className="mt-20 text-center text-[8px] text-slate-300 font-bold uppercase tracking-[0.4em]">
                Official Auction Payout Record • {new Date().toLocaleString()}
             </div>
          </div>
        )
      })()}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
