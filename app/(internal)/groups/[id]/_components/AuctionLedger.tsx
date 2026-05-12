'use client'
 
import React from 'react'
import { CheckCircle2, Calculator, Info, Printer } from 'lucide-react'
import { Table, TableCard, Th, Tr, Td, Btn, Badge } from '@/components/ui'
import { fmt, fmtDate, fmtMonth, cn } from '@/lib/utils'
import { printPayoutVoucher } from '@/lib/utils/print'
import type { Group, Auction, Member, ForemanCommission, Firm } from '@/types'
 
interface AuctionLedgerProps {
  group: Group
  auctionHistory: Auction[]
  commissions: ForemanCommission[]
  members: Member[]
  firm: Firm | null
  t: (key: string) => string
  setSettling: (a: Auction) => void
  setSettleForm: React.Dispatch<React.SetStateAction<any>>
  handleConfirmDraft: (id: number) => void
  setMathModal: (data: { auction: Auction; commission: ForemanCommission } | null) => void
  setSettlingAuctionId?: (id: number | null) => void
  onViewBreakdown?: (id: number) => void
}
 
export const AuctionLedger: React.FC<AuctionLedgerProps> = ({
  group,
  auctionHistory,
  commissions,
  members,
  firm,
  t,
  setSettling,
  setSettleForm,
  handleConfirmDraft,
  setMathModal,
  setSettlingAuctionId,
  onViewBreakdown
}) => {
  const confirmedAucs = auctionHistory.filter(a => a.status === 'confirmed')
  const draftAucs = auctionHistory.filter(a => a.status === 'draft')
  const sortedAucs = [...confirmedAucs, ...draftAucs].sort((a, b) => a.month - b.month)
 
  return (
    <TableCard 
      title={t('auction_ledger')} 
      subtitle={group.dividend_strategy === 'standard' ? 'Net Distribution (After Commission)' : 'Gross Distribution (Full Benefit)'}
    >
      <div className="px-4 py-4 border-b border-dashed bg-[var(--surface2)] flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--text)] text-[var(--bg)] flex items-center justify-center font-black text-lg shadow-lg">Σ</div>
        <div className="flex flex-col">
          <span className="text-[9px] font-black tracking-wider text-[var(--text3)] mb-0.5">
            {t('calculation_logic')}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-[var(--accent)] tracking-tight">
              {group.dividend_strategy === 'pro_n1' 
                ? `${t('benefit_per_mem')} = ${t('auction_discount')} / (${group.num_members} - 1)`
                : `${t('benefit_per_mem')} = (${group.dividend_strategy === 'pro_n' ? t('auction_discount') : `${t('auction_discount')} - ${t('commission')}`}) / ${group.num_members}`
              }
            </span>
            <Badge variant={group.dividend_strategy?.startsWith('pro_') ? 'success' : 'accent'} className="py-0.5 px-2 text-[8px]">
              {group.dividend_strategy === 'pro_n1' ? 'Pro (N-1)' : group.dividend_strategy === 'pro_n' ? 'Pro (N)' : 'Standard (N)'}
            </Badge>
          </div>
          <span className="text-[9px] font-bold opacity-40 tracking-wider">
            {group.dividend_strategy?.startsWith('pro_') 
              ? `* ${t('commission')} is deducted from the winner's payout`
              : `* ${t('commission')} is deducted from the group dividend (Shared Benefit)`
            }
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <Tr className="bg-[var(--surface2)]/30">
               <Th className="text-[10px] font-black tracking-wider py-3 px-4">{t('month')}</Th>
              <Th className="text-[10px] font-black tracking-wider">{t('winner')}</Th>
              <Th right className="text-[10px] font-black tracking-wider">{t('discount')}</Th>
              <Th right className="hidden lg:table-cell text-[10px] font-black tracking-wider">
                <div className="flex items-center justify-end gap-1">
                  <span className="opacity-40">-</span> {t('fee')}
                </div>
              </Th>
              <Th right className="hidden md:table-cell text-[10px] font-black tracking-wider">
                <div className="flex items-center justify-end gap-1 text-[var(--accent)]">
                  <span className="opacity-40">=</span> {t('dividend')}
                  <span className="text-[8px] opacity-40 ml-1">({group.dividend_strategy?.startsWith('pro_') ? 'Gross' : 'Net'})</span>
                </div>
              </Th>
              <Th right className="text-[10px] font-black tracking-wider">{t('payout')}</Th>
              <Th right className="hidden sm:table-cell text-[10px] font-black tracking-wider">
                {group.auction_scheme === 'ACCUMULATION' ? t('fixed') : t('due')}
              </Th>
              <Th right className="text-[10px] font-black tracking-wider px-4">{t('status')}</Th>
              <Th className="only-print text-[10px] font-black tracking-wider">{t('sign')}</Th>
            </Tr>
          </thead>
          <tbody>
            {auctionHistory.length === 0 ? (
              <Tr><Td colSpan={8} className="text-center py-16 text-slate-400 italic text-sm">{t('no_auctions')}</Td></Tr>
            ) : sortedAucs.map((a) => {
              const winner = members.find(m => m.id === a.winner_id)
              const comm = commissions.find(c => c.auction_id === a.id)
              const isAcc = group.auction_scheme === 'ACCUMULATION'
              const monthlyDue = Number(group.monthly_contribution)
              const dividend = a.dividend || 0
              const eachPays = isAcc ? monthlyDue : (monthlyDue - dividend)
 
              return (
                <Tr key={a.id}>
                  <Td className="px-4">
                    <div className="flex flex-col py-2 justify-center">
                      <span className="text-sm font-bold text-[var(--text)]">{fmtMonth(a.month, group?.start_date)}</span>
                      <span className={cn("text-[9px] font-black tracking-wider", a.status === 'draft' ? "text-blue-600" : "text-[var(--text3)]")}>
                        {a.status === 'draft' ? 'Draft Projection' : (a.auction_date ? fmtDate(a.auction_date) : 'Confirmed')}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col py-2 justify-center">
                      <span className="text-sm font-bold text-[var(--text)]">
                        {winner?.persons?.name || '—'}
                      </span>
                      <span className="text-[9px] font-black text-[var(--text3)] tracking-wider">
                        {winner ? `Ticket #${winner.ticket_no}` : 'Vacant Slot'}
                      </span>
                    </div>
                  </Td>
                  <Td right>
                    <div className="flex flex-col py-2 justify-center items-end">
                      <span className="text-sm font-bold text-red-600 italic font-mono">{fmt(a.auction_discount)}</span>
                      <span className="text-[9px] font-black text-[var(--text3)] tracking-wider">Gross Discount</span>
                    </div>
                  </Td>
 
                  <Td right className="hidden lg:table-cell">
                    <div className="flex flex-col py-2 justify-center items-end">
                      <span className="text-sm font-medium text-slate-500">{comm ? fmt(comm.commission_amt) : '—'}</span>
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider">{t('foreman_fee')}</span>
                    </div>
                  </Td>
 
                  <Td right className="hidden md:table-cell">
                    <div className="flex flex-col py-2 justify-center items-end">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-[var(--accent)]">+{fmt(dividend)}</span>
                        {comm && (
                          <button
                            onClick={() => setMathModal({ auction: a, commission: comm })}
                            className="p-1 rounded-lg hover:bg-[var(--text)] hover:text-white transition-colors text-[var(--text3)]"
                          >
                            <Calculator size={14} />
                          </button>
                        )}
                      </div>
                      <span className="text-[9px] font-black text-[var(--text3)] tracking-wider">Per Member Div</span>
                    </div>
                  </Td>
 
                  <Td right>
                    <div className="flex flex-col py-2 justify-center items-end">
                      <span className="text-sm font-bold text-[var(--success)]">{fmt(a.net_payout || a.auction_discount)}</span>
                      <span className="text-[9px] font-black text-[var(--text3)] tracking-wider">
                        {a.is_payout_settled ? 'Settled' : 'Net Payout'}
                      </span>
                    </div>
                  </Td>
 
                  <Td right className="hidden sm:table-cell">
                    <div className="flex flex-col py-2 justify-center items-end">
                      <span className="text-sm font-bold text-slate-900">{fmt(eachPays)}</span>
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                        {isAcc ? t('fixed_pay') : t('due_amount')}
                      </span>
                    </div>
                  </Td>
                  <Td right className="px-4">
                    <div className="flex flex-col py-2 justify-center items-end gap-2">
                      <div className="no-print flex items-center gap-1">
                        <button 
                          onClick={() => onViewBreakdown?.(a.id)}
                          className="p-2 rounded-lg border border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all"
                          title={t('view_payout_breakdown')}
                        >
                          <Info size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            const winner = members.find(m => m.id === a.winner_id)
                            const comm = commissions.find(c => c.auction_id === a.id)
                            if (winner) {
                               printPayoutVoucher(group, a, winner, comm, firm, t)
                            }
                          }}
                          className="p-2 rounded-lg border border-[var(--border)] text-[var(--text3)] hover:text-[var(--text)] hover:bg-[var(--surface2)] transition-all"
                          title={t('settle_print_doc')}
                        >
                          <Printer size={16} />
                        </button>
                        {!a.is_payout_settled && a.status === 'confirmed' && winner && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => setSettlingAuctionId?.(a.id)}
                              className="p-2 rounded-lg bg-[var(--success-dim)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white transition-all"
                              title={t('mark_as_settled')}
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <Btn size="sm" variant="primary" className="text-[10px] font-black py-2" onClick={() => {
                              setSettling(a)
                              setSettleForm((s: any) => ({ ...s, amount: String(a.net_payout || a.auction_discount) }))
                            }}>{t('settle')}</Btn>
                          </div>
                        )}
                        {a.status === 'draft' && (
                           <Btn size="sm" variant="primary" className="text-[10px] font-black py-2" onClick={() => handleConfirmDraft(a.id)}>{t('confirm')}</Btn>
                        )}
                      </div>
                      {a.is_payout_settled && (
                         <div className="flex items-center gap-1.5 text-emerald-600 font-black text-[9px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                           <CheckCircle2 size={10} /> {fmtDate(a.payout_date)}
                         </div>
                      )}
                    </div>
                  </Td>
                  <Td className="only-print">
                    <div className="h-8 w-24 border-b border-black opacity-10"></div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </div>
    </TableCard>
  )
}
