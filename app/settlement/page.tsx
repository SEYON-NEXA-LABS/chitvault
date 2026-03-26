'use client'

import React, { useMemo, useState } from "react"
import { Card, Table, Th, Td, Tr, Btn } from "@/components/ui"
import { Calculator, Plus, Trash2 } from "lucide-react"
import { fmt } from "@/lib/utils"

type Entry = {
  date: string
  amount: number
}

export default function SettlementPage() {
  const [entries, setEntries] = useState<Entry[]>([
    { date: new Date().toISOString().split('T')[0], amount: 0 }
  ])

  /* ---------------- Calculations ---------------- */

  const totalAmount = useMemo(
    () => entries.reduce((sum, e) => sum + (e.amount || 0), 0),
    [entries]
  )

  const totalMonths = entries.length

  const averagePerMonth = useMemo(() => {
    if (totalMonths === 0) return 0
    // As per user rule: divide by 15
    return Math.round(totalAmount / 15)
  }, [totalAmount, totalMonths])

  /* Running & Closing Balances */
  const balances = useMemo(() => {
    let balance = totalAmount

    return entries.map(entry => {
      balance -= (entry.amount || 0)

      return {
        running: balance,
        closing: balance 
      }
    })
  }, [entries, totalAmount])

  const month14Balance = useMemo(() => {
    return totalAmount - (averagePerMonth * 14)
  }, [totalAmount, averagePerMonth])

  /* ---------------- Handlers ---------------- */

  const updateEntry = (
    index: number,
    field: keyof Entry,
    value: string | number
  ) => {
    const updated = [...entries]
    updated[index] = {
      ...updated[index],
      [field]: field === "amount" ? Number(value || 0) : value
    }
    setEntries(updated)
  }

  const addEntry = () => {
    setEntries([...entries, { date: new Date().toISOString().split('T')[0], amount: 0 }])
  }

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return
    setEntries(entries.filter((_, i) => i !== index))
  }

  /* ---------------- UI ---------------- */

  return (
    <div className="space-y-6 max-w-5xl">
       <div className="flex items-center justify-between border-b pb-4 mb-2" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator size={24} style={{ color: 'var(--gold)' }} />
            Settlement Utility
          </h1>
          <p className="text-sm opacity-60">Monthly amount calculation & settlement summary</p>
        </div>
        <Btn onClick={addEntry} icon={Plus}>Add Month</Btn>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Entry Table (2/3 width) */}
        <div className="lg:col-span-2">
          <Card title="Monthly Amount Entry" subtitle="Enter collection details below">
            <Table>
              <thead>
                <tr>
                  <Th className="w-12">#</Th>
                  <Th>Date</Th>
                  <Th right>Amount (₹)</Th>
                  <Th right>Balance (₹)</Th>
                  <Th className="w-20 text-center">Action</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <Tr key={index}>
                    <Td><span className="text-xs opacity-50 font-mono">#{String(index+1).padStart(2,'0')}</span></Td>
                    <Td>
                      <input
                        type="date"
                        className="bg-transparent border-none outline-none text-sm w-full p-0"
                        style={{ color: 'var(--text)' }}
                        value={entry.date}
                        onChange={e => updateEntry(index, "date", e.target.value)}
                      />
                    </Td>
                    <Td right>
                      <input
                        type="number"
                        className="bg-transparent border-none outline-none text-right font-bold w-full p-0"
                        style={{ color: 'var(--text)' }}
                        value={entry.amount || ''}
                        placeholder="0"
                        onChange={e => updateEntry(index, "amount", e.target.value)}
                      />
                    </Td>
                    <Td right className="font-mono text-xs opacity-80">
                      {fmt(balances[index]?.running)}
                    </Td>
                    <Td className="text-center">
                      <button onClick={() => removeEntry(index)} 
                        className="p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors text-xs opacity-30 hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <div className="mt-4 flex justify-center">
               <button onClick={addEntry} className="text-xs flex items-center gap-1 font-semibold opacity-50 hover:opacity-100 transition-opacity">
                  <Plus size={14} /> ADD NEW MONTH
               </button>
            </div>
          </Card>
        </div>

        {/* Summary (1/3 width) */}
        <div className="space-y-4">
           <Card title="Calculation Summary" subtitle="Tamil Settlement Rules">
              <div className="space-y-4 py-2">
                 <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm">
                       <div className="font-bold">Total Amount</div>
                       <div className="text-xs opacity-50">மொத்தம் (Total)</div>
                    </div>
                    <div className="text-xl font-black" style={{ color: 'var(--gold)' }}>{fmt(totalAmount)}</div>
                 </div>

                 <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm">
                       <div className="font-bold">Total Months</div>
                       <div className="text-xs opacity-50">மாதங்கள் (Months)</div>
                    </div>
                    <div className="text-xl font-mono">{totalMonths}</div>
                 </div>

                 <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm">
                       <div className="font-bold">15-Month Average</div>
                       <div className="text-xs opacity-50">சராசரி (Average)</div>
                    </div>
                    <div className="text-xl font-black" style={{ color: 'var(--green)' }}>{fmt(averagePerMonth)}</div>
                 </div>

                 <div className="p-4 rounded-xl border mt-4" style={{ background: 'var(--gold-dim)', borderColor: 'var(--gold)' }}>
                    <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--gold)' }}>14‑Month Balance</div>
                    <div className="text-xs opacity-60 mb-2">14‑வது மாத மீதி</div>
                    <div className="text-2xl font-black" style={{ color: 'var(--gold)' }}>{fmt(month14Balance)}</div>
                 </div>
              </div>
           </Card>

           <div className="p-4 rounded-xl border text-[11px] leading-relaxed opacity-80" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
             <strong>NOTE:</strong> The "Average Per Month" is calculated by dividing the total amount by 15 as per the handwritten chit settlement rule. The 14th-month balance is calculated as (Total - [Average x 14]).
           </div>
        </div>

      </div>
    </div>
  )
}
