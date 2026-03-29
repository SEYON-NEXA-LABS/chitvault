import Papa from 'papaparse'

/**
 * Downloads the provided data as a CSV file.
 * @param data - The array of objects to export.
 * @param filename - The base filename (will have a timestamp appended).
 */
export function downloadCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;

  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  
  // Format: YYYYMMDD_HHMMSS
  const now = new Date();
  const format = (v: number) => String(v).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${format(now.getMonth() + 1)}${format(now.getDate())}_${format(now.getHours())}${format(now.getMinutes())}${format(now.getSeconds())}`;
  
  const fullFilename = `${filename}_${timestamp}.csv`;

  // Standard download trigger
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fullFilename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Parses a CSV file into a JSON array.
 * @param file - The file to parse.
 * @returns A promise resolving to the parsed data.
 */
export function parseCSV(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (err) => reject(err)
    });
  });
}
