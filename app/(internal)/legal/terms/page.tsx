'use client'

import { Card, Badge } from '@/components/ui'
import { ArrowLeft, Scale, Cloud, CreditCard, UserCheck, ShieldClose, Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

export default function TermsPage() {
  const router = useRouter()
  const { t } = useI18n()

  const sections = [
    { title: '1. Acceptance', icon: UserCheck, text: 'By registering a Firm on ChitVault, you agree to be bound by these Terms of Service. If you are registering on behalf of a business, you warrent authority to bind that business.' },
    { title: '2. Service Model', icon: Cloud, text: 'ChitVault provides a multi-tenant cloud platform for chit fund administration. The service is provided on an "As-Is" and "As-Available" basis.' },
    { title: '3. Subscription', icon: CreditCard, text: 'Access to premium features is granted upon verification of annual payments. We reserve the right to suspend non-paying accounts.' },
    { title: '4. Obligations', icon: ShieldClose, text: 'Clients are responsible for data accuracy and physical fund management.' },
    { title: '5. Prof. Disclaimer', icon: Scale, text: 'ChitVault provides tools, not financial/legal advice. Firms must verify all reports.' },
    { title: '6. Zero-Access', icon: Lock, text: 'Our staff never accesses your financial data unless explicitly requested for support.' }
  ]

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2.5 rounded-xl border hover:bg-[var(--surface2)] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{t('legal_terms')}</h1>
          <Badge variant="accent">Standard SaaS Agreement</Badge>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-8 md:p-12 space-y-12">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {sections.map((s, i) => {
              const SIcon = s.icon
              return (
                <div key={i} className="space-y-4">
                  <div className="flex items-center gap-3 text-[var(--accent)]">
                    <SIcon size={20} />
                    <h2 className="text-lg font-black uppercase tracking-tight">{s.title}</h2>
                  </div>
                  <p className="text-sm text-[var(--text2)] leading-relaxed">
                    {s.text}
                  </p>
                </div>
              )
            })}
          </div>

          <section className="p-6 rounded-3xl bg-[var(--surface2)] border border-[var(--border)] space-y-4">
            <h3 className="font-bold text-sm">Termination & Data Portability</h3>
            <p className="text-xs opacity-60 leading-relaxed">
              Upon cancellation, clients may request a data export of their records. We typically retain data for 30 days post-cancellation before permanent deletion to allow for safe data migration.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="font-bold text-sm">Prohibited Activities</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                'Illegal financial activities',
                'Reverse engineering',
                'Bulk scraping/Bot access',
                'Multi-tenant breach attempts'
              ].map(item => (
                <li key={item} className="flex items-center gap-3 text-[10px] uppercase font-bold opacity-40">
                  <Scale size={14} className="text-[var(--accent)]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <div className="footer-doc pt-12 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-40">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest">Document Ref: CV-POL-TOS</p>
              <p className="text-[10px]">© 2026 Foundation Finance Systems. All Rights Reserved.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
