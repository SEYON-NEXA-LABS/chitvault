'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { useI18n } from '@/lib/i18n/context'
import { useTerminology } from '@/lib/hooks/useTerminology'
import { useToast } from '@/lib/hooks/useToast'
import { useGroupLedgerData } from '@/lib/hooks/useGroupLedgerData'
import { fmt, getToday, getGroupDisplayName } from '@/lib/utils'
import { 
  Loading, Badge, StatCard, Btn, Card, Toast, CSVImportModal 
} from '@/components/ui'
import { 
  Gavel, Settings2, Calculator, Plus, ArrowLeft, RefreshCw, ChevronDown, AlertTriangle, History as HistoryIcon 
} from 'lucide-react'

// Extracted Sub-components
import { AuctionLedger } from './_components/AuctionLedger'
import { MemberDirectory } from './_components/MemberDirectory'
import { AuctionForm } from './_components/AuctionForm'
import { AddMemberModal } from './_components/AddMemberModal'
import { PayoutSettlementModal } from './_components/PayoutSettlementModal'
import { AuditModal } from './_components/AuditModal'
import { MemberDetailsModal } from './_components/MemberDetailsModal'

// Utils
import { printPayoutVoucher, printMemberList } from '@/lib/utils/print'
import { downloadCSV } from '@/lib/utils/csv'

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
  const { data, isLoading, refresh } = useGroupLedgerData(groupId, firm?.id, role ?? undefined)
  const { group, members, auctionHistory, commissions, payments, allPersons } = data

  // --- UI States ---
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [settling, setSettling] = useState<Auction | null>(null)
  const [settleForm, setSettleForm] = useState({ date: getToday(), note: '', amount: '', mode: 'Cash' })
  const [mathModal, setMathModal] = useState<{ auction: Auction; commission: ForemanCommission } | null>(null)
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

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
    return auctionHistory.map(a => {
      const comm = commissions.find(c => c.auction_id === a.id)
      const commissionAmt = comm ? Number(comm.commission_amt) : 0
      const pool = Number(a.auction_discount) - commissionAmt
      const perMemberShare = pool / (group?.num_members || 1)
      return { ...a, dividend: perMemberShare }
    })
  }, [auctionHistory, commissions, group])

  const yieldData = useMemo(() => {
    let runningTotal = 0
    return auditedAuctions
      .filter(a => a.status === 'confirmed')
      .map(a => {
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
          .select().single()
        if (pErr) throw pErr
        person_id = pData.id
      }

      const insertPayload = []
      let currentTicket = Number(payload.ticket_no)
      const usedTickets = new Set(members.map(m => m.ticket_no))
      
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
      const mem = members.find(m => m.id === +winnerId)
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
    if (!bid || !group || isNaN(+bid)) { setCalc(null); return }
    const { data, error } = await supabase.rpc('calculate_auction', { p_group_id: group.id, p_bid_amount: +bid })
    if (error) setCalcError(error.message)
    else { setCalc(data); setCalcError('') }
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

  if (isLoading || !group) return <Loading />

  const confirmedAucs = auditedAuctions.filter(a => a.status === 'confirmed')
  const draftAucs = auditedAuctions.filter(a => a.status === 'draft')
  
  return (
    <div className="space-y-6">
      {/* Header & Stats Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/groups')} className="p-2.5 rounded-xl hover:bg-[var(--surface2)] transition-all">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black">{getGroupDisplayName(group, t)}</h1>
            <Badge variant={group.status === 'active' ? 'success' : 'gray'}>{group.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {members.length < group.num_members && <Btn variant="primary" onClick={() => setAddOpen(true)} icon={Plus}>{t('add_member')}</Btn>}
          <Btn variant="secondary" onClick={() => { refresh(); showToast('Synced!') }} icon={RefreshCw}>Sync</Btn>
          <Btn variant="primary" onClick={() => setAucFormOpen(true)} icon={Plus}>{t('record_auction')}</Btn>
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
        <StatCard label={term.benefitLabel} value={fmt(confirmedAucs.reduce((s, a) => s + (a.dividend || 0), 0))} color="success" />
        <StatCard label={t('chit_value')} value={fmt(group.chit_value)} color="danger" />
      </div>

      <LineAnalytics title={t('yield_trend')} series={[t('auction_discount'), t('yield_per_member_gain')]} data={yieldData} height={280} xKey="name" />

      {/* Main Content Blocks */}
      <div id="ledger">
        <AuctionLedger 
          group={group} auctionHistory={auditedAuctions} commissions={commissions} members={members} t={t}
          setSettling={setSettling} setSettleForm={setSettleForm} handleConfirmDraft={handleConfirmDraft} setMathModal={setMathModal}
        />
      </div>

      <MemberDirectory 
        group={group} members={members} auctionHistory={auctionHistory} payments={payments} isOwner={isOwner} can={can as any} t={t}
        handlePrintMemberList={() => printMemberList(group, members, firm?.name || '')}
        handleExport={() => downloadCSV(members, `${group.name}_members`)}
        setImportOpen={setImportOpen} setAddOpen={setAddOpen} router={router}
        deleteMember={async (id) => { if(confirm('Delete?')) { await supabase.from('members').delete().eq('id', id); refresh() }}}
        setSelectedMember={setSelectedMemberId}
      />

      {/* Modals extracted to sub-components */}
      <AddMemberModal 
        open={addOpen} onClose={() => setAddOpen(false)} group={group} members={members} 
        allPersons={allPersons} firmId={firm?.id || ''} userId="" onSave={handleAddMember} saving={saving} t={t} 
      />

      <PayoutSettlementModal 
        open={!!settling} onClose={() => setSettling(null)} settling={settling} members={members} group={group}
        settleForm={settleForm} setSettleForm={setSettleForm} onSettle={handleSettlePayout} 
        onPrintVoucher={(auc) => printPayoutVoucher(group, auc, members.find(m => m.id === auc.winner_id)!, settleForm.date, firm?.name || '')}
        saving={saving}
      />

      <AuditModal open={!!mathModal} onClose={() => setMathModal(null)} group={group} mathModal={mathModal} />

      <MemberDetailsModal open={!!selectedMemberId} onClose={() => setSelectedMemberId(null)} member={members.find(m => m.id === selectedMemberId) || null} />

      <AuctionForm 
        open={aucFormOpen} onClose={() => setAucFormOpen(false)} group={group} aucForm={aucForm} setAucForm={setAucForm}
        onBidChange={onBidChange} calc={calc} calcError={calcError} eligibleList={members.filter(m => !auctionHistory.some(a => a.winner_id === m.id))}
        winnerBalance={winnerBalance} winnerAging={winnerAging} checkingWinner={checkingWinner}
        acknowledge={acknowledge} setAcknowledge={setAcknowledge} saving={saving}
        handleSaveAuction={handleSaveAuction} checkWinnerBalance={checkWinnerBalance} t={t}
      />

      <CSVImportModal open={importOpen} onClose={() => setImportOpen(false)} onImport={async () => {}} title="Import Members" requiredFields={['Name']} />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
