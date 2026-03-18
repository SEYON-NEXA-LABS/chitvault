'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step,    setStep]    = useState<1|2>(1)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const [form, setForm] = useState({
    firm_name: '', city: '', phone: '',
    full_name: '', email: '', password: '', confirm: ''
  })

  function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  async function checkSlug() {
    setError(''); setLoading(true)
    if (!form.firm_name.trim()) { setError('Enter your business name.'); setLoading(false); return }
    const slug = slugify(form.firm_name)
    // Use RPC to avoid needing RLS read on firms before auth
    const { data, error: rpcErr } = await supabase
      .rpc('slug_available', { p_slug: slug })
      .single()
    // Fallback: if RPC not available just proceed (RPC will enforce uniqueness)
    setLoading(false)
    setStep(2)
  }

  async function handleRegister() {
    setError(''); setLoading(true)
    if (!form.email || !form.password) { setError('Enter email and password.'); setLoading(false); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); setLoading(false); return }

    const slug = slugify(form.firm_name)

    // 1. Sign up auth user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.full_name.trim() } }
    })

    if (authErr || !authData.user) {
      setError(authErr?.message || 'Sign up failed.'); setLoading(false); return
    }

    // 2. Call register_firm RPC — creates firm + links profile in one transaction
    //    This bypasses the block_firm_reassign trigger safely (SECURITY DEFINER)
    const { data: firmId, error: firmErr } = await supabase
      .rpc('register_firm', {
        p_name:      form.firm_name.trim(),
        p_slug:      slug,
        p_city:      form.city.trim() || null,
        p_phone:     form.phone.trim() || null,
        p_full_name: form.full_name.trim() || null,
      })

    setLoading(false)

    if (firmErr) {
      if (firmErr.message === 'SLUG_TAKEN') {
        setError('A firm with this name already exists. Try a slightly different name.')
      } else {
        setError(firmErr.message)
      }
      return
    }

    // 3. Registration complete — go to onboarding
    router.replace('/onboarding')
  }

  const inputCls = 'w-full px-4 py-2.5 rounded-lg border text-sm outline-none focus:border-yellow-500 transition-colors'
  const inputSty = { background: '#1e2230', borderColor: '#2a3045', color: '#e8ecf5' } as React.CSSProperties

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0d0f14' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🏦</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#c9a84c' }}>Create Your Account</div>
          <div style={{ fontSize: 13, color: '#505a70', marginTop: 4 }}>30-day free trial · No credit card</div>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {([1,2] as const).map(s => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: step >= s ? '#c9a84c' : '#2a3045', transition: 'background 0.3s' }} />
          ))}
        </div>

        <div style={{ background: '#161921', border: '1px solid #2a3045', borderRadius: 16, padding: 28 }}>

          {error && (
            <div style={{ background: '#5c1e26', color: '#f66d7a', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              ✗ {error}
            </div>
          )}

          {/* Step 1 — Firm details */}
          {step === 1 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#e8ecf5' }}>Your Business Details</div>
              <div style={{ fontSize: 13, color: '#8892aa', marginBottom: 20 }}>Step 1 of 2 — Tell us about your chit fund business</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#8892aa', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Business Name *</label>
                  <input className={inputCls} style={inputSty} value={form.firm_name}
                    onChange={e => setForm(f => ({...f, firm_name: e.target.value}))}
                    onKeyDown={e => e.key === 'Enter' && checkSlug()}
                    placeholder="e.g. Kumari Chit Funds" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#8892aa', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>City</label>
                    <input className={inputCls} style={inputSty} value={form.city}
                      onChange={e => setForm(f => ({...f, city: e.target.value}))} placeholder="Coimbatore" />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#8892aa', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Phone</label>
                    <input className={inputCls} style={inputSty} value={form.phone}
                      onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="98765 43210" />
                  </div>
                </div>
              </div>
              <button onClick={checkSlug} disabled={loading}
                style={{ marginTop: 22, width: '100%', padding: '12px 0', background: '#c9a84c', color: '#0d0f14', borderRadius: 8, border: 'none', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Checking...' : 'Continue →'}
              </button>
            </div>
          )}

          {/* Step 2 — Account details */}
          {step === 2 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: '#e8ecf5' }}>Create Your Login</div>
              <div style={{ fontSize: 13, color: '#8892aa', marginBottom: 20 }}>Step 2 of 2 — Set up your admin account for <strong style={{ color: '#c9a84c' }}>{form.firm_name}</strong></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#8892aa', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Your Full Name</label>
                  <input className={inputCls} style={inputSty} value={form.full_name}
                    onChange={e => setForm(f => ({...f, full_name: e.target.value}))} placeholder="e.g. Ravi Kumar" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#8892aa', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Email Address</label>
                  <input className={inputCls} style={inputSty} type="email" value={form.email}
                    onChange={e => setForm(f => ({...f, email: e.target.value}))} placeholder="you@example.com" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#8892aa', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Password</label>
                  <input className={inputCls} style={inputSty} type="password" value={form.password}
                    onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Min. 6 characters" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#8892aa', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 4 }}>Confirm Password</label>
                  <input className={inputCls} style={inputSty} type="password" value={form.confirm}
                    onChange={e => setForm(f => ({...f, confirm: e.target.value}))}
                    onKeyDown={e => e.key === 'Enter' && handleRegister()} placeholder="Re-enter password" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
                <button onClick={() => { setStep(1); setError('') }}
                  style={{ flex: 1, padding: '12px 0', background: '#1e2230', color: '#8892aa', border: '1px solid #2a3045', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
                  ← Back
                </button>
                <button onClick={handleRegister} disabled={loading}
                  style={{ flex: 2, padding: '12px 0', background: '#c9a84c', color: '#0d0f14', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#505a70' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#c9a84c', textDecoration: 'none' }}>Sign in</Link>
        </p>

      </div>
    </div>
  )
}
