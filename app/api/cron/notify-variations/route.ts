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
    // Invia SOLO ribassi creati oggi (UTC). Permetti override del giorno via createdDay=YYYY-MM-DD
    const createdDayParam = searchParams.get('createdDay');
    const todayIso = (createdDayParam || new Date().toISOString().slice(0,10));
    const startOfDay = new Date(`${todayIso}T00:00:00.000Z`);
    const endOfDay = new Date(`${todayIso}T23:59:59.999Z`);

    let variations: any[] = [];
    try {
      // Leggi SOLO ribassi creati oggi (UTC) da PriceVariation
      variations = await prisma.$queryRawUnsafe<any[]>(
        `SELECT "distributorId","fuelType","isSelfService","oldPrice","newPrice","direction","delta","percentage","day"
         FROM "PriceVariation"
         WHERE "direction"='down' AND "createdAt" >= $1 AND "createdAt" < $2`,
        startOfDay,
        endOfDay
      );
    } catch (_) {
      // Nessun fallback su Price: se PriceVariation non è disponibile, non inviare
      variations = [];
    }
    if (variations.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, createdDay: todayIso, note: 'No down variations created today' });
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

    return NextResponse.json({ ok: true, createdDay: todayIso, groups: Object.keys(grouped).length, sent, failures });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


