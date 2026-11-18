import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { APP_VERSION, APP_COMMIT_ID } from '@/lib/utils'
import { ChitVaultLogo } from '@/components/ui/ChitVaultLogo'
import { 
  Building2, ShieldCheck, Gavel, ArrowRight, CheckCircle2, 
  TrendingUp, Users, MessageCircle, FileText, Lock, Sparkles, 
  Calculator, Receipt, RefreshCw, BarChart3, HelpCircle, ChevronRight,
  ShieldAlert, Clock, Smartphone, Layers
} from 'lucide-react'

export default async function HomePage() {
  // If already authenticated, redirect straight to the dashboard
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#F8FBFA] text-slate-900 flex flex-col selection:bg-[#0E7A88] selection:text-white">
      {/* ── Top Navigation Bar ── */}
      <nav className="border-b border-[#107B88]/15 backdrop-blur-md bg-white/85 sticky top-0 z-50 shadow-[0_2px_12px_-4px_rgba(16,123,136,0.06)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <ChitVaultLogo size={42} showText subtitle="Auction Chit Fund OS" />
          </Link>

          <div className="hidden md:flex items-center gap-7 text-xs font-bold uppercase tracking-wider text-slate-600">
            <a href="#features" className="hover:text-[#0E7A88] transition-colors">Features</a>
            <Link href="/schemes" className="hover:text-[#0E7A88] text-[#107B88] font-extrabold transition-colors">Auction Schemes</Link>
            <Link href="/plans" className="hover:text-[#0E7A88] transition-colors">Pricing & Plans</Link>
            <a href="#how-it-works" className="hover:text-[#0E7A88] transition-colors">How It Works</a>
            <a href="#interactive-preview" className="hover:text-[#0E7A88] transition-colors">Ledger Engine</a>
            <a href="#security" className="hover:text-[#0E7A88] transition-colors">Security</a>
            <a href="#faq" className="hover:text-[#0E7A88] transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-4">
            <Link 
              href="/login" 
              className="text-sm font-bold text-slate-600 hover:text-[#0E7A88] px-4 py-2 rounded-xl hover:bg-[#107B88]/5 transition-all"
            >
              Sign In
            </Link>
            <Link 
              href="/start-trial" 
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0C626D] via-[#107B88] to-[#128B9B] hover:from-[#0A525B] hover:to-[#0E7A88] text-white font-extrabold text-sm shadow-lg shadow-[#107B88]/20 transition-all hover:scale-105 active:scale-95"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section (Seyon Peacock Atmosphere) ── */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden">
        {/* Peacock Teal Radial Ambient Glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[500px] bg-gradient-to-tr from-[#107B88]/10 via-[#00B4D8]/8 to-emerald-400/5 rounded-full blur-[140px] pointer-events-none -z-0" />
        <div className="absolute top-10 right-10 w-72 h-72 bg-[#107B88]/5 rounded-full blur-[90px] pointer-events-none -z-0" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#107B88]/8 border border-[#107B88]/20 text-[#0C626D] text-xs font-bold mb-6 shadow-sm">
            <Sparkles size={14} className="text-[#00B4D8]" /> Seyon Digital Vault Architecture for Indian Chit Funds
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
            The Digital Ledger for <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-[#0A525B] via-[#107B88] to-[#0096C7] bg-clip-text text-transparent">
              Transparent Auctions
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed mb-10">
            Eliminate ledger disputes, automate monthly dividend splits, monitor subscriber payment streaks, and dispatch instant WhatsApp collection receipts.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/start-trial" 
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#0C626D] via-[#107B88] to-[#128B9B] hover:from-[#0A525B] hover:to-[#0E7A88] text-white font-extrabold text-base shadow-xl shadow-[#107B88]/25 flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
            >
              <span>Start 30-Day Free Trial</span>
              <ArrowRight size={18} />
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-[#107B88]/5 text-[#0C626D] font-bold text-base border border-[#107B88]/20 shadow-sm transition-all"
            >
              Sign In to Your Vault
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#107B88]" />
              <span>Full Auction Ledger Sync</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#107B88]" />
              <span>Zero Calculation Errors</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#107B88]" />
              <span>Audit Prints & WhatsApp Receipts</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Product Mockup Preview (Seyon Peacock Accent Core) ── */}
      <section id="interactive-preview" className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-3xl border border-[#107B88]/20 bg-white shadow-2xl p-6 sm:p-10 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0C626D] via-[#107B88] to-[#00B4D8]" />
            
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-[#107B88]" />
                <span className="text-xs font-mono font-bold text-slate-400 ml-2">CHITVAULT // GROUP-A 10L (20 MONTHS)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-[#107B88]/10 text-[#0C626D] text-xs font-extrabold uppercase tracking-wider">M7 Recorded (Apr-26)</span>
                <span className="px-2.5 py-1 rounded-lg bg-[#00B4D8]/10 text-[#0284C7] text-xs font-bold">Foreman 5% Locked</span>
              </div>
            </div>

            {/* Simulated Live Ledger Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total Chit Value</div>
                <div className="text-2xl font-black text-slate-900 mt-1">₹10,00,000</div>
                <div className="text-xs text-slate-500 mt-1">₹50,000 × 20 Members</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Winning Auction Bid</div>
                <div className="text-2xl font-black text-rose-600 mt-1">₹2,80,000</div>
                <div className="text-xs text-slate-500 mt-1">Discount: 28% (Under 30% Cap)</div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/70">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">Net Prize Payout</div>
                <div className="text-2xl font-black text-[#0C626D] mt-1">₹7,20,000</div>
                <div className="text-xs text-[#107B88] font-semibold mt-1">Winner: Ticket #12 (M. Ramesh)</div>
              </div>

              <div className="p-5 rounded-2xl bg-[#107B88]/8 border border-[#107B88]/20">
                <div className="text-[11px] font-black uppercase tracking-wider text-[#0C626D]">Member Net Due</div>
                <div className="text-2xl font-black text-[#08424A] mt-1">₹38,500</div>
                <div className="text-xs text-[#0C626D] font-semibold mt-1">Dividend credited: ₹11,500/head</div>
              </div>
            </div>

            {/* Streak & Defaulter Visual Bar in Seyon Teal */}
            <div className="mt-8 p-5 rounded-2xl bg-slate-50/80 border border-slate-200/70">
              <div className="flex items-center justify-between text-xs font-bold mb-3">
                <span className="text-slate-600">Cycle Streak Tracker (Active Member Group Progress)</span>
                <span className="text-slate-400 font-mono">Cycle 7 of 20</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex-1 min-w-[28px] h-8 rounded-lg bg-[#107B88] text-white flex items-center justify-center text-[10px] font-bold shadow-sm" title={`Auction Month M${i+1} Recorded`}>
                    M{i+1}
                  </div>
                ))}
                {[...Array(13)].map((_, i) => (
                  <div key={i} className="flex-1 min-w-[28px] h-8 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 flex items-center justify-center text-[10px] font-bold" title={`Upcoming Cycle M${i+8}`}>
                    M{i+8}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Key Highlights / Feature Cards ── */}
      <section id="features" className="py-20 px-6 border-y border-[#107B88]/15 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-black text-[#107B88] uppercase tracking-[0.2em] mb-3">Enterprise Grade</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Designed for Speed, Accuracy, and Member Trust
            </h3>
            <p className="text-sm text-slate-500 mt-3 font-medium">
              Every workflow engineered to eliminate manual disputes between foremen, subscribers, and collection agents.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="p-8 rounded-3xl bg-[#F8FBFA] border border-slate-200/80 hover:border-[#107B88] hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-[#107B88]/10 border border-[#107B88]/20 flex items-center justify-center text-[#107B88] mb-6 group-hover:scale-110 transition-transform">
                <Gavel size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Automated Auction Engine</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Record bids, discounts, and winners with one click. Dividends, foreman commission, and net monthly contributions compute instantly.
              </p>
            </div>

            {/* Card 2 */}
            <div className="p-8 rounded-3xl bg-[#F8FBFA] border border-slate-200/80 hover:border-[#107B88] hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-[#107B88]/10 border border-[#107B88]/20 flex items-center justify-center text-[#107B88] mb-6 group-hover:scale-110 transition-transform">
                <MessageCircle size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Instant WhatsApp Receipts</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Generate clean, formatted payment receipts with installment breakdowns and send them directly to members via WhatsApp with one tap.
              </p>
            </div>

            {/* Card 3 */}
            <div className="p-8 rounded-3xl bg-[#F8FBFA] border border-slate-200/80 hover:border-[#107B88] hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-[#107B88]/10 border border-[#107B88]/20 flex items-center justify-center text-[#107B88] mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Defaulter & Risk Radar</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Color-coded payment streaks distinguish recorded auctions from pending collections with aging analysis and one-click reminders.
              </p>
            </div>

            {/* Card 4 */}
            <div className="p-8 rounded-3xl bg-[#F8FBFA] border border-slate-200/80 hover:border-[#107B88] hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-[#107B88]/10 border border-[#107B88]/20 flex items-center justify-center text-[#107B88] mb-6 group-hover:scale-110 transition-transform">
                <Calculator size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Audit-Ready Ledger Sync</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Change scheme start dates or correct mistakes without breaking historical balance integrity. Built-in interactive ledger recalculation console.
              </p>
            </div>

            {/* Card 5 */}
            <div className="p-8 rounded-3xl bg-[#F8FBFA] border border-slate-200/80 hover:border-[#107B88] hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-[#107B88]/10 border border-[#107B88]/20 flex items-center justify-center text-[#107B88] mb-6 group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Thermal & A4 Print Formats</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Print 80mm thermal receipts for daily collection agents or full A4 group statements with your firm branding and audit watermarks.
              </p>
            </div>

            {/* Card 6 */}
            <div className="p-8 rounded-3xl bg-[#F8FBFA] border border-slate-200/80 hover:border-[#107B88] hover:bg-white hover:shadow-xl transition-all group">
              <div className="w-12 h-12 rounded-2xl bg-[#107B88]/10 border border-[#107B88]/20 flex items-center justify-center text-[#107B88] mb-6 group-hover:scale-110 transition-transform">
                <Lock size={24} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Multi-Tenant Data Isolation</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Every chit firm has its own encrypted schema space. Member KYC, transactions, and auction figures remain completely private to your firm.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works (Step-by-Step Flow) ── */}
      <section id="how-it-works" className="py-24 px-6 bg-[#F8FBFA]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-black text-[#107B88] uppercase tracking-[0.2em] mb-3">Simple 3-Step Operations</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              From Member Onboarding to Final Payout
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Step 1 */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative z-10 hover:border-[#107B88]/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#0C626D] text-white font-black flex items-center justify-center mb-6 shadow-sm">1</div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Create Group & Assign Tickets</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Define the chit value, duration, and foreman commission (e.g., 5%). Enroll members and allocate ticket numbers.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-3xl bg-white border border-[#107B88]/30 shadow-md relative z-10 hover:shadow-xl transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#107B88] text-white font-black flex items-center justify-center mb-6">2</div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Conduct Auction & Auto-Split</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Enter the lowest bid/discount. ChitVault instantly deducts the discount, credits equal dividends to all subscribers, and sets net dues.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative z-10 hover:border-[#107B88]/40 transition-all">
              <div className="w-10 h-10 rounded-xl bg-[#0096C7] text-white font-black flex items-center justify-center mb-6">3</div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Collect & Share Receipts</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Log cash/UPI collections. Dispatch instant WhatsApp receipts directly to the subscriber&apos;s phone with live passbook updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Compliance & Legal Integrity ── */}
      <section id="security" className="py-20 px-6 bg-white border-y border-[#107B88]/15">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="w-full md:w-1/2">
            <div className="w-14 h-14 rounded-2xl bg-[#107B88]/10 border border-[#107B88]/20 flex items-center justify-center text-[#107B88] mb-6">
              <ShieldCheck size={32} />
            </div>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">
              Designed for Audit Compliance & Peace of Mind
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              ChitVault is built strictly as a secondary accounting, dividend distribution, and reconciliation tool. We enforce safety auction floors, prevent over-discounting, and maintain an immutable ledger audit trail.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <CheckCircle2 size={18} className="text-[#107B88]" />
                <span>Enforced 30% or 40% Auction Discount Ceilings</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <CheckCircle2 size={18} className="text-[#107B88]" />
                <span>Tamil & English Bilingual Ledger Mode</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <CheckCircle2 size={18} className="text-[#107B88]" />
                <span>Strict 10-Digit Mobile Number Validation</span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-1/2 bg-[#F8FBFA] p-8 rounded-3xl border border-slate-200">
            <h4 className="text-xs font-black uppercase tracking-widest text-[#0C626D] mb-4">The Mathematical Ground Truth</h4>
            <div className="space-y-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-400 mb-1">Dividend per Member</div>
                <div className="font-bold text-slate-900">Dividend = (Auction Discount − Foreman Comm.) ÷ Total Members</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-400 mb-1">Subscriber Net Monthly Installment</div>
                <div className="font-bold text-slate-900">Net Due = Standard Installment − Individual Dividend</div>
              </div>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                <div className="text-slate-400 mb-1">Prize Payout to Auction Winner</div>
                <div className="font-bold text-[#0C626D]">Net Payout = Chit Gross Value − Auction Discount</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section id="faq" className="py-24 px-6 bg-[#F8FBFA]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xs font-black text-[#107B88] uppercase tracking-[0.2em] mb-3">Questions & Answers</h2>
            <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-[#107B88]/30 transition-all">
              <h4 className="font-bold text-base text-slate-900 mb-2">Can I edit auction dates if our monthly meeting was rescheduled?</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Yes. ChitVault allows you to update the start date or actual auction dates. The dynamic ledger sync console aligns all month badges (`M1 (Apr-26)`) with the actual recorded auction date while safeguarding financial invariants.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-[#107B88]/30 transition-all">
              <h4 className="font-bold text-base text-slate-900 mb-2">Do members need to install an app to get payment receipts?</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                No app installation required for members. When cashiers record payments, one click sends a clean, pre-formatted WhatsApp message detailing amount, ticket number, firm name, and applied installment month.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-[#107B88]/30 transition-all">
              <h4 className="font-bold text-base text-slate-900 mb-2">Can multiple users access the system at the same time?</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Yes. ChitVault supports role-based access for Firm Owners, Office Staff, and Field Collection Agents with real-time audit updates.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-[#107B88]/30 transition-all">
              <h4 className="font-bold text-base text-slate-900 mb-2">Is my firm data accessible to anyone else?</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                Never. ChitVault uses isolated tenant schemas and Row-Level Security (RLS) policies. Only authenticated operators linked to your firm slug can access your accounts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Ready CTA Section (Crisp Seyon Light Card with Peacock Accents) ── */}
      <section className="py-20 px-6 relative overflow-hidden bg-white border-t border-[#107B88]/15">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-[#F0FDF4] via-[#F4FBFA] to-[#E6F7F9] border-2 border-[#107B88]/25 p-8 sm:p-14 text-center relative z-10 shadow-xl">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center bg-white rounded-2xl border border-[#107B88]/20 shadow-md p-1">
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
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#0C626D] via-[#107B88] to-[#128B9B] hover:from-[#0A525B] hover:to-[#0E7A88] text-white font-extrabold text-base shadow-xl shadow-[#107B88]/25 flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95"
            >
              <span>Start 30-Day Free Trial</span>
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white hover:bg-[#107B88]/5 text-[#0C626D] font-bold text-base border border-[#107B88]/25 shadow-sm transition-all"
            >
              Sign In to Existing Vault
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 py-12 px-6 text-xs text-slate-500 bg-[#F8FBFA]">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Top Row: Logo & Navigation Links */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <ChitVaultLogo size={28} />
              <div className="text-left">
                <span className="font-extrabold text-sm text-slate-800 tracking-tight block">CHITVAULT</span>
                <span className="text-[10px] text-slate-400 font-medium">Smart Ledger & Auction Engine for Chit Funds</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold uppercase tracking-wider">
              <Link href="/schemes" className="hover:text-[#107B88] transition-colors">Auction Schemes</Link>
              <Link href="/plans" className="hover:text-[#107B88] transition-colors">Pricing & Plans</Link>
              <Link href="/legal/terms" className="hover:text-[#107B88] transition-colors">Terms of Service</Link>
              <Link href="/legal/disclaimer" className="hover:text-[#107B88] transition-colors">Regulatory Disclaimer</Link>
              <Link href="/legal/privacy" className="hover:text-[#107B88] transition-colors">Privacy Policy</Link>
              <Link href="/login" className="hover:text-[#107B88] transition-colors">Sign In</Link>
              <Link href="/start-trial" className="text-[#107B88] hover:underline font-extrabold">Start Free Trial</Link>
            </div>
          </div>

          {/* Separate Last Row: Copyright & Developer Credit */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-[11px] text-slate-500 font-medium">
            <p>
              &copy; {new Date().getFullYear()} <span className="font-bold text-slate-700" translate="no">CHITVAULT</span>. All rights reserved.
            </p>
            <p className="uppercase tracking-widest text-[10px] text-slate-400 font-bold">
              Developed by <span className="text-slate-700" translate="no">SEYON NEXA LABS</span> (A subsidiary of <Link href="https://nvisionsystems.in" target="_blank" rel="noopener noreferrer" className="hover:text-[#107B88] underline decoration-dotted text-slate-600 transition-colors" translate="no">NVISION SYSTEMS</Link>) &bull; v{APP_VERSION} ({APP_COMMIT_ID})
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
