import { parse } from "csv-parse";

export async function fetchText(url: string, encoding: BufferEncoding | 'latin1' | 'utf-8' = 'utf-8'): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // Use TextDecoder to support latin1 if needed
  try {
    const dec = new TextDecoder(encoding);
    return dec.decode(buf);
  } catch {
    // Fallback to UTF-8
    const dec = new TextDecoder('utf-8');
    return dec.decode(buf);
  }
}

export async function fetchCsvText(url: string): Promise<string> {
  // Try UTF-8 first
  let text = await fetchText(url, 'utf-8');
  // If header marker not found, try latin1
  const hasHeader = /idimpianto/i.test(text);
  if (!hasHeader) {
    try {
      const alt = await fetchText(url, 'latin1');
      if (/idimpianto/i.test(alt)) return alt;
    } catch {}
  }
  return text;
}

export async function parseCsv<T = Record<string, string | number | null>>(
  csvContent: string,
  options: {
    delimiter?: string;
    columns?: boolean | string[];
    fromLine?: number;
    skipEmptyLines?: boolean;
    relaxColumnCount?: boolean;
    trim?: boolean;
    cast?: (value: string, context: any) => any;
    relaxQuotes?: boolean;
    skipRecordsWithError?: boolean;
    bom?: boolean;
    recordDelimiter?: string | string[] | 'auto';
  } = {}
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const records: T[] = [];
    const parser = parse({
      delimiter: options.delimiter ?? ";",
      columns: options.columns === true
        ? (header: string[]) => header.map((h) => (typeof h === 'string' ? h.trim() : h))
        : (options.columns ?? true),
      from_line: options.fromLine ?? 1,
      skip_empty_lines: options.skipEmptyLines ?? true,
      relax_column_count: options.relaxColumnCount ?? true,
      trim: options.trim ?? true,
      cast: options.cast,
      relax_quotes: options.relaxQuotes ?? true,
      skip_records_with_error: options.skipRecordsWithError ?? true,
      bom: options.bom ?? true,
      record_delimiter: options.recordDelimiter ?? 'auto',
    });
    parser.on("readable", () => {
      let record;
      // eslint-disable-next-line no-cond-assign
      while ((record = parser.read()) !== null) {
        records.push(record as T);
      }
    });
    parser.on("error", (err) => reject(err));
    parser.on("end", () => resolve(records));
    parser.write(csvContent);
    parser.end();
  });
}


