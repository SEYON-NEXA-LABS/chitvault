'use client'

import React, { useState } from 'react'
import { Modal, Btn, Badge } from '@/components/ui'
import { CheckCircle2, Circle, Printer, ListFilter, Trash2, FileSpreadsheet } from 'lucide-react'

interface ColumnOption {
  id: string
  label: string
  category?: 'identity' | 'auction' | 'financial'
  required?: boolean
}

interface PrintOptionsModalProps {
  open: boolean
  onClose: () => void
  onPrint: (settings: Record<string, { include: boolean, populate: boolean }>) => void
  availableCols: ColumnOption[]
  defaultSelected?: string[]
  title?: string
}

export const PrintOptionsModal: React.FC<PrintOptionsModalProps> = (props) => {
  const { 
    open, 
    onClose, 
    onPrint, 
    title = 'Choose Data to Populate', 
    availableCols = [], 
    defaultSelected = [] 
  } = props

  const [settings, setSettings] = useState<Record<string, { include: boolean, populate: boolean }>>(() => {
    const initial: Record<string, { include: boolean, populate: boolean }> = {}
    availableCols.forEach(col => {
      initial[col.id] = { 
        include: !!(col.required || defaultSelected.includes(col.id)), 
        populate: (col.id === 'won_month' || col.id === 'won_amount') ? false : true 
      }
    })
    return initial
  })

  const toggleInclude = (id: string) => {
    if (availableCols.find(c => c.id === id)?.required) return
    setSettings(prev => ({
      ...prev,
      [id]: { ...prev[id], include: !prev[id].include }
    }))
  }

  const togglePopulate = (id: string) => {
    setSettings(prev => ({
      ...prev,
      [id]: { ...prev[id], populate: !prev[id].populate }
    }))
  }

  const selectAll = () => {
    const next = { ...settings }
    Object.keys(next).forEach(k => {
      next[k] = { include: true, populate: true }
    })
    setSettings(next)
  }

  const selectNone = () => {
    const next = { ...settings }
    Object.keys(next).forEach(k => {
      if (!availableCols.find(c => c.id === k)?.required) {
        next[k] = { include: false, populate: false }
      }
    })
    setSettings(next)
  }

  const handlePrint = () => {
    onPrint(settings)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-12 bg-slate-100/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-200 p-3 px-5">
             <div className="col-span-6 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Field Name</div>
             <div className="col-span-3 text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Include</div>
             <div className="col-span-3 text-center text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Populate</div>
          </div>
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
            {['identity', 'auction', 'financial'].map(cat => {
              const catCols = availableCols.filter(c => (c.category || 'financial') === cat)
              if (catCols.length === 0) return null
              
              return (
                <div key={cat} className="contents">
                  <div className="col-span-12 bg-slate-50/50 px-5 py-1.5 border-y border-slate-100">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">{cat}</p>
                  </div>
                  {catCols.map(col => {
                    const s = settings[col.id] || { include: false, populate: false }
                    const isRequired = col.required
                    const isPopLocked = col.id !== 'won_month' && col.id !== 'won_amount'
                    
                    return (
                      <div key={col.id} className={`grid grid-cols-12 px-5 py-2.5 items-center transition-colors ${s.include ? 'bg-white' : 'bg-slate-50/30'}`}>
                        <div className="col-span-6">
                          <p className={`text-[11px] font-bold ${s.include ? 'text-slate-900' : 'text-slate-400'}`}>{col.label}</p>
                        </div>
                        <div className="col-span-3 flex justify-center">
                          <button 
                            onClick={() => toggleInclude(col.id)}
                            disabled={isRequired}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              s.include 
                                ? 'bg-blue-600 border-blue-600 text-white shadow-sm' 
                                : 'bg-white border-slate-200'
                            } ${isRequired ? 'cursor-not-allowed ring-1 ring-blue-100' : 'hover:border-blue-400'}`}
                          >
                            {s.include && <CheckCircle2 size={12} />}
                          </button>
                        </div>
                        <div className="col-span-3 flex justify-center">
                          <button 
                            onClick={() => togglePopulate(col.id)}
                            disabled={!s.include || isPopLocked}
                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                              s.populate 
                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                                : 'bg-white border-slate-200'
                            } ${!s.include ? 'opacity-20 cursor-not-allowed' : (isPopLocked ? 'cursor-not-allowed ring-1 ring-emerald-100' : 'hover:border-emerald-400')}`}
                          >
                            {s.populate && <CheckCircle2 size={12} />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500 text-white">
            <ListFilter size={14} />
          </div>
          <div>
            <h4 className="text-[11px] font-black uppercase text-amber-800">Print Tip</h4>
            <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
              To print a <strong>Blank Auction Sheet</strong>, deselect "Won Month", "Won Amount", and "Won Date". This gives you clean space to fill details manually during the auction.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" icon={Printer} onClick={handlePrint} className="px-8">
            Generate Print
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
