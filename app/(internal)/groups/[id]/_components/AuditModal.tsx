'use client'

import React from 'react'
import { Modal, Btn } from '@/components/ui'
import { Calculator, CheckCircle2 } from 'lucide-react'
import { fmt, cn } from '@/lib/utils'
import type { Group, Auction, ForemanCommission } from '@/types'

interface AuditModalProps {
  open: boolean
  onClose: () => void
  group: Group
  mathModal: { auction: Auction; commission: ForemanCommission } | null
}

export const AuditModal: React.FC<AuditModalProps> = ({
  open,
  onClose,
  group,
  mathModal
}) => {
  if (!mathModal) return null
  const { auction, commission } = mathModal

  const pool = (auction?.auction_discount || 0) - (commission?.commission_amt || 0);
  const share = pool / (group?.num_members || 1);
  const isAcc = group.auction_scheme === 'ACCUMULATION';
  const monthlyDue = Number(group.monthly_contribution);
  const youPay = isAcc ? monthlyDue : (monthlyDue - share);

  return (
    <Modal open={open} onClose={onClose} title={`${group?.auction_scheme === 'ACCUMULATION' ? 'Accumulation' : 'Dividend'} Audit Report`} size="sm">
      <div className="space-y-6">
        <div className="p-6 rounded-[32px] bg-[var(--surface2)] border border-[var(--border)] shadow-inner">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center font-black text-2xl shadow-lg ring-4 ring-[var(--accent-dim)]">
              <Calculator size={28} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Audit Ledger Report</div>
              <div className="text-xl font-black text-[var(--text)] tracking-tight">Month {auction?.month} Dividend</div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Step 1: Net Benefit Pool */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--danger)]">Step 1: Benefit Pool</span>
                <span className="text-[9px] font-bold opacity-40 uppercase">(Discount — Fee)</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] font-mono shadow-sm">
                <span className="text-xs">{fmt(auction?.auction_discount || 0)} — {fmt(commission?.commission_amt || 0)}</span>
                <span className="font-extrabold text-sm text-[var(--danger)]">= {fmt(pool)}</span>
              </div>
            </div>

            {/* Step 2: Per Member Share */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">Step 2: Individual Share</span>
                <span className="text-[9px] font-bold opacity-40 uppercase">(Pool ÷ {group?.num_members} Members)</span>
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] font-mono shadow-sm">
                <span className="text-xs">{fmt(pool)} ÷ {group?.num_members}</span>
                <span className="font-extrabold text-sm text-[var(--accent)]">= {fmt(share)}</span>
              </div>
            </div>

            {/* Step 3: Payment Impact */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--success)]">Step 3: {isAcc ? 'Fixed Payment' : 'Member Due'}</span>
                <span className="text-[9px] font-bold opacity-40 uppercase">{isAcc ? '(Accumulation Plan)' : '(Direct Deduction)'}</span>
              </div>
              <div className={cn("flex items-center justify-between p-4 rounded-2xl border border-[var(--success)] font-mono shadow-md", isAcc ? "bg-[var(--surface)]" : "bg-[var(--success-dim)]")}>
                {isAcc ? (
                  <>
                    <span className="text-xs">Full Contribution</span>
                    <span className="font-extrabold text-sm text-[var(--success)]">{fmt(monthlyDue)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs">{fmt(monthlyDue)} — {fmt(share)}</span>
                    <span className="font-extrabold text-sm text-[var(--success)]">= {fmt(youPay)}</span>
                  </>
                )}
              </div>
              <div className="text-[9px] px-2 opacity-50 italic">
                {isAcc
                  ? `* In Accumulation scheme, your ${fmt(share)} benefit is added to the Group Surplus instead of being deducted.`
                  : `* Your ${fmt(share)} benefit is deducted from your ${fmt(monthlyDue)} monthly contribution.`
                }
              </div>
            </div>

            <div className="relative overflow-hidden p-5 bg-[var(--surface3)] border border-[var(--border)] rounded-[24px]">
              <div className="absolute top-0 right-0 p-2 opacity-5">
                <CheckCircle2 size={48} />
              </div>
              <div className="relative z-10">
                <div className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Mathematical Reconciliation</div>
                <p className="text-[11px] font-bold leading-relaxed italic opacity-80">
                  &quot;The total auction discount of {fmt(auction?.auction_discount || 0)} is perfectly accounted for:
                  {fmt(commission?.commission_amt || 0)} as foreman fee and
                  {fmt(share * (group?.num_members || 1))} as {isAcc ? 'surplus accumulation' : 'member dividends'}.&quot;
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Btn variant="primary" className="w-full h-12 rounded-2xl font-black uppercase tracking-widest" onClick={onClose}>Close Audit Log</Btn>
        </div>
      </div>
    </Modal>
  )
}
