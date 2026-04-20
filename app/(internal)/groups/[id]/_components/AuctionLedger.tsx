'use client'

import React from 'react'
import { CheckCircle2, Calculator } from 'lucide-react'
import { Table, TableCard, Th, Tr, Td, Btn } from '@/components/ui'
import { fmt, fmtDate, fmtMonth, cn } from '@/lib/utils'
import type { Group, Auction, Member, ForemanCommission } from '@/types'

interface AuctionLedgerProps {
  group: Group
  auctionHistory: Auction[]
  commissions: ForemanCommission[]
  members: Member[]
  t: (key: string) => string
  setSettling: (a: Auction) => void
  setSettleForm: React.Dispatch<React.SetStateAction<any>>
  handleConfirmDraft: (id: number) => void
  setMathModal: (data: { auction: Auction; commission: ForemanCommission } | null) => void
}

export const AuctionLedger: React.FC<AuctionLedgerProps> = ({
  group,
  auctionHistory,
  commissions,
  members,
  t,
  setSettling,
  setSettleForm,
  handleConfirmDraft,
  setMathModal
}) => {
  const confirmedAucs = auctionHistory.filter(a => a.status === 'confirmed')
  const draftAucs = auctionHistory.filter(a => a.status === 'draft')
  const sortedAucs = [...confirmedAucs, ...draftAucs].sort((a, b) => a.month - b.month)

  return (
    <TableCard title={t('auction_ledger')}>
      <div className="px-6 py-3 border-b border-dashed bg-[var(--surface2)] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs ring-4 ring-[var(--accent-o10)]">Σ</div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">Calculation Logic</span>
          <span className="text-xs font-mono font-bold">
            Benefit / Mem = ({t('auction_discount')} — {t('commission')}) ÷ {group.num_members} {t('members')}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <Tr>
              <Th>{t('auction_month')}</Th>
              <Th>{t('winner')}</Th>
              <Th right>{t('auction_discount')}</Th>
              <Th right className="hidden lg:table-cell text-[var(--danger)]">
                <div className="flex items-center justify-end gap-1">
                  <span className="opacity-40 font-mono">−</span> {t('commission')}
                </div>
              </Th>
              <Th right className="hidden md:table-cell text-[var(--accent)]">
                <div className="flex items-center justify-end gap-1">
                  <span className="opacity-40 font-mono">=</span> {t('benefit_per_mem')}
                </div>
              </Th>
              <Th right>{t('net_payout')}</Th>
              <Th right className="hidden sm:table-cell">
                {group.auction_scheme === 'ACCUMULATION' ? 'Monthly Pay' : t('after_div')}
              </Th>
              <Th right>{t('settlement')}</Th>
              <Th className="only-print">{t('sign_here')}</Th>
            </Tr>
          </thead>
          <tbody>
            {auctionHistory.length === 0 ? (
              <Tr><Td colSpan={8} className="text-center py-12 opacity-50 italic">{t('no_auctions')}</Td></Tr>
            ) : sortedAucs.map((a) => {
              const winner = members.find(m => m.id === a.winner_id)
              const comm = commissions.find(c => c.auction_id === a.id)
              const isAcc = group.auction_scheme === 'ACCUMULATION'
              const monthlyDue = Number(group.monthly_contribution)
              const dividend = a.dividend || 0
              const eachPays = isAcc ? monthlyDue : (monthlyDue - dividend)

              return (
                <Tr key={a.id}>
                  <Td>
                    <div className="flex flex-col min-h-[48px] justify-center">
                      <span className="text-[13px] font-black font-mono text-[var(--text)]">{fmtMonth(a.month, group?.start_date)}</span>
                      <span className={cn("text-[8px] font-black uppercase tracking-tighter", a.status === 'draft' ? "text-[var(--accent)]" : "opacity-40")}>
                        {a.status === 'draft' ? "Draft Plan" : (a.auction_date ? fmtDate(a.auction_date) : "Confirmed")}
                      </span>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col min-h-[48px] justify-center">
                      <span className="text-[13px] font-extrabold truncate max-w-[120px] text-[var(--text)]">
                        {winner?.persons?.name || '—'}
                      </span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                        {winner ? `Ticket #${winner.ticket_no}` : 'No Winner'}
                      </span>
                    </div>
                  </Td>
                  <Td right>
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      <span className="text-[13px] font-black font-mono text-[var(--danger)]">{fmt(a.auction_discount)}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Gross Discount</span>
                    </div>
                  </Td>

                  <Td right className="hidden lg:table-cell">
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      <span className="text-[13px] font-bold font-mono text-[var(--text)] opacity-80">{comm ? fmt(comm.commission_amt) : '—'}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Foreman Fee</span>
                    </div>
                  </Td>

                  <Td right className="hidden md:table-cell">
                    <div className="flex flex-col min-h-[48px] justify-center items-end relative group/math">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-black font-mono text-[var(--accent)]">+{fmt(dividend)}</span>
                        {comm && (
                          <button
                            onClick={() => setMathModal({ auction: a, commission: comm })}
                            className="p-1.5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] transition-all hover:scale-110 active:scale-95 shadow-sm"
                            title="Click for Audit"
                          >
                            <Calculator size={13} strokeWidth={3} />
                          </button>
                        )}
                      </div>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Individual Benefit</span>
                    </div>
                  </Td>

                  <Td right>
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      <span className="text-[13px] font-black font-mono text-[var(--success)]">{fmt(a.net_payout || a.auction_discount)}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                        {a.is_payout_settled ? `Paid: ${fmtDate(a.payout_date || '')}` : 'Net Payable'}
                      </span>
                    </div>
                  </Td>

                  <Td right className="hidden sm:table-cell">
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      <span className="text-[13px] font-bold font-mono text-[var(--text)]">{fmt(eachPays)}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                        {isAcc ? 'Fixed Pay' : 'Due Amount'}
                      </span>
                    </div>
                  </Td>
                  <Td right>
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      {a.is_payout_settled ? (
                        <>
                          <div className="flex items-center gap-1 text-[var(--success)] font-black text-[9px] uppercase tracking-wider">
                            <CheckCircle2 size={10} strokeWidth={3} /> {t('settled')}
                          </div>
                          <span className="text-[11px] font-mono font-black opacity-90">{fmtDate(a.payout_date)}</span>
                        </>
                      ) : (
                        <div className="no-print">
                          {a.status === 'confirmed' && winner ? (
                            <Btn size="sm" variant="primary" className="h-7 px-3 text-[10px] uppercase font-black" onClick={() => {
                              setSettling(a)
                              setSettleForm((s: any) => ({ ...s, amount: String(a.net_payout || a.auction_discount) }))
                            }}>{t('settle')}</Btn>
                          ) : a.status === 'draft' ? (
                             <Btn size="sm" variant="primary" className="h-7 px-3 text-[10px] uppercase font-black" onClick={() => handleConfirmDraft(a.id)}>Confirm Draft</Btn>
                          ) : (
                            <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Pending</span>
                          )}
                        </div>
                      )}
                    </div>
                  </Td>
                  <Td className="only-print">
                    <div className="h-8 w-24 border-b border-black opacity-20"></div>
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
