import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city");
    const fuel = searchParams.get("fuel");
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

    const distributors = await prisma.distributor.findMany({
      where: {
        comune: city ? { contains: city, mode: "insensitive" } : undefined,
      },
      take: limit,
    });

    // Fetch latest day
    const lastDayRow = await prisma.price.findFirst({ select: { day: true }, orderBy: { day: "desc" } });
    const day = lastDayRow?.day;

    const prices = day ? await prisma.price.findMany({
      where: {
        day,
        fuelType: fuel || undefined,
      },
    }) : [];

    const byDistributor = new Map<number, any[]>();
    for (const p of prices) {
      const arr = byDistributor.get(p.distributorId) || [];
      arr.push({ fuelType: p.fuelType, price: p.price, isSelfService: p.isSelfService });
      byDistributor.set(p.distributorId, arr);
    }

    const result = distributors.map((d) => ({
      id: d.id,
      impiantoId: d.impiantoId,
      gestore: d.gestore,
      bandiera: d.bandiera,
      comune: d.comune,
      provincia: d.provincia,
      indirizzo: d.indirizzo,
      latitudine: d.latitudine,
      longitudine: d.longitudine,
      prices: byDistributor.get(d.id) || [],
    }));

    return NextResponse.json({ ok: true, day, count: result.length, distributors: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


