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

    // PostgreSQL handles case-insensitive filtering natively
    const filtered = distributors;

    function haversine(lat1?: number | null, lon1?: number | null, lat2?: number, lon2?: number) {
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return undefined as number | undefined;
      const toRad = (x: number) => (x * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    }

    const mapped = filtered.map((d) => {
      const distKm = userLat != null && userLon != null ? haversine(d.latitudine, d.longitudine, userLat, userLon) : undefined;
      const priceList = byDistributor.get(d.id) || [];
      const cheapestPrice = priceList.length
        ? (fuel
            ? priceList.filter((p: any) => p.fuelType === fuel).map((p: any) => p.price).sort((a: number, b: number) => a - b)[0]
            : priceList.map((p: any) => p.price).sort((a: number, b: number) => a - b)[0])
        : undefined;
      return {
        id: d.id,
        impiantoId: d.impiantoId,
        gestore: d.gestore,
        bandiera: d.bandiera,
        comune: d.comune,
        provincia: d.provincia,
        indirizzo: d.indirizzo,
        latitudine: d.latitudine,
        longitudine: d.longitudine,
        prices: priceList,
        distanceKm: distKm,
        cheapestPrice,
      };
    });

    let sorted = mapped;
    if (sort === 'nearest' && userLat != null && userLon != null) {
      sorted = [...mapped].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    } else if (sort === 'cheapest') {
      sorted = [...mapped].sort((a, b) => (a.cheapestPrice ?? Infinity) - (b.cheapestPrice ?? Infinity));
    }

    return NextResponse.json({ ok: true, day, count: sorted.length, distributors: sorted });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


