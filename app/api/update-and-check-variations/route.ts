import { NextRequest, NextResponse } from "next/server";
import { updatePrezzi } from "@/src/services/mimit";
import { checkVariation } from "@/src/services/mimit";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minuti per operazione completa

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get('debug') === 'true';
    const useMiseApi = searchParams.get('useMiseApi') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    
    console.log('Starting complete update and variation check...');
    
    // Step 1: Aggiorna prezzi dal CSV
    console.log('Step 1: Updating prices from CSV...');
    const updateResult = await updatePrezzi(debug);
    
    // Step 2: Attendi un momento per il database
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 3: Controlla variazioni standard
    console.log('Step 2: Checking standard variations...');
    const standardVariations = await checkVariation({ verbose: true });
    
    let miseVariations = null;
    
    // Step 4: Se richiesto, controlla anche con API MISE
    if (useMiseApi) {
      console.log('Step 3: Checking MISE API variations...');
      try {
        const miseResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/check-mise-variations?limit=${limit}&onlyDown=true`, {
          headers: {
            'Authorization': `Bearer ${process.env.API_SECRET || 'your-secret'}`
          }
        });
        
        if (miseResponse.ok) {
          miseVariations = await miseResponse.json();
        }
      } catch (error) {
        console.warn('MISE API check failed:', error);
      }
    }
    
    // Step 5: Combina risultati
    const combinedVariations = [
      ...(standardVariations.variations || []),
      ...(miseVariations?.variations || [])
    ];
    
    // Rimuovi duplicati basati su impiantoId + fuelType + isSelfService
    const uniqueVariations = combinedVariations.filter((variation, index, self) => 
      index === self.findIndex(v => 
        v.impiantoId === variation.impiantoId && 
        v.fuelType === variation.fuelType && 
        v.isSelfService === variation.isSelfService
      )
    );
    
    return NextResponse.json({
      ok: true,
      summary: {
        csvUpdate: updateResult,
        standardVariations: standardVariations.variations?.length || 0,
        miseVariations: miseVariations?.variations?.length || 0,
        totalUniqueVariations: uniqueVariations.length
      },
      variations: uniqueVariations,
      standardCheck: standardVariations,
      miseCheck: miseVariations,
      timestamp: new Date().toISOString()
    });
    
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
