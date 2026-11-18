import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { APP_VERSION, APP_COMMIT_ID } from '@/lib/utils'
import { ChitVaultLogo } from '@/components/ui/ChitVaultLogo'
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
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col selection:bg-slate-900 selection:text-white">
      {/* ── Top Navigation Bar ── */}
      <nav className="border-b border-slate-200/80 backdrop-blur-md bg-white/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <ChitVaultLogo size={40} showText subtitle="Auction Chit Fund OS" />
          </Link>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-xl hover:bg-slate-100 transition-all"
            >
              Sign In
            </Link>
            <Link 
              href="/start-trial" 
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-sm shadow-lg shadow-slate-900/10 transition-all hover:scale-105 active:scale-95"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none -z-0" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-[#0038b8] text-xs font-bold mb-6 shadow-sm">
            <Sparkles size={14} /> Built for Modern Indian Chit Funds & Operators
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
            The Digital Ledger for <br className="hidden sm:inline" />
            <span className="text-[#0038b8]">
              Transparent Auctions
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed mb-10">
            Eliminate ledger disputes, automate dividend splits, track defaulter streaks, and send instant WhatsApp payment receipts in seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/start-trial" 
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-base shadow-xl shadow-slate-900/15 flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
            >
              <span>Start 30-Day Free Trial</span>
              <ArrowRight size={18} />
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-base border border-slate-200 shadow-sm transition-all"
            >
              Sign In to Your Vault
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Full Auction Ledger Sync</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Zero Calculation Errors</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>Audit Prints & WhatsApp Receipts</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key Highlights / Feature Cards ── */}
      <section className="py-20 px-6 border-y border-slate-200/80 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-black text-[#0038b8] uppercase tracking-[0.2em] mb-3">Enterprise Grade</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Designed for Speed, Accuracy, and Member Trust
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-slate-50/80 border border-slate-200/80 hover:border-blue-400 hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#0038b8] mb-6 group-hover:scale-110 transition-transform">
                <Gavel size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Automated Auction Engine</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Record bids, discounts, and winners with one click. Dividends, foreman commission, and net monthly contributions compute instantly.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-slate-50/80 border border-slate-200/80 hover:border-emerald-400 hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                <MessageCircle size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Instant WhatsApp Receipts</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Generate clean, formatted payment receipts with installment breakdowns and send them directly to members via WhatsApp with one tap.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-slate-50/80 border border-slate-200/80 hover:border-indigo-400 hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Defaulter & Risk Radar</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Color-coded payment streaks distinguish recorded auctions from pending collections with aging analysis and one-click reminders.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ready CTA Section ── */}
      <section className="py-24 px-6 relative overflow-hidden bg-slate-50">
        <div className="max-w-4xl mx-auto rounded-3xl bg-white border border-slate-200 p-8 sm:p-14 text-center relative z-10 shadow-xl">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 p-1">
            <ChitVaultLogo size={48} />
          </div>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Ready to upgrade your chit fund management?
          </h3>
          <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto mb-8 font-medium">
            Join firms using ChitVault to run transparent, dispute-free chit funds. Start your 30-day free trial now.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/start-trial"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-base shadow-lg shadow-slate-900/10 transition-all hover:scale-105"
            >
              Start Free Trial Now
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-base transition-all"
            >
              Sign In to Existing Vault
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 py-10 px-6 text-xs text-slate-500 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <ChitVaultLogo size={24} />
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
              &copy; {new Date().getFullYear()} <span translate="no">CHITVAULT</span>. Developed by <span translate="no">SEYON NEXA LABS</span> (A subsidiary of <Link href="https://nvisionsystems.in" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 underline decoration-dotted text-slate-700 transition-colors" translate="no">NVISION SYSTEMS</Link>) &bull; v{APP_VERSION} ({APP_COMMIT_ID})
            </p>
          </div>
          <div className="flex items-center gap-6 text-[11px] font-bold uppercase tracking-wider shrink-0">
            <Link href="/plans" className="hover:text-slate-900 transition-colors">Pricing & Plans</Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">Sign In</Link>
            <Link href="/start-trial" className="text-[#0038b8] hover:underline font-extrabold">Start Free Trial</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
