import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { APP_VERSION, APP_COMMIT_ID } from '@/lib/utils'
import { 
  Building2, ShieldCheck, Gavel, ArrowRight, CheckCircle2, 
  TrendingUp, Users, MessageCircle, FileText, Lock, Sparkles, ChevronRight
} from 'lucide-react'

export default async function HomePage() {
  // If already authenticated, redirect straight to the dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-emerald-500 selection:text-black">
      {/* ── Top Navigation Bar ── */}
      <nav className="border-b border-white/5 backdrop-blur-md bg-[#07090e]/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              CV
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-white block">ChitVault</span>
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest leading-none">Chit Fund OS</span>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-bold text-slate-300 hover:text-white px-4 py-2 rounded-xl hover:bg-white/5 transition-all"
            >
              Sign In
            </Link>
            <Link 
              href="/start-trial" 
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-sm shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6">
            <Sparkles size={14} /> Built for Modern Indian Chit Funds & Operators
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white leading-[1.1] mb-6">
            The Digital Ledger for <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Transparent Auctions
            </span> & Collections
          </h1>
          <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto font-normal leading-relaxed mb-10">
            Eliminate paperwork, eliminate calculation disputes. Automate bidding, dividend splits, member passbooks, and instant WhatsApp receipts.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
            <Link 
              href="/start-trial" 
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-base shadow-2xl shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              Start 30-Day Free Trial <ArrowRight size={18} />
            </Link>
            <a 
              href="https://wa.me/917397503761?text=Hi%20ChitVault,%20I%20would%20like%20a%20demo%20for%20my%20chit%20firm" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-base transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={18} className="text-emerald-400" /> Book WhatsApp Demo
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-500" /> 30-Day Free Trial
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-500" /> No Credit Card Required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-emerald-500" /> Instant Activation
            </span>
          </div>
        </div>

        {/* Decorative Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none -z-0" />
      </section>

      {/* ── Feature Cards Grid ── */}
      <section className="py-20 px-6 border-t border-white/5 bg-[#0b0f19]/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Enterprise Core</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Engineered for Audit-Grade Accuracy
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-[#0e1320] border border-white/5 hover:border-emerald-500/30 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
                <Gavel size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Automated Auction Engine</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Supports Standard Dividend, N vs N-1 divisors, foreman commission caps, and legal 5% limits with retroactive sync.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-[#0e1320] border border-white/5 hover:border-emerald-500/30 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6 group-hover:scale-110 transition-transform">
                <MessageCircle size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Instant WhatsApp Receipts</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Generate clean, formatted payment receipts with installment breakdowns and send them directly to members via WhatsApp with one tap.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-[#0e1320] border border-white/5 hover:border-emerald-500/30 transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <h4 className="text-xl font-bold text-white mb-2">Defaulter & Risk Radar</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Color-coded payment streaks distinguish recorded auctions from pending collections with aging analysis and one-click reminders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ready CTA Section ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900 to-[#0b0f19] border border-emerald-500/20 p-8 sm:p-14 text-center relative z-10 shadow-2xl">
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to upgrade your chit fund management?
          </h3>
          <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Join firms using ChitVault to run transparent, dispute-free chit funds. Start your 30-day free trial now.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/start-trial"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-base shadow-xl shadow-emerald-500/20 transition-all hover:scale-105"
            >
              Start Free Trial Now
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-base border border-white/10 transition-all"
            >
              Sign In to Existing Vault
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 py-10 px-6 text-xs text-slate-500 bg-[#07090e]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg bg-emerald-500 text-black font-bold text-[10px] flex items-center justify-center">CV</div>
              <span className="font-bold text-slate-300" translate="no">CHITVAULT</span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              &copy; {new Date().getFullYear()} <span translate="no">CHITVAULT</span>. Developed by <span translate="no">SEYON NEXA LABS</span> (A subsidiary of <Link href="https://nvisionsystems.in" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 underline decoration-dotted text-slate-300 transition-colors" translate="no">NVISION SYSTEMS</Link>) &bull; v{APP_VERSION} ({APP_COMMIT_ID})
            </p>
          </div>
          <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-wider shrink-0">
            <Link href="/plans" className="hover:text-slate-300 transition-colors">Pricing & Plans</Link>
            <Link href="/login" className="hover:text-slate-300 transition-colors">Sign In</Link>
            <Link href="/start-trial" className="text-emerald-400 hover:underline">Start Free Trial</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
