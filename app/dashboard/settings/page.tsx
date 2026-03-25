'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { useToast } from '@/lib/hooks/useToast'
import { useRouter } from 'next/navigation'
import { Btn, Card, Field, Loading, Toast, Switch } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { Palette, Users, Link, LogOut, FileText, Building, Key } from 'lucide-react'
import type { Firm } from '@/types'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { firm, can, refresh, isAdmin, setFirm } = useFirm()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [regToken,  setRegToken]  = useState('')
  const [form,    setForm]    = useState<Partial<Firm>>({ name: '', address: '' })

  const load = useCallback(async () => {
    if (!firm) return
    setLoading(true)
    // Only admins can see subscription details
    const query = isAdmin() ? '*,subscriptions(*)' : '*';
    const { data } = await supabase.from('firms').select(query).eq('id', firm.id).single()
    if (data) {
      setForm({ name: data.name, address: data.address })
      setRegToken(data.register_token || '')
      if (isAdmin()) {
        setFirm(data)
      }
    }
    setLoading(false)
  }, [firm, supabase, isAdmin, setFirm])

  useEffect(() => { load() }, [load])
  
  async function handleSave() {
    if (!firm) return
    setSaving(true)
    const { data, error } = await supabase.from('firms').update({ name: form.name, address: form.address }).eq('id', firm.id).select().single()
    if (error) { showToast(error.message, 'error'); return }
    showToast('Settings saved!')
    setSaving(false)
    if(data) setFirm(data)
  }

  async function updatePlan(plan: 'basic' | 'pro', isPerpetual: boolean) {
    if (!firm || !confirm(`Switch this firm to the ${isPerpetual ? 'Perpetual' : 'Annual'} ${plan.toUpperCase()} plan?`)) return

    const newExpiry = isPerpetual ? new Date('2200-01-01') : new Date(new Date().setFullYear(new Date().getFullYear() + 1));

    const { error } = await supabase.from('subscriptions').upsert({
      firm_id: firm.id,
      plan_name: plan,
      status: 'active',
      expiry_date: newExpiry.toISOString(),
    }, { onConflict: 'firm_id' })
    
    if (error) { showToast(error.message, 'error'); return }
    showToast('Plan updated successfully!')
    refresh()
  }
  
  async function handleLogout() {
    showToast('Logging out...')
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading || !firm) return <Loading />

  const sub = firm.subscriptions
  const planName = sub?.plan_name || 'None'
  const isExpired = sub ? new Date(sub.expiry_date) < new Date() : true
  const isPerpetual = sub ? new Date(sub.expiry_date).getFullYear() > 2100 : false

  async function genRegToken() {
    if (!firm) return
    const token = crypto.randomUUID()
    const { error } = await supabase.from('firms').update({ register_token: token }).eq('id', firm.id)
    if (error) { showToast(error.message, 'error'); return }
    setRegToken(token)
    showToast('New link generated!')
  }

  async function revokeRegToken() {
    if (!firm || !confirm('Revoke this registration link? Existing staff won\'t be affected.')) return
    await supabase.from('firms').update({ register_token: null }).eq('id', firm.id)
    setRegToken('')
    showToast('Link revoked.')
  }

  const regLink = regToken ? `${typeof window !== 'undefined' ? window.location.origin : ''}/register?token=${regToken}` : null

  return (
    <div className="max-w-2xl space-y-4">

      {/* ── Firm Details ─────────────────────────────────── */}
      {can('viewSettings') && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Building size={15} /> Firm Details
          </div>
          <div className="p-5 space-y-4">
            <Field label="Firm Name">
              <input className={inputClass} style={inputStyle} value={form.name || ''} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </Field>
            <Field label="Address / Location">
              <input className={inputClass} style={inputStyle} value={form.address || ''} onChange={e => setForm(f => ({...f, address: e.target.value}))} />
            </Field>
          </div>
          <div className="px-5 py-3 border-t flex justify-end" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <Btn variant="primary" onClick={handleSave} loading={saving} disabled={!can('editSettings')}>Save Changes</Btn>
          </div>
        </Card>
      )}
      
      {/* ── Subscription ─────────────────────────────────── */}
      {isAdmin() && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Key size={15} /> Subscription
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between">
                <div>
                    <div className="font-semibold">
                        <span className="px-2 py-1 text-xs rounded-full mr-2" style={{ background: isPerpetual ? 'var(--gold-dim)' : isExpired ? 'var(--red-dim)':'var(--green-dim)', color: isPerpetual ? 'var(--gold)' : isExpired ? 'var(--red)':'var(--green)' }}>
                            {isPerpetual ? 'Perpetual' : isExpired ? 'Expired' : 'Active'}
                        </span>
                         {planName.charAt(0).toUpperCase() + planName.slice(1)} Plan
                    </div>
                    <div className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                      {isPerpetual ? 'Lifetime access' : `Expires on ${new Date(sub?.expiry_date || '').toLocaleDateString()}`}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Btn variant="secondary" size="sm" onClick={() => updatePlan('basic', false)}>Set Basic</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => updatePlan('pro', false)}>Set Pro</Btn>
                    <Btn style={{ background: 'var(--gold-dim)', color: 'var(--gold)'}} size="sm" onClick={() => updatePlan('pro', true)}>Set Perpetual</Btn>
                </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Branding ─────────────────────────────────────── */}
      {can('viewSettings') && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Palette size={15} /> Branding & Appearance
          </div>
          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between">
              <label htmlFor="d-mode" className="font-medium text-sm">Enable Dark Mode</label>
              <Switch id="d-mode" />
            </div>
          </div>
        </Card>
      )}

      {/* ── Staff Management ──────────────────────────────── */}
      {can('viewSettings') && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Users size={15} /> Staff Management
          </div>
          <div className="p-5">
            <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
              Invite staff to your firm. They can manage groups and collect payments.
            </p>
            <Btn variant="secondary" onClick={() => router.push('/staff')}>Manage Staff</Btn>
          </div>
        </Card>
      )}

      {/* ── Registration Link ─────────────────────────────── */}
      {can('viewSettings') && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center gap-2 font-semibold text-sm"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            <Link size={15} /> Private Registration Link
          </div>
          <div className="p-5">
            <p className="text-sm mb-4" style={{ color: 'var(--text2)' }}>
              Share this link with new staff. They can create an account and automatically join your firm. Revoke it anytime.
            </p>
            {regLink ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input className={inputClass} style={{ ...inputStyle, fontSize: 12, fontFamily: 'monospace' }}
                    value={regLink} readOnly />
                  <Btn variant="secondary" onClick={() => { navigator.clipboard.writeText(regLink); showToast('Copied!') }}>Copy</Btn>
                </div>
                <Btn variant="danger" size="sm" onClick={revokeRegToken}>Revoke Link</Btn>
              </div>
            ) : (
              <Btn variant="primary" onClick={genRegToken}>Generate Link</Btn>
            )}
          </div>
        </Card>
      )}
      
      {/* ── Logout ────────────────────────────────────────── */}
      <Card className="overflow-hidden">
         <div className="p-4 flex items-center justify-between">
            <div>
                <h3 className="font-semibold text-sm">Logout</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>You will be returned to the login screen.</p>
            </div>
            <Btn variant="danger" onClick={handleLogout}><LogOut size={14} /> Logout</Btn>
         </div>
      </Card>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
