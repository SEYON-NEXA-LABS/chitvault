'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { useI18n } from '@/lib/i18n/context'
import { useTerminology } from '@/lib/hooks/useTerminology'
import { useToast } from '@/lib/hooks/useToast'
import { useGroupLedgerData } from '@/lib/hooks/useGroupLedgerData'
import { fmt, getToday, cn, fmtDate, getGroupDisplayName } from '@/lib/utils'
import { 
  Loading, Badge, StatCard, Btn, Card, Toast, CSVImportModal,
  TableCard, Table, Tr, Th, Td,
  Modal, Pagination
} from '@/components/ui'
import { 
  Gavel, Settings2, Calculator, Plus, ArrowLeft, RefreshCw, ChevronDown, AlertTriangle, History as HistoryIcon, Trash2,
  CheckCircle2, Printer
} from 'lucide-react'
import { PayoutVoucherModal } from '@/components/features/PayoutVoucherModal'

// Extracted Sub-components
import { AuctionLedger } from './_components/AuctionLedger'
import { MemberDirectory } from './_components/MemberDirectory'
import { AuctionForm } from './_components/AuctionForm'
import { AddMemberModal } from './_components/AddMemberModal'
import { PayoutSettlementModal } from './_components/PayoutSettlementModal'
import { AuditModal } from './_components/AuditModal'
import { MemberDetailsModal } from './_components/MemberDetailsModal'
import { RecordCollectionModal } from '@/components/features/RecordCollectionModal'

// Utils
import { haptics } from '@/lib/utils/haptics'
import { printPayoutVoucher, printMemberList } from '@/lib/utils/print'
import { downloadCSV } from '@/lib/utils/csv'
import { 
  calculatePot, 
  calculateForemanCommission, 
  calculateDistribution, 
  calculateNetInstallment, 
  calculateWinnerPayoutDirect 
} from '@/lib/utils/chit-calculations'

// Foundation Charts
import { LineAnalytics } from '@/components/ui'

import type { Group, Auction, Member, ForemanCommission, Person, Payment, AuctionCalculation } from '@/types'

