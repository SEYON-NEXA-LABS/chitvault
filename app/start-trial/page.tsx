'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { startTrialAction } from '@/app/actions/start-trial'
import { createClient } from '@/lib/supabase/client'
import { APP_VERSION, APP_COMMIT_ID } from '@/lib/utils'
import { 
  Building2, User, Mail, Lock, Phone, MapPin, 
  ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Loader2, Sparkles
} from 'lucide-react'

export default function StartTrialPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<1 | 2>(1)

  const [form, setForm] = useState({
    firmName: '',
    city: '',
    phone: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false
  })

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.firmName.trim()) return setError('Please enter your Chit Firm name.')
    if (!form.city.trim()) return setError('Please enter your city/town.')
    if (form.phone && form.phone.replace(/\D/g, '').length !== 10) {
      return setError('Mobile number must be exactly 10 digits.')
    }
    setStep(2)
  }

  const handleStartTrial = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.fullName.trim()) return setError('Please enter your full name.')
    if (!form.email.trim()) return setError('Please enter a valid email.')
    if (!form.password || form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    if (!form.agreeTerms) return setError('Please review and agree to the Terms of Service and Privacy Policy.')

    setLoading(true)
    try {
      // 1. Execute Server Action to initialize user and trial firm
      await startTrialAction({
        firmName: form.firmName,
        city: form.city,
        phone: form.phone,
        fullName: form.fullName,
        email: form.email,
        password: form.password
      })

      // 2. Sign in the user on the client side
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password
      })

      if (signInErr) {
        // Redirect to login if auto-login fails
        router.push('/login?trial_started=1')
        return
      }

      // 3. Take them directly to Onboarding
      window.location.href = '/onboarding'
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Top Navbar */}
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            CV
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-white">ChitVault</span>
            <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-widest leading-none">Cloud Ledger</span>
          </div>
        </Link>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400 hidden sm:inline">Already have a vault?</span>
          <Link href="/login" className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 font-bold text-white border border-white/10 transition-colors">
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-lg">
          {/* Header pill */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
              <Sparkles size={12} /> 30-Day Free Trial • No Credit Card Required
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Start your ChitVault
            </h1>
            <p className="text-sm text-slate-400 mt-2">
              Setup takes less than 60 seconds. Digitize your auctions and member passbooks today.
            </p>
          </div>

          {/* Stepper Card */}
          <div className="bg-[#0e131f] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Progress Bar */}
            <div className="flex items-center gap-2 mb-6 pb-6 border-b border-white/5">
              <div className={`flex items-center gap-2 flex-1 ${step >= 1 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-emerald-500 text-black' : 'bg-white/10'}`}>
                  1
                </div>
                <span className="text-xs font-bold">Chit Firm</span>
              </div>
              <div className="w-6 h-0.5 bg-white/10" />
              <div className={`flex items-center gap-2 flex-1 ${step >= 2 ? 'text-emerald-400' : 'text-slate-500'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-emerald-500 text-black' : 'bg-white/10'}`}>
                  2
                </div>
                <span className="text-xs font-bold">Administrator</span>
              </div>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2.5 mb-5 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleNextStep} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Chit Firm / Organization Name
                  </label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sri Murugan Chits"
                      value={form.firmName}
                      onChange={e => setForm({ ...form, firmName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07090e] border border-white/10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      City / Town
                    </label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Salem"
                        value={form.city}
                        onChange={e => setForm({ ...form, city: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07090e] border border-white/10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="10-digit mobile"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07090e] border border-white/10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all cursor-pointer"
                >
                  Continue to Admin Setup <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              <form onSubmit={handleStartTrial} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Selvakumar S."
                      value={form.fullName}
                      onChange={e => setForm({ ...form, fullName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07090e] border border-white/10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Work Email (For Login)
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="email"
                      required
                      placeholder="you@chits.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07090e] border border-white/10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07090e] border border-white/10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Confirm
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={form.confirmPassword}
                        onChange={e => setForm({ ...form, confirmPassword: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#07090e] border border-white/10 text-sm font-medium text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-2.5 text-xs text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.agreeTerms}
                      onChange={e => setForm({ ...form, agreeTerms: e.target.checked })}
                      className="mt-0.5 rounded border-white/20 bg-[#07090e] text-emerald-500 focus:ring-0 focus:outline-none w-4 h-4 cursor-pointer"
                    />
                    <span>
                      I have read and agree to the{' '}
                      <Link href="/legal/terms" target="_blank" className="text-emerald-400 font-bold hover:underline">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link href="/legal/privacy" target="_blank" className="text-emerald-400 font-bold hover:underline">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={loading}
                    className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Initializing Vault...
                      </>
                    ) : (
                      <>
                        Activate 30-Day Free Trial <CheckCircle2 size={16} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Guarantee Footer */}
          <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" /> Enterprise SSL
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-500" /> Full Features Included
            </span>
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-500" /> Instant Activation
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-6 text-center text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
            &copy; {new Date().getFullYear()} <span translate="no">CHITVAULT</span>. Developed by <span translate="no">SEYON NEXA LABS</span> (A subsidiary of <Link href="https://nvisionsystems.in" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline decoration-dotted text-slate-300 transition-colors" translate="no">NVISION SYSTEMS</Link>) &bull; v{APP_VERSION} ({APP_COMMIT_ID})
          </p>
        </div>
      </footer>
    </div>
  )
}
