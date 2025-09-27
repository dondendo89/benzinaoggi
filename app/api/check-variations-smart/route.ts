import { NextRequest, NextResponse } from "next/server";
import { checkVariation } from "@/src/services/mimit";
import { prisma } from "@/src/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const onlyDown = searchParams.get('onlyDown') === 'true';
    const verbose = searchParams.get('verbose') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50');
    
    console.log('[SMART] Starting smart variation detection...');
    
    // Step 1: Try standard variation check
    console.log('[SMART] Step 1: Checking standard variations...');
    const standardResult = await checkVariation({ onlyDown, verbose: true });
    
    const standardVariations = standardResult.variations || [];
    const standardCount = standardVariations.length;
    
    console.log(`[SMART] Standard check found ${standardCount} variations`);
    
    // Step 2: If standard check found few variations, try MISE API
    let miseVariations = [];
    let miseCount = 0;
    
    if (standardCount < 5) { // Threshold for using MISE API
      console.log('[SMART] Step 2: Few standard variations found, trying MISE API...');
      
      try {
        const miseResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/check-mise-variations?limit=${limit}&onlyDown=${onlyDown}`, {
          headers: {
            'Authorization': `Bearer ${process.env.API_SECRET || 'your-secret'}`
          }
        });
        
        if (miseResponse.ok) {
          const miseData = await miseResponse.json();
          miseVariations = miseData.variations || [];
          miseCount = miseVariations.length;
          console.log(`[SMART] MISE API found ${miseCount} variations`);
        } else {
          console.log('[SMART] MISE API call failed:', miseResponse.status);
        }
      } catch (error) {
        console.log('[SMART] MISE API error:', error);
      }
    } else {
      console.log('[SMART] Step 2: Skipping MISE API (sufficient standard variations found)');
    }
    
    // Step 3: Combine results and remove duplicates
    const allVariations = [...standardVariations, ...miseVariations];
    
    // Remove duplicates based on impiantoId + fuelType + isSelfService
    const uniqueVariations = allVariations.filter((variation, index, self) => 
      index === self.findIndex(v => 
        v.impiantoId === variation.impiantoId && 
        v.fuelType === variation.fuelType && 
        v.isSelfService === variation.isSelfService
      )
    );
    
    const finalCount = uniqueVariations.length;
    console.log(`[SMART] Final result: ${finalCount} unique variations (${standardCount} standard + ${miseCount} MISE)`);
    
    // Determine the best method used
    const method = standardCount >= 5 ? 'standard' : (miseCount > standardCount ? 'mise' : 'combined');
    
    return NextResponse.json({
      ok: true,
      method,
      summary: {
        standardVariations: standardCount,
        miseVariations: miseCount,
        totalUniqueVariations: finalCount,
        duplicatesRemoved: allVariations.length - finalCount
      },
      variations: uniqueVariations,
      standardCheck: standardResult,
      miseUsed: miseCount > 0,
      recommendation: standardCount < 5 ? 
        'Consider using MISE API for better variation detection' : 
        'Standard comparison is working well'
    });
    
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
