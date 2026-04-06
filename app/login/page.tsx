'use client'

import { useState, useEffect, Suspense } from 'react'
import { APP_DEVELOPER, APP_NAME } from '@/lib/utils/index'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { applyBranding } from '@/lib/branding/context'
import { usePwa } from '@/lib/pwa/context'
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
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      window.location.href = '/dashboard'
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
    setSuccess('Welcome back! Synchronizing vault...')
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
    <div className="min-h-screen flex mesh-gradient overflow-hidden selection:bg-[var(--accent)] selection:text-white">

      {/* ── Desktop Visual Sidebar ────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden bg-black/20">
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-24 h-24 rounded-[32px] bg-transparent backdrop-blur-md border border-white/10 flex items-center justify-center overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              <img src="/icons/icon-512.png" alt="Logo" className="w-24 h-24 object-contain bg-transparent" />
            </div>
            <span className="text-7xl font-black text-white uppercase">ChitVault</span>
          </div>

          <div className="max-w-md">
            <h1 className="text-4xl font-black text-white leading-none mb-6">
              The Pulse of <br /> <span className="text-[var(--accent)]">Secure Finance.</span>
            </h1>
            <p className="text-lg text-white font-bold leading-relaxed mb-10">
              Experience the next generation of Auction Chit Fund management.
              Real-time analytics, automated dividends, and military-grade security.
            </p>

            <div className="space-y-4">
              {[
                { icon: ShieldCheck, title: "End-to-End Audited", desc: "Every transaction is cryptographically verified." },
                { icon: Smartphone, title: "PWA Certified", desc: "Install on mobile for high-performance offline access." },
                { icon: CheckCircle2, title: "Smart Dividends", desc: "Automated calculations for various auction schemes." }
              ].map((feature, i) => (
                <div key={i} className="flex gap-4 p-5 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-md">
                  <feature.icon className="text-[var(--accent)] shrink-0" size={24} />
                  <div>
                    <h3 className="text-sm font-black text-white">{feature.title}</h3>
                    <p className="text-xs text-white mt-1 font-bold">{feature.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-auto pt-8 border-t border-white/30 flex items-center justify-between text-white font-black uppercase tracking-widest text-[11px]">
          <span>{APP_DEVELOPER} &copy; 2026</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[var(--accent)] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[var(--accent)] transition-colors">Security Audit</a>
          </div>
        </div>

        {/* Abstract Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none" />
      </div>

      {/* ── Auth Form Side ────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[500px] flex flex-col justify-center p-6 sm:p-12 relative z-20 bg-black/10">

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
          <div className="text-center mb-10">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt={branding.name} className="h-16 mx-auto mb-6 object-contain bg-transparent" />
            ) : (
              <div className="lg:hidden w-24 h-24 rounded-[32px] bg-transparent backdrop-blur-md border border-white/10 flex items-center justify-center overflow-hidden mx-auto mb-6 shadow-[0_25px_60px_rgba(0,0,0,0.6)]">
                <img src="/icons/icon-512.png" alt="Logo" className="w-18 h-18 object-contain bg-transparent" />
              </div>
            )}
            <h2 className="text-4xl font-black tracking-tight text-white mb-2">{tab === 'signin' ? 'Sign In' : 'Reset Access'}</h2>
            <p className="text-[12px] text-white font-black uppercase tracking-[0.2em] mb-4">
              {tab === 'signin' ? `Credentials for ${branding.name}` : 'Recovery initiated'}
            </p>
          </div>

          <div className="p-8 rounded-[38px] glass-card border-white/40 relative overflow-hidden">
            {/* Status Messages */}
            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-600/90 text-white text-[11px] font-black uppercase tracking-wider">
                &times; {error}
              </div>
            )}
            {success && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-600/90 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={14} /> {success}
              </div>
            )}

            {tab === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-6 relative">
                <div className="space-y-2">
                  <label className="text-[12px] font-black uppercase tracking-widest text-white ml-1">Vault ID / Email</label>
                  <div className="relative group">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white transition-colors" />
                    <input
                      type="email"
                      value={siEmail}
                      onChange={e => setSiEmail(e.target.value)}
                      placeholder="vault@chitvault.com"
                      required
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/20 border border-white/20 text-white placeholder:text-white/40 text-sm outline-none focus:border-white focus:bg-black/40 transition-all font-black"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[12px] font-black uppercase tracking-widest text-white">Secure PIN / Pass</label>
                  </div>
                  <div className="relative group">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={siPass}
                      onChange={e => setSiPass(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-12 pr-12 py-4 rounded-2xl bg-black/20 border border-white/20 text-white placeholder:text-white/40 text-sm outline-none focus:border-white focus:bg-black/40 transition-all font-black font-mono tracking-widest"
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
                  className="w-full group py-5 rounded-2xl bg-[#2563eb] text-white font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 shadow-2xl"
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
                  className="absolute top-[88px] right-0 text-[11px] font-black uppercase tracking-widest text-blue-300 hover:text-white transition-all underline decoration-blue-300/30"
                >
                  Recovery?
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[12px] font-black uppercase tracking-widest text-white ml-1">Recovery Email</label>
                  <div className="relative group">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white transition-colors" />
                    <input
                      type="email"
                      value={fpEmail}
                      onChange={e => setFpEmail(e.target.value)}
                      placeholder="recovery@chitvault.com"
                      required
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-black/20 border border-white/20 text-white placeholder:text-white/40 text-sm outline-none focus:border-white focus:bg-black/40 transition-all font-black"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 shadow-2xl"
                >
                  {loading ? 'Sending Request...' : 'Send Recovery Link'}
                </button>

                <button
                  type="button"
                  onClick={() => { setTab('signin'); setError(''); setSuccess('') }}
                  className="w-full text-center text-[11px] font-black uppercase tracking-widest text-white hover:text-blue-300 transition-colors mt-4"
                >
                  &larr; Back to Entry
                </button>
              </form>
            )}
          </div>

          <div className="mt-12 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white">
              Secured by 256-bit Hash
            </p>
          </div>
        </div>

        {/* Mobile Footer */}
        <div className="lg:hidden mt-auto pt-10 text-center text-white/80 text-[10px] font-black uppercase tracking-widest">
          {APP_DEVELOPER} &copy; 2026 &bull; V{process.env.NEXT_PUBLIC_APP_VERSION}
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
