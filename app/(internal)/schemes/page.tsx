'use client'

import React, { useState } from 'react'
import { 
  ArrowLeft, BookOpen, Calculator, Gavel, Scale, ShieldCheck, Zap, 
  Layers, Shuffle, Lock, Clock, TrendingUp, HelpCircle, CheckCircle2,
  ChevronDown, ChevronRight, AlertCircle, Printer, Sparkles
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useFirm } from '@/lib/firm/context'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Btn, Card } from '@/components/ui'
import { APP_NAME } from '@/lib/utils'

interface SchemeDetail {
  id: string
  name: string
  tamilName: string
  tag: string
  color: string
  badgeVariant: 'accent' | 'success' | 'gray' | 'danger'
  shortDesc: string
  fullDesc: string
  bestFor: string
  memberInstallmentType: 'Variable (Reduced by Dividend)' | 'Fixed' | 'Escalating'
  commissionMode: string
  howAuctionWorks: string
  formula: {
    winnerPayout: string
    memberNetDue: string
    commission: string
  }
  pros: string[]
  cons: string[]
  example: {
    pot: string
    discount: string
    commission: string
    netPayout: string
    memberDue: string
  }
}

const SCHEMES: SchemeDetail[] = [
  {
    id: 'DIVIDEND_SHARE',
    name: 'Dividend Sharing Scheme',
    tamilName: 'தவணை தள்ளுபடி முறை (Standard Reverse Auction)',
    tag: 'Industry Standard',
    color: '#004db8',
    badgeVariant: 'accent',
    shortDesc: 'The classic Indian reverse auction model governed by the Chit Funds Act, 1982. Auction discounts are distributed immediately back to subscribers as monthly savings.',
    fullDesc: 'Subscribers bid by sacrificing an auction discount. After deducting the statutory 5% foreman commission, the entire remaining discount is split equally across all members, reducing the next month installment payable.',
    bestFor: 'General commercial chits, small business syndicates, peer savings circles seeking instant monthly savings.',
    memberInstallmentType: 'Variable (Reduced by Dividend)',
    commissionMode: 'Standard 5% of Pot deducted from Auction Discount',
    howAuctionWorks: 'Bidders compete in open or sealed bids to offer the discount they are willing to forego. The member offering the highest discount wins the prize pool.',
    formula: {
      winnerPayout: 'Net Payout = Chit Gross Value − Auction Discount',
      memberNetDue: 'Net Monthly Due = Monthly Installment − (Net Discount ÷ Total Members)',
      commission: 'Foreman Commission = Min(5% of Pot, Statutory Ceiling)'
    },
    pros: [
      'Immediate monthly savings passed directly to every non-prized subscriber',
      'High member trust with transparent mathematical dividend distribution',
      'Zero manual guesswork; fully compliant with state chit registrar norms'
    ],
    cons: [
      'Monthly collections fluctuate based on discount volatility'
    ],
    example: {
      pot: '₹10,00,000 (20 Members × ₹50,000)',
      discount: '₹2,50,000 (25% Winning Bid)',
      commission: '₹50,000 (5% Foreman Commission)',
      netPayout: '₹7,50,000 to Auction Winner',
      memberDue: '₹40,000/member (₹10,000 Dividend Credited)'
    }
  },
  {
    id: 'ACCUMULATION',
    name: 'Accumulation / Early Closure Scheme',
    tamilName: 'சேமிப்பு இருப்பு முறை (Surplus Pool Model)',
    tag: 'Predictable Monthly Cashflow',
    color: '#059669',
    badgeVariant: 'success',
    shortDesc: 'Subscribers pay a fixed installment every month. Auction discounts accumulate into a secured Surplus Pool that triggers early group closure.',
    fullDesc: 'Instead of dividing the discount into tiny monthly dividends, discounts are held in a cumulative firm pool. Once the Total Accumulated Surplus covers all remaining member obligations, the group closes 3 to 6 months ahead of schedule without requiring further payments.',
    bestFor: 'Gold-backed chits, corporate groups, and disciplined savers who prefer predictable fixed bank-debit installments.',
    memberInstallmentType: 'Fixed',
    commissionMode: 'Deducted from Winner Payout or Pool',
    howAuctionWorks: 'Members bid discounts to claim the pool early. The sacrificed amount is credited into the group reserve rather than adjusting monthly dues.',
    formula: {
      winnerPayout: 'Net Payout = Chit Value − Auction Discount − Commission',
      memberNetDue: 'Monthly Installment = Fixed ₹ (Zero Monthly Fluctuation)',
      commission: 'Early Closure Trigger: Accumulated Surplus ≥ (Monthly Installment × Remaining Months)'
    },
    pros: [
      'Exact fixed monthly collection makes cashflow 100% predictable for staff and banks',
      'Subscribers enjoy 3 to 6 months of free waiver at the end of the term',
      'Simplifies collection receipts and eliminating dividend calculation confusion'
    ],
    cons: [
      'No immediate monthly cash relief until the early closure trigger is reached'
    ],
    example: {
      pot: '₹5,00,000 (20 Members × ₹25,000)',
      discount: '₹1,00,000 (20% Winning Bid)',
      commission: '₹25,000 (5% Foreman Commission)',
      netPayout: '₹3,75,000 to Winner',
      memberDue: 'Fixed ₹25,000 (Surplus Pool increases by ₹75,000)'
    }
  },
  {
    id: 'HYBRID_SPLIT',
    name: 'Hybrid Split Scheme',
    tamilName: 'இருவகை பகிர்வு முறை (Part Dividend, Part Surplus)',
    tag: 'Balanced Growth',
    color: '#d97706',
    badgeVariant: 'accent',
    shortDesc: 'A balanced model where a configured percentage (e.g. 50%) is distributed as monthly dividends, and the rest is saved in the surplus reserve.',
    fullDesc: 'Combines the best of both worlds: members receive an instant installment relief every month, while building a reserve pool that leads to early maturity or a year-end bonus.',
    bestFor: 'Community financing cooperatives and progressive operators wanting both low dues and safety reserves.',
    memberInstallmentType: 'Variable (Reduced by Dividend)',
    commissionMode: 'Standard Foreman Commission deducted before split',
    howAuctionWorks: 'Net discount after foreman commission is split according to the group ratio (e.g., 50% Dividend / 50% Surplus Pool).',
    formula: {
      winnerPayout: 'Net Payout = Chit Value − Auction Discount',
      memberNetDue: 'Net Due = Installment − ((Net Discount × DividendSplit%) ÷ Total Members)',
      commission: 'Surplus Added = Net Discount × (1 − DividendSplit%)'
    },
    pros: [
      'Flexible ratio configuration tailored to subscriber risk appetite',
      'Provides immediate discounts while cushioning against late-cycle defaults'
    ],
    cons: [
      'Requires subscribers to understand both dividend credits and pool reserves'
    ],
    example: {
      pot: '₹10,00,000 (20 Members × ₹50,000)',
      discount: '₹2,00,000 (Net Discount after 5% comm = ₹1,50,000)',
      commission: '₹50,000 Foreman Commission',
      netPayout: '₹8,00,000 to Winner',
      memberDue: '₹46,250/member (₹3,750 Dividend) + ₹75,000 added to Pool'
    }
  },
  {
    id: 'BOUNDED_AUCTION',
    name: 'Bounded Auction Scheme',
    tamilName: 'வரம்பிற்குட்பட்ட ஏல முறை (Floor & Ceiling Caps)',
    tag: 'Risk Controlled',
    color: '#7c3aed',
    badgeVariant: 'accent',
    shortDesc: 'Enforces statutory or firm-defined bid floors (e.g., minimum 7.5%) and ceilings (e.g., maximum 30% or 40%) to eliminate predatory bidding.',
    fullDesc: 'Under traditional open auctions, desperate borrowers might bid 45% or 50% discounts, causing future repayment defaults. Bounded auctions strictly limit bids between a safety floor and a legal cap. When multiple members bid the ceiling, lots are drawn.',
    bestFor: 'High-value chit funds, regulated institutional firms, and conservative syndicates.',
    memberInstallmentType: 'Variable (Reduced by Dividend)',
    commissionMode: 'Standard 5% of Pot',
    howAuctionWorks: 'Bids below the floor or above the ceiling are mathematically rejected. Tie-breaking draws lots among ceiling bidders.',
    formula: {
      winnerPayout: 'Net Payout = Chit Value − Clamped Auction Discount',
      memberNetDue: 'Net Due = Installment − (Net Clamped Discount ÷ Total Members)',
      commission: 'Enforced Constraint: Floor% ≤ Bid% ≤ Ceiling%'
    },
    pros: [
      'Protects borrowers from predatory discounts and unpayable monthly burdens',
      'Guarantees fair minimum returns for patient investor members',
      'Directly enforces the statutory 40% cap mandated by the Chit Funds Amendment Act'
    ],
    cons: [
      'Ceiling ties require lot-drawing protocol'
    ],
    example: {
      pot: '₹10,00,000 (Floor: 10%, Ceiling: 30%)',
      discount: 'Max Allowed Bid = ₹3,00,000 (Clamped if member bids ₹3.5L)',
      commission: '₹50,000 Foreman Commission',
      netPayout: 'Minimum ₹7,00,000 Payout Guaranteed to Winner',
      memberDue: 'Cap ensures dividends never exceed statutory guidelines'
    }
  },
  {
    id: 'LOTTERY',
    name: 'Lottery / Lucky Draw Scheme',
    tamilName: 'குலுக்கல் முறை (Zero Discount / Equal Payout)',
    tag: 'Zero Discount',
    color: '#2563eb',
    badgeVariant: 'gray',
    shortDesc: 'No bidding or discounts. Each month, the winner is determined by transparent lucky draw or token lottery, receiving the full prize pool.',
    fullDesc: 'Popular among welfare groups, merchant associations, and friends circles. Every subscriber receives the identical full prize pool once during the cycle with zero interest or discount sacrificed.',
    bestFor: 'Family circles, employee savings clubs, festival chits (Diwali/Pongal savings chits).',
    memberInstallmentType: 'Fixed',
    commissionMode: 'Nominal organizer fee or flat commission',
    howAuctionWorks: 'Names or tokens of non-prized members are drawn randomly every month in the presence of subscribers.',
    formula: {
      winnerPayout: 'Net Payout = Chit Gross Value − Organizer Fee',
      memberNetDue: 'Monthly Installment = Fixed ₹ Every Month',
      commission: 'No Dividends, No Interest Penalties'
    },
    pros: [
      '100% fair and egalitarian; every member receives the full chit pool',
      'Zero bidding stress or discount calculations',
      'Simple collection and recordkeeping'
    ],
    cons: [
      'Cannot be used by members seeking emergency funds via high bidding'
    ],
    example: {
      pot: '₹2,00,000 (20 Members × ₹10,000)',
      discount: '₹0 (No Discount Bid)',
      commission: '₹5,000 Flat Organizer Fee',
      netPayout: '₹1,95,000 to Drawn Winner',
      memberDue: 'Fixed ₹10,000 every month'
    }
  },
  {
    id: 'FIXED_ROTATION',
    name: 'Fixed Rotation / ROSCA Scheme',
    tamilName: 'சுழற்சி முறை (Pre-Agreed Order of Payout)',
    tag: 'Pre-Determined',
    color: '#0891b2',
    badgeVariant: 'gray',
    shortDesc: 'A rotating savings and credit association (ROSCA) where the order of monthly winners is mutually decided before the chit commences.',
    fullDesc: 'Members decide in advance who takes month 1, month 2, month 3, etc., based on individual capital requirements (e.g. planned construction, wedding expenses, or business purchase).',
    bestFor: 'Close business partners, trusted merchant syndicates, and project funding.',
    memberInstallmentType: 'Fixed',
    commissionMode: 'Fixed admin charge',
    howAuctionWorks: 'No auctions held. Payout sequence is pre-locked in the group settings.',
    formula: {
      winnerPayout: 'Net Payout = Pre-Assigned Pot Payout',
      memberNetDue: 'Monthly Installment = Fixed ₹',
      commission: 'Deterministic Schedule'
    },
    pros: [
      'Complete planning certainty for every member months in advance',
      'No auction coordination overhead'
    ],
    cons: [
      'Requires very high peer trust since early winners must continue paying till the end'
    ],
    example: {
      pot: '₹6,00,000 (12 Members × ₹50,000)',
      discount: '₹0 Discount',
      commission: 'Fixed Management Fee',
      netPayout: '₹6,00,000 to Scheduled Member of the Month',
      memberDue: 'Fixed ₹50,000 every month'
    }
  }
]

