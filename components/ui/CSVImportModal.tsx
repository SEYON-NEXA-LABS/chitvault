'use client'

import { useState } from 'react'
import { Modal, Btn, Table, Th, Td, Tr } from './index'
import { parseCSV } from '@/lib/utils/csv'
import { Upload, X, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'

interface CSVImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (data: any[]) => Promise<void>;
  title: string;
  requiredFields: string[];
}

export function CSVImportModal({ open, onClose, onImport, title, requiredFields }: CSVImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    try {
      const parsed = await parseCSV(f)
      validateData(parsed)
      setData(parsed)
    } catch (err: any) {
      setErrors(['Failed to parse CSV file. Ensure it is a valid .csv file.'])
    }
  }

  const validateData = (rows: any[]) => {
    const errs: string[] = []
    if (rows.length === 0) errs.push('CSV file is empty.')
    
    rows.forEach((row, idx) => {
      requiredFields.forEach(field => {
        // Case insensitive Check
        const actualKey = Object.keys(row).find(k => k.toLowerCase() === field.toLowerCase())
        if (!actualKey || !row[actualKey]) {
          errs.push(`Row ${idx + 1}: Missing required field "${field}"`)
        }
      })
    })
    setErrors(errs)
  }

  const handleConfirm = async () => {
    setLoading(true)
    await onImport(data)
    setLoading(false)
    onClose()
    setFile(null)
    setData([])
    setErrors([])
  }

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      {!file ? (
        <div className="relative flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-2xl transition-colors hover:bg-black/5" 
          style={{ borderColor: 'var(--border)', background: 'var(--surface2)' }}>
          <Upload size={48} className="opacity-20 mb-4" />
          <p className="text-sm font-medium mb-4" style={{ color: 'var(--text2)' }}>Click to upload or drag and drop CSV</p>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleFileChange} 
            className="absolute inset-0 opacity-0 cursor-pointer" 
          />
          <Btn variant="primary">Select File</Btn>
          <p className="text-xs mt-4 opacity-50">Required columns: {requiredFields.join(', ')}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-[var(--surface2)] p-4 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent-border)]">
                   <Upload size={20} />
                </div>
                <div>
                   <div className="text-sm font-bold">{file.name}</div>
                   <div className="text-xs opacity-50">{(file.size / 1024).toFixed(1)} KB · {data.length} rows detected</div>
                </div>
             </div>
             <button onClick={() => { setFile(null); setData([]); setErrors([]) }} 
               className="p-2 hover:bg-black/10 rounded-full transition-colors">
                <X size={16} />
             </button>
          </div>

          <div className="p-4 rounded-xl flex gap-3" style={{ background: 'var(--danger-dim)', border: '1px solid rgba(246,109,122,0.2)', color: 'var(--danger)' }}>
             <AlertTriangle className="shrink-0" size={20} />
             <div>
                <div className="font-bold text-sm">Warning: Critical Data Update</div>
                <p className="text-xs opacity-80 mt-1">
                   Importing this data is a permanent action. If a <strong>Name + Phone</strong> match is found, the existing record will be <strong>overwritten</strong> with the CSV data.
                </p>
             </div>
          </div>

          {errors.length > 0 && (
            <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-500 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1 mb-1"><AlertCircle size={14}/> Validation Errors ({errors.length})</div>
              <ul className="list-disc list-inside max-h-32 overflow-y-auto">
                {errors.slice(0, 10).map((err, i) => <li key={i}>{err}</li>)}
                {errors.length > 10 && <li>...and {errors.length - 10} more errors.</li>}
              </ul>
            </div>
          )}

          {errors.length === 0 && (
            <div className="p-4 rounded-xl bg-success-500/10 border border-success-500/20 text-success-500 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} /> All {data.length} rows are valid and ready to import!
            </div>
          )}

          <div className="max-h-60 overflow-auto border rounded-xl" style={{ borderColor: 'var(--border)' }}>
             <Table>
                <thead>
                   <tr>
                      {requiredFields.map(f => <Th key={f}>{f}</Th>)}
                   </tr>
                </thead>
                <tbody>
                   {data.slice(0, 5).map((row, i) => (
                      <Tr key={i}>
                         {requiredFields.map(f => {
                           const actualKey = Object.keys(row).find(k => k.toLowerCase() === f.toLowerCase())
                           const val = actualKey ? row[actualKey] : null
                           return (
                             <Td key={f}>{val || <span className="text-danger-500 font-bold italic">Missing</span>}</Td>
                           )
                         })}
                      </Tr>
                   ))}
                   {data.length > 5 && (
                      <Tr><Td colSpan={requiredFields.length} className="text-center opacity-30 italic py-4">Showing first 5 of {data.length} rows...</Td></Tr>
                   )}
                </tbody>
             </Table>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
             <Btn variant="secondary" onClick={() => { setFile(null); setData([]); setErrors([]) }}>Cancel</Btn>
             <Btn variant="primary" loading={loading} disabled={errors.length > 0 || data.length === 0} onClick={handleConfirm}>
                Confirm Import
             </Btn>
          </div>

          <div className="mt-8 pt-6 border-t border-dashed text-center" style={{ borderColor: 'var(--border)' }}>
             <p className="text-[10px] uppercase tracking-widest font-black opacity-30 mb-2">Technical Assistance</p>
             <p className="text-xs" style={{ color: 'var(--text2)' }}>
                Import not working as expected? <br/>
                <a href="mailto:seyonnexalabs@gmail.com" className="text-[var(--accent)] font-bold hover:underline">Contact Superadmin for Support</a>
             </p>
          </div>
        </div>
      )}
    </Modal>
  )
}
