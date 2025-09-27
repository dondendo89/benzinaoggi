import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, comparePrices, normalizeFuelName } from "@/src/services/mise-api";

function assertBearer(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = process.env.API_SECRET || '';
  if (!expected || token !== expected) {
    throw new Error('Unauthorized');
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    await assertBearer(req);
    
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const force = searchParams.get('force') === 'true';
    const debug = searchParams.get('debug') === 'true';
    
    console.log(`[FORCE-UPDATE-ALL] Starting force update for all distributors (limit: ${limit})`);
    
    // Get all distributors with their impiantoId
    const distributors = await prisma.distributor.findMany({
      where: {
        impiantoId: { not: null }
      },
      select: {
        id: true,
        impiantoId: true,
        bandiera: true,
        comune: true
      },
      take: limit
    });
    
    console.log(`[FORCE-UPDATE-ALL] Found ${distributors.length} distributors to update`);
    
    const results = {
      totalProcessed: 0,
      totalUpdated: 0,
      totalCreated: 0,
      totalErrors: 0,
      distributors: [],
      errors: []
    };
    
    // Process each distributor
    for (const distributor of distributors) {
      try {
        results.totalProcessed++;
        
        if (debug) {
          console.log(`[FORCE-UPDATE-ALL] Processing distributor ${distributor.id} (impiantoId: ${distributor.impiantoId})`);
        }
        
        // Get MISE data for this distributor
        const miseData = await getMiseServiceArea(distributor.impiantoId!);
        
        if (!miseData || !miseData.fuels || miseData.fuels.length === 0) {
          console.log(`[FORCE-UPDATE-ALL] No MISE data for distributor ${distributor.id}`);
          results.distributors.push({
            distributorId: distributor.id,
            impiantoId: distributor.impiantoId,
            status: 'no_mise_data',
            changes: []
          });
          continue;
        }
        
        // Get current local prices for this distributor
        const localPrices = await prisma.price.findMany({
          where: {
            distributorId: distributor.id,
            day: new Date() // Today's prices
          }
        });
        
        // Compare and update prices
        const changes = [];
        const pricesToUpdate = [];
        
        for (const miseFuel of miseData.fuels) {
          const normalizedFuel = normalizeFuelName(miseFuel.name);
          const isSelfService = miseFuel.isSelf || false;
          
          // Find matching local price
          const localPrice = localPrices.find(p => 
            p.fuelType === normalizedFuel && 
            p.isSelfService === isSelfService
          );
          
          const misePrice = parseFloat(miseFuel.price);
          
          if (localPrice) {
            // Update existing price if different
            if (Math.abs(localPrice.price - misePrice) > 0.001) {
              changes.push({
                fuelType: normalizedFuel,
                isSelfService: isSelfService,
                oldPrice: localPrice.price,
                newPrice: misePrice,
                difference: misePrice - localPrice.price
              });
              
              pricesToUpdate.push({
                id: localPrice.id,
                price: misePrice,
                communicatedAt: new Date()
              });
            }
          } else {
            // Create new price if doesn't exist
            changes.push({
              fuelType: normalizedFuel,
              isSelfService: isSelfService,
              oldPrice: null,
              newPrice: misePrice,
              difference: 0
            });
            
            pricesToUpdate.push({
              distributorId: distributor.id,
              fuelType: normalizedFuel,
              price: misePrice,
              isSelfService: isSelfService,
              communicatedAt: new Date(),
              day: new Date()
            });
          }
        }
        
        // Update prices in database
        if (pricesToUpdate.length > 0) {
          for (const priceUpdate of pricesToUpdate) {
            if (priceUpdate.id) {
              // Update existing price
              await prisma.price.update({
                where: { id: priceUpdate.id },
                data: {
                  price: priceUpdate.price,
                  communicatedAt: priceUpdate.communicatedAt
                }
              });
              results.totalUpdated++;
            } else {
              // Create new price
              await prisma.price.create({
                data: {
                  distributorId: priceUpdate.distributorId,
                  fuelType: priceUpdate.fuelType,
                  price: priceUpdate.price,
                  isSelfService: priceUpdate.isSelfService,
                  communicatedAt: priceUpdate.communicatedAt,
                  day: priceUpdate.day
                }
              });
              results.totalCreated++;
            }
          }
        }
        
        results.distributors.push({
          distributorId: distributor.id,
          impiantoId: distributor.impiantoId,
          bandiera: distributor.bandiera,
          comune: distributor.comune,
          status: 'updated',
          changes: changes,
          changesCount: changes.length
        });
        
        if (debug) {
          console.log(`[FORCE-UPDATE-ALL] Updated distributor ${distributor.id}: ${changes.length} changes`);
        }
        
      } catch (error) {
        console.error(`[FORCE-UPDATE-ALL] Error processing distributor ${distributor.id}:`, error);
        results.totalErrors++;
        results.errors.push({
          distributorId: distributor.id,
          impiantoId: distributor.impiantoId,
          error: String(error)
        });
      }
    }
    
    console.log(`[FORCE-UPDATE-ALL] Completed: ${results.totalProcessed} processed, ${results.totalUpdated} updated, ${results.totalCreated} created, ${results.totalErrors} errors`);
    
    return NextResponse.json({
      ok: true,
      message: 'Force update completed for all distributors',
      summary: results,
      distributors: results.distributors,
      errors: results.errors
    });
    
  } catch (e: any) {
    console.error('[FORCE-UPDATE-ALL] Error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
