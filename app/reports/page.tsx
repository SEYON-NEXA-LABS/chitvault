'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import {
  StatCard, Card, Table, Th, Td, Tr, Badge,
  Loading, Empty, Btn
} from '@/components/ui'
import type { Group, Member, Auction, Payment, ForemanCommission } from '@/types'
import {
  Printer, TrendingUp, DollarSign, BarChart3,
  Calendar, BookOpen, User, AlertTriangle, Trophy,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react'

type TabId =
  | 'pl' | 'cashflow' | 'dividend'
  | 'upcoming' | 'schedule' | 'ledger'
  | 'member_history' | 'defaulters' | 'winners'

const TABS = [
  { id: 'pl'            , label: 'P&L Statement'      , icon: '📊', cat: 'Financial'   },
  { id: 'cashflow'      , label: 'Cash Flow'           , icon: '💸', cat: 'Financial'   },
  { id: 'dividend'      , label: 'Dividend Performance', icon: '📈', cat: 'Financial'   },
  { id: 'upcoming'      , label: 'Upcoming Payments'   , icon: '⏰', cat: 'Operational' },
  { id: 'schedule'      , label: 'Auction Schedule'    , icon: '🗓', cat: 'Operational' },
  { id: 'ledger'        , label: 'Group Ledger'        , icon: '📒', cat: 'Operational' },
  { id: 'member_history', label: 'Member History'      , icon: '👤', cat: 'Member'      },
  { id: 'defaulters'    , label: 'Defaulter Analysis'  , icon: '⚠️', cat: 'Member'      },
  { id: 'winners'       , label: 'Auction Winners'     , icon: '🏆', cat: 'Member'      },
] as const

const selStyle = { background: 'rgba(201,168,76,0.15)', borderColor: 'var(--gold)', color: 'var(--gold)' }
const defStyle = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text2)' }

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden mb-5">
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  )
}

function PrintBtn() {
  return <Btn size="sm" variant="secondary" onClick={() => window.print()}><Printer size={13} /> Print</Btn>
}

const dropCls = 'px-3 py-2 rounded-lg border text-sm outline-none'
const dropSty = { background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text)', minWidth: 240 } as React.CSSProperties

