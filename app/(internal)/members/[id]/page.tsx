'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, getToday, getGroupDisplayName } from '@/lib/utils'
import { 
  User, Phone, MapPin, Calendar, CreditCard, History, 
  Layers, TrendingUp, DollarSign, Wallet, ShieldCheck,
  ArrowLeft, Edit3, Receipt, Trash2
} from 'lucide-react'
import { Card, Loading, Badge, StatCard, TableCard, Btn, Modal, Field, Toast, Table, Th, Td, Tr } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { useI18n } from '@/lib/i18n/context'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { MemberLedger } from '@/components/features/MemberLedger'
import { CascadeDeleteModal } from '@/components/features/CascadeDeleteModal'
import type { Person, Member, Group, Payment, Auction } from '@/types'

export default function MemberProfilePage() {
  const params = useParams()
  const router = useRouter()
  const personId = params.id as string
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [person, setPerson] = useState<Person | null>(null)
  const [memberships, setMemberships] = useState<(Member & { group: Group })[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', nickname: '' })
  const [delModal, setDelModal] = useState<{ open: boolean, id: string | null, name: string }>({ open: false, id: null, name: '' })

  const isSuper = role === 'superadmin'

  useEffect(() => {
    async function load() {
      setLoading(true)
      const targetId = isSuper ? switchedFirmId : firm?.id
      if (!personId) return
      // If we're a superadmin without a switched firm, we can't scope by firm_id yet.
      // withFirmScope handles this by ignoring the filter if targetId is null/all.

      try {
        const { data: pData } = await withFirmScope(supabase.from('persons').select('id, name, phone, address, nickname').eq('id', personId), targetId).single()
        if (pData) {
          setPerson(pData)
          setEditForm({ 
            name: pData.name || '', 
            phone: pData.phone || '', 
            address: pData.address || '',
            nickname: pData.nickname || ''
          })
        }

        const { data: mData } = await withFirmScope(
          supabase.from('members').select('id, ticket_no, group_id, person_id, status, groups:group_id(id, name, duration, monthly_contribution, status, auction_scheme)'),
          targetId
        ).eq('person_id', personId).is('deleted_at', null)

        if (mData) {
          setMemberships(mData.map((m: any) => ({ ...m, group: m.groups })) || [])
        }
      } catch (err) {
        console.error('Load Error', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, personId, firm, isSuper, switchedFirmId])

  const handleUpdatePerson = async () => {
    setSaving(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    try {
      const { error } = await withFirmScope(supabase.from('persons').update(editForm).eq('id', personId), targetId!)
      if (error) throw error
      setPerson(prev => prev ? { ...prev, ...editForm } : null)
      setEditOpen(false)
      showToast('Profile updated successfully', 'success')
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteMember = async (mid: string) => {
    if (!can('deleteMember')) return
    const m = memberships.find(x => String(x.id) === String(mid))
    setDelModal({ open: true, id: mid, name: `Ticket #${m?.ticket_no} in ${m?.group?.name || 'Group'}` })
  }

  const confirmDeleteMember = async () => {
    if (!delModal.id || !firm) return
    setSaving(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    try {
      const { error } = await withFirmScope(supabase.from('members').update({ deleted_at: new Date().toISOString() }).eq('id', delModal.id), targetId!)
      if (error) throw error
      setMemberships(prev => prev.filter(m => String(m.id) !== String(delModal.id)))
      showToast('Membership removed', 'success')
      setDelModal({ open: false, id: null, name: '' })
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const totals = useMemo(() => {
    return memberships.reduce((acc, m) => {
      acc.chitValue += Number(m.group?.duration || 0) * Number(m.group?.monthly_contribution || 0)
      return acc
    }, { chitValue: 0 })
  }, [memberships])

  if (loading) return <Loading />
  if (!person) return <div className="p-20 text-center opacity-40">Member not found</div>

  const inputClass = "w-full bg-[var(--surface2)] border-2 rounded-xl p-3 font-bold text-sm focus:border-[var(--accent)] outline-none transition-all"
  const inputStyle = { borderColor: 'var(--border)' }

  return (
    <div className="space-y-6 pb-24 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Btn variant="secondary" size="sm" onClick={() => router.back()} className="h-8 w-8 p-0 rounded-lg">
          <ArrowLeft size={16} />
        </Btn>
        <h1 className="text-2xl font-black text-[var(--text)] tracking-tight">Member Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2">
              <button onClick={() => setEditOpen(true)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all">
                <Edit3 size={14} />
              </button>
            </div>
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center mb-3 border border-[var(--accent)]/20">
                <User size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black">{person.name}</h2>
              <p className="text-xs font-medium opacity-50 mt-0.5">{person.nickname || 'Individual Member'}</p>
            </div>

            <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--surface2)] text-[var(--text3)]"><Phone size={14} /></div>
                <div>
                  <div className="text-[10px] font-bold opacity-40">Phone Number</div>
                  <div className="text-xs font-bold">{person.phone || '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[var(--surface2)] text-[var(--text3)]"><MapPin size={14} /></div>
                <div>
                  <div className="text-[10px] font-bold opacity-40">Address</div>
                  <div className="text-xs font-bold line-clamp-1">{person.address || 'No address provided'}</div>
                </div>
              </div>
            </div>
          </Card>

          <StatCard label="Total Portfolio Value" value={fmt(totals.chitValue)} icon={DollarSign} color="accent" compact />
        </div>

        <div className="lg:col-span-2">
          <TableCard title="Active Memberships" subtitle="Groups this person is currently participating in">
            <Table>
              <thead>
                <Tr className="bg-[var(--surface2)]/30">
                  <Th className="text-[11px] font-bold py-2 px-3">Group</Th>
                  <Th className="text-[11px] font-bold py-2">Ticket</Th>
                  <Th className="text-[11px] font-bold py-2">Status</Th>
                  <Th right className="text-[11px] font-bold py-2 px-3">Actions</Th>
                </Tr>
              </thead>
              <tbody>
                {memberships.map(m => (
                  <Tr key={m.id} className="group/row">
                    <Td className="px-3">
                      <div className="font-bold text-sm text-[var(--accent)] hover:underline cursor-pointer" onClick={() => router.push(`/groups/${m.group.id}`)}>
                        {getGroupDisplayName(m.group, t)}
                      </div>
                      <div className="text-[10px] font-medium opacity-50">Value: {fmt(Number(m.group?.duration || 0) * Number(m.group?.monthly_contribution || 0))}</div>
                    </Td>
                    <Td>
                      <div className="font-bold text-sm">#{m.ticket_no}</div>
                    </Td>
                    <Td>
                      <Badge variant={m.group.status === 'active' ? 'success' : 'gray'} className="text-[10px] font-bold">{m.group.status}</Badge>
                    </Td>
                    <Td right className="px-3">
                      <button onClick={() => handleDeleteMember(String(m.id))} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[var(--surface2)] text-[var(--danger)] opacity-0 group-hover/row:opacity-100 hover:bg-red-50 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </Td>
                  </Tr>
                ))}
                {memberships.length === 0 && (
                  <Tr>
                    <Td colSpan={4} className="text-center py-12 opacity-40 italic">Not enrolled in any groups.</Td>
                  </Tr>
                )}
              </tbody>
            </Table>
          </TableCard>
        </div>
      </div>

      <div className="pt-6">
        <div className="flex items-center justify-between mb-3 px-1">
           <div>
              <h2 className="text-xl font-black">Financial Ledger</h2>
              <p className="text-xs font-medium opacity-50">Unified transaction history across all enrolled group tickets.</p>
           </div>
           <Btn size="sm" variant="secondary" className="text-xs font-bold" icon={Receipt} onClick={() => router.push('/payments')}>New Receipt</Btn>
        </div>
        
        <div className="bg-[var(--surface)] p-4 rounded-2xl border-2 shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <MemberLedger personId={Number(personId)} firmId={firm?.id || ''} />
        </div>
      </div>

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

      <CascadeDeleteModal 
        open={delModal.open}
        onClose={() => setDelModal({ open: false, id: null, name: '' })}
        onConfirm={confirmDeleteMember}
        title={`Remove Membership?`}
        targetId={delModal.id || ''}
        targetType="member"
        loading={saving}
      />
    </div>
  )
}
