import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, normalizeFuelName } from "@/src/services/mise-api";

export async function GET(req: NextRequest, { params }: { params: { impiantoId: string } }) {
  try {
    const impiantoId = Number(params.impiantoId);
    if (!Number.isFinite(impiantoId)) {
      return NextResponse.json({ ok: false, error: 'Invalid impiantoId' }, { status: 400 });
    }
    const distributor = await prisma.distributor.findUnique({ where: { impiantoId } });
    if (!distributor) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    // Read current prices (single record per fuelType/isSelfService)
    const currentPrices = await prisma.currentPrice.findMany({
      where: { distributorId: distributor.id },
    });

    // Derive a pseudo-"day" as the max communicatedAt across current prices
    let day: Date | null = null;
    let lastUpdatedAt: Date | null = null;
    for (const p of currentPrices) {
      if (!day || p.communicatedAt > day) day = p.communicatedAt;
      if (!lastUpdatedAt || p.updatedAt > lastUpdatedAt) lastUpdatedAt = p.updatedAt;
    }

    // Compute previous price using latest PriceVariation per key
    let previousDay: Date | null = null;
    const latestVariations = await prisma.priceVariation.findMany({
      where: { distributorId: distributor.id },
      orderBy: { day: 'desc' },
      take: 200,
    });
    const prevByKey = new Map<string, { price: number; day: Date }>();
    for (const v of latestVariations) {
      const key = `${v.fuelType}|${v.isSelfService ? 1 : 0}`;
      if (!prevByKey.has(key)) {
        prevByKey.set(key, { price: v.oldPrice, day: v.day });
        if (!previousDay || v.day > previousDay) previousDay = v.day;
      }
    }

    // Optionally enrich with live MISE comparison for current day
    let miseByKey: Map<string, number> | null = null;
    try {
      const mise = await getMiseServiceArea(distributor.impiantoId);
      if (mise && Array.isArray(mise.fuels)) {
        miseByKey = new Map<string, number>();
        for (const f of mise.fuels) {
          const key = `${normalizeFuelName(f.name)}|${f.isSelf ? 1 : 0}`;
          miseByKey.set(key, Number(f.price));
        }
      }
    } catch {}

    const pricesWithVariation = currentPrices.map(p => {
      const key = `${p.fuelType}|${p.isSelfService ? 1 : 0}`;
      const prev = prevByKey.get(key);
      let direction: 'up' | 'down' | 'same' | null = null;
      let delta: number | null = null;
      if (prev) {
        delta = Number((p.price - prev.price).toFixed(3));
        direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
      }
      // If MISE has a different price for same fuel/self today, override variation/delta to reflect live change
      if (miseByKey && miseByKey.has(key)) {
        const misePrice = miseByKey.get(key)!;
        const diffLive = Number((misePrice - p.price).toFixed(3));
        if (Math.abs(diffLive) > 0.001) {
          delta = Math.abs(diffLive);
          direction = diffLive > 0 ? 'up' : 'down';
        }
      }
      return {
        id: undefined,
        distributorId: p.distributorId,
        fuelType: p.fuelType,
        price: p.price,
        isSelfService: p.isSelfService,
        communicatedAt: p.communicatedAt,
        day,
        previousPrice: prev?.price ?? null,
        variation: direction,
        delta,
      };
    });

    return NextResponse.json({ ok: true, distributor, day, previousDay, lastUpdatedAt, prices: pricesWithVariation });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


