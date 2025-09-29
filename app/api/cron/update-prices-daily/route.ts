import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, comparePrices, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minuti per compatibilità Vercel Hobby

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '2000'); // Default 2000 distributori per 5 minuti
    const processAll = (searchParams.get('all') || '').toLowerCase() === 'true';
    const force = searchParams.get('force') === 'true' || true; // Sempre forzare aggiornamento
    const dryRun = searchParams.get('dryRun') === 'true';
    
    console.log(`[CRON] Starting daily price update job at ${new Date().toISOString()}`);
    console.log(`[CRON] Processing up to ${limit} distributors, force: ${force}, dryRun: ${dryRun}`);
    
    // Ottieni distributori da aggiornare
    let distributors: Array<{ id: number; impiantoId: number; bandiera: string | null; comune: string | null }> = [];
    if (!processAll) {
      distributors = await prisma.distributor.findMany({
        select: { id: true, impiantoId: true, bandiera: true, comune: true },
        take: limit,
        orderBy: { id: 'asc' }
      });
      console.log(`[CRON] Found ${distributors.length} distributors to process (limited mode)`);
    } else {
      // Pagina tutti i distributori in batch
      console.log('[CRON] Processing ALL distributors with pagination');
      const total = await prisma.distributor.count();
      const pageSize = 1000;
      for (let offset = 0; offset < total; offset += pageSize) {
        const page = await prisma.distributor.findMany({
          select: { id: true, impiantoId: true, bandiera: true, comune: true },
          orderBy: { id: 'asc' },
          skip: offset,
          take: pageSize
        });
        distributors.push(...page);
      }
      console.log(`[CRON] Found ${distributors.length} distributors to process (all mode)`);
    }
    
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
          
          // Confronta contro l'ultimo prezzo DB (qualunque giorno)
          let changesCount = 0;
          
          if (dryRun) {
            return {
              impiantoId: distributor.impiantoId,
              status: 'dry_run',
              message: `Would check ${miseData.fuels.length} prices against latest DB`,
              changes: miseData.fuels.length
            };
          }
          
          // Aggiorna prezzi nel database
          let updatedCount = 0;
          let createdCount = 0;
          
          for (const fuel of miseData.fuels) {
            const normalizedFuel = normalizeFuelName(fuel.name);
            
            try {
              // Trova ultimo prezzo noto per quel fuel/self (qualunque giorno)
              const existingLatest = await prisma.price.findFirst({
                where: {
                  distributorId: distributor.id,
                  fuelType: normalizedFuel,
                  isSelfService: fuel.isSelf
                },
                orderBy: { day: 'desc' }
              });
              const hasChanged = !existingLatest || Math.abs(existingLatest.price - fuel.price) > 0.001;
              if (!hasChanged && !force) {
                continue; // nessun update necessario
              }
              
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
              
              if (existingLatest) {
                if (Math.abs(existingLatest.price - fuel.price) > 0.001) {
                  updatedCount++;
                }
              } else {
                createdCount++;
              }
              changesCount++;
              
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
            changes: changesCount
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
