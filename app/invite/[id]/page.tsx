'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type State = 'loading' | 'invalid' | 'expired' | 'already_member' | 'ready' | 'signin' | 'success' | 'error'

interface InviteInfo {
  id:        string
  email:     string
  role:      string
  status:    string
  expires_at: string
  firm_name: string
}

export default function InvitePage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const inviteId = params.id as string

  const [state,  setState]  = useState<State>('loading')
  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [form,   setForm]   = useState({ full_name: '', password: '', confirm: '' })
  const [tab,    setTab]    = useState<'signup'|'signin'>('signup')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function check() {
      // Use the get_invite RPC — works for anon users too
      const { data: inv, error: rpcErr } = await supabase
        .rpc('get_invite', { invite_id: inviteId })
        .single()

      if (rpcErr || !inv) { setState('invalid'); return }
      if (inv.status === 'accepted') { setState('already_member'); return }
      if (new Date(inv.expires_at) < new Date()) { setState('expired'); return }

      setInvite(inv)

      // Check if already logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase
          .from('profiles').select('firm_id').eq('id', user.id).single()
        if (prof?.firm_id) { setState('already_member'); return }
        // Logged in, no firm → auto-accept
        await doAccept()
      } else {
        setState('ready')
      }
    }
    check()
  }, [inviteId])

  async function doAccept() {
    // Use accept_invite RPC — handles firm_id update safely (SECURITY DEFINER bypasses trigger)
    const { error: rpcErr } = await supabase.rpc('accept_invite', { invite_id: inviteId })
    if (rpcErr) {
      setError(rpcErr.message)
      setState('error')
      return
    }
    setState('success')
    setTimeout(() => window.location.replace('/dashboard'), 2000)
  }

  async function handleSignUp() {
    setError(''); setLoading(true)
    if (!invite) return
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); setLoading(false); return }

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: invite.email,
      password: form.password,
      options: { data: { full_name: form.full_name } }
    })
    setLoading(false)
    if (authErr || !authData.user) { setError(authErr?.message || 'Sign up failed.'); return }
    await doAccept()
  }

  async function handleSignIn() {
    setError(''); setLoading(true)
    if (!invite) return
    const { error: err } = await supabase.auth.signInWithPassword({
      email: invite.email, password: form.password
    })
    setLoading(false)
    if (err) { setError('Incorrect password.'); return }
    await doAccept()
  }

  const sty = {
    page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0d0f14' } as React.CSSProperties,
    box:  { width: '100%', maxWidth: 420, background: '#161921', border: '1px solid #2a3045', borderRadius: 16, padding: 32 } as React.CSSProperties,
    inp:  { width: '100%', padding: '10px 14px', background: '#1e2230', border: '1px solid #2a3045', borderRadius: 8, color: '#e8ecf5', fontSize: 14, outline: 'none', marginTop: 4 } as React.CSSProperties,
    lbl:  { fontSize: 11, fontWeight: 600 as const, color: '#8892aa', textTransform: 'uppercase' as const, letterSpacing: 1 },
    btn:  { width: '100%', padding: '12px 0', background: '#c9a84c', color: '#0d0f14', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 20 } as React.CSSProperties,
  }

  // ── State screens ─────────────────────────────────────────
  if (state === 'loading') return <div style={sty.page}><div style={{ color: '#8892aa' }}>Loading invite...</div></div>

  if (state === 'invalid') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>❌</div>
      <h2 style={{ color: '#f66d7a', marginBottom: 8 }}>Invalid Invite</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>This invite link is invalid or has already been used.</p>
    </div></div>
  )

  if (state === 'expired') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>⏰</div>
      <h2 style={{ color: '#f66d7a', marginBottom: 8 }}>Invite Expired</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>This invite expired. Ask the firm owner to send a new one.</p>
    </div></div>
  )

  if (state === 'already_member') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>✅</div>
      <h2 style={{ color: '#c9a84c', marginBottom: 8 }}>Already a Member</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>
        You're already part of a firm.{' '}
        <a href="/dashboard" style={{ color: '#c9a84c' }}>Go to dashboard →</a>
      </p>
    </div></div>
  )

  if (state === 'success') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>🎉</div>
      <h2 style={{ color: '#3ecf8e', marginBottom: 8 }}>You're in!</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>You've joined {invite?.firm_name}. Redirecting...</p>
    </div></div>
  )

  if (state === 'error') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 14 }}>⚠️</div>
      <h2 style={{ color: '#f66d7a', marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>{error}</p>
    </div></div>
  )

  // ── Accept form ───────────────────────────────────────────
  return (
    <div style={sty.page}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📨</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#e8ecf5', marginBottom: 6 }}>
            You're invited to join
          </h1>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#c9a84c' }}>{invite?.firm_name}</div>
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '4px 14px', fontSize: 13, color: '#c9a84c' }}>
            {invite?.role === 'owner' ? '👑 Owner' : '👤 Staff'} Access
          </div>
        </div>

        <div style={sty.box}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: '#1e2230', borderRadius: 10, marginBottom: 24 }}>
            {(['signup','signin'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); setError('') }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: tab === t ? 700 : 400, background: tab === t ? '#c9a84c' : 'transparent', color: tab === t ? '#0d0f14' : '#8892aa' }}>
                {t === 'signup' ? 'New Account' : 'I have an account'}
              </button>
            ))}
          </div>

          {error && (
            <div style={{ background: '#5c1e26', color: '#f66d7a', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              ✗ {error}
            </div>
          )}

          {/* Email — always shown, read-only */}
          <div style={{ marginBottom: 14 }}>
            <label style={sty.lbl}>Email (from invite)</label>
            <input style={{ ...sty.inp, opacity: 0.65 }} value={invite?.email || ''} readOnly />
          </div>

          {tab === 'signup' && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={sty.lbl}>Your Name</label>
                <input style={sty.inp} value={form.full_name}
                  onChange={e => setForm(f => ({...f, full_name: e.target.value}))} placeholder="Full name" />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={sty.lbl}>Set Password</label>
                <input style={sty.inp} type="password" value={form.password}
                  onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Min. 6 characters" />
              </div>
              <div>
                <label style={sty.lbl}>Confirm Password</label>
                <input style={sty.inp} type="password" value={form.confirm}
                  onChange={e => setForm(f => ({...f, confirm: e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && handleSignUp()} />
              </div>
              <button style={{ ...sty.btn, opacity: loading ? 0.7 : 1 }}
                disabled={loading} onClick={handleSignUp}>
                {loading ? 'Creating account...' : 'Create Account & Join'}
              </button>
            </>
          )}

          {tab === 'signin' && (
            <>
              <div>
                <label style={sty.lbl}>Password</label>
                <input style={sty.inp} type="password" value={form.password}
                  onChange={e => setForm(f => ({...f, password: e.target.value}))}
                  onKeyDown={e => e.key === 'Enter' && handleSignIn()} placeholder="Your password" />
              </div>
              <button style={{ ...sty.btn, opacity: loading ? 0.7 : 1 }}
                disabled={loading} onClick={handleSignIn}>
                {loading ? 'Signing in...' : 'Sign In & Join'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
