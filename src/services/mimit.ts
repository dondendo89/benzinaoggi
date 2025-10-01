import { prisma } from "../lib/db";
import { fetchText, fetchCsvText, parseCsv } from "./csv";

const ANAGRAFICA_URL = "https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv";
const PREZZI_URL = "https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv";

type AnagraficaRow = {
  'idImpianto': string;
  'Gestore': string;
  'Bandiera': string;
  'Comune': string;
  'Provincia': string;
  'Indirizzo': string;
  'Latitudine': string;
  'Longitudine': string;
};

type PrezzoRow = {
  'idImpianto': string;
  'descCarburante': string;
  'prezzo': string; // es. 1,999
  'isSelf': string; // 1/0
  'dtComu': string; // 2024-01-01 08:00:00
};

function normalizeNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.includes(",") && !trimmed.includes(".")) {
    // European comma decimal
    const v = trimmed.replace(".", "").replace(",", ".");
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  // Standard dot decimal
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function normalizeBoolean01(value: string | null | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export async function updateAnagrafica(): Promise<{ updated: number; total: number; skippedNoId: number }>
{
  const raw = await fetchCsvText(ANAGRAFICA_URL);
  // Normalizza newline e riparti dalla riga header che contiene idImpianto
  const norm = raw.replace(/\r\n?/g, "\n");
  const lines = norm.split("\n");
  const headerIndex = lines.findIndex((l) => l.toLowerCase().includes('idimpianto'));
  const text = headerIndex >= 0 ? lines.slice(headerIndex).join('\n') : norm;
  const header = (headerIndex >= 0 ? lines[headerIndex] : lines[0]) || '';
  const delimiter = ';'; // confermato dal debug
  let rows = await parseCsv<AnagraficaRow>(text, {
    delimiter,
    columns: true,
    bom: true,
    recordDelimiter: 'auto',
    relaxQuotes: true,
    skipRecordsWithError: true,
    trim: true,
  });
  if (!rows || rows.length === 0) {
    // Fallback manual parsing if csv-parse returned nothing
    const allLines = text.split('\n').filter((l) => l.trim().length > 0);
    const header = (allLines.shift() || '').split(delimiter).map((s) => s.trim());
    const hIdx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const idxId = hIdx('idImpianto');
    const idxGestore = hIdx('Gestore');
    const idxBandiera = hIdx('Bandiera');
    const idxComune = hIdx('Comune');
    const idxProvincia = hIdx('Provincia');
    const idxIndirizzo = hIdx('Indirizzo');
    const idxLat = hIdx('Latitudine');
    const idxLon = hIdx('Longitudine');
    rows = allLines.map((line) => {
      const parts = line.split(delimiter);
      return {
        idImpianto: parts[idxId] || '',
        Gestore: parts[idxGestore] || '',
        Bandiera: parts[idxBandiera] || '',
        Comune: parts[idxComune] || '',
        Provincia: parts[idxProvincia] || '',
        Indirizzo: parts[idxIndirizzo] || '',
        Latitudine: parts[idxLat] || '',
        Longitudine: parts[idxLon] || '',
      } as AnagraficaRow;
    }).filter((r) => (r.idImpianto || '').trim().length > 0);
  }

  let updated = 0;
  let skippedNoId = 0;
  const get = (obj: Record<string, any>, keys: string[]): string | undefined => {
    for (const k of keys) {
      const hit = Object.keys(obj).find((kk) => kk.toLowerCase() === k.toLowerCase());
      if (hit) return (obj as any)[hit];
    }
    return undefined;
  };
  for (const r of rows) {
    const idStr = get(r as any, ['idImpianto', 'idimpianto', 'IDImpianto']);
    const impiantoId = Number(idStr);
    if (!Number.isFinite(impiantoId)) { skippedNoId += 1; continue; }
    const lat = normalizeNumber(get(r as any, ['Latitudine', 'Latitudine (WGS84)', 'latitudine']));
    const lon = normalizeNumber(get(r as any, ['Longitudine', 'Longitudine (WGS84)', 'longitudine']));
    const gestore = get(r as any, ['Gestore']) || null;
    const bandiera = get(r as any, ['Bandiera']) || null;
    const comune = get(r as any, ['Comune']) || null;
    const provincia = get(r as any, ['Provincia']) || null;
    const indirizzo = get(r as any, ['Indirizzo']) || null;
    await prisma.distributor.upsert({
      where: { impiantoId },
      create: {
        impiantoId,
        gestore,
        bandiera,
        comune,
        provincia,
        indirizzo,
        latitudine: lat ?? null,
        longitudine: lon ?? null,
      },
      update: {
        gestore,
        bandiera,
        comune,
        provincia,
        indirizzo,
        latitudine: lat ?? null,
        longitudine: lon ?? null,
      },
    });
    updated += 1;
  }

  return { updated, total: rows.length, skippedNoId };
}

export async function updatePrezzi(debug: boolean = false): Promise<{ inserted: number; updated: number; day: string; total?: number; skippedUnknownDistributor?: number; skippedNoPrice?: number; skippedBadDate?: number; sampleRow?: any }>
{
  const raw = await fetchCsvText(PREZZI_URL);
  const norm = raw.replace(/\r\n?/g, "\n");
  const lines = norm.split("\n");
  const headerIndex = lines.findIndex((l) => l.toLowerCase().includes('idimpianto'));
  const text = headerIndex >= 0 ? lines.slice(headerIndex).join('\n') : norm;
  const header = (headerIndex >= 0 ? lines[headerIndex] : lines[0]) || '';
  const delimiter = header.includes('\t') ? '\t' : (header.includes(';') ? ';' : ';');
  let rows = await parseCsv<PrezzoRow>(text, { delimiter, columns: true, bom: true, skipRecordsWithError: true, recordDelimiter: 'auto', relaxQuotes: true, trim: true });
  if (!rows || rows.length === 0) {
    // Fallback manual parse
    const allLines = text.split('\n').filter((l) => l.trim().length > 0);
    const header = (allLines.shift() || '').split(delimiter).map((s) => s.trim());
    const hIdx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
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

  let inserted = 0;
  let updated = 0;
  let skippedUnknownDistributor = 0;
  let skippedNoPrice = 0;
  let skippedBadDate = 0;
  // Determine the "day" from dtComu; normalize to YYYY-MM-DD
  const parseItalianDateTime = (s: string): Date => {
    // Expected format: DD/MM/YYYY HH:mm:ss
    const [datePart, timePart = "00:00:00"] = s.trim().split(/\s+/);
    const [dd, mm, yyyy] = datePart.split("/").map((v) => parseInt(v, 10));
    const [HH, MM, SS] = timePart.split(":").map((v) => parseInt(v, 10));
    // Use UTC to avoid TZ shifting of the day
    const d = new Date(Date.UTC(yyyy, (mm || 1) - 1, dd || 1, HH || 0, MM || 0, SS || 0));
    return d;
  };
  const getDay = (s: string) => parseItalianDateTime(s).toISOString().slice(0, 10);
  const today = rows[0] && (rows[0] as any).dtComu ? getDay((rows[0] as any).dtComu as string) : new Date().toISOString().slice(0, 10);
  const dayDate = new Date(`${today}T00:00:00.000Z`);

  // Non usiamo più Price per il confronto giorno-1; ci basiamo su CurrentPrice e PriceVariation
  const prevDay: Date | null = null;

  const get = (obj: Record<string, any>, keys: string[]): string | undefined => {
    for (const k of keys) {
      const hit = Object.keys(obj).find((kk) => kk.toLowerCase() === k.toLowerCase());
      if (hit) return (obj as any)[hit];
    }
    return undefined;
  };

  // Preload distributor id map to avoid per-row queries
  const allDistributors = await prisma.distributor.findMany({ select: { id: true, impiantoId: true } });
  const distributorIdByImpianto = new Map<number, number>();
  for (const d of allDistributors) distributorIdByImpianto.set(d.impiantoId, d.id);

  // Key helper
  const key = (p: { distributorId: number; fuelType: string; isSelfService: boolean }) => `${p.distributorId}|${p.fuelType}|${p.isSelfService ? 1 : 0}`;
  // Non esiste più un set "existing for day" in Price
  const existingByKey = new Map<string, { id: number; price: number }>();

  // Non calcoliamo più da Price; useremo CurrentPrice per confronto
  const prevByKey = new Map<string, { price: number }>();

  // Preload current prices (single-row per key) to detect variations regardless of day
  const currentByKey = new Map<string, { price: number }>();
  try {
    const cps = await (prisma as any).currentPrice.findMany?.();
    if (Array.isArray(cps)) {
      for (const cp of cps) {
        const k = key({ distributorId: cp.distributorId, fuelType: cp.fuelType, isSelfService: cp.isSelfService });
        currentByKey.set(k, { price: cp.price });
      }
    }
  } catch (_) {
    // table might not exist yet during first deploy
  }

  type UpsertItem = {
    distributorId: number;
    fuelType: string;
    isSelf: boolean;
    price: number;
    communicatedAt: Date;
  };
  const items: UpsertItem[] = [];
  type VariationItem = {
    distributorId: number;
    fuelType: string;
    isSelfService: boolean;
    oldPrice: number;
    newPrice: number;
    direction: 'up' | 'down';
    delta: number;
    percentage: number;
    day: Date;
  };
  const variations: VariationItem[] = [];

  for (const r of rows) {
    const idStr = get(r as any, ['idImpianto', 'idimpianto']);
    const impiantoId = Number(idStr);
    if (!Number.isFinite(impiantoId)) { skippedUnknownDistributor += 1; continue; }
    let distributorId = distributorIdByImpianto.get(impiantoId);
    if (!distributorId) {
      // Create placeholder distributor if missing so prices are never dropped
      const created = await prisma.distributor.create({
        data: { impiantoId },
      });
      distributorId = created.id;
      distributorIdByImpianto.set(impiantoId, distributorId);
    }

    const prezzoStr = get(r as any, ['prezzo']);
    const price = normalizeNumber(prezzoStr);
    if (price == null) { skippedNoPrice += 1; continue; }
    const isSelf = normalizeBoolean01(get(r as any, ['isSelf', 'isSelfService', 'self']));
    const dtComu = get(r as any, ['dtComu', 'dtcomu']);
    if (!dtComu) { skippedBadDate += 1; continue; }
    const communicatedAt = parseItalianDateTime(dtComu);
    const desc = get(r as any, ['descCarburante', 'desccarburante', 'carburante']);
    if (!desc) continue;
    const fuelType = String(desc).trim();

    const k = key({ distributorId, fuelType, isSelfService: isSelf });
    const prevToday = existingByKey.get(k);
    const isInsert = !prevToday;
    if (isInsert) {
      inserted += 1;
      existingByKey.set(k, { id: 0, price });
    } else if (prevToday && prevToday.price !== price) {
      updated += 1;
      existingByKey.set(k, { id: prevToday.id, price });
    } else {
      // no change; skip from bulk write
      continue;
    }
    items.push({ distributorId, fuelType, isSelf, price, communicatedAt });

    // Variation detection: prefer previous day; else fallback to CurrentPrice
    const cp = currentByKey.get(k);
    if (cp && cp.price !== price) {
      const delta = price - cp.price;
      const direction = delta > 0 ? 'up' : 'down';
      const percentage = cp.price !== 0 ? (delta / cp.price) * 100 : 0;
      variations.push({
        distributorId,
        fuelType,
        isSelfService: isSelf,
        oldPrice: cp.price,
        newPrice: price,
        direction,
        delta,
        percentage,
        day: dayDate
      });
    }
  }

  // Non scriviamo più nella tabella Price

  const total = rows.length;
  const sampleRow = debug ? rows[0] : undefined;
  // Scrivi variazioni in bulk se presenti
  if (variations.length > 0) {
    await (prisma as any).priceVariation.createMany({
      data: variations.map(v => ({
        distributorId: v.distributorId,
        fuelType: v.fuelType,
        isSelfService: v.isSelfService,
        oldPrice: v.oldPrice,
        newPrice: v.newPrice,
        direction: v.direction,
        delta: v.delta,
        percentage: v.percentage,
        day: v.day,
      }))
    });

    // INVIO IMMEDIATO NOTIFICHE: notifica SOLO i ribassi (down) appena rilevati
    try {
      const appId = process.env.ONESIGNAL_APP_ID;
      const apiKey = process.env.ONESIGNAL_API_KEY;
      if (appId && apiKey) {
        // Filtra solo le variazioni al ribasso
        const downs = variations.filter(v => v.direction === 'down');
        if (downs.length === 0) {
          // niente ribassi: non inviare nulla
          return { inserted, updated, day: today, total, skippedUnknownDistributor, skippedNoPrice, skippedBadDate, sampleRow };
        }

        // Raggruppa per (distributorId, fuelType)
        const byKey = new Map<string, VariationItem[]>();
        const keyOf = (v: VariationItem) => `${v.distributorId}|${v.fuelType}`;
        for (const v of downs) {
          const k = keyOf(v);
          if (!byKey.has(k)) byKey.set(k, []);
          byKey.get(k)!.push(v);
        }

        // Precarica mapping distributorId -> impiantoId e dati descrittivi
        const distributorIds = Array.from(new Set(downs.map(v => v.distributorId)));
        const distributors = await prisma.distributor.findMany({
          where: { id: { in: distributorIds } },
          select: { id: true, impiantoId: true, gestore: true, bandiera: true, comune: true }
        });
        const byDistributorId = new Map(distributors.map(d => [d.id, d] as const));

        for (const [k, items] of byKey.entries()) {
          const sample = items[0]!;
          const d = byDistributorId.get(sample.distributorId);
          if (!d) continue;
          const impiantoId = d.impiantoId;

          // Recupera iscritti per impiantoId e fuelType
          const subs = await prisma.subscription.findMany({
            where: { impiantoId, fuelType: sample.fuelType },
            select: { externalId: true }
          });
          const externalIds = subs.map(s => s.externalId).filter(Boolean);
          if (externalIds.length === 0) continue;

          // Scegli variazione con delta massimo assoluto per il messaggio
          const best = items.reduce((a, b) => {
            const da = Math.abs(a.newPrice - a.oldPrice);
            const db = Math.abs(b.newPrice - b.oldPrice);
            return db > da ? b : a;
          });

          const directionSymbol = best.direction === 'down' ? '⬇️' : '⬆️';
          const title = `Prezzo ${best.fuelType} ${directionSymbol}`;
          const name = d.gestore || d.bandiera || d.comune || `Impianto ${impiantoId}`;
          const deltaAbs = Math.abs(best.newPrice - best.oldPrice).toFixed(3);
          const body = `${name}: ${best.oldPrice.toFixed(3)} → ${best.newPrice.toFixed(3)} (Δ ${deltaAbs})`;

          // OneSignal API
          await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Basic ${apiKey}`,
            },
            body: JSON.stringify({
              app_id: appId,
              include_external_user_ids: externalIds,
              headings: { it: title, en: title },
              contents: { it: body, en: body },
              data: {
                impiantoId,
                distributorId: sample.distributorId,
                fuelType: sample.fuelType,
                oldPrice: best.oldPrice,
                newPrice: best.newPrice,
                direction: best.direction,
                day: today,
              },
            })
          });
        }
      }
    } catch (_) {
      // Evita di interrompere il job in caso di errore notifica
    }
  }

  // Upsert CurrentPrice for all processed items
  if (items.length > 0) {
    for (const it of items) {
      try {
        await (prisma as any).currentPrice.upsert({
          where: { distributorId_fuelType_isSelfService: { distributorId: it.distributorId, fuelType: it.fuelType, isSelfService: it.isSelf } },
          update: { price: it.price, communicatedAt: it.communicatedAt },
          create: { distributorId: it.distributorId, fuelType: it.fuelType, isSelfService: it.isSelf, price: it.price, communicatedAt: it.communicatedAt },
        });
      } catch (_) {
        // ignore if table missing
      }
    }
  }

  return { inserted, updated, day: today, total, skippedUnknownDistributor, skippedNoPrice, skippedBadDate, sampleRow };
}

export async function checkVariation(options?: { impiantoId?: number; fuelType?: string; onlyDown?: boolean; verbose?: boolean }) {
  // Find last two distinct days present in Price
  const lastTwoDays = await prisma.price.findMany({
    select: { day: true },
    orderBy: { day: "desc" },
    distinct: ["day"],
    take: 2,
  });
  if (lastTwoDays.length < 2) {
    return { variations: [], note: 'Need at least 2 distinct days in Price' };
  }
  let [today, yesterday] = [lastTwoDays[0].day, lastTwoDays[1].day];

  // IMPROVEMENT: If we have very few prices for comparison, try to find more historical data
  const todayCount = await prisma.price.count({ where: { day: today } });
  const yesterdayCount = await prisma.price.count({ where: { day: yesterday } });
  
  // If we have very few prices for comparison, try to find a better comparison day
  if (todayCount < 10 || yesterdayCount < 10) {
    console.log(`Low price counts: today=${todayCount}, yesterday=${yesterdayCount}. Looking for better comparison...`);
    
    // Try to find a day with more prices for comparison
    const betterYesterday = await prisma.price.findFirst({
      where: {
        day: { lt: today },
        // Find a day that has at least some overlap with today's distributors
      },
      select: { day: true },
      orderBy: { day: 'desc' }
    });
    
    if (betterYesterday && betterYesterday.day !== yesterday) {
      console.log(`Using better comparison day: ${betterYesterday.day} instead of ${yesterday}`);
      yesterday = betterYesterday.day;
    }
  }

  // Debug: Log the days being compared
  console.log(`Checking variations between ${yesterday} and ${today}`);

  const baseTodayWhere: any = { day: today };
  const baseYesterdayWhere: any = { day: yesterday };
  if (options?.fuelType) {
    baseTodayWhere.fuelType = options.fuelType;
    baseYesterdayWhere.fuelType = options.fuelType;
  }

  // If filtering by impiantoId, we need to map to distributorId(s)
  let distributorIdsFilter: number[] | undefined;
  if (options?.impiantoId != null) {
    const d = await prisma.distributor.findUnique({ where: { impiantoId: options.impiantoId } });
    if (d) distributorIdsFilter = [d.id];
    else return { day: today, previousDay: yesterday, variations: [], note: `No distributor for impiantoId ${options.impiantoId}` };
  }

  if (distributorIdsFilter) {
    baseTodayWhere.distributorId = { in: distributorIdsFilter };
    baseYesterdayWhere.distributorId = { in: distributorIdsFilter };
  }

  const [todayPrices, yesterdayPrices] = await Promise.all([
    prisma.price.findMany({ where: baseTodayWhere }),
    prisma.price.findMany({ where: baseYesterdayWhere }),
  ]);

  // Debug: Log counts
  console.log(`Found ${todayPrices.length} prices for today (${today}) and ${yesterdayPrices.length} for yesterday (${yesterday})`);

  const key = (p: { distributorId: number; fuelType: string; isSelfService: boolean }) =>
    `${p.distributorId}|${p.fuelType}|${p.isSelfService ? 1 : 0}`;

  const mapYesterday = new Map<string, typeof yesterdayPrices[number]>();
  for (const p of yesterdayPrices) mapYesterday.set(key(p), p);

  // Debug: Log unique keys
  const todayKeys = new Set(todayPrices.map(p => key(p)));
  const yesterdayKeys = new Set(yesterdayPrices.map(p => key(p)));
  console.log(`Today has ${todayKeys.size} unique price combinations, yesterday has ${yesterdayKeys.size}`);

  type Variation = {
    distributorId: number;
    impiantoId: number;
    fuelType: string;
    isSelfService: boolean;
    oldPrice: number;
    newPrice: number;
    direction: "up" | "down";
  };

  const variations: Variation[] = [];
  let processedCount = 0;
  let skippedNoYesterday = 0;
  let skippedNoDistributor = 0;
  let noChangeCount = 0;

  for (const p of todayPrices) {
    processedCount++;
    const y = mapYesterday.get(key(p));
    if (!y) {
      skippedNoYesterday++;
      continue;
    }
    if (p.price !== y.price) {
      const distributor = await prisma.distributor.findUnique({ where: { id: p.distributorId } });
      if (!distributor) {
        skippedNoDistributor++;
        continue;
      }
      const v: Variation = {
        distributorId: p.distributorId,
        impiantoId: distributor.impiantoId,
        fuelType: p.fuelType,
        isSelfService: p.isSelfService,
        oldPrice: y.price,
        newPrice: p.price,
        direction: p.price > y.price ? "up" : "down",
      };
      variations.push(v);
    } else {
      noChangeCount++;
    }
  }

  // Debug: Log processing stats
  console.log(`Processed ${processedCount} today prices: ${variations.length} variations, ${noChangeCount} no change, ${skippedNoYesterday} no yesterday data, ${skippedNoDistributor} no distributor`);

  // IMPROVEMENT: If we have very few variations due to missing historical data, 
  // suggest using MISE API for better detection
  if (variations.length === 0 && skippedNoYesterday > processedCount * 0.5) {
    console.log(`WARNING: ${skippedNoYesterday} prices skipped due to missing historical data. Consider using MISE API for real-time comparison.`);
  }

  const filtered = options?.onlyDown ? variations.filter(v => v.direction === 'down') : variations;

  if (options?.verbose) {
    return {
      day: today,
      previousDay: yesterday,
      counts: { 
        today: todayPrices.length, 
        yesterday: yesterdayPrices.length, 
        variations: variations.length, 
        filtered: filtered.length,
        processed: processedCount,
        skippedNoYesterday,
        skippedNoDistributor,
        noChange: noChangeCount
      },
      filters: { impiantoId: options?.impiantoId, fuelType: options?.fuelType, onlyDown: options?.onlyDown },
      variations: filtered,
    };
  }

  return { day: today, previousDay: yesterday, variations: filtered };
}



