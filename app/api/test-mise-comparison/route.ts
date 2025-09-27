import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { getMiseServiceArea, comparePrices } from "@/src/services/mise-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoId = parseInt(searchParams.get('impiantoId') || '58674');
    
    // Ottieni distributore dal database
    const distributor = await prisma.distributor.findUnique({
      where: { impiantoId },
      include: {
        prices: {
          where: {
            day: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Ultimi 7 giorni
            }
          },
          orderBy: { day: 'desc' },
          take: 10
        }
      }
    });
    
    if (!distributor) {
      return NextResponse.json({
        ok: false,
        error: `Distributore con impiantoId ${impiantoId} non trovato nel database`
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
      },
      select: {
        fuelType: true,
        price: true,
        isSelfService: true,
        communicatedAt: true
      }
    });
    
    // Confronta prezzi
    const comparisons = comparePrices(localPrices, miseData.fuels);
    
    return NextResponse.json({
      ok: true,
      distributor: {
        id: distributor.id,
        impiantoId: distributor.impiantoId,
        bandiera: distributor.bandiera,
        comune: distributor.comune
      },
      miseData: {
        name: miseData.name,
        brand: miseData.brand,
        address: miseData.address,
        fuelsCount: miseData.fuels.length,
        fuels: miseData.fuels.map(f => ({
          name: f.name,
          price: f.price,
          isSelf: f.isSelf,
          insertDate: f.insertDate,
          validityDate: f.validityDate
        }))
      },
      localPrices: localPrices.map(p => ({
        fuelType: p.fuelType,
        price: p.price,
        isSelfService: p.isSelfService,
        communicatedAt: p.communicatedAt
      })),
      comparisons: comparisons,
      changes: comparisons.filter(c => c.hasChanged),
      summary: {
        localPricesCount: localPrices.length,
        misePricesCount: miseData.fuels.length,
        changesCount: comparisons.filter(c => c.hasChanged).length,
        lastLocalUpdate: localPrices.length > 0 ? localPrices[0].communicatedAt : null,
        miseUpdateTime: miseData.fuels.length > 0 ? miseData.fuels[0].insertDate : null
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
