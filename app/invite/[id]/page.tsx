'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type State = 'loading' | 'invalid' | 'expired' | 'already_member' | 'ready' | 'signup' | 'success'

export default function InvitePage() {
  const params   = useParams()
  const router   = useRouter()
  const supabase = createClient()
  const inviteId = params.id as string

  const [state,  setState]  = useState<State>('loading')
  const [invite, setInvite] = useState<any>(null)
  const [firm,   setFirm]   = useState<any>(null)
  const [form,   setForm]   = useState({ full_name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function check() {
      // Load invite
      const { data: inv } = await supabase
        .from('invites').select('*, firms(*)').eq('id', inviteId).maybeSingle()

      if (!inv) { setState('invalid'); return }
      if (inv.status === 'accepted') { setState('already_member'); return }
      if (new Date(inv.expires_at) < new Date()) { setState('expired'); return }

      setInvite(inv)
      setFirm(inv.firms)
      setForm(f => ({ ...f, email: inv.email }))

      // Check if user is already logged in
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Check if already in a firm
        const { data: prof } = await supabase.from('profiles').select('firm_id').eq('id', user.id).single()
        if (prof?.firm_id) { setState('already_member'); return }
        // Auto-accept for logged-in user
        await acceptInvite(user.id, inv)
        return
      }

      setState('ready')
    }
    check()
  }, [inviteId])

  async function acceptInvite(userId: string, inv: any) {
    // Update profile to join firm
    const { error: profErr } = await supabase.from('profiles').update({
      firm_id: inv.firm_id, role: inv.role
    }).eq('id', userId)
    
    if (profErr) { setError(profErr.message || 'Failed to join firm.'); return }
    
    // Mark invite accepted
    await supabase.from('invites').update({ status: 'accepted' }).eq('id', inviteId)
    setState('success')
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  async function handleSignUp() {
    setError(''); setLoading(true)
    if (form.password !== form.confirm) { setError('Passwords do not match.'); setLoading(false); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.full_name } }
    })
    if (authErr || !authData.user) { setError(authErr?.message || 'Sign up failed.'); setLoading(false); return }
    await acceptInvite(authData.user.id, invite)
    setLoading(false)
  }

  async function handleSignIn() {
    setError(''); setLoading(true)
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: form.email, password: form.password
    })
    if (err || !data.user) { setError('Incorrect email or password.'); setLoading(false); return }
    await acceptInvite(data.user.id, invite)
    setLoading(false)
  }

  const sty = {
    page:  { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#0d0f14' } as React.CSSProperties,
    box:   { width: '100%', maxWidth: 420, background: '#161921', border: '1px solid #2a3045', borderRadius: 16, padding: 32 } as React.CSSProperties,
    input: { width: '100%', padding: '10px 14px', background: '#1e2230', border: '1px solid #2a3045', borderRadius: 8, color: '#e8ecf5', fontSize: 14, outline: 'none', marginTop: 4 } as React.CSSProperties,
    label: { fontSize: 11, fontWeight: 600, color: '#8892aa', textTransform: 'uppercase' as const, letterSpacing: 1 },
    btn:   { width: '100%', padding: '12px 0', background: '#c9a84c', color: '#0d0f14', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 20 } as React.CSSProperties,
  }

  if (state === 'loading') return <div style={sty.page}><div style={{ color: '#8892aa' }}>Loading invite...</div></div>

  if (state === 'invalid') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
      <h2 style={{ color: '#f66d7a', marginBottom: 8 }}>Invalid Invite</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>This invite link is invalid or has already been used.</p>
    </div></div>
  )

  if (state === 'expired') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
      <h2 style={{ color: '#f66d7a', marginBottom: 8 }}>Invite Expired</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>This invite has expired. Ask the firm owner to send a new one.</p>
    </div></div>
  )

  if (state === 'success') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
      <h2 style={{ color: '#3ecf8e', marginBottom: 8 }}>You're in!</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>You've joined {firm?.name}. Redirecting to dashboard...</p>
    </div></div>
  )

  if (state === 'already_member') return (
    <div style={sty.page}><div style={{ ...sty.box, textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <h2 style={{ color: '#c9a84c', marginBottom: 8 }}>Already a Member</h2>
      <p style={{ color: '#8892aa', fontSize: 14 }}>You're already part of a firm. <a href="/dashboard" style={{ color: '#c9a84c' }}>Go to dashboard →</a></p>
    </div></div>
  )

  // Ready — show sign up / sign in
  return (
    <div style={sty.page}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>📨</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#e8ecf5', marginBottom: 6 }}>
            You're invited to join
          </h1>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#c9a84c' }}>{firm?.name}</div>
          <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 20, padding: '4px 14px', fontSize: 13, color: '#c9a84c' }}>
            {invite?.role === 'owner' ? '👑 Owner' : '👤 Staff'} Access
          </div>
        </div>

        <div style={sty.box}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 4, background: '#1e2230', borderRadius: 10, marginBottom: 24 }}>
            {(['signup','signin'] as const).map(t => (
              <button key={t} onClick={() => setState(t as any)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontSize: 13, cursor: 'pointer', fontWeight: state === t ? 700 : 400, background: state === t ? '#c9a84c' : 'transparent', color: state === t ? '#0d0f14' : '#8892aa' }}>
                {t === 'signup' ? 'New Account' : 'Existing Account'}
              </button>
            ))}
          </div>

          {error && <div style={{ background: '#5c1e26', color: '#f66d7a', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>✗ {error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {state === 'ready' || state === 'signup' ? (
              // Sign up
              <>
                {state === 'signup' && (
                  <div>
                    <label style={sty.label}>Full Name</label>
                    <input style={sty.input} value={form.full_name} onChange={e => setForm(f => ({...f, full_name: e.target.value}))} placeholder="Your full name" />
                  </div>
                )}
                <div>
                  <label style={sty.label}>Email</label>
                  <input style={{ ...sty.input, opacity: 0.7 }} value={form.email} readOnly />
                </div>
                <div>
                  <label style={sty.label}>Password</label>
                  <input style={sty.input} type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} placeholder="Min. 6 characters" />
                </div>
                <div>
                  <label style={sty.label}>Confirm Password</label>
                  <input style={sty.input} type="password" value={form.confirm} onChange={e => setForm(f => ({...f, confirm: e.target.value}))}
                    onKeyDown={e => e.key === 'Enter' && handleSignUp()} />
                </div>
                <button style={sty.btn} disabled={loading} onClick={() => { setState('signup'); handleSignUp() }}>
                  {loading ? 'Creating account...' : 'Create Account & Join'}
                </button>
              </>
            ) : (
              // Sign in
              <>
                <div>
                  <label style={sty.label}>Email</label>
                  <input style={{ ...sty.input, opacity: 0.7 }} value={form.email} readOnly />
                </div>
                <div>
                  <label style={sty.label}>Password</label>
                  <input style={sty.input} type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))}
                    onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
                </div>
                <button style={sty.btn} disabled={loading} onClick={handleSignIn}>
                  {loading ? 'Signing in...' : 'Sign In & Join'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
