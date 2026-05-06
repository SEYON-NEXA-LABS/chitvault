'use client'

import { useMemo } from 'react'
import { fmt, fmtDate, fmtMonth, getToday } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import Link from 'next/link'
import type { Group, Member, Auction, Payment, ForemanCommission } from '@/types'

// 1. PNL
export function ReportPNL({ groups, commissions, stats, t, term }: { groups: Group[], commissions: ForemanCommission[], stats?: any, t: any, term: any }) {
  const totalIncome = stats?.realizedCommissions ?? commissions.reduce((s, c) => s + Number(c.commission_amt), 0)
  
  // Projection logic using total income as anchor if stats are available
  const potentialTotal = stats?.projectedCommissions ?? groups.reduce((sum, g) => {
    const realized = commissions.filter(c => c.group_id === g.id).reduce((s, c) => s + Number(c.commission_amt), 0)
    const confirmedCount = commissions.filter(c => c.group_id === g.id).length
    const remaining = Math.max(0, g.duration - confirmedCount)
    const avgComm = confirmedCount > 0 ? (realized / confirmedCount) : (g.commission_type === 'percent_of_chit' ? (g.chit_value * g.commission_value / 100) : g.commission_value)
    return sum + realized + (remaining * avgComm)
  }, 0)
  const efficiency = potentialTotal > 0 ? (totalIncome / potentialTotal * 100) : 100

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Realized Firm Income" value={fmt(totalIncome)} color="success" />
        <StatCard label="Full Cycle Projection" value={fmt(potentialTotal)} color="info" />
        <StatCard label="Realization Rate" value={Math.round(efficiency) + '%'} color="accent" />
      </div>

      <TableCard title={term.isAccOnly ? 'Firm Revenue Statement' : t('report_pnl_title')} subtitle="Detailed breakdown of commissions earned.">
        <Table>
          <thead><tr><Th>{t('group_name')}</Th><Th>Rate</Th><Th right>Realized Income</Th><Th right>Cycles</Th></tr></thead>
          <tbody>
            {groups.map(g => {
              const groupComms = commissions.filter(c => c.group_id === g.id)
              const inc = groupComms.reduce((s, c) => s + Number(c.commission_amt), 0)
              return (
                <Tr key={g.id}>
                  <Td>
                    <Link href={`/groups/${g.id}`} className="font-bold hover:text-[var(--accent)] hover:underline transition-colors">
                      {g.name}
                    </Link>
                  </Td>
                  <Td className="text-[var(--text-xs)] opacity-60">
                    {g.commission_type === 'percent_of_chit' ? `${g.commission_value}% of Chit` : `Fixed ₹${g.commission_value}`}
                  </Td>
                  <Td right className="font-black text-[var(--text-sm)]" style={{ color: 'var(--success)' }}>{fmt(inc)}</Td>
                  <Td right><Badge variant="gray">{groupComms.length} / {g.duration}</Badge></Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>
    </>
  )
}

// 2. Today Collection
export function ReportTodayCollection({ payments, members, groups, stats, selectedDate }: { payments: Payment[], members: Member[], groups: Group[], stats?: any, selectedDate: string }) {
  const targetDate = selectedDate || getToday()
  const todayPayments = payments.filter(p => p.payment_date === targetDate)
  
  // Use server-side stats if provided AND we are looking at today, otherwise fallback to array reduction
  const isToday = targetDate === getToday()
  const grandTotal = (stats?.collectedToday && isToday) ? stats?.collectedToday : todayPayments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Selected Date Total" value={fmt(grandTotal)} color="info" sub={`Total received on ${fmtDate(targetDate)}`} />
          <StatCard label="Cash Total" value={fmt(todayPayments.filter(p => p.mode === 'Cash').reduce((s, p) => s + Number(p.amount), 0))} color="accent" />
          <StatCard label="UPI Total" value={fmt(todayPayments.filter(p => p.mode === 'UPI').reduce((s, p) => s + Number(p.amount), 0))} color="success" />
          <StatCard label="Bank Total" value={fmt(todayPayments.filter(p => p.mode === 'Bank Transfer').reduce((s, p) => s + Number(p.amount), 0))} color="info" />
        </div>
        <TableCard title={`Collections for ${fmtDate(targetDate)}`} subtitle={`Showing ${todayPayments.length} transactions`}>
          <Table>
            <thead><tr><Th>Time</Th><Th>Member</Th><Th>Group</Th><Th right>Amount</Th></tr></thead>
            <tbody>
              {todayPayments.map(p => {
                const g = groups.find(x => x.id === p.group_id)
                // Use the joined data if available
                const memberName = (p as any).members?.persons?.name || 'Unknown'
                const personId = (p as any).members?.person_id
                
                return (
                  <Tr key={p.id}>
                    <Td className="text-[var(--text-xs)] opacity-50">{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Td>
                    <Td className="text-[var(--text-sm)]">
                      {personId ? (
                        <Link href={`/members/${personId}`} className="font-semibold hover:text-[var(--accent)] hover:underline transition-colors">
                          {memberName}
                        </Link>
                      ) : (
                        <span className="font-semibold opacity-50">{memberName}</span>
                      )}
                    </Td>
                    <Td>
                      <Link href={`/groups/${g?.id}`} className="text-[var(--text-xs)] hover:text-[var(--accent)] hover:underline transition-colors">
                        {g?.name || '—'}
                      </Link>
                    </Td>
                    <Td right className="font-mono font-bold text-[var(--text-sm)]" style={{ color: 'var(--success)' }}>{fmt(p.amount)}</Td>
                  </Tr>
                )
              })}
              {todayPayments.length === 0 && <Tr><Td colSpan={4} className="text-center py-5">No collections yet.</Td></Tr>}
            </tbody>
          </Table>
        </TableCard>
      </div>

      {/* Simplified Print View */}
      <div className="only-print">
        <div className="mb-6 border-b-2 border-slate-900 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">Daily Collection Report</h1>
            <p className="text-xs font-bold text-slate-500 uppercase mt-1">Date: {fmtDate(targetDate)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Collected</p>
            <p className="text-xl font-black tracking-tighter">{fmt(grandTotal)}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Cash', val: todayPayments.filter(p => p.mode === 'Cash').reduce((s, p) => s + Number(p.amount), 0) },
            { label: 'UPI', val: todayPayments.filter(p => p.mode === 'UPI').reduce((s, p) => s + Number(p.amount), 0) },
            { label: 'Bank', val: todayPayments.filter(p => p.mode === 'Bank Transfer').reduce((s, p) => s + Number(p.amount), 0) },
          ].map(s => (
            <div key={s.label} className="border border-slate-200 p-3 rounded-xl text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
              <p className="text-sm font-black mt-1">{fmt(s.val)}</p>
            </div>
          ))}
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-900">
              <th className="py-2 text-left text-[var(--text-xs)] font-black uppercase tracking-widest">Time</th>
              <th className="py-2 text-left text-[var(--text-xs)] font-black uppercase tracking-widest">Subscriber</th>
              <th className="py-2 text-left text-[var(--text-xs)] font-black uppercase tracking-widest">Group</th>
              <th className="py-2 text-left text-[var(--text-xs)] font-black uppercase tracking-widest">Mode</th>
              <th className="py-2 text-right text-[var(--text-xs)] font-black uppercase tracking-widest">Amount</th>
            </tr>
          </thead>
          <tbody>
            {todayPayments.map(p => {
              const g = groups.find(x => x.id === p.group_id)
              const memberName = (p as any).members?.persons?.name || 'Unknown'
              return (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-2 text-[var(--text-xs)] font-mono text-slate-500">
                    {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 text-[var(--text-xs)] font-bold uppercase">{memberName}</td>
                  <td className="py-2 text-[var(--text-xs)] text-slate-500">{g?.name || '—'}</td>
                  <td className="py-2 text-[var(--text-xs)] text-slate-500">{p.mode}</td>
                  <td className="py-2 text-right text-[var(--text-xs)] font-black">{fmt(p.amount)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
