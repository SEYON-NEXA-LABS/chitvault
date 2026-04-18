import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { 
  Building2, Users, Crown, Calendar, 
  Plus, MoreVertical, ShieldCheck, 
  Clock, AlertTriangle 
} from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default async function SuperadminDashboard() {
  const supabase = await createClient()
  
  // 1. Fetch Firms with Owner details
  const { data: firms } = await supabase
    .from('firms')
    .select(`
      *,
      owner:profiles (
        full_name
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
    <div className="min-h-screen p-6 md:p-12 space-y-12" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-[0.2em]">
            <Crown size={14} /> Control Plane
          </div>
          <h1 className="text-4xl font-black tracking-tight font-brand uppercase">System Overview</h1>
        </div>
        
        <Link 
          href="/superadmin/onboard"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-600/10"
        >
          <Plus size={20} /> Onboard New Firm
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Firms', value: stats.total, icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active Status', value: stats.active, icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'In Trial', value: stats.trial, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Suspended', value: stats.suspended, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((stat, i) => (
          <div key={i} className="p-6 rounded-3xl bg-[var(--surface2)] border border-[var(--border)] shadow-sm space-y-4">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
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

        <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface2)] shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface3)]/50">
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Organization</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Owner Authority</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Plan & Expiry</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest opacity-40 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {firms?.map((firm) => (
                <tr key={firm.id} className="group hover:bg-[var(--surface3)]/30 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
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
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[var(--surface3)]">
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
                        ? 'bg-emerald-50 text-emerald-600' 
                        : 'bg-rose-50 text-rose-600'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${firm.plan_status === 'active' ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                      {firm.plan_status}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 rounded-xl hover:bg-[var(--surface3)] transition-all opacity-30 hover:opacity-100">
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
