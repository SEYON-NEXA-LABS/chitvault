'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, cn } from '@/lib/utils'
import { Btn, Card, Loading, Toast } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Info, Settings2, Gavel, ArrowLeft, RefreshCcw, Database } from 'lucide-react'
import type { GroupWithRules, CommissionType } from '@/types'
import { COMMISSION_TYPE_LABELS as CTL } from '@/types'

export default function GroupSettingsPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const { firm } = useFirm()
  const { toast, show, hide } = useToast()

  const groupId = Number(params.id)

  const [group,          setGroup]          = useState<GroupWithRules | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [syncing,        setSyncing]        = useState(false)
  const [preview,        setPreview]        = useState<any>(null)
  const [testBid,        setTestBid]        = useState('')

  // Form state mirrors group columns
  const [rules, setRules] = useState({
    min_bid_pct:          0.70,
    max_bid_pct:          1.00,
    discount_cap_pct:     1.00,
    commission_type:      'percent_of_chit' as CommissionType,
    commission_value:     5.00,
    commission_recipient: 'foreman' as 'foreman'|'firm',
    dividend_rule:        'equal_split' as 'equal_split'|'proportional',
  })

  // Detect dirty state
  const isDirty = group && (
    rules.min_bid_pct !== (group.min_bid_pct ?? 0.70) ||
    rules.max_bid_pct !== (group.max_bid_pct ?? 1.00) ||
    rules.commission_type !== (group.commission_type ?? 'percent_of_chit') ||
    rules.commission_value !== (group.commission_value ?? 5.00) ||
    rules.commission_recipient !== (group.commission_recipient ?? 'foreman') ||
    rules.dividend_rule !== (group.dividend_rule ?? 'equal_split')
  )

  useEffect(() => {
    async function load() {
      if (!firm) return
      const { data } = await supabase.from('groups').select('*').eq('id', groupId).eq('firm_id', firm.id).single()
      if (!data) { router.push('/groups'); return }
      setGroup(data)
      setRules({
        min_bid_pct:          data.min_bid_pct          ?? 0.70,
        max_bid_pct:          data.max_bid_pct          ?? 1.00,
        discount_cap_pct:     data.discount_cap_pct     ?? 1.00,
        commission_type:      data.commission_type      ?? 'percent_of_chit',
        commission_value:     data.commission_value     ?? 5.00,
        commission_recipient: data.commission_recipient ?? 'foreman',
        dividend_rule:        data.dividend_rule        ?? 'equal_split',
      })
      setTestBid(String(Math.round(data.chit_value * 0.85)))
      setLoading(false)
    }
    load()
  }, [firm, groupId, router, supabase])

  // Smart Simulator - Passes local rules to verify math before saving
  const calculatePreview = useCallback(async (bid: number) => {
    if (!group) return
    
    // Instead of local JS math, use the "What-If" RPC for perfect accuracy
    const { data, error } = await supabase.rpc('calculate_auction', {
      p_group_id:   groupId,
      p_bid_amount: bid,
      p_comm_type:  rules.commission_type,
      p_comm_val:   rules.commission_value,
      p_comm_recipient: rules.commission_recipient
    })

    if (error) {
       console.error("Preview Error:", error.message)
       return
    }
    setPreview(data)
  }, [group, groupId, rules, supabase])

  useEffect(() => {
     if (testBid && !isNaN(+testBid)) calculatePreview(+testBid)
  }, [testBid, calculatePreview])

  async function save() {
    if (!firm) return
    setSaving(true)
    
    // Safety: Only update columns that exist in the DB schema
    const { dividend_rule, ...safeRules } = rules as any;
    
    console.log('--- SAVING RULES ---', safeRules)
    const { error, data } = await supabase.from('groups').update(safeRules).eq('id', groupId).eq('firm_id', firm.id).select()
    
    setSaving(false)
    if (error) { 
      console.error('--- SAVE ERROR ---', error)
      show(error.message || 'Failed to save rules', 'error')
      return 
    }
    
    console.log('--- SAVE SUCCESS ---', data)
    show('Auction rules saved! ✓', 'success')
    setGroup(g => g ? { ...g, ...safeRules } : g)
    router.refresh()
  }

  async function recalculateLedger() {
    if (!confirm('This will retroactively update all historical dividends and commissions for this group based on current settings. Proceed?')) return
    setSyncing(true)
    const { error } = await supabase.rpc('recalculate_group_ledger', { p_group_id: groupId })
    setSyncing(false)
    if (error) { show(error.message, 'error'); return }
    show('Ledger recalculated successfully! ✓', 'success')
    router.refresh()
  }

  if (loading) return <Loading />
  if (!group)  return null

  const minBid = Math.round(group.chit_value * rules.min_bid_pct)
  const maxBid = Math.round(group.chit_value * rules.max_bid_pct)

  return (
    <div className="space-y-6 max-w-2xl pb-10 relative">
      
      {/* Dirty Indicator */}
      {isDirty && (
        <div className="fixed top-20 right-8 z-50 animate-bounce">
           <div className="bg-[var(--warning)] text-[var(--warning-text)] px-4 py-2 rounded-2xl border border-[var(--warning-border)] shadow-2xl flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest">Unsaved Changes</span>
           </div>
        </div>
      )}

      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/groups/${groupId}`)} className="p-2.5 rounded-xl hover:bg-[var(--surface2)] transition-colors border" style={{ borderColor: 'var(--border)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50 mb-1">
               <Settings2 size={12} /> Execution Settings
             </div>
             <h1 className="text-2xl font-bold">{group.name}</h1>
          </div>
        </div>
        <Btn onClick={() => router.push(`/groups/${groupId}`)} icon={Gavel}>View Ledger</Btn>
      </div>

      <Card title="🎯 Bid Thresholds" subtitle="Configure auction floor and ceiling">
        <div className="p-5 space-y-6">
           <div className="p-3 rounded-xl text-sm flex gap-2"
            style={{ background: 'rgba(91,138,245,0.07)', border: '1px solid rgba(91,138,245,0.2)', color: 'var(--info)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            These limits ensure auctions remain fair and within financial boundaries.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-black uppercase opacity-40">Minimum Floor</label>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--surface2)]" style={{ color: 'var(--accent)' }}>
                  {Math.round(rules.min_bid_pct * 100)}%
                </span>
              </div>
              <input type="range" min="0" max="100" step="1" 
                value={Math.round(rules.min_bid_pct * 100)} 
                onChange={e => setRules(r => ({...r, min_bid_pct: +e.target.value / 100}))}
                className="w-full" style={{ accentColor: 'var(--accent)' }} />
              <div className="text-[10px] mt-1 font-bold opacity-30">₹{minBid.toLocaleString()}</div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-xs font-black uppercase opacity-40">Maximum Ceiling</label>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--surface2)]" style={{ color: 'var(--danger)' }}>
                  {Math.round(rules.max_bid_pct * 100)}%
                </span>
              </div>
              <input type="range" min="0" max="100" step="1" 
                value={Math.round(rules.max_bid_pct * 100)} 
                onChange={e => setRules(r => ({...r, max_bid_pct: +e.target.value / 100}))}
                className="w-full" style={{ accentColor: 'var(--danger)' }} />
              <div className="text-[10px] mt-1 font-bold opacity-30">₹{maxBid.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </Card>

      <Card title="👑 Commission Logic" subtitle="Revenue strategy for the group">
        <div className="p-5 space-y-5">
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.entries(CTL) as [CommissionType, string][]).map(([type, label]) => (
                <button key={type} onClick={() => setRules(r => ({...r, commission_type: type}))}
                  className="text-left px-4 py-3 rounded-xl border transition-all"
                  style={{ 
                    borderColor: rules.commission_type === type ? 'var(--accent)' : 'var(--border)',
                    background:  rules.commission_type === type ? 'rgba(201,168,76,0.08)' : 'var(--surface2)',
                  }}>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${rules.commission_type === type ? 'var(--accent)' : 'var(--border)'}`, background: rules.commission_type === type ? 'var(--accent)' : 'transparent' }} />
                    <span className="text-[11px] font-bold uppercase tracking-tight" style={{ color: 'var(--text)' }}>{label}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase opacity-40 mb-1.5 block">Commission Value</label>
                <div className="relative">
                  <input type="number" value={rules.commission_value}
                    onChange={e => setRules(r => ({...r, commission_value: +e.target.value}))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm font-bold outline-none"
                    style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
                  <span className="absolute right-3 top-2.5 text-xs opacity-30 font-bold">
                    {rules.commission_type === 'fixed_amount' ? '₹' : '%'}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase opacity-40 mb-1.5 block">Recipient</label>
                <div className="flex bg-[var(--surface2)] p-1 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                   <button onClick={() => setRules(r => ({...r, commission_recipient: 'foreman'}))}
                     className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all", rules.commission_recipient === 'foreman' ? 'bg-[var(--surface)] shadow-sm' : 'opacity-40')}>
                     Foreman
                   </button>
                   <button onClick={() => setRules(r => ({...r, commission_recipient: 'firm'}))}
                     className={cn("flex-1 py-1.5 rounded-lg text-xs font-bold transition-all", rules.commission_recipient === 'firm' ? 'bg-[var(--surface)] shadow-sm' : 'opacity-40')}>
                     Firm
                   </button>
                </div>
              </div>
            </div>
        </div>
      </Card>

      <Card title="⚖️ Dividend Strategy" subtitle="How surplus is distributed to members">
         <div className="p-5">
            <div className="flex bg-[var(--surface2)] p-1 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
              <button onClick={() => setRules(r => ({...r, dividend_rule: 'equal_split'}))}
                className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1", rules.dividend_rule === 'equal_split' ? 'bg-[var(--surface)] shadow-md border' : 'opacity-40')}>
                <span>Equal Split</span>
                <span className="text-[9px] opacity-40">Default Logic</span>
              </button>
              <button onClick={() => setRules(r => ({...r, dividend_rule: 'proportional'}))}
                className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1", rules.dividend_rule === 'proportional' ? 'bg-[var(--surface)] shadow-md border' : 'opacity-40')}>
                <span>Proportional</span>
                <span className="text-[9px] opacity-40">Contribution Based</span>
              </button>
            </div>
         </div>
      </Card>

      <Card title="🧪 Live Simulator" subtitle="Real-time preview of how these rules apply">
        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest opacity-50 block mb-2">
              Simulated {group.auction_scheme === 'DIVIDEND' ? 'Winning Bid' : 'Discount Bid'} (₹)
            </label>
            <input type="number" className="w-full px-4 py-3 rounded-2xl border text-xl font-black outline-none mb-3"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              value={testBid} onChange={e => setTestBid(e.target.value)} />
            
            {preview && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                <div className="p-4 rounded-2xl border bg-red-500/5 transition-all hover:shadow-lg">
                  <div className="text-[9px] font-black uppercase opacity-40 mb-1">Total Discount</div>
                  <div className="text-lg font-black text-red-500">{fmt(preview.discount)}</div>
                </div>
                <div className="p-4 rounded-2xl border bg-[var(--accent-dim)] transition-all hover:shadow-lg">
                  <div className="text-[9px] font-black uppercase opacity-40 mb-1">Commission</div>
                  <div className="text-lg font-black" style={{ color: 'var(--accent)' }}>{fmt(preview.commission_amt)}</div>
                </div>
                <div className="p-4 rounded-2xl border bg-green-500/5 transition-all hover:shadow-lg">
                  <div className="text-[9px] font-black uppercase opacity-40 mb-1">Net Dividend</div>
                  <div className="text-lg font-black text-green-500">{fmt(preview.net_dividend)}</div>
                </div>
                <div className="p-4 rounded-2xl border bg-blue-500/5 transition-all hover:shadow-lg">
                  <div className="text-[9px] font-black uppercase opacity-40 mb-1">Each Pays</div>
                  <div className="text-lg font-black text-blue-500">{fmt(preview.each_pays)}</div>
                </div>
              </div>
            )}
          </div>
          
          {!isDirty && (
            <div className="pt-4 border-t flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <Database size={14} className="text-[var(--accent)]" /> 
                  Retroactive Sync
                </div>
                <div className="text-[10px] opacity-40">Apply current rules to all past auctions in this group</div>
              </div>
              <Btn variant="secondary" size="sm" onClick={recalculateLedger} loading={syncing} icon={RefreshCcw}>
                Recalculate Ledger
              </Btn>
            </div>
          )}
        </div>
      </Card>

      {/* Save Action Bar */}
      <div className={cn("sticky bottom-6 left-0 right-0 z-40 p-4 rounded-3xl border shadow-2xl transition-all flex items-center justify-between", isDirty ? "bg-[var(--surface)] border-[var(--accent)]" : "bg-[var(--surface2)] border-[var(--border)] opacity-60")}>
        <div className="hidden md:block">
           <div className="text-xs font-bold uppercase tracking-widest opacity-40">Ready to save?</div>
           <div className="text-[10px] opacity-20">Click back to discard changes</div>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-bold hover:bg-[var(--surface2)] transition-colors" onClick={() => router.push(`/groups/${groupId}`)}>Discard</button>
          <Btn variant="primary" className="flex-1 md:flex-initial shadow-lg" loading={saving} onClick={save}>
             Update Rules ✓
          </Btn>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
