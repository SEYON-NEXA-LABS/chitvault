'use server';

import fs from 'fs';
import path from 'path';
import { createClient } from '@/lib/supabase/server';

export interface TableAudit {
  name: string;
  expectedColumns: string[];
  actualColumns: string[];
  missingColumns: string[];
  extraColumns: string[];
  isAligned: boolean;
}

export interface DeepIntegrityReport {
  tables: TableAudit[];
  rlsStatus: { tableName: string; enabled: boolean }[];
  functions: { name: string; exists: boolean }[];
  timestamp: string;
  overallHealth: number; // 0 to 100
}

export async function getDeepIntegrityReport(): Promise<DeepIntegrityReport> {
  const supabase = await createClient();
  
  // 1. Parse supabase_schema_saas.sql (Source of Truth)
  const schemaPath = path.join(process.cwd(), 'supabase_schema_saas.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const expectedSchema: Record<string, string[]> = {};

  // Support both "create table" and "create table if not exists"
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\n\s*\);/gi;
  let match;

  while ((match = tableRegex.exec(schemaSql)) !== null) {
    const tableName = match[1];
    const content = match[2];
    
    const columnLines = content.split('\n')
      .map(line => line.trim())
      .filter(line => {
        const upperLine = line.toUpperCase();
        return line && 
               !line.startsWith('--') && 
               !upperLine.startsWith('PRIMARY KEY') && 
               !upperLine.startsWith('UNIQUE') && 
               !upperLine.startsWith('CHECK') && 
               !upperLine.startsWith('CONSTRAINT') &&
               !upperLine.startsWith('FOREIGN KEY');
      });

    const columns = columnLines.map(line => {
      const cleanLine = line.replace(/^\s+/, '').replace(/"/g, '');
      const parts = cleanLine.split(/\s+/);
      return parts[0].replace(/,$/, '');
    }).filter(name => name && !/^[();\s]+$/.test(name) && !['--', 'CONSTRAINT', 'PRIMARY', 'UNIQUE'].includes(name.toUpperCase()));

    expectedSchema[tableName] = columns;
  }

  // 2. Fetch Live Metadata
  const { data: dbColumns, error: colError } = await supabase.rpc('get_schema_metadata');
  const { data: rlsInfo, error: rlsError } = await supabase.rpc('check_db_integrity'); 
  
  if (colError) throw new Error('Failed to fetch DB metadata: ' + colError.message + '. Ensure integrity_rpcs.sql is applied.');
  if (rlsError) throw new Error('Failed to run integrity check: ' + rlsError.message);

  // 3. Compare and Build Report
  const actualSchema: Record<string, string[]> = {};
  (dbColumns || []).forEach((col: any) => {
    if (!actualSchema[col.table_name]) actualSchema[col.table_name] = [];
    actualSchema[col.table_name].push(col.column_name);
  });

  const tableAudits: TableAudit[] = Object.keys(expectedSchema).map(tableName => {
    const expected = expectedSchema[tableName];
    const actual = actualSchema[tableName] || [];
    
    const missing = expected.filter(c => !actual.includes(c));
    const extra = actual.filter(c => !expected.includes(c));
    
    return {
      name: tableName,
      expectedColumns: expected,
      actualColumns: actual,
      missingColumns: missing,
      extraColumns: extra,
      isAligned: missing.length === 0
    };
  });

  // 4. Calculate Overall Health
  const totalItems = tableAudits.length;
  const alignedItems = tableAudits.filter(t => t.isAligned).length;
  const health = totalItems > 0 ? Math.round((alignedItems / totalItems) * 100) : 100;

  return {
    tables: tableAudits,
    rlsStatus: (rlsInfo?.security || []).map((s: any) => ({
      tableName: s.table_name,
      enabled: s.rls_enabled
    })),
    functions: (rlsInfo?.functions || []).map((f: any) => ({
      name: f.function_name,
      exists: f.exists
    })),
    timestamp: new Date().toISOString(),
    overallHealth: health
  };
}
