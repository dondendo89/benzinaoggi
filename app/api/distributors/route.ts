import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city")?.trim();
    const fuel = searchParams.get("fuel")?.trim() || undefined;
    const brand = searchParams.get("brand")?.trim() || undefined;
    const sort = (searchParams.get("sort") || "").toLowerCase();
    const latParam = searchParams.get("lat");
    const lonParam = searchParams.get("lon");
    const userLat = latParam ? parseFloat(latParam) : undefined;
    const userLon = lonParam ? parseFloat(lonParam) : undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10), 500);

    const distributors = await prisma.distributor.findMany({
      where: {
        comune: city ? { contains: city, mode: 'insensitive' } : undefined,
        bandiera: brand ? { contains: brand, mode: 'insensitive' } : undefined,
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

    const filtered = distributors;

    function haversine(lat1?: number | null, lon1?: number | null, lat2?: number, lon2?: number) {
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return undefined;
      const toRad = (v: number) => (v * Math.PI) / 180;
      const R = 6371; // km
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const enriched = filtered.map(d => {
      const dPrices = byDistributor.get(d.id) || [];
      const distance = (userLat != null && userLon != null) ? haversine(d.latitudine, d.longitudine, userLat, userLon) : undefined;
      return { ...d, prices: dPrices, distance };
    });

    let result = enriched;
    if (sort === 'distance' && userLat != null && userLon != null) {
      result = [...enriched].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    return NextResponse.json({ ok: true, day, count: result.length, distributors: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

