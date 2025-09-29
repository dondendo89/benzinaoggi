import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { prisma } from '@/src/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lon = parseFloat(searchParams.get('lon') || '0');
    const radiusKm = parseFloat(searchParams.get('radiusKm') || '10');

    // Funzione haversine
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

    // Ottieni distributori di Rometta
    const distributors = await prisma.distributor.findMany({
      where: {
        comune: 'ROMETTA'
      },
      take: 5
    });

    const debugResults = distributors.map(d => {
      const distance = haversine(d.latitudine, d.longitudine, lat, lon);
      const isWithinRadius = distance != null && distance <= radiusKm;
      
      return {
        id: d.id,
        impiantoId: d.impiantoId,
        comune: d.comune,
        latitudine: d.latitudine,
        longitudine: d.longitudine,
        distance: distance,
        isWithinRadius: isWithinRadius,
        userLat: lat,
        userLon: lon,
        radiusKm: radiusKm
      };
    });

    return NextResponse.json({
      ok: true,
      userCoordinates: { lat, lon },
      radiusKm,
      distributors: debugResults,
      totalDistributors: distributors.length
    });
  } catch (error) {
    console.error('Error in debug-geographic:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to debug geographic filtering',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
