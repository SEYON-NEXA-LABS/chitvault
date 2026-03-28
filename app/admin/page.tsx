'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { registerFirm, updateFirmTheme } from './actions'
import { fmtDate } from '@/lib/utils'
import { THEMES, getTheme } from '@/lib/branding/themes'
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
    setStats({
      total:     enriched.length,
      trial:     enriched.filter(f => f.plan === 'trial').length,
      basic:     enriched.filter(f => f.plan === 'basic').length,
      pro:       enriched.filter(f => f.plan === 'pro').length,
      suspended: enriched.filter(f => f.plan_status === 'suspended').length,
    })
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
    
    const { success, error } = await registerFirm({
      ...newFirm,
      slug
    })

    setCreating(false)
    if (error) { setCreateErr(error === 'SLUG_TAKEN' ? 'A firm with this name already exists.' : error); return }
    setCreateOpen(false)
    setNewFirm({ name:'', city:'', phone:'', owner_email:'', owner_name:'', owner_pass:'', plan:'trial', theme_id:'theme1', tagline:'Chit Fund Manager', font:'Noto Sans' })
    load()
  }

  const sty = {
    page:    { background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'sans-serif' },
    header:  { background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    card:    { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px' },
    badge:   (color: string) => ({ display: 'inline-block', background: color + '22', color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }),
    select:  { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--text)', fontSize: 12, outline: 'none' } as React.CSSProperties,
    input:   { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', color: 'var(--text)', fontSize: 13, outline: 'none', width: '100%' } as React.CSSProperties,
  }

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Firms',  value: stats.total,     color: 'var(--blue)' },
            { label: 'Trial',        value: stats.trial,     color: 'var(--blue)' },
            { label: 'Basic',        value: stats.basic,     color: 'var(--blue)' },
            { label: 'Pro',          value: stats.pro,       color: 'var(--green)' },
            { label: 'Suspended',    value: stats.suspended, color: 'var(--red)' },
          ].map(s => (
            <div key={s.label} style={sty.card}>
              <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...sty.input, maxWidth: 240 }} value={search}
            onChange={e => setSearch(e.target.value)} placeholder="Search firm name, city, slug..." />
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all','trial','basic','pro','suspended'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${filter === f ? 'var(--blue)' : 'var(--border)'}`, background: filter === f ? 'var(--gold-dim)' : 'transparent', color: filter === f ? 'var(--blue)' : 'var(--text2)', fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            <button onClick={() => window.location.href = '/admin/branding'}
              style={{ padding: '7px 16px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              🎨 Branding
            </button>
            <button onClick={() => setCreateOpen(true)}
              style={{ padding: '7px 16px', background: 'var(--blue)', color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + Create Firm
            </button>
          </div>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Showing {displayed.length} of {firms.length} firms
          </div>
        </div>

        {/* Firms table */}
        <div style={{ ...sty.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)' }}>
                  {['Firm','City','Groups','Members','Plan','Status','Theme','Invoice Ref','Trial Ends','Joined'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--text3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</td></tr>
                  : displayed.length === 0
                    ? <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No firms found</td></tr>
                    : displayed.map(f => (
                      <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text)' }}>
                          {f.name}
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{f.phone}</div>
                        </td>

                        <td style={{ padding: '12px 14px', color: 'var(--text2)' }}>{f.city || '—'}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--blue)' }}>{f.groupCount}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--blue)' }}>{f.memberCount}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <select style={sty.select} value={f.plan}
                            disabled={updating === f.id}
                            onChange={e => updatePlan(f.id, e.target.value)}>
                            <option value="trial">Trial</option>
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <select style={{ ...sty.select, color: statusColor(f.plan_status) }} value={f.plan_status}
                            disabled={updating === f.id}
                            onChange={e => updateStatus(f.id, e.target.value)}>
                            <option value="active">Active</option>
                            <option value="suspended">Suspended</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <select style={{ ...sty.select, padding: '4px' }} value={f.theme_id || 'theme1'}
                            disabled={updating === f.id}
                            onChange={e => handleThemeChange(f.id, e.target.value)}>
                            {THEMES.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                          <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                            {THEMES.find(t => t.id === (f.theme_id || 'theme1'))?.primary && (
                              <>
                                <div style={{ width: 12, height: 12, borderRadius: 2, background: THEMES.find(t => t.id === (f.theme_id || 'theme1'))?.primary }} />
                                <div style={{ width: 12, height: 12, borderRadius: 2, background: THEMES.find(t => t.id === (f.theme_id || 'theme1'))?.accent }} />
                              </>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <input style={{ ...sty.input, width: 90 }}
                            defaultValue={f.invoice_ref || ''}
                            onBlur={e => updateInvoice(f.id, e.target.value)}
                            placeholder="INV-001" />
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text2)', fontSize: 12 }}>
                          {f.trial_ends ? fmtDate(f.trial_ends) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text2)', fontSize: 12 }}>
                          {fmtDate(f.created_at)}
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick guide */}
        <div style={{ marginTop: 20, ...sty.card }}>
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14, color: 'var(--blue)' }}>📋 Manual Billing Guide</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--text)' }}>1. Trial ends</strong> → Change plan to <code style={{ color: 'var(--blue)' }}>basic</code> or send invoice<br/>
            <strong style={{ color: 'var(--text)' }}>2. Payment received</strong> → Update plan, enter Invoice Ref (e.g. INV-2026-001)<br/>
            <strong style={{ color: 'var(--text)' }}>3. Non-payment</strong> → Set status to <code style={{ color: 'var(--red)' }}>suspended</code> — firm sees suspended screen<br/>
            <strong style={{ color: 'var(--text)' }}>4. Renewal</strong> → Set status back to <code style={{ color: 'var(--green)' }}>active</code>, update invoice ref
          </div>
        </div>

      </div>
    {/* Create Firm Modal */}
    {createOpen && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
        onClick={e => e.target===e.currentTarget && setCreateOpen(false)}>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:28, width:'100%', maxWidth:540 }}>
          <h2 style={{ fontSize:18, fontWeight:800, color:'var(--text)', marginBottom:20 }}>Create New Firm</h2>
          {createErr && <div style={{ background:'var(--red-dim)', color:'var(--red)', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>✗ {createErr}</div>}
          <div style={{ display:'flex', gap:24 }}>
            <div style={{ flex: 1, display:'flex', flexDirection:'column', gap:12 }}>
              {[
                { lbl:'Business Name *', key:'name', ph:'e.g. Kumari Chit Funds', type:'text' },
                { lbl:'Owner Name',      key:'owner_name', ph:'Owner Full Name', type:'text' },
                { lbl:'Owner Email *',    key:'owner_email', ph:'admin@firm.com', type:'email' },
                { lbl:'Set Password *',   key:'owner_pass', ph:'••••••', type:'password' },
                { lbl:'City',            key:'city', ph:'Coimbatore', type:'text' },
                { lbl:'Phone',           key:'phone', ph:'98765 43210', type:'tel' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize:10, fontWeight:600, color:'var(--text2)', textTransform:'uppercase' as const, letterSpacing:1, display:'block', marginBottom:4 }}>{f.lbl}</label>
                  <input style={{ width:'100%', padding:'7px 10px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13, outline:'none' }}
                    type={f.type} maxLength={f.key === 'phone' ? 10 : undefined}
                    value={(newFirm as any)[f.key]} 
                    onChange={e => setNewFirm(n=>({...n,[f.key]:f.key === 'phone' ? e.target.value.replace(/\D/g,'') : e.target.value}))} 
                    placeholder={f.ph} />
                </div>
              ))}
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ fontSize:10, fontWeight:600, color:'var(--text2)', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:10 }}>Select Theme</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {THEMES.map(t => (
                  <button key={t.id} 
                    onClick={() => setNewFirm(n => ({ ...n, theme_id: t.id }))}
                    style={{ 
                      padding: 10, borderRadius: 10, border: `2px solid ${newFirm.theme_id === t.id ? 'var(--blue)' : 'var(--border)'}`, 
                      background: t.bg, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s',
                      display: 'flex', flexDirection: 'column', gap: 6, position: 'relative'
                    }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#333' }}>{t.name}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: t.primary }} />
                      <div style={{ width: 14, height: 14, borderRadius: 4, background: t.accent }} />
                    </div>
                    {newFirm.theme_id === t.id && (
                      <div style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: 'var(--blue)', borderRadius: '50%' }} />
                    )}
                  </button>
                ))}
              </div>
              
              <div style={{ marginTop: 20 }}>
                <label style={{ fontSize:10, fontWeight:600, color:'var(--text2)', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:4 }}>Plan</label>
                <select style={{ width:'100%', padding:'9px 12px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13, outline:'none' }}
                  value={newFirm.plan} onChange={e => setNewFirm(n=>({...n,plan:e.target.value}))}>
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
            </div>
          </div>
          
          <div style={{ display:'flex', gap:10, marginTop:22 }}>
            <button onClick={() => { setCreateOpen(false); setCreateErr('') }}
              style={{ flex:1, padding:'11px 0', background:'var(--surface2)', color:'var(--text2)', border:'1px solid var(--border)', borderRadius:8, fontSize:14, cursor:'pointer' }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={creating}
              style={{ flex:2, padding:'11px 0', background:'var(--blue)', color:'#fff', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer', opacity:creating?0.7:1 }}>
              {creating ? 'Creating...' : 'Create Firm'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
