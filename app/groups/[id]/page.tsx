'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt } from '@/lib/utils'
import { Btn, Card, Loading, Toast } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { ArrowLeft, Info } from 'lucide-react'
import type { GroupWithRules, CommissionType } from '@/types'
import { COMMISSION_TYPE_LABELS as CTL } from '@/types'

export default function GroupRulesPage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const { firm } = useFirm()
  const { toast, show, hide } = useToast()

  const groupId = Number(params.id)

  const [group,   setGroup]   = useState<GroupWithRules | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [preview, setPreview] = useState<any>(null)
  const [testBid, setTestBid] = useState('')

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
      p_group_id:  groupId,
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
    <div className="max-w-2xl">
      {/* ── Bid Limits ──────────────────────────────────── */}
      <Card className="overflow-hidden mb-4">
        <div className="px-5 py-4 border-b font-semibold text-sm flex items-center gap-2"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          🎯 Bid Limits
        </div>
        <div className="p-5 space-y-5">
          <div className="p-3 rounded-xl text-sm flex gap-2"
            style={{ background: 'rgba(91,138,245,0.07)', border: '1px solid rgba(91,138,245,0.2)', color: 'var(--blue)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Bid limits control the lowest and highest amount a member can bid to win the auction. A floor prevents deep discounts; the ceiling is always 100%.
          </div>

          {/* Min bid slider */}
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Minimum Bid (Floor)</label>
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--gold)' }}>
                {Math.round(rules.min_bid_pct * 100)}% = {fmt(minBid)}
              </span>
            </div>
            <input type="range" min="50" max="100" step="1"
              value={Math.round(rules.min_bid_pct * 100)}
              onChange={e => setRules(r => ({...r, min_bid_pct: +e.target.value / 100}))}
              className="w-full" style={{ accentColor: 'var(--gold)' }} />
            <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text3)' }}>
              <span>50% = {fmt(group.chit_value * 0.5)}</span>
              <span>100% = No discount allowed</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Foreman Commission ──────────────────────────── */}
      <Card className="overflow-hidden mb-4">
        <div className="px-5 py-4 border-b font-semibold text-sm flex items-center gap-2"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          👑 Foreman Commission
        </div>
        <div className="p-5 space-y-5">
          <div className="p-3 rounded-xl text-sm flex gap-2"
            style={{ background: 'rgba(201,168,76,0.07)', border: '1px solid rgba(201,168,76,0.2)', color: 'var(--gold)' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            Commission is deducted from the discount before dividing the dividend among members. It can be paid to the foreman member or kept by the firm.
          </div>

          {/* Commission type */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text2)' }}>Commission Type</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(CTL) as [CommissionType, string][]).map(([type, label]) => (
                <button key={type} onClick={() => setRules(r => ({...r, commission_type: type}))}
                  className="text-left px-4 py-3 rounded-xl border transition-all"
                  style={{
                    borderColor: rules.commission_type === type ? 'var(--gold)' : 'var(--border)',
                    background:  rules.commission_type === type ? 'rgba(201,168,76,0.08)' : 'var(--surface2)',
                  }}>
                  <div className="flex items-center gap-2">
                    <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${rules.commission_type === type ? 'var(--gold)' : 'var(--border)'}`, background: rules.commission_type === type ? 'var(--gold)' : 'transparent' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
                  </div>
                  {type === 'percent_of_chit' && (
                    <div className="text-xs mt-1.5 ml-6" style={{ color: 'var(--text3)' }}>
                      e.g. 5% → {fmt(group.chit_value * (rules.commission_value/100))} every month regardless of bid
                    </div>
                  )}
                  {type === 'percent_of_discount' && (
                    <div className="text-xs mt-1.5 ml-6" style={{ color: 'var(--text3)' }}>
                      e.g. 5% of discount → varies with each auction bid
                    </div>
                  )}
                  {type === 'fixed_amount' && (
                    <div className="text-xs mt-1.5 ml-6" style={{ color: 'var(--text3)' }}>
                      e.g. {fmt(500)} flat every month no matter what
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Commission value */}
          <div>
            <div className="flex justify-between mb-1.5">
              <label className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {rules.commission_type === 'fixed_amount' ? 'Fixed Amount (₹)' : 'Commission Rate (%)'}
              </label>
              <span className="text-sm font-mono font-bold" style={{ color: 'var(--gold)' }}>
                {rules.commission_type === 'fixed_amount'
                  ? fmt(rules.commission_value)
                  : `${rules.commission_value}%`}
              </span>
            </div>
            <input
              type="number" min="0"
              max={rules.commission_type === 'fixed_amount' ? undefined : 50}
              step={rules.commission_type === 'fixed_amount' ? 100 : 0.5}
              value={rules.commission_value}
              onChange={e => setRules(r => ({...r, commission_value: +e.target.value}))}
              className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
          </div>

          {/* Commission recipient */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide block mb-2" style={{ color: 'var(--text2)' }}>Commission Goes To</label>
            <div className="flex gap-3">
              {([['foreman','👑 Foreman Member'], ['firm','🏦 Firm / Foreman (Business)']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setRules(r => ({...r, commission_recipient: val}))}
                  className="flex-1 py-3 rounded-xl border text-sm font-medium transition-all"
                  style={{
                    borderColor: rules.commission_recipient === val ? 'var(--gold)' : 'var(--border)',
                    background:  rules.commission_recipient === val ? 'rgba(201,168,76,0.08)' : 'var(--surface2)',
                    color:       rules.commission_recipient === val ? 'var(--gold)' : 'var(--text2)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Live Calculator ─────────────────────────────── */}
      <Card className="overflow-hidden mb-4">
        <div className="px-5 py-4 border-b font-semibold text-sm flex items-center gap-2"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
          🧮 Live Calculator — Test Your Rules
        </div>
        <div className="p-5">
          <div className="mb-4">
            <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text2)' }}>
              Enter a Test Bid Amount (₹)
            </label>
            <div className="flex gap-2">
              <input type="number" value={testBid}
                onChange={e => livePreview(e.target.value)}
                placeholder={`Between ${fmt(minBid)} and ${fmt(maxBid)}`}
                className="flex-1 px-3 py-2.5 rounded-lg border text-sm outline-none font-mono"
                style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
            </div>
            {/* Quick bid buttons */}
            <div className="flex gap-2 mt-2">
              {[0.75, 0.80, 0.85, 0.90].map(pct => (
                <button key={pct} onClick={() => livePreview(String(Math.round(group.chit_value * pct)))}
                  className="text-xs px-3 py-1.5 rounded-full border"
                  style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>
                  {Math.round(pct * 100)}%
                </button>
              ))}
            </div>
          </div>

          {preview ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Chit Value',       value: fmt(preview.chit_value),      color: 'var(--text)'  },
                  { label: 'Winning Bid',       value: fmt(preview.bid_amount),      color: 'var(--blue)'  },
                  { label: 'Discount',          value: fmt(preview.discount),        color: 'var(--red)'   },
                  { label: 'Commission',        value: `${fmt(preview.commission_amt)} (${preview.commission_type === 'fixed_amount' ? 'fixed' : preview.commission_rate+'%'})`, color: 'var(--gold)' },
                  { label: 'Net Dividend Pool', value: fmt(preview.net_dividend),    color: 'var(--green)' },
                  { label: 'Per Member',        value: fmt(preview.per_member_div),  color: 'var(--green)' },
                ].map(r => (
                  <div key={r.label} className="rounded-xl p-3" style={{ background: 'var(--surface2)' }}>
                    <div className="text-xs mb-1" style={{ color: 'var(--text3)' }}>{r.label}</div>
                    <div className="font-mono font-bold text-base" style={{ color: r.color }}>{r.value}</div>
                  </div>
                ))}
              </div>

              {/* Each member pays breakdown */}
              <div className="rounded-xl p-4 mt-2" style={{ background: 'rgba(62,207,142,0.07)', border: '1px solid rgba(62,207,142,0.25)' }}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--green)' }}>
                  Each Member Pays This Month
                </div>
                <div className="font-mono text-2xl font-bold" style={{ color: 'var(--green)' }}>
                  {fmt(preview.each_pays)}
                </div>
                <div className="text-xs mt-1.5" style={{ color: 'var(--text3)' }}>
                  = {fmt(preview.chit_value / preview.num_members)} contribution − {fmt(preview.per_member_div)} dividend
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-sm" style={{ color: 'var(--text3)' }}>
              Enter a bid amount above to see the full breakdown
            </div>
          )}
        </div>
      </Card>

      {/* Save */}
      <div className="flex gap-3">
        <Btn variant="secondary" onClick={() => router.push('/groups')}>Cancel</Btn>
        <Btn variant="primary" loading={saving} onClick={save}>
          Save Auction Rules
        </Btn>
      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
