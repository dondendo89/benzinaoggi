import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get("city")?.trim();
    const fuel = searchParams.get("fuel")?.trim() || undefined;
    const brand = searchParams.get("brand")?.trim() || undefined;
    const sortParam = (searchParams.get("sort") || "").toLowerCase();
    const latParam = searchParams.get("lat");
    const lonParam = searchParams.get("lon");
    const userLat = latParam ? parseFloat(latParam) : undefined;
    const userLon = lonParam ? parseFloat(lonParam) : undefined;
    const radiusKmParam = searchParams.get("radiusKm");
    const radiusKm = radiusKmParam ? parseFloat(radiusKmParam) : undefined;
    // Paginazione: se non specificato limit, restituisce tutti i risultati
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.max(parseInt(limitParam, 10), 1) : undefined;
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const skip = limit ? (page - 1) * limit : 0;

    // Build where clause for database query
    const whereClause: any = {};
    
    // Only add city filter if city is specified
    if (city) {
      whereClause.comune = { equals: city, mode: 'insensitive' };
    }
    
    // Only add brand filter if brand is specified  
    if (brand) {
      whereClause.bandiera = { contains: brand, mode: 'insensitive' };
    }

    const total = await prisma.distributor.count({ where: whereClause });
    const distributors = await prisma.distributor.findMany({
      where: whereClause,
      ...(limit && { take: limit }),
      ...(skip > 0 && { skip }),
    });

    // Fetch latest two distinct days to allow fallback when some distributors have no price today
    const lastTwoDays = await prisma.price.findMany({ select: { day: true }, orderBy: { day: "desc" }, distinct: ["day"], take: 2 });
    const day = lastTwoDays[0]?.day;
    const prevDay = lastTwoDays[1]?.day;

    const prices = day ? await prisma.price.findMany({
      where: {
        day,
        fuelType: fuel || undefined,
      },
    }) : [];

    const prevPrices = prevDay ? await prisma.price.findMany({
      where: {
        day: prevDay,
        fuelType: fuel || undefined,
      },
    }) : [];

    const byDistributor = new Map<number, any[]>();
    for (const p of prices) {
      const arr = byDistributor.get(p.distributorId) || [];
      arr.push({ fuelType: p.fuelType, price: p.price, isSelfService: p.isSelfService });
      byDistributor.set(p.distributorId, arr);
    }
    // Fill gaps with previous day prices only if no entry exists yet for that distributor
    if (prevPrices.length > 0) {
      for (const p of prevPrices) {
        if (!byDistributor.has(p.distributorId)) {
          byDistributor.set(p.distributorId, [{ fuelType: p.fuelType, price: p.price, isSelfService: p.isSelfService }]);
        }
      }
    }

    // If a specific fuel is requested, keep only distributors that have at least one price after fallback
    const filtered = fuel ? distributors.filter(d => (byDistributor.get(d.id) || []).some(pp => (pp.fuelType || '').toLowerCase() === fuel.toLowerCase())) : distributors;

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

    // Optional server-side radius filter if user lat/lon and radius provided
    const radiusFiltered = (userLat != null && userLon != null && radiusKm != null)
      ? filtered.filter(d => {
          const dist = haversine(d.latitudine, d.longitudine, userLat, userLon);
          return dist != null && dist <= radiusKm!;
        })
      : filtered;

    const enriched = radiusFiltered.map(d => {
      const dPrices = byDistributor.get(d.id) || [];
      const distance = (userLat != null && userLon != null) ? haversine(d.latitudine, d.longitudine, userLat, userLon) : undefined;
      return { ...d, prices: dPrices, distance };
    });

    let result = enriched;
    const sort = (sortParam === 'nearest') ? 'distance' : sortParam; // accept nearest alias
    if (!city && sort === 'distance' && userLat != null && userLon != null) {
      result = [...enriched].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    // Aggiorna total per riflettere il filtro raggio
    const actualTotal = radiusFiltered.length;
    const totalPages = limit ? Math.max(1, Math.ceil(actualTotal / limit)) : 1;
    return NextResponse.json({ ok: true, day, count: result.length, total: actualTotal, page, pageSize: limit || actualTotal, totalPages, distributors: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

