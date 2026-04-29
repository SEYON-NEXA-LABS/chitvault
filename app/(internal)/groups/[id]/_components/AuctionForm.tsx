'use client'

import React from 'react'
import { Modal, Field, Loading, Btn } from '@/components/ui'
import { fmt } from '@/lib/utils'
import type { Group, Member, AuctionCalculation } from '@/types'

interface AuctionFormProps {
  open: boolean
  onClose: () => void
  group: Group
  aucForm: {
    month: string
    auction_date: string
    winner_id: string
    auction_discount: string
    foreman_member_id: string
    notes: string
  }
  setAucForm: React.Dispatch<React.SetStateAction<any>>
  onBidChange: (bid: string) => void
  calc: AuctionCalculation | null
  calcError: string
  eligibleList: Member[]
  winnerBalance: number
  winnerAging: number
  checkingWinner: boolean
  acknowledge: boolean
  setAcknowledge: (val: boolean) => void
  saving: boolean
  handleSaveAuction: (status: 'draft' | 'confirmed') => void
  checkWinnerBalance: (memberId: string) => void
  t: (key: string) => string
}

export const AuctionForm: React.FC<AuctionFormProps> = ({
  open,
  onClose,
  group,
  aucForm,
  setAucForm,
  onBidChange,
  calc,
  calcError,
  eligibleList,
  winnerBalance,
  winnerAging,
  checkingWinner,
  acknowledge,
  setAcknowledge,
  saving,
  handleSaveAuction,
  checkWinnerBalance,
  t
}) => {
  const inputClass = "w-full bg-[var(--surface2)] border-2 border-transparent focus:border-[var(--accent)] rounded-xl px-4 py-2.5 text-sm font-bold transition-all outline-none"
  const inputStyle = { borderColor: 'var(--border)' }

  return (
    <Modal open={open} onClose={onClose} title="Record Group Auction" size="lg">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Auction Month">
          <input className={inputClass} style={inputStyle} value={`Month ${aucForm.month}`} disabled />
        </Field>
        <Field label="Auction Date">
          <input className={inputClass} type="date" value={aucForm.auction_date} onChange={e => setAucForm((f: any) => ({ ...f, auction_date: e.target.value }))} />
        </Field>

        <Field label={t('winner_bidder')} className="col-span-2">
          <select className={inputClass} style={inputStyle} value={aucForm.winner_id} onChange={e => {
            setAucForm((f: any) => ({ ...f, winner_id: e.target.value }))
            checkWinnerBalance(e.target.value)
          }}>
            <option value="">{t('select_winner')}</option>
            {eligibleList.map(m => <option key={m.id} value={m.id}>{m.persons?.name} (#{m.ticket_no})</option>)}
          </select>
        </Field>

        {checkingWinner ? <div className="col-span-2 flex justify-center py-2"><Loading /></div> : winnerBalance > 0.01 && (
          <div className="col-span-2 p-4 rounded-2xl border bg-red-500/5 border-red-500/20">
            <div className="text-red-600 font-black text-sm uppercase tracking-tight">Owes ₹{fmt(winnerBalance)} ({winnerAging} months)</div>
            <label className="flex items-center gap-2 mt-2 cursor-pointer">
              <input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} />
              <span className="text-[10px] font-black uppercase opacity-60">I acknowledge these dues and the member is eligible to win</span>
            </label>
          </div>
        )}

        <Field label={group?.auction_scheme === 'DIVIDEND_SHARE' ? 'Winning Bid (Amount Taken)' : 'Discount Bid'} className="col-span-2">
          <input 
            className={inputClass} 
            type="number" 
            value={aucForm.auction_discount} 
            onChange={e => onBidChange(e.target.value)} 
            placeholder="e.g. 5000" 
            disabled={['LOTTERY', 'FIXED_ROTATION'].includes(group?.auction_scheme)}
          />
          {['LOTTERY', 'FIXED_ROTATION'].includes(group?.auction_scheme) && (
            <div className="text-[10px] opacity-60 mt-1 font-bold uppercase">No bidding required for this scheme. Enter 0.</div>
          )}
          {calc && (
            <div className="mt-3 p-3 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] grid grid-cols-2 gap-y-2">
              <div className="text-[9px] font-black uppercase opacity-40">Gross Discount</div>
              <div className="text-xs font-black text-right">{fmt(calc.auction_discount)}</div>
              
              <div className="text-[9px] font-black uppercase opacity-40">Foreman Fee</div>
              <div className="text-xs font-black text-right">{fmt(calc.commission_amt)}</div>
              
              {group?.auction_scheme === 'ACCUMULATION' && (
                <>
                  <div className="text-[9px] font-black uppercase opacity-40">Surplus Added</div>
                  <div className="text-xs font-black text-right text-[var(--accent)]">{fmt(calc.auction_discount - calc.commission_amt)}</div>
                </>
              )}
              
              {group?.auction_scheme === 'HYBRID_SPLIT' && (
                <>
                  <div className="text-[9px] font-black uppercase opacity-40">Surplus Added</div>
                  <div className="text-xs font-black text-right text-orange-500">{fmt((calc.auction_discount - calc.commission_amt) * (group.surplus_split_pct || 0.5))}</div>
                </>
              )}
              
              {['DIVIDEND_SHARE', 'HYBRID_SPLIT', 'BOUNDED_AUCTION', 'SEALED_TENDER', 'STEPPED_INSTALLMENT'].includes(group?.auction_scheme) && (
                <>
                  <div className="text-[9px] font-black uppercase opacity-40">Individual Share</div>
                  <div className="text-xs font-black text-right text-[var(--accent)]">{fmt(calc.per_member_div)}</div>
                </>
              )}
            </div>
          )}
          {calcError && <div className="text-[10px] text-red-500 mt-1 font-bold">{calcError}</div>}
        </Field>
      </div>

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/5">
        <Btn variant="secondary" onClick={onClose}>{t('cancel')}</Btn>
        <Btn variant="primary" loading={saving} onClick={() => handleSaveAuction('confirmed')} disabled={!!calcError || checkingWinner}>{t('record_auction')}</Btn>
      </div>
    </Modal>
  )
}
