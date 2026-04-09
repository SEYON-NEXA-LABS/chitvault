import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { 
  Building2, Users, Crown, Calendar, 
  Plus, MoreVertical, ShieldCheck, 
  ExternalLink, Clock, AlertTriangle 
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function SuperadminDashboard() {
  const supabase = createClient()
  
  // 1. Fetch Firms with Owner details
  // Note: RLS allows superadmin to see all
  const { data: firms, error } = await supabase
    .from('firms')
    .select(`
      *,
      owner:profiles!firms_owner_id_fkey (
        full_name,
        email:auth_users(email)
      )
    `)
    .order('created_at', { ascending: false })

  // 2. Aggregate Stats
  const stats = {
    total: firms?.length || 0,
    active: firms?.filter(f => f.plan_status === 'active').length || 0,
    trial: firms?.filter(f => f.plan === 'trial').length || 0,
    suspended: firms?.filter(f => f.plan_status === 'suspended').length || 0
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6 md:p-12 space-y-12 font-[var(--font-noto)]">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[var(--accent)] font-bold text-xs uppercase tracking-[0.2em]">
            <Crown size={14} /> Control Plane
          </div>
          <h1 className="text-4xl font-black tracking-tight">System Overview</h1>
        </div>
        
        <Link 
          href="/superadmin/onboard"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-black font-black hover:bg-white/90 transition-all shadow-xl shadow-white/5"
        >
          <Plus size={20} /> Onboard New Firm
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Firms', value: stats.total, icon: Building2, color: 'text-blue-500' },
          { label: 'Active Status', value: stats.active, icon: ShieldCheck, color: 'text-success-500' },
          { label: 'In Trial', value: stats.trial, icon: Clock, color: 'text-warning-500' },
          { label: 'Suspended', value: stats.suspended, icon: AlertTriangle, color: 'text-danger-500' },
        ].map((stat, i) => (
          <div key={i} className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-4">
            <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${stat.color}`}>
              <stat.icon size={20} />
            </div>
            <div>
              <div className="text-2xl font-black">{stat.value}</div>
              <div className="text-xs opacity-40 font-bold uppercase tracking-widest">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Firms Table */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-3">
            <Users size={20} className="opacity-30" /> Managed Tenants
          </h2>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Organization</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Owner Authority</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Plan & Expiry</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {firms?.map((firm) => (
                <tr key={firm.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-black">
                        {firm.name?.[0]}
                      </div>
                      <div>
                        <div className="font-bold">{firm.name}</div>
                        <div className="text-[10px] opacity-30 font-mono tracking-tighter">ID: {firm.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">{firm.owner?.full_name || 'N/A'}</div>
                      <div className="text-xs opacity-30">{firm.city || 'No City'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-white/10">
                          {firm.plan}
                        </span>
                      </div>
                      <div className="text-[10px] opacity-40 flex items-center gap-1">
                        <Calendar size={10} />
                        Ends: {firm.trial_ends ? format(new Date(firm.trial_ends), 'dd MMM yyyy') : 'No Date'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                      firm.plan_status === 'active' 
                        ? 'bg-success-500/10 text-success-500' 
                        : 'bg-danger-500/10 text-danger-500'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${firm.plan_status === 'active' ? 'bg-success-500' : 'bg-danger-500'}`} />
                      {firm.plan_status}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 rounded-xl hover:bg-white/10 transition-all opacity-30 hover:opacity-100">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {(!firms || firms.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center opacity-30 italic">
                    No organizations onboarded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
