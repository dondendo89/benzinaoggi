import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, comparePrices, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoId = searchParams.get('impiantoId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const onlyDown = searchParams.get('onlyDown') === 'true';
    
    // Ottieni distributori da controllare
    let distributors: Array<{ id: number; impiantoId: number }> = [];
    
    if (impiantoId) {
      const distributor = await prisma.distributor.findUnique({
        where: { impiantoId: parseInt(impiantoId) }
      });
      if (distributor) {
        distributors = [distributor];
      }
    } else {
      // Prendi distributori con prezzi recenti
      distributors = await prisma.distributor.findMany({
        select: { id: true, impiantoId: true },
        where: {
          prices: {
            some: {
              day: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Ultimi 7 giorni
              }
            }
          }
        },
        take: limit
      });
    }
    
    const variations = [];
    let totalChecked = 0;
    let totalErrors = 0;
    let totalVariations = 0;
    
    for (const distributor of distributors) {
      try {
        totalChecked++;
        
        // Ottieni dati MISE
        const miseData = await getMiseServiceArea(distributor.impiantoId);
        if (!miseData) {
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
        
        if (localPrices.length === 0) {
          continue;
        }
        
        // Confronta prezzi
        const comparisons = comparePrices(localPrices, miseData.fuels);
        const changes = comparisons.filter(c => c.hasChanged);
        
        for (const change of changes) {
          const direction = change.difference > 0 ? 'up' : 'down';
          
          // Filtra solo cali se richiesto
          if (onlyDown && direction !== 'down') {
            continue;
          }
          
          totalVariations++;
          
          variations.push({
            distributorId: distributor.id,
            impiantoId: distributor.impiantoId,
            fuelType: normalizeFuelName(change.fuelType),
            isSelfService: change.isSelfService,
            oldPrice: change.localPrice,
            newPrice: change.misePrice,
            direction,
            difference: change.difference,
            percentageChange: ((change.difference / change.localPrice) * 100).toFixed(2),
            source: 'mise_api',
            checkedAt: new Date().toISOString()
          });
        }
        
      } catch (error) {
        totalErrors++;
        console.warn(`Error checking MISE variations for ${distributor.impiantoId}:`, error);
      }
    }
    
    // Ordina per differenza (cali maggiori prima)
    variations.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    
    return NextResponse.json({
      ok: true,
      summary: {
        totalChecked,
        totalVariations,
        totalErrors,
        variationsFound: variations.length
      },
      variations,
      checkedAt: new Date().toISOString()
    });
    
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
