'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fmt, cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { Btn, Card, Loading, Toast } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Info, Settings2, Gavel, ArrowLeft, RefreshCw, Database, AlertTriangle, ShieldCheck, Calculator, TrendingUp } from 'lucide-react'
import type { GroupWithRules, CommissionType } from '@/types'
import { COMMISSION_TYPE_LABELS as CTL } from '@/types'
import { useFirm } from '@/lib/firm/context'
import { 
  calculatePot, 
  calculateForemanCommission, 
  calculateDistribution, 
  calculateNetInstallment
} from '@/lib/utils/chit-calculations'
import { inputClass, inputStyle } from '@/components/ui'

export default function GroupSettingsPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const { firm } = useFirm()
  const { t }    = useI18n()
  const { toast, show, hide } = useToast()

  const groupId = Number(params.id)

  const [group,          setGroup]          = useState<GroupWithRules | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [syncing,        setSyncing]        = useState(false)
  const [preview,        setPreview]        = useState<any>(null)
  const [testBid,        setTestBid]        = useState('')

  const [auctionsDone, setAuctionsDone] = useState(0)
  const [memberCount, setMemberCount] = useState(0)

  const [core, setCore] = useState({
    name: '',
    chit_value: 0,
    num_members: 0,
    duration: 0,
    monthly_contribution: 0,
    start_date: ''
  })

  // Form state mirrors group columns
  const [rules, setRules] = useState({
    min_bid_pct:          0.70,
    max_bid_pct:          1.00,
    discount_cap_pct:     1.00,
    commission_type:      'percent_of_chit' as CommissionType,
    commission_value:     5.00,
    commission_recipient: 'foreman' as 'foreman'|'firm',
    dividend_rule:        'equal_split' as 'equal_split'|'proportional',
    dividend_split_pct:   0.50,
    surplus_split_pct:    0.50,
    step_amount:          0,
    dividend_strategy:    'pro_n' as 'standard' | 'pro_n1' | 'pro_n',
  })

  // Detect dirty state
  const isDirty = group && (
    rules.min_bid_pct !== (group.min_bid_pct ?? 0.70) ||
    rules.max_bid_pct !== (group.max_bid_pct ?? 1.00) ||
    rules.commission_type !== (group.commission_type ?? 'percent_of_chit') ||
    rules.commission_value !== (group.commission_value ?? 5.00) ||
    rules.commission_recipient !== (group.commission_recipient ?? 'foreman') ||
    rules.dividend_rule !== (group.dividend_rule ?? 'equal_split') ||
    rules.dividend_strategy !== (group.dividend_strategy ?? 'standard') ||
    core.name !== group.name ||
    Number(core.chit_value) !== Number(group.chit_value) ||
    Number(core.num_members) !== Number(group.num_members) ||
    Number(core.duration) !== Number(group.duration) ||
    Number(core.monthly_contribution) !== Number(group.monthly_contribution) ||
    core.start_date !== group.start_date
  )

  useEffect(() => {
    async function load() {
      if (!firm) return
      const fields = 'id, name, chit_value, num_members, duration, monthly_contribution, start_date, status, auction_scheme, min_bid_pct, max_bid_pct, discount_cap_pct, commission_type, commission_value, commission_recipient, dividend_rule, dividend_strategy'
      const [gRes, aCountRes, mCountRes] = await Promise.all([
        supabase.from('groups').select(fields).eq('id', groupId).eq('firm_id', firm.id).single(),
        supabase.from('auctions').select('id', { count: 'exact', head: true }).eq('group_id', groupId).eq('status', 'confirmed').eq('firm_id', firm.id),
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('group_id', groupId).is('deleted_at', null).eq('firm_id', firm.id)
      ])

      if (!gRes.data) { router.push('/groups'); return }
      
      const data = gRes.data
      setGroup(data)
      setAuctionsDone(aCountRes.count || 0)
      setMemberCount(mCountRes.count || 0)

      setCore({
        name: data.name,
        chit_value: Number(data.chit_value),
        num_members: Number(data.num_members),
        duration: Number(data.duration),
        monthly_contribution: Number(data.monthly_contribution),
        start_date: data.start_date
      })

      setRules({
        min_bid_pct:          data.min_bid_pct          ?? 0.70,
        max_bid_pct:          data.max_bid_pct          ?? 1.00,
        discount_cap_pct:     data.discount_cap_pct     ?? 1.00,
        commission_type:      data.commission_type      ?? 'percent_of_chit',
        commission_value:     data.commission_value     ?? 5.00,
        commission_recipient: data.commission_recipient ?? 'foreman',
        dividend_rule:        data.dividend_rule        ?? 'equal_split',
        dividend_split_pct:   data.dividend_split_pct    ?? 0.50,
        surplus_split_pct:    data.surplus_split_pct     ?? 0.50,
        step_amount:          data.step_amount           ?? 0,
        dividend_strategy:    data.dividend_strategy     ?? 'pro_n',
      })
      setTestBid(String(Math.round(data.chit_value * 0.85)))
      setLoading(false)
    }
    load()
  }, [firm, groupId, router, supabase])

  // Smart Simulator - Passes local rules to verify math before saving
  const calculatePreview = useCallback(async (bid: number) => {
    if (!group) return
    
    try {
      const pot = calculatePot(group.num_members, group.monthly_contribution);
      
      const commType = rules.commission_type === 'percent_of_chit' ? 'POT_PERCENTAGE' :
                       rules.commission_type === 'percent_of_discount' ? 'DISCOUNT_PERCENTAGE' :
                       rules.commission_type === 'percent_of_payout' ? 'PAYOUT_PERCENTAGE' : 'FIXED_AMOUNT';
                       
      const commRate = commType === 'FIXED_AMOUNT' ? 0 : Number(rules.commission_value) / 100;
      const fixedAmount = commType === 'FIXED_AMOUNT' ? Number(rules.commission_value) : 0;

      const isDivShare = group.auction_scheme === 'DIVIDEND_SHARE';
      const effDiscount = isDivShare ? (pot - bid) : bid;
      
      const commission = calculateForemanCommission(pot, effDiscount, commType, commRate, fixedAmount);
      
      const config = {
        dividendSplitPct: Number(rules.dividend_split_pct),
        surplusSplitPct: Number(rules.surplus_split_pct),
        stepAmount: Number(rules.step_amount)
      };
      
      const effStrategy = rules.dividend_strategy;
      const commissionStrategy = effStrategy.startsWith('pro_') ? 'deduct_from_payout' : 'deduct_from_dividend';
      
      const dist = calculateDistribution(group.auction_scheme as any, group.num_members, effDiscount, commission, config, commissionStrategy);
      
      // Handle N vs N-1 divisor
      if (effStrategy === 'pro_n1' && group.num_members > 1) {
        dist.dividendPerMember = dist.dividendPool / (group.num_members - 1);
      } else {
        dist.dividendPerMember = dist.dividendPool / group.num_members;
      }

      const netInstallment = calculateNetInstallment(group.monthly_contribution, dist.dividendPerMember, group.auction_scheme as any);
      
      setPreview({
        discount: effDiscount,
        commission_amt: commission,
        net_dividend: dist.dividendPool,
        each_pays: netInstallment
      });
    } catch (error: any) {
      console.error("Preview Error:", error.message)
    }
  }, [group, rules])

  useEffect(() => {
     if (testBid && !isNaN(+testBid)) calculatePreview(+testBid)
  }, [testBid, calculatePreview])

  async function save() {
    if (!firm || !group) return
    
    if (core.num_members < memberCount) {
      show(`Total members cannot be less than current enrolled members (${memberCount})`, 'error')
      return
    }

    setSaving(true)
    
    const isPercentType = ['percent_of_chit', 'percent_of_discount', 'percent_of_payout'].includes(rules.commission_type)
    const limit = isPercentType ? 5 : (core.chit_value * 0.05)
    
    if (rules.commission_value > limit) {
      show(`Legal limit exceeded: Maximum allowed commission is ${isPercentType ? '5%' : fmt(limit)}.`, 'error')
      setSaving(false)
      return
    }

    const updatePayload = {
      ...rules,
      name: core.name,
      chit_value: Number(core.chit_value),
      num_members: Number(core.num_members),
      duration: Number(core.duration),
      monthly_contribution: Number(core.monthly_contribution),
      start_date: core.start_date
    }

    const { error } = await supabase.from('groups').update(updatePayload).eq('id', groupId).eq('firm_id', firm.id)
    
    setSaving(false)
    if (error) { 
      show(error.message || 'Failed to save settings', 'error')
      return 
    }
    
    show('Group settings updated! ✓', 'success')
    setGroup(g => g ? { ...g, ...updatePayload } : g)
    router.refresh()
    setTimeout(() => router.push('/groups'), 1000)
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
    <>
      <div className="flex items-center justify-between border-b pb-2 mb-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push(`/groups/${groupId}`)} className="p-2 rounded-lg bg-[var(--surface2)] border border-[var(--border)] hover:border-slate-900 transition-all shadow-sm">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--text2)] mb-0.5">
              <Settings2 size={10} /> Execution Settings
            </div>
            <h1 className="text-2xl font-extrabold text-[var(--text)] tracking-tight leading-none">{group?.name}</h1>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Btn variant="secondary" size="sm" onClick={() => router.push(`/groups/${groupId}`)} icon={Gavel}>View Ledger</Btn>
          <Btn variant="primary" size="sm" onClick={save} loading={saving} icon={ShieldCheck}>Save Changes</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Core Financials */}
        <div className="space-y-4">
          <Card title="General Details" padding={true}>
            {auctionsDone > 0 && (
              <div className="p-3 rounded-lg text-[11px] flex gap-2 mb-4 bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <div className="font-medium leading-tight">Financials locked due to existing auctions.</div>
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--text2)]">Group Name</label>
                <input className={inputClass} style={inputStyle} value={core.name} onChange={e => setCore(c => ({ ...c, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text2)]">Chit Value (₹)</label>
                  <input className={inputClass} style={inputStyle} type="number" value={core.chit_value} disabled={auctionsDone > 0} onChange={e => setCore(c => ({ ...c, chit_value: +e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text2)]">Monthly Due (₹)</label>
                  <input className={inputClass} style={inputStyle} type="number" value={core.monthly_contribution} disabled={auctionsDone > 0} onChange={e => setCore(c => ({ ...c, monthly_contribution: +e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text2)]">Duration (Months)</label>
                  <input className={inputClass} style={inputStyle} type="number" value={core.duration} disabled={auctionsDone > 0} onChange={e => setCore(c => ({ ...c, duration: +e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text2)]">Start Date</label>
                  <input className={inputClass} style={inputStyle} type="date" value={core.start_date} disabled={auctionsDone > 0} onChange={e => setCore(c => ({ ...c, start_date: e.target.value }))} />
                </div>
              </div>
            </div>
          </Card>

          <Card title="Foreman Commission" padding={true}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text2)]">Calculation Mode</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.entries(CTL) as [CommissionType, string][]).map(([type, label]) => (
                    <button key={type} onClick={() => setRules(r => ({...r, commission_type: type}))}
                      className={cn("text-left px-2 py-1.5 rounded border transition-all text-[11px] font-medium leading-tight", 
                        rules.commission_type === type ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--surface2)] opacity-70')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text2)]">Rate/Value</label>
                  <input type="number" value={rules.commission_value} className={inputClass} style={inputStyle}
                    onChange={e => setRules(r => ({...r, commission_value: +e.target.value}))} />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text2)]">Recipient</label>
                  <div className="flex bg-[var(--surface2)] p-0.5 rounded border border-[var(--border)]">
                    <button onClick={() => setRules(r => ({...r, commission_recipient: 'foreman'}))}
                      className={cn("flex-1 py-1 rounded text-[10px] font-bold transition-all", rules.commission_recipient === 'foreman' ? 'bg-white shadow-sm' : 'opacity-40')}>
                      Foreman
                    </button>
                    <button onClick={() => setRules(r => ({...r, commission_recipient: 'firm'}))}
                      className={cn("flex-1 py-1 rounded text-[10px] font-bold transition-all", rules.commission_recipient === 'firm' ? 'bg-white shadow-sm' : 'opacity-40')}>
                      Firm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Column 2: Strategy & Reconciliation */}
        <div className="space-y-4">
          <Card title="Auction & Dividend Rules" padding={true}>
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-[var(--text2)]">Min Bid Floor</label>
                  <span className="text-[11px] font-bold text-[var(--accent)]">{Math.round(rules.min_bid_pct * 100)}%</span>
                </div>
                <input type="range" min="0" max="40" step="0.5" value={rules.min_bid_pct * 100} onChange={e => setRules(r => ({...r, min_bid_pct: +e.target.value / 100}))}
                  className="w-full h-1.5 bg-[var(--surface3)] rounded-lg appearance-none cursor-pointer accent-[var(--accent)]" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-[var(--text2)]">Max Bid Cap</label>
                  <span className="text-[11px] font-bold text-red-500">{Math.round(rules.max_bid_pct * 100)}%</span>
                </div>
                <input type="range" min="0" max="100" step="1" value={rules.max_bid_pct * 100} onChange={e => setRules(r => ({...r, max_bid_pct: +e.target.value / 100}))}
                  className="w-full h-1.5 bg-[var(--surface3)] rounded-lg appearance-none cursor-pointer accent-red-500" />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[var(--text2)]">Dividend Strategy</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setRules(r => ({...r, dividend_strategy: 'standard'}))}
                    className={cn("text-left px-2 py-2 rounded-lg border transition-all", 
                      rules.dividend_strategy === 'standard' ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] bg-[var(--surface2)] opacity-70')}>
                    <div className="font-bold text-[10px]">Standard (N)</div>
                    <div className="text-[8px] opacity-60 leading-tight">Comm from Pool<br/>Split by All</div>
                  </button>
                  <button onClick={() => setRules(r => ({...r, dividend_strategy: 'pro_n1'}))}
                    className={cn("text-left px-2 py-2 rounded-lg border transition-all", 
                      rules.dividend_strategy === 'pro_n1' ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] bg-[var(--surface2)] opacity-70')}>
                    <div className="font-bold text-[10px]">Professional (N-1)</div>
                    <div className="text-[8px] opacity-60 leading-tight">Comm from Winner<br/>Split by Non-Winners</div>
                  </button>
                  <button onClick={() => setRules(r => ({...r, dividend_strategy: 'pro_n'}))}
                    className={cn("text-left px-2 py-2 rounded-lg border transition-all", 
                      rules.dividend_strategy === 'pro_n' ? 'border-[var(--accent)] bg-[var(--accent-dim)]' : 'border-[var(--border)] bg-[var(--surface2)] opacity-70')}>
                    <div className="font-bold text-[10px]">Winner Pays (N)</div>
                    <div className="text-[8px] opacity-60 leading-tight">Comm from Winner<br/>Split by All</div>
                  </button>
                </div>
              </div>

            </div>
          </Card>

          <Card title="Data Sync" padding={true}>
            <div className="space-y-3">
              <p className="text-[11px] text-[var(--text3)] leading-tight">Rules only affect future auctions. Sync past records retroactively if needed.</p>
              <Btn variant="secondary" size="sm" className="w-full text-xs font-bold" icon={RefreshCw} onClick={recalculateLedger} loading={syncing}>
                Sync Historical Ledger
              </Btn>
            </div>
          </Card>
        </div>

        {/* Column 3: Live Simulator */}
        <div className="space-y-4">
          <Card title="Rule Simulator" className="border-[var(--accent)]/30 bg-blue-50/10">
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[var(--text2)]">Simulated Winning Bid (₹)</label>
                <input type="number" className={cn(inputClass, "text-lg font-extrabold tracking-tight")} style={inputStyle} value={testBid} onChange={e => setTestBid(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border bg-white space-y-1">
                  <div className="text-[9px] font-bold text-[var(--text3)] leading-none">Total Discount</div>
                  <div className="text-sm font-extrabold text-red-500">{fmt(preview?.discount || 0)}</div>
                </div>
                <div className="p-3 rounded-lg border bg-white space-y-1">
                  <div className="text-[9px] font-bold text-[var(--text3)] leading-none">Foreman Comm.</div>
                  <div className="text-sm font-extrabold text-[var(--accent)]">{fmt(preview?.commission_amt || 0)}</div>
                </div>
                <div className="p-3 rounded-lg border bg-white space-y-1">
                  <div className="text-[9px] font-bold text-[var(--text3)] leading-none">Net Dividend</div>
                  <div className="text-sm font-extrabold text-green-600">{fmt(preview?.net_dividend || 0)}</div>
                </div>
                <div className="p-3 rounded-lg border bg-white space-y-1">
                  <div className="text-[9px] font-bold text-[var(--text3)] leading-none">Each Pays</div>
                  <div className="text-sm font-extrabold text-blue-600">{fmt(preview?.each_pays || 0)}</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/10">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--accent)] mb-1">
                  <Calculator size={10} /> Calculation Logic
                </div>
                <div className="text-[11px] font-bold text-[var(--text2)] leading-tight">
                  Benefit = {rules.dividend_strategy === 'standard' ? '(Bid - Comm)' : 'Bid'} / ({group?.num_members}{rules.dividend_strategy === 'pro_n1' ? ' - 1' : ''})
                </div>
              </div>

              <Btn variant="primary" className="w-full h-10 text-xs font-bold shadow-lg shadow-blue-500/10" onClick={save} loading={saving}>
                Confirm & Save Changes
              </Btn>
            </div>
          </Card>

          {isDirty && (
            <div className="p-4 rounded-xl bg-orange-50 border border-orange-100 flex items-center gap-2 animate-pulse">
              <AlertTriangle className="text-orange-500" size={16} />
              <span className="text-[11px] font-bold text-orange-700">Unsaved configuration detected</span>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className={cn("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 p-2 rounded-2xl border shadow-2xl transition-all flex items-center gap-4 bg-white/80 backdrop-blur-md", isDirty ? "border-[var(--accent)] scale-100" : "border-[var(--border)] scale-90 opacity-0 pointer-events-none")}>
        <div className="px-4 border-r pr-6">
           <div className="text-[11px] font-bold text-orange-600">Unsaved Changes</div>
           <div className="text-[9px] opacity-40">Configuration logic has been modified</div>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-[11px] font-bold hover:bg-slate-50 transition-colors" onClick={() => router.push(`/groups/${groupId}`)}>Discard</button>
          <Btn variant="primary" size="sm" className="shadow-lg px-6" loading={saving} onClick={save}>
             Apply Settings ✓
          </Btn>
        </div>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </>
  )
}
