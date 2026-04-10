'use client'

import { useState } from 'react'
import { fmt, fmtDate } from '@/lib/utils'
import { TableCard, Table, Th, Td, Tr, Badge, Btn } from '@/components/ui'
import { Clock } from 'lucide-react'

// 1. Reconciliation
export function ReportReconciliation({ payments, denominations }: { payments: any[], denominations: any[] }) {
  const dates = Array.from(new Set([...payments.map(p => p.payment_date), ...denominations.map(d => d.entry_date)].filter(Boolean) as string[]))
  const reconData = dates.sort((a, b) => b.localeCompare(a)).map(date => {
    const ledgerTotal = payments.filter(p => p.payment_date === date).reduce((s, p) => s + Number(p.amount), 0)
    const cashbookTotal = denominations.filter(d => d.entry_date === date).reduce((s, d) => s + Number(d.total), 0)
    return { date, ledgerTotal, cashbookTotal, diff: ledgerTotal - cashbookTotal }
  })

  return (
    <TableCard title="Daily Reconciliation" subtitle="Verification of member receipts vs physical cash">
      <Table>
        <thead><tr><Th>Date</Th><Th right>Ledger (A)</Th><Th right>Cashbook (B)</Th><Th right>Diff (A-B)</Th><Th>Status</Th></tr></thead>
        <tbody>
          {reconData.map(r => (
            <Tr key={r.date}>
              <Td>{fmtDate(r.date)}</Td>
              <Td right>{fmt(r.ledgerTotal)}</Td>
              <Td right>{fmt(r.cashbookTotal)}</Td>
              <Td right className={Math.abs(r.diff) > 0.1 ? 'text-danger-500 font-bold' : 'text-success-500'}>{fmt(r.diff)}</Td>
              <Td>{Math.abs(r.diff) < 0.1 ? <Badge variant="success">Matched</Badge> : <Badge variant="danger">Discrepancy</Badge>}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}

// 2. Activity Log
export function ReportActivityLog({ logs, profiles, totalCount }: { logs: any[], profiles: any[], totalCount?: number }) {
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const totalPages = Math.ceil(logs.length / pageSize);
  const displayLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <TableCard 
      title="System Activity Log" 
      subtitle={`Audit trail of critical system actions (${totalCount || logs.length} events)`}
      actions={
        <div className="flex items-center gap-3">
           <Btn size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Btn>
           <span className="text-[10px] font-bold opacity-60">Page {page} of {totalPages || 1}</span>
           <Btn size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Btn>
        </div>
      }
    >
      <Table>
        <thead><tr><Th>Time</Th><Th>User</Th><Th>Action</Th><Th>Details</Th></tr></thead>
        <tbody>
          {displayLogs.map(l => (
            <Tr key={l.id}>
              <Td className="text-[10px] opacity-60"><Clock size={10} className="inline mr-1" />{new Date(l.created_at).toLocaleString()}</Td>
              <Td className="font-bold text-xs">{profiles.find(p => p.id === l.user_id)?.full_name || 'System'}</Td>
              <Td><Badge variant={l.action.includes('DELETED') ? 'danger' : 'info'}>{l.action}</Badge></Td>
              <Td className="text-[10px] font-mono opacity-80">{l.metadata ? JSON.stringify(l.metadata).substring(0, 100) + '...' : '—'}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}
