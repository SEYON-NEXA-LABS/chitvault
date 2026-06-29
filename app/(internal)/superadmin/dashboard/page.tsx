'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Building2, Users, Crown, Calendar, 
  Plus, ShieldCheck, Clock, AlertTriangle,
  Pencil, UserPlus, ExternalLink, MoreVertical,
  TrendingUp, Wallet, DollarSign, Search
} from 'lucide-react'
import { 
  Btn, TableCard, Table, Th, Td, Tr, 
  Badge, StatCard, Loading, Modal, Toast
} from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { fmt, fmtDate } from '@/lib/utils'
import { useToast } from '@/lib/hooks/useToast'
import { registerFirm, updateFirmDetails } from '../../admin/actions'
import { COLOR_PROFILES } from '@/lib/branding/context'
import { PLAN_LIMITS } from '@/types'
 
export default function SuperadminDashboard() {
  const supabase = createClient()
  const router = useRouter()
  const { t } = useI18n()
  const { toast, show, hide } = useToast()
  
  const [firms, setFirms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all'|'active'|'trial'|'suspended'>('all')
  const [revStats, setRevStats] = useState({ setup: 0, amc: 0, hosting: 85200, profit: 0 })
 
  // Modals
  const [editOpen, setEditOpen] = useState(false)
  const [editingFirm, setEditingFirm] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name: '', slug: '', city: '', phone: '', plan: '', plan_status: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const { data: firmsData } = await supabase
      .from('firms')
      .select(`
        *,
        owner:profiles (
          full_name
        )
      `)
      .order('created_at', { ascending: false })

    if (firmsData) {
      // Enrich with counts (Simplified for dashboard)
      const enriched = await Promise.all(firmsData.map(async (f: any) => {
        const [{ count: gCount }, { count: mCount }] = await Promise.all([
          supabase.from('groups').select('id', { count: 'exact', head: true }).eq('firm_id', f.id),
          supabase.from('members').select('id', { count: 'exact', head: true }).eq('firm_id', f.id),
        ])
        return { ...f, groupCount: gCount || 0, memberCount: mCount || 0 }
      }))
      setFirms(enriched)

      // Calculate Revenue
      let setup = 0
      let amc = 0
      enriched.forEach(f => {
        const p = PLAN_LIMITS[f.plan as keyof typeof PLAN_LIMITS]
        if (p && f.plan !== 'trial') {
          setup += Number(p.setupFee?.replace(/[^\d]/g, '') || 0)
          amc   += Number(p.amc?.replace(/[^\d]/g, '') || 0)
        }
      })
      setRevStats({ setup, amc, hosting: 85200, profit: amc - 85200 })
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const stats = {
    total: firms.length,
    active: firms.filter(f => f.plan_status === 'active').length,
    trial: firms.filter(f => f.plan === 'trial').length,
    suspended: firms.filter(f => f.plan_status === 'suspended').length
  }

  const displayed = firms
    .filter(f => filter === 'all' || (filter === 'suspended' ? f.plan_status === 'suspended' : (filter === 'active' ? f.plan_status === 'active' : f.plan === 'trial')))
    .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.slug.includes(search.toLowerCase()))

  async function handleUpdateFirm() {
    if (!editingFirm) return

    const confirmSave = window.confirm(`Are you sure you want to save all changes for "${editForm.name}"?`)
    if (!confirmSave) return

    const { error } = await supabase
      .from('firms')
      .update({
        name: editForm.name,
        city: editForm.city || null,
        phone: editForm.phone || null,
        plan: editForm.plan,
        plan_status: editForm.plan_status
      })
      .eq('id', editingFirm.id)

    if (error) { 
      show(error.message, 'error')
      return 
    }

    show('Firm profile updated successfully')
    setEditOpen(false)
    load()
  }

  if (loading && firms.length === 0) return <Loading />

  return (
    <div className="space-y-8 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-[var(--accent)] font-bold text-xs uppercase tracking-[0.2em] mb-1">
            <Crown size={14} /> Control Plane
          </div>
          <h1>System Overview</h1>
          <p className="text-sub mt-1">Manage global tenants and platform health</p>
        </div>
        
        <div className="flex gap-2">
          <Btn variant="primary" icon={Plus} onClick={() => router.push('/superadmin/onboard')}>
            Onboard New Firm
          </Btn>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={fmt(revStats.setup)} icon={DollarSign} color="accent" sub="Total Setup Fees" />
        <StatCard label="Annual AMC" value={fmt(revStats.amc)} icon={TrendingUp} color="success" sub="Projected Recurring" />
        <StatCard label="Hosting Cost" value={fmt(revStats.hosting)} icon={Building2} color="danger" sub="Fixed Yearly Overhead" />
        <StatCard label="Net Profit" value={fmt(revStats.profit)} icon={Wallet} color="info" sub="Post-Expense Yield" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Firms" value={stats.total} icon={Building2} color="info" sub="Registered Organizations" />
        <StatCard label="Active Status" value={stats.active} icon={ShieldCheck} color="success" sub="Live Instances" />
        <StatCard label="In Trial" value={stats.trial} icon={Clock} color="accent" sub="Pending Conversion" />
        <StatCard label="Suspended" value={stats.suspended} icon={AlertTriangle} color="danger" sub="Access Disabled" />
      </div>

      {/* Firms Table */}
      <TableCard 
        title="Managed Tenants" 
        subtitle={`Showing ${displayed.length} of ${firms.length} firms`}
        actions={
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                <input 
                  className="pl-9 pr-4 py-2 bg-[var(--surface2)] border border-[var(--border)] rounded-xl text-xs focus:ring-1 focus:ring-[var(--accent)] outline-none w-48 transition-all"
                  placeholder="Search firms..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
             </div>
             <div className="flex bg-[var(--surface2)] p-1 rounded-xl border border-[var(--border)]">
                {(['all', 'active', 'trial', 'suspended'] as const).map(f => (
                  <button 
                    key={f} 
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${filter === f ? 'bg-white text-[var(--text)] shadow-sm' : 'text-[var(--text3)] hover:text-[var(--text)]'}`}
                  >
                    {f}
                  </button>
                ))}
             </div>
          </div>
        }
      >
        <Table responsive>
          <thead>
            <Tr>
              <Th>Organization</Th>
              <Th>Authority</Th>
              <Th>Stats</Th>
              <Th>Plan</Th>
              <Th>Status</Th>
              <Th right>Actions</Th>
            </Tr>
          </thead>
          <tbody>
            {displayed.map((firm) => (
              <Tr key={firm.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] flex items-center justify-center font-black">
                      {firm.name?.[0]}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{firm.name}</div>
                      <div className="text-[10px] text-sub font-mono">ID: {firm.slug}</div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <div className="text-sm font-medium">{firm.owner?.full_name || 'N/A'}</div>
                  <div className="text-xs text-sub">{firm.city || 'No City'}</div>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-[var(--info)]">{firm.groupCount}G</div>
                    <div className="text-xs font-bold text-[var(--accent)]">{firm.memberCount}M</div>
                  </div>
                </Td>
                <Td>
                  <Badge variant={firm.plan === 'pro' || firm.plan === 'perpetual' ? 'accent' : 'gray'} className="capitalize font-bold">
                    {firm.plan === 'basic' ? 'Standard' : firm.plan === 'pro' ? 'Enterprise' : firm.plan}
                  </Badge>
                  {firm.plan === 'perpetual' ? (
                    <div className="space-y-1 mt-1">
                      <div className="text-[9px] text-[var(--accent)] font-black uppercase">∞ Perpetual</div>
                      {firm.trial_ends && <div className="text-[9px] text-[var(--danger)] font-bold">AMC Due: {fmtDate(firm.trial_ends)}</div>}
                    </div>
                  ) : firm.trial_ends && (
                    <div className="text-[9px] text-sub mt-1">{fmtDate(firm.trial_ends)}</div>
                  )}
                </Td>
                <Td>
                  <Badge variant={firm.plan_status === 'active' ? 'success' : 'danger'} className="capitalize font-bold">
                    {firm.plan_status}
                  </Badge>
                </Td>
                <Td right>
                  <div className="flex items-center justify-end gap-1">
                    <button 
                      onClick={() => { 
                        setEditingFirm(firm); 
                        setEditForm({ 
                          name: firm.name, 
                          slug: firm.slug, 
                          city: firm.city || '', 
                          phone: firm.phone || '', 
                          plan: firm.plan || 'trial', 
                          plan_status: firm.plan_status || 'active' 
                        }); 
                        setEditOpen(true) 
                      }}
                      className="p-2 rounded-lg hover:bg-[var(--surface3)] text-[var(--text3)] hover:text-[var(--text)] transition-all"
                      title="Edit Firm Profile"
                    >
                      <Pencil size={16} />
                    </button>
                    <a 
                      href={`https://${firm.slug}.chitvault.in`} 
                      target="_blank" 
                      className="p-2 rounded-lg hover:bg-[var(--surface3)] text-[var(--text3)] hover:text-[var(--accent)] transition-all"
                      title="Open Instance"
                    >
                      <ExternalLink size={16} />
                    </a>
                    <button className="p-2 rounded-lg hover:bg-[var(--surface3)] text-[var(--text3)] transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
            {displayed.length === 0 && (
              <Tr>
                <Td colSpan={6} className="py-20 text-center text-sub italic">
                  No organizations found.
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableCard>
 
      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Update Firm Profile">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-sub uppercase">Business Name</label>
            <input 
              className="w-full p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)]" 
              value={editForm.name} 
              onChange={e => setEditForm(f=>({...f, name: e.target.value}))} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-sub uppercase">City</label>
              <input 
                className="w-full p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)]" 
                value={editForm.city} 
                onChange={e => setEditForm(f=>({...f, city: e.target.value}))} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-sub uppercase">Phone</label>
              <input 
                className="w-full p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)]" 
                value={editForm.phone} 
                onChange={e => setEditForm(f=>({...f, phone: e.target.value}))} 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-sub uppercase">Deployment Plan</label>
              <select 
                className="w-full p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-sm font-semibold outline-none"
                value={editForm.plan} 
                onChange={e => setEditForm(f=>({...f, plan: e.target.value}))} 
              >
                <option value="trial">Trial</option>
                <option value="basic">Standard</option>
                <option value="pro">Enterprise</option>
                <option value="perpetual">Perpetual</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-sub uppercase">Subscription Status</label>
              <select 
                className="w-full p-3 rounded-xl bg-[var(--surface2)] border border-[var(--border)] text-sm font-semibold outline-none"
                value={editForm.plan_status} 
                onChange={e => setEditForm(f=>({...f, plan_status: e.target.value}))} 
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <Btn variant="primary" className="w-full mt-4" onClick={handleUpdateFirm}>
            Save Changes
          </Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
