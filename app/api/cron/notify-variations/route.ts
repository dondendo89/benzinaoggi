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

    // Determina il giorno target: se passato via query, usa quello; altrimenti l'ultimo presente in Price
    let targetDay: Date | null = null;
    if (dayParam) {
      targetDay = new Date(`${dayParam}T00:00:00.000Z`);
    } else {
      const lastDay = await prisma.price.findFirst({
        select: { day: true },
        orderBy: { day: 'desc' }
      });
      targetDay = lastDay?.day ?? null;
    }
    if (!targetDay) {
      return NextResponse.json({ ok: true, sent: 0, note: 'No target day found' });
    }

    // Carica variazioni del giorno target
    const variations = await prisma.priceVariation.findMany({
      where: {
        day: targetDay,
        ...(onlyDown ? { direction: 'down' } as any : {})
      }
    });
    if (variations.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, day: targetDay.toISOString().slice(0,10), note: 'No variations for target day' });
    }

    // Mappa distributorId -> impiantoId e nome/descrizione
    const distributorIds = Array.from(new Set(variations.map(v => v.distributorId)));
    const distributors = await prisma.distributor.findMany({
      where: { id: { in: distributorIds } },
      select: { id: true, impiantoId: true, gestore: true, bandiera: true, comune: true }
    });
    const byDistributorId = new Map(distributors.map(d => [d.id, d] as const));

    // Raggruppa variazioni per (impiantoId, fuelType)
    type Key = string;
    const keyed = variations.map(v => {
      const d = byDistributorId.get(v.distributorId);
      const impiantoId = d?.impiantoId;
      return {
        key: `${impiantoId}|${v.fuelType}` as Key,
        impiantoId,
        distributorId: v.distributorId,
        distributor: d,
        fuelType: v.fuelType,
        oldPrice: v.oldPrice,
        newPrice: v.newPrice,
      };
    }).filter(x => x.impiantoId != null);

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
      });

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


