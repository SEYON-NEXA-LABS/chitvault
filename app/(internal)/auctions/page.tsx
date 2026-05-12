'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtMonth, fmtDate, getGroupDisplayName, cn } from '@/lib/utils'
import { Btn, TableCard, Table, Th, Td, Tr, Loading, Toast, Pagination, Modal, Empty, StatCard, Badge } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, ChevronLeft, ChevronRight, ExternalLink, Calculator, Info, Printer, CheckCircle2, ChevronDown, ChevronUp, LayoutList, LayoutGrid, TrendingUp, Activity, ArrowRight, Gavel } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { downloadCSV } from '@/lib/utils/csv'
import { useTerminology } from '@/lib/hooks/useTerminology'
import type { Group, Member, Auction, ForemanCommission, Firm } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { PayoutVoucherModal } from '@/components/features/PayoutVoucherModal'
import { printPayoutVoucher } from '@/lib/utils/print'

const PAGE_SIZE = 20

export default function AuctionsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  const router = useRouter()
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
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

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
        withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, auction_scheme, start_date, chit_value, num_members, dividend_strategy'), targetId)
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

  const groupedAuctions = useMemo(() => {
    const map: Record<number, Auction[]> = {}
    auctions.forEach(a => {
      if (!map[a.group_id]) map[a.group_id] = []
      map[a.group_id].push(a)
    })
    return map
  }, [auctions])

  const toggleGroup = (id: number) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => {
    setExpandedGroups(new Set(Object.keys(groupedAuctions).map(Number)))
  }

  const collapseAll = () => {
    setExpandedGroups(new Set())
  }

  if (loading) return <Loading />

  return (
    <>
      <div className="space-y-6 pb-20">
      <div className="no-print space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
          <div>
            <h1 className="text-3xl font-black text-[var(--text)] tracking-tighter leading-none">{t('auction_ledger')}</h1>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="accent" className="py-0.5 px-2 text-[10px] font-bold">
                {totalCount} {t('auctions_history_log')}
              </Badge>
              <span className="text-[11px] font-medium text-[var(--text3)]">
                Firm Global Archive
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
               {(() => {
                 const handleExportFull = async () => {
                   const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
                   if (!targetId) return
                   setLoading(true)
                   try {
                     const { data: allData } = await withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_date, payout_date, winner_id, auction_discount, dividend, net_payout, status, is_payout_settled'), targetId)
                       .is('deleted_at', null)
                       .order('auction_date', { ascending: false })
                     
                     if (!allData) return
                     
                     const data = allData.map((a: any) => {
                       const g = groups.find(x => x.id === a.group_id);
                       const w = members.find(x => x.id === a.winner_id);
                       return {
                         'Group': g ? getGroupDisplayName(g, t) : '—',
                         'Month': a.month,
                         'Date': a.auction_date ? fmtDate(a.auction_date) : '—',
                         'Winner': w?.persons?.name || '—',
                         'Ticket': w ? `Ticket #${w.ticket_no}` : '—',
                         'Bid Amount': a.auction_discount,
                         'Net Payout': a.net_payout,
                         'Status': a.status,
                         'Settled': a.is_payout_settled ? 'Yes' : 'No',
                         'Payout Date': a.payout_date ? fmtDate(a.payout_date) : '—'
                       }
                     });

                     data.sort((a: any, b: any) => {
                       if (a.Group !== b.Group) return a.Group.localeCompare(b.Group);
                       return b.Month - a.Month;
                     });

                     downloadCSV(data, 'auctions_full');
                   } finally {
                     setLoading(false)
                   }
                 }

                 return <Btn variant="secondary" size="sm" className="text-[10px] font-black tracking-wider" onClick={handleExportFull} icon={FileSpreadsheet}>Export CSV</Btn>
               })()}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Monthly Yield" value={fmt(pageYield)} icon={TrendingUp} sub="Sum of Bids (Current Page)" color="accent" compact />
          <StatCard label="Total Payouts" value={fmt(pagePayouts)} icon={Gavel} sub="Net Disbursements" color="success" compact />
          <StatCard label="Avg Discount" value={fmt(pageYield / (auctions.length || 1))} icon={Activity} sub="Per Auction Logic" color="info" compact />
          <StatCard label="Archive Size" value={totalCount} icon={CheckCircle2} sub="Total Historical Auctions" color="warning" compact />
        </div>
        </div>

    <TableCard title={
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-[var(--text2)] opacity-40">{t('auction_ledger')} &nbsp;•&nbsp; {t('page')} {page} / {totalPages || 1}</div>
      </div>
    }>
        <div className="p-4 space-y-4">
          <div className="flex justify-end gap-1.5 mb-1 no-print">
            <Btn size="sm" variant="secondary" className="text-[11px] font-bold" onClick={expandAll}>Expand All</Btn>
            <Btn size="sm" variant="secondary" className="text-[11px] font-bold" onClick={collapseAll}>Collapse All</Btn>
          </div>
          {Object.keys(groupedAuctions).length === 0 ? (
            <Empty icon="📭" title="No Auctions Found" subtitle="Try adjusting your page or filters" />
          ) : (
            Object.keys(groupedAuctions).map(idStr => {
              const gid = Number(idStr)
              const gAucs = groupedAuctions[gid]
              const g = groups.find(x => x.id === gid)
              const isExpanded = expandedGroups.has(gid)

              return (
                <div key={gid} className={cn(
                  "bg-[var(--surface)] border rounded-2xl overflow-hidden transition-all shadow-sm",
                  isExpanded ? "border-[var(--accent)]" : "border-[var(--border)]"
                )}>
                  <button 
                    onClick={() => toggleGroup(gid)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-[var(--surface2)]/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-all", isExpanded ? "bg-[var(--text)] text-white" : "bg-[var(--surface2)] opacity-40")}>
                        <ChevronDown size={18} className={cn("transition-transform duration-300", isExpanded && "rotate-180")} />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-sm text-[var(--text)] tracking-tight">{g ? getGroupDisplayName(g, t) : `Group #${gid}`}</div>
                        <div className="text-[11px] font-medium opacity-50">{gAucs.length} {t('auctions_history_log')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:gap-8">
                       <div className="hidden sm:block text-right">
                          <div className="text-[9px] font-black text-[var(--text3)] tracking-wider mb-0.5">Total Yield</div>
                          <div className="font-black text-xs text-[var(--accent)] font-mono">{fmt(gAucs.reduce((s, a) => s + Number(a.auction_discount || 0), 0))}</div>
                       </div>
                       <div className="hidden md:block text-right">
                          <div className="text-[9px] font-black text-[var(--text3)] tracking-wider mb-0.5">{term.benefitLabel}</div>
                          <div className="font-black text-xs text-emerald-600 font-mono">
                            {(() => {
                              const totalPool = gAucs.reduce((s, a) => {
                                const c = commissions.find(x => x.auction_id === a.id);
                                const discount = Number(a.auction_discount || 0);
                                const commAmt = Number(c?.commission_amt || 0);
                                const strategy = g?.dividend_strategy || 'standard';
                                return s + (strategy.startsWith('pro_') ? discount : Math.max(0, discount - commAmt));
                              }, 0);
                              const divisor = g?.dividend_strategy === 'pro_n1' ? (g.num_members - 1) : g?.num_members;
                              return fmt(divisor && divisor > 0 ? totalPool / divisor : 0);
                            })()}
                          </div>
                       </div>
                       <div className="hidden lg:block text-right">
                          <div className="text-[9px] font-black text-[var(--text3)] tracking-wider mb-0.5">Total Payouts</div>
                          <div className="font-black text-xs text-[var(--text)] font-mono">{fmt(gAucs.reduce((s, a) => s + Number(a.net_payout || 0), 0))}</div>
                       </div>
                       <Btn size="sm" variant="secondary" className="h-9 w-9 p-0 rounded-xl bg-white border-slate-200 shrink-0" onClick={(e) => { e.stopPropagation(); router.push(`/groups/${gid}`) }}>
                         <ArrowRight size={16} />
                       </Btn>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t animate-in slide-in-from-top-2 duration-300" style={{ borderColor: 'var(--border)' }}>
                      <Table responsive>
                        <thead>
                          <Tr className="bg-[var(--surface2)]/30">
                            <Th className="text-[11px] font-bold py-2 px-4">Auction Month</Th>
                            <Th className="text-[11px] font-bold">Winner</Th>
                            <Th right className="text-[11px] font-bold">Bid Amount</Th>
                            <Th right className="text-[11px] font-bold">{term.benefitLabel}</Th>
                            <Th right className="text-[11px] font-bold">Net Payout</Th>
                            <Th right className="text-[11px] font-bold px-4">Actions</Th>
                          </Tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {gAucs.map(a => {
                            const w = members.find(x => x.id === a.winner_id)
                            const c = commissions.find(x => x.auction_id === a.id)
                            
                            return (
                              <Tr key={a.id} className="hover:bg-[var(--surface2)]/30 group/row transition-colors">
                                <Td label="Month" className="px-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-sm text-[var(--text)]">{fmtMonth(a.month, g?.start_date)}</span>
                                    <span className="text-[11px] font-medium text-[var(--text3)] opacity-60">{a.auction_date ? fmtDate(a.auction_date) : t('no_date_set')}</span>
                                  </div>
                                </Td>
                                <Td label="Winner">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                                      <span className="text-xs font-black">W</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="font-bold text-sm text-[var(--text)] tracking-tight">{w?.persons?.name || '—'}</span>
                                      <span className="text-[10px] font-medium text-[var(--text3)] opacity-60">{w ? `Ticket #${String(w.ticket_no).padStart(2, '0')}` : 'N/A'}</span>
                                    </div>
                                  </div>
                                </Td>
                                <Td label="Bid" right>
                                  <div className="flex flex-col items-end">
                                    <span className="font-bold text-sm text-[var(--danger)] font-mono italic">{fmt(a.auction_discount)}</span>
                                    <span className="text-[9px] font-bold text-[var(--text3)] opacity-40">{t('winning_bid_label')}</span>
                                  </div>
                                </Td>
                                <Td label={term.benefitLabel} right>
                                  <div className="flex flex-col items-end">
                                    <span className="font-bold text-sm text-emerald-600 font-mono">
                                      +{(() => {
                                        const discount = Number(a.auction_discount || 0);
                                        const commAmt = Number(c?.commission_amt || 0);
                                        const strategy = g?.dividend_strategy || 'standard';
                                        const pool = strategy.startsWith('pro_') ? discount : Math.max(0, discount - commAmt);
                                        const divisor = g?.dividend_strategy === 'pro_n1' ? (g.num_members - 1) : g?.num_members;
                                        return fmt(divisor && divisor > 0 ? pool / divisor : 0);
                                      })()}
                                    </span>
                                    <span className="text-[9px] font-bold text-[var(--text3)] opacity-40">{term.benefitLabel}</span>
                                  </div>
                                </Td>
                                <Td label="Payout" right>
                                  <div className="flex flex-col items-end">
                                    <span className="font-black text-sm text-[var(--success)] font-mono">{fmt(a.net_payout)}</span>
                                    <span className="text-[9px] font-black text-[var(--text3)] tracking-wider opacity-40">
                                      {a.is_payout_settled ? `${t('payout_amt')}: ${fmtDate(a.payout_date || '')}` : t('unsettled')}
                                    </span>
                                  </div>
                                </Td>
                                <Td label="Actions" right className="px-4">
                                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                      <button 
                                        onClick={() => setSelectedAuctionForBreakdown(a.id)}
                                        className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-400 flex items-center justify-center transition-all shadow-sm"
                                        title={t('view_breakdown')}
                                      >
                                        <Info size={14} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          if (g && w) {
                                            printPayoutVoucher(g, a, w, c, firm, t)
                                          }
                                        }}
                                        className="h-8 w-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-400 flex items-center justify-center transition-all shadow-sm"
                                        title={t('settle_print_doc')}
                                      >
                                        <Printer size={14} />
                                      </button>
                                      {!a.is_payout_settled && (
                                        <button 
                                          onClick={() => setSettlingAuctionId(a.id)}
                                          className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition-all shadow-sm border border-emerald-100"
                                          title={t('mark_as_settled') || 'Mark as Paid'}
                                        >
                                          <CheckCircle2 size={14} />
                                        </button>
                                      )}
                                  </div>
                                </Td>
                              </Tr>
                            )
                          })}
                        </tbody>
                      </Table>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
        
        <Pagination 
          current={page} 
          total={totalCount} 
          pageSize={PAGE_SIZE} 
          onPageChange={setPage} 
        />
      </TableCard>

      {/* Unified Auction Breakdown Modal handled at bottom */}

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
                <h3 className="text-xl font-black tracking-tight">{t('confirm_payout_q') || 'Proceed with Payout?'}</h3>
                <p className="text-sm text-slate-500">{t('confirm_payout_desc') || 'This will mark the auction as paid and record today as the payout date.'}</p>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400">{t('winner')}</span>
                  <span className="text-sm font-black">{w?.persons?.name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400">{t('payout_amt')}</span>
                  <span className="text-lg font-black text-[var(--success)]">
                    {(() => {
                      const g = groups.find(x => x.id === a.group_id);
                      const chitVal = (g?.monthly_contribution || 0) * (g?.duration || 0);
                      return fmt(a.net_payout || (chitVal - (a.auction_discount || 0)));
                    })()}
                  </span>
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

      <PayoutVoucherModal
        open={!!selectedAuctionForBreakdown}
        onClose={() => setSelectedAuctionForBreakdown(null)}
        auction={auctions.find(a => a.id === selectedAuctionForBreakdown) || null}
        group={groups.find(g => g.id === auctions.find(a => a.id === selectedAuctionForBreakdown)?.group_id) || null}
        member={members.find(m => m.id === auctions.find(a => a.id === selectedAuctionForBreakdown)?.winner_id) || null}
        commission={commissions.find(c => c.auction_id === selectedAuctionForBreakdown) || null}
        firm={firm}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
      </div>
    </>
  )
}
