'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'
import { usePwa } from '@/lib/pwa/context'
import { Download } from 'lucide-react'

interface FirmBranding {
  name: string; color_profile: string; logo_url: string | null
  tagline: string; font: string
}

type Tab = 'signin' | 'forgot'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const firmSlug = searchParams.get('firm')
  const { install, isInstallable } = usePwa()

  const [tab, setTab] = useState<Tab>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [branding, setBranding] = useState<FirmBranding>({
    name: process.env.NEXT_PUBLIC_APP_NAME || 'SEYON ChitVault',
    color_profile: 'indigo', logo_url: null,
    tagline: 'Chit Fund Manager', font: 'Noto Sans'
  })

  // Sign in form
  const [siEmail, setSiEmail] = useState('')
  const [siPass, setSiPass] = useState('')

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
            name: data.name, color_profile: data.color_profile || 'indigo',
            logo_url: data.logo_url, tagline: data.tagline || 'Chit Fund Manager',
            font: data.font || 'Noto Sans'
          })
          applyBranding(data.font || 'Noto Sans', data.color_profile || 'indigo')
        }
      } catch (err) {
        // RPC may fail if firm doesn't exist, use defaults
      }
    }
    loadBranding()
    document.documentElement.classList.remove('dark')
  }, [firmSlug, supabase])

  const clr = 'var(--accent)'

  async function handleRedirect(user: { id: string }) {
    try {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles').select('firm_id, role').eq('id', user.id).single()

      if (profileErr && profileErr.code !== 'PGRST116') throw new Error(profileErr.message)

      if (!profile) {
        router.push('/onboarding')
      } else if (profile.role === 'superadmin') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Login redirect failure:', err)
      router.push('/dashboard')
    }
  }

  // Auto-redirect if session exists
  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser()
      if (data?.user) handleRedirect(data.user)
    }
    checkUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase.auth, router])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { data: { user }, error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPass })
    if (error || !user) { setError('Incorrect email or password.'); setLoading(false); return }

    setSuccess('Login successful! Redirecting...')
    handleRedirect(user)
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
    lbl: {
      fontSize: 11, fontWeight: 600 as const, color: 'var(--text2)',
      textTransform: 'uppercase' as const, letterSpacing: 1, display: 'block', marginBottom: 4
    },
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
            <div className="relative w-56 h-14 mx-auto mb-3 bg-white/50 rounded-xl p-2 flex items-center justify-center overflow-hidden">
              <img src={branding.logo_url} alt={branding.name} className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="flex items-center justify-center mb-4">
              <div className="w-32 h-32 rounded-2xl flex items-center justify-center overflow-hidden">
                <img src="/icons/icon-512.png" alt="Logo" className="w-full h-full object-cover" />
              </div>
            </div>
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
              <div className="flex justify-between items-center mt-1">
                <button type="button" onClick={() => setTab('forgot')}
                  className="text-xs font-bold hover:underline transition-all"
                  style={{ color: clr }}>
                  Forgot password?
                </button>
              </div>
              <button type="submit" disabled={loading} style={{ ...sty.btn, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
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

        {/* Powered by / Install app */}
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          {isInstallable && (
            <button onClick={install}
              style={{
                background: 'rgba(201,168,76,0.1)', color: clr, border: `1px solid ${clr}44`,
                padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 12
              }}>
              <Download size={14} /> Install ChitVault App
            </button>
          )}

          {firmSlug && (
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>
              Powered by Seyon Chit Vault
            </p>
          )}
        </div>
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
