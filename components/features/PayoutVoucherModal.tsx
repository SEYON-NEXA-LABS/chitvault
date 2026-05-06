'use client'
 
import { Modal, Btn } from '@/components/ui'
import { Printer } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { fmt, fmtDate } from '@/lib/utils'
import { printPayoutVoucher } from '@/lib/utils/print'
import type { Auction, Group, Member, ForemanCommission, Firm } from '@/types'
 
interface Props {
  open: boolean
  onClose: () => void
  auction: Auction | null
  group: Group | null
  member: Member | null
  commission: ForemanCommission | null
  firm?: Firm | null
}
 
export function PayoutVoucherModal({ open, onClose, auction, group, member, commission, firm }: Props) {
  const { t } = useI18n()
  if (!auction || !group) return null
 
  const chitValue = commission?.chit_value || (group.monthly_contribution * group.duration)
  const netPayout = auction.net_payout || (chitValue - (auction.auction_discount || 0))
  const totalSurplus = Math.max(0, (auction.auction_discount || 0) - (commission?.commission_amt || 0))
  const individualBenefit = totalSurplus / (group.num_members || 1)
 
  return (
    <>
      {/* ── Screen Breakdown Modal ── */}
      <Modal open={open} onClose={onClose} title={t('payout_breakdown')} size="md">
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{t('winner')}</div>
              <div className="text-lg font-black">{member?.persons?.name || '—'}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{t('group')} ({t('month_no')} {auction.month})</div>
              <div className="text-lg font-black">{group.name}</div>
              <div className="text-[10px] font-bold text-slate-400">{fmtDate(auction.auction_date || '')}</div>
            </div>
          </div>
 
          <div className="space-y-3">
            <div className="flex justify-between items-center py-3 border-b border-dashed">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('gross_chit_value')}</span>
              <span className="text-lg font-black">{fmt(chitValue)}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-dashed">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('winning_bid_label')}</span>
              <span className="text-lg font-black text-rose-600">- {fmt(auction.auction_discount)}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-dashed">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('foreman_commission')}</span>
              <span className="text-lg font-black text-rose-600">- {fmt(commission?.commission_amt || 0)}</span>
            </div>
            <div className="flex justify-between items-center pt-4">
              <span className="text-lg font-black uppercase tracking-tight">{t('net_payout')}</span>
              <span className="text-3xl font-black text-emerald-600">{fmt(netPayout)}</span>
            </div>
          </div>
 
          <div className="pt-4 border-t border-slate-100">
            <Btn 
              variant="primary" 
              className="w-full py-6 rounded-2xl shadow-xl" 
              icon={Printer} 
              onClick={() => {
                if (auction && group && member) {
                  printPayoutVoucher(group, auction, member, commission || undefined, firm || null, t)
                }
              }}
            >
              {t('settle_print_doc')}
            </Btn>
          </div>
        </div>
      </Modal>
    </>
  )
}
