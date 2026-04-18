'use client'

import { Card, Badge, Btn } from '@/components/ui'
import { ArrowLeft, ShieldAlert, AlertTriangle, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

export default function DisclaimerPage() {
  const router = useRouter()
  const { t } = useI18n()

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2.5 rounded-xl border hover:bg-[var(--surface2)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{t('legal_disclaimer')}</h1>
          <Badge variant="danger">Critical Compliance Doc</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-8 md:p-12 space-y-10">
          
          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-[0.1em]">1. Professional Record-Keeping</h2>
            <p className="text-[var(--text2)] leading-relaxed">
              ChitVault is a specialized <strong>Digital Ledger</strong> designed for the professional administration and auditing of auction chit funds. It provides mathematical models, data isolation, and reporting tools to assist Finance Firms in their operations.
            </p>
          </section>

          <section className="p-6 rounded-3xl bg-red-500/5 border border-red-500/10 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <ShieldAlert size={20} />
              <h2 className="text-xl font-black uppercase tracking-[0.1em]">2. No Payment Processing</h2>
            </div>
            <p className="text-[var(--text2)] leading-relaxed font-semibold">
              ChitVault is NOT a payment gateway or a financial institution. The platform does not handle, process, or hold any actual currency. It does not integrate with bank APIs to facilitate transfers.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {[
                'Collection of monthly subscriptions',
                'Payout of auction proceeds',
                'Payment of dividends',
                'Operational expenses'
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-xs opacity-60">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {item}
                </div>
              ))}
            </div>
            <p className="text-xs opacity-60 italic mt-4">
              * All the above MUST occur externally via cash, bank transfer, or other legal financial instruments.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-[0.1em]">3. Responsibilities & Legal Truth</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <h4 className="text-sm font-bold opacity-40 uppercase tracking-widest">Digital Role</h4>
                <p className="text-xs opacity-70 leading-relaxed">
                  ChitVault is a <strong>secondary digital reconciliation tool</strong> and audit aid.
                </p>
              </div>
              <div className="space-y-2 p-4 rounded-2xl bg-orange-500/5 border border-orange-500/10">
                <h4 className="text-sm font-bold opacity-40 uppercase tracking-widest text-orange-500">Legal Truth</h4>
                <p className="text-xs opacity-70 leading-relaxed">
                  In any dispute, physical signed vouchers and bank statements are the <strong>Primary Truth</strong>.
                </p>
              </div>
            </div>
          </section>

          <div className="footer-doc pt-12 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-40">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest">Document Ref: CV-POL-DISCLAIMER</p>
              <p className="text-[10px]">© 2026 Foundation Finance Systems. All Rights Reserved.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
