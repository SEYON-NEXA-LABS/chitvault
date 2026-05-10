'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import Link from 'next/link'
import { fmt, fmtDate, cn, fmtDateTime } from '@/lib/utils'
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
  const [activeTab, setActiveTab] = useState<'groups' | 'members' | 'persons' | 'payments' | 'auctions' | 'settlements' | 'commissions' | 'denominations' | 'staff'>('groups')
  
  // Data States
  const [data, setData] = useState<any[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [selectedIds, setSelectedIds] = useState<Set<any>>(new Set())

  const isAdmin = role === 'owner' || role === 'superadmin'

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id

    // Fetch all for counts
    const tables = ['groups', 'members', 'persons', 'auctions', 'payments', 'settlements', 'foreman_commissions', 'denominations', 'staff']
    const queries = tables.map(tab => {
        const table = tab === 'staff' ? 'profiles' : tab
        return withFirmScope(supabase.from(table).select('id', { count: 'exact' }), targetId).not('deleted_at', 'is', null)
    })
    
    const results = await Promise.all(queries)
    const newCounts: Record<string, number> = {}
    tables.forEach((table, i) => {
       newCounts[table] = results[i].count || 0
    })
    setCounts(newCounts)

    // Fetch active tab data
    let exportCols = 'id, deleted_at'
    
    if (activeTab === 'groups') exportCols = 'id, name, chit_value, duration, deleted_at'
    if (activeTab === 'members') exportCols = 'id, ticket_no, group_id, person_id, deleted_at, persons:person_id(id, name), groups:group_id(id, name)'
    if (activeTab === 'persons') exportCols = 'id, name, phone, address, deleted_at'
    if (activeTab === 'payments') exportCols = 'id, amount, month, member_id, group_id, deleted_at, members:member_id(id, ticket_no, persons:person_id(name)), groups:group_id(id, name)'
    if (activeTab === 'auctions') exportCols = 'id, month, group_id, winner_id, deleted_at, groups:group_id(id, name), members:winner_id(id, persons:person_id(name))'
    if (activeTab === 'settlements') exportCols = 'id, total_amount, member_id, deleted_at, members:member_id(id, persons:person_id(name))'
    if (activeTab === 'commissions') exportCols = 'id, month, group_id, commission_amt, deleted_at, groups:group_id(id, name)'
    if (activeTab === 'denominations') exportCols = 'id, total, entry_date, deleted_at'
    if (activeTab === 'staff') exportCols = 'id, full_name, role, status, deleted_at'

    const currentTable = activeTab === 'staff' ? 'profiles' : (activeTab === 'commissions' ? 'foreman_commissions' : activeTab)
    let query = withFirmScope(supabase.from(currentTable).select(exportCols), targetId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false })

    const { data: list, error: listError } = await query
    if (listError) {
      console.error(`Trash load error [${activeTab}]:`, listError)
      show(listError.message, 'error')
    }
    setData(list || [])
    setLoading(false)
    setSelectedIds(new Set())
  }, [supabase, isAdmin, role, switchedFirmId, firm, activeTab])

  useEffect(() => { load() }, [load])

  async function handleRestore(id: any, table: string) {
    if (!isAdmin || !firm) return
    if (!confirm('Are you sure you want to restore this record?')) return
    
    const targetTable = table === 'staff' ? 'profiles' : (table === 'commissions' ? 'foreman_commissions' : table)
    
    // If restoring a member, we MUST also restore the person if they were deleted
    if (table === 'members') {
      const member = data.find(m => m.id === id)
      if (member && member.person_id) {
        await supabase.from('persons').update({ deleted_at: null }).eq('id', member.person_id).eq('firm_id', firm.id)
      }
    }

    const { error } = await supabase.from(targetTable).update({ deleted_at: null }).eq('id', id).eq('firm_id', firm.id)
    
    if (error) { show(error.message, 'error'); return }
    
    show('Record restored successfully!', 'success')
    if (firm) {
      await logActivity(firm.id, 'SETTING_UPDATED', targetTable, id, { action: 'RESTORE' })
    }
    load()
  }

  async function handleBulkRestore() {
    if (selectedIds.size === 0 || !isAdmin || !firm) return
    if (!confirm(`Restore ${selectedIds.size} selected records?`)) return
    
    const targetTable = activeTab === 'staff' ? 'profiles' : (activeTab === 'commissions' ? 'foreman_commissions' : activeTab)

    // If restoring members, also restore their persons
    if (activeTab === 'members') {
      const pIds = data.filter(item => selectedIds.has(item.id)).map(i => i.person_id).filter(Boolean)
      if (pIds.length > 0) {
        await supabase.from('persons').update({ deleted_at: null }).in('id', Array.from(new Set(pIds))).eq('firm_id', firm.id)
      }
    }

    const { error } = await supabase.from(targetTable).update({ deleted_at: null }).in('id', Array.from(selectedIds)).eq('firm_id', firm.id)
    
    if (error) { show(error.message, 'error'); return }
    
    show(`${selectedIds.size} records restored!`, 'success')
    load()
  }

  async function handlePermanentDelete(id: any, table: string) {
     if (!isAdmin || !firm) return
     if (!confirm('EXTREME DANGER: This will permanently purge this record from the database. This action CANNOT be undone. Proceed?')) return
     
     const targetTable = table === 'staff' ? 'profiles' : (table === 'commissions' ? 'foreman_commissions' : table)
     const { error } = await supabase.from(targetTable).delete().eq('id', id).eq('firm_id', firm.id)
     
     if (error) { show(error.message, 'error'); return }
     
     show('Permanently purged from database.', 'error')
     load()
  }

  async function handleBulkPurge() {
    if (selectedIds.size === 0 || !isAdmin || !firm) return
    if (!confirm(`EXTREMEM DANGER: Permanently purge ${selectedIds.size} selected records? THIS CANNOT BE UNDONE.`)) return
    
    const targetTable = activeTab === 'staff' ? 'profiles' : (activeTab === 'commissions' ? 'foreman_commissions' : activeTab)
    const { error } = await supabase.from(targetTable).delete().in('id', Array.from(selectedIds)).eq('firm_id', firm.id)
    
    if (error) { show(error.message, 'error'); return }
    
    show(`${selectedIds.size} records permanently purged.`, 'error')
    load()
  }

  const toggleSelect = (id: any) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = () => {
    if (selectedIds.size === data.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(data.map(i => i.id)))
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
    <div className="space-y-6 max-w-6xl pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[var(--surface)] p-4 rounded-2xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-2xl font-black text-[var(--text)]">Trash & Recover</h1>
          <p className="text-xs opacity-50 mt-1 flex items-center gap-1.5"><Clock size={12}/> 90-day retention policy</p>
        </div>
        <div className="flex bg-[var(--surface2)] p-1 rounded-xl border flex-wrap gap-1" style={{ borderColor: 'var(--border)' }}>
           {(['groups', 'members', 'persons', 'payments', 'auctions', 'settlements', 'commissions', 'denominations', 'staff'] as const).map(tab => (
             <Chip key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
               <span className="capitalize">{tab === 'commissions' ? 'Comm' : (tab === 'denominations' ? 'Cash' : tab)}</span> ({counts[tab] || 0})
             </Chip>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <StatCard label="Total Items in Trash" value={Object.values(counts).reduce((a,b)=>a+b,0)} color="accent" />
         <StatCard label="Auto-Purge Policy" value="90 Days" color="info" />
         <Link href="/reports/activity" className="block"><StatCard label="Recent Purges" value={0} color="info" sub="Audit activity log" /></Link>
      </div>

      <TableCard title={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Archive`} subtitle={`Manage deleted ${activeTab} records.`}>
        {loading ? <Loading /> : data.length === 0 ? (
          <Empty icon="🗑️" text={`The ${activeTab} trash is empty.`} />
        ) : (
          <Table>
            <thead>
              <Tr>
                <Th className="w-10">
                   <input type="checkbox" checked={selectedIds.size === data.length && data.length > 0} onChange={toggleAll} />
                </Th>
                <Th>Record Information</Th>
                <Th>Deleted On</Th>
                <Th>Retention</Th>
                <Th right>Action</Th>
              </Tr>
            </thead>
            <tbody>
              {data.map(item => {
                const remaining = daysLeft(item.deleted_at)
                const isSelected = selectedIds.has(item.id)
                return (
                  <Tr key={item.id} className={cn(remaining < 7 ? "bg-danger-500/5" : "", isSelected ? "bg-[var(--accent-dim)]" : "")}>
                    <Td>
                       <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(item.id)} />
                    </Td>
                    <Td onClick={() => toggleSelect(item.id)} className="cursor-pointer">
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
                      {activeTab === 'persons' && (
                        <div>
                          <div className="font-bold">{item.name}</div>
                          <div className="text-[10px] opacity-40">{item.phone || 'No Phone'} · {item.address || 'No Address'}</div>
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
                      {activeTab === 'commissions' && (
                        <div>
                          <div className="font-bold text-amber-500">{fmt(item.commission_amt)}</div>
                          <div className="text-[10px] opacity-40">{item.groups?.name} · Month {item.month}</div>
                        </div>
                      )}
                      {activeTab === 'denominations' && (
                        <div>
                          <div className="font-bold">{fmt(item.total)}</div>
                          <div className="text-[10px] opacity-40">Entry Date: {fmtDate(item.entry_date)}</div>
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
                      <div className="text-sm font-medium text-[var(--text)]">{fmtDateTime(item.deleted_at)}</div>
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

      {/* Floating ActionBar */}
      {selectedIds.size > 0 && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-[var(--surface)] border border-[var(--accent)] shadow-2xl rounded-2xl p-2 px-4 flex items-center gap-6 backdrop-blur-md">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-black text-sm">
                     {selectedIds.size}
                  </div>
                  <div className="text-sm font-bold opacity-60 uppercase tracking-widest">Selected</div>
               </div>
               <div className="h-8 w-px bg-[var(--border)]" />
               <div className="flex items-center gap-2">
                  <Btn variant="primary" size="sm" icon={RotateCcw} onClick={handleBulkRestore}>Restore All</Btn>
                  <Btn variant="danger" size="sm" icon={Trash2} onClick={handleBulkPurge}>Permanent Purge</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Deselect</Btn>
               </div>
            </div>
         </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
