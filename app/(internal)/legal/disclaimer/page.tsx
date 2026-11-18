'use client'

import { Card, Badge, Btn } from '@/components/ui'
import { ArrowLeft, ShieldAlert, AlertTriangle, ExternalLink, Scale, CheckCircle2, FileText, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n/context'
import { APP_NAME, APP_DEVELOPER, DEVELOPER_URL, APP_VERSION, APP_COMMIT_ID } from '@/lib/utils'

export default function DisclaimerPage() {
  const router = useRouter()
  const { t } = useI18n()

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors bg-white shadow-sm">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Software Vendor & Regulatory Disclaimer</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="accent" className="text-[10px] font-black uppercase tracking-widest px-2">Compliance Document</Badge>
            <span className="text-xs text-slate-400 font-mono">Ref: CV-POL-DISCLAIMER-2026</span>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-slate-200 shadow-sm bg-white">
        <div className="p-8 md:p-12 space-y-10">
          
          {/* Section 1: Software Vendor vs Operator */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-[#1e3360]">
              <Scale size={22} />
              <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">1. Technology Vendor vs. Chit Fund Operator</h2>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              <strong>{APP_NAME}</strong> is exclusively a <strong>Software-as-a-Service (SaaS) technology vendor</strong>. Neither {APP_NAME} nor its parent company ({APP_DEVELOPER}) operates, organizes, promotes, sponsors, or acts as a Foreman for any chit fund scheme under the <em>Chit Funds Act, 1982</em>.
            </p>
            <div className="p-5 rounded-2xl bg-blue-50/60 border border-blue-200 text-xs text-slate-700 leading-relaxed space-y-2">
              <p>
                <strong>Solely for Licensed Operators:</strong> Our software is licensed strictly to legally constituted and state-registered chit fund entities, registered foremen, proprietary firms, and legal savings associations. 
              </p>
              <p>
                <strong>Customer Responsibility:</strong> Subscribing firms and foremen bear sole and absolute responsibility for obtaining prior state government sanctions, executing and registering chit agreements with their respective <strong>State Registrar of Chits (e.g., Tamil Nadu, Kerala, Karnataka, Andhra Pradesh)</strong>, furnishing statutory bank guarantees or security deposits, and complying with all local state rules.
              </p>
            </div>
          </section>

          {/* Section 2: Non-Custodial / Zero Escrow */}
          <section className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 space-y-4">
            <div className="flex items-center gap-3 text-amber-700">
              <ShieldAlert size={22} />
              <h2 className="text-xl font-black uppercase tracking-wider">2. Non-Custodial Architecture (Zero Escrow / Zero Deposits)</h2>
            </div>
            <p className="text-slate-700 text-sm leading-relaxed font-medium">
              ChitVault is strictly a <strong>secondary digital reconciliation and administrative ledger</strong>. The platform does NOT function as a payment gateway, custodial bank, wallet, escrow agent, or financial intermediary.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                'Zero holding, pooling, or custody of subscriber money',
                'Zero handling of auction prize payouts or dividends',
                'No third-party payment aggregation or escrow accounts',
                'Direct member payments occur via offline cash or bank UPI'
              ].map(item => (
                <div key={item} className="flex items-start gap-2 text-xs text-slate-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-1.5 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 italic mt-3">
              * All payments, receipts, and prize settlements take place directly between the subscriber and the registered chit company via physical cash or verified banking channels.
            </p>
          </section>

          {/* Section 3: Prohibition of Illegal Schemes */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle size={22} />
              <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">3. Prohibition of Multi-Level & Prize Schemes</h2>
            </div>
            <p className="text-slate-600 text-sm leading-relaxed">
              In strict accordance with the <em>Prize Chits and Money Circulation Schemes (Banning) Act, 1978</em> and the <em>Banning of Unregulated Deposit Schemes Act, 2019 (BUDS)</em>, ChitVault prohibits the use of its technology for:
            </p>
            <ul className="space-y-2 text-xs text-slate-600">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>Multi-level marketing (MLM), referral chains, or pyramid commissions.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>Guaranteed high-return deposits or speculative collective investment schemes.</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <span>Unsanctioned chits operating outside designated state limits.</span>
              </li>
            </ul>
            <p className="text-xs text-slate-500">
              ChitVault reserves the right to terminate accounts immediately upon detection of fraudulent or unauthorized deposit activities.
            </p>
          </section>

          {/* Section 4: Data Protection & DPDP Act Compliance */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 text-[#1e3360]">
              <Lock size={22} />
              <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">4. Data Fiduciary & Privacy (DPDP Act, 2023)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider">Subscriber Data Ownership</h4>
                <p>
                  The subscribing Chit Firm acts as the <strong>Data Fiduciary</strong>, while ChitVault acts solely as a secure <strong>Data Processor</strong>. The firm maintains complete ownership of subscriber lists, ledgers, and contact numbers.
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-900 uppercase tracking-wider">Multi-Tenant Tenant Isolation</h4>
                <p>
                  Subscriber records and auction files are partitioned via tenant schema boundaries and Row-Level Security (RLS). No member data is shared or sold across firms.
                </p>
              </div>
            </div>
          </section>

          {/* Section 5: Primary Legal Truth */}
          <section className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">5. Primary Evidentiary Truth</h4>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              ChitVault generates mathematical projections, digital receipts, and audit reports to facilitate transparency. However, in the event of any civil dispute or court proceeding, physical signed vouchers, registered chit agreements, statutory minutes books, and official bank statements constitute the <strong>Primary Legal Truth</strong>.
            </p>
          </section>

          {/* Document Footer */}
          <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-400">
            <div>
              <p className="font-mono text-[10px] font-bold">Doc ID: CV-LEG-COMPLIANCE-ACT1982</p>
              <p className="text-[11px] mt-0.5">
                © {new Date().getFullYear()} <span translate="no">CHITVAULT</span>. Developed by <span translate="no">SEYON NEXA LABS</span> (A subsidiary of <a href="https://nvisionsystems.in" target="_blank" rel="noopener noreferrer" className="hover:underline text-slate-700" translate="no">NVISION SYSTEMS</a>) • v{APP_VERSION} ({APP_COMMIT_ID})
              </p>
            </div>
            <div className="flex gap-4 font-bold uppercase text-[10px] tracking-wider text-slate-500">
              <Link href="/legal/terms" className="hover:text-slate-900">Terms of Service</Link>
              <Link href="/legal/privacy" className="hover:text-slate-900">Privacy Policy</Link>
              <Link href="/plans" className="hover:text-slate-900">SaaS Plans</Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
