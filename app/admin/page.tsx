'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/utils'
import type { Firm } from '@/types'

interface FirmWithStats extends Firm {
  memberCount: number
  groupCount:  number
  ownerEmail:  string
}

const planColor = (plan: string) => ({
  trial: '#5b8af5', basic: '#c9a84c', pro: '#3ecf8e'
}[plan] || '#8892aa')

const statusColor = (s: string) => s === 'active' ? '#3ecf8e' : s === 'suspended' ? '#f66d7a' : '#8892aa'

export default function AdminPage() {
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

    const enriched = await Promise.all(firmsData.map(async f => {
      const [{ count: gCount }, { count: mCount }] = await Promise.all([
        supabase.from('groups').select('*', { count: 'exact', head: true }).eq('firm_id', f.id),
        supabase.from('members').select('*', { count: 'exact', head: true }).eq('firm_id', f.id),
      ])
      return { ...f, groupCount: gCount || 0, memberCount: mCount || 0, ownerEmail: '' }
    }))

    setFirms(enriched)
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

  const displayed = firms
    .filter(f => filter === 'all' || (filter === 'suspended' ? f.plan_status === 'suspended' : f.plan === filter))
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.city?.toLowerCase().includes(search.toLowerCase()) || f.slug.includes(search.toLowerCase()))

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating]   = useState(false)
  const [newFirm, setNewFirm] = useState({ name:'', city:'', phone:'', plan:'trial', primary_color:'#c9a84c', tagline:'Chit Fund Manager', font:'DM Sans' })
  const [createErr, setCreateErr] = useState('')

  async function handleCreate() {
    if (!newFirm.name.trim()) { setCreateErr('Enter a business name.'); return }
    setCreating(true); setCreateErr('')
    const slug = newFirm.name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')
    const { error } = await supabase.rpc('admin_create_firm', {
      p_name: newFirm.name, p_slug: slug, p_city: newFirm.city||null,
      p_phone: newFirm.phone||null, p_plan: newFirm.plan,
      p_primary_color: newFirm.primary_color,
      p_tagline: newFirm.tagline, p_font: newFirm.font
    })
    setCreating(false)
    if (error) { setCreateErr(error.message === 'SLUG_TAKEN' ? 'A firm with this name already exists.' : error.message); return }
    setCreateOpen(false)
    setNewFirm({ name:'', city:'', phone:'', plan:'trial', primary_color:'#c9a84c', tagline:'Chit Fund Manager', font:'DM Sans' })
    load()
  }

  const sty = {
    page:    { background: '#0d0f14', minHeight: '100vh', color: '#e8ecf5', fontFamily: 'sans-serif' },
    header:  { background: '#161921', borderBottom: '1px solid #2a3045', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    card:    { background: '#161921', border: '1px solid #2a3045', borderRadius: 12, padding: '18px 20px' },
    badge:   (color: string) => ({ display: 'inline-block', background: color + '22', color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }),
    select:  { background: '#1e2230', border: '1px solid #2a3045', borderRadius: 6, padding: '4px 8px', color: '#e8ecf5', fontSize: 12, outline: 'none' } as React.CSSProperties,
    input:   { background: '#1e2230', border: '1px solid #2a3045', borderRadius: 6, padding: '6px 12px', color: '#e8ecf5', fontSize: 13, outline: 'none', width: '100%' } as React.CSSProperties,
  }

  return (
    <div style={sty.page}>
      {/* Header */}
      <div style={sty.header}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#c9a84c' }}>ChitVault Admin</div>
          <div style={{ fontSize: 12, color: '#505a70' }}>Super Admin Dashboard</div>
        </div>
        <div style={{ fontSize: 13, color: '#505a70' }}>{new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}</div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: 'Total Firms',  value: stats.total,     color: '#c9a84c' },
            { label: 'Trial',        value: stats.trial,     color: '#5b8af5' },
            { label: 'Basic',        value: stats.basic,     color: '#c9a84c' },
            { label: 'Pro',          value: stats.pro,       color: '#3ecf8e' },
            { label: 'Suspended',    value: stats.suspended, color: '#f66d7a' },
          ].map(s => (
            <div key={s.label} style={sty.card}>
              <div style={{ fontSize: 11, color: '#505a70', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{s.label}</div>
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
                style={{ padding: '5px 14px', borderRadius: 20, border: `1px solid ${filter === f ? '#c9a84c' : '#2a3045'}`, background: filter === f ? 'rgba(201,168,76,0.15)' : 'transparent', color: filter === f ? '#c9a84c' : '#8892aa', fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <button onClick={() => setCreateOpen(true)}
          style={{ marginLeft: 'auto', padding: '7px 16px', background: '#c9a84c', color: '#0d0f14', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Create Firm
        </button>
        <div style={{ fontSize: 13, color: '#505a70' }}>
            Showing {displayed.length} of {firms.length} firms
          </div>
        </div>

        {/* Firms table */}
        <div style={{ ...sty.card, padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#1e2230' }}>
                  {['Firm','City','Groups','Members','Plan','Status','Invoice Ref','Trial Ends','Joined','Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#505a70', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #2a3045', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#505a70' }}>Loading...</td></tr>
                  : displayed.length === 0
                    ? <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: '#505a70' }}>No firms found</td></tr>
                    : displayed.map(f => (
                      <tr key={f.id} style={{ borderBottom: '1px solid #2a3045' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1e2230')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#e8ecf5' }}>
                          {f.name}
                          <div style={{ fontSize: 11, color: '#505a70', marginTop: 2 }}>{f.phone}</div>
                        </td>

                        <td style={{ padding: '12px 14px', color: '#8892aa' }}>{f.city || '—'}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#5b8af5' }}>{f.groupCount}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: '#5b8af5' }}>{f.memberCount}</td>
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
                          <input style={{ ...sty.input, width: 110 }}
                            defaultValue={f.invoice_ref || ''}
                            onBlur={e => updateInvoice(f.id, e.target.value)}
                            placeholder="INV-001" />
                        </td>
                        <td style={{ padding: '12px 14px', color: '#8892aa', fontSize: 12 }}>
                          {f.trial_ends ? fmtDate(f.trial_ends) : '—'}
                        </td>
                        <td style={{ padding: '12px 14px', color: '#8892aa', fontSize: 12 }}>
                          {fmtDate(f.created_at)}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 11, color: '#505a70', fontFamily: 'monospace' }}>{f.slug}</div>
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
          <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 14, color: '#c9a84c' }}>📋 Manual Billing Guide</div>
          <div style={{ fontSize: 13, color: '#8892aa', lineHeight: 1.8 }}>
            <strong style={{ color: '#e8ecf5' }}>1. Trial ends</strong> → Change plan to <code style={{ color: '#c9a84c' }}>basic</code> or send invoice<br/>
            <strong style={{ color: '#e8ecf5' }}>2. Payment received</strong> → Update plan, enter Invoice Ref (e.g. INV-2026-001)<br/>
            <strong style={{ color: '#e8ecf5' }}>3. Non-payment</strong> → Set status to <code style={{ color: '#f66d7a' }}>suspended</code> — firm sees suspended screen<br/>
            <strong style={{ color: '#e8ecf5' }}>4. Renewal</strong> → Set status back to <code style={{ color: '#3ecf8e' }}>active</code>, update invoice ref
          </div>
        </div>

      </div>
    {/* Create Firm Modal */}
    {createOpen && (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
        onClick={e => e.target===e.currentTarget && setCreateOpen(false)}>
        <div style={{ background:'#161921', border:'1px solid #2a3045', borderRadius:16, padding:28, width:'100%', maxWidth:480 }}>
          <h2 style={{ fontSize:18, fontWeight:800, color:'#e8ecf5', marginBottom:20 }}>Create New Firm</h2>
          {createErr && <div style={{ background:'#5c1e26', color:'#f66d7a', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>✗ {createErr}</div>}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { lbl:'Business Name *', key:'name', ph:'e.g. Kumari Chit Funds' },
              { lbl:'City',            key:'city', ph:'Coimbatore' },
              { lbl:'Phone',           key:'phone', ph:'98765 43210' },
              { lbl:'Tagline',         key:'tagline', ph:'Chit Fund Manager' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize:11, fontWeight:600, color:'#8892aa', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:4 }}>{f.lbl}</label>
                <input style={{ width:'100%', padding:'9px 12px', background:'#1e2230', border:'1px solid #2a3045', borderRadius:8, color:'#e8ecf5', fontSize:14, outline:'none' }}
                  value={(newFirm as any)[f.key]} onChange={e => setNewFirm(n=>({...n,[f.key]:e.target.value}))} placeholder={f.ph} />
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#8892aa', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:4 }}>Plan</label>
                <select style={{ width:'100%', padding:'9px 12px', background:'#1e2230', border:'1px solid #2a3045', borderRadius:8, color:'#e8ecf5', fontSize:13, outline:'none' }}
                  value={newFirm.plan} onChange={e => setNewFirm(n=>({...n,plan:e.target.value}))}>
                  <option value="trial">Trial</option>
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:600, color:'#8892aa', textTransform:'uppercase', letterSpacing:1, display:'block', marginBottom:4 }}>Primary Colour</label>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <input type="color" value={newFirm.primary_color}
                    onChange={e => setNewFirm(n=>({...n,primary_color:e.target.value}))}
                    style={{ width:36, height:36, borderRadius:8, border:'none', cursor:'pointer', padding:2 }} />
                  <span style={{ fontSize:12, fontFamily:'monospace', color:'#8892aa' }}>{newFirm.primary_color}</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:10, marginTop:22 }}>
            <button onClick={() => { setCreateOpen(false); setCreateErr('') }}
              style={{ flex:1, padding:'11px 0', background:'#1e2230', color:'#8892aa', border:'1px solid #2a3045', borderRadius:8, fontSize:14, cursor:'pointer' }}>
              Cancel
            </button>
            <button onClick={handleCreate} disabled={creating}
              style={{ flex:2, padding:'11px 0', background:'#c9a84c', color:'#0d0f14', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer', opacity:creating?0.7:1 }}>
              {creating ? 'Creating...' : 'Create Firm'}
            </button>
          </div>
        </div>
      </div>
    )}

    </div>
  )
}
