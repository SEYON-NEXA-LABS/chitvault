'use client'

import { Card, Badge } from '@/components/ui'
import { ArrowLeft, BookOpen, ClipboardCheck, RefreshCw, Layers } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

export default function AuditCompliancePage() {
  const router = useRouter()
  const { t } = useI18n()

  const steps = [
    {
      title: 'Record Collections',
      desc: 'As payments are received (Cash/UPI/Bank), record them immediately in the Payments module to maintain real-time accuracy.',
      icon: ClipboardCheck
    },
    {
      title: 'Cashbook Audit',
      desc: 'At the end of every business day, use the Cashbook to enter your physical denomination counts for reconciliation.',
      icon: Layers
    },
    {
      title: 'Monthly Payouts',
      desc: 'Always generate and print the Payout Voucher for every auction winner. Maintain a physical folder of signed vouchers.',
      icon: BookOpen
    }
  ]

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2.5 rounded-xl border hover:bg-[var(--surface2)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{t('legal_audit')}</h1>
          <Badge variant="info">Best Practices for Firms</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-8 md:p-12 space-y-12">
          
          <section className="space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
              <RefreshCw size={20} className="text-info-500" />
              The Reconciliation Cycle
            </h2>
            <p className="text-[var(--text2)] leading-relaxed">
              To maintain a professional and audit-ready ledger, we strongly recommend following these operational steps.
            </p>
            
            <div className="grid grid-cols-1 gap-4">
              {steps.map((step, i) => (
                <div key={i} className="group p-6 rounded-3xl border border-[var(--border)] hover:border-info-500 transition-colors flex gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-info-500/10 text-info-500 flex items-center justify-center shrink-0">
                    {(() => {
                      const SIcon = step.icon
                      return <SIcon size={22} />
                    })()}
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">{step.title}</h4>
                    <p className="text-sm opacity-60 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <h2 className="text-xl font-black uppercase tracking-tight">Addressing Errors</h2>
            <div className="bg-[var(--surface2)] p-6 rounded-3xl border border-dashed border-[var(--border)]">
              <p className="text-sm opacity-80 leading-relaxed italic">
                &quot;The ledger is only as accurate as its data source.&quot;
              </p>
              <div className="mt-6 space-y-3">
                <p className="text-xs opacity-60">• If a payment is recorded incorrectly, use the <strong>Void</strong> action to maintain an audit trail rather than silently editing.</p>
                <p className="text-xs opacity-60">• Use the <strong>Notes</strong> field for all manual overrides to explain discrepancies to future auditors.</p>
              </div>
            </div>
          </section>

          <div className="footer-doc pt-12 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-40">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest">Document Ref: CV-POL-AUDIT</p>
              <p className="text-[10px]">© 2026 Foundation Finance Systems. All Rights Reserved.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
