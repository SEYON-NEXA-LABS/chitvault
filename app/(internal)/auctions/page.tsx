'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtMonth, fmtDate, getGroupDisplayName } from '@/lib/utils'
import { Btn, TableCard, Table, Th, Td, Tr, Loading, Toast, Pagination } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import Link from 'next/link'
import { FileSpreadsheet, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { downloadCSV } from '@/lib/utils/csv'
import { useTerminology } from '@/lib/hooks/useTerminology'
import type { Group, Member, Auction, ForemanCommission, Firm } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'

const PAGE_SIZE = 20

export default function AuctionsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  const { toast, show, hide } = useToast()

  const [groups,      setGroups]      = useState<Group[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [auctions,    setAuctions]    = useState<Auction[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [loading,     setLoading]     = useState(true)
  
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
    if (!targetId) return

    try {
      // 1. Fetch Paginated Auctions (Precision Columns)
      const { data: aData, count } = await withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_date, payout_date, winner_id, auction_discount, dividend, net_payout, status, is_payout_settled, firms(name)', { count: 'exact' }), targetId)
        .is('deleted_at', null)
        .order('month', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)
      
      setAuctions(aData || [])
      setTotalCount(count || 0)

      const relevantGroupIds = Array.from(new Set(aData?.map((a: any) => a.group_id) || []))
      const relevantWinnerIds = Array.from(new Set(aData?.map((a: any) => a.winner_id) || []))

      // 2. Fetch Supporting Metadata (Only what we need for the current page)
      const [g, m, fc] = await Promise.all([
        withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, auction_scheme, start_date'), targetId)
          .in('id', relevantGroupIds)
          .is('deleted_at', null),
        withFirmScope(supabase.from('members').select('id, ticket_no, group_id, person_id, status, persons(id, name)'), targetId)
          .in('id', relevantWinnerIds),
        withFirmScope(supabase.from('foreman_commissions').select('id, auction_id, group_id, month, chit_value, auction_discount, discount, commission_amt, commission_type, commission_rate, net_dividend, per_member_div, paid_to, foreman_member_id'), targetId)
          .in('auction_id', aData?.map((a: any) => a.id) || [])
      ])
      
      setGroups(g.data || [])
      setMembers(m.data || [])
      setCommissions(fc.data || [])
    } finally {
      setLoading(false)
    }
  }, [supabase, firm?.id, role, switchedFirmId, page])

  useEffect(() => { load(true) }, [load])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const pageYield = useMemo(() => auctions.reduce((s, a) => s + Number(a.auction_discount || 0), 0), [auctions])
  const pagePayouts = useMemo(() => auctions.reduce((s, a) => s + Number(a.net_payout || 0), 0), [auctions])

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)]">{t('auction_ledger')}</h1>
          <p className="text-xs opacity-60 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            {t('auctions_history_log')}
          </p>
        </div>
        <div className="flex gap-2">
           <Btn variant="secondary" size="sm" onClick={() => downloadCSV(auctions, 'auctions')} icon={FileSpreadsheet}>CSV</Btn>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 no-print">
        <div className="bg-[var(--surface)] p-4 rounded-3xl neumo-out">
          <div className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">{t('page_yield')}</div>
          <div className="text-xl font-black italic text-[var(--accent)]">{fmt(pageYield)}</div>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-3xl neumo-out">
          <div className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">{t('total_payouts')}</div>
          <div className="text-xl font-black italic text-[var(--success)]">{fmt(pagePayouts)}</div>
        </div>
      </div>

      <TableCard title={t('auction_ledger')} subtitle={`${t('page')} ${page} ${t('of')} ${totalPages || 1} • ${t('total_records')}: ${totalCount}`}>
        <Table responsive>
          <thead><tr>
            <Th>{t('group')}</Th>
            <Th>{t('auction_month')}</Th>
            <Th>{t('winner')}</Th>
            <Th right>{t('bid_amount')}</Th>
            <Th right>{t('net_payout')}</Th>
          </tr></thead>
          <tbody>
            {auctions.map(a => {
              const g = groups.find(x => x.id === a.group_id)
              const w = members.find(x => x.id === a.winner_id)
              return (
                <Tr key={a.id}>
                  <Td label="Group">
                    <Link href={`/groups/${a.group_id}`} className="flex flex-col min-h-[48px] justify-center hover:opacity-70 transition-opacity">
                      <span className="text-[13px] font-extrabold text-[var(--accent)]">{g ? getGroupDisplayName(g, t) : '—'}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest flex items-center gap-1">
                        {t('group')} <ExternalLink size={8} />
                      </span>
                    </Link>
                  </Td>
                  <Td label="Month">
                    <div className="flex flex-col min-h-[48px] justify-center">
                      <span className="text-[13px] font-black font-mono text-[var(--text)]">{fmtMonth(a.month, g?.start_date)}</span>
                      <span className="text-[8px] font-black uppercase tracking-tighter opacity-40">{a.auction_date ? fmtDate(a.auction_date) : t('no_date_set')}</span>
                    </div>
                  </Td>
                  <Td label="Winner">
                    <div className="flex flex-col min-h-[48px] justify-center">
                      <span className="text-[13px] font-extrabold text-[var(--text)] truncate max-w-[100px]">👑 {w?.persons?.name || '—'}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">{w ? `Ticket #${w.ticket_no}` : 'N/A'}</span>
                    </div>
                  </Td>
                  <Td label="Bid" right>
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      <span className="text-[13px] font-black font-mono text-[var(--danger)]">{fmt(a.auction_discount)}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">{t('winning_bid_label')}</span>
                    </div>
                  </Td>
                  <Td label="Payout" right>
                    <div className="flex flex-col min-h-[48px] justify-center items-end">
                      <span className="text-[13px] font-black font-mono text-[var(--success)]">{fmt(a.net_payout)}</span>
                      <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                        {a.is_payout_settled ? `${t('payout_amt')}: ${fmtDate(a.payout_date || '')}` : t('unsettled')}
                      </span>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
        
        <Pagination 
          current={page} 
          total={totalCount} 
          pageSize={PAGE_SIZE} 
          onPageChange={setPage} 
        />
      </TableCard>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
