import { prisma } from "../lib/db";
import { fetchText, parseCsv } from "./csv";

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

function normalizeFloatEU(value: string | null | undefined): number | null {
  if (!value) return null;
  const v = value.replace(".", "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeBoolean01(value: string | null | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

export async function updateAnagrafica(): Promise<{ updated: number }>
{
  const text = await fetchText(ANAGRAFICA_URL);
  const rows = await parseCsv<AnagraficaRow>(text, { delimiter: ";", columns: true });

  let updated = 0;
  for (const r of rows) {
    const impiantoId = Number(r.idImpianto);
    if (!Number.isFinite(impiantoId)) continue;
    const lat = normalizeFloatEU(r.Latitudine);
    const lon = normalizeFloatEU(r.Longitudine);
    await prisma.distributor.upsert({
      where: { impiantoId },
      create: {
        impiantoId,
        gestore: r.Gestore || null,
        bandiera: r.Bandiera || null,
        comune: r.Comune || null,
        provincia: r.Provincia || null,
        indirizzo: r.Indirizzo || null,
        latitudine: lat ?? null,
        longitudine: lon ?? null,
      },
      update: {
        gestore: r.Gestore || null,
        bandiera: r.Bandiera || null,
        comune: r.Comune || null,
        provincia: r.Provincia || null,
        indirizzo: r.Indirizzo || null,
        latitudine: lat ?? null,
        longitudine: lon ?? null,
      },
    });
    updated += 1;
  }

  return { updated };
}

export async function updatePrezzi(): Promise<{ inserted: number; day: string }>
{
  const text = await fetchText(PREZZI_URL);
  const rows = await parseCsv<PrezzoRow>(text, { delimiter: ";", columns: true });

  let inserted = 0;
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
  const today = rows[0] ? getDay(rows[0].dtComu) : new Date().toISOString().slice(0, 10);
  const dayDate = new Date(`${today}T00:00:00.000Z`);

  for (const r of rows) {
    const impiantoId = Number(r.idImpianto);
    if (!Number.isFinite(impiantoId)) continue;
    const distributor = await prisma.distributor.findUnique({ where: { impiantoId } });
    if (!distributor) continue; // skip unknown

    const price = normalizeFloatEU(r.prezzo);
    if (price == null) continue;
    const isSelf = normalizeBoolean01(r.isSelf);
    const communicatedAt = parseItalianDateTime(r.dtComu);
    const fuelType = r.descCarburante.trim();

    try {
      await prisma.price.upsert({
        where: {
          distributorId_fuelType_day_isSelfService: {
            distributorId: distributor.id,
            fuelType,
            day: dayDate,
            isSelfService: isSelf,
          },
        },
        create: {
          distributorId: distributor.id,
          fuelType,
          price,
          isSelfService: isSelf,
          communicatedAt,
          day: dayDate,
        },
        update: {
          price,
          communicatedAt,
        },
      });
      inserted += 1;
    } catch (e) {
      // continue on constraint errors
    }
  }

  return { inserted, day: today };
}

export async function checkVariation() {
  // Find last two distinct days present in Price
  const lastTwoDays = await prisma.price.findMany({
    select: { day: true },
    orderBy: { day: "desc" },
    distinct: ["day"],
    take: 2,
  });
  if (lastTwoDays.length < 2) {
    return { variations: [] };
  }
  const [today, yesterday] = [lastTwoDays[0].day, lastTwoDays[1].day];

  const [todayPrices, yesterdayPrices] = await Promise.all([
    prisma.price.findMany({ where: { day: today } }),
    prisma.price.findMany({ where: { day: yesterday } }),
  ]);

  const key = (p: { distributorId: number; fuelType: string; isSelfService: boolean }) =>
    `${p.distributorId}|${p.fuelType}|${p.isSelfService ? 1 : 0}`;

  const mapYesterday = new Map<string, typeof yesterdayPrices[number]>();
  for (const p of yesterdayPrices) mapYesterday.set(key(p), p);

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
  for (const p of todayPrices) {
    const y = mapYesterday.get(key(p));
    if (!y) continue;
    if (p.price !== y.price) {
      const distributor = await prisma.distributor.findUnique({ where: { id: p.distributorId } });
      if (!distributor) continue;
      variations.push({
        distributorId: p.distributorId,
        impiantoId: distributor.impiantoId,
        fuelType: p.fuelType,
        isSelfService: p.isSelfService,
        oldPrice: y.price,
        newPrice: p.price,
        direction: p.price > y.price ? "up" : "down",
      });
    }
  }

  return { day: today, previousDay: yesterday, variations };
}


