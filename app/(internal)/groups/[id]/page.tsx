'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, getToday, cn, APP_NAME, getGroupDisplayName, amtToWords } from '@/lib/utils'
import { Card, TableCard, Loading, Badge, StatCard, Btn, ProgressBar, Modal, Field, Toast, Empty, Table, Th, Td, Tr } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { downloadCSV } from '@/lib/utils/csv'
import { Gavel, Settings2, Calendar, Users, DollarSign, ArrowLeft, Calculator, Plus, UserPlus, Info, Trash2, MapPin, Phone, Download, Upload, FileSpreadsheet, CheckCircle2, Wallet, Printer, History, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { useTerminology } from '@/lib/hooks/useTerminology'
import Link from 'next/link'
import { CSVImportModal } from '@/components/ui'
import type { Group, Auction, Member, ForemanCommission, Person, GroupWithRules, Payment } from '@/types'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts'

export default function GroupLedgerPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  const isOwner = role === 'owner' || role === 'superadmin'

  const groupId = Number(params.id)

  const [group, setGroup] = useState<GroupWithRules | null>(null)
  const [auctionHistory, setAuctionHistory] = useState<Auction[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMember, setSelectedMember] = useState<number | null>(null)
  const [showAdv, setShowAdv] = useState(false)

  const { toast, show: showToast, hide: hideToast } = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addTab, setAddTab] = useState<'new' | 'existing'>('new')
  const [form, setForm] = useState({ name: '', nickname: '', phone: '', address: '', ticket_no: '', person_id: '', tickets: '1' })
  const [allPersons, setAllPersons] = useState<Person[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [settling, setSettling] = useState<Auction | null>(null)
  const [settleForm, setSettleForm] = useState({ date: getToday(), note: '', amount: '', mode: 'Cash' })
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [mathModal, setMathModal] = useState<{ auction: Auction, commission: ForemanCommission } | null>(null)

  // --- Record Auction States ---
  const [aucFormOpen, setAucFormOpen] = useState(false)
  const [aucForm, setAucForm] = useState({
    month: '', auction_date: '', winner_id: '',
    auction_discount: '', foreman_member_id: '', notes: ''
  })
  const [eligibleList, setEligibleList] = useState<Member[]>([])
  const [calc, setCalc] = useState<any>(null)
  const [calcError, setCalcError] = useState('')
  const [winnerBalance, setWinnerBalance] = useState(0)
  const [winnerAging, setWinnerAging] = useState(0)
  const [acknowledge, setAcknowledge] = useState(false)
  const [checkingWinner, setCheckingWinner] = useState(false)

  // --- Analytic Data Derivations (Zero-Audit) ---
  const auditedAuctions = useMemo(() => {
    return auctionHistory.map(a => {
      const comm = commissions.find(c => c.auction_id === a.id);
      const commissionAmt = comm ? Number(comm.commission_amt) : 0;
      const pool = Number(a.auction_discount) - commissionAmt;
      const perMemberShare = pool / (group?.num_members || 1);
      return { ...a, audited_div: perMemberShare, audited_pool: pool };
    });
  }, [auctionHistory, commissions, group]);

  const yieldData = useMemo(() => {
    return auditedAuctions
      .filter(a => a.status === 'confirmed')
      .map(a => ({
        name: `M${a.month}`,
        discount: Number(a.auction_discount || 0),
        dividend: a.audited_div,
      }))
  }, [auditedAuctions])

  const healthData = useMemo(() => {
    const counts = { success: 0, info: 0, danger: 0 }
    members.forEach(m => {
      if (!group) return
      const status = getMemberFinancialStatus(m, group, auctionHistory, payments)
      if (status.overallStatus === 'overdue') counts.danger++
      else if (status.overallStatus === 'current') counts.info++
      else counts.success++
    })
    return [
      { name: 'On Track', value: counts.success, color: 'var(--success)' },
      { name: 'Current', value: counts.info, color: 'var(--info)' },
      { name: 'Overdue', value: counts.danger, color: 'var(--danger)' },
    ].filter(x => x.value > 0)
  }, [members, group, auctionHistory, payments])

  const totalPossibleCollection = useMemo(() => {
    if (!group) return 0
    const latestMonth = auctionHistory.length > 0 ? Math.max(...auctionHistory.map(a => Number(a.month))) : 0
    const mContr = Number(group.monthly_contribution)
    return group.num_members * mContr * (latestMonth || 1)
  }, [group, auctionHistory])

  const load = useCallback(async (isInitial = false) => {
    if (!firm && role !== 'superadmin') return
    if (isInitial && !group) setLoading(true)

    const gQuery = supabase.from('groups').select('id, firm_id, name, duration, monthly_contribution, auction_scheme, start_date, num_members, accumulated_surplus, chit_value, commission_type, commission_value, commission_recipient').eq('id', groupId)
    const mQuery = supabase.from('members').select('id, ticket_no, group_id, person_id, status, persons(id, name, phone)').eq('group_id', groupId).order('ticket_no')
    const aQuery = supabase.from('auctions').select('id, group_id, month, auction_date, payout_date, winner_id, auction_discount, dividend, net_payout, status, is_payout_settled').eq('group_id', groupId).order('month')
    const fcQuery = supabase.from('foreman_commissions').select('id, auction_id, group_id, month, commission_amt, foreman_member_id').eq('group_id', groupId).order('month')
    const payQuery = supabase.from('payments').select('id, member_id, group_id, month, amount, type, date').eq('group_id', groupId).is('deleted_at', null)
    const pQuery = supabase.from('persons').select('id, name, phone').order('name')

    if (role !== 'superadmin' && firm) {
      gQuery.eq('firm_id', firm.id)
      pQuery.eq('firm_id', firm.id)
    }

    const [gRes, mRes, aRes, pRes, fcRes, payRes] = await Promise.all([
      gQuery.single(),
      mQuery,
      aQuery,
      pQuery,
      fcQuery,
      payQuery
    ])

    if (!gRes.data) { router.push('/groups'); return }

    setGroup(gRes.data)
    setMembers(mRes.data || [])
    setAuctionHistory(aRes.data || [])
    setAllPersons(pRes.data || [])
    setCommissions(fcRes.data || [])
    setPayments(payRes.data || [])
    setLoading(false)
  }, [firm, groupId, router, supabase, group, role])

  useEffect(() => { load(true) }, [load])

  useEffect(() => {
    if (addOpen && members.length < (group?.num_members || 0)) {
      const used = new Set(members.map(m => m.ticket_no))
      let gap = 1
      while (used.has(gap)) gap++
      setForm(f => ({ ...f, ticket_no: String(gap) }))
    }
  }, [addOpen, members, group])

  async function handleAddMember() {
    if (!firm || !group) return
    const count = Math.max(1, +form.tickets || 1)
    if (members.length + count > group.num_members) {
      showToast(`Only ${group.num_members - members.length} spots left!`, 'error')
      return
    }
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()

    let person_id: number | null = null

    if (addTab === 'existing' && form.person_id) {
      person_id = +form.person_id
    } else {
      const { data: pData, error: pErr } = await supabase.from('persons')
        .insert({
          name: form.name,
          nickname: form.nickname,
          phone: form.phone,
          address: form.address,
          firm_id: firm.id,
          created_by: userData.user?.id
        })
        .select()
        .single()
      if (pErr) { showToast(pErr.message, 'error'); setSaving(false); return }
      person_id = pData.id
    }

    const usedTickets = new Set(members.map(m => m.ticket_no))
    const insertPayload = []
    let currentTicket = +form.ticket_no
    for (let i = 0; i < count; i++) {
      while (usedTickets.has(currentTicket)) currentTicket++
      insertPayload.push({
        firm_id: firm.id,
        group_id: group.id,
        person_id: person_id,
        ticket_no: currentTicket,
        status: 'active',
        created_by: userData.user?.id
      })
      usedTickets.add(currentTicket)
    }

    const { error: mErr } = await supabase.from('members').insert(insertPayload)

    setSaving(false)
    if (mErr) { showToast(mErr.message, 'error'); return }
    showToast('Member(s) added successfully!', 'success'); setAddOpen(false); load()
  }

  const handleExport = () => {
    const data = members.map(m => {
      const auc = auctionHistory.find(a => a.winner_id === m.id)
      return {
        'Ticket No': m.ticket_no,
        'Name': m.persons?.name,
        'Phone': m.persons?.phone || '',
        'Winner': auc ? 'Yes' : 'No',
        'Won Month': auc ? fmtMonth(auc.month, group?.start_date) : '—',
        'Status': m.status
      }
    })
    downloadCSV(data, `${group?.name}_members`)
  }

  const handleImport = async (csvData: any[]) => {
    if (!firm || !group) return
    const { data: { user } } = await supabase.auth.getUser()

    const personPayload = csvData.map(row => ({
      firm_id: firm.id,
      name: (row.Name || row.name)?.trim(),
      phone: (row.Phone || row.phone)?.toString()?.replace(/\D/g, '') || null,
      created_by: user?.id
    })).filter(p => p.name)

    const { data: pData, error: pErr } = await supabase.from('persons')
      .upsert(personPayload, { onConflict: 'firm_id,name,phone' })
      .select()

    if (pErr) { showToast(pErr.message, 'error'); return }

    const pMap = new Map(pData.map((p: Person) => [`${p.name}|${p.phone || ''}`, p.id]))

    const memberPayload = csvData.map(row => {
      const name = (row.Name || row.name)?.trim()
      const phone = (row.Phone || row.phone)?.toString()?.replace(/\D/g, '') || null
      const personId = pMap.get(`${name}|${phone}`)
      if (!personId) return null

      return {
        firm_id: firm.id,
        group_id: group.id,
        person_id: personId,
        ticket_no: parseInt(row['Ticket No'] || row.ticket_no) || null,
        status: 'active',
        created_by: user?.id
      }
    }).filter(m => m !== null)

    const { error: mErr } = await supabase.from('members').insert(memberPayload)

    if (mErr) showToast(mErr.message, 'error')
    else {
      showToast(`Successfully enrolled ${memberPayload.length} members!`, 'success')
      load()
    }
  }

  async function deleteMember(id: number) {
    if (!can('deleteMember')) return
    if (!confirm('Are you sure?')) return
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) showToast(error.message, 'error')
    else { showToast('Removed!', 'success'); load() }
  }

  // --- Auction Recording Logic ---
  const checkWinnerBalance = useCallback(async (winnerId: string) => {
    if (!winnerId || !group || !aucFormOpen) {
      setWinnerBalance(0); setWinnerAging(0); setAcknowledge(false); return
    }
    setCheckingWinner(true)
    const mem = members.find(m => m.id === +winnerId)
    if (!mem) { setCheckingWinner(false); return }

    const [gAucs, mPays] = await Promise.all([
      supabase.from('auctions').select('month, dividend, status').eq('group_id', group.id).eq('status', 'confirmed').is('deleted_at', null),
      supabase.from('payments').select('amount, month').eq('member_id', mem.id).eq('group_id', group.id).is('deleted_at', null)
    ])

    const auctionsArr = gAucs.data || []
    const paymentsArr = mPays.data || []
    const latestMonth = auctionsArr.length > 0 ? Math.max(...auctionsArr.map((a: any) => Number(a.month))) : 0
    const nextDate = new Date(group.start_date || getToday())
    nextDate.setMonth(nextDate.getMonth() + latestMonth)
    const currentMonth = Math.min(group.duration, new Date() >= nextDate ? latestMonth + 1 : latestMonth)

    let totalDue = 0; let missedCount = 0
    const isAccumulation = group.auction_scheme === 'ACCUMULATION'

    for (let mCount = 1; mCount <= currentMonth; mCount++) {
      const prevAuc = auctionsArr.find((a: any) => a.month === mCount - 1)
      const div = (isAccumulation || !prevAuc) ? 0 : Number(prevAuc.dividend || 0)
      const due = Number(group.monthly_contribution) - div
      const paid = paymentsArr.filter((p: any) => p.month === mCount).reduce((s: number, p: any) => s + Number(p.amount), 0)
      if (due - paid > 0.01) { totalDue += (due - paid); missedCount++ }
    }
    setWinnerBalance(totalDue); setWinnerAging(missedCount); setAcknowledge(totalDue <= 0.01)
    setCheckingWinner(false)
  }, [group, aucFormOpen, members, supabase])

  const prepareAuctionRecord = (isInitial = false) => {
    if (!group) return
    const confirmed = auctionHistory.filter(a => a.status === 'confirmed').sort((a, b) => a.month - b.month)
    const winnerIds = auctionHistory.map(a => a.winner_id)
    const eligible = members.filter(m => !winnerIds.includes(m.id) && (m.status === 'active' || m.status === 'foreman'))
    const foremanList = members.filter(m => m.status === 'foreman')

    let nextDate = group.start_date || getToday()
    if (confirmed.length > 0) {
      const d = new Date((confirmed[confirmed.length - 1].auction_date || group.start_date || getToday()) as string)
      d.setMonth(d.getMonth() + 1)
      nextDate = d.toISOString().split('T')[0]
    }

    setEligibleList(eligible)
    setAucForm({
      month: String(confirmed.length + 1),
      auction_date: nextDate,
      winner_id: '',
      auction_discount: '',
      foreman_member_id: foremanList[0]?.id?.toString() || '',
      notes: ''
    })
    setCalc(null); setCalcError(''); setWinnerBalance(0); setAcknowledge(false)
    setAucFormOpen(true)
  }

  async function onBidChange(bid: string) {
    setAucForm(f => ({ ...f, auction_discount: bid }))
    setCalc(null); setCalcError('')
    if (!bid || !group || isNaN(+bid)) return
    const { data, error } = await supabase.rpc('calculate_auction', {
      p_group_id: group.id,
      p_bid_amount: +bid
    })
    if (error) { setCalcError(error.message); return }
    setCalc(data)
  }

  async function handleSaveAuction(status: 'draft' | 'confirmed' = 'confirmed') {
    if (!group || !aucForm.winner_id || !aucForm.auction_discount || !aucForm.auction_date) {
      showToast('Fill in all required fields.', 'error'); return
    }
    if (status === 'confirmed' && winnerBalance > 0.01 && !acknowledge) {
      showToast('Please acknowledge outstanding dues.', 'error'); return
    }
    setSaving(true)
    const { error } = await supabase.rpc('record_auction_with_commission', {
      p_group_id: group.id,
      p_month: +aucForm.month,
      p_auction_date: aucForm.auction_date,
      p_winner_id: +aucForm.winner_id,
      p_bid_amount: +aucForm.auction_discount,
      p_foreman_member_id: aucForm.foreman_member_id ? +aucForm.foreman_member_id : null,
      p_notes: aucForm.notes || '',
      p_status: status
    })
    setSaving(false)
    if (error) showToast(error.message, 'error')
    else { showToast('Recorded!'); setAucFormOpen(false); load() }
  }

  async function handleSettlePayout() {
    if (!settling) return
    setSaving(true)
    const { error } = await supabase.from('auctions')
      .update({
        is_payout_settled: true,
        payout_date: settleForm.date,
        payout_amount: Number(settleForm.amount),
        payout_note: settleForm.note,
        payout_mode: settleForm.mode
      })
      .eq('id', settling.id)

    setSaving(false)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Payout Marked as Settled!', 'success')
      setSettling(null)
      router.refresh()
      load()
    }
  }

  function handlePrintVoucher(auc: Auction) {
    const winner = members.find(m => m.id === auc.winner_id)
    if (!winner) return

    const printWin = window.open('', '_blank')
    if (!printWin) return

    const html = `
      <html>
        <head>
          <title>Payout Voucher - ${group?.name}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #000; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 900; text-transform: uppercase; }
            .firm-name { font-size: 18px; font-weight: bold; margin-top: 5px; }
            .voucher-info { margin-bottom: 40px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px dashed #ccc; padding-bottom: 5px; }
            .label { font-weight: bold; color: #555; }
            .value { font-weight: 900; font-size: 16px; }
            .payout-box { background: #f8fafc; border: 2px solid #000; padding: 20px; text-align: center; margin: 40px 0; border-radius: 8px; }
            .amount { font-size: 32px; font-weight: 900; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; }
            .sig-box { border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 10px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">Payout Confirmation Voucher</div>
            <div class="firm-name">${firm?.name}</div>
          </div>
          
          <div class="voucher-info">
            <div class="row"><span class="label">Group Name:</span><span class="value">${group?.name}</span></div>
            <div class="row"><span class="label">Auction Month:</span><span class="value">M${auc.month} (${fmtMonth(auc.month, group?.start_date)})</span></div>
            <div class="row"><span class="label">Member Name:</span><span class="value">${winner.persons?.name}</span></div>
            <div class="row"><span class="label">Ticket # :</span><span class="value">${winner.ticket_no}</span></div>
            <div class="row"><span class="label">Settlement Date:</span><span class="value">${settleForm.date}</span></div>
          </div>

          <div class="payout-box">
            <div class="label">NET PAYOUT AMOUNT</div>
            <div class="amount" style="font-weight: 900; font-size: 32px; font-family: 'Courier New', Courier, monospace;">${fmt(auc.net_payout || auc.auction_discount)}</div>
            <div style="font-weight: bold; font-size: 14px; margin-top: 5px; text-transform: uppercase;">${amtToWords(auc.net_payout || auc.auction_discount)}</div>
            <div style="font-size: 12px; margin-top: 10px; opacity: 0.6;">(Rupees equivalent calculated as per group rules)</div>
          </div>

          <div class="signatures">
            <div class="sig-box">Member's Signature</div>
            <div class="sig-box">Authorized Signature<br/>(${firm?.name})</div>
          </div>

          <div style="margin-top: 50px; font-size: 10px; text-align: center; color: #777;">
            This is a computer generated voucher and remains valid only with official signature/stamp.
          </div>

          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `
    printWin.document.write(html)
    printWin.document.close()
  }

  function handlePrintMemberList() {
    const printWin = window.open('', '_blank')
    if (!printWin) return

    const now = new Date().toLocaleDateString()
    const html = `
      <html>
        <head>
          <title>Member Directory - ${group?.name}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; line-height: 1.4; color: #000; }
            .header { border-bottom: 2px solid #000; margin-bottom: 20px; padding-bottom: 10px; }
            .title { font-size: 20px; font-weight: bold; }
            .group-info { font-size: 13px; color: #333; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }
            th { background: #eee; font-weight: bold; text-transform: uppercase; }
            .mono { font-family: monospace; }
            .sig-col { width: 120px; }
            .footer { margin-top: 30px; font-size: 10px; text-align: right; border-top: 1px solid #ddd; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${firm?.name} - Member Directory</div>
            <div class="group-info">Group: <b>${group?.name}</b> | Value: <b>${fmt(group?.chit_value || 0)}</b> | First Auction: ${group?.start_date}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 40px">Ticket</th>
                <th>Member Name</th>
                <th>Phone Number</th>
                <th>Address</th>
                <th>Won Amount</th>
                <th class="sig-col">Signature</th>
              </tr>
            </thead>
            <tbody>
              ${members.map(m => `
                <tr>
                  <td class="mono">#${m.ticket_no}</td>
                  <td><b>${m.persons?.name}</b></td>
                  <td class="mono">${m.persons?.phone || '-'}</td>
                  <td class="mono">${m.persons?.address || '-'}</td>
                  <td style="width: 100px"></td>
                  <td></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">Printed from ${APP_NAME} on ${now}</div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `
    printWin.document.write(html)
    printWin.document.close()
  }

  if (loading || !group) return <Loading />

  const confirmedAucs = auditedAuctions.filter(a => a.status === 'confirmed')
  const draftAucs = auditedAuctions.filter(a => a.status === 'draft')
  const totalDividends = confirmedAucs.reduce((s, a) => s + a.audited_div, 0)
  const totalPayouts = confirmedAucs.reduce((s, a) => s + Number(a.net_payout || 0), 0)
  const totalSurplus = confirmedAucs.reduce((s, a) => s + Number(a.auction_discount || 0), 0)
  const pendingSurplus = draftAucs.reduce((s, a) => s + Number(a.auction_discount || 0), 0)

  const confirmedComms = commissions.filter(c => c.status === 'confirmed')
  const totalComm = confirmedComms.reduce((s, c) => s + Number(c.commission_amt || 0), 0)
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0)
  const actualPayouts = auctionHistory.filter(a => a.is_payout_settled).reduce((s, a) => s + Number(a.payout_amount || 0), 0)

  const monthsCompleted = confirmedAucs.length
  const totalMonths = group.duration

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/groups')} className="p-2.5 rounded-xl hover:bg-[var(--surface2)] transition-all group/back">
            <ArrowLeft size={20} className="group-hover/back:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-[var(--text)]">{getGroupDisplayName(group, t)}</h1>
            <div className="flex gap-2 mt-1">
              <Badge variant={group.status === 'active' ? 'success' : 'gray'}>{group.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {members.length < group.num_members && (
            <Btn variant="primary" onClick={() => setAddOpen(true)} icon={UserPlus}>{t('add_member')}</Btn>
          )}
          <Btn variant="secondary" onClick={() => {
            router.refresh()
            load()
            showToast('Data Synced! ✓', 'success')
          }} icon={RefreshCw}>Sync</Btn>
          <Btn variant="primary" onClick={() => prepareAuctionRecord()} icon={Plus}>{t('record_auction')}</Btn>
          <Btn variant="secondary" onClick={() => router.push(`/settlement?groupId=${groupId}`)} icon={Calculator}>{t('nav_settlements')}</Btn>
          <Btn variant="secondary" onClick={() => router.push(`/groups/${groupId}/settings`)} icon={Settings2}>{t('nav_settings')}</Btn>
        </div>
      </div>

      {draftAucs.length > 0 && (
        <div className="bg-[var(--surface2)] border border-[var(--border)] p-5 rounded-[32px] flex items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500 shadow-sm">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <AlertTriangle size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="font-black text-lg text-[var(--text)] uppercase tracking-tight leading-tight">Confirmation Required</h4>
              <p className="text-xs font-medium opacity-70 mt-0.5 max-w-[500px]">
                You have <strong className="font-bold underline">{draftAucs.length} Draft Auction(s)</strong> which are not yet reflected in the Surplus Pool or Member Balances.
                Please confirm them to finalize the financial ledger.
              </p>
            </div>
          </div>
          <Btn variant="secondary" onClick={() => router.push('/auctions')} className="bg-white/50 border-white hover:bg-white" icon={ExternalLink}>Go to Auctions</Btn>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-5 border relative hover:shadow-xl transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-[var(--accent-dim)] text-[var(--accent)]">
              <Gavel size={22} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{t('auction_rules')}</div>
              </div>
              <div className="flex gap-4 mt-1">
                <div className="text-xs">
                  <span className="opacity-50">{t('min_floor')}:</span> <strong className="font-mono text-[var(--accent)]">{fmt(group.chit_value * (group.min_bid_pct || 0.05))}</strong>
                  <span className="text-[9px] opacity-40 ml-1">({(group.min_bid_pct || 0.05) * 100}%)</span>
                </div>
                <div className="text-xs">
                  <span className="opacity-50">{t('max_cap')}:</span> <strong className="font-mono text-[var(--accent)]">{fmt(group.chit_value * (group.max_bid_pct || 0.40))}</strong>
                  <span className="text-[9px] opacity-40 ml-1">({(group.max_bid_pct || 0.40) * 100}%)</span>
                </div>
                <div className="text-xs">
                  <span className="opacity-50">{t('scheme')}:</span> <strong className="uppercase">{group.auction_scheme}</strong>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 border hover:shadow-xl transition-all">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-[var(--info-dim)] text-[var(--info)]">
              <Calculator size={22} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{t('revenue_comm')}</div>
              <div className="flex gap-4 mt-1">
                <div className="text-xs">
                  <span className="opacity-50">{t('action')}:</span> <strong className="uppercase">{group.commission_type?.replace(/_/g, ' ') || 'Percent of Chit'}</strong>
                </div>
                <div className="text-xs">
                  <span className="opacity-50">{t('rate')}:</span> <strong className="font-mono">{group.commission_type === 'fixed_amount' ? fmt(group.commission_value) : `${group.commission_value}%`}</strong>
                </div>
                <div className="text-xs">
                  <span className="opacity-50">{t('recipient')}:</span> <strong className="uppercase">{group.commission_recipient || 'Foreman'}</strong>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label={t('current_month')} value={`${monthsCompleted}/${totalMonths}`} color="info" />
        <StatCard label={t('open_spots')} value={group.num_members - members.length} color="accent" />

        {group.auction_scheme === 'ACCUMULATION' ? (
          <div className="relative group">
            <StatCard
              label={term.groupSurplusLabel}
              value={fmt(group.accumulated_surplus)}
              color="success"
              sub={`Projected: ${fmt(Number(group.accumulated_surplus || 0) / (group.num_members || 1))} / mem`}
            />
            {pendingSurplus > 0 && (
              <div className="absolute -bottom-2 left-4 right-4 bg-[var(--surface)] border px-2 py-0.5 rounded-full text-[9px] font-bold text-[var(--warning-text)] flex items-center justify-center gap-1 shadow-sm border-[var(--warning-border)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] animate-pulse" />
                +{fmt(pendingSurplus)} Potential
              </div>
            )}
          </div>
        ) : (
          <StatCard label={term.benefitLabel} value={fmt(totalDividends)} color="success" />
        )}

        <StatCard label={t('total_received')} value={fmt(totalCollected)} color="info" />
        <StatCard label={t('paid_to_winners')} value={fmt(actualPayouts)} color="danger" />
        <StatCard label={t('firm_comm')} value={fmt(totalComm)} color="accent" />
        <StatCard label={t('chit_value')} value={fmt(group.chit_value)} color="danger" />
      </div>

      {/* Analytics Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="tour-group-analytics">
        <Card title={t('yield_trend')} subtitle="Auction Discount & Member Dividend Over Time">
          <div className="h-[280px] w-full pt-4">
            {yieldData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yieldData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDisc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--danger)" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="var(--danger)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorDiv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text2)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--text2)' }} tickFormatter={v => `₹${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: '1px solid var(--border)', background: 'var(--surface)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    labelStyle={{ fontWeight: 900, marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="discount" stroke="var(--danger)" fillOpacity={1} fill="url(#colorDisc)" strokeWidth={3} name={t('auction_discount')} />
                  <Area type="monotone" dataKey="dividend" stroke="var(--accent)" fillOpacity={1} fill="url(#colorDiv)" strokeWidth={3} name="Dividend / Mem" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center opacity-30 text-xs italic">Awaiting first successful auction...</div>
            )}
          </div>
        </Card>

        <Card title="Collection Health" subtitle="Overall Member Payment Status Distribution">
          <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-4 h-[280px]">
            <div className="md:col-span-3 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={healthData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {healthData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', background: 'var(--surface)', boxShadow: 'var(--shadow-xl)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="md:col-span-2 space-y-3 pr-4">
              {healthData.map((d) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                    <span className="text-xs font-bold opacity-70 uppercase tracking-tighter">{d.name}</span>
                  </div>
                  <span className="text-sm font-black">{d.value}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-dashed mt-3">
                <div className="text-[10px] font-bold uppercase opacity-40">Group Liquidity</div>
                <div className="text-lg font-black">{((totalCollected / totalPossibleCollection) * 100 || 0).toFixed(1)}%</div>
                <ProgressBar pct={(totalCollected / totalPossibleCollection) * 100} color={totalCollected >= totalPossibleCollection * 0.9 ? 'success' : 'accent'} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <TableCard title={t('auction_ledger')}>
        <div className="px-6 py-3 border-b border-dashed bg-[var(--surface2)] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-bold text-xs ring-4 ring-[var(--accent-o10)]">Σ</div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">Calculation Logic</span>
            <span className="text-xs font-mono font-bold">
              Benefit / Mem = ({t('auction_discount')} — {t('commission')}) ÷ {group.num_members} {t('members')}
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <Tr>
                <Th>{t('auction_month')}</Th>
                <Th>{t('winner')}</Th>
                <Th right>{t('auction_discount')}</Th>
                <Th right className="hidden lg:table-cell text-[var(--danger)]">
                  <div className="flex items-center justify-end gap-1">
                    <span className="opacity-40 font-mono">−</span> {t('commission')}
                  </div>
                </Th>
                <Th right className="hidden md:table-cell text-[var(--accent)]">
                  <div className="flex items-center justify-end gap-1">
                    <span className="opacity-40 font-mono">=</span> Benefit / Mem
                  </div>
                </Th>
                <Th right>{t('net_payout')}</Th>
                <Th right className="hidden sm:table-cell">
                  {group.auction_scheme === 'ACCUMULATION' ? 'Monthly Pay' : t('after_div')}
                </Th>
                <Th right>{t('settlement')}</Th>
                <Th className="only-print">{t('sign_here')}</Th>
              </Tr>
            </thead>
            <tbody>
              {auctionHistory.length === 0 ? (
                <Tr><Td colSpan={8} className="text-center py-12 opacity-50 italic">{t('no_auctions')}</Td></Tr>
              ) : confirmedAucs.concat(draftAucs).sort((a, b) => a.month - b.month).map((a) => {
                const winner = members.find(m => m.id === a.winner_id)
                const comm = commissions.find(c => c.auction_id === a.id)
                const isAcc = group.auction_scheme === 'ACCUMULATION'
                const monthlyDue = Number(group.monthly_contribution)
                const dividend = a.audited_div
                const eachPays = isAcc ? monthlyDue : (monthlyDue - dividend)

                return (
                  <Tr key={a.id}>
                    <Td>
                      <div className="flex flex-col min-h-[48px] justify-center">
                        <span className="text-[13px] font-black font-mono text-[var(--text)]">{fmtMonth(a.month, group?.start_date)}</span>
                        <span className={cn("text-[8px] font-black uppercase tracking-tighter", a.status === 'draft' ? "text-[var(--accent)]" : "opacity-40")}>
                          {a.status === 'draft' ? "Draft Plan" : (a.auction_date ? fmtDate(a.auction_date) : "Confirmed")}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col min-h-[48px] justify-center">
                        <span className="text-[13px] font-extrabold truncate max-w-[120px] text-[var(--text)]">
                          {winner?.persons?.name || '—'}
                        </span>
                        <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                          {winner ? `Ticket #${winner.ticket_no}` : 'No Winner'}
                        </span>
                      </div>
                    </Td>
                    <Td right>
                      <div className="flex flex-col min-h-[48px] justify-center items-end">
                        <span className="text-[13px] font-black font-mono text-[var(--danger)]">{fmt(a.auction_discount)}</span>
                        <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Gross Discount</span>
                      </div>
                    </Td>

                    <Td right className="hidden lg:table-cell">
                      <div className="flex flex-col min-h-[48px] justify-center items-end">
                        <span className="text-[13px] font-bold font-mono text-[var(--text)] opacity-80">{comm ? fmt(comm.commission_amt) : '—'}</span>
                        <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Foreman Fee</span>
                      </div>
                    </Td>

                    <Td right className="hidden md:table-cell">
                      <div className="flex flex-col min-h-[48px] justify-center items-end relative group/math">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-black font-mono text-[var(--accent)]">+{fmt(dividend)}</span>
                          {comm && (
                            <button
                              onClick={() => setMathModal({ auction: a, commission: comm })}
                              className="p-1.5 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] transition-all hover:scale-110 active:scale-95 shadow-sm"
                              title="Click for Audit"
                            >
                              <Calculator size={13} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                        <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">Individual Benefit</span>
                      </div>
                    </Td>

                    <Td right>
                      <div className="flex flex-col min-h-[48px] justify-center items-end">
                        <span className="text-[13px] font-black font-mono text-[var(--success)]">{fmt(a.net_payout || a.auction_discount)}</span>
                        <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                          {a.is_payout_settled ? `Paid: ${fmtDate(a.payout_date || '')}` : 'Net Payable'}
                        </span>
                      </div>
                    </Td>

                    <Td right className="hidden sm:table-cell">
                      <div className="flex flex-col min-h-[48px] justify-center items-end">
                        <span className="text-[13px] font-bold font-mono text-[var(--text)]">{fmt(eachPays)}</span>
                        <span className="text-[9px] font-black opacity-40 uppercase tracking-widest">
                          {isAcc ? 'Fixed Pay' : 'Due Amount'}
                        </span>
                      </div>
                    </Td>
                    <Td right>
                      <div className="flex flex-col min-h-[48px] justify-center items-end">
                        {a.is_payout_settled ? (
                          <>
                            <div className="flex items-center gap-1 text-[var(--success)] font-black text-[9px] uppercase tracking-wider">
                              <CheckCircle2 size={10} strokeWidth={3} /> {t('settled')}
                            </div>
                            <span className="text-[11px] font-mono font-black opacity-90">{fmtDate(a.payout_date)}</span>
                          </>
                        ) : (
                          <div className="no-print">
                            {a.status === 'confirmed' && winner ? (
                              <Btn size="sm" variant="primary" className="h-7 px-3 text-[10px] uppercase font-black" onClick={() => {
                                setSettling(a)
                                setSettleForm(s => ({ ...s, amount: String(a.net_payout || a.auction_discount) }))
                              }}>{t('settle')}</Btn>
                            ) : (
                              <span className="text-[9px] font-bold opacity-30 uppercase tracking-widest">Pending</span>
                            )}
                          </div>
                        )}
                      </div>
                    </Td>
                    <Td className="only-print">
                      <div className="h-8 w-24 border-b border-black opacity-20"></div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </div>
      </TableCard>

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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('add_member')} size="lg">
        <div className="flex gap-1 mb-5 bg-[var(--surface2)] p-1 rounded-xl">
          <button onClick={() => setAddTab('new')} className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-all", addTab === 'new' ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)]")}>New Person</button>
          <button onClick={() => setAddTab('existing')} className={cn("flex-1 py-1.5 text-xs font-bold rounded-lg transition-all", addTab === 'existing' ? "bg-white text-[var(--text)] shadow-sm" : "text-[var(--text3)]")}>From Registry</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {addTab === 'existing' ? (
            <Field label="Search Registry" className="col-span-2">
              <select className={inputClass} style={inputStyle} value={form.person_id} onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))}>
                <option value="">Select a person...</option>
                {allPersons.map(p => <option key={p.id} value={p.id}>{p.name} {p.phone && `(${p.phone})`}</option>)}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Full Name"><input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
              <Field label="Nickname"><input className={inputClass} style={inputStyle} value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} /></Field>
              <Field label="Phone"><input className={inputClass} style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
              <Field label="Address"><input className={inputClass} style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
            </>
          )}
          <Field label="Start Ticket #"><input className={inputClass} style={inputStyle} type="number" value={form.ticket_no} onChange={e => setForm(f => ({ ...f, ticket_no: e.target.value }))} /></Field>
          <Field label="No. of Tickets"><input className={inputClass} style={inputStyle} type="number" value={form.tickets} onChange={e => setForm(f => ({ ...f, tickets: e.target.value }))} /></Field>
        </div>
        <div className="flex justify-end gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleAddMember}>Enroll Member</Btn>
        </div>
      </Modal>

      <Modal open={!!settling} onClose={() => setSettling(null)} title="Confirm Payout Settlement">
        <div className="space-y-6">
          {settling && (() => {
            const winner = members.find(m => m.id === settling.winner_id)
            return (
              <div className="p-4 rounded-2xl border-2 flex items-center gap-4 transition-all" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-dim)' }}>
                <div className="w-12 h-12 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-black text-xl shadow-lg ring-4 ring-[var(--accent-dim)]">
                  {winner?.persons?.name.charAt(0)}
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
            )
          })()}
          <div className="pt-2">
            <Field label="Amount Paid">
              <input
                type="number"
                className={inputClass}
                style={inputStyle}
                value={settleForm.amount}
                onChange={e => setSettleForm(s => ({ ...s, amount: e.target.value }))}
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
                onChange={e => setSettleForm(s => ({ ...s, date: e.target.value }))}
              />
            </Field>

            <Field label="Payment Mode">
              <select
                className={inputClass}
                style={inputStyle}
                value={settleForm.mode}
                onChange={e => setSettleForm(s => ({ ...s, mode: e.target.value }))}
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
              onChange={e => setSettleForm(s => ({ ...s, note: e.target.value }))}
            />
          </Field>

          <div className="flex justify-end gap-3 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
            <Btn variant="secondary" onClick={() => setSettling(null)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={handleSettlePayout}>Confirm Selection & Mark Settled</Btn>
          </div>
        </div>
      </Modal>

      {selectedMember && (() => {
        const m = members.find(x => x.id === selectedMember)
        if (!m) return null
        return (
          <Modal open={!!selectedMember} onClose={() => setSelectedMember(null)} title="Member Details">
            <div className="space-y-4">
              <div className="bg-[var(--surface2)] p-4 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xl font-bold">{m.persons?.name.charAt(0)}</div>
                <div>
                  <div className="font-bold text-lg">{m.persons?.name}</div>
                  <div className="text-xs opacity-50">Ticket #{m.ticket_no} · {m.status}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--border)' }}><div className="opacity-40 mb-1 uppercase tracking-tighter">Phone</div><div className="font-bold">{m.persons?.phone || '—'}</div></div>
                <div className="p-3 border rounded-xl" style={{ borderColor: 'var(--border)' }}><div className="opacity-40 mb-1 uppercase tracking-tighter">Joined</div><div className="font-bold">{fmtDate(m.created_at)}</div></div>
              </div>
              <p className="text-[10px] opacity-40 px-1 italic">Address: {m.persons?.address || 'Not provided'}</p>
            </div>
            <div className="flex justify-end mt-6">
              <Btn variant="secondary" onClick={() => setSelectedMember(null)}>Close</Btn>
            </div>
          </Modal>
        )
      })()}

      <CSVImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        title="Account Enrollment"
        requiredFields={['Name', 'Ticket No']}
      />

      <div className="pt-4 opacity-70 hover:opacity-100 transition-opacity no-print">
        <div className="p-5 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface2)] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="p-3 rounded-2xl bg-[var(--accent-dim)] text-[var(--accent)]">
              <History size={20} className="animate-pulse" />
            </div>
            <div>
              <h4 className="font-black text-sm uppercase tracking-wide">Intelligent Member Substitution</h4>
              <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">Ticket transfers, arrears migration & replacement audit · <span className="text-[var(--accent)] font-black uppercase">Coming Soon</span></p>
            </div>
          </div>
          <Badge variant="gray" className="text-[8px] italic py-1 px-3">Roadmap v2.4</Badge>
        </div>
      </div>

      {mathModal && (
        <Modal open={!!mathModal} onClose={() => setMathModal(null)} title={`${group.auction_scheme === 'ACCUMULATION' ? 'Accumulation' : 'Dividend'} Audit Report`} size="sm">
          <div className="space-y-6">
            <div className="p-6 rounded-[32px] bg-[var(--surface2)] border border-[var(--border)] shadow-inner">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center font-black text-2xl shadow-lg ring-4 ring-[var(--accent-dim)]">
                  <Calculator size={28} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Audit Ledger Report</div>
                  <div className="text-xl font-black text-[var(--text)] tracking-tight">Month {mathModal.auction.month} Dividend</div>
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
                    <span className="text-xs">{fmt(mathModal.auction.auction_discount)} — {fmt(mathModal.commission.commission_amt)}</span>
                    <span className="font-extrabold text-sm text-[var(--danger)]">= {fmt(mathModal.auction.auction_discount - mathModal.commission.commission_amt)}</span>
                  </div>
                </div>

                {/* Step 2: Per Member Share */}
                {(() => {
                  const pool = mathModal.auction.auction_discount - mathModal.commission.commission_amt;
                  const share = pool / (group?.num_members || 1);
                  const isAcc = group.auction_scheme === 'ACCUMULATION';
                  const monthlyDue = Number(group.monthly_contribution);
                  const youPay = isAcc ? monthlyDue : (monthlyDue - share);

                  return (
                    <>
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
                            &quot;The total auction discount of {fmt(mathModal.auction.auction_discount)} is perfectly accounted for:
                            {fmt(mathModal.commission.commission_amt)} as foreman fee and
                            {fmt(share * (group?.num_members || 1))} as {isAcc ? 'surplus accumulation' : 'member dividends'}.&quot;
                          </p>
                        </div>
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Btn variant="primary" className="w-full h-12 rounded-2xl font-black uppercase tracking-widest" onClick={() => setMathModal(null)}>Close Audit Log</Btn>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}

      <Modal open={aucFormOpen} onClose={() => setAucFormOpen(false)} title="Record Group Auction" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Auction Month" disabled>
            <input className={inputClass} style={inputStyle} value={`Month ${aucForm.month}`} disabled />
          </Field>
          <Field label="Auction Date">
            <input className={inputClass} type="date" value={aucForm.auction_date} onChange={e => setAucForm(f => ({ ...f, auction_date: e.target.value }))} />
          </Field>

          <Field label={t('winner_bidder')} className="col-span-2">
            <select className={inputClass} style={inputStyle} value={aucForm.winner_id} onChange={e => {
              setAucForm(f => ({ ...f, winner_id: e.target.value }))
              checkWinnerBalance(e.target.value)
            }}>
              <option value="">{t('select_winner')}</option>
              {eligibleList.map(m => <option key={m.id} value={m.id}>{m.persons?.name} (#{m.ticket_no})</option>)}
            </select>
          </Field>

          {checkingWinner ? <div className="col-span-2 flex justify-center py-2"><Loading /></div> : winnerBalance > 0.01 && (
            <div className="col-span-2 p-4 rounded-2xl border bg-red-500/5 border-red-500/20">
              <div className="text-red-600 font-black text-sm uppercase tracking-tight">Owes ₹{fmt(winnerBalance)} ({winnerAging} months)</div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} />
                <span className="text-[10px] font-black uppercase opacity-60">I acknowledge these dues and the member is eligible to win</span>
              </label>
            </div>
          )}

          <Field label={group?.auction_scheme === 'DIVIDEND' ? 'Winning Bid (Amount Taken)' : 'Discount Bid (Amount Shared)'} className="col-span-2">
            <input className={inputClass} type="number" value={aucForm.auction_discount} onChange={e => onBidChange(e.target.value)} placeholder={group?.auction_scheme === 'DIVIDEND' ? 'e.g. 80000' : 'e.g. 5000'} />
            {calc && (
              <div className="mt-3 p-3 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] grid grid-cols-2 gap-y-2">
                <div className="text-[9px] font-black uppercase opacity-40">Gross Discount</div>
                <div className="text-xs font-black text-right">{fmt(calc.auction_discount)}</div>
                <div className="text-[9px] font-black uppercase opacity-40">Foreman Fee</div>
                <div className="text-xs font-black text-right">{fmt(calc.commission_amt)}</div>
                <div className="text-[9px] font-black uppercase opacity-40">Individual Share</div>
                <div className="text-xs font-black text-right text-[var(--accent)]">{fmt(calc.per_member_div)}</div>
              </div>
            )}
            {calcError && <div className="text-[10px] text-red-500 mt-1 font-bold">{calcError}</div>}
          </Field>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-white/5">
          <Btn variant="secondary" onClick={() => setAucFormOpen(false)}>{t('cancel')}</Btn>
          <Btn variant="primary" loading={saving} onClick={() => handleSaveAuction('confirmed')} disabled={!!calcError || checkingWinner}>{t('record_auction')}</Btn>
        </div>
      </Modal>
    </div>
  )
}
