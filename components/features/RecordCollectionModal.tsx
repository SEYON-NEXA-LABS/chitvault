'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useFirm } from '@/lib/firm/context'
import { fmt, getToday, cn, getGroupDisplayName } from '@/lib/utils'
import {
  Loading, Badge, Btn, Modal, Field, Toast, Empty
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { CreditCard, CheckCircle2 } from 'lucide-react'

interface CollectionItem {
  person_id: number;
  person_name: string;
  person_phone: string;
  person_address?: string;
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

  const [selectedDues, setSelectedDues] = useState<string[]>([]); // Array of "memberId-month"

  const isSuper = role === 'superadmin'

  const loadPersonDues = useCallback(async () => {
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return

    setLoading(true)
    try {
      const { data: pInfo } = await supabase.from('persons').select('name, phone').eq('id', personId).single()
      
      const { data: rpcData, error } = await supabase.rpc('get_collection_workspace', {
        p_firm_id: targetId,
        p_search: pInfo?.phone || pInfo?.name || '',
        p_group_id: null,
        p_limit: 10,
        p_offset: 0
      })

      if (error) throw error
      
      const match = (rpcData as CollectionItem[] || []).find(x => Number(x.person_id) === Number(personId))
      if (match) {
        setPersonData(match)
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

  const allDues = useMemo(() => {
    if (!personData) return [];
    return personData.memberships.flatMap((m: any) => 
      (m.dues || []).map((d: any) => ({ 
        ...d, 
        memberId: m.member.id, 
        groupId: m.group.id, 
        groupName: getGroupDisplayName(m.group, t),
        key: `${m.member.id}-${d.month}`
      }))
    ).sort((a: any, b: any) => a.month - b.month);
  }, [personData, t]);

  useEffect(() => {
    if (allDues.length > 0 && selectedDues.length === 0) {
      setSelectedDues(allDues.map(d => d.key));
    }
  }, [allDues]);

  useEffect(() => {
    const total = allDues
      .filter(d => selectedDues.includes(d.key))
      .reduce((sum, d) => sum + (d.amount_due - d.amount_paid), 0);
    setPayForm(f => ({ ...f, amount: String(total) }));
  }, [selectedDues, allDues]);

  const toggleAll = () => {
    if (selectedDues.length === allDues.length) setSelectedDues([]);
    else setSelectedDues(allDues.map(d => d.key));
  };

  const toggleOne = (key: string) => {
    setSelectedDues(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  async function handlePay() {
    if (!personData || !firm) return;
    const totalAmount = Number(payForm.amount);
    if (totalAmount <= 0 && selectedDues.length === 0) { show('Select at least one payment', 'error'); return; }

    setSaving(true);
    const targetId = isSuper ? switchedFirmId : firm.id
    const finalPayments = [];

    const targetDues = allDues.filter(d => selectedDues.includes(d.key));

    for (const due of targetDues) {
      const bal = due.amount_due - due.amount_paid;
      if (bal <= 0.01) continue;

      finalPayments.push({
        firm_id: targetId,
        member_id: due.memberId,
        group_id: due.groupId,
        month: due.month,
        amount: bal,
        status: 'paid',
        amount_due: due.amount_due,
        balance_due: 0,
        payment_date: payForm.date,
        mode: payForm.mode,
        payment_type: 'full',
        collected_by: profile?.id || null,
        note: payForm.note
      });
    }

    if (finalPayments.length === 0) { show('No payments to record', 'error'); setSaving(false); return; }

    const { error } = await supabase.from('payments').insert(finalPayments);
    if (error) { show(error.message, 'error'); }
    else {
      show(`Collected ₹${totalAmount}! ${finalPayments.length} installments cleared.`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    }
    setSaving(false);
  }

  return (
    <Modal open={true} onClose={onClose} title={`Collect - ${personData?.person_name || '...'}`} size="lg">
      {loading ? <div className="py-20"><Loading /></div> : personData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Left Side: Installment Tree */}
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="flex items-center justify-between sticky top-0 bg-[var(--surface)] py-2 z-10">
              <h4 className="text-xs font-black uppercase tracking-widest opacity-40">Pending Installments</h4>
              <button onClick={toggleAll} className="text-[10px] font-bold text-[var(--accent)] uppercase hover:underline">
                {selectedDues.length === allDues.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="space-y-2">
              {allDues.map((due) => (
                <div 
                  key={due.key}
                  onClick={() => toggleOne(due.key)}
                  className={cn(
                    "p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between group",
                    selectedDues.includes(due.key) 
                    ? "border-[var(--accent)] bg-[var(--accent-dim)]" 
                    : "border-[var(--border)] bg-[var(--surface2)] hover:border-[var(--accent-border)]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all",
                      selectedDues.includes(due.key) ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)] group-hover:border-[var(--accent-border)]"
                    )}>
                      {selectedDues.includes(due.key) && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-tighter">{due.groupName}</div>
                      <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-0.5">Month {due.month}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-sm tracking-tight">{fmt(due.amount_due - due.amount_paid)}</div>
                    {due.amount_paid > 0 && <div className="text-[9px] text-emerald-500 font-bold uppercase mt-1">Partial Paid</div>}
                  </div>
                </div>
              ))}
              {allDues.length === 0 && <Empty text="No pending dues found" />}
            </div>
          </div>

          {/* Right Side: Payment Details */}
          <div className="space-y-6">
            <div className="p-7 rounded-[2rem] bg-[var(--surface2)] border border-[var(--border)] relative overflow-hidden shadow-inner">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <CreditCard size={100} />
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text3)] mb-1">Collecting Total</div>
              <div className={cn("text-5xl font-black tracking-tighter", selectedDues.length > 0 ? "text-[var(--accent)]" : "text-[var(--text3)]")}>
                {fmt(Number(payForm.amount))}
              </div>
              <div className="mt-6 flex items-center gap-2">
                 <Badge variant={selectedDues.length > 0 ? 'accent' : 'gray'} className="px-3 py-1 text-[10px] uppercase font-black">
                    {selectedDues.length} Items Selected
                 </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Collection Date">
                  <input className={inputClass} type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))} />
                </Field>
                <Field label="Payment Mode">
                  <select className={inputClass} value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))}>
                    <option>Cash</option>
                    <option>UPI</option>
                    <option>Bank Transfer</option>
                    <option>Cheque</option>
                  </select>
                </Field>
              </div>
              <Field label="Reference / Note">
                <textarea 
                  className={inputClass} 
                  style={{ height: 70 }} 
                  placeholder="Optional notes or transaction ID..."
                  value={payForm.note} 
                  onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))} 
                />
              </Field>
            </div>

            <div className="flex gap-4 pt-4">
              <Btn variant="secondary" className="flex-1 py-4" onClick={onClose}>Cancel</Btn>
              <Btn 
                variant="primary" 
                className="flex-[2] py-4 shadow-xl shadow-[var(--accent-dim)]" 
                disabled={selectedDues.length === 0}
                loading={saving} 
                icon={CreditCard}
                onClick={handlePay}
              >
                Confirm Collection
              </Btn>
            </div>
          </div>

        </div>
      )}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </Modal>
  )
}
