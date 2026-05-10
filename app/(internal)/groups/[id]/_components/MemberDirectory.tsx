'use client'

import React from 'react'
import { Printer, FileSpreadsheet, Upload, UserPlus, History, Info, Trash2 } from 'lucide-react'
import { Table, TableCard, Th, Tr, Td, Btn, Badge } from '@/components/ui'
import { fmt, fmtDate, fmtMonth, cn, getWhatsAppLink } from '@/lib/utils'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'
import { CascadeDeleteModal } from '@/components/features/CascadeDeleteModal'
import { PrintOptionsModal } from '@/components/features/PrintOptionsModal'
import type { Group, Member, Auction, Payment } from '@/types'

interface MemberDirectoryProps {
  group: Group
  members: Member[]
  auctionHistory: Auction[]
  payments: Payment[]
  isOwner: boolean
  can: (perm: string) => boolean
  t: (key: string) => string
  firm?: { name: string }
  handlePrintMemberList: (populateCols?: string[]) => void
  handleExport: () => void
  setImportOpen: (open: boolean) => void
  setAddOpen: (open: boolean) => void
  router: any
  deleteMember: (id: number) => void
  setSelectedMember: (id: number | null) => void
  setCollectPersonId?: (id: number | null) => void
}

export const MemberDirectory: React.FC<MemberDirectoryProps> = ({
  group,
  members,
  auctionHistory,
  payments,
  isOwner,
  can,
  t,
  firm,
  handlePrintMemberList,
  handleExport,
  setImportOpen,
  setAddOpen,
  router,
  deleteMember,
  setSelectedMember,
  setCollectPersonId
}) => {
  const [delModal, setDelModal] = React.useState<{ open: boolean, id: number | null, name: string }>({ open: false, id: null, name: '' })
  const [printOpen, setPrintOpen] = React.useState(false)

  const MEMBER_COLS = [
    { id: 'ticket_no', label: 'Ticket #', category: 'identity' as const, required: true },
    { id: 'name', label: 'Member Name', category: 'identity' as const, required: true },
    { id: 'status', label: 'Member Status', category: 'identity' as const },
    { id: 'won_month', label: 'Won Month', category: 'auction' as const },
    { id: 'won_amount', label: 'Won Amount', category: 'auction' as const },
    { id: 'remarks', label: 'Remarks', category: 'financial' as const },
    { id: 'chit_value', label: 'Chit Value', category: 'financial' as const },
    { id: 'duration', label: 'Duration', category: 'financial' as const },
    { id: 'monthly_contribution', label: 'Monthly Pay', category: 'financial' as const },
    { id: 'start_date', label: 'Start Date', category: 'financial' as const },
    { id: 'dividend', label: 'Total Dividend', category: 'financial' as const },
  ]

  const handleDeleteClick = (m: Member) => {
    setDelModal({ open: true, id: m.id, name: `${m.persons?.name} (Ticket #${m.ticket_no})` })
  }
  return (
    <TableCard title={t('member_directory')} subtitle={`${members.length} entities`}
      actions={
        <div className="flex gap-2">
          <Btn variant="secondary" className="text-xs font-bold uppercase tracking-wider gap-2" size="sm" onClick={() => setPrintOpen(true)}>
            <Printer size={16} /> Print
          </Btn>
          {isOwner && (
            <>
              <Btn variant="secondary" className="text-xs font-bold uppercase tracking-wider gap-2" size="sm" onClick={handleExport}>
                <FileSpreadsheet size={16} /> {t('export')}
              </Btn>
              <Btn variant="secondary" className="text-xs font-bold uppercase tracking-wider gap-2" size="sm" onClick={() => setImportOpen(true)}>
                <Upload size={16} /> {t('import')}
              </Btn>
            </>
          )}
          {can('addMember') && (
            <Btn variant="primary" className="text-xs font-bold uppercase tracking-wider gap-2" size="sm" onClick={() => setAddOpen(true)}>
              <UserPlus size={16} /> {t('add_member')}
            </Btn>
          )}
        </div>
      }>
      <Table>
        <thead>
          <Tr>
            <Th className="text-xs font-bold uppercase tracking-wider opacity-40">#</Th>
            <Th className="text-xs font-bold uppercase tracking-wider">Name</Th>
            <Th className="hidden md:table-cell text-xs font-bold uppercase tracking-wider">{t('status')}</Th>
            <Th className="hidden sm:table-cell text-xs font-bold uppercase tracking-wider">{t('won_month')}</Th>
            <Th className="hidden xl:table-cell text-xs font-bold uppercase tracking-wider">Streak</Th>
            <Th className="hidden lg:table-cell text-xs font-bold uppercase tracking-wider">Last Pay</Th>
            <Th right className="hidden sm:table-cell text-xs font-bold uppercase tracking-wider">Paid</Th>
            <Th right className="text-xs font-bold uppercase tracking-wider">Outstanding</Th>
            <Th right className="no-print text-xs font-bold uppercase tracking-wider">Actions</Th>
          </Tr>
        </thead>
        <tbody>
          {members.length === 0 ? (
            <Tr><Td colSpan={9} className="text-center py-16 text-slate-400 italic text-sm">{t('no_members')}</Td></Tr>
          ) : members.map((m) => {
            const financial = group ? getMemberFinancialStatus(m, group, auctionHistory, payments) : null
            return (
              <Tr key={m.id}>
                <Td><span className="font-mono font-bold text-xs text-slate-400">{m.ticket_no}</span></Td>
                <Td>
                  <div className="flex flex-col py-2 justify-center">
                    <span className="text-sm font-bold text-slate-900 mb-0.5">{m.persons?.name}</span>
                    {auctionHistory.some(a => a.winner_id === m.id) && (
                      <div className="flex">
                        <Badge variant="accent" className="px-1.5 py-0 text-[10px] font-bold uppercase">Winner</Badge>
                      </div>
                    )}
                  </div>
                </Td>
                <Td className="hidden md:table-cell">
                  {m.status === 'foreman' 
                    ? <Badge variant="info" className="text-[10px] font-bold uppercase">Foreman</Badge> 
                    : <Badge variant="success" className="text-[10px] font-bold uppercase">Active</Badge>
                  }
                </Td>
                <Td className="hidden sm:table-cell">
                  {(() => {
                    const auc = auctionHistory.find(a => a.winner_id === m.id && a.status === 'confirmed')
                    return auc 
                      ? <Badge variant="accent" className="text-[10px] font-bold uppercase">{fmtMonth(auc.month, group?.start_date)}</Badge> 
                      : <span className="text-xs text-slate-300">—</span>
                  })()}
                </Td>
                <Td className="hidden xl:table-cell">
                  <div className="flex gap-1">
                    {financial?.streak.slice(0, 10).map(s => (
                      <div key={s.month} className="w-2 h-4 rounded-[2px]" style={{ background: `var(--${s.status})`, opacity: 0.6 }} />
                    ))}
                  </div>
                </Td>
                <Td right className="hidden lg:table-cell">
                  <span className="text-xs text-slate-400 font-medium">
                    {(() => {
                      const mPays = payments.filter(p => Number(p.member_id) === Number(m.id) && Number(p.group_id) === Number(group?.id))
                      if (mPays.length === 0) return '—'
                      const last = mPays.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                      return fmtDate(last.created_at)
                    })()}
                  </span>
                </Td>
                <Td right className="hidden sm:table-cell">
                  <span className="text-xs text-slate-400 font-bold">{financial ? fmt(financial.totalPaid) : '—'}</span>
                </Td>
                <Td right>
                  <div className="flex flex-col items-end gap-1">
                    {financial && (
                      <span className={cn("text-sm font-bold", financial.missedCount > 0 ? "text-red-600" : financial.balance > 0 ? "text-blue-600" : "text-emerald-600")}>
                        {financial.balance > 0.01 ? fmt(financial.balance) : 'Paid'}
                      </span>
                    )}
                    {financial && financial.balance > 0.01 && (
                      <Btn size="sm" variant="primary" className="py-0.5 px-2 h-auto text-[10px] font-bold uppercase tracking-wider" onClick={() => setCollectPersonId?.(m.person_id)}>
                        Collect
                      </Btn>
                    )}
                  </div>
                </Td>
                <Td right className="no-print">
                  <div className="flex justify-end gap-1">
                    <Btn size="sm" variant="ghost" className="text-emerald-600 hover:bg-emerald-50 font-bold" onClick={() => {
                      const msg = `Hello ${m.persons?.name}, this is a reminder from ${firm?.name} for your group '${group?.name}'. Your outstanding balance is ${fmt(financial?.balance)}. Please clear your dues at the earliest. Thank you.`
                      window.open(getWhatsAppLink(m.persons?.phone, msg), '_blank')
                    }} title={t('whatsapp_reminder') || 'WhatsApp Reminder'}>
                      WhatsApp
                    </Btn>
                    <Btn size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 font-bold" onClick={() => router.push(`/reports/member_history?member_id=${m.id}`)} title={t('member_history') || 'History'}>
                      History
                    </Btn>
                    <Btn size="sm" variant="ghost" className="text-slate-500 hover:bg-slate-100 font-bold" onClick={() => router.push(`/members/${m.person_id}`)} title={t('member_info') || 'Info'}>
                      Info
                    </Btn>
                    {can('deleteMember') && (
                      <Btn size="sm" variant="ghost" className="text-red-600 hover:bg-red-50 font-bold" onClick={() => handleDeleteClick(m)} title={t('delete_member') || 'Delete'}>
                        Delete
                      </Btn>
                    )}
                  </div>
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
      
      <CascadeDeleteModal 
        open={delModal.open}
        onClose={() => setDelModal({ open: false, id: null, name: '' })}
        onConfirm={() => {
          if (delModal.id) deleteMember(delModal.id)
          setDelModal({ open: false, id: null, name: '' })
        }}
        title="Remove Member from Group?"
        targetId={delModal.id || ''}
        targetType="member"
      />

      <PrintOptionsModal 
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        onPrint={handlePrintMemberList}
        availableCols={MEMBER_COLS}
        defaultSelected={['ticket_no', 'name', 'status', 'chit_value', 'monthly_contribution']}
        title={`Print List - ${group.name}`}
      />
    </TableCard>
  )
}
