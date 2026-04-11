'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, getToday, getGroupDisplayName, cn } from '@/lib/utils'
import { Btn, Badge, TableCard, Table, Th, Td, Tr, Modal, Field, Loading, Empty, Toast } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { logActivity } from '@/lib/utils/logger'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, TrendingDown, FileSpreadsheet, ShieldAlert, Edit2, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { downloadCSV } from '@/lib/utils/csv'
import { useTerminology } from '@/lib/hooks/useTerminology'
import type { Group, Member, Auction, AuctionCalculation, ForemanCommission, Person, Firm, Payment } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'

const PAGE_SIZE = 20

export default function AuctionsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  const isOwner = role === 'owner' || role === 'superadmin'
  const { toast, show, hide } = useToast()
  const router = useRouter()

  const [groups,      setGroups]      = useState<Group[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [auctions,    setAuctions]    = useState<Auction[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [loading,     setLoading]     = useState(true)
  const [addOpen,     setAddOpen]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [firms,       setFirms]       = useState<Firm[]>([])
  
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [form, setForm] = useState({
    group_id: '', month: '', auction_date: '', winner_id: '',
    auction_discount: '', foreman_member_id: '', notes: ''
  })
  const [editingId,  setEditingId]  = useState<number | null>(null)
  const [eligible,   setEligible]   = useState<Member[]>([])
  const [calc,       setCalc]       = useState<AuctionCalculation | null>(null)
  const [calcError,  setCalcError]  = useState('')
  const [groupRules, setGroupRules] = useState<any>(null)
  
  const [winnerBalance, setWinnerBalance] = useState(0)
  const [winnerAging, setWinnerAging] = useState(0)
  const [acknowledge, setAcknowledge] = useState(false)
  const [checkingWinner, setCheckingWinner] = useState(false)

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
    if (!targetId) return

    try {
      // 1. Fetch Paginated Auctions (Precision Columns)
      const { data: aData, count } = await withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_date, winner_id, auction_discount, dividend, net_payout, status, is_payout_settled, firms(name)', { count: 'exact' }), targetId)
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

      if (role === 'superadmin' && firms.length === 0) {
        const { data: f } = await supabase.from('firms').select('id, name').order('name')
        setFirms(f || [])
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, firm, role, switchedFirmId, firms.length, page])

  useEffect(() => { load(true) }, [load])

  // LAZY LOADING: Check winner balance only when winner is selected in MODAL
  useEffect(() => {
    async function checkBalance() {
      if (!form.winner_id || !form.group_id || !addOpen) {
        setWinnerBalance(0); setWinnerAging(0); setAcknowledge(false); return
      }
      
      setCheckingWinner(true)
      const mem = members.find(m => m.id === +form.winner_id)
      const grp = groups.find(g => g.id === +form.group_id)
      if (!mem || !grp) { setCheckingWinner(false); return }

      // Focused fetch for THIS member only
      const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
      const [gAucs, mPays] = await Promise.all([
        withFirmScope(supabase.from('auctions').select('month, dividend, status'), targetId).eq('group_id', grp.id).eq('status', 'confirmed').is('deleted_at', null),
        withFirmScope(supabase.from('payments').select('amount, month'), targetId).eq('member_id', mem.id).eq('group_id', grp.id).is('deleted_at', null)
      ])

      const auctionsArr = gAucs.data || []
      const paymentsArr = mPays.data || []

      const latestMonth = auctionsArr.length
      const nextDate = new Date(grp.start_date || getToday())
      nextDate.setMonth(nextDate.getMonth() + latestMonth)
      const isNextDue = new Date() >= nextDate
      const currentMonth = Math.min(grp.duration, isNextDue ? latestMonth + 1 : latestMonth)
      
      let totalDue = 0
      let missedCount = 0
      const isAcc = grp.auction_scheme === 'ACCUMULATION'

      for (let mCount = 1; mCount <= currentMonth; mCount++) {
        const prevAuc = auctionsArr.find((a: any) => a.month === mCount - 1)
        const div = (isAcc || !prevAuc) ? 0 : Number(prevAuc.dividend || 0)
        const due = Number(grp.monthly_contribution) - div
        const paid = paymentsArr.filter((p: any) => p.month === mCount).reduce((s: number, p: any) => s + Number(p.amount), 0)
        if (due - paid > 0.01) {
          totalDue += (due - paid)
          missedCount++
        }
      }
      setWinnerBalance(totalDue)
      setWinnerAging(missedCount)
      setAcknowledge(totalDue <= 0.01)
      setCheckingWinner(false)
    }
    checkBalance()
  }, [form.winner_id, form.group_id, addOpen])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  async function onGroupChange(groupId: string) {
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
    setCheckingWinner(true)
    const { data: g } = await withFirmScope(supabase.from('groups').select('*').eq('id', +groupId), targetId).single()
    if (!g) { setCheckingWinner(false); return }
    
    // Fetch confirmed auctions only for this group to suggest month
    const { data: gAucs } = await withFirmScope(supabase.from('auctions').select('month, auction_date, winner_id, status'), targetId)
      .eq('group_id', g.id)
      .is('deleted_at', null)
    
    const confirmedAucs = gAucs?.filter((a: any) => a.status === 'confirmed').sort((a: any, b: any) => (a.month || 0) - (b.month || 0)) || []
    const winnerIds = gAucs?.map((a: any) => a.winner_id) || []
    
    // Fetch eligible members (Lazy)
    const { data: gMem } = await withFirmScope(supabase.from('members').select('id, ticket_no, persons(name)').eq('group_id', g.id).in('status', ['active', 'foreman']), targetId)
    const eligibleList = (gMem as any[])?.filter((m: any) => !winnerIds.includes(m.id)) || []
    const foremanList = (gMem as any[])?.filter((m: any) => m.status === 'foreman') || []

    let nextDate = g.start_date || getToday()
    if (confirmedAucs.length > 0) {
      const last = confirmedAucs[confirmedAucs.length - 1]
      const d = new Date(last.auction_date || g.start_date)
      d.setMonth(d.getMonth() + 1)
      nextDate = d.toISOString().split('T')[0]
    }

    setGroupRules(g)
    setEligible(eligibleList as any)
    setForm(f => ({
      ...f, group_id: groupId, month: String(confirmedAucs.length + 1), auction_date: nextDate,
      auction_discount: '', winner_id: '', foreman_member_id: foremanList[0]?.id?.toString() || '', notes: ''
    }))
    setCalc(null); setCalcError('')
    setCheckingWinner(false)
  }

  async function onBidChange(bid: string) {
    setForm(f => ({ ...f, auction_discount: bid }))
    setCalc(null); setCalcError('')
    if (!bid || !form.group_id || isNaN(+bid)) return
    const { data, error } = await supabase.rpc('calculate_auction', {
      p_group_id:   +form.group_id,
      p_auction_discount: +bid
    })
    if (error) { setCalcError(error.message); return }
    setCalc(data)
  }

  async function handleSave(status: 'draft' | 'confirmed' = 'confirmed') {
    if (!form.group_id || !form.winner_id || !form.auction_discount || !form.auction_date) {
      show('Fill in group, winner, discount and date.', 'error'); return
    }
    if (status === 'confirmed' && winnerBalance > 0.01 && !acknowledge) {
      show('Please acknowledge the member outstanding dues first.', 'error'); return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('record_auction_with_commission', {
      p_group_id:           +form.group_id,
      p_month:              +form.month,
      p_auction_date:       form.auction_date,
      p_winner_id:          +form.winner_id,
      p_auction_discount:   +form.auction_discount,
      p_foreman_member_id:  form.foreman_member_id ? +form.foreman_member_id : null,
      p_notes:              form.notes || '',
      p_status:             status,
      p_auction_id:         editingId
    })

    if (error) { show(error.message, 'error'); setSaving(false) }
    else { 
      show(editingId ? 'Auction updated!' : 'Auction recorded!'); 
      setAddOpen(false); load()
    }
    setSaving(false)
  }

  async function handleEdit(a: Auction) {
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
    setLoading(true)
    try {
      // 1. Fetch group rules and members for THIS specific group
      const [gRes, mRes] = await Promise.all([
        withFirmScope(supabase.from('groups').select('*').eq('id', a.group_id), targetId).single(),
        withFirmScope(supabase.from('members').select('id, ticket_no, persons(name)').eq('group_id', a.group_id).in('status', ['active', 'foreman']), targetId)
      ])

      const g = gRes.data
      const winnerIds = auctions.filter((auc: any) => auc.group_id === a.group_id && auc.id !== a.id).map((auc: any) => auc.winner_id)
      const eligibleList = (mRes.data as any[])?.filter((m: any) => !winnerIds.includes(m.id)) || []
      
      setGroupRules(g)
      setEligible(eligibleList as any)
      setEditingId(a.id)
      setForm({
        group_id: String(a.group_id),
        month: String(a.month),
        auction_date: a.auction_date || '',
        winner_id: String(a.winner_id),
        auction_discount: String(a.auction_discount),
        foreman_member_id: commissions.find(c => c.auction_id === a.id)?.foreman_member_id?.toString() || '',
        notes: (a as any).notes || ''
      })
      
      // Calculate auction result for edit mode
      const { data: cData } = await supabase.rpc('calculate_auction', {
        p_group_id: a.group_id,
        p_auction_discount: a.auction_discount
      })
      setCalc(cData)
      setAddOpen(true)
    } finally {
      setLoading(false)
    }
  }

  const pageYield = useMemo(() => auctions.reduce((s, a) => s + Number(a.auction_discount || 0), 0), [auctions])
  const pagePayouts = useMemo(() => auctions.reduce((s, a) => s + Number(a.net_payout || 0), 0), [auctions])

  async function del(id: number) {
    if (!can('deleteAuction')) return
    if (!confirm('Move this auction to trash?')) return
    
    const auc = auctions.find(a => a.id === id);
    const { error } = await supabase.from('auctions').update({ deleted_at: new Date() }).eq('id', id)
    
    if (error) show(error.message, 'error')
    else { 
      show('Auction moved to trash'); 
      if (auc && firm) {
        await logActivity(firm.id, 'AUCTION_ARCHIVED', 'auction', id, { month: auc.month, group_id: auc.group_id });
      }
      load(); 
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)]">{t('auction_ledger')}</h1>
          <p className="text-xs opacity-60 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
            Paginated access for Office performance.
          </p>
        </div>
        <div className="flex gap-2">
           <Btn variant="secondary" size="sm" onClick={() => downloadCSV(auctions, 'auctions')} icon={FileSpreadsheet}>CSV</Btn>
           {can('recordAuction') && <Btn variant="primary" size="sm" onClick={() => { 
             setEditingId(null); 
             setForm({ group_id: '', month: '', auction_date: '', winner_id: '', auction_discount: '', foreman_member_id: '', notes: '' });
             setCalc(null);
             setAddOpen(true); 
           }} icon={Plus}>{t('record_auction')}</Btn>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 no-print">
        <div className="bg-[var(--surface)] p-4 rounded-3xl neumo-out">
          <div className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">Page Yield</div>
          <div className="text-xl font-black italic text-[var(--accent)]">{fmt(pageYield)}</div>
        </div>
        <div className="bg-[var(--surface)] p-4 rounded-3xl neumo-out">
          <div className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-1">Total Payouts</div>
          <div className="text-xl font-black italic text-[var(--success)]">{fmt(pagePayouts)}</div>
        </div>
      </div>

      <TableCard title="Auction Ledger" subtitle={`Page ${page} of ${totalPages || 1} • Total records: ${totalCount}`}>
        <Table responsive>
          <thead><tr>
            <Th>{t('group')}</Th>
            <Th>{t('auction_month')}</Th>
            <Th>{t('winner')}</Th>
            <Th right>{t('auction_discount')}</Th>
            <Th right>{t('net_payout')}</Th>
            <Th>{t('action')}</Th>
          </tr></thead>
          <tbody>
            {auctions.map(a => {
              const g = groups.find(x => x.id === a.group_id)
              const w = members.find(x => x.id === a.winner_id)
              return (
                <Tr key={a.id}>
                  <Td label="Group" className="font-bold">{g ? getGroupDisplayName(g, t) : '—'}</Td>
                  <Td label="Month"><Badge variant="info">{fmtMonth(a.month, g?.start_date)}</Badge></Td>
                  <Td label="Winner">👑 {w?.persons?.name || '—'}</Td>
                  <Td label="Bid" right>{fmt(a.auction_discount)}</Td>
                  <Td label="Payout" right className="font-extrabold text-[var(--success)]">{fmt(a.net_payout)}</Td>
                      <Td label="Action">
                        <div className="flex items-center gap-1">
                          <Btn size="sm" variant="ghost" onClick={() => handleEdit(a)} icon={Edit2} />
                          {can('deleteAuction') && <Btn size="sm" variant="ghost" onClick={() => del(a.id)} icon={Trash2} className="text-[var(--danger)]" />}
                        </div>
                      </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
        
        <div className="flex justify-center items-center gap-2 mt-6 p-4 border-t border-white/5">
          <Btn variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} icon={ChevronLeft} />
          <span className="text-xs font-bold opacity-40 uppercase tracking-widest px-4">Page {page} of {totalPages}</span>
          <Btn variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} icon={ChevronRight} />
        </div>
      </TableCard>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Record Auction" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Chit Group" className="col-span-2">
            <select className={inputClass} style={inputStyle} value={form.group_id} onChange={e => onGroupChange(e.target.value)}>
              <option value="">Select group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{getGroupDisplayName(g, t)}</option>)}
            </select>
          </Field>

          {checkingWinner ? <div className="col-span-2 py-4 flex justify-center"><Loading /></div> : (
            <>
              <Field label={t('winner_bidder')} className="col-span-2">
                <select className={inputClass} style={inputStyle} value={form.winner_id} onChange={e => setForm(f => ({...f, winner_id: e.target.value}))}>
                  <option value="">{t('select_winner')}</option>
                  {eligible.map(m => <option key={m.id} value={m.id}>{m.persons?.name} (#{m.ticket_no})</option>)}
                </select>
              </Field>

              {winnerBalance > 0.01 && (
                <div className="col-span-2 p-4 rounded-2xl border bg-danger-500/5 border-danger-500/20">
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={20} className="text-danger-500 mt-1" />
                    <div className="flex-1">
                      <div className="font-bold text-danger-600 text-sm">Owes ₹{fmt(winnerBalance)} ({winnerAging} months)</div>
                      <label className="flex items-center gap-2 mt-2 cursor-pointer"><input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} /><span className="text-[10px] font-bold uppercase">I acknowledge these dues</span></label>
                    </div>
                  </div>
                </div>
              )}

              <Field label="Auction Discount (₹)" className="col-span-2"><input className={inputClass} type="number" value={form.auction_discount} onChange={e => onBidChange(e.target.value)} /></Field>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/5">
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>{t('cancel')}</Btn>
          <Btn variant="primary" loading={saving} onClick={() => handleSave('confirmed')} disabled={!!calcError || checkingWinner}>{t('record_auction')}</Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
