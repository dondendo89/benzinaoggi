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
    
    // Confronta rispetto all'ultimo DB (qualsiasi giorno) e upsert su oggi
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let updatedCount = 0;
    let createdCount = 0;
    for (const fuel of miseData.fuels) {
      const normalizedFuel = normalizeFuelName(fuel.name);
      const existingLatest = await prisma.price.findFirst({
        where: {
          distributorId: distributor.id,
          fuelType: normalizedFuel,
          isSelfService: fuel.isSelf
        },
        orderBy: { day: 'desc' }
      });
      const hasChanged = !existingLatest || Math.abs(existingLatest.price - fuel.price) > 0.001;
      if (!hasChanged && !force) continue;
      await prisma.price.upsert({
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
        if (Math.abs(existingLatest.price - fuel.price) > 0.001) updatedCount++;
      } else {
        createdCount++;
      }
    }
    return NextResponse.json({ ok: true, updated: updatedCount, created: createdCount });
    
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
