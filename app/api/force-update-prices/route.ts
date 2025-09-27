import { NextRequest, NextResponse } from "next/server";
import { updatePrezzi } from "@/src/services/mimit";
import { checkVariation } from "@/src/services/mimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Force update prices first
    console.log('Starting forced price update...');
    const updateResult = await updatePrezzi(true); // debug mode
    
    // Wait a moment for database to settle
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check variations immediately after update
    console.log('Checking variations after update...');
    const variations = await checkVariation({ verbose: true });
    
    return NextResponse.json({ 
      ok: true, 
      update: updateResult,
      variations: variations,
      message: 'Prices updated and variations checked'
    });
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
