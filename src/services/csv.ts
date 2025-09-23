import { parse } from "csv-parse";

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return await res.text();
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
  } = {}
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const records: T[] = [];
    const parser = parse({
      delimiter: options.delimiter ?? ";",
      columns: options.columns ?? true,
      from_line: options.fromLine ?? 1,
      skip_empty_lines: options.skipEmptyLines ?? true,
      relax_column_count: options.relaxColumnCount ?? true,
      trim: options.trim ?? true,
      cast: options.cast,
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


