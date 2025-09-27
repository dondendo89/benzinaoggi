import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, comparePrices, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 900; // 15 minuti per il job completo

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '5000'); // Default 5000 distributori
    const force = searchParams.get('force') === 'true' || true; // Sempre forzare aggiornamento
    const dryRun = searchParams.get('dryRun') === 'true';
    
    console.log(`[CRON] Starting daily price update job at ${new Date().toISOString()}`);
    console.log(`[CRON] Processing up to ${limit} distributors, force: ${force}, dryRun: ${dryRun}`);
    
    // Ottieni distributori da aggiornare
    const distributors = await prisma.distributor.findMany({
      select: { id: true, impiantoId: true, bandiera: true, comune: true },
      take: limit,
      orderBy: { id: 'asc' } // Processa in ordine per consistenza
    });
    
    console.log(`[CRON] Found ${distributors.length} distributors to process`);
    
    const results = {
      totalProcessed: 0,
      totalUpdated: 0,
      totalCreated: 0,
      totalErrors: 0,
      distributorsWithChanges: 0,
      miseApiErrors: 0,
      startTime: new Date().toISOString(),
      endTime: '',
      details: [] as any[]
    };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Processa distributori in batch per evitare timeout
    const batchSize = 50;
    for (let i = 0; i < distributors.length; i += batchSize) {
      const batch = distributors.slice(i, i + batchSize);
      console.log(`[CRON] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(distributors.length/batchSize)} (${batch.length} distributors)`);
      
      const batchPromises = batch.map(async (distributor) => {
        try {
          results.totalProcessed++;
          
          // Ottieni dati MISE
          const miseData = await getMiseServiceArea(distributor.impiantoId);
          if (!miseData) {
            results.miseApiErrors++;
            return {
              impiantoId: distributor.impiantoId,
              status: 'no_mise_data',
              message: 'No MISE data available'
            };
          }
          
          // Prezzi locali per oggi
          const localPrices = await prisma.price.findMany({
            where: {
              distributorId: distributor.id,
              day: today
            }
          });
          
          // Confronta prezzi
          const comparisons = comparePrices(localPrices, miseData.fuels);
          const changes = comparisons.filter(c => c.hasChanged);
          
          if (changes.length === 0 && !force && localPrices.length > 0) {
            return {
              impiantoId: distributor.impiantoId,
              status: 'no_changes',
              message: 'Prices match MISE data'
            };
          }
          
          if (dryRun) {
            return {
              impiantoId: distributor.impiantoId,
              status: 'dry_run',
              message: `Would update ${miseData.fuels.length} prices`,
              changes: changes.length
            };
          }
          
          // Aggiorna prezzi nel database
          let updatedCount = 0;
          let createdCount = 0;
          
          for (const fuel of miseData.fuels) {
            const normalizedFuel = normalizeFuelName(fuel.name);
            
            try {
              const existing = localPrices.find(p => 
                p.fuelType === normalizedFuel && 
                p.isSelfService === fuel.isSelf
              );
              
              const result = await prisma.price.upsert({
                where: {
                  Price_unique_day: {
                    distributorId: distributor.id,
                    fuelType: normalizedFuel,
                    day: today,
                    isSelfService: fuel.isSelf
                  }
                },
                update: {
                  price: fuel.price,
                  communicatedAt: new Date()
                },
                create: {
                  distributorId: distributor.id,
                  fuelType: normalizedFuel,
                  price: fuel.price,
                  day: today,
                  isSelfService: fuel.isSelf,
                  communicatedAt: new Date()
                }
              });
              
              if (existing) {
                if (Math.abs(existing.price - fuel.price) > 0.001) {
                  updatedCount++;
                }
              } else {
                createdCount++;
              }
              
            } catch (error) {
              console.error(`[CRON] Error updating price for ${distributor.impiantoId} ${normalizedFuel}:`, error);
            }
          }
          
          results.totalUpdated += updatedCount;
          results.totalCreated += createdCount;
          
          if (updatedCount > 0 || createdCount > 0) {
            results.distributorsWithChanges++;
          }
          
          return {
            impiantoId: distributor.impiantoId,
            status: 'updated',
            message: `Updated ${updatedCount} prices, created ${createdCount} prices`,
            updated: updatedCount,
            created: createdCount,
            changes: changes.length
          };
          
        } catch (error) {
          results.totalErrors++;
          console.error(`[CRON] Error processing distributor ${distributor.impiantoId}:`, error);
          return {
            impiantoId: distributor.impiantoId,
            status: 'error',
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      });
      
      // Attendi il batch corrente
      const batchResults = await Promise.all(batchPromises);
      results.details.push(...batchResults);
      
      // Pausa tra batch per evitare rate limiting
      if (i + batchSize < distributors.length) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 secondo di pausa
      }
    }
    
    results.endTime = new Date().toISOString();
    
    console.log(`[CRON] Job completed: ${results.totalProcessed} processed, ${results.totalUpdated} updated, ${results.totalCreated} created, ${results.totalErrors} errors`);
    
    return NextResponse.json({
      ok: true,
      job: 'daily_price_update',
      results,
      summary: {
        totalProcessed: results.totalProcessed,
        totalUpdated: results.totalUpdated,
        totalCreated: results.totalCreated,
        totalErrors: results.totalErrors,
        distributorsWithChanges: results.distributorsWithChanges,
        miseApiErrors: results.miseApiErrors,
        duration: new Date(results.endTime).getTime() - new Date(results.startTime).getTime()
      }
    });
    
  } catch (e: any) {
    console.error('[CRON] Daily price update job failed:', e);
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
