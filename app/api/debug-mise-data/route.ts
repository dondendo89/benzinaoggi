import { NextRequest, NextResponse } from 'next/server';
import { getMiseServiceArea, normalizeFuelName } from '@/src/services/mise-api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoId = parseInt(searchParams.get('impiantoId') || '58674');
    
    // Ottieni dati MISE
    const miseData = await getMiseServiceArea(impiantoId);
    if (!miseData) {
      return NextResponse.json({
        ok: false,
        error: 'No MISE data available'
      });
    }

    // Analizza ogni carburante
    const fuelAnalysis = miseData.fuels.map(fuel => ({
      original: fuel.name,
      normalized: normalizeFuelName(fuel.name),
      price: fuel.price,
      isSelf: fuel.isSelf,
      fuelId: fuel.fuelId
    }));

    return NextResponse.json({
      ok: true,
      impiantoId,
      miseData: {
        name: miseData.name,
        brand: miseData.brand,
        address: miseData.address
      },
      fuelAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
