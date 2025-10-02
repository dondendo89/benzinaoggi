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
    // Paginazione: per comune senza tagli arbitrarî; default 100, max elevato
    const limitParam = parseInt(searchParams.get("limit") || "100", 10);
    const limit = Math.max(limitParam, 1); // nessun cap artificiale; il DB gestisce
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const skip = (page - 1) * limit;

    // Build where clause for database query
    const whereClause: any = {};
    
    // Only add city filter if city is specified
    if (city) {
      whereClause.comune = { contains: city, mode: 'insensitive' };
    }
    
    // Only add brand filter if brand is specified  
    if (brand) {
      whereClause.bandiera = { contains: brand, mode: 'insensitive' };
    }

    // If radius filtering is needed, we need to fetch all distributors first, then filter
    const hasRadius = !city && userLat != null && userLon != null && radiusKm != null;
    
    let distributors;
    let total;
    
    if (hasRadius) {
      // For radius filtering, get all distributors first, then filter and paginate
      const allDistributors = await prisma.distributor.findMany({
        where: whereClause,
      });
      
      // Apply radius filter first
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
      
      const radiusFiltered = allDistributors.filter(d => {
        const dist = haversine(d.latitudine, d.longitudine, userLat, userLon);
        const rKm = radiusKm as number;
        return dist != null && dist <= rKm;
      });
      
      total = radiusFiltered.length;
      distributors = radiusFiltered.slice(skip, skip + limit);
    } else {
      // Normal pagination for city/brand searches
      total = await prisma.distributor.count({ where: whereClause });
      distributors = await prisma.distributor.findMany({
        where: whereClause,
        take: limit,
        skip,
      });
    }

    // Fetch current prices from CurrentPrice table
    const prices = await prisma.currentPrice.findMany({
      where: {
        fuelType: fuel || undefined,
      },
    });

    // Get the most recent update time for display
    const lastUpdatedAt = prices.length > 0 
      ? prices.reduce((latest, p) => p.updatedAt > latest ? p.updatedAt : latest, prices[0].updatedAt)
      : null;

    const byDistributor = new Map<number, any[]>();
    for (const p of prices) {
      const arr = byDistributor.get(p.distributorId) || [];
      arr.push({ fuelType: p.fuelType, price: p.price, isSelfService: p.isSelfService });
      byDistributor.set(p.distributorId, arr);
    }

    // If a specific fuel is requested, keep only distributors that have at least one price after fallback
    const filtered = fuel ? distributors.filter(d => (byDistributor.get(d.id) || []).some(pp => (pp.fuelType || '').toLowerCase() === fuel.toLowerCase())) : distributors;

    // Haversine function for distance calculation (moved up for reuse)
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
    const sort = (sortParam === 'nearest') ? 'distance' : sortParam; // accept nearest alias
    if (!city && sort === 'distance' && userLat != null && userLon != null) {
      result = [...enriched].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }

    // Update total count for radius filtering (after fuel filtering)
    const finalTotal = hasRadius ? filtered.length : total;
    const totalPages = Math.max(1, Math.ceil(finalTotal / limit));
    return NextResponse.json({ ok: true, lastUpdatedAt, count: result.length, total: finalTotal, page, pageSize: limit, totalPages, distributors: result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

