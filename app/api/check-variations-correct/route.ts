import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minuti per compatibilità Vercel Hobby

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyDown = (searchParams.get('onlyDown') || '').toLowerCase() === 'true';
    const verbose = (searchParams.get('verbose') || '').toLowerCase() === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const all = (searchParams.get('all') || '').toLowerCase() === 'true';

    console.log('🔍 Checking variations with correct logic...');
    
    // Ottieni tutti i distributori
    const distributors = await prisma.distributor.findMany({
      take: all ? undefined : limit,
      select: {
        id: true,
        impiantoId: true,
        bandiera: true,
        comune: true
      }
    });

    console.log(`📊 Processing ${distributors.length} distributors...`);

    const variations: any[] = [];
    let totalChecked = 0;
    let totalErrors = 0;
    let totalVariations = 0;
    let skippedNoMiseData = 0;
    let skippedNoDbData = 0;
    let noChanges = 0;

    // Data di oggi per il confronto
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const distributor of distributors) {
      try {
        totalChecked++;
        
        // 1. Ottieni dati attuali dalla MISE API
        const miseData = await getMiseServiceArea(distributor.impiantoId);
        if (!miseData || !miseData.fuels || miseData.fuels.length === 0) {
          skippedNoMiseData++;
          continue;
        }

        // 2. Ottieni prezzi salvati nel DB per oggi
        const dbPrices = await prisma.price.findMany({
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

        if (dbPrices.length === 0) {
          skippedNoDbData++;
          continue;
        }

        // 3. Confronta ogni prezzo MISE con quello nel DB
        for (const miseFuel of miseData.fuels) {
          const normalizedFuelType = normalizeFuelName(miseFuel.name);
          const dbPrice = dbPrices.find(p => 
            p.fuelType === normalizedFuelType && 
            p.isSelfService === miseFuel.isSelf
          );

          if (!dbPrice) {
            continue; // Nessun prezzo corrispondente nel DB
          }

          // 4. Calcola la differenza
          const difference = miseFuel.price - dbPrice.price;
          const hasChanged = Math.abs(difference) > 0.001; // Tolleranza per arrotondamenti

          if (hasChanged) {
            const direction = difference > 0 ? 'up' : 'down';
            
            // Filtra solo cali se richiesto
            if (onlyDown && direction !== 'down') {
              continue;
            }

            totalVariations++;
            
            variations.push({
              distributorId: distributor.id,
              impiantoId: distributor.impiantoId,
              distributorName: distributor.bandiera || distributor.comune,
              fuelType: normalizedFuelType,
              isSelfService: miseFuel.isSelf,
              oldPrice: dbPrice.price, // Prezzo salvato nel DB
              newPrice: miseFuel.price, // Prezzo attuale dalla MISE API
              direction,
              difference: parseFloat(difference.toFixed(3)),
              percentageChange: parseFloat(((difference / dbPrice.price) * 100).toFixed(2)),
              source: 'mise_vs_db',
              checkedAt: new Date().toISOString(),
              miseFuelId: miseFuel.fuelId
            });
          } else {
            noChanges++;
          }
        }

      } catch (error) {
        totalErrors++;
        console.warn(`❌ Error checking variations for distributor ${distributor.impiantoId}:`, error);
      }
    }

    // Ordina per differenza (cali maggiori prima se onlyDown, altrimenti per differenza assoluta)
    variations.sort((a, b) => {
      if (onlyDown) {
        return a.difference - b.difference; // Cali maggiori prima
      }
      return Math.abs(b.difference) - Math.abs(a.difference); // Differenze maggiori prima
    });

    const result = {
      ok: true,
      day: today.toISOString(),
      totalChecked,
      totalVariations,
      totalErrors,
      skippedNoMiseData,
      skippedNoDbData,
      noChanges,
      variations: variations.slice(0, limit),
      summary: {
        distributorsProcessed: totalChecked,
        variationsFound: totalVariations,
        errors: totalErrors,
        skipped: {
          noMiseData: skippedNoMiseData,
          noDbData: skippedNoDbData
        },
        noChanges
      }
    };

    if (verbose) {
      console.log('📈 Variation check results:', {
        totalChecked,
        totalVariations,
        totalErrors,
        skippedNoMiseData,
        skippedNoDbData,
        noChanges
      });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('❌ Error in check-variations-correct:', error);
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
