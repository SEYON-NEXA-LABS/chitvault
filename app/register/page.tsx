'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'
import { APP_NAME } from '@/lib/utils'

interface FirmByToken {
  id: string; name: string; slug: string
  color_profile: string; font?: string
}

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const token = searchParams.get('token')

  const [step, setStep] = useState<1 | 2>(token ? 2 : 1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tokenFirm, setTokenFirm] = useState<FirmByToken | null>(null)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)

  const [form, setForm] = useState({
    firm_name: '', city: '', phone: '',
    full_name: '', email: '', password: '', confirm: ''
  })

  useEffect(() => {
    async function validateToken() {
      if (!token) { setTokenValid(true); return }
      const { data } = await supabase.rpc('get_firm_by_register_token', { p_token: token }).single()
      if (!data) { setTokenValid(false); return }
      const firmData = data as any
      setTokenFirm(firmData)
      setTokenValid(true)

      applyBranding(firmData.font || 'Noto Sans', firmData.color_profile || 'indigo')
    }
    validateToken()
  }, [token, supabase])

  function slugify(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  }

  async function handleRegister() {
    setError(''); setLoading(true)
    if (!form.full_name) { setError('Please enter your name.'); setLoading(false); return }
    if (!form.email || !form.password) { setError('Enter email and password.'); setLoading(false); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); setLoading(false); return }
    if (form.password !== form.confirm) { setError('Passwords do not match.'); setLoading(false); return }

    // 1. Sign up user
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.full_name.trim() } }
    })

    if (authErr || !authData.user) {
      setError(authErr?.message || 'Sign up failed.');
      setLoading(false);
      return
    }

    // 2. Firm Setup
    if (token && tokenFirm) {
      const { error: rpcErr } = await supabase.rpc('join_firm_by_token', {
        p_token: token, p_full_name: form.full_name.trim() || null
      })
      if (rpcErr) { setError(rpcErr.message); setLoading(false); return }
    } else {
      const { error: firmErr } = await supabase.rpc('admin_create_firm', {
        p_name: form.firm_name.trim(),
        p_slug: slugify(form.firm_name),
        p_city: form.city.trim() || null,
        p_phone: form.phone.trim() || null,
        p_owner_id: authData.user.id,
        p_owner_name: form.full_name.trim() || null
      })
      if (firmErr) {
        setError(firmErr.message === 'SLUG_TAKEN' ? 'A firm with this name already exists.' : firmErr.message)
        setLoading(false); return
      }
    }

    setLoading(false)
    window.location.replace('/dashboard')
  }

  const clr = 'var(--accent)'
  const inputSty = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)' } as React.CSSProperties
  const inputCls = 'w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors focus:border-[var(--accent)]'

  if (tokenValid === null) return <div className="min-h-screen flex items-center justify-center bg-[#0d0f14] text-gray-500">Loading...</div>

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0f14] p-6 text-center">
        <div className="max-w-md">
          <div className="text-5xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold text-white mb-4">Registration is Invite-Only</h1>
          <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto">
            New firms must be registered through the {APP_NAME || 'platform'} administration.
            Contact support to onboard your organization.
          </p>
          <p className="text-gray-400 mb-8 mt-4">
            If you already have an account, please sign in.
          </p>
          <Link href="/login" className="px-8 py-3 bg-[var(--accent)] text-black font-bold rounded-xl hover:scale-105 transition-transform inline-block">
            Go to Login
          </Link>
        </div>
      </div>
    )
  }

  if (tokenValid === false) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f14] p-6">
      <div className="text-center max-w-sm p-10 bg-[#161921] border border-[#2a3045] rounded-2xl shadow-2xl">
        <div className="text-5xl mb-6">❌</div>
        <h2 className="text-[#f66d7a] text-xl font-bold mb-3">Invalid Link</h2>
        <p className="text-gray-400 text-sm leading-relaxed">This invitation has expired or is no longer valid.</p>
        <Link href="/login" className="inline-block mt-8 font-bold text-[var(--accent)] hover:underline">Back to Login</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0d0f14]">
      <div className="w-full max-w-[480px]">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center mb-10">
            <Image src="/icons/icon-512.png" alt="Logo" width={160} height={160} className="object-contain transition-transform hover:scale-105 duration-700" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight font-brand">
            Join {tokenFirm?.name}
          </h1>
          <p className="text-gray-500 mt-2 text-sm">
            Setup your access to the firm dashboard
          </p>
        </div>

        <div className="bg-[#161921] border border-[#2a3045] rounded-3xl shadow-2xl p-8 lg:p-10">
          {error && <div className="mb-6 bg-danger-900/40 text-danger-400 p-4 rounded-xl text-sm border border-danger-800/50">✗ {error}</div>}

          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">Full Name</label>
              <input className={inputCls} style={inputSty} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Your Name" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">Corporate Email</label>
              <input className={inputCls} style={inputSty} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@firm.com" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">Password</label>
                <input className={inputCls} style={inputSty} type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-2">Confirm</label>
                <input className={inputCls} style={inputSty} type="password" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} placeholder="••••••" />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={handleRegister} disabled={loading} className="flex-1 py-4 bg-[var(--accent)] text-black font-black rounded-xl hover:scale-[1.02] active:scale-100 transition-all shadow-lg shadow-yellow-600/10 disabled:opacity-50">
                {loading ? 'Creating...' : 'Join Firm'}
              </button>
            </div>
          </div>
        </div>

        <p className="text-center mt-8 text-sm text-gray-600">
          Already have an account? <Link href="/login" className="text-[var(--accent)] font-bold hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0d0f14] text-gray-500">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
