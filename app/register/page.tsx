'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'

interface FirmByToken {
  id: string; name: string; slug: string
  primary_color: string; logo_url: string | null; tagline: string
}

function RegisterForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()
  const token        = searchParams.get('token')   // ?token=xxx for staff self-reg

  const [step,        setStep]        = useState<1|2>(1)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [tokenFirm,   setTokenFirm]   = useState<FirmByToken | null>(null)
  const [tokenValid,  setTokenValid]  = useState<boolean | null>(null)

  const [form, setForm] = useState({
    firm_name: '', city: '', phone: '',
    full_name: '', email: '', password: '', confirm: ''
  })

  // If token present, validate it and load firm branding
  useEffect(() => {
    async function validateToken() {
      if (!token) { setTokenValid(true); return }  // no token = admin-mode (superadmin creates firms)
      const { data } = await supabase
        .rpc('get_firm_by_register_token', { p_token: token })
        .single()
      if (!data) { setTokenValid(false); return }
      setTokenFirm(data)
      setTokenValid(true)
      applyBranding(data.primary_color || '#c9a84c', 'DM Sans')
    }
    validateToken()
  }, [token])

  function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleRegister() {
    setError(''); setLoading(true)
    if (!form.email || !form.password) { setError('Enter email and password.'); setLoading(false); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); setLoading(false); return }

    // 1. Sign up
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email.trim(), password: form.password,
      options: { data: { full_name: form.full_name.trim() } }
    })
    if (authErr || !authData.user) { setError(authErr?.message || 'Sign up failed.'); setLoading(false); return }

    if (token && tokenFirm) {
      // Token-based: link user to existing firm as staff
      // Use accept-like approach via a direct profile update RPC
      const { error: rpcErr } = await supabase.rpc('join_firm_by_token', {
        p_token: token, p_full_name: form.full_name.trim() || null
      })
      setLoading(false)
      if (rpcErr) { setError(rpcErr.message); return }
      window.location.replace('/dashboard')
    } else {
      // Normal: create new firm
      const { error: firmErr } = await supabase.rpc('register_firm', {
        p_name: form.firm_name.trim(), p_slug: slugify(form.firm_name),
        p_city: form.city.trim() || null, p_phone: form.phone.trim() || null,
        p_full_name: form.full_name.trim() || null
      })
      setLoading(false)
      if (firmErr) {
        setError(firmErr.message === 'SLUG_TAKEN' ? 'A firm with this name already exists.' : firmErr.message)
        return
      }
      window.location.replace('/dashboard')
    }
  }

  const clr = tokenFirm?.primary_color || '#c9a84c'
  const inputSty = { background: '#1e2230', borderColor: '#2a3045', color: '#e8ecf5' } as React.CSSProperties
  const inputCls = 'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors'

  // Invalid token
  if (token && tokenValid === false) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d0f14' }}>
      <div style={{ textAlign:'center', maxWidth:380, padding:32, background:'#161921', border:'1px solid #2a3045', borderRadius:16 }}>
        <div style={{ fontSize:48, marginBottom:14 }}>❌</div>
        <h2 style={{ color:'#f66d7a', marginBottom:8 }}>Invalid Link</h2>
        <p style={{ color:'#8892aa', fontSize:14 }}>This registration link is invalid or has been revoked. Contact your firm admin.</p>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:20, background:'#0d0f14' }}>
      <div style={{ width:'100%', maxWidth:460 }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:28 }}>
          {tokenFirm?.logo_url ? (
            <img src={tokenFirm.logo_url} alt={tokenFirm.name}
              style={{ height:48, borderRadius:8, marginBottom:10, objectFit:'contain' }} />
          ) : <div style={{ fontSize:44, marginBottom:10 }}>🏦</div>}
          <div style={{ fontSize:22, fontWeight:800, color:clr }}>
            {token && tokenFirm ? `Join ${tokenFirm.name}` : 'Create Your Account'}
          </div>
          <div style={{ fontSize:13, color:'#505a70', marginTop:4 }}>
            {token && tokenFirm ? 'Create your staff account' : '30-day free trial · No credit card'}
          </div>
        </div>

        {/* Progress — only for new firm (no token) */}
        {!token && (
          <div style={{ display:'flex', gap:8, marginBottom:28 }}>
            {([1,2] as const).map(s => (
              <div key={s} style={{ flex:1, height:4, borderRadius:2, background:step>=s ? clr : '#2a3045', transition:'background 0.3s' }} />
            ))}
          </div>
        )}

        <div style={{ background:'#161921', border:'1px solid #2a3045', borderRadius:16, padding:28 }}>
          {error && (
            <div style={{ background:'#5c1e26', color:'#f66d7a', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:16 }}>✗ {error}</div>
          )}

          {/* Token mode — single step */}
          {token ? (
            <div>
              <div style={{ fontWeight:700, fontSize:16, marginBottom:4, color:'#e8ecf5' }}>Create Your Account</div>
              <div style={{ fontSize:13, color:'#8892aa', marginBottom:20 }}>
                You're joining <strong style={{ color:clr }}>{tokenFirm?.name}</strong> as Staff.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {[
                  { lbl:'Full Name', val:form.full_name, set:(v:string)=>setForm(f=>({...f,full_name:v})), ph:'Your name', type:'text' },
                  { lbl:'Email',     val:form.email,     set:(v:string)=>setForm(f=>({...f,email:v})),     ph:'you@example.com', type:'email' },
                  { lbl:'Password',  val:form.password,  set:(v:string)=>setForm(f=>({...f,password:v})),  ph:'Min. 6 characters', type:'password' },
                  { lbl:'Confirm',   val:form.confirm,   set:(v:string)=>setForm(f=>({...f,confirm:v})),   ph:'Re-enter password', type:'password' },
                ].map(f => (
                  <div key={f.lbl}>
                    <label style={{ fontSize:11, fontWeight:600, color:'#8892aa', textTransform:'uppercase' as const, letterSpacing:1, display:'block', marginBottom:4 }}>{f.lbl}</label>
                    <input className={inputCls} style={inputSty} type={f.type} value={f.val}
                      onChange={e => f.set(e.target.value)} placeholder={f.ph} />
                  </div>
                ))}
              </div>
              <button onClick={handleRegister} disabled={loading}
                style={{ marginTop:20, width:'100%', padding:'12px 0', background:clr, color:'#0d0f14', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer', opacity:loading?0.7:1 }}>
                {loading ? 'Creating account...' : 'Create Account & Join'}
              </button>
            </div>
          ) : (
            <>
              {/* Step 1 */}
              {step === 1 && (
                <div>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:4, color:'#e8ecf5' }}>Your Business Details</div>
                  <div style={{ fontSize:13, color:'#8892aa', marginBottom:20 }}>Step 1 of 2</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    <div>
                      <label style={{ fontSize:11, fontWeight:600, color:'#8892aa', textTransform:'uppercase' as const, letterSpacing:1, display:'block', marginBottom:4 }}>Business Name *</label>
                      <input className={inputCls} style={inputSty} value={form.firm_name}
                        onChange={e => setForm(f=>({...f,firm_name:e.target.value}))}
                        onKeyDown={e => e.key==='Enter' && setStep(2)} placeholder="e.g. Kumari Chit Funds" />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, color:'#8892aa', textTransform:'uppercase' as const, letterSpacing:1, display:'block', marginBottom:4 }}>City</label>
                        <input className={inputCls} style={inputSty} value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} placeholder="Coimbatore" />
                      </div>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, color:'#8892aa', textTransform:'uppercase' as const, letterSpacing:1, display:'block', marginBottom:4 }}>Phone</label>
                        <input className={inputCls} style={inputSty} value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="98765 43210" />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => { if (!form.firm_name.trim()) { setError('Enter business name.'); return }; setError(''); setStep(2) }}
                    style={{ marginTop:22, width:'100%', padding:'12px 0', background:clr, color:'#0d0f14', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer' }}>
                    Continue →
                  </button>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div>
                  <div style={{ fontWeight:700, fontSize:16, marginBottom:4, color:'#e8ecf5' }}>Create Your Login</div>
                  <div style={{ fontSize:13, color:'#8892aa', marginBottom:20 }}>
                    Step 2 of 2 — Admin account for <strong style={{ color:clr }}>{form.firm_name}</strong>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {[
                      { lbl:'Full Name', val:form.full_name, set:(v:string)=>setForm(f=>({...f,full_name:v})), ph:'e.g. Ravi Kumar', type:'text' },
                      { lbl:'Email',     val:form.email,     set:(v:string)=>setForm(f=>({...f,email:v})),     ph:'you@example.com', type:'email' },
                      { lbl:'Password',  val:form.password,  set:(v:string)=>setForm(f=>({...f,password:v})),  ph:'Min. 6 characters', type:'password' },
                      { lbl:'Confirm',   val:form.confirm,   set:(v:string)=>setForm(f=>({...f,confirm:v})),   ph:'Re-enter password', type:'password' },
                    ].map(f => (
                      <div key={f.lbl}>
                        <label style={{ fontSize:11, fontWeight:600, color:'#8892aa', textTransform:'uppercase' as const, letterSpacing:1, display:'block', marginBottom:4 }}>{f.lbl}</label>
                        <input className={inputCls} style={inputSty} type={f.type} value={f.val}
                          onChange={e=>f.set(e.target.value)} placeholder={f.ph} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:10, marginTop:22 }}>
                    <button onClick={() => { setStep(1); setError('') }}
                      style={{ flex:1, padding:'12px 0', background:'#1e2230', color:'#8892aa', border:'1px solid #2a3045', borderRadius:8, fontSize:14, cursor:'pointer' }}>
                      ← Back
                    </button>
                    <button onClick={handleRegister} disabled={loading}
                      style={{ flex:2, padding:'12px 0', background:clr, color:'#0d0f14', border:'none', borderRadius:8, fontSize:15, fontWeight:700, cursor:'pointer', opacity:loading?0.7:1 }}>
                      {loading ? 'Creating...' : 'Create Account'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {!token && (
          <p style={{ textAlign:'center', marginTop:18, fontSize:13, color:'#505a70' }}>
            Already have an account? <Link href="/login" style={{ color:clr, textDecoration:'none' }}>Sign in</Link>
          </p>
        )}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0d0f14', color:'#505a70' }}>Loading...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
