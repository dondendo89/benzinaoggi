import { NextRequest, NextResponse } from "next/server";
import { updateAnagrafica } from "@/src/services/mimit";
import { fetchCsvText } from "@/src/services/csv";
import { headers } from "next/headers";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get('debug');
    if (debug) {
      const raw = await fetchCsvText("https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv");
      const norm = raw.replace(/\r\n?/g, "\n");
      const lines = norm.split("\n");
      const headerIndex = lines.findIndex((l) => l.toLowerCase().includes('idimpianto'));
      const headerLine = headerIndex >= 0 ? lines[headerIndex] : lines[0] || '';
      const nextLine = headerIndex >= 0 ? (lines[headerIndex + 1] || '') : (lines[1] || '');
      const delimiter = headerLine.includes('\t') ? '\t' : (headerLine.includes(';') ? ';' : 'unknown');
      return NextResponse.json({ ok: true, debug: { headerIndex, headerLine, nextLine, delimiter, sample: norm.slice(0, 256) } });
    }
    const result = await updateAnagrafica();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


