'use client'

import { useFirm } from '@/lib/firm/context'
import { useUsage } from '@/lib/hooks/useUsage'
import { fmt, fmtDate } from '@/lib/utils'
import { 
  BarChart3, Database, HardDrive, Wifi, Users, 
  ArrowUpRight, RefreshCcw, ShieldCheck, Zap,
  Info, AlertCircle, Clock
} from 'lucide-react'
import { StatCard, Card, Loading, Badge, Table, Th, Td, Tr, Btn } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'

export default function UsageHubPage() {
  const { firm, role } = useFirm()
  const { t } = useI18n()
  const { data, loading, lastUpdated, refresh } = useUsage(firm?.id)

  if (loading && !data) return <Loading />

  const stats = data?.egress || { database: 0, storage: 0, api: 0, auth: 0, realtime: 0, edge_functions: 0, total_estimate: 0 }
  const metrics = data?.metrics || { ops: 0, emails: 0, users: 0 }
  
  // Format bytes to readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-black text-[var(--text)] flex items-center gap-3">
             <BarChart3 className="text-[var(--accent)]" size={32} />
             {t('usage_hub_title') || 'Usage Hub'}
           </h1>
           <p className="text-sm opacity-60 font-medium mt-1">
             {data?.cycle_start && data?.cycle_end 
               ? `Billing Cycle: ${fmtDate(data.cycle_start)} - ${fmtDate(data.cycle_end)}`
               : 'Real-time attribution of egress, storage, and API operations.'
             }
           </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="text-[10px] font-mono opacity-40 uppercase tracking-widest hidden md:block">
              Sync: {new Date(lastUpdated).toLocaleTimeString()}
            </div>
          )}
          <Btn variant="secondary" icon={RefreshCcw} onClick={refresh} loading={loading}>
            Sync Now
          </Btn>
        </div>
      </div>

      <div className="relative group overflow-hidden rounded-[3rem] p-8 bg-[var(--surface2)] border-2 shadow-xl" style={{ borderColor: 'var(--border)' }}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 relative z-10">
          <div className="lg:col-span-3 flex flex-col justify-center">
              <h2 className="text-3xl font-black mb-2 flex items-center gap-2">
                <ShieldCheck className="text-[var(--success)]" /> 
                System Fidelity Dashboard
              </h2>
              <p className="opacity-60 font-medium mb-6">
                This environment is strictly monitored for resource efficiency. Every action is attributed to maintain high performance and low egress costs.
              </p>
              <div className="flex flex-wrap gap-4">
                 <Badge variant="info" className="px-4 py-1">Enterprise Transparency Enabled</Badge>
                 <Badge variant="accent" className="px-4 py-1">Auto-Logout Security: 30m</Badge>
              </div>
          </div>
          <div className="hidden lg:flex items-center justify-center">
             <Zap size={100} className="opacity-10 text-[var(--accent)]" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Egress (Est)" 
          value={formatBytes(stats.total_estimate)} 
          icon={Wifi} 
          color="accent" 
          sub="Network Traffic"
        />
        <StatCard 
          label="API Operations" 
          value={metrics.ops} 
          icon={ArrowUpRight} 
          color="warning" 
          sub="Request Volume"
        />
        <StatCard 
          label="Auth Emails" 
          value={metrics.emails} 
          icon={ShieldCheck} 
          color="success" 
          sub="Outgoing SMTP"
        />
        <StatCard 
          label="Active Staff" 
          value={metrics.users} 
          icon={Users} 
          color="info" 
          sub="Resource Users"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={role === 'superadmin' ? "lg:col-span-2 space-y-6" : "lg:col-span-3 space-y-6"}>
          <Card title="Egress Attribution Breakdown" subtitle="How your data is being served">
            <div className="p-6 space-y-6">
               <div className="space-y-4">
                  {[
                    { label: 'Database & Rest API', val: stats.database + stats.api, color: 'var(--info)' },
                    { label: 'File Serving (Storage)', val: stats.storage, color: 'var(--success)' },
                    { label: 'Realtime WebSockets', val: stats.realtime, color: 'var(--accent)' },
                    { label: 'Auth & Redirects', val: stats.auth, color: 'var(--warning)' },
                    { label: 'Edge Functions', val: stats.edge_functions, color: 'var(--danger)' },
                  ].map((item, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                        <span>{item.label}</span>
                        <span style={{ color: item.color }}>{formatBytes(item.val)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--surface3)] overflow-hidden">
                        <div 
                          className="h-full transition-all duration-1000" 
                          style={{ 
                            background: item.color, 
                            width: `${(item.val / (Math.max(stats.total_estimate, 1))) * 100}%` 
                          }} 
                        />
                      </div>
                    </div>
                  ))}
               </div>
               
               <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex gap-4">
                  <Info className="text-blue-500 shrink-0" />
                  <p className="text-xs leading-relaxed opacity-70">
                    <strong>Note:</strong> Egress represents the total data transferred out of the Supabase infrastructure to your browser.
                    Large attachments and complex reports are the primary drivers of this metric.
                  </p>
               </div>
            </div>
          </Card>

          <Card title="Active Operator Utilization" subtitle="Telemetry attributed to staff members">
             <Table>
               <thead>
                 <Tr>
                   <Th>Staff Member</Th>
                   <Th>Role</Th>
                   <Th right>Operations</Th>
                   <Th right>Egress Attribution</Th>
                 </Tr>
               </thead>
               <tbody>
                 {(data?.top_users || []).map((user, i) => (
                   <Tr key={i}>
                     <Td className="font-bold">{user.full_name}</Td>
                     <Td><Badge variant="gray">{user.role}</Badge></Td>
                     <Td right className="font-mono text-xs">{user.operations}</Td>
                     <Td right className="font-bold">{formatBytes(user.egress)}</Td>
                   </Tr>
                 ))}
                 {(!data?.top_users || data.top_users.length === 0) && (
                   <Tr>
                     <Td colSpan={4} className="text-center py-20 opacity-40 italic">
                       No activity recorded for the current period.
                     </Td>
                   </Tr>
                 )}
               </tbody>
             </Table>
          </Card>
        </div>

        {role === 'superadmin' && (
          <div className="space-y-6">
             <Card title="Plan Efficiency" subtitle="Usage vs Limits">
                <div className="p-6 space-y-6">
                   <div className="flex flex-col items-center justify-center p-8 rounded-full border-8 border-[var(--surface3)] relative" style={{ borderColor: 'var(--surface3)' }}>
                      <div className="text-center">
                         <p className="text-[10px] font-black uppercase opacity-40">Monthly Egress</p>
                         <p className="text-3xl font-black">{((stats.total_estimate / (5 * 1024 * 1024 * 1024)) * 100).toFixed(1)}%</p>
                         <p className="text-[10px] opacity-40 mt-1">of 5GB Allowance</p>
                      </div>
                      {/* Gauge placeholder - would ideally be a circular progress svg */}
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-start gap-4 p-4 rounded-2xl border bg-orange-500/5" style={{ borderColor: 'rgba(249, 115, 22, 0.2)' }}>
                         <AlertCircle className="text-orange-500 shrink-0" size={18} />
                         <div>
                            <p className="text-xs font-bold text-orange-500">Approaching Free Limit?</p>
                            <p className="text-[10px] opacity-70 mt-1">
                               Your Supabase Free Tier has a 5GB monthly limit. Exceeding this may cause service interruptions.
                            </p>
                         </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-green-500/5 border border-green-500/10 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <ShieldCheck className="text-green-500" size={16} />
                            <span className="text-xs font-bold">Auto-Logout Active</span>
                         </div>
                         <Badge variant="success">30m Idle</Badge>
                      </div>
                   </div>

                   <Btn variant="primary" className="w-full" onClick={() => window.open('https://supabase.com/dashboard', '_blank')}>
                      Manage Supabase Quota
                   </Btn>
                </div>
             </Card>

             <Card title="Real-time Status" subtitle="System operational health">
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="text-xs opacity-60">System Clock</span>
                     <span className="text-xs font-mono">{new Date().toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs opacity-60">Attribution Engine</span>
                     <Badge variant="success">Operational</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-xs opacity-60">Cache Precision</span>
                     <span className="text-xs">± 15 Minutes</span>
                  </div>
                </div>
             </Card>
          </div>
        )}
      </div>
    </div>
  )
}
