import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, comparePrices, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoId = searchParams.get('impiantoId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const forceUpdate = searchParams.get('force') === 'true';
    
    let distributorsToCheck: Array<{ id: number; impiantoId: number }> = [];
    
    if (impiantoId) {
      // Controlla un distributore specifico
      const distributor = await prisma.distributor.findUnique({
        where: { impiantoId: parseInt(impiantoId) }
      });
      if (distributor) {
        distributorsToCheck = [{ id: distributor.id, impiantoId: distributor.impiantoId }];
      }
    } else {
      // Controlla i primi N distributori
      distributorsToCheck = await prisma.distributor.findMany({
        select: { id: true, impiantoId: true },
        take: limit
      });
    }
    
    const results = [];
    let totalUpdated = 0;
    let totalChecked = 0;
    let totalErrors = 0;
    
    for (const distributor of distributorsToCheck) {
      try {
        totalChecked++;
        
        // Ottieni dati MISE
        const miseData = await getMiseServiceArea(distributor.impiantoId);
        if (!miseData) {
          results.push({
            impiantoId: distributor.impiantoId,
            status: 'no_mise_data',
            message: 'No data from MISE API'
          });
          continue;
        }
        
        // Ottieni prezzi locali per oggi
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const localPrices = await prisma.price.findMany({
          where: {
            distributorId: distributor.id,
            day: today
          },
          select: {
            fuelType: true,
            price: true,
            isSelfService: true
          }
        });
        
        if (localPrices.length === 0 && !forceUpdate) {
          results.push({
            impiantoId: distributor.impiantoId,
            status: 'no_local_data',
            message: 'No local prices for today'
          });
          continue;
        }
        
        // Confronta prezzi
        const comparisons = comparePrices(localPrices, miseData.fuels);
        const changes = comparisons.filter(c => c.hasChanged);
        
        if (changes.length === 0 && !forceUpdate) {
          results.push({
            impiantoId: distributor.impiantoId,
            status: 'no_changes',
            message: 'Prices match MISE data'
          });
          continue;
        }
        
        // Aggiorna prezzi nel database
        let updatedCount = 0;
        for (const change of changes) {
          const normalizedFuel = normalizeFuelName(change.fuelType);
          
          await prisma.price.upsert({
            where: {
              Price_unique_day: {
                distributorId: distributor.id,
                fuelType: normalizedFuel,
                day: today,
                isSelfService: change.isSelfService
              }
            },
            update: {
              price: change.misePrice,
              communicatedAt: new Date()
            },
            create: {
              distributorId: distributor.id,
              fuelType: normalizedFuel,
              price: change.misePrice,
              day: today,
              isSelfService: change.isSelfService,
              communicatedAt: new Date()
            }
          });
          updatedCount++;
        }
        
        totalUpdated += updatedCount;
        
        results.push({
          impiantoId: distributor.impiantoId,
          status: 'updated',
          message: `Updated ${updatedCount} prices`,
          changes: changes.map(c => ({
            fuelType: c.fuelType,
            isSelfService: c.isSelfService,
            oldPrice: c.localPrice,
            newPrice: c.misePrice,
            difference: c.difference
          }))
        });
        
      } catch (error) {
        totalErrors++;
        results.push({
          impiantoId: distributor.impiantoId,
          status: 'error',
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
    
    return NextResponse.json({
      ok: true,
      summary: {
        totalChecked,
        totalUpdated,
        totalErrors,
        processed: results.length
      },
      results
    });
    
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