export default function SchemesGuidePage() {
  const router = useRouter()
  const { profile, loading } = useFirm()
  const { t } = useI18n()
  const [selectedScheme, setSelectedScheme] = useState<string>('DIVIDEND_SHARE')

  const handleBack = () => {
    if (!loading && profile) {
      router.back()
    } else {
      router.push('/login')
    }
  }

  const activeScheme = SCHEMES.find(s => s.id === selectedScheme) || SCHEMES[0]

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-10 px-4 sm:px-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleBack}
            className="p-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white transition-all shadow-sm group"
            title="Go Back"
          >
            <ArrowLeft size={20} className="group-active:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="accent" className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5">
                Chit Fund OS Documentation
              </Badge>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Act 1982 Reference</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Auction Schemes & Mathematical Models
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Btn 
            variant="secondary" 
            onClick={() => window.print()} 
            className="text-xs font-bold uppercase tracking-widest px-5 h-11 rounded-2xl shadow-sm border-slate-200 bg-white"
          >
            <Printer size={15} className="mr-2" />
            Print Guide
          </Btn>
        </div>
      </div>

      {/* ── Introduction Card ── */}
      <div className="p-8 rounded-3xl bg-white border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#004db8]">
            <BookOpen size={16} /> Operational Ground Truth
          </div>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed font-medium">
            ChitVault supports multiple operational chit methodologies to match your firm&apos;s commercial, regulatory, and member profile. All calculations are executed with double-entry precision and immutable audit trails.
          </p>
        </div>
      </div>

      {/* ── Scheme Selection Tabs ── */}
      <div className="space-y-4">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Select Scheme Methodology</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {SCHEMES.map(scheme => {
            const isSelected = scheme.id === selectedScheme
            return (
              <button
                key={scheme.id}
                onClick={() => setSelectedScheme(scheme.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  isSelected 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-[1.02]' 
                    : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">{scheme.tag}</div>
                <div className="font-extrabold text-xs sm:text-sm tracking-tight leading-snug line-clamp-1">{scheme.name.split(' ')[0]}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Selected Scheme Deep Dive ── */}
      <div className="p-8 sm:p-12 rounded-3xl bg-white border border-slate-200 shadow-xl space-y-10">
        {/* Title Block */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-8 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-50 text-[#004db8]">
                {activeScheme.tag}
              </span>
              <span className="text-xs font-bold text-slate-400">{activeScheme.tamilName}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {activeScheme.name}
            </h2>
            <p className="text-slate-600 text-sm mt-2 max-w-2xl leading-relaxed">
              {activeScheme.shortDesc}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 shrink-0 min-w-[240px]">
            <div className="text-slate-400 font-bold uppercase tracking-widest text-[9px]">Subscriber Installment</div>
            <div className="font-extrabold text-slate-900">{activeScheme.memberInstallmentType}</div>
            <div className="text-slate-400 font-bold uppercase tracking-widest text-[9px] pt-1">Foreman Commission</div>
            <div className="font-semibold text-slate-700">{activeScheme.commissionMode}</div>
          </div>
        </div>

        {/* Mathematical Formulas */}
        <div className="space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-[#004db8] flex items-center gap-2">
            <Calculator size={15} /> Calculation Formulas & Logic
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Auction Winner Payout</div>
              <div className="font-bold text-slate-900 leading-relaxed">{activeScheme.formula.winnerPayout}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Subscriber Net Due</div>
              <div className="font-bold text-slate-900 leading-relaxed">{activeScheme.formula.memberNetDue}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">Foreman Commission / Trigger</div>
              <div className="font-bold text-slate-900 leading-relaxed">{activeScheme.formula.commission}</div>
            </div>
          </div>
        </div>

        {/* Live Concrete Example Breakdown */}
        <div className="p-6 rounded-2xl bg-blue-50/50 border border-blue-200/60">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#004db8] mb-4">
            <Sparkles size={15} /> Real-World Ledger Example
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs font-medium">
            <div>
              <div className="text-slate-400 text-[10px] font-bold uppercase">Chit Pot</div>
              <div className="font-bold text-slate-900 mt-0.5">{activeScheme.example.pot}</div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px] font-bold uppercase">Auction Discount</div>
              <div className="font-bold text-rose-600 mt-0.5">{activeScheme.example.discount}</div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px] font-bold uppercase">Commission</div>
              <div className="font-bold text-slate-700 mt-0.5">{activeScheme.example.commission}</div>
            </div>
            <div>
              <div className="text-slate-400 text-[10px] font-bold uppercase">Prize Payout</div>
              <div className="font-bold text-[#004db8] mt-0.5">{activeScheme.example.netPayout}</div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <div className="text-slate-400 text-[10px] font-bold uppercase">Subscriber Due</div>
              <div className="font-bold text-emerald-700 mt-0.5">{activeScheme.example.memberDue}</div>
            </div>
          </div>
        </div>

        {/* Pros & Cons / Operator Considerations */}
        <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-emerald-700 flex items-center gap-1.5 mb-3">
              <CheckCircle2 size={15} /> Key Operational Advantages
            </h4>
            <ul className="space-y-2">
              {activeScheme.pros.map((pro, i) => (
                <li key={i} className="text-xs text-slate-600 font-medium flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <span>{pro}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5 mb-3">
              <AlertCircle size={15} /> Operational Considerations
            </h4>
            <ul className="space-y-2">
              {activeScheme.cons.map((con, i) => (
                <li key={i} className="text-xs text-slate-500 font-medium flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                  <span>{con}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Statutory & Audit Compliance (Clean Seyon Light Card) ── */}
      <section className="p-8 sm:p-10 rounded-3xl bg-white border-2 border-[#107B88]/20 shadow-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#107B88]/10 text-[#0C626D] flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight text-slate-900">Statutory Chit Funds Act Compliance</h3>
            <p className="text-xs text-slate-500 font-medium">Central Chit Funds Act, 1982 & State Rules (Tamil Nadu, Kerala, Karnataka, AP)</p>
          </div>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
          ChitVault enforces statutory guardrails across all schemes. Foreman commission cannot exceed the statutory 5% of the gross pot value, and bidding is protected against negative payouts or invalid dividend distributions.
        </p>
      </section>

      {/* ── Footer Navigation ── */}
      <div className="pt-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold">
        <button 
          onClick={handleBack}
          className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
        >
          {loading || profile ? "← Back to Firm Dashboard" : "← Back to Login"}
        </button>

        <span className="text-slate-400">
          ChitVault Platform • Multi-Scheme Auction Engine v3.3
        </span>
      </div>
    </div>
  )
}
