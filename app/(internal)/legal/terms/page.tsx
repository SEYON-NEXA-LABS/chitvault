'use client'

import { ArrowLeft, Shield, Globe, Scale, BookOpen, AlertTriangle, FileText, Lock, CheckCircle2, UserCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useFirm } from '@/lib/firm/context'
import { useI18n } from '@/lib/i18n/context'
import { Badge, Btn, Card } from '@/components/ui'
import { APP_NAME, APP_DEVELOPER, DEVELOPER_URL, APP_VERSION, APP_COMMIT_ID } from '@/lib/utils'

export default function TermsPage() {
  const router = useRouter()
  const { profile, loading } = useFirm()
  const { t } = useI18n()

  const handleBack = () => {
    if (!loading && profile) {
      router.back()
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-10 px-4 sm:px-6">
      {/* ── Header ── */}
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
                Master SaaS Agreement
              </Badge>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-mono">Ver 2026.1</span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Terms of Service & User Representation
            </h1>
          </div>
        </div>

        <Btn 
          variant="secondary" 
          onClick={() => window.print()} 
          className="text-xs font-bold uppercase tracking-widest px-5 h-11 rounded-2xl border-slate-200 bg-white shadow-sm"
        >
          Print Terms
        </Btn>
      </div>

      {/* ── Document Body ── */}
      <div className="space-y-8 bg-white p-8 sm:p-12 rounded-3xl border border-slate-200 shadow-sm leading-relaxed text-sm text-slate-600">
        
        {/* Preamble */}
        <section className="space-y-3">
          <h2 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Scale size={18} className="text-[#1e3360]" /> 1. Character of the Software (Accounting Utility Only)
          </h2>
          <p>
            Welcome to <strong>{APP_NAME}</strong>, a proprietary group ledger and record-keeping software platform developed and licensed by <strong>{APP_DEVELOPER}</strong> (&ldquo;Company&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
          </p>
          <p>
            {APP_NAME} is strictly an <strong>accounting, ledger-keeping, calculation, and administrative software utility</strong> designed to record member contributions, calculate mathematical dividends, and log collection receipts. {APP_NAME} is <strong>not</strong> a financial institution, chit fund promoter, Foreman, deposit taker, payment gateway, custodian, or escrow intermediary.
          </p>
        </section>

        {/* Section 2: Safe Harbor under IT Act 2000 */}
        <section className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider">
            <Shield size={16} className="text-[#1e3360]" /> 2. Intermediary Status & Safe Harbor (Section 79, IT Act 2000)
          </div>
          <p className="text-xs text-slate-600">
            Under Section 79 of the <em>Information Technology Act, 2000</em>, {APP_NAME} acts purely as an automated, passive technology intermediary that provides cloud storage, mathematical functions, and print/WhatsApp receipt tools for user-submitted data. 
          </p>
          <p className="text-xs text-slate-600">
            The Company does not initiate, verify, modify, audit, or approve any underlying financial transaction entered into the ledger. All ledger balances, member admissions, auction entries, and payments are executed solely and independently by the User.
          </p>
        </section>

        {/* Section 3: Mandatory User Legal Warranty */}
        <section className="space-y-3 p-6 rounded-2xl bg-blue-50/50 border border-blue-200">
          <div className="flex items-center gap-2 text-[#1e3360] font-black text-xs uppercase tracking-wider">
            <UserCheck size={16} /> 3. Mandatory User Covenant, Regulatory Compliance & Licensing Warranty
          </div>
          <p className="text-xs text-slate-700 font-semibold leading-relaxed">
            By creating an account, launching a vault, or recording any financial group, the User explicitly represents, covenants, and warrants that:
          </p>
          <ul className="space-y-2 text-xs text-slate-600 pl-2">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e3360] mt-1.5 shrink-0" />
              <span>
                <strong>Statutory Compliance:</strong> The User&apos;s chit fund, savings group, or cooperative operations strictly comply with all applicable Central and State laws, including obtaining prior sanction from the State Government and registering chit agreements under Section 4 of the <em>Chit Funds Act, 1982</em> where legally mandated.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e3360] mt-1.5 shrink-0" />
              <span>
                <strong>No Illegal Schemes:</strong> The software will never be used for multi-level marketing (MLM), pyramid schemes, prize chits, money circulation schemes under the <em>Prize Chits (Banning) Act, 1978</em>, or unregulated collective deposits under the <em>BUDS Act, 2019</em>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e3360] mt-1.5 shrink-0" />
              <span>
                <strong>Sole Financial Accountability:</strong> The User is solely responsible for collecting subscriber dues, disbursing prize money, maintaining security deposits, and settling dividend accounts.
              </span>
            </li>
          </ul>
        </section>

        {/* Section 4: Absolute User Indemnification */}
        <section className="space-y-3 p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20">
          <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase tracking-wider">
            <AlertTriangle size={16} /> 4. Absolute User Indemnification & Defense
          </div>
          <p className="text-xs text-slate-700 leading-relaxed font-medium">
            The User agrees to unconditionally defend, indemnify, and hold harmless {APP_NAME}, its parent company {APP_DEVELOPER}, directors, officers, employees, and infrastructure providers from and against any and all claims, regulatory investigations, inquiries, police notices, subpoenas, member disputes, damages, penalties, and legal costs arising out of:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
            <div className="p-2.5 rounded-xl bg-white border border-amber-200/60">
              (a) The operation of any unregistered, informal, or non-compliant chit scheme by the User.
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-amber-200/60">
              (b) Default, insolvency, or failure of the User to pay prize money to subscribers.
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-amber-200/60">
              (c) Any subscriber dispute, complaint, or FIR registered against the User&apos;s business.
            </div>
            <div className="p-2.5 rounded-xl bg-white border border-amber-200/60">
              (d) Any data breach resulting from compromised User passwords or PIN credentials.
            </div>
          </div>
        </section>

        {/* Section 5: Data Fiduciary under DPDP Act 2023 */}
        <section className="space-y-3">
          <h2 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Lock size={18} className="text-[#1e3360]" /> 5. Data Privacy & DPDP Act, 2023 Allocation
          </h2>
          <p>
            Under the <em>Digital Personal Data Protection Act, 2023</em> (DPDP Act):
          </p>
          <ul className="space-y-2 text-xs pl-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>User is the Data Fiduciary:</strong> The User explicitly confirms that it has obtained lawful consent from its subscribers prior to entering their names, phone numbers, and financial transactions into the software.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>{APP_NAME} is the Data Processor:</strong> We process and store subscriber data solely to generate ledgers, WhatsApp notifications, and audit prints requested by the User. We do not sell, monetize, or profile subscriber records.
              </span>
            </li>
          </ul>
        </section>

        {/* Section 6: Non-Custodial Architecture */}
        <section className="space-y-3">
          <h2 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <FileText size={18} className="text-[#1e3360]" /> 6. Non-Custodial Architecture & Primary Evidence
          </h2>
          <p>
            {APP_NAME} does not process, hold, settle, or escrow currency. All financial transfers (member payments, prize payouts) occur outside the platform via direct physical cash, bank transfers, or UPI.
          </p>
          <p className="text-xs text-slate-500">
            Digital entries in {APP_NAME} constitute secondary convenience records. In the event of civil litigation or formal audit, physical signed receipts, registered minutes books, and verified bank account statements remain the primary legal truth.
          </p>
        </section>

        {/* Section 7: Audit Logs & Law Enforcement Assistance */}
        <section className="space-y-3">
          <h2 className="text-lg font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Globe size={18} className="text-[#1e3360]" /> 7. Law Enforcement & Statutory Requests
          </h2>
          <p>
            {APP_NAME} maintains immutable technical audit logs recording user account IDs, cashier actions, and timestamps. In the event of a valid court order or statutory demand issued under the <em>Code of Criminal Procedure / BNSS</em> or <em>IT Act</em>, the Company will cooperate with law enforcement authorities as mandated by Indian law.
          </p>
        </section>

        {/* Document Footer */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <p className="font-mono text-[10px] font-bold">Document Ref: CV-SaaS-TOS-2026</p>
            <p className="text-[11px] mt-0.5">
              &copy; {new Date().getFullYear()} <span translate="no">CHITVAULT</span>. Developed by <span translate="no">SEYON NEXA LABS</span> (A subsidiary of <a href="https://nvisionsystems.in" target="_blank" rel="noopener noreferrer" className="hover:underline text-slate-700" translate="no">NVISION SYSTEMS</a>) &bull; v{APP_VERSION} ({APP_COMMIT_ID})
            </p>
          </div>
          <div className="flex gap-4 font-bold uppercase text-[10px] tracking-wider text-slate-500">
            <Link href="/legal/privacy" className="hover:text-slate-900">Privacy Policy</Link>
            <Link href="/legal/disclaimer" className="hover:text-slate-900">Regulatory Disclaimer</Link>
            <Link href="/plans" className="hover:text-slate-900">SaaS Plans</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
