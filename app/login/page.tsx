'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'

interface FirmBranding {
  name: string; primary_color: string; logo_url: string | null
  tagline: string; font: string
}

type Tab = 'signin' | 'forgot'

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
    primary_color: '#2563eb', logo_url: null,
    tagline: 'Chit Fund Manager', font: 'DM Sans'
  })

  // Sign in form
  const [siEmail, setSiEmail] = useState('')
  const [siPass,  setSiPass]  = useState('')

  // Forgot password form
  const [fpEmail, setFpEmail] = useState('')

  // Load firm branding if slug param present
  useEffect(() => {
    async function loadBranding() {
      if (!firmSlug) return
      try {
        const { data } = await supabase
          .rpc('get_firm_branding', { p_slug: firmSlug }) as any
        if (data) {
          setBranding({
            name: data.name, primary_color: data.primary_color || '#2563eb',
            logo_url: data.logo_url, tagline: data.tagline || 'Chit Fund Manager',
            font: data.font || 'DM Sans'
          })
          applyBranding(data.primary_color || '#2563eb', data.font || 'DM Sans')
        }
      } catch (err) {
        // RPC may fail if firm doesn't exist, use defaults
      }
    }
    loadBranding()
    document.documentElement.classList.remove('dark')
  }, [firmSlug, supabase])

  const clr = branding.primary_color

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { data: { user }, error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPass })
    if (error || !user) { setError('Incorrect email or password.'); setLoading(false); return }

    // Get user's profile to determine where to redirect
    try {
      const { data: profile } = await supabase
        .from('profiles').select('firm_id, role').eq('id', user.id).single()

      setSuccess('Login successful! Redirecting...')
      
      if (!profile) {
        // This is a new user who hasn't completed onboarding
        router.push('/onboarding')
      } else if (profile.role === 'superadmin') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    } catch (profileError) {
      console.error('Error fetching profile:', profileError)
      setError('Could not find user profile. Please contact support.')
      setLoading(false)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(fpEmail, {
      redirectTo: `${window.location.origin}/reset-password`
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
            <Image src={branding.logo_url} alt={branding.name} width={224} height={56}
              style={{ marginBottom: 12, borderRadius: 10, objectFit: 'contain' }} />
          ) : (
            <div style={{ fontSize: 48, marginBottom: 8 }}>🏦</div>
          )}
          <div style={{ fontSize: 26, fontWeight: 800, color: clr }}>{branding.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>{branding.tagline}</div>
        </div>

        <div style={sty.card}>
          {/* Alerts */}
          {error && <div style={{ padding: '12px 14px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}
          {success && <div style={{ padding: '12px 14px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, color: '#16a34a', fontSize: 13, marginBottom: 16 }}>{success}</div>}

          {/* Sign In */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={sty.lbl}>Email</label>
                <input style={sty.inp} type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div>
                <label style={sty.lbl}>Password</label>
                <input style={sty.inp} type="password" value={siPass} onChange={e => setSiPass(e.target.value)} placeholder="Your password" required />
              </div>
              <button type="button" onClick={() => setTab('forgot')}
                style={{ background: 'none', border: 'none', fontSize: 12, color: clr, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                Forgot password?
              </button>
              <button type="submit" disabled={loading} style={{ ...sty.btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
              <div style={{ textAlign: 'center', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>New company? </span>
                <a href="/register" style={{ fontSize: 13, color: clr, textDecoration: 'none', fontWeight: 600, cursor: 'pointer' }}>
                  Register here
                </a>
              </div>
            </form>
          )}

          {/* Forgot Password */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={sty.lbl}>Email</label>
                <input style={sty.inp} type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="your email" required />
              </div>
              <button type="submit" disabled={loading} style={{ ...sty.btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setTab('signin'); setError(''); setSuccess('') }}
                style={{ background: 'none', border: 'none', fontSize: 12, color: clr, cursor: 'pointer', textAlign: 'center', padding: 0 }}>
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
