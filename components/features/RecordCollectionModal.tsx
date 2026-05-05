'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { fmt, getToday, cn, getGroupDisplayName } from '@/lib/utils'
import {
  Loading, Badge, Btn, Modal, Field, Toast
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { CreditCard } from 'lucide-react'

interface CollectionItem {
  person_id: number;
  person_name: string;
  person_phone: string;
  person_address: string;
  total_balance: number;
  overdue_count: number;
  is_overdue: boolean;
  memberships: any[];
  total_count: number;
}

interface RecordCollectionModalProps {
  personId: number;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: CollectionItem;
}

const inputClass = "w-full bg-[var(--surface2)] text-[var(--text)] px-4 py-2.5 rounded-xl border border-[var(--border)] focus:border-[var(--accent)] outline-none transition-all placeholder:opacity-30"

export function RecordCollectionModal({ personId, onClose, onSuccess, initialData }: RecordCollectionModalProps) {
  const supabase = createClient()
  const { firm, role, switchedFirmId, profile } = useFirm()
  const { t } = useI18n()
  const { toast, show, hide } = useToast()
  
  const [loading, setLoading] = useState(!initialData)
  const [saving, setSaving] = useState(false)
  const [personData, setPersonData] = useState<CollectionItem | null>(initialData || null)
  const [payForm, setPayForm] = useState({ 
    amount: initialData ? String(initialData.total_balance) : '', 
    date: getToday(), 
    mode: 'Cash', 
    note: '' 
  })

  const isSuper = role === 'superadmin'

  const loadPersonDues = useCallback(async () => {
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return

    setLoading(true)
    try {
      // We search by person_id by using the RPC and filtering
      // To be efficient, we first get the person details to get the name/phone
      const { data: pInfo } = await supabase.from('persons').select('name, phone').eq('id', personId).single()
      
      const { data: rpcData, error } = await supabase.rpc('get_collection_workspace', {
        p_firm_id: targetId,
        p_search: pInfo?.phone || pInfo?.name || '',
        p_limit: 10,
        p_offset: 0
      })

      if (error) throw error
      
      const match = (rpcData as CollectionItem[] || []).find(x => Number(x.person_id) === Number(personId))
      if (match) {
        setPersonData(match)
        setPayForm(f => ({ ...f, amount: String(match.total_balance) }))
      } else {
        show('Could not load dues for this person.', 'error')
        onClose()
      }
    } catch (err: any) {
      show(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [supabase, firm, isSuper, switchedFirmId, personId, show, onClose])

  useEffect(() => {
    if (!initialData) loadPersonDues()
  }, [loadPersonDues, initialData])

  async function handlePay() {
    if (!personData || !firm) return;
    const amount = Number(payForm.amount);
    if (amount <= 0) { show('Enter a valid amount', 'error'); return; }

    setSaving(true);
    const targetId = isSuper ? switchedFirmId : firm.id
    let remaining = amount;
    const finalPayments = [];

    // Flatten all dues across all memberships
    const allDues = personData.memberships.flatMap((m: any) => 
      (m.dues || []).map((d: any) => ({ ...d, memberId: m.member.id, groupId: m.group.id }))
    ).sort((a: any, b: any) => a.month - b.month);

    for (const due of allDues) {
      if (remaining <= 0) break;
      const bal = due.amount_due - due.amount_paid;
      if (bal <= 0.01) continue;

      const toPay = Math.min(remaining, bal);
      remaining -= toPay;

      finalPayments.push({
        firm_id: targetId,
        member_id: due.memberId,
        group_id: due.groupId,
        person_id: personData.person_id,
        month: due.month,
        amount: toPay,
        status: (due.amount_paid + toPay) >= (due.amount_due - 0.01) ? 'paid' : 'partial',
        amount_due: due.amount_due,
        balance_due: Math.max(0, due.amount_due - due.amount_paid - toPay),
        payment_date: payForm.date,
        mode: payForm.mode,
        payment_type: (due.amount_paid + toPay) >= (due.amount_due - 0.01) ? 'full' : 'partial',
        collected_by: profile?.id || null,
        note: payForm.note
      });
    }

    // Handle Advance / Surplus if remaining > 0
    if (remaining > 0.01 && personData.memberships.length > 0) {
      const firstM = personData.memberships[0];
      const currentLatest = firstM.latestMonth || 0;
      const duration = firstM.group?.duration || 0;
      
      let targetMonth = currentLatest + 1;
      let isSettlement = false;

      if (targetMonth > duration && duration > 0) {
        targetMonth = 0; 
        isSettlement = true;
      }
      
      finalPayments.push({
        firm_id: targetId,
        member_id: firstM.member.id,
        group_id: firstM.group.id,
        person_id: personData.person_id,
        month: targetMonth,
        amount: remaining,
        status: 'paid',
        amount_due: 0,
        balance_due: 0,
        payment_date: payForm.date,
        mode: payForm.mode,
        payment_type: isSettlement ? 'settlement' : 'advance',
        collected_by: profile?.id || null,
        note: (isSettlement ? `SURPLUS: ${payForm.note}` : `ADVANCE: ${payForm.note}`).trim()
      });
      remaining = 0;
    }

    if (finalPayments.length === 0) { show('No allocations made', 'error'); setSaving(false); return; }

    const { error } = await supabase.from('payments').insert(finalPayments);
    if (error) { show(error.message, 'error'); }
    else {
      show(`Collected ₹${amount}! Receipt recorded.`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    }
    setSaving(false);
  }

  return (
    <Modal open={true} onClose={onClose} title="Record Collection" size="md">
      {loading ? <div className="py-20"><Loading /></div> : personData && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)]">
            <div className="font-bold text-lg">{personData.person_name}</div>
            <div className={cn("text-xl font-black mt-2", personData.is_overdue ? "text-[var(--danger)]" : "text-[#0ea5e9]")}>
              {fmt(personData.total_balance)}
            </div>
            
            {payForm.amount && !isNaN(Number(payForm.amount)) && (
              <div className="mt-3 pt-3 border-t border-dashed border-[var(--border)]">
                {(() => {
                  const diff = personData.total_balance - Number(payForm.amount);
                  if (Math.abs(diff) < 0.01) return <Badge variant="success" className="text-xs">Full Settlement</Badge>;
                  if (diff > 0) return (
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-[var(--text3)] uppercase tracking-widest">Remaining</span>
                      <span className="text-[var(--danger)]">{fmt(diff)}</span>
                    </div>
                  );
                  return (
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-[var(--text3)] uppercase tracking-widest">Advance / Surplus</span>
                      <span className="text-emerald-500">{fmt(Math.abs(diff))}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Field label="Amount Collected">
              <input 
                className={cn(inputClass, "text-2xl font-black")} 
                type="number" 
                autoFocus
                value={payForm.amount} 
                onChange={e => setPayForm(f => ({ ... f, amount: e.target.value }))} 
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Date">
                <input className={inputClass} type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
              </Field>
              <Field label="Mode">
                <select className={inputClass} value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Bank Transfer</option>
                </select>
              </Field>
            </div>
            <Field label="Note">
              <textarea 
                className={inputClass} 
                style={{ height: 60 }} 
                placeholder="Optional payment notes..."
                value={payForm.note} 
                onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} 
              />
            </Field>
          </div>

          <div className="flex gap-3 pt-4">
            <Btn variant="secondary" className="flex-1" onClick={onClose}>Cancel</Btn>
            <Btn 
              variant="primary" 
              className="flex-[2]" 
              loading={saving} 
              icon={CreditCard}
              onClick={handlePay}
            >
              Confirm Collection
            </Btn>
          </div>
        </div>
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </Modal>
  )
}
