'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ArrowLeft, CheckCircle2, ShieldCheck, Zap, Sparkles, Building2, 
  MessageCircle, Printer, Lock, ChevronRight, HelpCircle, PhoneCall
} from 'lucide-react'
import { ChitVaultLogo } from '@/components/ui/ChitVaultLogo'
import { Badge, Btn, Card } from '@/components/ui'
import { APP_VERSION, APP_COMMIT_ID } from '@/lib/utils'

interface PricingTier {
  id: string
  name: string
  badge?: string
  popular?: boolean
  setupFee: string
  amc: string
  period: string
  description: string
  groupLimit: string
  memberLimit: string
  features: string[]
  ctaText: string
  ctaHref: string
  ctaVariant: 'primary' | 'secondary' | 'outline'
}

const TIERS: PricingTier[] = [
  {
    id: 'trial',
    name: '30-Day Free Trial',
    badge: 'No Credit Card Required',
    setupFee: '₹0',
    amc: 'Free for 30 Days',
    period: 'Instant Self-Serve Access',
    description: 'Perfect for exploring the digital ledger, conducting test auctions, and setting up member rosters.',
    groupLimit: 'Up to 2 Chit Groups',
    memberLimit: 'Up to 20 Subscribers',
    features: [
      'Automated Reverse Auction Engine',
      'Instant WhatsApp Payment Receipts',
      'Streak & Defaulter Aging Radar',
      'A4 & Thermal 80mm Receipt Prints',
      'Bilingual Tamil & English Mode',
      'Full Double-Entry Ledger Recalculation',
      'Encrypted Tenant Isolation'
    ],
    ctaText: 'Start Free Trial',
    ctaHref: '/start-trial',
    ctaVariant: 'secondary'
  },
  {
    id: 'basic',
    name: 'Standard Growth',
    badge: 'Most Popular for Small Firms',
    popular: true,
    setupFee: '₹2,000',
    amc: '₹1,000 / year',
    period: 'One-Time Onboarding + Yearly Maintenance',
    description: 'Engineered for registered proprietors, family chit operators, and local finance syndicates.',
    groupLimit: 'Up to 10 Active Chit Groups',
    memberLimit: 'Up to 200 Subscribers',
    features: [
      'Everything in Free Trial',
      'Higher Group Capacity (10 Groups)',
      'Up to 200 Managed Member Accounts',
      'Staff Role Permissions (Owner & Cashier)',
      'Automated Backup & Cloud Sync',
      'Historical Ledger Rescheduling Console',
      'Priority WhatsApp Operator Support'
    ],
    ctaText: 'Activate Standard Plan',
    ctaHref: 'https://wa.me/917397503761?text=Hi%20ChitVault,%20I%20would%20like%20to%20activate%20the%20Standard%20Growth%20Plan',
    ctaVariant: 'primary'
  },
  {
    id: 'pro',
    name: 'Professional Scale',
    badge: 'Unlimited Groups & Members',
    setupFee: '₹5,000',
    amc: '₹2,500 / year',
    period: 'Full Commercial Deployment',
    description: 'Ideal for established commercial chit fund companies operating multiple concurrent schemes.',
    groupLimit: 'Unlimited Chit Groups',
    memberLimit: 'Unlimited Subscribers',
    features: [
      'Everything in Standard Growth',
      'Unlimited Active Chit Groups & Cycles',
      'Unlimited Member Passbooks & Tickets',
      'Custom Firm Branding (Receipts & Logos)',
      'Multi-User Staff & Field Agent Logins',
      'Consolidated Auditor Year-End Reports',
      'Direct Phone & SLA Technical Support'
    ],
    ctaText: 'Upgrade to Pro Scale',
    ctaHref: 'https://wa.me/917397503761?text=Hi%20ChitVault,%20I%20would%20like%20to%20upgrade%20to%20the%20Pro%20Scale%20Plan',
    ctaVariant: 'secondary'
  },
  {
    id: 'perpetual',
    name: 'Perpetual Enterprise',
    badge: 'Lifetime Deployment License',
    setupFee: '₹29,999',
    amc: '₹10,000 / year (Optional AMC)',
    period: 'Perpetual License Guarantee',
    description: 'Tailored for large private financial enterprises desiring perpetual licensing and customized modules.',
    groupLimit: 'Unlimited Groups & Cycles',
    memberLimit: 'Unlimited Subscribers',
    features: [
      'Perpetual Enterprise Software License',
      'Self-Hosted or Dedicated Cloud Server Option',
      'Customized Scheme Calculation Rules',
      'White-Labeled Subdomain Setup',
      'Direct Database Access & Automated SQL Dumps',
      'Dedicated Account Manager'
    ],
    ctaText: 'Contact Enterprise Sales',
    ctaHref: 'https://wa.me/917397503761?text=Hi%20ChitVault,%20I%20am%20interested%20in%20the%20Perpetual%20Enterprise%20Plan',
    ctaVariant: 'outline'
  }
]

