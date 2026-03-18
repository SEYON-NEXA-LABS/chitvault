'use client'

import { useState } from 'react'
import { useRouter }  from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME }     from '@/lib/utils'

type Tab = 'signin' | 'signup' | 'forgot'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [tab,     setTab]     = useState<Tab>('signin')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  // Sign in
  const [siEmail, setSiEmail] = useState('')
  const [siPass,  setSiPass]  = useState('')

  // Sign up
  const [suName,  setSuName]  = useState('')
  const [suEmail, setSuEmail] = useState('')
  const [suPass,  setSuPass]  = useState('')
  const [suPass2, setSuPass2] = useState('')

  // Forgot
  const [fpEmail, setFpEmail] = useState('')

  const clearMessages = () => { setError(''); setSuccess('') }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    clearMessages(); setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPass })
    setLoading(false)
    if (error) { setError(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message); return }
    // Let middleware decide destination (dashboard / onboarding / admin)
    // based on profile.firm_id and role — just refresh to trigger middleware
    window.location.replace('/')
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    clearMessages()
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
    e.preventDefault()
    clearMessages(); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(fpEmail, {
      redirectTo: `${window.location.origin}/dashboard`
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Reset link sent! Check your inbox.')
  }

  const activeTab = 'bg-[var(--gold)] text-white font-semibold'
  const inactiveTab = 'bg-transparent text-[var(--text2)]'

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏦</div>
          <h1 className="font-display text-3xl" style={{ color: 'var(--gold)' }}>{APP_NAME}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>Chit Fund Manager</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border p-7"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', boxShadow: 'var(--shadow)' }}>

          {/* Tab switcher — only for signin/signup */}
          {tab !== 'forgot' && (
            <div className="flex gap-1 p-1 rounded-xl mb-6"
              style={{ background: 'var(--surface2)' }}>
              {(['signin','signup'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); clearMessages() }}
                  className={`flex-1 py-2 rounded-lg text-sm transition-all ${tab === t ? activeTab : inactiveTab}`}>
                  {t === 'signin' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {/* Error / Success */}
          {error   && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>✗ {error}</div>}
          {success && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>✓ {success}</div>}

          {/* Sign In */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="flex flex-col gap-4">
              <Field label="Email" type="email"    value={siEmail} onChange={e => setSiEmail(e.target.value)} placeholder="you@example.com" />
              <Field label="Password" type="password" value={siPass}  onChange={e => setSiPass(e.target.value)}  placeholder="Your password" />
              <div className="text-right -mt-2">
                <button type="button" onClick={() => { setTab('forgot'); clearMessages() }}
                  className="text-xs" style={{ color: 'var(--gold)' }}>Forgot password?</button>
              </div>
              <SubmitBtn loading={loading}>Sign In</SubmitBtn>
            </form>
          )}

          {/* Sign Up */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="flex flex-col gap-4">
              <Field label="Full Name"        value={suName}  onChange={e => setSuName(e.target.value)}  placeholder="e.g. Ravi Kumar" />
              <Field label="Email" type="email" value={suEmail} onChange={e => setSuEmail(e.target.value)} placeholder="you@example.com" />
              <Field label="Password" type="password" value={suPass}  onChange={e => setSuPass(e.target.value)}  placeholder="Min. 6 characters" />
              <Field label="Confirm Password" type="password" value={suPass2} onChange={e => setSuPass2(e.target.value)} placeholder="Re-enter password" />
              <SubmitBtn loading={loading}>Create Account</SubmitBtn>
            </form>
          )}

          {/* Forgot Password */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgot} className="flex flex-col gap-4">
              <p className="text-sm" style={{ color: 'var(--text2)' }}>Enter your email and we'll send a reset link.</p>
              <Field label="Email" type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)} placeholder="you@example.com" />
              <SubmitBtn loading={loading}>Send Reset Link</SubmitBtn>
              <button type="button" onClick={() => { setTab('signin'); clearMessages() }}
                className="text-sm text-center" style={{ color: 'var(--text2)' }}>← Back to Sign In</button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Small reusable components ─────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder }: {
  label: string; type?: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>{label}</label>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} required
        className="w-full px-4 py-2.5 rounded-lg border text-sm outline-none"
        style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' }} />
    </div>
  )
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-50"
      style={{ background: 'var(--gold)', color: '#0d0f14' }}>
      {loading ? <span className="spinner" /> : children}
    </button>
  )
}
