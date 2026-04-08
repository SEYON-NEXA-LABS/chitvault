'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, cn, getGroupDisplayName } from '@/lib/utils'
import {
  Card, TableCard, Loading, Badge, StatCard, Btn,
  Modal, Field, Toast, Empty, Table, Th, Td, Tr, Chip
} from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { useI18n } from '@/lib/i18n/context'
import { useTerminology } from '@/lib/hooks/useTerminology'
import { User, Phone, MapPin, ArrowLeft, History, CreditCard, ExternalLink, Edit, Trash2, ShieldCheck, TrendingUp, Wallet, Receipt } from 'lucide-react'
import type { Group, Member, Auction, Payment, Person, Profile } from '@/types'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'

export default function MemberDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  const { toast, show: showToast, hide: hideToast } = useToast()

  const personId = Number(params.id)

  const [person, setPerson] = useState<Person | null>(null)
  const [tickets, setTickets] = useState<Member[]>([])
  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setLoadingSaving] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', nickname: '', phone: '', address: '' })

  const load = useCallback(async (isInitial = false) => {
    if (!firm) return
    if (isInitial) setLoading(true)

    const [pRes, mRes, gRes, aRes, sRes] = await Promise.all([
      supabase.from('persons').select('*').eq('id', personId).eq('firm_id', firm.id).single(),
      supabase.from('members').select('*, persons(*)').eq('person_id', personId).is('deleted_at', null),
      supabase.from('groups').select('*').eq('firm_id', firm.id).is('deleted_at', null),
      supabase.from('auctions').select('*').eq('firm_id', firm.id).is('deleted_at', null),
      supabase.from('profiles').select('id, full_name').eq('firm_id', firm.id).is('deleted_at', null)
    ])

    if (!pRes.data) { router.push('/members'); return }

    const mIds = (mRes.data || []).map((m: Member) => m.id)
    let payData: Payment[] = []

    if (mIds.length > 0) {
      const { data } = await supabase.from('payments')
        .select('*')
        .in('member_id', mIds)
        .is('deleted_at', null)
      payData = data || []
    }

    setPerson(pRes.data)
    setEditForm({
      name: pRes.data.name,
      nickname: pRes.data.nickname || '',
      phone: pRes.data.phone || '',
      address: pRes.data.address || ''
    })

    setTickets(mRes.data || [])
    setAllGroups(gRes.data || [])
    setAuctions(aRes.data || [])
    setStaff(sRes.data || [])
    setPayments(payData)

    setLoading(false)
  }, [firm, personId, router, supabase])

  useEffect(() => { load(true) }, [load])

  const stats = useMemo(() => {
    let totalPaid = 0
    let totalBalance = 0
    let missedCount = 0
    let totalDividends = 0

    tickets.forEach(m => {
      const group = allGroups.find(g => g.id === m.group_id)
      if (!group || group.status === 'archived') return

      const gAucs = auctions.filter(a => a.group_id === group.id)
      const gPays = payments.filter(p => p.group_id === group.id)
      
      const financial = getMemberFinancialStatus(m, group, gAucs, gPays)
      totalPaid += financial.totalPaid
      totalBalance += financial.balance
      missedCount += financial.missedCount
      totalDividends += financial.dividends
    })

    return { totalPaid, totalBalance, missedCount, totalDividends, activeCount: tickets.length }
  }, [payments, tickets, allGroups, auctions])

  async function handleUpdatePerson() {
    if (!person || !firm) return
    setLoadingSaving(true)
    const { error } = await supabase.from('persons')
      .update({
        name: editForm.name,
        nickname: editForm.nickname,
        phone: editForm.phone,
        address: editForm.address,
        updated_at: new Date().toISOString()
      })
      .eq('id', person.id)

    setLoadingSaving(false)
    if (error) showToast(error.message, 'error')
    else {
      showToast('Profile updated!', 'success')
      setEditOpen(false)
      load()
    }
  }

  async function handleDeletePerson() {
    if (!person || !firm || !can('deleteMember')) return
    if (!confirm('Are you sure? This will move the person and ALL their tickets to trash!')) return

    setLoadingSaving(true)
    const { error: pErr } = await supabase.from('persons').update({ deleted_at: new Date() }).eq('id', person.id)
    if (pErr) { showToast(pErr.message, 'error'); setLoadingSaving(false); return }

    await supabase.from('members').update({ deleted_at: new Date() }).eq('person_id', person.id)

    showToast('Member moved to trash!', 'success')
    router.push('/members')
  }

  if (loading || !person) return <Loading />

  return (
    <div className="space-y-6 pb-24">
      {/* breadcrumbs */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/members')} className="p-2 rounded-xl hover:bg-[var(--surface2)] border transition-colors shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-40">
          <span>{t('member_directory')}</span>
          <span>/</span>
          <span className="text-[var(--accent)]">{person.name}</span>
        </div>
      </div>

      {/* Header Profile Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[var(--accent)] to-[var(--info)] opacity-50" />

          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--accent)] to-[var(--info)] flex items-center justify-center text-white text-3xl font-black shadow-lg shrink-0">
            {person.name.charAt(0)}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl font-black text-[var(--text)] flex items-center gap-3">
                {person.name}
                {person.nickname && <span className="text-sm font-bold bg-[var(--accent-dim)] text-[var(--accent)] px-3 py-1 rounded-full">@{person.nickname}</span>}
              </h1>
              <div className="flex flex-wrap gap-4 mt-2">
                <div className="flex items-center gap-2 text-sm opacity-50 px-3 py-1.5 bg-[var(--surface2)] rounded-lg">
                  <Phone size={14} className="text-[var(--accent)]" /> {person.phone || 'No phone'}
                </div>
                <div className="flex items-center gap-2 text-sm opacity-50 px-3 py-1.5 bg-[var(--surface2)] rounded-lg">
                  <MapPin size={14} className="text-[var(--info)]" /> {person.address || 'No address'}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {can('editMember') && <Btn size="sm" variant="secondary" icon={Edit} onClick={() => setEditOpen(true)}>Edit Profile</Btn>}
              <Btn size="sm" variant="secondary" icon={History} onClick={() => router.push(`/reports?type=member_history&person_id=${person.id}`)}>Audit History</Btn>
              {can('deleteMember') && <Btn size="sm" variant="danger" icon={Trash2} onClick={handleDeletePerson}>Move to Trash</Btn>}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex flex-col justify-center">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Total Paid</div>
            <div className="text-2xl font-black text-[var(--success)]">{fmt(stats.totalPaid)}</div>
          </div>
          <div className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex flex-col justify-center">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 leading-tight">Total Outstanding</div>
            <div className={cn("text-2xl font-black", stats.missedCount > 0 ? "text-[var(--danger)]" : stats.totalBalance > 0 ? "text-[var(--info)]" : "text-[var(--success)]")}>
              {fmt(stats.totalBalance)}
            </div>
          </div>
          <div className="p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-sm flex flex-col justify-center">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 leading-tight">{term.memberBenefitLabel}</div>
            <div className="text-2xl font-black text-[var(--accent)]">{fmt(stats.totalDividends)}</div>
          </div>
          <div className="col-span-2 p-5 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-lg flex items-center justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest opacity-90 mb-1">Active Enrollments</div>
              <div className="text-3xl font-black">{stats.activeCount} <span className="text-lg font-medium opacity-80 ml-1">Tickets</span></div>
            </div>
            <ShieldCheck size={48} className="opacity-30" />
          </div>
        </div>
      </div>

      {/* Enrollments Grid */}
      <h2 className="text-xl font-black text-[var(--text)] flex items-center gap-2 pt-4">
        <TrendingUp size={20} className="text-[var(--accent)]" />
        Current Groups & Tickets
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tickets.map(m => {
          const g = allGroups.find(x => x.id === m.group_id)
          if (!g) return null
          const isWinner = auctions.some(a => a.group_id === g.id && a.winner_id === m.id)

          return (
            <div key={m.id} className="cursor-pointer group" onClick={() => router.push(`/groups/${g.id}`)}>
              <Card className="p-5 border-2 hover:border-[var(--accent)] transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-black text-lg group-hover:text-[var(--accent)] transition-colors">{getGroupDisplayName(g, t)}</h3>
                    <div className="text-[10px] opacity-40 font-bold uppercase tracking-tighter">
                      Ticket #{m.ticket_no} · Value {fmt(g.chit_value)}
                    </div>
                  </div>
                  <Badge variant={m.status === 'foreman' ? 'info' : 'success'}>{m.status}</Badge>
                </div>
                
                {/* Streak Visualization */}
                <div className="mb-4">
                  <div className="text-[8px] font-bold uppercase tracking-widest opacity-30 mb-1">Payment Streak</div>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      const f = getMemberFinancialStatus(m, g, auctions, payments)
                      return f.streak.map(s => (
                        <div key={s.month} 
                          title={`Month ${s.month}: ${s.status}`}
                          className="w-2.5 h-2.5 rounded-[2px] transition-transform hover:scale-125" 
                          style={{ background: `var(--${s.status})` }} 
                        />
                      ))
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="p-3 bg-[var(--surface2)] rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-[9px] opacity-40 uppercase font-black">Status</span>
                    <span className="text-xs font-bold">{isWinner ? 'Winner (Won)' : 'Active (Paying)'}</span>
                  </div>
                  <div className="p-3 bg-[var(--surface2)] rounded-2xl flex flex-col items-center justify-center">
                    <span className="text-[9px] opacity-40 uppercase font-black">Outstanding</span>
                    {(() => {
                      const f = getMemberFinancialStatus(m, g, auctions, payments)
                      return <span className={cn("text-xs font-bold", f.missedCount > 0 ? "text-[var(--danger)]" : f.balance > 0 ? "text-[var(--info)]" : "text-[var(--success)]")}>{fmt(f.balance)}</span>
                    })()}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-4 text-[10px] font-bold opacity-30 group-hover:opacity-100 transition-opacity">
                  <span>VIEW GROUP DETAILS</span>
                  <ExternalLink size={12} />
                </div>
              </Card>
            </div>
          )
        })}
        {tickets.length === 0 && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center bg-[var(--surface2)] rounded-3xl border-2 border-dashed border-[var(--border)]">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center mb-3">
              <TrendingUp size={24} />
            </div>
            <p className="text-sm font-bold opacity-40">No active ticket enrollments found.</p>
          </div>
        )}
      </div>

      {/* Financial Ledger */}
      <div className="pt-6">
        <TableCard
          title="Member Financial Ledger"
          subtitle="Unified transaction history across all enrolled group tickets."
          actions={<Btn size="sm" variant="secondary" icon={Receipt} onClick={() => router.push('/payments')}>Record New Receipt</Btn>}
        >
          <Table>
            <thead>
              <Tr>
                <Th>Date</Th>
                <Th>Group / Ticket</Th>
                <Th>Month</Th>
                <Th right>Amount Paid</Th>
                <Th className="hidden sm:table-cell">Mode</Th>
                <Th className="hidden md:table-cell">Reference</Th>
                <Th right>Outstanding</Th>
              </Tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <Tr>
                  <Td colSpan={7} className="text-center py-12 opacity-30 italic">No payment transactions recorded yet.</Td>
                </Tr>
              ) : payments.sort((a, b) => new Date(b.payment_date || '').getTime() - new Date(a.payment_date || '').getTime()).map(p => {
                const m = tickets.find(x => x.id === p.member_id)
                const g = m ? allGroups.find(x => x.id === m.group_id) : null
                const collector = staff.find(s => s.id === p.collected_by)
                return (
                  <Tr key={p.id}>
                    <Td className="font-mono text-xs">{fmtDate(p.payment_date)}</Td>
                    <Td>
                      <div className="font-bold text-xs">{g?.name || 'Unknown'}</div>
                      <div className="text-[10px] opacity-40">
                        {g?.auction_scheme === 'ACCUMULATION' ? t('monthly_contribution') : t('amount_due')}
                      </div>
                    </Td>
                    <Td><Badge variant="gray">Month {p.month}</Badge></Td>
                    <Td right className="font-black text-[var(--success)]">{fmt(p.amount)}</Td>
                    <Td className="hidden sm:table-cell"><Badge variant="gray">{p.mode}</Badge></Td>
                    <Td className="hidden md:table-cell text-[10px] opacity-40">
                      {collector ? `Collected by ${collector.full_name}` : p.collected_by ? `Collected by ${p.collected_by}` : 'System/Auto'}
                    </Td>
                    <Td right className="font-mono font-bold text-xs">{fmt(p.balance_due)}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </TableCard>
      </div>

      {/* Edit Profile Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Update Member Profile">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Full Name"><input className={inputClass} style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Nickname"><input className={inputClass} style={inputStyle} value={editForm.nickname} onChange={e => setEditForm(f => ({ ...f, nickname: e.target.value }))} /></Field>
            <Field label="Phone Number"><input className={inputClass} style={inputStyle} type="tel" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Physical Address"><input className={inputClass} style={inputStyle} value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
            <Btn variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={handleUpdatePerson}>Save Changes</Btn>
          </div>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
