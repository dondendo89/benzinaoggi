import { NextRequest, NextResponse } from 'next/server';
import { normalizeFuelName } from '@/src/services/mise-api';

export async function GET(req: NextRequest) {
  try {
    const testFuels = [
      'Benzina',
      'Gasolio', 
      'HiQ Perform+',
      'HVO',
      'GPL',
      'Metano'
    ];

    const results = testFuels.map(fuel => ({
      original: fuel,
      normalized: normalizeFuelName(fuel)
    }));

    return NextResponse.json({
      ok: true,
      testResults: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
