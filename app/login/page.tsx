'use client'

import { useState, useEffect, Suspense } from 'react'
import { APP_DEVELOPER, APP_NAME } from '@/lib/utils/index'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'
import { usePwa } from '@/lib/pwa/context'
import { usePinLock } from '@/lib/lock/context'
import { Download, Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2, Building2, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FirmBranding {
  name: string; color_profile: string; logo_url: string | null
  font: string
}

type Tab = 'signin' | 'forgot'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const firmSlug = searchParams.get('firm')
  const { install, isInstallable } = usePwa()
  const { hasPin } = usePinLock()

  const [tab, setTab] = useState<Tab>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [branding, setBranding] = useState<FirmBranding>({
    name: process.env.NEXT_PUBLIC_APP_NAME || 'SEYON ChitVault',
    color_profile: 'indigo', logo_url: null,
    font: 'Noto Sans'
  })

  // Form states
  const [siEmail, setSiEmail] = useState('')
  const [siPass, setSiPass] = useState('')
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
            logo_url: data.logo_url,
            font: data.font || 'Noto Sans'
          })
          applyBranding(data.font || 'Noto Sans', data.color_profile || 'indigo')
        }
      } catch (err) { }
    }
    loadBranding()
    document.documentElement.classList.add('dark')
  }, [firmSlug, supabase])

  async function handleRedirect(user: { id: string }) {
    try {
      router.refresh()
      const { data: profile } = await supabase
        .from('profiles').select('firm_id, role').eq('id', user.id).single()

      if (!profile) {
        router.push('/onboarding')
      } else if (profile.role === 'superadmin') {
        router.push(searchParams.get('next') || '/admin')
      } else {
        router.push(searchParams.get('next') || '/dashboard')
      }
    } catch (err) {
      window.location.href = searchParams.get('next') || '/dashboard'
    }
  }

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser()
      if (data?.user) await handleRedirect(data.user)
    }
    checkUser()
  }, [supabase.auth, router])

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
                <img src="/icons/icon-512.png" alt="Logo" className="w-24 h-24 object-contain transition-transform hover:scale-105 duration-700" />
                <span className="text-6xl font-black text-white uppercase tracking-tighter">ChitVault</span>
              </div>

            <div className="max-w-md">
              <h1 className="text-4xl font-black text-white leading-tight mb-6">
                Welcome to <br /> <span className="text-[var(--accent)]">{branding.name}.</span>
              </h1>
              <p className="text-lg text-white font-medium leading-relaxed opacity-60">
                Access your firm's professional financial management portal. 
                Secure, efficient, and built for modern business.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-auto pt-8 border-t border-white/10 flex items-center justify-between text-white font-bold uppercase tracking-widest text-[9px] opacity-30">
            <span>{APP_DEVELOPER} &copy; 2026</span>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Security</a>
            </div>
          </div>

          {/* Depth Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)]/10 rounded-full blur-[100px] pointer-events-none" />
        </div>

        {/* ── Auth Form Side (Right) ───────────────────────────────────────────── */ }
        <div className="flex-1 flex flex-col justify-center p-8 sm:p-14 relative z-20 bg-white/[0.03]">

          {/* PWA Floating Install (Mobile Only Header) */}
          {isInstallable && (
            <div className="lg:hidden absolute bottom-6 left-6 right-6 p-4 rounded-2xl glass-card flex items-center justify-between border-white/40">
              <div className="flex items-center gap-3">
                <Smartphone size={20} className="text-white" />
                <div className="text-[11px] font-black text-white leading-tight uppercase tracking-wide">
                  Install Official App<br /><span className="text-[9px] text-[var(--accent)] font-black">Faster & Secure</span>
                </div>
              </div>
              <button onClick={install} className="px-4 py-2 rounded-lg bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-xl transition-transform active:scale-95">
                Install
              </button>
            </div>
          )}

          <div className="max-w-sm w-full mx-auto">
            <div className="text-center mb-8">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt={branding.name} className="h-24 mx-auto mb-8 object-contain" />
              ) : (
                <img src="/icons/icon-512.png" alt="Logo" className="w-24 h-24 object-contain mx-auto mb-8 transition-transform hover:scale-105 duration-700 lg:hidden" />
              )}
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
                        value={siEmail}
                        onChange={e => setSiEmail(e.target.value)}
                        placeholder="name@email.com"
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

          {/* Mobile Footer */}
          <div className="lg:hidden mt-auto pt-10 text-center text-white/30 text-[9px] font-black uppercase tracking-widest">
            {APP_DEVELOPER} &copy; 2026 &bull; V{process.env.NEXT_PUBLIC_APP_VERSION}
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
