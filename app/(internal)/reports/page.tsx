'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useFirm } from '@/lib/firm/context'
import { useI18n } from '@/lib/i18n/context'
import { useTerminology } from '@/lib/hooks/useTerminology'
import { GET_REPORTS } from './constants'

export default function ReportsHubPage() {
  const router = useRouter()
  const { firm } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  
  const reports = useMemo(() => GET_REPORTS(t, term), [t, term])
  const categories = Array.from(new Set(reports.map(r => r.category)))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <h1>{t('reports_hub')}</h1>
      </div>

      <div className="space-y-10">
        {categories.map(category => (
          <div key={category}>
            <h2 className="font-bold tracking-wider mb-4 px-1 text-[var(--text3)]">
              {category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.filter(r => r.category === category).map(report => {
                const Icon = report.icon
                return (
                  <div 
                    key={report.id} 
                    onClick={() => router.push(`/reports/${report.id}`)}
                    className="p-6 rounded-[24px] border cursor-pointer hover:shadow-xl transition-all group active:scale-[0.98] border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface2)]"
                  >
                    <div className="flex items-center gap-4 mb-3">
                      <div className="p-3 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] group-hover:scale-110 transition-transform">
                        <Icon size={20} />
                      </div>
                      <h3 className="font-bold text-lg leading-tight">{report.title}</h3>
                    </div>
                    <p className="text-sm opacity-60 leading-relaxed">{report.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
