import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Group an array of items by a key selector
function groupBy<T, K extends string | number>(items: T[], keyFn: (t: T) => K): Record<K, T[]> {
  return items.reduce((acc, it) => {
    const k = keyFn(it);
    (acc as any)[k] = (acc as any)[k] || [];
    (acc as any)[k].push(it);
    return acc;
  }, {} as Record<K, T[]>);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // onlyDown=true per default per evitare spam
    const onlyDown = (searchParams.get('onlyDown') || 'true').toLowerCase() === 'true';
    const dayParam = searchParams.get('day'); // YYYY-MM-DD opzionale
    const latest = (searchParams.get('latest') || 'false').toLowerCase() === 'true';

    // Determina il giorno target:
    // - se passato via query, usa quello
    // - se latest=true, usa il giorno più recente con variazioni in PriceVariation (se disponibile)
    // - altrimenti l'ultimo presente in Price
    let targetDay: Date | null = null;
    if (dayParam) {
      targetDay = new Date(`${dayParam}T00:00:00.000Z`);
    } else {
      if (latest) {
        try {
          const whereDir = onlyDown ? `WHERE "direction"='down'` : '';
          const rows = await prisma.$queryRawUnsafe<any[]>(
            `SELECT MAX("day") AS day FROM "PriceVariation" ${whereDir}`
          );
          const maxDay = rows && rows[0] && rows[0].day ? new Date(rows[0].day as string) : null;
          if (maxDay) {
            targetDay = new Date(`${maxDay.toISOString().slice(0,10)}T00:00:00.000Z`);
          }
        } catch (_) {
          // ignore and fallback below
        }
      }
      // Se non troviamo da PriceVariation, non usare più Price
      // targetDay resterà null se non ci sono variazioni registrate
      // e torneremo "No target day found"
      // (l'update oggi scrive sempre PriceVariation quando varia)
    }
    if (!targetDay) {
      return NextResponse.json({ ok: true, sent: 0, note: 'No target day found' });
    }

    let variations: any[] = [];
    try {
      // Prova a leggere da PriceVariation
      variations = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "distributorId","fuelType","isSelfService","oldPrice","newPrice","direction","delta","percentage","day"
         FROM "PriceVariation"
         WHERE "day" = $1 ${onlyDown ? `AND "direction"='down'` : ''}`,
        targetDay
      );
    } catch (_) {
      // Fallback: calcola variazioni on-the-fly da Price (ultimo giorno vs precedente)
      const today = targetDay;
      const prevRow = await prisma.price.findFirst({
        where: { day: { lt: today! } },
        select: { day: true },
        orderBy: { day: 'desc' }
      });
      const yesterday = prevRow?.day;
      if (!yesterday) {
        return NextResponse.json({ ok: true, sent: 0, day: (today as Date).toISOString().slice(0,10), note: 'No previous day to compare' });
      }
      const [todayPrices, yesterdayPrices] = await Promise.all([
        prisma.price.findMany({ where: { day: today! } }),
        prisma.price.findMany({ where: { day: yesterday } })
      ]);
      const key = (p: any) => `${p.distributorId}|${p.fuelType}|${p.isSelfService ? 1 : 0}`;
      const mapYesterday = new Map<string, any>();
      for (const p of yesterdayPrices) mapYesterday.set(key(p), p);
      const tmp: any[] = [];
      for (const p of todayPrices) {
        const y = mapYesterday.get(key(p));
        if (!y) continue;
        if (p.price !== y.price) {
          const delta = p.price - y.price;
          const direction = delta > 0 ? 'up' : 'down';
          if (onlyDown && direction !== 'down') continue;
          tmp.push({
            distributorId: p.distributorId,
            fuelType: p.fuelType,
            isSelfService: p.isSelfService,
            oldPrice: y.price,
            newPrice: p.price,
            direction,
            delta,
            percentage: y.price !== 0 ? (delta / y.price) * 100 : 0,
            day: today
          });
        }
      }
      variations = tmp;
    }
    if (variations.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, day: targetDay.toISOString().slice(0,10), note: 'No variations for target day' });
    }

    // Mappa distributorId -> impiantoId e nome/descrizione
    const distributorIds = Array.from(new Set((variations as any[]).map((v: any) => v.distributorId)));
    const distributors = await prisma.distributor.findMany({
      where: { id: { in: distributorIds } },
      select: { id: true, impiantoId: true, gestore: true, bandiera: true, comune: true }
    });
    const byDistributorId = new Map(distributors.map(d => [d.id, d] as const));

    // Raggruppa variazioni per (impiantoId, fuelType)
    type Key = string;
    const keyed = (variations as any[]).map((v: any) => {
      const d = byDistributorId.get(v.distributorId as number);
      const impiantoId = d?.impiantoId as number | undefined;
      return {
        key: `${impiantoId}|${String(v.fuelType)}` as Key,
        impiantoId,
        distributorId: v.distributorId as number,
        distributor: d,
        fuelType: String(v.fuelType),
        oldPrice: Number(v.oldPrice),
        newPrice: Number(v.newPrice),
      } as const;
    }).filter((x: any) => x.impiantoId != null);

    const grouped = groupBy(keyed, x => x.key);

    // Per ogni gruppo, recupera gli externalId iscritti e invia notifica in batch
    let sent = 0;
    const failures: Array<{ key: string; error: string }> = [];

    for (const [key, items] of Object.entries(grouped)) {
      const sample = items[0];
      const impiantoId = sample!.impiantoId as number;
      const fuelType = sample!.fuelType;

      const subs = await prisma.subscription.findMany({
        where: { impiantoId, fuelType },
        select: { externalId: true }
      });
      const externalIds = subs.map(s => s.externalId).filter(Boolean);
      if (externalIds.length === 0) continue;

      // Scegli prezzi old/new dall'item con delta maggiore assoluto
      const best = items.reduce((a, b) => {
        const da = Math.abs((a.oldPrice ?? 0) - (a.newPrice ?? 0));
        const db = Math.abs((b.oldPrice ?? 0) - (b.newPrice ?? 0));
        return db > da ? b : a;
      }, items[0]!);

      // Chiama l'endpoint interno di invio notifica (targeting per externalIds)
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/send-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fuelType,
            distributorId: impiantoId,
            distributorName: sample!.distributor?.gestore || sample!.distributor?.bandiera || sample!.distributor?.comune || undefined,
            oldPrice: best.oldPrice,
            newPrice: best.newPrice,
            externalIds,
          })
        });
        if (res.ok) sent += externalIds.length;
        else failures.push({ key, error: `HTTP ${res.status}` });
      } catch (e: any) {
        failures.push({ key, error: e?.message || 'fetch error' });
      }
    }

    return NextResponse.json({ ok: true, day: targetDay.toISOString().slice(0,10), groups: Object.keys(grouped).length, sent, failures });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


