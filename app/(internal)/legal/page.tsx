'use client'

import { Card, Badge, Btn } from '@/components/ui'
import { ShieldCheck, FileText, Scale, BookOpen, ArrowRight, Gavel, ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/context'

export default function LegalHubPage() {
  const router = useRouter()
  const { t } = useI18n()

  const policies = [
    {
      id: 'disclaimer',
      title: 'legal_disclaimer',
      desc: 'Important notice regarding record-keeping vs. payment gateway functionality.',
      icon: ShieldAlert,
      color: 'var(--danger)',
      bg: 'var(--danger-dim)',
      href: '/legal/disclaimer'
    },
    {
      id: 'privacy',
      title: 'legal_privacy',
      desc: 'How we protect your firm data and maintain multi-tenant isolation.',
      icon: ShieldCheck,
      color: 'var(--success)',
      bg: 'var(--success-dim)',
      href: '/legal/privacy'
    },
    {
      id: 'audit',
      title: 'legal_audit',
      desc: 'Best practices for reconciling digital records with physical cash.',
      icon: BookOpen,
      color: 'var(--info)',
      bg: 'var(--info-dim)',
      href: '/legal/audit'
    },
    {
      id: 'terms',
      title: 'legal_terms',
      desc: 'General terms and conditions for using the ChitVault SaaS platform.',
      icon: Scale,
      color: 'var(--accent)',
      bg: 'var(--accent-dim)',
      href: '/legal/terms'
    }
  ]

  return (
    <div className="max-w-5xl space-y-8 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t('legal_title')}</h1>
        <p className="text-sm opacity-60 mt-1">{t('legal_desc')}</p>
      </div>

      {/* Policy Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {policies.map((p) => (
          <Card key={p.id} className="group overflow-hidden hover:border-[var(--accent)] transition-all cursor-pointer" onClick={() => router.push(p.href)}>
            <div className="p-8 flex flex-col h-full">
              <div className="flex items-start justify-between mb-6">
                <div className="p-3 rounded-2xl" style={{ background: p.bg, color: p.color }}>
                  {(() => {
                    const PIcon = p.icon
                    return <PIcon size={24} />
                  })()}
                </div>
                <ArrowRight size={20} className="opacity-0 group-hover:opacity-40 -translate-x-4 group-hover:translate-x-0 transition-all" />
              </div>
              
              <div className="flex-1">
                <h3 className="text-lg font-bold mb-2">{t(p.title)}</h3>
                <p className="text-sm opacity-60 leading-relaxed">{p.desc}</p>
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Doc Ref: CV-POL-{p.id.toUpperCase()}</span>
                <Badge variant="gray">v1.0.0</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-6 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface2)]/50">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-[var(--surface3)] text-[var(--accent)]">
            <Gavel size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold mb-1">Custom Jurisdictional Overrides</h4>
            <p className="text-xs opacity-60 leading-relaxed">
              These policies are standard templates provided for operational guidance. If your local regulations require specific modifications to the Auction Terms or Member Agreements, please consult with your legal advisor and update your internal bylaws accordingly.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
