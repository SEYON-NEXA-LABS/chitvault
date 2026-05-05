'use client'

import React, { useState, useEffect } from 'react'
import { Modal, Field, Btn } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Group, Member, Person } from '@/types'

interface AddMemberModalProps {
  open: boolean
  onClose: () => void
  group: Group
  members: Member[]
  allPersons: Person[]
  firmId: string | number
  userId: string
  onSave: (payload: any) => Promise<void>
  saving: boolean
  t: (key: string) => string
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  open,
  onClose,
  group,
  members,
  allPersons,
  firmId,
  userId,
  onSave,
  saving,
  t
}) => {
  const [addTab, setAddTab] = useState<'new' | 'existing'>('new')
  const [form, setForm] = useState({ name: '', nickname: '', phone: '', address: '', ticket_no: '', person_id: '', tickets: '1' })

  useEffect(() => {
    if (open && members.length < (group?.num_members || 0)) {
      const used = new Set(members.map(m => m.ticket_no))
      let gap = 1
      while (used.has(gap)) gap++
      setForm(f => ({ ...f, ticket_no: String(gap) }))
    }
  }, [open, members, group])

  const handleAdd = async () => {
    const count = Math.max(1, +form.tickets || 1)
    
    if (members.length + count > group.num_members) {
      alert(`Cannot add ${count} ticket(s). Only ${group.num_members - members.length} spot(s) remaining in this ${group.num_members}-member group.`)
      return
    }

    await onSave({ ...form, tickets: count })
  }

  return (
    <Modal open={open} onClose={onClose} title={t('add_member')} size="lg">
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
            <Field label="Phone (Optional)"><input className={inputClass} style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
            <Field label="Address"><input className={inputClass} style={inputStyle} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
          </>
        )}
        <Field label="Start Ticket #"><input className={inputClass} style={inputStyle} type="number" value={form.ticket_no} onChange={e => setForm(f => ({ ...f, ticket_no: e.target.value }))} /></Field>
        <Field label="No. of Tickets"><input className={inputClass} style={inputStyle} type="number" value={form.tickets} onChange={e => setForm(f => ({ ...f, tickets: e.target.value }))} /></Field>
      </div>
      <div className="flex justify-end gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
        <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={handleAdd}>Enroll Member</Btn>
      </div>
    </Modal>
  )
}
