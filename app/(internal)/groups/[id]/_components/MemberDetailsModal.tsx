'use client'

import React from 'react'
import { Modal, Btn } from '@/components/ui'
import { fmtDate } from '@/lib/utils'
import type { Member } from '@/types'

interface MemberDetailsModalProps {
  open: boolean
  onClose: () => void
  member: Member | null
}

export const MemberDetailsModal: React.FC<MemberDetailsModalProps> = ({
  open,
  onClose,
  member
}) => {
  if (!member) return null

  return (
    <Modal open={open} onClose={onClose} title="Member Details">
      <div className="space-y-4">
        <div className="bg-[var(--surface2)] p-4 rounded-2xl flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xl font-bold">{member.persons?.name?.charAt(0)}</div>
          <div>
            <div className="font-bold text-lg">{member.persons?.name}</div>
            <div className="text-xs opacity-50">Ticket #{member?.ticket_no} · {member?.status}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--border)' }}>
            <div className="opacity-40 mb-1 uppercase tracking-tighter">Phone</div>
            <div className="font-bold">{member.persons?.phone || '—'}</div>
          </div>
          <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--border)' }}>
            <div className="opacity-40 mb-1 uppercase tracking-tighter">Joined</div>
            <div className="font-bold">{fmtDate(member.created_at)}</div>
          </div>
        </div>
        <p className="text-[10px] opacity-40 px-1 italic">Address: {member.persons?.address || 'Not provided'}</p>
      </div>
      <div className="flex justify-end mt-6">
        <Btn variant="secondary" onClick={onClose}>Close</Btn>
      </div>
    </Modal>
  )
}
