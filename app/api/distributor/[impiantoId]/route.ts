import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest, { params }: { params: { impiantoId: string } }) {
  try {
    const impiantoId = Number(params.impiantoId);
    if (!Number.isFinite(impiantoId)) {
      return NextResponse.json({ ok: false, error: 'Invalid impiantoId' }, { status: 400 });
    }
    const distributor = await prisma.distributor.findUnique({ where: { impiantoId } });
    if (!distributor) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    // latest day globally
    const lastDayRow = await prisma.price.findFirst({ select: { day: true }, orderBy: { day: 'desc' } });
    let day = lastDayRow?.day || null;
    let prices = day ? await prisma.price.findMany({ where: { distributorId: distributor.id, day } }) : [];

    // Fallback: if no prices for this distributor on the global latest day,
    // use the latest available day for this distributor specifically
    if (!prices.length) {
      const lastForDistributor = await prisma.price.findFirst({
        where: { distributorId: distributor.id },
        select: { day: true },
        orderBy: { day: 'desc' }
      });
      if (lastForDistributor?.day) {
        day = lastForDistributor.day;
        prices = await prisma.price.findMany({ where: { distributorId: distributor.id, day } });
      }
    }

    // Compute variation vs previous available day for the same distributor
    let previousDay: Date | null = null;
    if (day) {
      const prevDayRow = await prisma.price.findFirst({
        where: { distributorId: distributor.id, day: { lt: day } },
        select: { day: true },
        orderBy: { day: 'desc' },
      });
      previousDay = prevDayRow?.day ?? null;
    }

    let prevPricesByKey = new Map<string, { price: number }>();
    if (previousDay) {
      const prevPrices = await prisma.price.findMany({ where: { distributorId: distributor.id, day: previousDay } });
      for (const p of prevPrices) {
        const key = `${p.fuelType}|${p.isSelfService ? 1 : 0}`;
        prevPricesByKey.set(key, { price: p.price });
      }
    }

    const pricesWithVariation = prices.map(p => {
      const key = `${p.fuelType}|${p.isSelfService ? 1 : 0}`;
      const prev = prevPricesByKey.get(key);
      let direction: 'up' | 'down' | 'same' | null = null;
      let delta: number | null = null;
      if (prev) {
        delta = Number((p.price - prev.price).toFixed(3));
        direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
      }
      return {
        ...p,
        previousPrice: prev?.price ?? null,
        variation: direction,
        delta,
      };
    });

    return NextResponse.json({ ok: true, distributor, day, previousDay, prices: pricesWithVariation });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


