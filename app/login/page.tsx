'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'

interface FirmBranding {
  name: string; primary_color: string; logo_url: string | null
  tagline: string; font: string
}

type Tab = 'signin' | 'signup' | 'forgot'

function LoginForm() {
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const supabase      = createClient()
  const firmSlug      = searchParams.get('firm')

  const [tab,      setTab]      = useState<Tab>('signin')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const [branding, setBranding] = useState<FirmBranding>({
    name: process.env.NEXT_PUBLIC_APP_NAME || 'ChitVault',
    primary_color: '#c9a84c', logo_url: null,
    tagline: 'Chit Fund Manager', font: 'DM Sans'
  })

  const [siEmail, setSiEmail] = useState('')
  const [siPass,  setSiPass]  = useState('')
  const [suName,  setSuName]  = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPass,  setSuPass]  = useState('')
  const [suPass2, setSuPass2] = useState('')
  const [fpEmail, setFpEmail] = useState('')

  // Load firm branding if slug param present
  useEffect(() => {
    async function loadBranding() {
      if (!firmSlug) return
      const { data } = await supabase
        .rpc('get_firm_branding', { p_slug: firmSlug })
        .single()
      if (data) {
        setBranding({
          name: data.name, primary_color: data.primary_color || '#c9a84c',
          logo_url: data.logo_url, tagline: data.tagline || 'Chit Fund Manager',
          font: data.font || 'DM Sans'
        })
        applyBranding(data.primary_color || '#c9a84c', data.font || 'DM Sans')
      }
    }
    loadBranding()
  }, [firmSlug])

  const clr = branding.primary_color

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPass })
    setLoading(false)
    if (error) { setError('Incorrect email or password.'); return }
    window.location.replace('/')
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (suPass !== suPass2) { setError('Passwords do not match.'); return }
    if (suPass.length < 6)  { setError('Password must be at least 6 characters.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: suEmail, password: suPass,
      options: { data: { full_name: suName } }
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Account created! You can now sign in.')
    setTimeout(() => setTab('signin'), 2000)
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(fpEmail, {
      redirectTo: `${window.location.origin}/dashboard`
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Reset link sent! Check your inbox.')
  }

  const sty = {
    page: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)'
    } as React.CSSProperties,
    card: {
      width: '100%', maxWidth: 400, background: 'var(--surface)',
      border: '1px solid var(--border)', borderRadius: 18,
      padding: 32, boxShadow: 'var(--shadow)'
    } as React.CSSProperties,
    inp: {
      width: '100%', padding: '10px 14px', background: 'var(--surface2)',
      border: '1px solid var(--border)', borderRadius: 9, color: 'var(--text)',
      fontSize: 14, outline: 'none', transition: 'border-color 0.2s'
    } as React.CSSProperties,
    lbl: { fontSize: 11, fontWeight: 600 as const, color: 'var(--text2)',
           textTransform: 'uppercase' as const, letterSpacing: 1, display: 'block', marginBottom: 4 },
    btn: {
      width: '100%', padding: '12px 0', borderRadius: 9, border: 'none',
      fontSize: 15, fontWeight: 700 as const, cursor: 'pointer',
      background: clr, color: '#fff', marginTop: 20, transition: 'opacity 0.15s'
    } as React.CSSProperties,
  }

  return (
    <div style={sty.page}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo / branding */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.name}
              style={{ height: 56, marginBottom: 12, borderRadius: 10, objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏦</div>
          )}
          <div style={{ fontSize: 26, fontWeight: 800, color: clr }}>{branding.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>{branding.tagline}</div>
        </div>

        <div style={sty.card}>
          {/* Tab switcher */}
          {tab !== 'forgot' && (
            <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface2)', borderRadius: 10, marginBottom: 24 }}>
              {(['signin','signup'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); setError(''); setSuccess('') }}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontSize: 13, cursor: 'pointer',
                    fontWeight: tab === t ? 700 : 400,
                    background: tab === t ? clr : 'transparent',
                    color: tab === t ? '#fff' : 'var(--text2)' }}>
                  {t === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {error   && <div style={{ background:'var(--red-dim)', color:'var(--red)', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>✗ {error}</div>}
          {success && <div style={{ background:'var(--green-dim)', color:'var(--green)', borderRadius:8, padding:'10px 14px', fontSize:13, marginBottom:14 }}>✓ {success}</div>}

          {/* Sign In */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={sty.lbl}>Email</label>
                <input style={sty.inp} type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)} placeholder="you@example.com" required /></div>
              <div><label style={sty.lbl}>Password</label>
                <input style={sty.inp} type="password" value={siPass} onChange={e => setSiPass(e.target.value)} placeholder="Your password" required /></div>
              <div style={{ textAlign: 'right', marginTop: -6 }}>
                <button type="button" onClick={() => { setTab('forgot'); setError(''); setSuccess('') }}
                  style={{ background: 'none', border: 'none', fontSize: 12, color: clr, cursor: 'pointer' }}>
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={loading} style={{ ...sty.btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Sign Up */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label style={sty.lbl}>Full Name</label>
                <input style={sty.inp} value={suName} onChange={e => setSuName(e.target.value)} placeholder="e.g. Ravi Kumar" /></div>
              <div><label style={sty.lbl}>Email</label>
                <input style={sty.inp} type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder="you@example.com" required /></div>
              <div><label style={sty.lbl}>Password</label>
                <input style={sty.inp} type="password" value={suPass} onChange={e => setSuPass(e.target.value)} placeholder="Min. 6 characters" required /></div>
              <div><label style={sty.lbl}>Confirm Password</label>
                <input style={sty.inp} type="password" value={suPass2} onChange={e => setSuPass2(e.target.value)} placeholder="Re-enter password" required /></div>
              <button type="submit" disabled={loading} style={{ ...sty.btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Forgot */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>Enter your email and we'll send a reset link.</p>
              <div><label style={sty.lbl}>Email</label>
                <input style={sty.inp} type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="you@example.com" required /></div>
              <button type="submit" disabled={loading} style={{ ...sty.btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setTab('signin'); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, cursor: 'pointer', marginTop: 4 }}>
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>

        {/* Powered by */}
        {firmSlug && (
          <p style={{ textAlign: 'center', marginTop: 18, fontSize: 11, color: 'var(--text3)' }}>
            Powered by ChitVault
          </p>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text3)' }}>
        Loading...
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
