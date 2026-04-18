'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { APP_DEVELOPER, APP_NAME, APP_VERSION, APP_COMMIT_ID } from '@/lib/utils/index'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'
import { usePinLock } from '@/lib/lock/context'
import { Download, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

interface FirmBranding {
  name: string; color_profile: string;
  font: string
}

type Tab = 'signin' | 'forgot'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const firmSlug = searchParams.get('firm')
  const { hasPin } = usePinLock()

  const [tab, setTab] = useState<Tab>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [branding, setBranding] = useState<FirmBranding>({
    name: APP_NAME,
    color_profile: 'indigo',
    font: 'Noto Sans'
  })

  // Form states
  const [siEmail, setSiEmail] = useState('')
  const [siPass, setSiPass] = useState('')
  const [saveCreds, setSaveCreds] = useState(true)
  const [fpEmail, setFpEmail] = useState('')

  useEffect(() => {
    async function loadBranding() {
      if (!firmSlug) return
      try {
        const { data } = await supabase
          .rpc('get_firm_branding', { p_slug: firmSlug }) as any
        if (data) {
          setBranding({
            name: data.name, color_profile: data.color_profile || 'indigo',
            font: data.font || 'Noto Sans'
          })
          applyBranding(data.font || 'Noto Sans', data.color_profile || 'indigo')
        }
      } catch (err) { }
    }
    loadBranding()
    document.documentElement.classList.add('dark')
  }, [firmSlug, supabase])

  const handleRedirect = useCallback(async (user: { id: string }) => {
    try {
      // 1. Refresh router to ensure middleware and server components see the new session
      router.refresh()
      
      // 2. Resolve target profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('firm_id, role')
        .eq('id', user.id)
        .single()

      const nextPath = searchParams.get('next')

      if (!profile) {
        window.location.replace('/onboarding')
      } else if (profile.role === 'superadmin') {
        // 3. User window.location.replace for the final jump to internal pages.
        // This clears the address bar of login params (like ?reason=idle) and ensures 
        // the browser state is fully initialized for the dashboard.
        window.location.replace(nextPath || '/superadmin/dashboard')
      } else {
        window.location.replace(nextPath || '/dashboard')
      }
    } catch (err) {
      // Fallback to hard redirect if anything fails
      window.location.replace(searchParams.get('next') || '/dashboard')
    }
  }, [supabase, router, searchParams])

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser()
      if (data?.user) await handleRedirect(data.user)
    }
    checkUser()
  }, [supabase.auth, handleRedirect])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { data: { user }, error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPass })
    if (error || !user) { setError('Incorrect email or password.'); setLoading(false); return }
    setSuccess('Signed in successfully! Redirecting...')
    await handleRedirect(user)
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(fpEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSuccess('Reset link dispatched! Please check your inbox.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center mesh-gradient p-4 sm:p-8 overflow-hidden selection:bg-[var(--accent)] selection:text-white">

      {/* Abstract Background Orbs for Depth */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* ── Main Container Card ────────────────────────────────────────────────── */}
      <div className="w-full max-w-[1050px] h-auto lg:h-[750px] flex flex-col lg:flex-row glass-card border border-white/20 rounded-[48px] overflow-hidden shadow-[0_80px_150px_-20px_rgba(0,0,0,0.7)] relative z-10">

        {/* ── Desktop Visual Sidebar (Left) ─────────────────────────────────────── */}
        <div className="hidden lg:flex flex-[1.2] flex-col justify-between p-12 relative overflow-hidden bg-black/30 border-r border-white/10">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-10 translate-x-[-8px]">
              <Image src="/icons/icon-512.png" alt="Logo" width={96} height={96} className="object-contain transition-transform hover:scale-105 duration-700" />
              <span className="text-6xl font-black text-white uppercase tracking-tighter font-brand">ChitVault</span>
            </div>

            <div className="max-w-md">
              <h1 className="text-4xl font-black text-white leading-tight mb-6">
                Welcome to <br /> <span className="text-[var(--accent)]">{branding.name}.</span>
              </h1>
              <p className="text-lg text-white font-medium leading-relaxed opacity-60">
                Access your firm&apos;s professional financial management portal.
                Secure, efficient, and built for modern business.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-auto pt-8 border-t border-white/10 flex items-center justify-between text-[var(--text2)] font-bold uppercase tracking-widest text-[9px] opacity-30">
            <div className="flex flex-col gap-1">
              <span className="font-brand">{APP_DEVELOPER} &copy; 2026</span>
              <span className="text-[var(--accent)] font-medium">V{APP_VERSION} &bull; {APP_COMMIT_ID}</span>
            </div>
            <div className="flex gap-6">
              <span className="text-white/50">SECURE AUDIT ACTIVE</span>
            </div>
          </div>

          {/* Depth Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)]/10 rounded-full blur-[100px] pointer-events-none" />
        </div>

        {/* ── Auth Form Side (Right) ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-14 relative z-20 bg-white/[0.03]">

          {/* Auth Content */}

          <div className="max-w-sm w-full mx-auto">
            <div className="text-center mb-8">
              <Image src="/icons/icon-512.png" alt="Logo" width={96} height={96} className="mx-auto mb-8 transition-transform hover:scale-105 duration-700 object-contain" />
              <h2 className="text-3xl font-black tracking-tight text-white mb-2">{tab === 'signin' ? 'Sign In' : 'Reset Password'}</h2>
              <p className="text-[10px] text-white font-bold uppercase tracking-[0.2em] mb-4 opacity-40">
                {tab === 'signin' ? `Authorization for ${branding.name}` : 'Security check initiated'}
              </p>
            </div>

            <div className="space-y-6">
              {/* Status Messages */}
              {error && (
                <div className="p-4 rounded-xl bg-red-600/90 text-white text-[10px] font-black uppercase tracking-wider">
                  &times; {error}
                </div>
              )}
              {success && (
                <div className="p-4 rounded-xl bg-emerald-600/90 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle2 size={12} /> {success}
                </div>
              )}

              {tab === 'signin' ? (
                <form onSubmit={handleSignIn} className="space-y-6 relative">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Email Address</label>
                    <div className="relative group">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors" />
                      <input
                        type="email"
                        name="email"
                        autoComplete="username email"
                        value={siEmail}
                        onChange={e => setSiEmail(e.target.value)}
                        placeholder="user@chitvault.in"
                        required
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/10 text-sm outline-none focus:border-[var(--accent)] transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/50">Password</label>
                    </div>
                    <div className="relative group">
                      <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors" />
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        autoComplete="current-password"
                        value={siPass}
                        onChange={e => setSiPass(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full pl-12 pr-12 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/10 text-sm outline-none focus:border-[var(--accent)] transition-all font-mono tracking-widest"
                        onKeyDown={e => { if (e.key === 'Enter') handleSignIn(e as any) }}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Save Credentials Checkbox */}
                  <div className="flex items-center gap-3 ml-1 mb-4">
                    <label className="relative flex items-center gap-3 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={saveCreds}
                          onChange={e => setSaveCreds(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-5 h-5 rounded-lg border-2 border-white/20 bg-black/40 transition-all peer-checked:bg-[var(--accent)] peer-checked:border-[var(--accent)] group-hover:border-white/40" />
                        <CheckCircle2 size={12} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white scale-0 peer-checked:scale-110 transition-transform" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/50 group-hover:text-white transition-colors">
                        Save Credentials & Stay Logged In
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full group py-5 rounded-2xl bg-[var(--accent)] text-white font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        Enter The Vault
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setTab('forgot')}
                    className="absolute top-[86px] right-0 text-[10px] font-black uppercase tracking-widest text-blue-300/60 hover:text-white transition-all underline decoration-blue-300/10"
                  >
                    Recovery?
                  </button>
                </form>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/50 ml-1">Recovery Email</label>
                    <div className="relative group">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-white transition-colors" />
                      <input
                        type="email"
                        value={fpEmail}
                        onChange={e => setFpEmail(e.target.value)}
                        placeholder="recovery@chitvault.com"
                        required
                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/40 border border-white/10 text-white placeholder:text-white/10 text-sm outline-none focus:border-[var(--accent)] transition-all font-medium"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sending Request...' : 'Send Recovery Link'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setTab('signin'); setError(''); setSuccess('') }}
                    className="w-full text-center text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white transition-colors mt-4"
                  >
                    &larr; Back to Entry
                  </button>
                </form>
              )}
            </div>

            <div className="mt-10 text-center space-y-4">
              {!hasPin && (
                <button
                  onClick={() => router.push('/settings#lock-config')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/30 text-[9px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  <ShieldCheck size={12} />
                  Security Setup
                </button>
              )}
              <p className="text-[9px] font-bold uppercase tracking-[0.5em] text-white/10">
                AUDITED FINANCIAL PLATFORM
              </p>
            </div>
          </div>

          <div className="lg:hidden mt-auto pt-10 text-center text-white/30 text-[9px] font-black uppercase tracking-widest">
            <span className="font-brand">{APP_DEVELOPER}</span> &copy; 2026 &bull; V{APP_VERSION} ({APP_COMMIT_ID})
          </div>

        </div>

      </div>

    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center mesh-gradient text-white font-black tracking-widest uppercase text-xs">
        Preparing The Vault...
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
