'use client'
 
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, getToday, cn } from '@/lib/utils'
import { Btn, Card, StatCard, Loading, Empty, Toast, Modal, Badge, Table, Tr, Th, Td } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { DENOMINATIONS } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import type { Denomination, Firm } from '@/types'
import { Printer, Plus, Trash2, ChevronDown, ChevronUp, History, CheckCircle2, AlertCircle } from 'lucide-react'
import { logActivity } from '@/lib/utils/logger'
import { Pagination } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
 
type DenomKey = typeof DENOMINATIONS[number]['key']
type DenomCounts = Record<DenomKey, number>
 
const EMPTY_COUNTS = (): DenomCounts =>
  Object.fromEntries(DENOMINATIONS.map(d => [d.key, 0])) as DenomCounts
 
export default function CashbookPage() {
  const supabase = createClient()
  const { firm, role, can, switchedFirmId } = useFirm()
  const { toast, show, hide } = useToast()
  const { t } = useI18n()
 
  const [entries,  setEntries]  = useState<Denomination[]>([])
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [addOpen,  setAddOpen]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [view, setView] = useState<'entries' | 'reconciliation'>('entries')
  
  // Pagination
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalRecords, setTotalRecords] = useState(0)
  
  const isSuper = role === 'superadmin'
 
  // Form state
  const [entryDate, setEntryDate]  = useState(getToday())
  const [staffId,   setStaffId]    = useState<string | null>(null)
  const [counts,    setCounts]     = useState<DenomCounts>(EMPTY_COUNTS())
  const [notes,     setNotes]      = useState('')
  const [liveTotal, setLiveTotal]  = useState(0)
  
  // Transaction stats
  const [totalCollections, setTotalCollections] = useState(0)
  const [cashCollections,  setCashCollections]  = useState(0)
  const [totalPayouts,     setTotalPayouts]     = useState(0)
  const [reconData,        setReconData]        = useState<any[]>([])
 
  // Range filter
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); 
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [toDate, setToDate] = useState(getToday())
 
  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return
 
    try {
      const [statsRes, dRes, pRes, reconRes] = await Promise.all([
        supabase.rpc('get_firm_ledger_stats', {
          p_firm_id: targetId,
          p_start_date: fromDate,
          p_end_date: toDate
        }),
        withFirmScope(supabase.from('denominations').select('id, entry_date, note_2000, note_500, note_200, note_100, note_50, note_20, note_10, coin_5, coin_2, coin_1, total, notes, created_at, collected_by, is_verified', { count: 'exact' }), targetId)
          .is('deleted_at', null)
          .gte('entry_date', fromDate)
          .lte('entry_date', toDate)
          .order('entry_date', { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1),
        withFirmScope(supabase.from('profiles').select('id, full_name, role'), targetId).order('full_name'),
        supabase.rpc('get_daily_reconciliation', {
            p_firm_id: targetId,
            p_start_date: fromDate,
            p_end_date: toDate
        })
      ])
 
      if (statsRes.data) {
        setTotalCollections(Number(statsRes.data.collectedInRange || 0))
        setCashCollections(Number(statsRes.data.cashInRange || statsRes.data.collectedInRange || 0))
        setTotalPayouts(Number(statsRes.data.payoutsInRange || 0))
      }
 
      if (reconRes.data) {
          setReconData(reconRes.data)
      }
 
      setTotalRecords(dRes.count || 0)
      setProfiles(pRes.data || [])
 
      const entriesWithTotal = (dRes.data || []).map((e: any) => {
        const calculatedTotal = DENOMINATIONS.reduce((s, d) => s + (e[d.key] || 0) * d.value, 0)
        return { ...e, total: (e.total != null && !isNaN(e.total)) ? e.total : calculatedTotal }
      })
 
      setEntries(entriesWithTotal)
    } finally {
      setLoading(false)
    }
  }, [supabase, isSuper, switchedFirmId, firm, fromDate, toDate, page, pageSize])
 
  useEffect(() => { load(true) }, [load])
 
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
    if (!can('deleteCashEntry')) return
    if (!confirm('Are you sure you want to move this cash entry to trash?')) return
    const { error } = await supabase.from('denominations').update({ deleted_at: new Date() }).eq('id', id)
    if (error) { show(error.message, 'error'); return }
 
    show('Moved to trash.')
    if (firm) await logActivity(firm.id, 'CASH_ENTRY_ARCHIVED', 'denominations', id)
    load()
  }
 
  async function toggleVerify(id: number, current: boolean) {
      if (!can('editCashEntry')) return
      const { error } = await supabase.from('denominations').update({ is_verified: !current }).eq('id', id)
      if (error) { show(error.message, 'error'); return }
      show(!current ? 'Verified! ✓' : 'Verification removed.')
      load()
  }
 
  // Stats
  const physicalTotal = entries.reduce((s, e) => s + Number(e.total || 0), 0)
  const expectedNet   = cashCollections - totalPayouts
  const discrepancy   = physicalTotal - expectedNet
 
  if (loading) return <Loading />
 
  const notes_section = DENOMINATIONS.filter(d => d.type === 'note')
  const coins_section = DENOMINATIONS.filter(d => d.type === 'coin')
 
  return (
    <div className="space-y-6 printable">
      {/* Header with Firm Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)]">{t('cashbook_title')}</h1>
          <p className="text-xs opacity-60 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            {t('cashbook_desc')}
          </p>
        </div>
        <div className="flex bg-[var(--surface2)] p-1 rounded-xl no-print">
            <button 
                onClick={() => setView('entries')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", view === 'entries' ? "bg-[var(--surface)] shadow-sm text-[var(--accent)]" : "text-[var(--text2)] opacity-60")}
            >
                {t('cash_entries')}
            </button>
            <button 
                onClick={() => setView('reconciliation')}
                className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", view === 'reconciliation' ? "bg-[var(--surface)] shadow-sm text-[var(--accent)]" : "text-[var(--text2)] opacity-60")}
            >
                {t('reconciliation')}
            </button>
        </div>
      </div>
 
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard label={t('cash_collections')} value={fmt(cashCollections)} color="info" />
        <StatCard label={t('payouts_out')}     value={fmt(totalPayouts)}     color="danger"  />
        <StatCard 
          label={t('expected_cash')} 
          value={fmt(expectedNet)} 
          color="accent" 
          sub={t('book_balance')}
        />
        <StatCard 
          label={t('physical_cash')} 
          value={fmt(physicalTotal)} 
          color={Math.abs(discrepancy) < 1 ? 'success' : 'danger'} 
          sub={Math.abs(discrepancy) < 1 ? t('matches_book') : `${t('diff')}: ${fmt(discrepancy)}`}
        />
      </div>
 
      {Math.abs(discrepancy) > 1 && (
        <div className="p-4 rounded-xl border border-danger-500/20 bg-danger-500/5 text-danger-500 text-sm font-semibold flex items-center gap-3 mb-6 no-print">
           <div className="p-1.5 rounded-full bg-danger-500 text-white"><AlertCircle size={14} /></div>
           {t('discrepancy_detected')}
        </div>
      )}
 
      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2 group">
          <span className="text-[10px] font-black uppercase opacity-20 group-hover:opacity-100 transition-opacity tracking-widest">{t('from')}</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        </div>
        <div className="flex items-center gap-2 group">
          <span className="text-[10px] font-black uppercase opacity-20 group-hover:opacity-100 transition-opacity tracking-widest">{t('to')}</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-sm outline-none"
            style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
        </div>
        <div className="flex gap-2 ml-auto">
          <Btn variant="secondary" size="sm" onClick={() => window.print()} className="no-print">
            <Printer size={13} /> {t('print')}
          </Btn>
          <Btn variant="primary" size="sm" onClick={async () => { 
            const { data } = await supabase.auth.getUser();
            setStaffId(data.user?.id || null);
            setCounts(EMPTY_COUNTS()); setLiveTotal(0); setNotes(''); setAddOpen(true) 
          }}>
            <Plus size={13} /> {t('new_entry')}
          </Btn>
        </div>
      </div>
 
      {view === 'entries' ? (
          <>
            {entries.length === 0
              ? <Empty icon="💵" text={t('no_cash_entries')} />
              : (
                <div className="space-y-3">
                  {entries.map(e => {
                    const isExpanded = expandedId === e.id
                    const denomWithValues = DENOMINATIONS.filter(d => (e as any)[d.key] > 0)
 
                    return (
                      <Card key={e.id} className="overflow-hidden">
                        {/* Header row */}
                        <div className="w-full flex items-center gap-4 px-5 py-4">
                          <button className="flex-1 flex items-center gap-4 text-left"
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
                            <div className="font-mono font-bold text-base mr-3" style={{ color: 'var(--accent)' }}>
                              {fmt(e.total || 0)}
                            </div>
                          </button>
                          
                          <div className="flex items-center gap-3 no-print">
                              <button 
                                onClick={() => toggleVerify(e.id, !!e.is_verified)}
                                className={cn("p-2 rounded-xl transition-all", e.is_verified ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/5 text-slate-400 hover:bg-slate-500/10")}
                              >
                                  <CheckCircle2 size={16} />
                              </button>
                              {isExpanded ? <ChevronUp size={15} className="opacity-20" /> : <ChevronDown size={15} className="opacity-20" />}
                          </div>
                        </div>
 
                        {/* Expanded breakdown */}
                        {isExpanded && (
                          <div className="border-t px-5 py-4" style={{ borderColor: 'var(--border)' }}>
                            {/* Denomination grid */}
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              {/* Notes */}
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>{t('notes_label')}</div>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr>
                                      {[t('col_denominations'), t('col_count'), t('amount')].map(h => (
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
                                          <td className="py-1 font-mono font-semibold" style={{ color: 'var(--success)' }}>{fmt(cnt * d.value)}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              {/* Coins */}
                              <div>
                                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text3)' }}>{t('coins_label')}</div>
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr>
                                      {[t('col_coin'), t('col_count'), t('amount')].map(h => (
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
                                          <td className="py-1 font-mono font-semibold" style={{ color: 'var(--success)' }}>{fmt(cnt * d.value)}</td>
                                        </tr>
                                      )
                                    })}
                                    {coins_section.every(d => !(e as any)[d.key]) && (
                                      <tr><td colSpan={3} className="text-xs py-2" style={{ color: 'var(--text3)' }}>{t('no_coins')}</td></tr>
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
                                  {e.created_at ? `${t('recorded_on')} ${new Date(e.created_at).toLocaleString('en-IN')}` : ''}
                                  {e.collected_by && ` • ${t('collected_by')}: ${profiles.find(p => p.id === e.collected_by)?.full_name || 'Staff'}`}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="font-mono font-bold text-xl" style={{ color: 'var(--accent)' }}>{fmt(e.total || 0)}</div>
                                {can('deleteCashEntry') && <Btn size="sm" variant="danger" onClick={() => del(e.id)}><Trash2 size={13} /></Btn>}
                              </div>
                            </div>
                          </div>
                        )}
                      </Card>
                    )
                  })}
 
                  <Pagination 
                    current={page} 
                    total={totalRecords} 
                    pageSize={pageSize} 
                    onPageChange={setPage} 
                    onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
                  />
                </div>
              )
            }
          </>
      ) : (
          <Card className="overflow-hidden">
              <Table>
                  <thead>
                      <Tr>
                          <Th>{t('date')}</Th>
                          <Th right>{t('system_cash_receipts')}</Th>
                          <Th right>{t('physical_cashbook')}</Th>
                          <Th right>{t('diff')}</Th>
                          <Th className="text-center">{t('status')}</Th>
                      </Tr>
                  </thead>
                  <tbody>
                      {reconData.map((r, i) => {
                          const diff = r.actual_cash - r.expected_cash
                          const hasIssue = Math.abs(diff) > 1
                          if (r.expected_cash === 0 && r.actual_cash === 0) return null
 
                          return (
                              <Tr key={i} className={cn(r.is_verified ? "bg-emerald-50/30" : "")}>
                                  <Td className="font-bold">{fmtDate(r.entry_date)}</Td>
                                  <Td right className="font-mono">{fmt(r.expected_cash)}</Td>
                                  <Td right className="font-mono font-bold text-[var(--accent)]">{fmt(r.actual_cash)}</Td>
                                  <Td right className={cn("font-mono font-black", hasIssue ? "text-red-500" : "text-emerald-500")}>
                                      {hasIssue ? fmt(diff) : '✓ Tally'}
                                  </Td>
                                  <Td className="text-center">
                                      {r.is_verified ? (
                                          <Badge variant="success" className="text-[10px] uppercase font-black tracking-widest px-3 py-1">
                                              Verified
                                          </Badge>
                                      ) : (
                                          <div className="flex justify-center">
                                              <div className={cn("w-2 h-2 rounded-full", hasIssue ? "bg-red-500 animate-pulse" : "bg-slate-200")} />
                                          </div>
                                      )}
                                  </Td>
                              </Tr>
                          )
                      })}
                  </tbody>
              </Table>
          </Card>
      )}
 
      {/* Add Entry Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('denomination_entry')} size="lg">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text2)' }}>{t('date')}</label>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1" style={{ color: 'var(--text2)' }}>{t('collected_by')}</label>
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
                    style={{ background: 'var(--surface2)', borderColor: counts[d.key] > 0 ? 'var(--success)' : 'var(--border)', color: 'var(--text)' }} />
                  {counts[d.key] > 0 && (
                    <div className="text-xs font-mono font-semibold" style={{ color: 'var(--success)', minWidth: 60 }}>
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
                    style={{ background: 'var(--surface2)', borderColor: counts[d.key] > 0 ? 'var(--success)' : 'var(--border)', color: 'var(--text)' }} />
                  {counts[d.key] > 0 && (
                    <div className="text-xs font-mono font-semibold" style={{ color: 'var(--success)', minWidth: 60 }}>
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
          <div className="font-mono font-bold text-2xl" style={{ color: liveTotal > 0 ? 'var(--accent)' : 'var(--text3)' }}>
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
