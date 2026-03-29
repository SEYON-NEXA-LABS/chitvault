'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import { Btn, Card, StatCard, Loading, Empty, Toast, Modal, Badge } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { DENOMINATIONS } from '@/types'
import type { Denomination } from '@/types'
import { Printer, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { logActivity } from '@/lib/utils/logger'

type DenomKey = typeof DENOMINATIONS[number]['key']
type DenomCounts = Record<DenomKey, number>

const EMPTY_COUNTS = (): DenomCounts =>
  Object.fromEntries(DENOMINATIONS.map(d => [d.key, 0])) as DenomCounts

export default function CashbookPage() {
  const supabase = createClient()
  const { firm } = useFirm()
  const { toast, show, hide } = useToast()

  const [entries,  setEntries]  = useState<Denomination[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [addOpen,  setAddOpen]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Form state
  const [entryDate, setEntryDate]  = useState(new Date().toISOString().split('T')[0])
  const [staffId,   setStaffId]    = useState<string | null>(null)
  const [counts,    setCounts]     = useState<DenomCounts>(EMPTY_COUNTS())
  const [notes,     setNotes]      = useState('')
  const [liveTotal, setLiveTotal]  = useState(0)

  // Range filter
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])

  const load = useCallback(async () => {
    if (!firm) return
    const [dRes, pRes] = await Promise.all([
      supabase
        .from('denominations')
        .select('*')
        .eq('firm_id', firm.id)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date', { ascending: false }),
      supabase.from('profiles').select('id, full_name, role').eq('firm_id', firm.id).order('full_name')
    ])
    
    if (dRes.error) {
      show(dRes.error.message, 'error')
      setEntries([])
      setLoading(false)
      return
    }
    setProfiles(pRes.data || [])

    // Defensively calculate total for each entry to prevent crashes if it's missing from DB
    const entriesWithTotal = (dRes.data || []).map((e: any) => {
      const calculatedTotal = DENOMINATIONS.reduce((s, d) => {
          const count = e[d.key] || 0;
          return s + count * d.value;
      }, 0);
      return { ...e, total: (e.total != null && !isNaN(e.total)) ? e.total : calculatedTotal };
    });

    setEntries(entriesWithTotal)
    setLoading(false)
  }, [firm, fromDate, toDate, supabase, show])

  useEffect(() => { if (firm) load() }, [firm, fromDate, toDate, load])

  function recalc(c: DenomCounts) {
    const total = DENOMINATIONS.reduce((s, d) => s + (c[d.key] || 0) * d.value, 0)
    setLiveTotal(total)
  }

  function setCount(key: DenomKey, val: string) {
    const n = Math.max(0, parseInt(val) || 0)
    const next = { ...counts, [key]: n }
    setCounts(next); recalc(next)
  }

  async function handleSave() {
    if (!firm) return
    if (liveTotal === 0) { show('Enter at least one denomination.', 'error'); return }
    setSaving(true)
    
    const { data: userData } = await supabase.auth.getUser()
    const { error } = await supabase.from('denominations').insert({
      firm_id: firm.id,
      entry_date: entryDate,
      collected_by: staffId,
      ...counts,
      notes: notes.trim() || null,
      created_by: userData.user?.id,
    })
    setSaving(false)
    if (error) { show(error.message, 'error'); return }
    show('Cash entry saved! ✓')
    
    // Log Activity
    await logActivity(firm.id, 'CASH_ENTRY_SAVED', 'denominations', null, { date: entryDate, total: liveTotal })

    setAddOpen(false)
    setCounts(EMPTY_COUNTS()); setNotes(''); setLiveTotal(0)
    load()
  }

  async function del(id: number) {
    if (!confirm('Delete this cash entry?')) return
    await supabase.from('denominations').delete().eq('id', id)
    show('Deleted.')
    if (firm) await logActivity(firm.id, 'CASH_ENTRY_DELETED', 'denominations', id)
    load()
  }

  // Stats
  const totalInRange = entries.reduce((s, e) => s + Number(e.total || 0), 0)
  const todayTotal   = entries.filter(e => e.entry_date === new Date().toISOString().split('T')[0])
    .reduce((s, e) => s + Number(e.total || 0), 0)
  const entryCount = entries.length

  if (loading) return <Loading />

  const notes_section = DENOMINATIONS.filter(d => d.type === 'note')
  const coins_section = DENOMINATIONS.filter(d => d.type === 'coin')

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Today's Cash"    value={fmt(todayTotal)}   color="green" />
        <StatCard label="Period Total"    value={fmt(totalInRange)} color="gold"  sub={`${entryCount} entries`} />
        <StatCard label="Entries in Range" value={entryCount}       color="blue"  />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text2)' }}>
          <span>From</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          <span>To</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Btn variant="secondary" size="sm" onClick={() => window.print()} className="no-print">
            <Printer size={13} /> Print
          </Btn>
          <Btn variant="primary" size="sm" onClick={async () => { 
            const { data } = await supabase.auth.getUser();
            setStaffId(data.user?.id || null);
            setCounts(EMPTY_COUNTS()); setLiveTotal(0); setNotes(''); setAddOpen(true) 
          }}>
            <Plus size={13} /> New Entry
          </Btn>
        </div>
      </div>

      {/* Entries */}
      {entries.length === 0
        ? <Empty icon="💵" text="No cash entries yet. Click '+ New Entry' to record today's collection." />
        : (
          <div className="space-y-3">
            {entries.map(e => {
              const isExpanded = expandedId === e.id
              const denomWithValues = DENOMINATIONS.filter(d => (e as any)[d.key] > 0)

              return (
                <Card key={e.id} className="overflow-hidden">
                  {/* Header row */}
                  <button className="w-full flex items-center gap-4 px-5 py-4 text-left"
                    onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                    <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      {fmtDate(e.entry_date)}
                    </div>
                    <div className="flex-1 flex flex-wrap gap-1.5">
                      {denomWithValues.map(d => (
                        <span key={d.key} className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
                          {d.label} × {(e as any)[d.key]}
                        </span>
                      ))}
                    </div>
                    <div className="font-mono font-bold text-base mr-3" style={{ color: 'var(--gold)' }}>
                      {fmt(e.total || 0)}
                    </div>
                    {e.collected_by && (
                      <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg mr-3" style={{ background: 'var(--blue-dim)', color: 'var(--blue)' }}>
                         <span className="text-[10px] font-bold uppercase opacity-60">Collected By:</span>
                         <span className="text-xs font-semibold">
                           {profiles.find(p => p.id === e.collected_by)?.full_name || 'Staff User'}
                         </span>
                      </div>
                    )}
                    {isExpanded ? <ChevronUp size={15} style={{ color: 'var(--text3)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text3)' }} />}
                  </button>

                  {/* Expanded breakdown */}
                  {isExpanded && (
                    <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>
                      {/* Denomination grid */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* Notes */}
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>Notes</div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr>
                                {['Denomination','Count','Amount'].map(h => (
                                  <th key={h} className="text-left text-xs font-medium pb-1.5" style={{ color: 'var(--text3)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {notes_section.map(d => {
                                const cnt = (e as any)[d.key] || 0
                                if (!cnt) return null
                                return (
                                  <tr key={d.key}>
                                    <td className="py-1 font-medium" style={{ color: 'var(--text)' }}>{d.label}</td>
                                    <td className="py-1 font-mono" style={{ color: 'var(--text2)' }}>× {cnt}</td>
                                    <td className="py-1 font-mono font-semibold" style={{ color: 'var(--green)' }}>{fmt(cnt * d.value)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Coins */}
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>Coins</div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr>
                                {['Coin','Count','Amount'].map(h => (
                                  <th key={h} className="text-left text-xs font-medium pb-1.5" style={{ color: 'var(--text3)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {coins_section.map(d => {
                                const cnt = (e as any)[d.key] || 0
                                if (!cnt) return null
                                return (
                                  <tr key={d.key}>
                                    <td className="py-1 font-medium" style={{ color: 'var(--text)' }}>{d.label}</td>
                                    <td className="py-1 font-mono" style={{ color: 'var(--text2)' }}>× {cnt}</td>
                                    <td className="py-1 font-mono font-semibold" style={{ color: 'var(--green)' }}>{fmt(cnt * d.value)}</td>
                                  </tr>
                                )
                              })}
                              {coins_section.every(d => !(e as any)[d.key]) && (
                                <tr><td colSpan={3} className="text-xs py-2" style={{ color: 'var(--text3)' }}>No coins</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Total + notes */}
                      <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div>
                          {e.notes && <div className="text-sm" style={{ color: 'var(--text2)' }}>📝 {e.notes}</div>}
                          <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                            {e.created_at ? `Recorded ${new Date(e.created_at).toLocaleString('en-IN')}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-mono font-bold text-xl" style={{ color: 'var(--gold)' }}>{fmt(e.total || 0)}</div>
                          <Btn size="sm" variant="danger" onClick={() => del(e.id)}><Trash2 size={13} /></Btn>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}

            {/* Period total */}
            <div className="flex justify-end">
              <div className="px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text2)' }}>Total for period</span>
                <span className="font-mono font-bold text-xl" style={{ color: 'var(--gold)' }}>{fmt(totalInRange)}</span>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Entry Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Daily Cash Entry" size="lg">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text2)' }}>Date</label>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text2)' }}>Collected By (Staff)</label>
            <select value={staffId || ''} onChange={e => setStaffId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <option value="">Select Staff...</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.full_name || 'Staff User'} ({p.role === 'owner' ? 'Owner' : 'Staff'})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-5">
          {/* Notes */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text2)' }}>📄 Notes (Currency)</div>
            <div className="space-y-2">
              {notes_section.map(d => (
                <div key={d.key} className="flex items-center gap-3">
                  <div className="w-14 text-sm font-bold text-right" style={{ color: 'var(--text)' }}>{d.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>×</div>
                  <input type="number" min="0" value={counts[d.key] || ''}
                    onChange={e => setCount(d.key, e.target.value)}
                    placeholder="0"
                    className="w-20 px-3 py-2 rounded-lg border text-sm font-mono outline-none text-center"
                    style={{ background: 'var(--surface2)', borderColor: counts[d.key] > 0 ? 'var(--green)' : 'var(--border)', color: 'var(--text)' }} />
                  {counts[d.key] > 0 && (
                    <div className="text-xs font-mono font-semibold" style={{ color: 'var(--green)', minWidth: 60 }}>
                      = {fmt(counts[d.key] * d.value)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Coins */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text2)' }}>🪙 Coins</div>
            <div className="space-y-2">
              {coins_section.map(d => (
                <div key={d.key} className="flex items-center gap-3">
                  <div className="w-14 text-sm font-bold text-right" style={{ color: 'var(--text)' }}>{d.label}</div>
                  <div className="text-xs" style={{ color: 'var(--text3)' }}>×</div>
                  <input type="number" min="0" value={counts[d.key] || ''}
                    onChange={e => setCount(d.key, e.target.value)}
                    placeholder="0"
                    className="w-20 px-3 py-2 rounded-lg border text-sm font-mono outline-none text-center"
                    style={{ background: 'var(--surface2)', borderColor: counts[d.key] > 0 ? 'var(--green)' : 'var(--border)', color: 'var(--text)' }} />
                  {counts[d.key] > 0 && (
                    <div className="text-xs font-mono font-semibold" style={{ color: 'var(--green)', minWidth: 60 }}>
                      = {fmt(counts[d.key] * d.value)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Live total */}
        <div className="flex items-center justify-between p-4 rounded-xl mb-4"
          style={{ background: liveTotal > 0 ? 'rgba(201,168,76,0.1)' : 'var(--surface2)', border: `1px solid ${liveTotal > 0 ? 'rgba(201,168,76,0.4)' : 'var(--border)'}` }}>
          <div className="text-sm font-semibold" style={{ color: 'var(--text2)' }}>Total Cash</div>
          <div className="font-mono font-bold text-2xl" style={{ color: liveTotal > 0 ? 'var(--gold)' : 'var(--text3)' }}>
            {fmt(liveTotal)}
          </div>
        </div>

        {/* Notes text */}
        <div className="mb-5">
          <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text2)' }}>Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Morning collection — Route A"
            className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        </div>

        <div className="flex justify-end gap-3 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleSave}>
            Save Entry — {fmt(liveTotal)}
          </Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
