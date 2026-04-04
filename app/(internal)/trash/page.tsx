'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, cn } from '@/lib/utils'
import {
  Btn, Badge, TableCard, Table, Th, Td, Tr,
  Loading, Empty, Toast, Chip, StatCard
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { logActivity } from '@/lib/utils/logger'
import { Trash2, RotateCcw, AlertTriangle, Clock, ShieldAlert, History, Archive } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { withFirmScope } from '@/lib/supabase/firmQuery'

export default function TrashPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const { toast, show, hide } = useToast()

  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'groups' | 'members' | 'payments' | 'auctions' | 'settlements' | 'staff'>('groups')
  
  // Data States
  const [data, setData] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})

  const isAdmin = role === 'owner' || role === 'superadmin'

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id

    // Fetch all for counts
    const tables = ['groups', 'members', 'persons', 'auctions', 'payments', 'settlements', 'denominations', 'profiles']
    const queries = tables.map(table => 
      withFirmScope(supabase.from(table).select('id', { count: 'exact' }), targetId).not('deleted_at', 'is', null)
    )
    
    const results = await Promise.all(queries)
    const newCounts: Record<string, number> = {}
    tables.forEach((table, i) => {
       newCounts[table] = results[i].count || 0
    })
    setCounts(newCounts)

    // Fetch active tab data
    let currentTable = activeTab
    if (activeTab === 'staff') currentTable = 'profiles' as any
    
    let query = withFirmScope(supabase.from(currentTable).select('*'), targetId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
    
    // Add specific joins for context
    if (activeTab === 'members') query = query.select('*, persons(*), groups(name)')
    if (activeTab === 'payments') query = query.select('*, members(ticket_no, persons(name)), groups(name)')
    if (activeTab === 'auctions') query = query.select('*, groups(name), members(persons(name))')
    if (activeTab === 'settlements') query = query.select('*, members(persons(name))')

    const { data: list } = await query
    setData(list || [])
    setLoading(false)
  }, [supabase, isAdmin, role, switchedFirmId, firm, activeTab])

  useEffect(() => { load() }, [load])

  async function handleRestore(id: any, table: string) {
    if (!isAdmin) return
    if (!confirm('Are you sure you want to restore this record?')) return
    
    const targetTable = table === 'staff' ? 'profiles' : table
    const { error } = await supabase.from(targetTable).update({ deleted_at: null }).eq('id', id)
    
    if (error) { show(error.message, 'error'); return }
    
    show('Record restored successfully!', 'success')
    if (firm) {
      await logActivity(firm.id, 'SETTING_UPDATED', targetTable, id, { action: 'RESTORE' })
    }
    load()
  }

  async function handlePermanentDelete(id: any, table: string) {
     if (!isAdmin) return
     if (!confirm('EXTREME DANGER: This will permanently purge this record from the database. This action CANNOT be undone. Proceed?')) return
     
     const targetTable = table === 'staff' ? 'profiles' : table
     const { error } = await supabase.from(targetTable).delete().eq('id', id)
     
     if (error) { show(error.message, 'error'); return }
     
     show('Permanently purged from database.', 'error')
     load()
  }

  const daysLeft = (deletedAt: string) => {
    const diff = new Date().getTime() - new Date(deletedAt).getTime()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    return Math.max(0, 90 - days)
  }

  if (!isAdmin) return (
    <div className="flex items-center justify-center py-20 text-center">
      <div className="bg-[var(--surface)] p-8 rounded-3xl border shadow-xl">
        <ShieldAlert size={48} className="mx-auto mb-4 text-[var(--danger)]" />
        <h2 className="text-xl font-bold mb-2">Access Restricted</h2>
        <p className="text-sm opacity-60">Only Firm Owners or Superadmins can access the recovery trash.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[var(--surface)] p-4 rounded-2xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">Trash & Recover (Archive)</h1>
          <p className="text-xs opacity-50 mt-1 flex items-center gap-1.5"><Clock size={12}/> All deleted items are maintained for 90 days before permanent purging.</p>
        </div>
        <div className="flex bg-[var(--surface2)] p-1 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
           {(['groups', 'members', 'payments', 'auctions', 'settlements', 'staff'] as const).map(tab => (
             <Chip key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
               <span className="capitalize">{tab}</span> ({counts[tab === 'staff' ? 'profiles' : tab] || 0})
             </Chip>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <StatCard label="Total Items in Trash" value={Object.values(counts).reduce((a,b)=>a+b,0)} color="accent" />
         <StatCard label="Auto-Purge Policy" value="90 Days" color="info" />
         <StatCard label="Recycled Capacity" value="2.4 MB" color="info" sub="Database optimization" />
      </div>

      <TableCard title={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Archive`} subtitle={`Browse and recover deleted ${activeTab} records.`}>
        {loading ? <Loading /> : data.length === 0 ? (
          <Empty icon="🗑️" text={`The ${activeTab} trash is empty.`} />
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th>Record Information</Th>
                <Th>Deleted On</Th>
                <Th>Retention</Th>
                <Th right>Action</Th>
              </Tr>
            </thead>
            <tbody>
              {data.map(item => {
                const remaining = daysLeft(item.deleted_at)
                return (
                  <Tr key={item.id} className={cn(remaining < 7 ? "bg-danger-500/5" : "")}>
                    <Td>
                      {activeTab === 'groups' && (
                        <div>
                          <div className="font-bold">{item.name}</div>
                          <div className="text-[10px] opacity-40">Value: {fmt(item.chit_value)} · Duration: {item.duration}m</div>
                        </div>
                      )}
                      {activeTab === 'members' && (
                        <div>
                          <div className="font-bold">{item.persons?.name || 'Unknown'}</div>
                          <div className="text-[10px] opacity-40">{item.groups?.name || 'No Group'} · Ticket #{item.ticket_no}</div>
                        </div>
                      )}
                      {activeTab === 'payments' && (
                        <div>
                          <div className="font-bold text-[var(--success)]">{fmt(item.amount)}</div>
                          <div className="text-[10px] opacity-40">{item.members?.persons?.name} · {item.groups?.name} (Month {item.month})</div>
                        </div>
                      )}
                      {activeTab === 'auctions' && (
                        <div>
                          <div className="font-bold">Month {item.month} Auction</div>
                          <div className="text-[10px] opacity-40">{item.groups?.name} · Winner: {item.members?.persons?.name}</div>
                        </div>
                      )}
                      {activeTab === 'settlements' && (
                        <div>
                          <div className="font-bold text-[var(--danger)]">{fmt(item.total_amount)}</div>
                          <div className="text-[10px] opacity-40">Paid to: {item.members?.persons?.name}</div>
                        </div>
                      )}
                      {activeTab === 'staff' && (
                        <div>
                          <div className="font-bold">{item.full_name}</div>
                          <div className="text-[10px] opacity-40">{item.role} · {item.status}</div>
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="text-sm font-medium">{fmtDate(item.deleted_at)}</div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                         <div className="flex-1 h-1.5 w-16 bg-[var(--surface2)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--info)]" style={{ width: `${(remaining/90)*100}%` }} />
                         </div>
                         <span className={cn("text-[10px] font-bold", remaining < 10 ? "text-[var(--danger)]" : "text-[var(--text2)]")}>
                            {remaining} days left
                         </span>
                      </div>
                    </Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-2">
                        <Btn size="sm" variant="ghost" icon={RotateCcw} onClick={() => handleRestore(item.id, activeTab)} style={{ color: 'var(--success)' }}>Restore</Btn>
                        <Btn size="sm" variant="ghost" icon={Trash2} onClick={() => handlePermanentDelete(item.id, activeTab)} style={{ color: 'var(--danger)' }} title="Permanent Purge">Purge</Btn>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </TableCard>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
