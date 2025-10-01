import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { fetchCsvText, parseCsv } from "@/src/services/csv";
import { getMisePrices, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoId = parseInt(searchParams.get('impiantoId') || '58674');
    const force = searchParams.get('force') === 'true';
    const debug = searchParams.get('debug') === 'true';
    
    // Ottieni distributore
    const distributor = await prisma.distributor.findUnique({
      where: { impiantoId }
    });
    
    if (!distributor) {
      return NextResponse.json({
        ok: false,
        error: `Distributore con impiantoId ${impiantoId} non trovato`
      });
    }
    
    // Tentiamo sempre CSV per primo; MISE verrà usato solo in fallback se CSV è vuoto

    // Leggi CSV MIMIT e filtra per impiantoId
    const PREZZI_URL = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv";
    const raw = await fetchCsvText(PREZZI_URL);
    const norm = raw.replace(/\r\n?/g, "\n");
    const lines = norm.split("\n");
    const headerIndex = lines.findIndex((l) => l.toLowerCase().includes('idimpianto'));
    const text = headerIndex >= 0 ? lines.slice(headerIndex).join('\n') : norm;
    const header = (headerIndex >= 0 ? lines[headerIndex] : lines[0]) || '';
    const delimiter = header.includes('\t') ? '\t' : (header.includes(';') ? ';' : ';');
    type PrezzoRow = { idImpianto: string; descCarburante: string; prezzo: string; isSelf: string; dtComu: string };
    let rows = await parseCsv<PrezzoRow>(text, { delimiter, columns: true, bom: true, skipRecordsWithError: true, recordDelimiter: 'auto', relaxQuotes: true, trim: true });
    if (!rows || rows.length === 0) {
      const allLines = text.split('\n').filter((l) => l.trim().length > 0);
      const hdr = (allLines.shift() || '').split(delimiter).map((s) => s.trim());
      const hIdx = (name: string) => hdr.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      const idxId = hIdx('idImpianto');
      const idxDesc = hIdx('descCarburante') >= 0 ? hIdx('descCarburante') : hIdx('carburante');
      const idxPrezzo = hIdx('prezzo');
      const idxIsSelf = hIdx('isSelf');
      const idxDt = hIdx('dtComu');
      rows = allLines.map((line) => {
        const parts = line.split(delimiter);
        return {
          idImpianto: parts[idxId] || '',
          descCarburante: parts[idxDesc] || '',
          prezzo: parts[idxPrezzo] || '',
          isSelf: parts[idxIsSelf] || '',
          dtComu: parts[idxDt] || '',
        } as PrezzoRow;
      }).filter((r) => (r.idImpianto || '').trim().length > 0 && (r.prezzo || '').trim().length > 0);
    }

    const toNumber = (value: string | null | undefined): number | null => {
      if (!value) return null;
      const trimmed = value.trim();
      if (trimmed.includes(",") && !trimmed.includes(".")) {
        const v = trimmed.replace(".", "").replace(",", ".");
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      }
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    };
    const parseItalianDateTime = (s: string): Date => {
      const [datePart, timePart = "00:00:00"] = s.trim().split(/\s+/);
      const [dd, mm, yyyy] = datePart.split("/").map((v) => parseInt(v, 10));
      const [HH, MM, SS] = timePart.split(":").map((v) => parseInt(v, 10));
      const d = new Date(Date.UTC(yyyy, (mm || 1) - 1, dd || 1, HH || 0, MM || 0, SS || 0));
      return d;
    };

    const filtered = rows.filter(r => Number(String(r.idImpianto).trim()) === impiantoId);
    if (debug) {
      console.log(`[FORCE-UPDATE-DISTRIBUTOR][CSV] Rows for impiantoId=${impiantoId}: ${filtered.length}`);
    }

    if (filtered.length === 0) {
      // Fallback: usa API MISE se il CSV non contiene righe per questo impianto
      if (debug) console.log(`[FORCE-UPDATE-DISTRIBUTOR][FALLBACK] No CSV rows for ${impiantoId}, trying MISE API...`);

      const miseFuels = await getMisePrices(impiantoId);
      if (!miseFuels || miseFuels.length === 0) {
        return NextResponse.json({ ok: false, error: `Nessuna riga nel CSV per impiantoId ${impiantoId} e MISE non ha restituito prezzi`, source: 'fallback_mise_empty' }, { status: 502 });
      }

      let updatedCountFb = 0;
      let createdCountFb = 0;
      const todayStr = new Date().toISOString().slice(0, 10);
      const dayFb = new Date(`${todayStr}T00:00:00.000Z`);

      // Precarica prezzi del giorno precedente per questo distributore per rilevare variazioni
      const prevDayRow = await prisma.price.findFirst({
        where: { distributorId: distributor.id, day: { lt: dayFb } },
        select: { day: true },
        orderBy: { day: 'desc' }
      });
      const prevDay = prevDayRow?.day || null;
      const prevByKey = new Map<string, { price: number }>();
      const key = (p: { fuelType: string; isSelfService: boolean }) => `${p.fuelType}|${p.isSelfService ? 1 : 0}`;
      if (prevDay) {
        const prevPrices = await prisma.price.findMany({ where: { distributorId: distributor.id, day: prevDay } });
        for (const p of prevPrices) prevByKey.set(key(p), { price: p.price });
      }

      const variations: Array<{ distributorId: number; fuelType: string; isSelfService: boolean; oldPrice: number; newPrice: number; direction: 'up'|'down'; delta: number; percentage: number; day: Date }>=[];

      for (const fuel of miseFuels) {
        const fuelType = normalizeFuelName(String(fuel.name || '').trim());
        const isSelf = !!fuel.isSelf;
        const prezzo = Number(fuel.price);
        if (!Number.isFinite(prezzo)) continue;
        const communicatedAt = fuel.validityDate ? new Date(fuel.validityDate) : (fuel.insertDate ? new Date(fuel.insertDate) : new Date());

        const existingLatest = await prisma.price.findFirst({
          where: { distributorId: distributor.id, fuelType, isSelfService: isSelf },
          orderBy: { day: 'desc' }
        });
        const hasChanged = !existingLatest || Math.abs(existingLatest.price - prezzo) > 0.001;
        if (!hasChanged && !force) continue;

        await prisma.price.upsert({
          where: {
            Price_unique_day: {
              distributorId: distributor.id,
              fuelType,
              day: dayFb,
              isSelfService: isSelf
            }
          },
          update: { price: prezzo, communicatedAt },
          create: { distributorId: distributor.id, fuelType, price: prezzo, day: dayFb, isSelfService: isSelf, communicatedAt }
        });

        if (existingLatest) {
          if (Math.abs(existingLatest.price - prezzo) > 0.001) updatedCountFb++;
        } else {
          createdCountFb++;
        }

        // Rileva variazione rispetto al giorno precedente
        const prevEntry = prevByKey.get(key({ fuelType, isSelfService: isSelf } as any));
        if (prevEntry && prevEntry.price !== prezzo) {
          const delta = prezzo - prevEntry.price;
          const direction = delta > 0 ? 'up' : 'down';
          const percentage = prevEntry.price !== 0 ? (delta / prevEntry.price) * 100 : 0;
          variations.push({
            distributorId: distributor.id,
            fuelType,
            isSelfService: isSelf,
            oldPrice: prevEntry.price,
            newPrice: prezzo,
            direction,
            delta,
            percentage,
            day: dayFb
          });
        }
      }

      const lastUpdatedRowFb = await prisma.price.findFirst({
        where: { distributorId: distributor.id, day: dayFb },
        orderBy: { communicatedAt: 'desc' },
        select: { communicatedAt: true }
      });
      const lastUpdatedAtFb = lastUpdatedRowFb?.communicatedAt?.toISOString() || new Date().toISOString();

      // Scrivi variazioni, se presenti
      if (variations.length > 0) {
        await (prisma as any).priceVariation.createMany({ data: variations });
      }

      return NextResponse.json({ ok: true, source: 'mise', updated: updatedCountFb, created: createdCountFb, day: todayStr, lastUpdatedAt: lastUpdatedAtFb });
    }

    // Determina il "day" dalla prima riga valida
    const firstDt = filtered.find(r => (r.dtComu || '').trim().length > 0)?.dtComu || '';
    const dayStr = firstDt ? parseItalianDateTime(firstDt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const day = new Date(`${dayStr}T00:00:00.000Z`);

    let updatedCount = 0;
    let createdCount = 0;

    for (const r of filtered) {
      const prezzo = toNumber(r.prezzo);
      if (prezzo == null) continue;
      const fuelType = String(r.descCarburante || '').trim();
      const isSelf = String(r.isSelf || '').trim() === '1' || String(r.isSelf || '').toLowerCase() === 'true';
      const communicatedAt = (r.dtComu && r.dtComu.trim().length > 0) ? parseItalianDateTime(r.dtComu) : day;

      const existingLatest = await prisma.price.findFirst({
        where: {
          distributorId: distributor.id,
          fuelType,
          isSelfService: isSelf,
        },
        orderBy: { day: 'desc' }
      });
      const hasChanged = !existingLatest || Math.abs(existingLatest.price - prezzo) > 0.001;
      if (!hasChanged && !force) continue;

      await prisma.price.upsert({
        where: {
          Price_unique_day: {
            distributorId: distributor.id,
            fuelType,
            day,
            isSelfService: isSelf
          }
        },
        update: {
          price: prezzo,
          communicatedAt
        },
        create: {
          distributorId: distributor.id,
          fuelType,
          price: prezzo,
          day,
          isSelfService: isSelf,
          communicatedAt
        }
      });

      if (existingLatest) {
        if (Math.abs(existingLatest.price - prezzo) > 0.001) updatedCount++;
      } else {
        createdCount++;
      }
    }

    // Calcola lastUpdatedAt per questo impianto nel giorno impostato
    const lastUpdatedRow = await prisma.price.findFirst({
      where: { distributorId: distributor.id, day },
      orderBy: { communicatedAt: 'desc' },
      select: { communicatedAt: true }
    });
    const lastUpdatedAt = lastUpdatedRow?.communicatedAt?.toISOString() || new Date().toISOString();

    return NextResponse.json({ ok: true, updated: updatedCount, created: createdCount, day: dayStr, lastUpdatedAt });
    
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
