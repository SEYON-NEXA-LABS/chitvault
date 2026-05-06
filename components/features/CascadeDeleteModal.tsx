'use client'

import React, { useEffect, useState } from 'react'
import { Modal, Btn, Loading, Badge } from '@/components/ui'
import { AlertTriangle, Trash2, Users, Gavel, CreditCard, User, Box } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { haptics } from '@/lib/utils/haptics'

interface CascadeDeleteModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  targetId: string | number
  targetType: 'group' | 'person' | 'member'
  loading?: boolean
}

export function CascadeDeleteModal({ 
  open, 
  onClose, 
  onConfirm, 
  title, 
  targetId, 
  targetType,
  loading: externalLoading 
}: CascadeDeleteModalProps) {
  const supabase = createClient()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && targetId) {
      loadCounts()
    }
  }, [open, targetId, targetType])

  async function loadCounts() {
    setLoading(true)
    try {
      const q: Promise<any>[] = []
      const keys: string[] = []

      if (targetType === 'group') {
        const idList = String(targetId).split(',')
        keys.push('members', 'auctions', 'payments', 'commissions')
        q.push(
          supabase.from('members').select('id', { count: 'exact', head: true }).in('group_id', idList).is('deleted_at', null),
          supabase.from('auctions').select('id', { count: 'exact', head: true }).in('group_id', idList).is('deleted_at', null),
          supabase.from('payments').select('id', { count: 'exact', head: true }).in('group_id', idList).is('deleted_at', null),
          supabase.from('foreman_commissions').select('id', { count: 'exact', head: true }).in('group_id', idList).is('deleted_at', null)
        )
      } else if (targetType === 'person') {
        const idList = String(targetId).split(',')
        keys.push('members', 'payments')
        q.push(
          supabase.from('members').select('id', { count: 'exact', head: true }).in('person_id', idList).is('deleted_at', null),
          supabase.from('payments').select('id', { count: 'exact', head: true }).filter('member_id', 'in', `(select id from members where person_id in (${idList.join(',')}))`).is('deleted_at', null)
        )
      } else if (targetType === 'member') {
        const idList = String(targetId).split(',')
        keys.push('payments')
        q.push(
          supabase.from('payments').select('id', { count: 'exact', head: true }).in('member_id', idList).is('deleted_at', null)
        )
      }

      const results = await Promise.all(q)
      const newCounts: Record<string, number> = {}
      keys.forEach((key, i) => {
        newCounts[key] = results[i].count || 0
      })
      setCounts(newCounts)
    } catch (err) {
      console.error('Failed to load cascade counts:', err)
    } finally {
      setLoading(false)
    }
  }

  const hasImpact = Object.values(counts).some(c => c > 0)

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
          <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="text-sm font-black uppercase tracking-tight text-rose-600">Cascade Warning</div>
            <p className="text-xs opacity-60 mt-1 leading-relaxed">
              Moving this item to trash will also archive all related records listed below. 
              Items can be recovered from the Trash for 90 days.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-10"><Loading text="Analyzing impact..." /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {targetType === 'group' && (
              <>
                <ImpactCard icon={Users} label="Memberships" count={counts.members} />
                <ImpactCard icon={Gavel} label="Auctions" count={counts.auctions} />
                <ImpactCard icon={CreditCard} label="Payment Receipts" count={counts.payments} />
                <ImpactCard icon={Box} label="Commissions" count={counts.commissions} />
              </>
            )}
            {targetType === 'person' && (
              <>
                <ImpactCard icon={Users} label="Group Tickets" count={counts.members} />
                <ImpactCard icon={CreditCard} label="Total Payments" count={counts.payments} />
              </>
            )}
            {targetType === 'member' && (
              <>
                <ImpactCard icon={CreditCard} label="Member Payments" count={counts.payments} />
              </>
            )}
          </div>
        )}

        {!loading && !hasImpact && (
          <div className="text-center py-4 text-xs font-bold opacity-30 italic">
            No related records will be affected.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={onClose}>Keep it</Btn>
          <Btn 
            variant="danger" 
            icon={Trash2} 
            loading={externalLoading} 
            onClick={() => {
              haptics.heavy()
              onConfirm()
            }}
          >
            Move to Trash
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

function ImpactCard({ icon: Icon, label, count }: { icon: any, label: string, count: number }) {
  if (count === 0) return null
  return (
    <div className="p-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] flex items-center gap-3">
      <div className="p-2 rounded-lg bg-[var(--surface)] text-[var(--accent)]">
        <Icon size={16} />
      </div>
      <div>
        <div className="text-[10px] font-black uppercase opacity-40 tracking-wider">{label}</div>
        <div className="text-sm font-black">{count}</div>
      </div>
    </div>
  )
}
