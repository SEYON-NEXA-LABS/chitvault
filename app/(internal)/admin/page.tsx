'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerFirm, updateFirmTheme, updateFirmDetails } from './actions'
import { Pencil, UserPlus, Link as LinkIcon, Check, Copy, Search, ExternalLink } from 'lucide-react'
import { Modal, Field, Btn, Toast } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { fmtDate } from '@/lib/utils'
import { THEMES, getTheme } from '@/lib/branding/themes'
import { PLAN_LIMITS } from '@/types'
import type { Firm } from '@/types'

interface FirmWithStats extends Firm {
  memberCount: number
  groupCount:  number
  ownerEmail:  string
}

const planColor = (plan: string) => ({
  trial: 'var(--blue)', basic: 'var(--blue)', pro: 'var(--green)'
}[plan] || 'var(--text2)')

const statusColor = (s: string) => s === 'active' ? 'var(--green)' : s === 'suspended' ? 'var(--red)' : 'var(--text2)'

export default function AdminPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text3)' }}>Loading Admin...</div>}>
      <AdminDashboard />
    </Suspense>
  )
}

function AdminDashboard() {
  const supabase = createClient()
  const [firms,   setFirms]   = useState<FirmWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [stats,   setStats]   = useState({ total: 0, trial: 0, basic: 0, pro: 0, suspended: 0 })
  const [filter,  setFilter]  = useState<'all'|'trial'|'basic'|'pro'|'suspended'>('all')
  const [search,  setSearch]  = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  
  // Activity & Revenue Stats
  const [activities, setActivities] = useState<any[]>([])
  const [revStats, setRevStats] = useState({
    setup: 0,
    amc: 0,
    hosting: 85200, // Year
    profit: 0
  })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: firmsData } = await supabase.from('firms').select('*').order('created_at', { ascending: false })
    if (!firmsData) { setLoading(false); return }

    const enriched = await Promise.all(firmsData.map(async (f: Firm) => {
      const [{ count: gCount }, { count: mCount }] = await Promise.all([
        supabase.from('groups').select('*', { count: 'exact', head: true }).eq('firm_id', f.id),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('firm_id', f.id),
      ])
      return { ...f, groupCount: gCount || 0, memberCount: mCount || 0, ownerEmail: '' }
    }))

    setFirms(enriched as any)
    
    // Calculate basic counts
    setStats({
      total:     enriched.length,
      trial:     enriched.filter(f => f.plan === 'trial').length,
      basic:     enriched.filter(f => f.plan === 'basic').length,
      pro:       enriched.filter(f => f.plan === 'pro').length,
      suspended: enriched.filter(f => f.plan_status === 'suspended').length,
    })

    // Calculate Premium Revenue Stats
    let setup = 0
    let amc = 0
    enriched.forEach(f => {
      const p = PLAN_LIMITS[f.plan as keyof typeof PLAN_LIMITS]
      if (p && f.plan !== 'trial') {
        setup += Number(p.setupFee?.replace(/[^\d]/g, '') || 0)
        amc   += Number(p.amc?.replace(/[^\d]/g, '') || 0)
      }
    })
    setRevStats({ setup, amc, hosting: 85200, profit: amc - 85200 })

    // Fetch Global Activity
    const { data: act } = await supabase.from('admin_activity').select('*').order('created_at', { ascending: false }).limit(20)
    setActivities(act || [])

    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateOpen(true)
    }
  }, [searchParams])

  async function updatePlan(firmId: string, plan: string) {
    setUpdating(firmId)
    await supabase.from('firms').update({ plan }).eq('id', firmId)
    await load(); setUpdating(null)
  }

  async function updateStatus(firmId: string, plan_status: string) {
    setUpdating(firmId)
    await supabase.from('firms').update({ plan_status }).eq('id', firmId)
    await load(); setUpdating(null)
  }

  async function updateInvoice(firmId: string, invoice_ref: string) {
    await supabase.from('firms').update({ invoice_ref: invoice_ref || null }).eq('id', firmId)
    load()
  }

  async function handleThemeChange(firmId: string, themeId: string) {
    setUpdating(firmId)
    const { error } = await updateFirmTheme(firmId, themeId)
    if (error) alert(error)
    await load()
    setUpdating(null)
  }

  const displayed = firms
    .filter(f => filter === 'all' || (filter === 'suspended' ? f.plan_status === 'suspended' : f.plan === filter))
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.city?.toLowerCase().includes(search.toLowerCase()) || f.slug.includes(search.toLowerCase()))

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [newFirm, setNewFirm] = useState({ name:'', city:'', phone:'', owner_email:'', owner_name:'', owner_pass:'', plan:'trial', theme_id:'theme1', tagline:'Chit Fund Manager', font:'Noto Sans' })
  const [createErr, setCreateErr] = useState('')

  // Edit firm state
  const [editOpen, setEditOpen] = useState(false)
  const [editingFirm, setEditingFirm] = useState<Firm | null>(null)
  const [editForm, setEditForm] = useState({ name: '', slug: '', city: '', phone: '', tagline: '', font: '' })
  
  // Quick invite state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [invitingFirm, setInvitingFirm] = useState<Firm | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'staff'|'owner'>('staff')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteSaving, setInviteSaving] = useState(false)
  const { toast, show, hide } = useToast()

  async function handleCreate() {
    if (!newFirm.name.trim()) { setCreateErr('Enter a business name.'); return }
    if (!newFirm.owner_email.trim()) { setCreateErr('Enter an owner email.'); return }
    if (!newFirm.owner_pass.trim()) { setCreateErr('Enter a password for the owner.'); return }
    if (newFirm.owner_pass.length < 6) { setCreateErr('Password must be at least 6 characters.'); return }
    if (newFirm.phone && !/^[0-9]{10}$/.test(newFirm.phone.replace(/\D/g, ''))) {
      setCreateErr('Phone number must be exactly 10 digits.'); return
    }
    setCreating(true); setCreateErr('')
    const slug = newFirm.name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
    
    const { error } = await registerFirm({ ...newFirm, slug })
    setCreating(false)
    if (error) { setCreateErr(error === 'SLUG_TAKEN' ? 'A firm with this name already exists.' : error); return }
    setCreateOpen(false)
    setNewFirm({ name:'', city:'', phone:'', owner_email:'', owner_name:'', owner_pass:'', plan:'trial', theme_id:'theme1', tagline:'Chit Fund Manager', font:'Noto Sans' })
    load()
  }

  async function handleUpdateFirm() {
    if (!editingFirm) return
    if (!editForm.name.trim()) { show('Firm name is required', 'error'); return }
    setUpdating(editingFirm.id)
    const { error } = await updateFirmDetails(editingFirm.id, {
      ...editForm,
      slug: editForm.slug.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
    })
    setUpdating(null)
    if (error) { show(error, 'error'); return }
    show('Firm details updated successfully')
    setEditOpen(false)
    load()
  }

  async function handleSendInvite() {
    if (!invitingFirm || !inviteEmail.trim()) return
    setInviteSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: inv, error } = await supabase.from('invites').insert({
      firm_id: invitingFirm.id,
      email: inviteEmail.toLowerCase().trim(),
      role: inviteRole,
      invited_by: user?.id,
      status: 'pending'
    }).select().single()

    setInviteSaving(false)
    if (error) { show(error.message, 'error'); return }
    setInviteLink(`${window.location.origin}/invite/${inv.id}`)
    show('Invitation generated!', 'success')
  }

  const fmtCurrency = (n: number) => '₹' + n.toLocaleString('en-IN')

  const sty = {
    page:    { background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'sans-serif' },
    header:  { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    card:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' },
    badge:   (color: string) => ({ display: 'inline-block', background: color + '22', color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }),
    select:  { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12, outline: 'none' } as React.CSSProperties,
    input:   { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%' } as React.CSSProperties,
  }

  return (
    <div style={sty.page}>
      <header style={sty.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'var(--blue)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>S</div>
          <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Superadmin Dashboard</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="secondary" onClick={() => window.location.href = '/'}>Back to App</Btn>
          <Btn variant="primary" onClick={() => setCreateOpen(true)}>+ Create Firm</Btn>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '30px 28px' }}>
        
        {/* Revenue Analytics Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 30 }}>
          <div style={{ ...sty.card, borderLeft: '4px solid var(--gold)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>💰 Total Startup Revenue</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)' }}>{fmtCurrency(revStats.setup)}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Total One-time Setup Fees Collected</div>
            <div style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.05, transform: 'rotate(-15deg)' }}><Copy size={80} /></div>
          </div>
          <div style={{ ...sty.card, borderLeft: '4px solid var(--green)' }}>
            <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🔄 Projected Annual AMC</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)' }}>{fmtCurrency(revStats.amc)}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Recurring Revenue from all Firms</div>
          </div>
          <div style={{ ...sty.card, borderLeft: '4px solid var(--red)' }}>
            <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>☁️ Hosting Overhead</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)' }}>{fmtCurrency(revStats.hosting)}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Railway + Supabase (Yearly Cost)</div>
          </div>
          <div style={{ ...sty.card, borderLeft: `4px solid ${revStats.profit > 0 ? 'var(--gold)' : 'var(--text3)'}`, background: revStats.profit > 0 ? 'rgba(201,168,76,0.05)' : 'var(--surface)' }}>
            <div style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>📈 Net Yearly Profit</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: revStats.profit > 0 ? 'var(--gold)' : 'var(--text)' }}>{fmtCurrency(revStats.profit)}</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Profit AFTER all expenses are paid</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, alignItems: 'start' }}>
          
          <div className="space-y-6">
            {/* Quick Stats Row */}
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Total', value: stats.total, color: 'var(--blue)' },
                { label: 'Standard', value: stats.basic, color: 'var(--blue)' },
                { label: 'Enterprise', value: stats.pro, color: 'var(--gold)' },
                { label: 'Trial', value: stats.trial, color: 'var(--text3)' },
                { label: 'Suspended', value: stats.suspended, color: 'var(--red)' },
              ].map(s => (
                <div key={s.label} style={{ ...sty.card, flex: 1, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Main Table Card */}
            <div style={{ ...sty.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['all','trial','basic','pro','suspended'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: filter === f ? 'var(--surface2)' : 'transparent', color: filter === f ? 'var(--text)' : 'var(--text3)', fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 700 : 500 }}>
                      {f === 'all' ? 'All' : f === 'basic' ? 'Standard' : f === 'pro' ? 'Enterprise' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                  <input style={{ ...sty.input, paddingLeft: 32, width: 220 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search firms..." />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Firm','City','Groups','Members','Plan','Status','Invoice Ref','Trial Ends','Joined'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>Loading application data...</td></tr>
                    ) : displayed.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: 60, textAlign: 'center', color: 'var(--text3)' }}>No firms found matching filters.</td></tr>
                    ) : (
                      displayed.map(f => (
                        <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={{ padding: '12px 14px' }}>
                            <div className="flex items-center justify-between group">
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text)' }}>{f.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{f.slug}.chitvault.app</div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingFirm(f); setEditForm({ name: f.name, slug: f.slug, city: f.city||'', phone: f.phone||'', tagline: f.tagline||'', font: f.font||'Noto Sans' }); setEditOpen(true) }} className="p-1.5 hover:bg-[var(--surface3)] rounded-md transition-colors" title="Edit">
                                  <Pencil size={12} />
                                </button>
                                <button onClick={() => { setInvitingFirm(f); setInviteOpen(true); setInviteLink(''); setInviteEmail('') }} className="p-1.5 hover:bg-[var(--surface3)] rounded-md text-[var(--blue)] transition-colors" title="Invite">
                                  <UserPlus size={12} />
                                </button>
                                <a href={`https://${f.slug}.chitvault.app`} target="_blank" className="p-1.5 hover:bg-[var(--surface3)] rounded-md text-[var(--text3)]" title="Open Link"><ExternalLink size={12} /></a>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{f.city || '—'}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--blue)' }}>{f.groupCount}</td>
                          <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--blue)' }}>{f.memberCount}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <select style={{ ...sty.select, color: planColor(f.plan) }} value={f.plan} disabled={updating === f.id} onChange={e => updatePlan(f.id, e.target.value)}>
                              <option value="trial">Trial</option>
                              <option value="basic">Standard</option>
                              <option value="pro">Enterprise</option>
                            </select>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <select style={{ ...sty.select, color: statusColor(f.plan_status) }} value={f.plan_status} disabled={updating === f.id} onChange={e => updateStatus(f.id, e.target.value)}>
                              <option value="active">Active</option>
                              <option value="suspended">Suspended</option>
                            </select>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <input style={{ ...sty.input, padding: '4px 8px', fontSize: 11 }} defaultValue={f.invoice_ref || ''} onBlur={e => updateInvoice(f.id, e.target.value)} placeholder="Ref #" />
                          </td>
                          <td style={{ padding: '12px 14px', color: 'var(--text2)', fontSize: 12 }}>{f.trial_ends ? fmtDate(f.trial_ends) : '—'}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--text3)', fontSize: 11 }}>{fmtDate(f.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Billing Guide Card */}
            <div style={sty.card}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 13, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 0.5 }}>📋 Manual Billing Guide</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="font-bold text-[var(--blue)]">1.</span>
                    <span><strong>Trial ends</strong> → Change plan to <code style={{ color: 'var(--blue)' }}>Standard</code>.</span>
                  </div>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="font-bold text-[var(--blue)]">2.</span>
                    <span><strong>Payment received</strong> → Update plan, enter <strong>Invoice Ref</strong>.</span>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="font-bold text-[var(--blue)]">3.</span>
                    <span><strong>Late Payment</strong> → Set status to <code style={{ color: 'var(--red)' }}>suspended</code>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-[var(--blue)]">4.</span>
                    <span><strong>Support</strong> → Use <strong>seyonnexalabs@gmail.com</strong> for assistance.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            {/* Activity Feed Card */}
            <div style={{ ...sty.card, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text2)' }}>⚡ Platform Activity</div>
                <div style={{ background: 'var(--blue)', color: 'white', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 4 }}>LIVE</div>
              </div>
              <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                {activities.length === 0 ? (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>No platform activity recorded.</div>
                ) : activities.map((a, i) => (
                  <div key={a.id} style={{ padding: '14px 20px', borderBottom: i === activities.length - 1 ? 'none' : '1px solid var(--border)', display: 'flex', gap: 12 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: a.event_type === 'firm_created' ? 'var(--blue-dim)' : 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 14 }}>{a.event_type === 'firm_created' ? '🏢' : '⚙️'}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                        {a.event_type === 'firm_created' ? `New Firm Registered` : a.event_type}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{a.details?.name || 'Firm'} from {a.details?.city || 'Unknown City'}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{fmtDate(a.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan Reference Sidebar */}
            <div style={sty.card}>
              <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 12, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 0.5 }}>💎 Plan Pricing</div>
              <div className="space-y-3">
                {(Object.keys(PLAN_LIMITS) as Array<keyof typeof PLAN_LIMITS>).map(p => {
                  const plan = PLAN_LIMITS[p]
                  return (
                    <div key={p} style={{ padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: planColor(p) }}>{plan.label}</div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{plan.setupFee}</div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
                        <div>{plan.groups} Groups · {plan.members} Memb</div>
                        <div style={{ color: 'var(--text2)', fontWeight: 600 }}>{plan.amc} AMC</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Modals & Toasts */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Register New Firm">
        <div style={{ display:'flex', gap:28 }}>
          <div style={{ flex: 1.2 }}>
            {createErr && <div style={{ background:'var(--red-dim)', color:'var(--red)', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:18 }}>✗ {createErr}</div>}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Business Name *">
                <input style={sty.input} value={newFirm.name} onChange={e => setNewFirm(n=>({...n, name: e.target.value}))} placeholder="e.g. Kumari Chit Funds" />
              </Field>
              <Field label="City">
                <input style={sty.input} value={newFirm.city} onChange={e => setNewFirm(n=>({...n, city: e.target.value}))} placeholder="Coimbatore" />
              </Field>
              <Field label="Owner Name">
                <input style={sty.input} value={newFirm.owner_name} onChange={e => setNewFirm(n=>({...n, owner_name: e.target.value}))} placeholder="Full Name" />
              </Field>
              <Field label="Owner Email *">
                <input style={sty.input} type="email" value={newFirm.owner_email} onChange={e => setNewFirm(n=>({...n, owner_email: e.target.value}))} placeholder="admin@email.com" />
              </Field>
              <Field label="Password *">
                <input style={sty.input} type="password" value={newFirm.owner_pass} onChange={e => setNewFirm(n=>({...n, owner_pass: e.target.value}))} placeholder="••••••" />
              </Field>
              <Field label="Phone">
                <input style={sty.input} value={newFirm.phone} onChange={e => setNewFirm(n=>({...n, phone: e.target.value.replace(/\D/g,'')}))} placeholder="10-digit mobile" maxLength={10} />
              </Field>
            </div>
            <div className="mt-6 flex gap-3">
              <Btn variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Btn>
              <Btn variant="primary" className="flex-1" loading={creating} onClick={handleCreate}>Create Firm Instance</Btn>
            </div>
          </div>
          <div style={{ flex: 1, borderLeft: '1px solid var(--border)', paddingLeft: 28 }}>
            <Field label="Initial Plan">
              <select style={{ ...sty.select, width: '100%', padding: '10px' }} value={newFirm.plan} onChange={e => setNewFirm(n=>({...n, plan: e.target.value}))}>
                <option value="trial">Trial (Free)</option>
                <option value="basic">Standard (₹19,999)</option>
                <option value="pro">Enterprise (₹39,999)</option>
              </select>
            </Field>
            <div style={{ marginTop: 24 }}>
              <label style={{ fontSize:10, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:12 }}>Selected Theme</label>
              <div className="grid grid-cols-2 gap-3">
                {THEMES.map(t => (
                  <button key={t.id} onClick={() => setNewFirm(n => ({...n, theme_id: t.id}))} 
                    style={{ padding: 10, borderRadius: 12, border: `2px solid ${newFirm.theme_id===t.id?'var(--blue)':'transparent'}`, background: 'var(--surface2)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t.name}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: t.primary }} />
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: t.accent }} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Update Firm Metadata">
        <div className="space-y-4">
          <Field label="Business Name *">
            <input style={sty.input} value={editForm.name} onChange={e => setEditForm(f=>({...f, name: e.target.value}))} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input style={sty.input} value={editForm.city} onChange={e => setEditForm(f=>({...f, city: e.target.value}))} />
            </Field>
            <Field label="Phone">
              <input style={sty.input} value={editForm.phone} onChange={e => setEditForm(f=>({...f, phone: e.target.value}))} maxLength={10} />
            </Field>
          </div>
          <Field label="Platform Subdomain">
            <div className="flex items-center gap-2">
              <input style={{ ...sty.input, color: 'var(--text3)' }} value={editForm.slug} readOnly />
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>.chitvault.app</div>
            </div>
          </Field>
          <Btn variant="primary" className="w-full mt-4" loading={updating === editingFirm?.id} onClick={handleUpdateFirm}>Save Metadata Changes</Btn>
        </div>
      </Modal>

      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title={`Invite Staff to ${invitingFirm?.name}`}>
        {!inviteLink ? (
          <div className="space-y-5">
            <Field label="Recipient Email Address">
              <input style={sty.input} type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="name@email.com" />
            </Field>
            <Field label="System Role">
              <div className="grid grid-cols-2 gap-3">
                {(['staff','owner'] as const).map(r => (
                  <button key={r} onClick={() => setInviteRole(r)}
                    className="p-4 rounded-xl border text-left transition-all"
                    style={{ borderColor: inviteRole===r?(r==='owner'?'var(--gold)':'var(--blue)'):'var(--border)', background: inviteRole===r?(r==='owner'?'rgba(201,168,76,0.08)':'var(--blue-dim)'):'var(--surface2)' }}>
                    <div className="font-bold text-sm capitalize" style={{ color: inviteRole===r?(r==='owner'?'var(--gold)':'var(--blue)'):'var(--text2)' }}>{r === 'owner' ? '👑 Owner' : '👤 Staff'}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{r === 'owner' ? 'Full administrative control' : 'Limited operational data entry'}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Btn variant="primary" className="w-full py-4" loading={inviteSaving} onClick={handleSendInvite}>Generate Access Link</Btn>
          </div>
        ) : (
          <div className="space-y-5 text-center">
            <div style={{ display: 'inline-flex', padding: 20, borderRadius: '50%', background: 'var(--green-dim)', color: 'var(--green)', fontSize: 32, marginBottom: 10 }}>✓</div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Invitation Ready!</h3>
            <p style={{ fontSize: 13, color: 'var(--text3)', margin: '4px 0 20px' }}>Send this unique link to the user to join the firm.</p>
            <div className="group relative">
              <input readOnly value={inviteLink} style={{ ...sty.input, paddingRight: 90, fontSize: 12, textAlign: 'center' }} />
              <button onClick={() => { navigator.clipboard.writeText(inviteLink); show('Link copied to clipboard') }}
                className="absolute right-1 top-1 bottom-1 px-3 bg-[var(--blue)] text-white text-[10px] font-bold rounded-md">COPY</button>
            </div>
            <Btn variant="secondary" className="w-full mt-4" onClick={() => setInviteOpen(false)}>Close Modal</Btn>
          </div>
        )}
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
