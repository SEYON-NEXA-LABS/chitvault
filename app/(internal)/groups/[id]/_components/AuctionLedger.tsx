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
       <div className="px-8 py-4 border-b border-dashed bg-slate-50 flex items-center gap-4">
         <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-sm">Σ</div>
         <div className="flex flex-col">
           <span className="text-xs uppercase font-black tracking-widest text-slate-400">Calculation Logic</span>
           <span className="text-sm font-bold text-slate-600">
             Benefit / Mem = ({t('auction_discount')} — {t('commission')}) ÷ {group.num_members} {t('members')}
           </span>
         </div>
       </div>
       <div className="overflow-x-auto">
         <Table>
           <thead>
             <Tr>
               <Th className="text-xs font-bold uppercase tracking-wider">{t('auction_month')}</Th>
               <Th className="text-xs font-bold uppercase tracking-wider">{t('winner')}</Th>
               <Th right className="text-xs font-bold uppercase tracking-wider">{t('auction_discount')}</Th>
               <Th right className="hidden lg:table-cell text-xs font-bold uppercase tracking-wider">
                 <div className="flex items-center justify-end gap-1">
                   <span className="opacity-40">−</span> {t('commission')}
                 </div>
               </Th>
               <Th right className="hidden md:table-cell text-xs font-bold uppercase tracking-wider">
                 <div className="flex items-center justify-end gap-1">
                   <span className="opacity-40">=</span> {t('benefit_per_mem')}
                 </div>
               </Th>
               <Th right className="text-xs font-bold uppercase tracking-wider">{t('net_payout')}</Th>
               <Th right className="hidden sm:table-cell text-xs font-bold uppercase tracking-wider">
                 {group.auction_scheme === 'ACCUMULATION' ? 'Monthly Pay' : t('after_div')}
               </Th>
               <Th right className="text-xs font-bold uppercase tracking-wider">{t('settlement')}</Th>
               <Th className="only-print text-xs font-bold uppercase tracking-wider">{t('sign_here')}</Th>
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
                   <Td>
                     <div className="flex flex-col py-2 justify-center">
                       <span className="text-sm font-bold text-slate-900">{fmtMonth(a.month, group?.start_date)}</span>
                       <span className={cn("text-[10px] font-bold uppercase tracking-wider", a.status === 'draft' ? "text-blue-600" : "text-slate-400")}>
                         {a.status === 'draft' ? "Draft Plan" : (a.auction_date ? fmtDate(a.auction_date) : "Confirmed")}
                       </span>
                     </div>
                   </Td>
                   <Td>
                     <div className="flex flex-col py-2 justify-center">
                       <span className="text-sm font-bold truncate max-w-[140px] text-slate-900">
                         {winner?.persons?.name || '—'}
                       </span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         {winner ? `Ticket #${winner.ticket_no}` : 'No Winner'}
                       </span>
                     </div>
                   </Td>
                   <Td right>
                     <div className="flex flex-col py-2 justify-center items-end">
                       <span className="text-sm font-bold text-red-600">{fmt(a.auction_discount)}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Discount</span>
                     </div>
                   </Td>
 
                   <Td right className="hidden lg:table-cell">
                     <div className="flex flex-col py-2 justify-center items-end">
                       <span className="text-sm font-medium text-slate-500">{comm ? fmt(comm.commission_amt) : '—'}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foreman Fee</span>
                     </div>
                   </Td>
 
                   <Td right className="hidden md:table-cell">
                     <div className="flex flex-col py-2 justify-center items-end">
                       <div className="flex items-center gap-2">
                         <span className="text-sm font-bold text-blue-600">+{fmt(dividend)}</span>
                         {comm && (
                           <button
                             onClick={() => setMathModal({ auction: a, commission: comm })}
                             className="p-1 rounded-lg hover:bg-slate-900 hover:text-white transition-colors text-slate-300"
                           >
                             <Calculator size={14} />
                           </button>
                         )}
                       </div>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Individual Benefit</span>
                     </div>
                   </Td>
 
                   <Td right>
                     <div className="flex flex-col py-2 justify-center items-end">
                       <span className="text-sm font-bold text-emerald-600">{fmt(a.net_payout || a.auction_discount)}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         {a.is_payout_settled ? `Paid: ${fmtDate(a.payout_date || '')}` : 'Net Payable'}
                       </span>
                     </div>
                   </Td>
 
                   <Td right className="hidden sm:table-cell">
                     <div className="flex flex-col py-2 justify-center items-end">
                       <span className="text-sm font-bold text-slate-900">{fmt(eachPays)}</span>
                       <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         {isAcc ? 'Fixed Pay' : 'Due Amount'}
                       </span>
                     </div>
                   </Td>
                   <Td right>
                     <div className="flex flex-col py-2 justify-center items-end">
                       {a.is_payout_settled ? (
                         <>
                           <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase tracking-wider">
                             <CheckCircle2 size={12} /> {t('settled')}
                           </div>
                           <span className="text-[10px] font-bold text-slate-400 uppercase">{fmtDate(a.payout_date)}</span>
                         </>
                       ) : (
                         <div className="no-print">
                           {a.status === 'confirmed' && winner ? (
                             <Btn size="sm" variant="primary" className="text-xs font-bold uppercase tracking-wider" onClick={() => {
                               setSettling(a)
                               setSettleForm((s: any) => ({ ...s, amount: String(a.net_payout || a.auction_discount) }))
                             }}>{t('settle')}</Btn>
                           ) : a.status === 'draft' ? (
                              <Btn size="sm" variant="primary" className="text-xs font-bold uppercase tracking-wider" onClick={() => handleConfirmDraft(a.id)}>Confirm Draft</Btn>
                           ) : (
                             <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Pending</span>
                           )}
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
