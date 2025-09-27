import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, comparePrices, normalizeFuelName } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoId = parseInt(searchParams.get('impiantoId') || '58674');
    const force = searchParams.get('force') === 'true';
    
    // Ottieni distributore
    const distributor = await prisma.distributor.findUnique({
      where: { impiantoId }
    });
    
    if (!distributor) {
      return NextResponse.json({
        ok: false,
        error: `Distributore con impiantoId ${impiantoId} non trovato`
      });
    }
    
    // Ottieni dati MISE
    const miseData = await getMiseServiceArea(impiantoId);
    if (!miseData) {
      return NextResponse.json({
        ok: false,
        error: `Impossibile ottenere dati MISE per impiantoId ${impiantoId}`
      });
    }
    
    // Prezzi locali per oggi
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const localPrices = await prisma.price.findMany({
      where: {
        distributorId: distributor.id,
        day: today
      }
    });
    
    // Confronta prezzi
    const comparisons = comparePrices(localPrices, miseData.fuels);
    const changes = comparisons.filter(c => c.hasChanged);
    
    if (changes.length === 0 && !force) {
      return NextResponse.json({
        ok: true,
        message: 'Nessuna differenza rilevata tra prezzi locali e MISE',
        comparisons: comparisons,
        miseData: {
          name: miseData.name,
          brand: miseData.brand,
          fuels: miseData.fuels.map(f => ({
            name: f.name,
            price: f.price,
            isSelf: f.isSelf
          }))
        }
      });
    }
    
    // Aggiorna prezzi nel database
    const updatedPrices = [];
    const createdPrices = [];
    
    for (const fuel of miseData.fuels) {
      const normalizedFuel = normalizeFuelName(fuel.name);
      
      try {
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
        
        // Verifica se è stato creato o aggiornato
        const existing = localPrices.find(p => 
          p.fuelType === normalizedFuel && 
          p.isSelfService === fuel.isSelf
        );
        
        if (existing) {
          if (Math.abs(existing.price - fuel.price) > 0.001) {
            updatedPrices.push({
              fuelType: normalizedFuel,
              isSelfService: fuel.isSelf,
              oldPrice: existing.price,
              newPrice: fuel.price,
              difference: fuel.price - existing.price
            });
          }
        } else {
          createdPrices.push({
            fuelType: normalizedFuel,
            isSelfService: fuel.isSelf,
            price: fuel.price
          });
        }
        
      } catch (error) {
        console.error(`Error updating price for ${normalizedFuel}:`, error);
      }
    }
    
    return NextResponse.json({
      ok: true,
      distributor: {
        id: distributor.id,
        impiantoId: distributor.impiantoId,
        bandiera: distributor.bandiera
      },
      miseData: {
        name: miseData.name,
        brand: miseData.brand,
        address: miseData.address
      },
      changes: changes,
      updatedPrices,
      createdPrices,
      summary: {
        totalMiseFuels: miseData.fuels.length,
        updatedCount: updatedPrices.length,
        createdCount: createdPrices.length,
        changesDetected: changes.length
      }
    });
    
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
