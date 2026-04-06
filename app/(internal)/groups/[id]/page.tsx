'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, getToday, cn, APP_NAME } from '@/lib/utils'
import { Card, TableCard, Loading, Badge, StatCard, Btn, ProgressBar, Modal, Field, Toast, Empty, Table, Th, Td, Tr } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { downloadCSV } from '@/lib/utils/csv'
import { Gavel, Settings2, Calendar, Users, DollarSign, ArrowLeft, Calculator, Plus, UserPlus, Info, Trash2, MapPin, Phone, Download, Upload, FileSpreadsheet, CheckCircle2, Wallet, Printer, History } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { CSVImportModal } from '@/components/ui'
import type { Group, Auction, Member, ForemanCommission, Person, GroupWithRules } from '@/types'

export default function GroupLedgerPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can } = useFirm()
  const { t } = useI18n()
  const isOwner = role === 'owner' || role === 'superadmin'

  const groupId = Number(params.id)

  const [group, setGroup] = useState<GroupWithRules | null>(null)
  const [auctionHistory, setAuctionHistory] = useState<Auction[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
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
  const [settleForm, setSettleForm] = useState({ date: getToday(), note: '', amount: '' })
  const [payoutOpen, setPayoutOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [rulesForm, setRulesForm] = useState({ 
    min_bid_pct: '', max_bid_pct: '', 
    commission_type: '', commission_value: '' 
  })

  const load = useCallback(async (isInitial = false) => {
    if (!firm) return
    if (isInitial && !group) setLoading(true)

    const [gRes, mRes, aRes, pRes, fcRes] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).eq('firm_id', firm.id).single(),
      supabase.from('members').select('*, persons(*)').eq('group_id', groupId).order('ticket_no'),
      supabase.from('auctions').select('*').eq('group_id', groupId).order('month'),
      supabase.from('persons').select('*').eq('firm_id', firm.id).order('name'),
      supabase.from('foreman_commissions').select('*').eq('group_id', groupId).order('month')
    ])

    if (!gRes.data) { router.push('/groups'); return }

    setGroup(gRes.data)
    setMembers(mRes.data || [])
    setAuctionHistory(aRes.data || [])
    setAllPersons(pRes.data || [])
    setCommissions(fcRes.data || [])
    setLoading(false)
  }, [firm, groupId, router, supabase, group])

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
      // Create new person
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

    // 1. Bulk Upsert Persons
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

    // 2. Map Name+Phone to ID for member insertion
    const pMap = new Map(pData.map((p: Person) => [`${p.name}|${p.phone || ''}`, p.id]))

    // 3. Bulk Insert Members
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

  async function handleSettlePayout() {
    if (!settling) return
    setSaving(true)
    const { error } = await supabase.from('auctions')
      .update({
        is_payout_settled: true,
        payout_date: settleForm.date,
        payout_amount: Number(settleForm.amount),
        payout_note: settleForm.note
      })
      .eq('id', settling.id)

    setSaving(false)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Payout Marked as Settled!', 'success')
      setSettling(null)
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
            <div class="amount">${fmt(auc.net_payout || auc.bid_amount)}</div>
            <div style="font-size: 12px; margin-top: 10px;">(Rupees equivalent calculated as per group rules)</div>
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
            <div class="group-info">Group: <b>${group?.name}</b> | Value: <b>${fmt(group?.chit_value || 0)}</b> | Start Date: ${group?.start_date}</div>
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

  const confirmedAucs = auctionHistory.filter(a => a.status === 'confirmed')
  const totalDividends = confirmedAucs.reduce((s, a) => s + Number(a.dividend || 0), 0)
  const totalPayouts = confirmedAucs.reduce((s, a) => s + Number(a.net_payout || 0), 0)
  const confirmedComms = commissions.filter(c => c.status === 'confirmed')
  const totalComm = confirmedComms.reduce((s, c) => s + Number(c.commission_amt || 0), 0)
  const monthsCompleted = confirmedAucs.length
  const totalMonths = group.duration

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/groups')} className="p-2.5 rounded-xl hover:bg-[var(--surface2)] transition-colors border" style={{ borderColor: 'var(--border)' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl md:text-3xl font-black text-[var(--text)]">{group.name}</h1>
            <div className="flex gap-2 mt-1">
              <Badge variant={group.status === 'active' ? 'success' : 'gray'}>{group.status}</Badge>
              {group.auction_scheme === 'ACCUMULATION' && <Badge variant="info">Accumulation</Badge>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {members.length < group.num_members && (
            <Btn variant="primary" onClick={() => setAddOpen(true)} icon={UserPlus}>Add Member</Btn>
          )}
          <Btn variant="secondary" onClick={() => router.push(`/settlement?groupId=${groupId}`)} icon={Calculator}>{t('nav_settlements')}</Btn>
          <Btn variant="secondary" onClick={() => router.push(`/groups/${groupId}/settings`)} icon={Settings2}>Settings</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 border-2 relative group-hover:border-[var(--accent)] transition-all" style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-dim)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--accent)] text-white">
                <Gavel size={18} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Auction Discount Rules</div>
                  {isOwner && (
                    <button onClick={() => {
                      setRulesForm({
                        min_bid_pct: String((group.min_bid_pct || 0.05) * 100),
                        max_bid_pct: String((group.max_bid_pct || 0.40) * 100),
                        commission_type: group.commission_type || 'percent_of_chit',
                        commission_value: String(group.commission_value || 5)
                      });
                      setRulesOpen(true);
                    }} className="p-1 hover:bg-white/50 rounded-md transition-colors text-[var(--accent)]">
                      <Settings2 size={14} />
                    </button>
                  )}
                </div>
                <div className="flex gap-4 mt-1">
                  <div className="text-xs">
                    <span className="opacity-50">Min Floor:</span> <strong className="font-mono text-[var(--accent)]">{fmt(group.chit_value * (group.min_bid_pct || 0.05))}</strong>
                    <span className="text-[9px] opacity-40 ml-1">({(group.min_bid_pct || 0.05)*100}%)</span>
                  </div>
                  <div className="text-xs">
                    <span className="opacity-50">Max Cap:</span> <strong className="font-mono text-[var(--accent)]">{fmt(group.chit_value * (group.max_bid_pct || 0.40))}</strong>
                    <span className="text-[9px] opacity-40 ml-1">({(group.max_bid_pct || 0.40)*100}%)</span>
                  </div>
                  <div className="text-xs">
                    <span className="opacity-50">Scheme:</span> <strong className="uppercase">{group.auction_scheme}</strong>
                  </div>
                </div>
              </div>
            </div>
        </Card>

        <Card className="p-4 border-2" style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[var(--info-dim)] text-[var(--info)] border border-[var(--info-border)]">
                <Calculator size={18} />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">Revenue & Commission</div>
                <div className="flex gap-4 mt-1">
                  <div className="text-xs">
                    <span className="opacity-50">Type:</span> <strong className="uppercase">{group.commission_type?.replace(/_/g, ' ') || 'Percent of Chit'}</strong>
                  </div>
                  <div className="text-xs">
                    <span className="opacity-50">Rate:</span> <strong className="font-mono">{group.commission_type === 'fixed_amount' ? fmt(group.commission_value) : `${group.commission_value}%`}</strong>
                  </div>
                  <div className="text-xs">
                    <span className="opacity-50">Recipient:</span> <strong className="uppercase">{group.commission_recipient || 'Foreman'}</strong>
                  </div>
                </div>
              </div>
            </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        <StatCard label="Progress" value={`${monthsCompleted}/${totalMonths}`} color="info" />
        <StatCard label="Vacant" value={group.num_members - members.length} color="accent" />
        {group.auction_scheme === 'ACCUMULATION' ? (
          <>
            <StatCard label="Pool" value={fmt(group.accumulated_surplus)} color="success" />
            <StatCard label="Target" value={fmt(group.chit_value)} color="danger" />
          </>
        ) : (
          <>
            <StatCard label="Dividends" value={fmt(totalDividends)} color="success" />
            <StatCard label="Payouts" value={fmt(totalPayouts)} color="danger" />
          </>
        )}
        <StatCard label="Earnings" value={fmt(totalComm)} color="info" />
      </div>

      <TableCard title={t('auction_ledger')}>
        <div className="overflow-x-auto">
          <Table>
            <thead>
              <Tr>
                <Th>Month</Th>
                <Th>Winner</Th>
                <Th right>Auction Discount</Th>
                <Th right className="hidden md:table-cell">
                  {group.auction_scheme === 'ACCUMULATION' ? 'Discount Surplus' : 'Member Dividend'}
                </Th>
                <Th right>Net Payout</Th>
                <Th right className="hidden lg:table-cell text-[var(--danger)]">Comm.</Th>
                <Th right className="hidden sm:table-cell">Each Pays</Th>
                <Th right>Settlement</Th>
                <Th className="only-print">Signature</Th>
              </Tr>
            </thead>
            <tbody>
              {auctionHistory.length === 0 ? (
                <Tr><Td colSpan={8} className="text-center py-12 opacity-50 italic">No auctions held yet.</Td></Tr>
              ) : auctionHistory.map((a) => {
                const winner = members.find(m => m.id === a.winner_id)
                const comm = commissions.find(c => c.auction_id === a.id)
                const monthlyDue = group.chit_value / group.duration
                const eachPays = monthlyDue - Number(a.dividend || 0)
                return (
                  <Tr key={a.id}>
                    <Td>
                       <div className="flex flex-col">
                          <Badge variant={a.status === 'draft' ? 'gray' : 'info'} className="font-mono text-[10px] bg-[var(--surface2)]">{fmtMonth(a.month, group?.start_date)}</Badge>
                          {a.status === 'draft' && <span className="text-[8px] font-bold text-[var(--accent)] mt-1 uppercase tracking-tighter">Draft Plan</span>}
                       </div>
                    </Td>
                    <Td>
                      {winner ? (
                        <div className="flex flex-col">
                          <span className="text-xs font-bold truncate max-w-[80px] md:max-w-full">{winner.persons?.name}</span>
                          <span className="text-[9px] opacity-40 italic font-mono uppercase tracking-tighter">Ticket #{winner.ticket_no}</span>
                        </div>
                      ) : '—'}
                    </Td>
                    <Td right className="font-mono font-bold text-[var(--danger)]">{fmt(a.auction_discount)}</Td>
                    <Td right className="hidden md:table-cell font-mono font-bold text-[var(--accent)]">
                      {group?.auction_scheme === 'ACCUMULATION' ? `+${fmt(a.auction_discount)}` : fmt(a.dividend)}
                    </Td>
                    <Td right className="font-mono font-black text-[var(--success)]">{fmt(a.net_payout || a.auction_discount)}</Td>
                    <Td right className="hidden lg:table-cell font-mono text-[var(--danger)]">
                      {comm ? fmt(comm.commission_amt) : '—'}
                    </Td>
                    <Td right className="hidden sm:table-cell font-mono font-bold">{fmt(eachPays)}</Td>
                    <Td right>
                      {a.is_payout_settled ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1 text-[var(--success)] font-black text-[10px] uppercase tracking-wider">
                            <CheckCircle2 size={11} className="shrink-0" /> Settled
                          </div>
                          <div className="text-[10px] font-mono font-black opacity-80">{fmt(a.payout_amount || a.net_payout || a.auction_discount)}</div>
                          <div className="text-[9px] opacity-40 font-mono">{fmtDate(a.payout_date)}</div>
                          <div className="no-print mt-1.5 flex gap-1">
                             <Btn size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => handlePrintVoucher(a)} icon={Printer}>Voucher</Btn>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1 no-print">
                          {a.status === 'confirmed' && winner && <Btn size="sm" variant="primary" className="h-8 px-3 text-[11px]" onClick={() => {
                            setSettling(a)
                            setSettleForm(s => ({ ...s, amount: String(a.net_payout || a.auction_discount) }))
                          }} icon={Wallet}>Settle</Btn>}
                          {a.status === 'draft' && <Badge variant="gray">Draft</Badge>}
                        </div>
                      )}
                    </Td>
                    <Td className="only-print">
                      <div className="h-8 w-24 border-b border-black text-[8px] opacity-30 flex items-end justify-center">Sign Here</div>
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
          <thead><tr><Th>#</Th><Th>Name</Th><Th className="hidden md:table-cell">Phone</Th><Th className="hidden sm:table-cell">Status</Th><Th>Won Month</Th><Th right className="no-print">Actions</Th><Th className="only-print">Signature</Th></tr></thead>
          <tbody>
            {members.length === 0 ? (
              <Tr><Td colSpan={5} className="text-center py-12 opacity-50 italic">No members yet.</Td></Tr>
            ) : members.map((m) => (
              <Tr key={m.id}>
                <Td><span className="font-mono font-black text-[10px] bg-[var(--surface2)] px-1.5 py-0.5 rounded">{m.ticket_no}</span></Td>
                <Td className="font-semibold text-xs md:text-sm">
                  {m.persons?.name}
                  {auctionHistory.some(a => a.winner_id === m.id) && <Badge variant="accent" className="ml-2">Winner</Badge>}
                </Td>
                <Td className="hidden md:table-cell text-xs font-mono">{m.persons?.phone || '—'}</Td>
                <Td className="hidden sm:table-cell">{m.status === 'foreman' ? <Badge variant="info">Foreman</Badge> : <Badge variant="success">Active</Badge>}</Td>
                <Td>
                  {(() => {
                    const auc = auctionHistory.find(a => a.winner_id === m.id && a.status === 'confirmed')
                    return auc ? <Badge variant="accent">{fmtMonth(auc.month, group?.start_date)}</Badge> : <span className="opacity-30">—</span>
                  })()}
                </Td>
                <Td right className="no-print">
                  <div className="flex justify-end gap-1">
                    <Btn size="sm" variant="ghost" onClick={() => router.push(`/reports?type=member_history&member_id=${m.id}`)} icon={History}>Ledger</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setSelectedMember(m.id)} icon={Info}>Details</Btn>
                    {can('deleteMember') && auctionHistory.length === 0 && <Btn size="sm" variant="danger" onClick={() => deleteMember(m.id)} icon={Trash2}>Remove</Btn>}
                  </div>
                </Td>
                <Td className="only-print">
                  <div className="h-8 w-24 border-b border-black opacity-30"></div>
                </Td>
              </Tr>
            ))}
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

      {/* Payout Settlement Modal */}
      <Modal open={!!settling} onClose={() => setSettling(null)} title="Confirm Payout Settlement">
        <div className="space-y-4">
          <div className="p-4 bg-[var(--accent-dim)] rounded-2xl border border-[var(--accent)]">
            <div className="text-[10px] uppercase font-bold text-[var(--accent)] mb-1">Total Payout Amount</div>
            <div className="text-2xl font-black">{fmt(settling?.net_payout || settling?.bid_amount || 0)}</div>
          </div>

          <Field label="Amount Paid">
            <input
              type="number"
              className={inputClass}
              style={inputStyle}
              value={settleForm.amount}
              onChange={e => setSettleForm(s => ({ ...s, amount: e.target.value }))}
            />
          </Field>

          <Field label="Payout Date">
            <input
              type="date"
              className={inputClass}
              style={inputStyle}
              value={settleForm.date}
              onChange={e => setSettleForm(s => ({ ...s, date: e.target.value }))}
            />
          </Field>

          <Field label="Notes / Transaction ID">
            <textarea
              className={inputClass}
              style={{ ...inputStyle, height: 80, resize: 'none' }}
              placeholder="e.g. Paid via UPI, Ref: 1234..."
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
        title="Bulk Enroll Members"
        requiredFields={['Name', 'Ticket No']}
      />

      {rulesOpen && (
        <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title="Edit Group Auction Rules">
           <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 <Field label="Min Discount (Floor %)">
                    <input className={inputClass} style={inputStyle} type="number" 
                       value={rulesForm.min_bid_pct} onChange={e => setRulesForm(f => ({ ...f, min_bid_pct: e.target.value }))} />
                 </Field>
                 <Field label="Max Discount (Cap %)">
                    <input className={inputClass} style={inputStyle} type="number" 
                       value={rulesForm.max_bid_pct} onChange={e => setRulesForm(f => ({ ...f, max_bid_pct: e.target.value }))} />
                 </Field>
                 <Field label="Commission Type" className="col-span-2">
                    <select className={inputClass} style={inputStyle} value={rulesForm.commission_type} 
                       onChange={e => setRulesForm(f => ({ ...f, commission_type: e.target.value }))}>
                       <option value="percent_of_chit">Percent of Chit Value</option>
                       <option value="percent_of_discount">Percent of Auction Discount</option>
                       <option value="fixed_amount">Fixed Amount</option>
                    </select>
                 </Field>
                 <Field label="Commission Value" className="col-span-2">
                    <input className={inputClass} style={inputStyle} type="number" 
                       value={rulesForm.commission_value} onChange={e => setRulesForm(f => ({ ...f, commission_value: e.target.value }))} />
                 </Field>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--surface2)] text-[10px] space-y-2 opacity-60">
                 <p className="font-bold uppercase tracking-tight text-[var(--accent)]">Important Notes:</p>
                 <p>• <strong>Min Discount (Floor)</strong> is usually your base commission (e.g., 5%). Bids lower than this will be rejected.</p>
                 <p>• <strong>Max Discount (Cap)</strong> is to prevent members from bidding too high and losing their savings (e.g., 40%).</p>
                 <p>• <strong>Foreman Commission</strong> is legally capped at <strong>5%</strong> of the total chit value.</p>
                 <p>• Changes will apply to all <strong>future</strong> confirmed auctions in this group.</p>
              </div>
              <div className="flex justify-end gap-3 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                 <Btn variant="secondary" onClick={() => setRulesOpen(false)}>Cancel</Btn>
                 <Btn variant="primary" loading={saving} onClick={async () => {
                    // Standard 5% cap for foreman commission
                    const commVal = +rulesForm.commission_value || 0
                    if (rulesForm.commission_type === 'percent_of_chit' && commVal > 5) {
                       showToast('Foreman commission cannot exceed 5% of the chit value', 'error')
                       return
                    }
                    if (rulesForm.commission_type === 'fixed_amount' && group.chit_value && commVal > (group.chit_value * 0.05)) {
                       showToast('Foreman commission cannot exceed 5% of the chit value (' + fmt(group.chit_value * 0.05) + ')', 'error')
                       return
                    }

                    setSaving(true);
                    const { error } = await supabase.from('groups').update({
                       min_bid_pct: (+rulesForm.min_bid_pct) / 100,
                       max_bid_pct: (+rulesForm.max_bid_pct) / 100,
                       commission_type: rulesForm.commission_type,
                       commission_value: +rulesForm.commission_value
                    }).eq('id', groupId);
                    setSaving(false);
                    if (error) showToast(error.message, 'error');
                    else {
                       showToast('Auction rules updated!');
                       setRulesOpen(false);
                       load();
                    }
                 }}>Save Rules</Btn>
              </div>
           </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
