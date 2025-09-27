import { NextRequest, NextResponse } from "next/server";
import { checkVariation } from "@/src/services/mimit";
import { prisma } from "@/src/lib/prisma";
import { getMiseServiceArea } from "@/src/services/mise-api";

export const maxDuration = 600; // 10 minuti per il check variazioni

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoIdParam = searchParams.get('impiantoId');
    const fuelType = searchParams.get('fuelType') || undefined;
    const onlyDown = (searchParams.get('onlyDown') || '').toLowerCase() === 'true';
    const verbose = (searchParams.get('verbose') || '').toLowerCase() === 'true';
    const useCorrectLogic = (searchParams.get('correct') || '').toLowerCase() === 'true';
    const impiantoId = impiantoIdParam ? Number(impiantoIdParam) : undefined;

    // Se richiesta la logica corretta, usa il confronto MISE vs DB
    if (useCorrectLogic) {
      console.log('🔍 Using correct variation logic (MISE vs DB)...');
      
      const distributors = impiantoId 
        ? await prisma.distributor.findMany({ 
            where: { impiantoId },
            select: { id: true, impiantoId: true, name: true }
          })
        : await prisma.distributor.findMany({
            take: 50,
            select: { id: true, impiantoId: true, name: true }
          });

      const variations: any[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const distributor of distributors) {
        try {
          // Ottieni dati MISE
          const miseData = await getMiseServiceArea(distributor.impiantoId);
          if (!miseData?.fuels?.length) continue;

          // Ottieni prezzi DB per oggi
          const dbPrices = await prisma.price.findMany({
            where: {
              distributorId: distributor.id,
              day: today,
              ...(fuelType && { fuelType })
            },
            select: { fuelType: true, price: true, isSelfService: true }
          });

          // Confronta prezzi
          for (const miseFuel of miseData.fuels) {
            if (fuelType && miseFuel.fuelType !== fuelType) continue;
            
            const dbPrice = dbPrices.find(p => 
              p.fuelType === miseFuel.fuelType && 
              p.isSelfService === miseFuel.isSelfService
            );

            if (!dbPrice) continue;

            const difference = miseFuel.price - dbPrice.price;
            const hasChanged = Math.abs(difference) > 0.001;

            if (hasChanged) {
              const direction = difference > 0 ? 'up' : 'down';
              
              if (onlyDown && direction !== 'down') continue;

              variations.push({
                distributorId: distributor.id,
                impiantoId: distributor.impiantoId,
                fuelType: miseFuel.fuelType,
                isSelfService: miseFuel.isSelfService,
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

      // Ordina per differenza
      variations.sort((a, b) => {
        if (onlyDown) return a.difference - b.difference;
        return Math.abs(b.difference) - Math.abs(a.difference);
      });

      return NextResponse.json({ 
        ok: true, 
        day: today.toISOString(),
        previousDay: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        variations: variations.slice(0, 100),
        method: 'mise_vs_db',
        totalFound: variations.length
      });
    }

    // Logica originale (confronto ieri vs oggi)
    const result = await checkVariation({ impiantoId, fuelType, onlyDown, verbose });
    return NextResponse.json({ ok: true, ...result, method: 'yesterday_vs_today' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


