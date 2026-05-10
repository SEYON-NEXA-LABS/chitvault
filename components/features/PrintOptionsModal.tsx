'use client'

import React, { useState } from 'react'
import { Modal, Btn, Badge } from '@/components/ui'
import { CheckCircle2, Circle, Printer, ListFilter, Trash2 } from 'lucide-react'

interface ColumnOption {
  id: string
  label: string
  category?: 'identity' | 'auction' | 'financial'
  required?: boolean
}

interface PrintOptionsModalProps {
  open: boolean
  onClose: () => void
  onPrint: (populateCols: string[]) => void
  availableCols: ColumnOption[]
  defaultSelected?: string[]
  title?: string
}

export const PrintOptionsModal: React.FC<PrintOptionsModalProps> = ({
  open,
  onClose,
  onPrint,
  title = 'Choose Data to Populate',
  availableCols,
  defaultSelected = []
}) => {
  const [selected, setSelected] = useState<string[]>(defaultSelected)
  const [populate, setPopulate] = useState(true)

  const toggle = (id: string) => {
    if (availableCols.find(c => c.id === id)?.required) return
    setSelected(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAll = () => setSelected(availableCols.map(c => c.id))
  const selectNone = () => setSelected([])

  const handlePrint = () => {
    onPrint(selected)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-6">
        <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Instructions</p>
          <p className="text-xs font-bold text-slate-600 leading-relaxed">
            All columns will be included for a consistent layout. Choose which data fields should be <span className="text-blue-600">pre-filled</span>. Unchecked fields will remain blank for manual entry.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider opacity-40">Columns to Populate</h3>
            <p className="text-[10px] text-slate-500 font-medium">Selected columns will be pre-filled with data.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] font-black uppercase text-blue-600 hover:underline">All</button>
            <span className="opacity-20">|</span>
            <button onClick={selectNone} className="text-[10px] font-black uppercase text-slate-400 hover:underline">None</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {availableCols.map(col => {
            const isSelected = selected.includes(col.id)
            return (
              <button
                key={col.id}
                onClick={() => toggle(col.id)}
                disabled={col.required}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                  isSelected 
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm' 
                    : 'border-slate-100 bg-white opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:border-slate-200'
                } ${col.required ? 'cursor-not-allowed border-slate-200 bg-slate-50' : ''}`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-black uppercase tracking-tight ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                      {col.label}
                    </span>
                    {col.required && <Badge variant="gray" className="text-[8px] py-0 px-1 font-black">Mandatory</Badge>}
                  </div>
                  {col.category && (
                    <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{col.category}</span>
                  )}
                </div>
                {isSelected ? (
                  <CheckCircle2 size={18} className={col.required ? 'text-slate-400' : 'text-blue-600'} />
                ) : (
                  <Circle size={18} className="text-slate-200" />
                )}
              </button>
            )
          })}
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
