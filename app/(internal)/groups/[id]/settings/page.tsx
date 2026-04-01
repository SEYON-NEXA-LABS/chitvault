'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt } from '@/lib/utils'
import { Btn, Card, Loading, Toast } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Info, Settings2, Gavel, ArrowLeft } from 'lucide-react'
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

  async function livePreview(bid: string) {
    setTestBid(bid)
    if (!bid || !group) return
    const { data } = await supabase.rpc('calculate_auction', {
      p_group_id:   groupId,
      p_bid_amount: +bid
    })
    setPreview(data)
  }

  async function save() {
    if (!firm) return
    setSaving(true)
    const { error } = await supabase.from('groups').update(rules).eq('id', groupId).eq('firm_id', firm.id)
    setSaving(false)
    if (error) { show(error.message, 'error'); return }
    show('Auction rules saved! ✓')
    setGroup(g => g ? { ...g, ...rules } : g)
  }

  if (loading) return <Loading />
  if (!group)  return null

  const minBid = Math.round(group.chit_value * rules.min_bid_pct)
  const maxBid = Math.round(group.chit_value * rules.max_bid_pct)

  return (
    <div className="space-y-6 max-w-2xl pb-10">
      
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push(`/groups/${groupId}`)} className="p-2.5 rounded-xl hover:bg-[var(--surface2)] transition-colors border" style={{ borderColor: 'var(--border)' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
             <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-50 mb-1">
               <Settings2 size={12} /> Group Settings
             </div>
             <h1 className="text-2xl font-bold">{group.name} — Execution Rules</h1>
          </div>
        </div>
        <Btn onClick={() => router.push(`/groups/${groupId}`)} icon={Gavel}>View Ledger</Btn>
      </div>

      <Card title="🎯 Bid Limits" subtitle="Floor and ceiling for auction bidding">
        <div className="p-5 space-y-5">
           <div className="p-3 rounded-xl text-sm flex gap-2"
            style={{ background: 'rgba(91,138,245,0.07)', border: '1px solid rgba(91,138,245,0.2)', color: 'var(--info)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Bid limits control the lowest and highest amount a member can bid.
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Minimum Bid (Floor)</label>
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>
                {Math.round(rules.min_bid_pct * 100)}% = {fmt(minBid)}
              </span>
            </div>
            <input type="range" min="50" max="100" step="1" 
              value={Math.round(rules.min_bid_pct * 100)} 
              onChange={e => setRules(r => ({...r, min_bid_pct: +e.target.value / 100}))}
              className="w-full" style={{ accentColor: 'var(--accent)' }} />
          </div>
        </div>
      </Card>

      <Card title="👑 Foreman Commission" subtitle="How your commission is calculated each month">
        <div className="p-5 space-y-5">
           <div className="grid grid-cols-1 gap-2">
              {(Object.entries(CTL) as [CommissionType, string][]).map(([type, label]) => (
                <button key={type} onClick={() => setRules(r => ({...r, commission_type: type}))}
                  className="text-left px-4 py-3 rounded-xl border transition-all"
                  style={{ 
                    borderColor: rules.commission_type === type ? 'var(--accent)' : 'var(--border)',
                    background:  rules.commission_type === type ? 'rgba(201,168,76,0.08)' : 'var(--surface2)',
                  }}>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${rules.commission_type === type ? 'var(--accent)' : 'var(--border)'}`, background: rules.commission_type === type ? 'var(--accent)' : 'transparent' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
                  </div>
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-sm font-semibold">Value</label>
                <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>
                  {rules.commission_type === 'fixed_amount' ? fmt(rules.commission_value) : `${rules.commission_value}%`}
                </span>
              </div>
              <input type="number" value={rules.commission_value}
                onChange={e => setRules(r => ({...r, commission_value: +e.target.value}))}
                className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
        </div>
      </Card>

      <Card title="🧪 Test Auction" subtitle="Preview how these rules will affect calculations">
        <div className="p-5 space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest opacity-50 block mb-2">Simulated Bid Amount (₹)</label>
            <input type="number" className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none mb-3"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }}
              value={testBid} onChange={e => livePreview(e.target.value)} />
            
            {preview && (
              <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
                <div>
                  <div className="text-[10px] uppercase opacity-50 mb-1">Total Discount</div>
                  <div className="text-sm font-bold text-danger-500">{fmt(preview.discount)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase opacity-50 mb-1">Your Commission</div>
                  <div className="text-sm font-bold text-accent-500" style={{ color: 'var(--accent)' }}>{fmt(preview.commission_amt)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase opacity-50 mb-1">Total Dividend</div>
                  <div className="text-sm font-bold text-success-500">{fmt(preview.net_dividend)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase opacity-50 mb-1">Each Member Pays</div>
                  <div className="text-sm font-bold text-info-500">{fmt(preview.each_pays)}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Save */}
      <div className="flex gap-3 pt-4">
        <Btn variant="secondary" onClick={() => router.push(`/groups/${groupId}`)}>Back to Ledger</Btn>
        <Btn variant="primary" loading={saving} onClick={save}>
          Save Auction Rules
        </Btn>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
