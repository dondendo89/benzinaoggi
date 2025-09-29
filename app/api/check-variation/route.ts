import { NextRequest, NextResponse } from "next/server";
import { checkVariation } from "@/src/services/mimit";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minuti per compatibilità Vercel Hobby

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoIdParam = searchParams.get('impiantoId');
    const fuelType = searchParams.get('fuelType') || undefined;
    const onlyDown = (searchParams.get('onlyDown') || '').toLowerCase() === 'true';
    const verbose = (searchParams.get('verbose') || '').toLowerCase() === 'true';
    const impiantoId = impiantoIdParam ? Number(impiantoIdParam) : undefined;

    // Sempre: logica corretta (MISE vs DB)
    console.log('🔍 Using variation logic: MISE vs DB');

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam))) : 100;

    const distributors = impiantoId 
      ? await prisma.distributor.findMany({ 
          where: { impiantoId },
          select: { id: true, impiantoId: true, bandiera: true, comune: true }
        })
      : await prisma.distributor.findMany({
          take: 1000,
          select: { id: true, impiantoId: true, bandiera: true, comune: true }
        });

    const variations: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const distributor of distributors) {
      try {
        const miseData = await getMiseServiceArea(distributor.impiantoId);
        if (!miseData?.fuels?.length) continue;

        const dbPrices = await prisma.price.findMany({
          where: {
            distributorId: distributor.id,
            day: today,
            ...(fuelType && { fuelType })
          },
          select: { fuelType: true, price: true, isSelfService: true }
        });

        for (const miseFuel of miseData.fuels) {
          const normalizedFuelType = normalizeFuelName(miseFuel.name);
          if (fuelType && normalizedFuelType !== fuelType) continue;
          
          let dbPrice: { fuelType: string; price: number; isSelfService: boolean } | null = dbPrices.find(p => 
            p.fuelType === normalizedFuelType && 
            p.isSelfService === miseFuel.isSelf
          ) || null;

          // Fallback: use the most recent DB price if today's price is missing
          if (!dbPrice) {
            const latest = await prisma.price.findFirst({
              where: {
                distributorId: distributor.id,
                fuelType: normalizedFuelType,
                isSelfService: miseFuel.isSelf
              },
              select: { price: true, day: true },
              orderBy: { day: 'desc' }
            });
            if (!latest) continue;
            dbPrice = { fuelType: normalizedFuelType, price: latest.price, isSelfService: miseFuel.isSelf };
          }

          if (!dbPrice) continue;
          const difference = miseFuel.price - dbPrice.price;
          const hasChanged = Math.abs(difference) > 0.001;

          if (hasChanged) {
            const direction = difference > 0 ? 'up' : 'down';
            if (onlyDown && direction !== 'down') continue;
            variations.push({
              distributorId: distributor.id,
              impiantoId: distributor.impiantoId,
              fuelType: normalizedFuelType,
              isSelfService: miseFuel.isSelf,
              oldPrice: dbPrice.price,
              newPrice: miseFuel.price,
              direction,
              difference: parseFloat(difference.toFixed(3)),
              percentageChange: parseFloat(((difference / dbPrice.price) * 100).toFixed(2))
            });
          }
        }
      } catch (error) {
        console.warn(`Error checking ${distributor.impiantoId}:`, error);
      }
    }

    variations.sort((a, b) => {
      if (onlyDown) return a.difference - b.difference;
      return Math.abs(b.difference) - Math.abs(a.difference);
    });

    return NextResponse.json({ 
      ok: true, 
      day: today.toISOString(),
      variations: variations.slice(0, limit),
      totalFound: variations.length,
      method: 'mise_vs_db'
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