export default function ReportsPage() {
  const supabase = createClient()
  const { firm } = useFirm()

  const [tab,         setTab]         = useState<TabId>('pl')
  const [loading,     setLoading]     = useState(true)
  const [groups,      setGroups]      = useState<Group[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [auctions,    setAuctions]    = useState<Auction[]>([])
  const [payments,    setPayments]    = useState<Payment[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [ledgerGrp,   setLedgerGrp]   = useState('')
  const [histMember,  setHistMember]  = useState('')

  const load = useCallback(async () => {
    if (!firm) return
    setLoading(true)
    const [g, m, a, p, fc] = await Promise.all([
      supabase.from('groups').select('*').eq('firm_id', firm.id).order('name'),
      supabase.from('members').select('*').eq('firm_id', firm.id),
      supabase.from('auctions').select('*').eq('firm_id', firm.id).order('month'),
      supabase.from('payments').select('*').eq('firm_id', firm.id).order('created_at'),
      supabase.from('foreman_commissions').select('*').eq('firm_id', firm.id).order('month'),
    ])
    setGroups(g.data||[]); setMembers(m.data||[]); setAuctions(a.data||[])
    setPayments(p.data||[]); setCommissions(fc.data||[])
    setLoading(false)
  }, [firm])

  useEffect(() => { if (firm) load() }, [firm, load])

  const paid = payments.filter(p => p.status === 'paid')

  function monthPaid(mId: number, gId: number, mo: number) {
    return payments.filter(p => p.member_id===mId && p.group_id===gId && p.month===mo)
      .reduce((s,p) => s+Number(p.amount), 0)
  }

  function monthDue(gId: number, mo: number) {
    const g   = groups.find(x => x.id===gId)
    const auc = auctions.find(a => a.group_id===gId && a.month===mo)
    if (!g) return 0
    return Number(g.monthly_contribution) - Number(auc?.dividend||0)
  }

  if (loading) return <Loading />

  // ── P&L ──────────────────────────────────────────────────
  const plRows = groups.map(g => {
    const fc        = commissions.filter(c => c.group_id===g.id)
    const income    = fc.reduce((s,c) => s+Number(c.commission_amt), 0)
    const collected = paid.filter(p => p.group_id===g.id).reduce((s,p) => s+Number(p.amount), 0)
    const winnerOut = auctions.filter(a => a.group_id===g.id).reduce((s,a) => s+Number(a.bid_amount), 0)
    const net       = collected - winnerOut
    return { g, income, collected, winnerOut, net }
  })
  const plTotCollected = plRows.reduce((s,r) => s+r.collected, 0)
  const plTotIncome    = plRows.reduce((s,r) => s+r.income, 0)
  const plTotOut       = plRows.reduce((s,r) => s+r.winnerOut, 0)
  const plTotNet       = plRows.reduce((s,r) => s+r.net, 0)

  // ── Cash Flow ─────────────────────────────────────────────
  const cfMap: Record<string, { cashIn:number; cashOut:number }> = {}
  paid.forEach(p => {
    const k = p.payment_date?.slice(0,7) || 'Unknown'
    if (!cfMap[k]) cfMap[k] = { cashIn:0, cashOut:0 }
    cfMap[k].cashIn += Number(p.amount)
  })
  auctions.forEach(a => {
    const k = a.auction_date?.slice(0,7) || 'Unknown'
    if (!cfMap[k]) cfMap[k] = { cashIn:0, cashOut:0 }
    cfMap[k].cashOut += Number(a.bid_amount)
  })
  const cfRows = Object.entries(cfMap)
    .filter(([k]) => k !== 'Unknown')
    .sort(([a],[b]) => a.localeCompare(b))
    .slice(-12)
  const cfTotIn  = cfRows.reduce((s,[,v]) => s+v.cashIn, 0)
  const cfTotOut = cfRows.reduce((s,[,v]) => s+v.cashOut, 0)

  // ── Upcoming Payments ─────────────────────────────────────
  const upcoming: { member: Member; group: Group; month: number; due: number }[] = []
  groups.forEach(g => {
    const gAucs = auctions.filter(a => a.group_id===g.id).sort((a,b) => b.month-a.month)
    if (!gAucs.length) return
    const latest = gAucs[0]
    const due    = Number(g.monthly_contribution) - Number(latest.dividend)
    members.filter(m => m.group_id===g.id && m.status==='active').forEach(m => {
      const bal = due - monthPaid(m.id, g.id, latest.month)
      if (bal > 0.01) upcoming.push({ member:m, group:g, month:latest.month, due:bal })
    })
  })
  upcoming.sort((a,b) => b.due - a.due)

  // ── Auction Schedule ──────────────────────────────────────
  const schedUpcoming: { group:Group; month:number; date:string|null }[] = []
  groups.filter(g => g.status!=='closed').forEach(g => {
    const done = auctions.filter(a => a.group_id===g.id).length
    for (let m=done+1; m<=g.duration; m++) {
      let d: string|null = null
      if (g.start_date) {
        const dt = new Date(g.start_date)
        dt.setMonth(dt.getMonth()+m-1)
        d = dt.toISOString().split('T')[0]
      }
      schedUpcoming.push({ group:g, month:m, date:d })
    }
  })
  schedUpcoming.sort((a,b) => {
    if (!a.date&&!b.date) return 0
    if (!a.date) return 1; if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })
  const recentAucs = [...auctions].sort((a,b) => (b.auction_date||'').localeCompare(a.auction_date||'')).slice(0,10)

  // ── Group Ledger ──────────────────────────────────────────
  const selGrp = groups.find(g => g.id===+ledgerGrp)
  const ledgerEntries: { date:string|null; type:string; desc:string; cashIn:number; cashOut:number }[] = []
  if (selGrp) {
    paid.filter(p => p.group_id===selGrp.id).forEach(p => {
      const m = members.find(x => x.id===p.member_id)
      ledgerEntries.push({ date:p.payment_date, type:'payment', desc:`Payment — ${m?.name} (M${p.month})`, cashIn:Number(p.amount), cashOut:0 })
    })
    auctions.filter(a => a.group_id===selGrp.id).forEach(a => {
      const w = members.find(x => x.id===a.winner_id)
      ledgerEntries.push({ date:a.auction_date, type:'auction', desc:`Payout M${a.month} → ${w?.name||'?'}`, cashIn:0, cashOut:Number(a.bid_amount) })
    })
    commissions.filter(c => c.group_id===selGrp.id).forEach(c => {
      ledgerEntries.push({ date:null, type:'commission', desc:`Commission M${c.month}`, cashIn:Number(c.commission_amt), cashOut:0 })
    })
    ledgerEntries.sort((a,b) => {
      if (!a.date&&!b.date) return 0; if (!a.date) return 1; if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
  }
  let runBal = 0
  const ledgerEnriched = ledgerEntries.map(e => { runBal += e.cashIn - e.cashOut; return { ...e, bal:runBal } })
  const ledgerTotIn  = ledgerEntries.reduce((s,e) => s+e.cashIn, 0)
  const ledgerTotOut = ledgerEntries.reduce((s,e) => s+e.cashOut, 0)

  // ── Member History ────────────────────────────────────────
  const selMember = members.find(m => m.id===+histMember)
  const selMGrp   = selMember ? groups.find(g => g.id===selMember.group_id) : null
  const selMAucs  = selMember ? auctions.filter(a => a.group_id===selMember.group_id).sort((a,b) => a.month-b.month) : []
  const selMPays  = selMember ? paid.filter(p => p.member_id===selMember.id) : []
  const selMTotal = selMPays.reduce((s,p) => s+Number(p.amount), 0)
  const samePerson = selMember?.contact_id
    ? members.filter(m => m.contact_id===selMember.contact_id && m.id!==selMember.id) : []

  // ── Defaulters ────────────────────────────────────────────
  const defaulters = members.filter(m => m.status==='defaulter').map(m => {
    const g = groups.find(x => x.id===m.group_id)
    const gAucs = auctions.filter(a => a.group_id===m.group_id)
    let owed = 0
    gAucs.forEach(a => { owed += Math.max(0, monthDue(m.group_id, a.month) - monthPaid(m.id, m.group_id, a.month)) })
    return { m, g, owed, paid:paid.filter(p=>p.member_id===m.id).length, pending:gAucs.length - paid.filter(p=>p.member_id===m.id).length }
  }).sort((a,b) => b.owed-a.owed)
  const totalDebt = defaulters.reduce((s,d) => s+d.owed, 0)

  // ── Winners ───────────────────────────────────────────────
  const winners = auctions.filter(a => a.winner_id).map(a => ({
    a, w: members.find(m => m.id===a.winner_id), g: groups.find(g => g.id===a.group_id)
  })).sort((a,b) => (a.g?.name||'').localeCompare(b.g?.name||'') || a.a.month - b.a.month)
  const winnersTotal = winners.reduce((s,x) => s+Number(x.a.bid_amount), 0)
  const winnersAvg   = winners.length > 0 ? winnersTotal/winners.length : 0

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 space-y-3">
        {['Financial','Operational','Member'].map(cat => (
          <div key={cat}>
            <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color:'var(--text3)' }}>{cat}</div>
            <div className="flex flex-wrap gap-1.5">
              {TABS.filter(t => t.cat===cat).map(t => (
                <button key={t.id} onClick={() => setTab(t.id as TabId)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border"
                  style={tab===t.id ? selStyle : defStyle}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── P&L ── */}
      {tab==='pl' && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard label="Commission Income"  value={fmt(plTotIncome)}    color="green" />
          <StatCard label="Total Collected"    value={fmt(plTotCollected)} color="blue"  />
          <StatCard label="Paid to Winners"    value={fmt(plTotOut)}       color="red"   />
          <StatCard label="Net Cash Position"  value={fmt(plTotNet)}       color={plTotNet>=0?'green':'red'} />
        </div>
        <Section title="Profit & Loss by Group" actions={<PrintBtn/>}>
          <Table>
            <thead><tr><Th>Group</Th><Th right>Chit Value</Th><Th right>Commission</Th><Th right>Collected</Th><Th right>Paid Out</Th><Th right>Net</Th></tr></thead>
            <tbody>
              {plRows.map(({g,income,collected,winnerOut,net}) => (
                <Tr key={g.id}>
                  <Td><span className="font-semibold">{g.name}</span></Td>
                  <Td right>{fmt(g.chit_value)}</Td>
                  <Td right><span style={{color:'var(--green)'}}>{fmt(income)}</span></Td>
                  <Td right><span style={{color:'var(--green)'}}>{fmt(collected)}</span></Td>
                  <Td right><span style={{color:'var(--red)'}}>{fmt(winnerOut)}</span></Td>
                  <Td right><span style={{color:net>=0?'var(--green)':'var(--red)',fontWeight:700}}>{net>=0?'+':''}{fmt(net)}</span></Td>
                </Tr>
              ))}
              <Tr style={{background:'var(--surface2)',fontWeight:700}}>
                <Td><strong>Total</strong></Td><Td>—</Td>
                <Td right style={{color:'var(--green)'}}>{fmt(plTotIncome)}</Td>
                <Td right style={{color:'var(--green)'}}>{fmt(plTotCollected)}</Td>
                <Td right style={{color:'var(--red)'}}>{fmt(plTotOut)}</Td>
                <Td right style={{color:plTotNet>=0?'var(--green)':'var(--red)',fontSize:16}}><strong>{plTotNet>=0?'+':''}{fmt(plTotNet)}</strong></Td>
              </Tr>
            </tbody>
          </Table>
        </Section>
        <div className="p-4 rounded-xl border text-sm" style={{background:'rgba(91,138,245,0.06)',borderColor:'rgba(91,138,245,0.2)',color:'var(--blue)'}}>
          <strong>Commission Income</strong> = foreman commission per auction (from Auctions page). <strong>Net</strong> = collected − paid to winners. Positive net = healthy cash flow.
        </div>
      </>}

      {/* ── Cash Flow ── */}
      {tab==='cashflow' && <>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <StatCard label="Total Cash In"  value={fmt(cfTotIn)}           color="green" />
          <StatCard label="Total Cash Out" value={fmt(cfTotOut)}          color="red"   />
          <StatCard label="Net Cash Flow"  value={fmt(cfTotIn-cfTotOut)}  color={cfTotIn>=cfTotOut?'green':'red'} />
        </div>
        <Section title="Monthly Cash Flow — Last 12 Months" actions={<PrintBtn/>}>
          {cfRows.length===0
            ? <Empty icon="💸" text="No payment data yet." />
            : <Table>
                <thead><tr><Th>Month</Th><Th right>Cash In (Collections)</Th><Th right>Cash Out (Winners)</Th><Th right>Net</Th></tr></thead>
                <tbody>
                  {cfRows.map(([month,{cashIn,cashOut}]) => {
                    const [yr,mo] = month.split('-')
                    const label = new Date(+yr,+mo-1).toLocaleDateString('en-IN',{month:'short',year:'numeric'})
                    const net = cashIn-cashOut
                    return (
                      <Tr key={month}>
                        <Td><span className="font-semibold">{label}</span></Td>
                        <Td right><span style={{color:'var(--green)'}}><ArrowUpRight size={13} className="inline"/> {fmt(cashIn)}</span></Td>
                        <Td right><span style={{color:'var(--red)'}}><ArrowDownRight size={13} className="inline"/> {fmt(cashOut)}</span></Td>
                        <Td right><span style={{color:net>=0?'var(--green)':'var(--red)',fontWeight:600}}>{net>=0?'+':''}{fmt(net)}</span></Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
          }
        </Section>
      </>}

      {/* ── Dividend Performance ── */}
      {tab==='dividend' && <>
        {groups.filter(g => auctions.some(a => a.group_id===g.id)).length===0
          ? <Empty icon="📈" text="No auctions recorded yet." />
          : groups.map(g => {
              const gAucs = auctions.filter(a => a.group_id===g.id).sort((a,b) => a.month-b.month)
              if (!gAucs.length) return null
              const avg = gAucs.reduce((s,a) => s+Number(a.dividend),0) / gAucs.length
              const mx  = Math.max(...gAucs.map(a => Number(a.dividend)))
              const mn  = Math.min(...gAucs.map(a => Number(a.dividend)))
              return (
                <Section key={g.id} title={`${g.name} — Dividend Trend (${gAucs.length} auctions)`}>
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[{l:'Avg Dividend',v:fmt(avg),c:'var(--green)'},{l:'Highest',v:fmt(mx),c:'var(--blue)'},{l:'Lowest',v:fmt(mn),c:'var(--red)'}].map(x=>(
                        <div key={x.l} className="rounded-xl p-3 text-center" style={{background:'var(--surface2)'}}>
                          <div className="text-xs mb-1" style={{color:'var(--text3)'}}>{x.l}</div>
                          <div className="font-mono font-bold" style={{color:x.c}}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Visual bar chart */}
                    <div className="flex items-end gap-1" style={{height:72}}>
                      {gAucs.map(a => {
                        const pct = mx>0?(Number(a.dividend)/mx)*100:0
                        return (
                          <div key={a.month} className="flex flex-col items-center gap-1" style={{flex:1}} title={`M${a.month}: ${fmt(a.dividend)}`}>
                            <div style={{width:'100%',height:`${pct}%`,minHeight:3,background:'var(--gold)',borderRadius:'3px 3px 0 0'}}/>
                            <span style={{fontSize:9,color:'var(--text3)'}}>M{a.month}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3">
                      <Table>
                        <thead><tr><Th>Month</Th><Th>Auction Date</Th><Th right>Bid</Th><Th right>Dividend/Member</Th><Th right>Each Member Paid</Th></tr></thead>
                        <tbody>
                          {gAucs.map(a => (
                            <Tr key={a.month}>
                              <Td><Badge variant="blue">M{a.month}</Badge></Td>
                              <Td>{fmtDate(a.auction_date)}</Td>
                              <Td right>{fmt(a.bid_amount)}</Td>
                              <Td right><span style={{color:'var(--green)'}}>{fmt(a.dividend)}</span></Td>
                              <Td right><span style={{color:'var(--text)'}}>{fmt(Number(g.monthly_contribution)-Number(a.dividend))}</span></Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </Section>
              )
            })
        }
      </>}

      {/* ── Upcoming Payments ── */}
      {tab==='upcoming' && <>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <StatCard label="Members with Dues" value={upcoming.length} color="red"/>
          <StatCard label="Total Pending"      value={fmt(upcoming.reduce((s,u)=>s+u.due,0))} color="red"/>
          <StatCard label="Active Groups"      value={groups.filter(g=>g.status!=='closed').length} color="blue"/>
        </div>
        <Section title="Current Cycle — Pending Payments" actions={<PrintBtn/>}>
          {upcoming.length===0
            ? <Empty icon="🎉" text="All payments collected for the current auction month!"/>
            : <Table>
                <thead><tr><Th>Member</Th><Th>Phone</Th><Th>Group · Ticket</Th><Th>Month</Th><Th right>Amount Due</Th></tr></thead>
                <tbody>
                  {upcoming.map((u,i) => (
                    <Tr key={i}>
                      <Td><span className="font-semibold">{u.member.name}</span></Td>
                      <Td>{u.member.phone ? <a href={`tel:${u.member.phone}`} style={{color:'var(--blue)',textDecoration:'none'}}>📞 {u.member.phone}</a>:'—'}</Td>
                      <Td>{u.group.name} · #{u.member.ticket_no}</Td>
                      <Td><Badge variant="blue">M{u.month}</Badge></Td>
                      <Td right><span className="font-mono font-semibold" style={{color:'var(--red)'}}>{fmt(u.due)}</span></Td>
                    </Tr>
                  ))}
                  <Tr style={{background:'var(--surface2)'}}>
                    <Td colSpan={4} style={{textAlign:'right',fontWeight:600}}>Total Due</Td>
                    <Td right><span className="font-mono font-bold text-base" style={{color:'var(--red)'}}>{fmt(upcoming.reduce((s,u)=>s+u.due,0))}</span></Td>
                  </Tr>
                </tbody>
              </Table>
          }
        </Section>
      </>}

      {/* ── Auction Schedule ── */}
      {tab==='schedule' && <>
        <Section title={`Upcoming Auctions (${schedUpcoming.slice(0,20).length})`} actions={<PrintBtn/>}>
          {schedUpcoming.length===0
            ? <Empty icon="📅" text="All auctions completed."/>
            : <Table>
                <thead><tr><Th>Group</Th><Th>Month</Th><Th>Est. Date</Th><Th right>Chit Value</Th><Th>Progress</Th></tr></thead>
                <tbody>
                  {schedUpcoming.slice(0,20).map((s,i) => {
                    const done = auctions.filter(a => a.group_id===s.group.id).length
                    const pct  = Math.round(done/s.group.duration*100)
                    return (
                      <Tr key={i}>
                        <Td><span className="font-semibold">{s.group.name}</span></Td>
                        <Td><Badge variant="blue">Month {s.month}</Badge></Td>
                        <Td>{s.date?fmtDate(s.date):<span style={{color:'var(--text3)'}}>No start date</span>}</Td>
                        <Td right>{fmt(s.group.chit_value)}</Td>
                        <Td><div className="flex items-center gap-2"><div className="progress-bar-wrap w-16 inline-block"><div className="progress-bar" style={{width:`${pct}%`}}/></div><span className="text-xs" style={{color:'var(--text3)'}}>{pct}%</span></div></Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
          }
        </Section>
        <Section title="Recently Completed (Last 10)">
          <Table>
            <thead><tr><Th>Group</Th><Th>Month</Th><Th>Date</Th><Th>Winner</Th><Th right>Bid</Th><Th right>Dividend</Th></tr></thead>
            <tbody>
              {recentAucs.map(a => {
                const g = groups.find(x => x.id===a.group_id)
                const w = members.find(x => x.id===a.winner_id)
                return (
                  <Tr key={a.id}>
                    <Td>{g?.name||'—'}</Td>
                    <Td><Badge variant="gray">M{a.month}</Badge></Td>
                    <Td>{fmtDate(a.auction_date)}</Td>
                    <Td>👑 {w?.name||'—'}</Td>
                    <Td right>{fmt(a.bid_amount)}</Td>
                    <Td right style={{color:'var(--green)'}}>{fmt(a.dividend)}</Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </Section>
      </>}

      {/* ── Group Ledger ── */}
      {tab==='ledger' && <>
        <div className="flex gap-3 mb-5">
          <select className={dropCls} style={dropSty} value={ledgerGrp} onChange={e=>setLedgerGrp(e.target.value)}>
            <option value="">Select group to view ledger…</option>
            {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {selGrp && <PrintBtn/>}
        </div>
        {!selGrp
          ? <Empty icon="📒" text="Select a group to view its complete transaction ledger."/>
          : <>
              <div className="grid grid-cols-3 gap-4 mb-5">
                <StatCard label="Total In"  value={fmt(ledgerTotIn)}  color="green"/>
                <StatCard label="Total Out"  value={fmt(ledgerTotOut)} color="red"/>
                <StatCard label="Net"        value={fmt(ledgerTotIn-ledgerTotOut)} color={ledgerTotIn>=ledgerTotOut?'green':'red'}/>
              </div>
              <Section title={`${selGrp.name} — Full Ledger`}>
                <Table>
                  <thead><tr><Th>Date</Th><Th>Description</Th><Th>Type</Th><Th right>Cash In</Th><Th right>Cash Out</Th><Th right>Balance</Th></tr></thead>
                  <tbody>
                    {ledgerEnriched.length===0&&<Tr><Td>No transactions yet.</Td></Tr>}
                    {ledgerEnriched.map((e,i) => (
                      <Tr key={i}>
                        <Td>{fmtDate(e.date)}</Td>
                        <Td>{e.desc}</Td>
                        <Td><Badge variant={e.type==='payment'?'green':e.type==='auction'?'red':'gold'}>{e.type==='payment'?'Receipt':e.type==='auction'?'Payout':'Commission'}</Badge></Td>
                        <Td right>{e.cashIn>0?<span style={{color:'var(--green)'}}>{fmt(e.cashIn)}</span>:'—'}</Td>
                        <Td right>{e.cashOut>0?<span style={{color:'var(--red)'}}>{fmt(e.cashOut)}</span>:'—'}</Td>
                        <Td right><span style={{color:e.bal>=0?'var(--green)':'var(--red)',fontWeight:600}}>{fmt(e.bal)}</span></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </Section>
            </>
        }
      </>}

      {/* ── Member History ── */}
      {tab==='member_history' && <>
        <div className="flex gap-3 mb-5">
          <select className={dropCls} style={dropSty} value={histMember} onChange={e=>setHistMember(e.target.value)}>
            <option value="">Select member…</option>
            {members.map(m=>{const g=groups.find(x=>x.id===m.group_id);return <option key={m.id} value={m.id}>{m.name} — {g?.name} #{m.ticket_no}</option>})}
          </select>
          {selMember&&<PrintBtn/>}
        </div>
        {!selMember
          ? <Empty icon="👤" text="Select a member to view their full payment history."/>
          : <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatCard label="Total Paid"    value={fmt(selMTotal)}                    color="green"/>
                <StatCard label="Months Paid"   value={selMPays.length}                   color="blue"/>
                <StatCard label="Months Pending" value={Math.max(0,selMAucs.length-selMPays.length)} color="red"/>
                <StatCard label="Ticket"        value={`#${selMember.ticket_no}`}          color="gold"/>
              </div>
              {samePerson.length>0&&(
                <div className="p-3 rounded-xl border mb-4 text-sm" style={{background:'rgba(91,138,245,0.06)',borderColor:'rgba(91,138,245,0.2)',color:'var(--blue)'}}>
                  👥 Also member in: {samePerson.map(m=>{const g=groups.find(x=>x.id===m.group_id);return `${g?.name} #${m.ticket_no}`}).join(', ')}
                </div>
              )}
              <Section title={`${selMember.name} — ${selMGrp?.name} — Payment Statement`}>
                <Table>
                  <thead><tr><Th>Month</Th><Th>Auction Date</Th><Th right>Due</Th><Th right>Paid</Th><Th>Payment Date</Th><Th>Mode</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {selMAucs.map(a => {
                      const moPays = selMPays.filter(p => p.month===a.month)
                      const totMoPaid = moPays.reduce((s,p)=>s+Number(p.amount),0)
                      const due = monthDue(selMember.group_id, a.month)
                      const full = totMoPaid>=due
                      return (
                        <Tr key={a.month}>
                          <Td><Badge variant="blue">M{a.month}</Badge></Td>
                          <Td>{fmtDate(a.auction_date)}</Td>
                          <Td right>{fmt(due)}</Td>
                          <Td right><span style={{color:full?'var(--green)':totMoPaid>0?'var(--gold)':'var(--red)',fontWeight:600}}>{fmt(totMoPaid)}</span></Td>
                          <Td>{moPays.length>0?fmtDate(moPays[moPays.length-1].payment_date):'—'}</Td>
                          <Td>{moPays.length>0?moPays.map(p=>p.mode).join(', '):'—'}</Td>
                          <Td>{full?<Badge variant="green">✓ Paid</Badge>:totMoPaid>0?<Badge variant="gold">Partial</Badge>:<Badge variant="red">Pending</Badge>}</Td>
                        </Tr>
                      )
                    })}
                    <Tr style={{background:'var(--surface2)'}}>
                      <Td colSpan={3} style={{textAlign:'right',fontWeight:600}}>Total Paid</Td>
                      <Td right><span style={{color:'var(--green)',fontWeight:700,fontSize:15}}>{fmt(selMTotal)}</span></Td>
                      <Td colSpan={3}/>
                    </Tr>
                  </tbody>
                </Table>
              </Section>
            </>
        }
      </>}

      {/* ── Defaulters ── */}
      {tab==='defaulters' && <>
        <div className="grid grid-cols-3 gap-4 mb-5">
          <StatCard label="Active Defaulters"  value={defaulters.length} color="red"/>
          <StatCard label="Total Outstanding"  value={fmt(totalDebt)}    color="red"/>
          <StatCard label="Exited with Notes"  value={members.filter(m=>m.status==='exited'&&m.notes).length} color="gold"/>
        </div>
        <Section title="Current Defaulters" actions={<PrintBtn/>}>
          {defaulters.length===0
            ? <Empty icon="✅" text="No active defaulters."/>
            : <Table>
                <thead><tr><Th>Member</Th><Th>Phone</Th><Th>Group · Ticket</Th><Th>Paid</Th><Th>Pending</Th><Th right>Total Owed</Th><Th>Notes</Th></tr></thead>
                <tbody>
                  {defaulters.map(({m,g,owed,paid:paidMo,pending}) => (
                    <Tr key={m.id} style={{background:'rgba(246,109,122,0.03)'}}>
                      <Td><div className="font-semibold">{m.name}</div><Badge variant="red" className="mt-0.5">⚠ Defaulter</Badge></Td>
                      <Td>{m.phone?<a href={`tel:${m.phone}`} style={{color:'var(--blue)',textDecoration:'none'}}>📞 {m.phone}</a>:'—'}</Td>
                      <Td>{g?.name||'—'} · #{m.ticket_no}</Td>
                      <Td><Badge variant="green">✓{paidMo}</Badge></Td>
                      <Td><Badge variant="red">⚠{pending}</Badge></Td>
                      <Td right><span className="font-mono font-bold" style={{color:'var(--red)'}}>{fmt(owed)}</span></Td>
                      <Td><span className="text-xs" style={{color:'var(--text2)'}}>{m.notes||'—'}</span></Td>
                    </Tr>
                  ))}
                  <Tr style={{background:'var(--surface2)'}}>
                    <Td colSpan={5} style={{textAlign:'right',fontWeight:600}}>Total</Td>
                    <Td right><span style={{color:'var(--red)',fontWeight:700,fontSize:15}}>{fmt(totalDebt)}</span></Td>
                    <Td/>
                  </Tr>
                </tbody>
              </Table>
          }
        </Section>
        {members.filter(m=>m.status==='exited'&&m.notes).length>0&&(
          <Section title="Exited Members with Notes">
            <Table>
              <thead><tr><Th>Member</Th><Th>Group</Th><Th>Exit Month</Th><Th>Notes</Th></tr></thead>
              <tbody>
                {members.filter(m=>m.status==='exited'&&m.notes).map(m => {
                  const g=groups.find(x=>x.id===m.group_id)
                  return <Tr key={m.id}><Td>{m.name}</Td><Td>{g?.name||'—'}</Td><Td>{m.exit_month?`M${m.exit_month}`:'—'}</Td><Td><span className="text-xs" style={{color:'var(--text2)'}}>{m.notes}</span></Td></Tr>
                })}
              </tbody>
            </Table>
          </Section>
        )}
      </>}

      {/* ── Winners ── */}
      {tab==='winners' && <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <StatCard label="Total Winners"   value={winners.length}   color="gold"/>
          <StatCard label="Total Paid Out"  value={fmt(winnersTotal)} color="red"/>
          <StatCard label="Average Bid"     value={fmt(winnersAvg)}  color="blue"/>
          <StatCard label="Still Have Dues" value={winners.filter(({w,g,a})=>w&&g&&auctions.filter(x=>x.group_id===g!.id).some(x=>monthPaid(w!.id,g!.id,x.month)<monthDue(g!.id,x.month)-0.01)).length} color="gold"/>
        </div>
        <Section title="All Auction Winners" actions={<PrintBtn/>}>
          {winners.length===0
            ? <Empty icon="🏆" text="No winners yet."/>
            : <Table>
                <thead><tr><Th>Member</Th><Th>Group · Ticket</Th><Th>Month</Th><Th>Auction Date</Th><Th right>Bid Amount</Th><Th right>Dividend/Member</Th><Th>Dues Status</Th></tr></thead>
                <tbody>
                  {winners.map(({a,w,g}) => {
                    const stillOwes = w&&g&&auctions.filter(x=>x.group_id===g.id).some(x=>monthPaid(w.id,g.id,x.month)<monthDue(g.id,x.month)-0.01)
                    return (
                      <Tr key={a.id}>
                        <Td><span className="font-semibold">👑 {w?.name||'—'}</span></Td>
                        <Td>{g?.name||'—'} · #{w?.ticket_no}</Td>
                        <Td><Badge variant="blue">M{a.month}</Badge></Td>
                        <Td>{fmtDate(a.auction_date)}</Td>
                        <Td right><span style={{color:'var(--green)',fontWeight:600}}>{fmt(a.bid_amount)}</span></Td>
                        <Td right><span style={{color:'var(--gold)'}}>{fmt(a.dividend)}</span></Td>
                        <Td>{stillOwes?<Badge variant="red">⚠ Has dues</Badge>:<Badge variant="green">✓ Cleared</Badge>}</Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
          }
        </Section>
      </>}
    </div>
  )
}
