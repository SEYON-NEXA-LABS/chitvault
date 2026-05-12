'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtMonth, fmtDate, getGroupDisplayName } from '@/lib/utils'
import { Btn, TableCard, Table, Th, Td, Tr, Loading, Toast, Pagination, Modal, Empty } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet, ChevronLeft, ChevronRight, ExternalLink, Calculator, Info, Printer, CheckCircle2, ChevronDown, ChevronUp, LayoutList, LayoutGrid } from 'lucide-react'
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
        withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, auction_scheme, start_date, chit_value'), targetId)
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
    <div className="space-y-6 pb-20">
      <div className="no-print space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{t('auction_ledger')}</h1>
          <p className="text-sub mt-1">{t('auctions_history_log')}</p>
        </div>
        <div className="flex gap-2">
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

                   // Sort by Group Name, then by Month (Descending)
                   data.sort((a: any, b: any) => {
                     if (a.Group !== b.Group) return a.Group.localeCompare(b.Group);
                     return b.Month - a.Month;
                   });

                   downloadCSV(data, 'auctions_full');
                 } finally {
                   setLoading(false)
                 }
               }

               return <Btn variant="secondary" size="sm" onClick={handleExportFull} icon={FileSpreadsheet}>CSV (Full)</Btn>
             })()}
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
    </div>

    <TableCard title={t('auction_ledger')} subtitle={`${t('page')} ${page} ${t('of')} ${totalPages || 1} • ${t('total_records')}: ${totalCount}`}>
        <div className="p-4 space-y-4">
          <div className="flex justify-end gap-2 mb-2 no-print">
            <Btn size="sm" variant="secondary" onClick={expandAll}>Expand All</Btn>
            <Btn size="sm" variant="secondary" onClick={collapseAll}>Collapse All</Btn>
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
                <div key={gid} className="border-2 rounded-3xl overflow-hidden transition-all duration-300" style={{ borderColor: isExpanded ? 'var(--accent)' : 'var(--border)' }}>
                  <button 
                    onClick={() => toggleGroup(gid)}
                    className="w-full flex items-center justify-between px-6 py-4 bg-slate-50/50 hover:bg-slate-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-white shadow-sm border border-slate-100">
                        {isExpanded ? <ChevronUp size={18} className="text-[var(--accent)]" /> : <ChevronDown size={18} />}
                      </div>
                      <div className="text-left">
                        <div className="font-black text-sm uppercase tracking-tight">{g ? getGroupDisplayName(g, t) : `Group #${gid}`}</div>
                        <div className="text-[10px] text-sub font-bold uppercase tracking-widest">{gAucs.length} {t('auctions_history_log')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="hidden sm:block text-right">
                          <div className="text-[10px] text-sub font-bold uppercase tracking-widest">Total Yield</div>
                          <div className="font-black text-[var(--accent)]">{fmt(gAucs.reduce((s, a) => s + Number(a.auction_discount || 0), 0))}</div>
                       </div>
                       <Btn size="sm" variant="ghost" icon={ExternalLink} onClick={(e) => { e.stopPropagation(); router.push(`/groups/${gid}`) }} />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <Table>
                        <thead>
                          <tr>
                            <Th>{t('auction_month')}</Th>
                            <Th>{t('winner')}</Th>
                            <Th right>{t('bid_amount')}</Th>
                            <Th right>{t('net_payout')}</Th>
                            <Th right>{t('actions')}</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {gAucs.map(a => {
                            const w = members.find(x => x.id === a.winner_id)
                            const c = commissions.find(x => x.auction_id === a.id)
                            
                            return (
                              <Tr key={a.id}>
                                <Td label="Month">
                                  <div className="flex flex-col min-h-[48px] justify-center">
                                    <span className="text-sm font-bold text-[var(--text)]">{fmtMonth(a.month, g?.start_date)}</span>
                                    <span className="text-xs text-sub">{a.auction_date ? fmtDate(a.auction_date) : t('no_date_set')}</span>
                                  </div>
                                </Td>
                                <Td label="Winner">
                                  <div className="flex flex-col min-h-[48px] justify-center">
                                    <span className="text-sm font-semibold text-[var(--text)]">👑 {w?.persons?.name || '—'}</span>
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
                                      <button 
                                        onClick={() => setSelectedAuctionForBreakdown(a.id)}
                                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all"
                                        title={t('view_breakdown')}
                                      >
                                        <Info size={18} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          if (g && w) {
                                            printPayoutVoucher(g, a, w, c, firm, t)
                                          }
                                        }}
                                        className="p-2 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all"
                                        title={t('settle_print_doc')}
                                      >
                                        <Printer size={18} />
                                      </button>
                                      {!a.is_payout_settled && (
                                        <button 
                                          onClick={() => setSettlingAuctionId(a.id)}
                                          className="p-2 rounded-xl bg-[var(--success-dim)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white transition-all"
                                          title={t('mark_as_settled') || 'Mark as Paid'}
                                        >
                                          <CheckCircle2 size={18} />
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
  )
}
