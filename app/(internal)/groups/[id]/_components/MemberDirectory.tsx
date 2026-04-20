'use client'

import React from 'react'
import { Printer, FileSpreadsheet, Upload, UserPlus, History, Info, Trash2 } from 'lucide-react'
import { Table, TableCard, Th, Tr, Td, Btn, Badge } from '@/components/ui'
import { fmt, fmtDate, fmtMonth, cn, getWhatsAppLink } from '@/lib/utils'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'
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
  handlePrintMemberList: () => void
  handleExport: () => void
  setImportOpen: (open: boolean) => void
  setAddOpen: (open: boolean) => void
  router: any
  deleteMember: (id: number) => void
  setSelectedMember: (id: number | null) => void
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
  setSelectedMember
}) => {
  return (
    <TableCard title={t('member_directory')} subtitle={`${members.length} entities`}
      actions={
        <div className="flex gap-2">
          <Btn variant="secondary" size="sm" onClick={handlePrintMemberList} icon={Printer}>Print</Btn>
          {isOwner && (
            <>
              <Btn variant="secondary" size="sm" onClick={handleExport} icon={FileSpreadsheet}>{t('export_people')}</Btn>
              <Btn variant="secondary" size="sm" onClick={() => setImportOpen(true)} icon={Upload}>{t('import_people')}</Btn>
            </>
          )}
          {can('addMember') && <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)} icon={UserPlus}>{t('add_member')}</Btn>}
        </div>
      }>
      <Table>
        <thead><tr><Th>#</Th><Th>Name</Th><Th className="hidden md:table-cell">{t('status')}</Th><Th className="hidden sm:table-cell">{t('won_month')}</Th><Th className="hidden xl:table-cell">Streak</Th><Th className="hidden lg:table-cell text-[10px] uppercase opacity-40">Last Pay</Th><Th right className="hidden sm:table-cell text-[10px] uppercase opacity-40">Paid</Th><Th right>Outstanding</Th><Th right className="no-print">Actions</Th></tr></thead>
        <tbody>
          {members.length === 0 ? (
            <Tr><Td colSpan={8} className="text-center py-12 opacity-50 italic">{t('no_members')}</Td></Tr>
          ) : members.map((m) => {
            const financial = group ? getMemberFinancialStatus(m, group, auctionHistory, payments) : null
            return (
              <Tr key={m.id}>
                <Td><span className="font-mono font-black text-[10px] bg-[var(--surface2)] px-1.5 py-0.5 rounded">{m.ticket_no}</span></Td>
                <Td className="font-semibold text-xs md:text-sm">
                  {m.persons?.name}
                  {auctionHistory.some(a => a.winner_id === m.id) && <Badge variant="accent" className="ml-2 px-1 py-0 text-[8px]">Winner</Badge>}
                </Td>
                <Td className="hidden md:table-cell">{m.status === 'foreman' ? <Badge variant="info" className="text-[9px] px-1 py-0">Foreman</Badge> : <Badge variant="success" className="text-[9px] px-1 py-0">Active</Badge>}</Td>
                <Td className="hidden sm:table-cell">
                  {(() => {
                    const auc = auctionHistory.find(a => a.winner_id === m.id && a.status === 'confirmed')
                    return auc ? <Badge variant="accent" className="text-[9px] px-1 py-0">{fmtMonth(auc.month, group?.start_date)}</Badge> : <span className="opacity-30">—</span>
                  })()}
                </Td>
                <Td className="hidden xl:table-cell">
                  <div className="flex gap-0.5">
                    {financial?.streak.slice(0, 10).map(s => (
                      <div key={s.month} className="w-1 h-3 rounded-[1px]" style={{ background: `var(--${s.status})` }} title={`M${s.month}: ${s.status}`} />
                    ))}
                  </div>
                </Td>
                <Td right className="hidden lg:table-cell font-mono text-[10px] opacity-60">
                  {(() => {
                    const mPays = payments.filter(p => Number(p.member_id) === Number(m.id) && Number(p.group_id) === Number(group?.id))
                    if (mPays.length === 0) return '—'
                    const last = mPays.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                    return fmtDate(last.created_at)
                  })()}
                </Td>
                <Td right className="hidden sm:table-cell">
                  <span className="font-mono text-xs opacity-60">{financial ? fmt(financial.totalPaid) : '—'}</span>
                </Td>
                <Td right>
                  {financial && (
                    <span className={cn("font-bold text-xs", financial.missedCount > 0 ? "text-[var(--danger)]" : financial.balance > 0 ? "text-[var(--info)]" : "text-[var(--success)]")}>
                      {financial.balance > 0.01 ? fmt(financial.balance) : 'Paid'}
                    </span>
                  )}
                </Td>
                <Td right className="no-print">
                  <div className="flex justify-end gap-1">
                    <Btn size="sm" variant="ghost" onClick={() => {
                      const msg = `Hello ${m.persons?.name}, this is a reminder from ${firm?.name} for your group '${group?.name}'. Your outstanding balance is ${fmt(financial?.balance)}. Please clear your dues at the earliest. Thank you.`
                      window.open(getWhatsAppLink(m.persons?.phone, msg), '_blank')
                    }} icon={() => (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                    )} />
                    <Btn size="sm" variant="ghost" onClick={() => router.push(`/reports/member_history?member_id=${m.id}`)} icon={History}>{t('ledger')}</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => router.push(`/members/${m.person_id}`)} icon={Info}>{t('profile')}</Btn>
                    {can('deleteMember') && auctionHistory.length === 0 && <Btn size="sm" variant="danger" onClick={() => deleteMember(m.id)} icon={Trash2}>{t('remove')}</Btn>}
                  </div>
                </Td>
                <Td className="only-print">
                  <div className="h-8 w-24 border-b border-black opacity-30"></div>
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </TableCard>
  )
}
