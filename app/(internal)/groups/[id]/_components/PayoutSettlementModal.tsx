'use client'

import React from 'react'
import { Modal, Field, Btn, Badge } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { fmt, fmtMonth } from '@/lib/utils'
import type { Group, Auction, Member } from '@/types'

interface PayoutSettlementModalProps {
  open: boolean
  onClose: () => void
  settling: Auction | null
  members: Member[]
  group: Group
  settleForm: {
    date: string
    note: string
    amount: string
    mode: string
  }
  setSettleForm: React.Dispatch<React.SetStateAction<any>>
  onSettle: () => Promise<void>
  onPrintVoucher: (auc: Auction) => void
  saving: boolean
}

export const PayoutSettlementModal: React.FC<PayoutSettlementModalProps> = ({
  open,
  onClose,
  settling,
  members,
  group,
  settleForm,
  setSettleForm,
  onSettle,
  onPrintVoucher,
  saving
}) => {
  if (!settling) return null
  const winner = members.find(m => m.id === settling.winner_id)

  return (
    <Modal open={open} onClose={onClose} title="Confirm Payout Settlement">
      <div className="space-y-6">
        <div className="p-4 rounded-2xl border-2 flex items-center gap-4 transition-all" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-dim)' }}>
          <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-black text-xl shadow-lg ring-4 ring-[var(--accent-dim)]">
            {winner?.persons?.name?.charAt(0)}
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] opacity-60">Settling Payout For</div>
            <div className="text-xl font-black text-[var(--text)] leading-tight">{winner?.persons?.name}</div>
            <div className="flex gap-3 mt-1">
              <Badge variant="gray" className="text-[9px] font-mono">Ticket #{winner?.ticket_no}</Badge>
              <Badge variant="info" className="text-[9px] font-mono">{fmtMonth(settling.month, group?.start_date)}</Badge>
            </div>
          </div>
        </div>

        <div className="pt-2">
          <Field label="Amount Paid">
            <input
              type="number"
              className={inputClass}
              style={inputStyle}
              value={settleForm.amount}
              onChange={e => setSettleForm((s: any) => ({ ...s, amount: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Payout Date">
            <input
              type="date"
              className={inputClass}
              style={inputStyle}
              value={settleForm.date}
              onChange={e => setSettleForm((s: any) => ({ ...s, date: e.target.value }))}
            />
          </Field>

          <Field label="Payment Mode">
            <select
              className={inputClass}
              style={inputStyle}
              value={settleForm.mode}
              onChange={e => setSettleForm((s: any) => ({ ...s, mode: e.target.value }))}
            >
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </Field>
        </div>

        <Field label="Reference Notes / Transaction ID">
          <textarea
            className={inputClass}
            style={{ ...inputStyle, height: 80, resize: 'none' }}
            placeholder="e.g. Transaction ID, UPI Ref, or remarks..."
            value={settleForm.note}
            onChange={e => setSettleForm((s: any) => ({ ...s, note: e.target.value }))}
          />
        </Field>

        <div className="flex justify-end gap-3 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={onSettle}>Confirm Selection & Mark Settled</Btn>
        </div>
      </div>
    </Modal>
  )
}
