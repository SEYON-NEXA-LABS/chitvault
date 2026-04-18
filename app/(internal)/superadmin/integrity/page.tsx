'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { 
  ShieldCheck, 
  Database, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  ArrowLeft,
  Activity,
  ChevronDown,
  ChevronUp,
  XCircle,
  Zap,
  Terminal
} from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { 
  getDeepIntegrityReport, 
  DeepIntegrityReport, 
  getSecurityContext, 
  SecurityContext 
} from '@/app/actions/integrity';

export default function IntegrityPage() {
  const [report, setReport] = useState<DeepIntegrityReport | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [secContext, setSecContext] = useState<SecurityContext | null>(null);

  const runDiagnostics = () => {
    setError(null);
    startTransition(async () => {
      try {
        const [data, sec] = await Promise.all([
          getDeepIntegrityReport(),
          getSecurityContext()
        ]);
        setReport(data);
        setSecContext(sec);
      } catch (err: any) {
        setError(err.message || 'Failed to run diagnostics');
      }
    });
  };

  useEffect(() => { runDiagnostics(); }, []);

  const getHealthColor = (health: number) => {
    if (health >= 100) return 'var(--success)';
    if (health >= 80) return '#f59e0b'; // amber
    return 'var(--danger)';
  };

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-12 transition-colors duration-500" style={{ background: 'var(--surface)', color: 'var(--text)' }}>
      <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-1000">
        
        {/* Header Overlay */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 p-10 rounded-[3rem] shadow-sm relative overflow-hidden border"
          style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
          <div className="relative z-10">
            <Link href="/superadmin/dashboard" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity mb-6">
              <ArrowLeft size={12} /> Back to Hub
            </Link>
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[2rem] bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.1)] border border-emerald-500/20">
                <ShieldCheck size={40} />
              </div>
              <div>
                <h1 className="text-4xl font-black tracking-tight font-brand uppercase mb-1">System Integrity</h1>
                <p className="text-sm font-medium opacity-50 italic">Comparing production architecture with <code className="text-emerald-600 font-bold">blueprint.sql</code></p>
              </div>
            </div>
          </div>

          <button 
            onClick={runDiagnostics} 
            disabled={isPending}
            className={`relative z-10 px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center gap-4 transition-all active:scale-95 disabled:opacity-50 ${isPending ? 'animate-pulse' : 'hover:-translate-y-1 shadow-lg'}`}
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <RefreshCw size={18} className={isPending ? 'animate-spin' : ''} />
            {isPending ? 'Analyzing Schema...' : 'Run Deep Audit'}
          </button>

          {/* Abstract Glow */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
        </div>

        {error && (
          <div className="p-8 rounded-[2.5rem] bg-rose-500/5 border border-rose-500/10 text-rose-500 flex items-center gap-6 animate-in slide-in-from-top-4">
            <AlertCircle size={24} />
            <div className="flex-1">
              <p className="text-xs font-black uppercase tracking-widest mb-1 opacity-60">Audit Interrupted</p>
              <p className="text-lg font-bold">{error}</p>
            </div>
            <button onClick={runDiagnostics} className="px-6 py-3 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20">Retry Scan</button>
          </div>
        )}

        {report ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            
            {/* Health Gauge Card */}
            <div className="lg:col-span-3 p-12 rounded-[3rem] border flex flex-col md:flex-row items-center gap-16 shadow-sm"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
              
              {/* Security Context Spotlight */}
              <div className="flex-1 w-full space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                    <Lock size={20} />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Security Session Health</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)]">
                    <p className="text-[10px] font-black uppercase opacity-40 mb-2">Firm ID in JWT</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold truncate ${secContext?.firm_id_in_jwt === 'N/A' || !secContext?.firm_id_in_jwt ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {secContext?.firm_id_in_jwt || 'Locating...'}
                      </span>
                      {secContext?.firm_id_in_jwt && secContext.firm_id_in_jwt !== 'N/A' && <CheckCircle2 size={14} className="text-emerald-500" />}
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)]">
                    <p className="text-[10px] font-black uppercase opacity-40 mb-2">Active Role</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-indigo-500">
                        {secContext?.role_in_jwt || 'Identifying...'}
                      </span>
                    </div>
                  </div>

                  <div className="p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)]">
                    <p className="text-[10px] font-black uppercase opacity-40 mb-2">RLS Visibility</p>
                    <div className="flex items-center gap-2">
                       <Badge variant={secContext?.can_see_own_profile ? 'success' : 'danger'}>
                         {secContext?.can_see_own_profile ? 'PROFILES UNLOCKED' : 'PROFILE BLOCKED'}
                       </Badge>
                    </div>
                  </div>
                </div>

                {!secContext?.can_see_own_profile && secContext && (
                  <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-start gap-4 animate-pulse">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div className="text-xs font-bold leading-relaxed">
                      CRITICAL: Your session is missing the "Firm ID" metadata. Calculations and lists will appear as 0 or empty.
                      <br/>
                      <span className="opacity-70">Action: Run Deep Repair (027) and then Log Out/Log In.</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="w-px h-24 bg-[var(--border)] hidden md:block opacity-30" />

              <div className="flex flex-col items-center">
                <div className="relative w-48 h-48 flex items-center justify-center">
                 <svg className="w-full h-full -rotate-90">
                   <circle cx="96" cy="96" r="85" stroke="currentColor" strokeWidth="16" fill="transparent" className="opacity-10" />
                   <circle cx="96" cy="96" r="85" stroke="currentColor" strokeWidth="16" fill="transparent" 
                     style={{ 
                       strokeDasharray: '540', 
                       strokeDashoffset: (540 - (540 * report.overallHealth) / 100).toString(),
                       color: getHealthColor(report.overallHealth),
                       transition: 'stroke-dashoffset 2s cubic-bezier(0.4, 0, 0.2, 1)'
                     }} 
                   />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                   <span className="text-5xl font-black">{report.overallHealth}%</span>
                   <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-1">Health Score</span>
                 </div>
              </div>

                <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-12">
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest opacity-40">Tracked Tables</p>
                    <p className="text-3xl font-black">{report.tables.length}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-emerald-600 opacity-60">Verified Sync</p>
                    <p className="text-3xl font-black text-emerald-500">{report.tables.filter(t => t.isAligned).length}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-rose-600 opacity-60">Live Mismatches</p>
                    <p className="text-3xl font-black text-rose-500">{report.tables.reduce((acc, t) => acc + t.missingColumns.length, 0)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest opacity-30">Last Verified</p>
                    <p className="text-lg font-black opacity-50 mt-2 uppercase tracking-tight">{new Date(report.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Table Audit */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest opacity-40 mb-2 px-4">
                <Database size={16} /> Schema Comparison Engine
              </div>
              
              <div className="space-y-4">
                {report.tables.map((table) => (
                  <div 
                    key={table.name} 
                    className={`rounded-[2.5rem] border transition-all duration-500 overflow-hidden ${table.isAligned 
                      ? 'bg-emerald-500/[0.01] border-emerald-500/10 hover:border-emerald-500/30' 
                      : 'bg-rose-500/[0.01] border-rose-500/10 hover:border-rose-500/30'}`}
                    style={{ background: table.isAligned ? 'var(--surface2)' : 'var(--surface2)', borderColor: 'var(--border)' }}
                  >
                    <button 
                      onClick={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                      className="w-full flex items-center justify-between p-8"
                    >
                      <div className="flex items-center gap-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${table.isAligned ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                          {table.isAligned ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                        </div>
                        <span className="text-lg font-black uppercase tracking-tight font-mono">{table.name}</span>
                      </div>
                      <div className="flex items-center gap-8">
                        <span className="text-[11px] font-bold opacity-30 uppercase tracking-widest">{table.actualColumns.length} <span className="">cols</span></span>
                        {!table.isAligned && (
                          <span className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20">
                            {table.missingColumns.length} Missing
                          </span>
                        )}
                        <ChevronDown size={20} className={`opacity-20 transition-transform duration-500 ${expandedTable === table.name ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {expandedTable === table.name && (
                      <div className="px-8 pb-10 animate-in slide-in-from-top-4 duration-500">
                        <div className="pt-8 border-t space-y-10" style={{ borderColor: 'var(--border)' }}>
                          {!table.isAligned && (
                            <div className="space-y-5">
                               <p className="text-[11px] font-black uppercase tracking-widest text-rose-600/70 flex items-center gap-2">
                                 <Terminal size={14} /> Remediation Strategy
                               </p>
                               <div className="p-6 rounded-[1.5rem] bg-black text-emerald-400 font-mono text-[13px] leading-relaxed shadow-2xl">
                                 <code>
                                   <span className="opacity-30 italic">-- Fix command:</span> <br/>
                                   <span className="text-white">ALTER TABLE</span> {table.name} <br/>
                                   {table.missingColumns.map((c, i) => (
                                     <span key={`sql-${table.name}-${c}`} className="pl-4">
                                       <span className="text-white">ADD COLUMN</span> {c} <span className="opacity-40">...{i < table.missingColumns.length - 1 ? ',' : ';'}</span>
                                       <br/>
                                     </span>
                                   ))}
                                 </code>
                               </div>
                               <p className="text-[10px] font-medium opacity-40 italic px-2">Execute these additions in the Supabase SQL Editor to align with the blueprint.</p>
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                             <div className="space-y-4">
                                <p className="text-[11px] font-black uppercase tracking-widest opacity-30">Expected Blueprint</p>
                                <div className="flex flex-wrap gap-2">
                                  {table.expectedColumns.map(c => (
                                    <span key={`exp-${table.name}-${c}`} className="px-3 py-1.5 rounded-lg border text-[11px] font-medium opacity-60" style={{ background: 'var(--surface3)', borderColor: 'var(--border)' }}>{c}</span>
                                  ))}
                                </div>
                             </div>
                             <div className="space-y-4">
                                <p className="text-[11px] font-black uppercase tracking-widest opacity-30">Live Production</p>
                                <div className="flex flex-wrap gap-2">
                                  {table.actualColumns.map(c => (
                                    <span key={`act-${table.name}-${c}`} className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border ${table.expectedColumns.includes(c) ? 'opacity-40' : 'bg-orange-500/10 border-orange-500/20 text-orange-600'}`} style={{ background: table.expectedColumns.includes(c) ? 'var(--surface3)' : '', borderColor: 'var(--border)' }}>{c}</span>
                                  ))}
                                </div>
                             </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Sidebar Governance */}
            <div className="space-y-10">
              <div className="p-10 rounded-[3rem] border space-y-10 shadow-sm" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
                <div className="space-y-6">
                  <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest opacity-40">
                    <Lock size={16} /> Security (RLS)
                  </div>
                  <div className="space-y-2">
                    {report.rlsStatus.map((s, idx) => (
                      <div key={`rls-${idx}`} className="flex items-center justify-between p-4 rounded-2xl border" style={{ background: 'var(--surface3)', borderColor: 'var(--border)' }}>
                        <span className="text-[12px] font-black opacity-60 font-mono uppercase tracking-tight">{s.tableName}</span>
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${s.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                          {s.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6 pt-10 border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest opacity-40">
                    <Zap size={16} /> Core Functions
                  </div>
                  <div className="space-y-2">
                    {report.functions.map((f, idx) => (
                      <div key={`fn-${idx}`} className="flex items-center justify-between p-4 rounded-2xl border" style={{ background: 'var(--surface3)', borderColor: 'var(--border)' }}>
                        <code className="text-[11px] font-bold opacity-50">{f.name}()</code>
                        {f.exists ? (
                           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                        ) : (
                           <AlertCircle size={16} className="text-rose-500 animate-pulse" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-10 rounded-[3rem] border border-indigo-500/10 space-y-6 relative overflow-hidden group shadow-sm" style={{ background: 'var(--accent-dim)' }}>
                 <div className="text-[11px] font-black uppercase tracking-widest text-indigo-600/80 flex items-center gap-2">
                   <Activity size={14} /> Audit Methodology
                 </div>
                 <p className="text-[13px] font-medium opacity-60 leading-relaxed relative z-10">
                   Benchmarks production architecture against <code>supabase_schema_saas.sql</code>. Discrepancies usually occur after manual table edits or missed migrations.
                 </p>
              </div>
            </div>

          </div>
        ) : (
          <div className="h-[60vh] flex flex-col items-center justify-center space-y-8 animate-pulse">
             <div className="w-24 h-24 rounded-[3rem] border-8 border-emerald-500/10 border-t-emerald-500/40 animate-spin" />
             <div className="text-center">
               <p className="text-sm font-black uppercase tracking-[0.3em] opacity-20">System Scan</p>
               <p className="text-[11px] font-bold opacity-30 uppercase mt-2">Checking Database Integrity...</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