export default function PlansPage() {
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<'standard' | 'annual'>('standard')

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col justify-between selection:bg-slate-900 selection:text-white">
      {/* ── Top Header Navigation ── */}
      <nav className="border-b border-slate-200/80 backdrop-blur-md bg-white/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <ChitVaultLogo size={40} showText subtitle="Transparent Pricing" />
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

      {/* ── Hero Heading ── */}
      <main className="max-w-7xl mx-auto px-6 py-16 lg:py-24 flex-1">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-[#1e3360] text-xs font-bold mb-4 shadow-sm">
            <Sparkles size={14} className="text-[#38bdf8]" /> Transparent Pricing for Transparent Auctions
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4">
            Predictable Plans for Every Chit Firm
          </h1>
          <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
            Start with our 30-day free trial. Scale into commercial tiers with zero hidden transaction commissions.
          </p>
        </div>

        {/* ── 4-Tier Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {TIERS.map(tier => {
            const isPopular = tier.popular

            return (
              <div 
                key={tier.id}
                className={`p-7 rounded-3xl flex flex-col justify-between transition-all relative ${
                  isPopular 
                    ? 'bg-white border-2 border-[#107B88] shadow-2xl scale-[1.02] z-10' 
                    : 'bg-white border border-slate-200 shadow-sm hover:shadow-md'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-[#0C626D] to-[#107B88] text-white text-[10px] font-black uppercase tracking-widest shadow-md">
                    Recommended
                  </div>
                )}

                <div>
                  <div className="mb-4">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">
                      {tier.badge}
                    </span>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">
                      {tier.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed min-h-[36px]">
                      {tier.description}
                    </p>
                  </div>

                  {/* Price Block */}
                  <div className="py-5 border-y border-slate-100 my-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-black text-slate-900">{tier.setupFee}</span>
                      <span className="text-xs text-slate-400 font-bold">setup</span>
                    </div>
                    <div className="text-xs font-bold text-emerald-700 mt-1">
                      + {tier.amc}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {tier.period}
                    </div>
                  </div>

                  {/* Limits Badge */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-6 space-y-1 text-xs font-semibold">
                    <div className="text-slate-700 flex items-center justify-between">
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Groups:</span>
                      <span>{tier.groupLimit}</span>
                    </div>
                    <div className="text-slate-700 flex items-center justify-between">
                      <span className="text-[10px] uppercase text-slate-400 font-bold">Members:</span>
                      <span>{tier.memberLimit}</span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-3 mb-8">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Included Capabilities
                    </div>
                    <ul className="space-y-2.5">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs font-medium text-slate-600">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action CTA */}
                <div>
                  <a
                    href={tier.ctaHref}
                    target={tier.ctaHref.startsWith('http') ? '_blank' : '_self'}
                    rel="noopener noreferrer"
                    className={`w-full py-3.5 rounded-2xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center transition-all ${
                      isPopular
                        ? 'bg-gradient-to-r from-[#0C626D] via-[#107B88] to-[#128B9B] hover:from-[#0A525B] hover:to-[#0E7A88] text-white shadow-lg shadow-[#107B88]/25 hover:scale-[1.02]'
                        : 'bg-slate-100 hover:bg-[#107B88]/10 text-slate-800 hover:text-[#0C626D]'
                    }`}
                  >
                    {tier.ctaText}
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── FAQ & Guarantee ── */}
        <div className="mt-20 max-w-4xl mx-auto rounded-3xl bg-white border border-slate-200 p-8 sm:p-12 shadow-sm space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Frequently Asked Subscription Questions
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Need assistance selecting a tier? Our support team is available on WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-900 mb-1">What happens when the 30-day trial expires?</h4>
              <p className="text-slate-600">
                Your data remains 100% safe. You can upgrade to the Standard or Pro plan at any time without losing any recorded auctions or collection receipts.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-900 mb-1">Are there any transaction fees on collections?</h4>
              <p className="text-slate-600">
                Zero. ChitVault never charges any percentage on your members&apos; chit collections, prize money, or dividends. You only pay the flat software fee.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-900 mb-1">Can I upgrade my tier later as my firm expands?</h4>
              <p className="text-slate-600">
                Yes. You can seamlessly upgrade from Standard to Pro or Perpetual with one click. Your group limits expand instantly.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <h4 className="font-bold text-slate-900 mb-1">How do I renew my annual maintenance (AMC)?</h4>
              <p className="text-slate-600">
                Your superadmin dashboard provides live renewal alerts 30 days before expiration with direct UPI and invoice payment options.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-semibold">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>Full Data Ownership & Bank-Grade Security</span>
            </div>
            <a 
              href="https://wa.me/917397503761?text=Hi%20ChitVault,%20I%20have%20a%20question%20about%20pricing%20plans" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#107B88] font-bold hover:underline flex items-center gap-1.5"
            >
              <PhoneCall size={14} /> Talk to Sales on WhatsApp
            </a>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 py-10 px-6 text-xs text-slate-500 bg-white">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Top Row: Logo & Navigation Links */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <ChitVaultLogo size={28} />
              <div className="text-left">
                <span className="font-extrabold text-sm text-slate-800 tracking-tight block">CHITVAULT</span>
                <span className="text-[10px] text-slate-400 font-medium">Smart Ledger & Auction Engine for Chit Funds</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-[11px] font-bold uppercase tracking-wider">
              <Link href="/" className="hover:text-[#107B88] transition-colors">Home</Link>
              <Link href="/schemes" className="hover:text-[#107B88] transition-colors">Schemes</Link>
              <Link href="/legal/terms" className="hover:text-[#107B88] transition-colors">Terms of Service</Link>
              <Link href="/legal/privacy" className="hover:text-[#107B88] transition-colors">Privacy Policy</Link>
              <Link href="/login" className="hover:text-[#107B88] transition-colors">Sign In</Link>
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