export default function GroupLedgerPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = Number(params.id)
  const supabase = createClient()
  const { firm, role, can } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  const isOwner = role === 'owner' || role === 'superadmin'
  const { toast, show: showToast, hide: hideToast } = useToast()

  // --- Data Fetching (TanStack Query) ---
  const { data, isLoading, isError, error, refresh } = useGroupLedgerData(groupId, firm?.id, role ?? undefined)
  const { group, members = [], auctionHistory = [], commissions = [], payments = [], allPersons = [] } = data || {}

  // --- UI States ---
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [settling, setSettling] = useState<Auction | null>(null)
  const [settleForm, setSettleForm] = useState({ date: getToday(), note: '', amount: '', mode: 'Cash' })
  const [mathModal, setMathModal] = useState<{ auction: Auction; commission: ForemanCommission } | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [collectPersonId, setCollectPersonId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'members' | 'auctions' | 'payments'>('members')
  const [settlingAuctionId, setSettlingAuctionId] = useState<number | null>(null)
  const [selectedAuctionForPrint, setSelectedAuctionForPrint] = useState<number | null>(null)
  const [paymentPage, setPaymentPage] = useState(1)
  const PAYMENT_PAGE_SIZE = 15

  const handleQuickSettle = async (id: number) => {
    setSaving(true)
    try {
      const { error } = await supabase.from('auctions')
        .update({ 
          is_payout_settled: true, 
          payout_date: getToday() 
        })
        .eq('id', id)
      if (error) throw error
      showToast('Payout Settled!', 'success')
      setSettlingAuctionId(null)
      refresh()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // --- Auction Logic States ---
  const [aucFormOpen, setAucFormOpen] = useState(false)
  const [aucForm, setAucForm] = useState({
    month: '', auction_date: '', winner_id: '',
    auction_discount: '', foreman_member_id: '', notes: ''
  })
  const [eligibleList, setEligibleList] = useState<Member[]>([])
  const [calc, setCalc] = useState<AuctionCalculation | null>(null)
  const [calcError, setCalcError] = useState('')
  const [winnerBalance, setWinnerBalance] = useState(0)
  const [winnerAging, setWinnerAging] = useState(0)
  const [acknowledge, setAcknowledge] = useState(false)
  const [checkingWinner, setCheckingWinner] = useState(false)

  // --- Derived Data ---
  const auditedAuctions = useMemo(() => {
    const memberCount = group?.num_members || 1
    return auctionHistory.map((a: Auction) => {
      const comm = commissions.find((c: ForemanCommission) => c.auction_id === a.id)
      const commissionAmt = comm ? Number(comm.commission_amt) : 0
      const discount = Number(a.auction_discount || 0)
      const pool = Math.max(0, discount - commissionAmt)
      const perMemberShare = pool / memberCount
      return { ...a, dividend: perMemberShare }
    })
  }, [auctionHistory, commissions, group])
 
  const paginatedPayments = useMemo(() => {
    return payments.slice((paymentPage - 1) * PAYMENT_PAGE_SIZE, paymentPage * PAYMENT_PAGE_SIZE)
  }, [payments, paymentPage])

  const yieldData = useMemo(() => {
    let runningTotal = 0
    return auditedAuctions
      .filter((a: any) => a.status === 'confirmed')
      .map((a: any) => {
        runningTotal += (a.dividend || 0)
        return {
          name: `M${a.month}`,
          [t('auction_discount')]: Number(a.auction_discount || 0),
          [t('yield_per_member_gain')]: a.dividend,
          [t('yield_cumulative_gain')]: runningTotal
        }
      })
  }, [auditedAuctions, t])

  // --- Handlers ---
  const handleAddMember = async (payload: any) => {
    if (!firm || !group) return
    const requested = Number(payload.tickets || 1)
    if (members.length + requested > group.num_members) {
      showToast(`Group full! Only ${group.num_members - members.length} spots remaining.`, 'error')
      return
    }
    setSaving(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      let person_id = payload.person_id ? Number(payload.person_id) : null

      if (!person_id) {
        const { data: pData, error: pErr } = await supabase.from('persons')
          .insert({
            name: payload.name, nickname: payload.nickname, phone: payload.phone,
            address: payload.address, firm_id: firm.id, created_by: userData.user?.id
          })
          .select('id').single()
        if (pErr) throw pErr
        person_id = pData.id
      }

      const insertPayload = []
      let currentTicket = Number(payload.ticket_no)
      const usedTickets = new Set(members.map((m: Member) => m.ticket_no))
      
      for (let i = 0; i < Number(payload.tickets); i++) {
        while (usedTickets.has(currentTicket)) currentTicket++
        insertPayload.push({
          firm_id: firm.id, group_id: group.id, person_id,
          ticket_no: currentTicket, status: 'active', created_by: userData.user?.id
        })
        usedTickets.add(currentTicket)
      }

      const { error: mErr } = await supabase.from('members').insert(insertPayload)
      if (mErr) throw mErr

      showToast('Member(s) added successfully!', 'success')
      setAddOpen(false)
      refresh()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function revertPayment(id: number) {
    if (!confirm('Revert this payment? This will update the member\'s outstanding balance.')) return
    // @ts-ignore
    haptics.heavy()
    setSaving(true)
    const { error } = await supabase.from('payments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Payment reverted successfully!', 'success')
      refresh()
    }
    setSaving(false)
  }

  const handleSettlePayout = async () => {
    if (!settling) return
    setSaving(true)
    try {
      const { error } = await supabase.from('auctions')
        .update({
          is_payout_settled: true, payout_date: settleForm.date,
          payout_amount: Number(settleForm.amount), payout_note: settleForm.note,
          payout_mode: settleForm.mode
        })
        .eq('id', settling.id)
      if (error) throw error
      showToast('Payout Settled!', 'success')
      setSettling(null)
      refresh()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDraft = async (id: number) => {
    if (!confirm('Confirm this draft?')) return
    setSaving(true)
    try {
      await Promise.all([
        supabase.from('auctions').update({ status: 'confirmed' }).eq('id', id),
        supabase.from('foreman_commissions').update({ status: 'confirmed' }).eq('auction_id', id)
      ])
      showToast('Draft Confirmed!', 'success')
      refresh()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const checkWinnerBalance = useCallback(async (winnerId: string) => {
    if (!winnerId || !group) return
    setCheckingWinner(true)
    try {
      const mem = members.find((m: Member) => m.id === +winnerId)
      if (!mem) return

      const [gAucs, mPays] = await Promise.all([
        supabase.from('auctions').select('month, dividend, status').eq('group_id', group.id).eq('status', 'confirmed'),
        supabase.from('payments').select('amount, month').eq('member_id', mem.id).eq('group_id', group.id)
      ])

      const auctionsArr = gAucs.data || []
      const paymentsArr = mPays.data || []
      const latestMonth = auctionsArr.length > 0 ? Math.max(...auctionsArr.map((a: any) => Number(a.month))) : 0
      
      let totalDue = 0, missedCount = 0
      const monthlyDue = Number(group.monthly_contribution)

      for (let m = 1; m <= latestMonth + 1; m++) {
        const prevAuc = auctionsArr.find((a: any) => a.month === m - 1)
        const div = (group.auction_scheme === 'ACCUMULATION' || !prevAuc) ? 0 : Number(prevAuc.dividend || 0)
        const due = monthlyDue - div
        const paid = paymentsArr.filter((p: any) => p.month === m).reduce((s: number, p: any) => s + Number(p.amount), 0)
        if (due - paid > 0.01) { totalDue += (due - paid); missedCount++ }
      }
      setWinnerBalance(totalDue); setWinnerAging(missedCount); setAcknowledge(totalDue <= 0.01)
    } finally {
      setCheckingWinner(false)
    }
  }, [group, members, supabase])

  const onBidChange = async (bid: string) => {
    setAucForm(f => ({ ...f, auction_discount: bid }))
    if (!bid || !group || isNaN(+bid)) { setCalc(null); setCalcError(''); return }
    
    try {
      const bidAmt = +bid;
      const scheme = group.auction_scheme as any;
      
      const pot = calculatePot(group.num_members, group.monthly_contribution);
      
      const minBid = pot * (group.min_bid_pct || 0);
      const maxBid = pot * (group.max_bid_pct || 1);
      
      if (bidAmt < minBid) throw new Error(`Bid cannot be less than minimum ₹${fmt(minBid)}`);
      if (bidAmt > maxBid) throw new Error(`Bid cannot exceed maximum ₹${fmt(maxBid)}`);
      
      const commType = group.commission_type === 'percent_of_chit' ? 'POT_PERCENTAGE' :
                       group.commission_type === 'percent_of_discount' ? 'DISCOUNT_PERCENTAGE' :
                       group.commission_type === 'percent_of_payout' ? 'PAYOUT_PERCENTAGE' : 'FIXED_AMOUNT';
      
      // if fixed amount, commissionRate is 0, else we convert percentage (e.g. 5 -> 0.05)
      const commRate = commType === 'FIXED_AMOUNT' ? 0 : Number(group.commission_value) / 100;
      const fixedAmount = commType === 'FIXED_AMOUNT' ? Number(group.commission_value) : 0;
      
      const commission = calculateForemanCommission(pot, bidAmt, commType, commRate, fixedAmount);
      
      const config = {
        dividendSplitPct: group.dividend_split_pct ? Number(group.dividend_split_pct) : 0.5,
        surplusSplitPct: group.surplus_split_pct ? Number(group.surplus_split_pct) : 0.5,
        stepAmount: group.step_amount ? Number(group.step_amount) : 0
      };
      
      const dist = calculateDistribution(scheme, group.num_members, bidAmt, commission, config);
      const netInstallment = calculateNetInstallment(group.monthly_contribution, dist.dividendPerMember, scheme);
      const netPayout = calculateWinnerPayoutDirect(pot, bidAmt, commission, true);
      
      setCalc({
        chit_value: pot,
        auction_discount: bidAmt,
        min_bid: minBid,
        max_bid: maxBid,
        discount: bidAmt,
        discount_cap: maxBid,
        commission_type: group.commission_type,
        commission_rate: commRate,
        commission_amt: commission,
        commission_recipient: group.commission_recipient,
        net_dividend: dist.dividendPool,
        num_members: group.num_members,
        per_member_div: dist.dividendPerMember,
        each_pays: netInstallment,
        net_payout: netPayout
      } as any);
      setCalcError('');
    } catch (err: any) {
      setCalc(null);
      setCalcError(err.message);
    }
  }

  const handleSaveAuction = async (status: 'confirmed' | 'draft') => {
    setSaving(true)
    try {
      const { error } = await supabase.rpc('record_auction_with_commission', {
        p_group_id: group?.id, p_month: +aucForm.month, p_auction_date: aucForm.auction_date,
        p_winner_id: +aucForm.winner_id, p_bid_amount: +aucForm.auction_discount,
        p_foreman_member_id: aucForm.foreman_member_id ? +aucForm.foreman_member_id : null,
        p_notes: aucForm.notes, p_status: status
      })
      if (error) throw error
      showToast('Auction Recorded!')
      setAucFormOpen(false)
      refresh()
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <Loading />
  
  if (isError || !group) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 text-center">
        <div className="p-4 bg-red-500/10 rounded-full">
          <AlertTriangle className="text-red-500 w-12 h-12" />
        </div>
        <div>
          <h1 className="text-xl font-black">{t('error')}</h1>
          <p className="text-sm opacity-60">{(error as any)?.message || 'Group not found or access denied'}</p>
        </div>
        <Btn variant="secondary" onClick={() => refresh()} icon={RefreshCw}>
          {t('retry')}
        </Btn>
      </div>
    )
  }

  const confirmedAucs = auditedAuctions.filter((a: any) => a.status === 'confirmed')
  const draftAucs = auditedAuctions.filter((a: any) => a.status === 'draft')
  
  return (
    <div className="space-y-6">
      {/* Header & Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/groups')} className="p-2.5 rounded-xl hover:bg-[var(--surface2)] transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1>{getGroupDisplayName(group, t)}</h1>
            <Badge variant={group.status === 'active' ? 'success' : 'gray'}>{group.status}</Badge>
          </div>
        </div>
        <div className="flex gap-1 p-1 bg-[var(--surface2)] rounded-xl border border-[var(--border)]">
          <button onClick={() => setView('members')} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", view === 'members' ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)] hover:text-[var(--text)]")}>Member Directory</button>
          <button onClick={() => setView('auctions')} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", view === 'auctions' ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)] hover:text-[var(--text)]")}>Auction History</button>
          <button onClick={() => setView('payments')} className={cn("px-4 py-2 text-xs font-bold rounded-lg transition-all", view === 'payments' ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)] hover:text-[var(--text)]")}>Payment History</button>
        </div>
        <div className="flex gap-2">
          {members.length < group.num_members && <Btn variant="primary" onClick={() => setAddOpen(true)} icon={Plus}>{t('add_member')}</Btn>}
          <Btn variant="secondary" onClick={() => { refresh(); showToast('Synced!') }} icon={RefreshCw}>Sync</Btn>
          <Btn variant="primary" onClick={() => {
            const nextMonth = confirmedAucs.length + 1
            setAucForm(f => ({ ...f, month: String(nextMonth) }))
            setAucFormOpen(true)
          }} icon={Plus}>{t('record_auction')}</Btn>
          <Btn variant="secondary" onClick={() => router.push(`/groups/${groupId}/settings`)} icon={Settings2}>Settings</Btn>
        </div>
      </div>

      {draftAucs.length > 0 && (
        <Card className="bg-orange-500/5 border-orange-500/20 p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-orange-500" />
            <p className="text-sm font-bold">You have {draftAucs.length} draft auctions pending confirmation.</p>
          </div>
          <Btn size="sm" variant="secondary" onClick={() => document.getElementById('ledger')?.scrollIntoView()}>Review</Btn>
        </Card>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t('current_month')} value={`${confirmedAucs.length}/${group.duration}`} color="info" />
        <StatCard label={t('enrollment_label')} value={`${members.length}/${group.num_members}`} color="accent" />
        <StatCard label={term.benefitLabel} value={fmt(confirmedAucs.reduce((s: number, a: any) => s + (a.dividend || 0), 0))} color="success" />
        <StatCard label={t('chit_value')} value={fmt(group.chit_value)} color="danger" />
      </div>

      <LineAnalytics title={t('yield_trend')} series={[t('auction_discount'), t('yield_per_member_gain')]} data={yieldData} height={280} xKey="name" />

      {/* Main Content Blocks */}
      {view === 'auctions' && (
        <div id="ledger">
          <div className="no-print">
            <AuctionLedger 
              group={group} auctionHistory={auditedAuctions} commissions={commissions} members={members} firm={firm} t={t}
              setSettling={setSettling} setSettleForm={setSettleForm} handleConfirmDraft={handleConfirmDraft} setMathModal={setMathModal}
              setSettlingAuctionId={setSettlingAuctionId}
              onViewBreakdown={setSelectedAuctionForPrint}
            />
          </div>
        </div>
      )}

      {view === 'members' && (
        <MemberDirectory 
          group={group} members={members} auctionHistory={auctionHistory} payments={payments} isOwner={isOwner} can={can as any} t={t}
          handlePrintMemberList={(cols) => printMemberList(group, members, auctionHistory, payments, firm, t, { populateCols: cols })}
          handleExport={() => downloadCSV(members, `${group.name}_members`)}
          setImportOpen={setImportOpen} setAddOpen={setAddOpen} router={router}
          deleteMember={async (id) => { await supabase.from('members').update({ deleted_at: new Date().toISOString() }).eq('id', id); refresh() }}
          setSelectedMember={setSelectedMemberId}
          setCollectPersonId={setCollectPersonId}
        />
      )}

      {view === 'payments' && (
        <TableCard title="Payment History" subtitle="Recent collections and transactions for this group">
          <Table>
            <thead>
              <Tr>
                <Th>Date</Th>
                <Th>Member</Th>
                <Th>Month</Th>
                <Th right>Amount</Th>
                <Th>Mode</Th>
                <Th>Type</Th>
                <Th right>Action</Th>
              </Tr>
            </thead>
            <tbody>
              {paginatedPayments.map((p: any) => (
                <Tr key={p.id}>
                  <Td className="whitespace-nowrap font-medium text-sub leading-tight">
                    <div>{fmtDate(p.payment_date)}</div>
                    <div className="text-muted">{new Date(p.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</div>
                  </Td>
                  <Td>
                    <div className="font-bold text-sm">{p.members?.persons?.name || 'Unknown'}</div>
                    <div className="text-sub font-mono">Ticket #{p.members?.ticket_no}</div>
                  </Td>
                  <Td className="font-bold text-xs">M{p.month}</Td>
                  <Td right className="font-black text-sm text-[var(--success)]">{fmt(p.amount)}</Td>
                  <Td><Badge variant="gray" className="text-[10px]">{p.mode}</Badge></Td>
                  <Td>
                    <Badge variant={p.payment_type === 'advance' ? 'info' : p.payment_type === 'full' ? 'success' : 'warning'} className="text-[9px] uppercase">
                      {p.payment_type}
                    </Badge>
                  </Td>
                  <Td right>
                    {isOwner && (
                      <Btn size="sm" variant="ghost" icon={Trash2} color="danger" onClick={() => revertPayment(p.id)} />
                    )}
                  </Td>
                </Tr>
              ))}
              {payments.length === 0 && (
                <Tr>
                  <Td colSpan={6} className="text-center py-20 opacity-30 italic">No payments recorded yet.</Td>
                </Tr>
              )}
            </tbody>
          </Table>
          {payments.length > PAYMENT_PAGE_SIZE && (
            <div className="p-4 border-t border-slate-100">
              <Pagination 
                current={paymentPage} 
                total={payments.length} 
                pageSize={PAYMENT_PAGE_SIZE} 
                onPageChange={setPaymentPage} 
              />
            </div>
          )}
        </TableCard>
      )}

      {/* Modals extracted to sub-components */}
      <AddMemberModal 
        open={addOpen} onClose={() => setAddOpen(false)} group={group} members={members} 
        allPersons={allPersons} firmId={firm?.id || ''} userId="" onSave={handleAddMember} saving={saving} t={t} 
      />

      <PayoutSettlementModal 
        open={!!settling} onClose={() => setSettling(null)} settling={settling} members={members} group={group}
        settleForm={settleForm} setSettleForm={setSettleForm} onSettle={handleSettlePayout} 
        onPrintVoucher={(auc: Auction) => {
          const winner = members.find((m: Member) => m.id === auc.winner_id);
          const comm = commissions.find(c => c.auction_id === auc.id);
          if (winner) {
            printPayoutVoucher(group, auc, winner, comm, firm, t);
          }
        }}
        saving={saving}
      />

      <AuditModal open={!!mathModal} onClose={() => setMathModal(null)} group={group} mathModal={mathModal} />

      <Modal
        open={!!settlingAuctionId}
        onClose={() => setSettlingAuctionId(null)}
        title={t('confirm_payout_title') || 'Confirm Payout'}
      >
        {(() => {
          const a = auditedAuctions.find((x: any) => x.id === settlingAuctionId)
          const w = members.find((x: any) => x.id === a?.winner_id)
          if (!a) return null

          return (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-[var(--success-dim)] text-[var(--success)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">{t('confirm_payout_q') || 'Proceed with Payout?'}</h3>
                <p className="text-sm text-slate-500">{t('confirm_payout_desc') || 'This will mark the auction as paid and record today as the payout date.'}</p>
              </div>

              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t('winner')}</span>
                  <span className="text-sm font-black">{w?.persons?.name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t('payout_amt')}</span>
                  <span className="text-lg font-black text-[var(--success)]">{fmt(a.net_payout || a.auction_discount)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Btn variant="secondary" onClick={() => setSettlingAuctionId(null)}>
                  {t('cancel')}
                </Btn>
                <Btn variant="primary" onClick={() => handleQuickSettle(a.id)}>
                  {t('confirm_mark_settled')}
                </Btn>
              </div>
            </div>
          )
        })()}
      </Modal>

      <MemberDetailsModal 
        open={!!selectedMemberId} 
        onClose={() => setSelectedMemberId(null)} 
        member={members.find((m: Member) => m.id === selectedMemberId) || null} 
        firmId={firm?.id || ''}
      />

      {collectPersonId && (
        <RecordCollectionModal 
          personId={collectPersonId} 
          onClose={() => setCollectPersonId(null)} 
          onSuccess={() => { refresh(); showToast('Payment Recorded!', 'success'); }} 
        />
      )}

      <AuctionForm 
        open={aucFormOpen} onClose={() => setAucFormOpen(false)} group={group} aucForm={aucForm} setAucForm={setAucForm}
        onBidChange={onBidChange} calc={calc} calcError={calcError} eligibleList={members.filter((m: Member) => !auctionHistory.some((a: Auction) => a.winner_id === m.id))}
        winnerBalance={winnerBalance} winnerAging={winnerAging} checkingWinner={checkingWinner}
        acknowledge={acknowledge} setAcknowledge={setAcknowledge} saving={saving}
        handleSaveAuction={handleSaveAuction} checkWinnerBalance={checkWinnerBalance} t={t}
      />

      <PayoutVoucherModal
        open={!!selectedAuctionForPrint}
        onClose={() => setSelectedAuctionForPrint(null)}
        auction={auditedAuctions.find((x: any) => x.id === selectedAuctionForPrint) || null}
        group={group}
        member={members.find((m: Member) => m.id === auditedAuctions.find((x: any) => x.id === selectedAuctionForPrint)?.winner_id) || null}
        commission={commissions.find((x: any) => x.auction_id === selectedAuctionForPrint) || null}
        firm={firm}
      />

      <CSVImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={async () => {}} title="Import Members" requiredFields={['Name']} />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
