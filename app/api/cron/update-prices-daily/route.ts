import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { updatePrezzi } from "@/src/services/mimit";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minuti per compatibilità Vercel Hobby

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get('debug') === 'true';
    
    console.log(`[CRON] Starting daily price update (CSV) at ${new Date().toISOString()}`);
    
    // Esegui aggiornamento prezzi da CSV (MIMIT prezzo_alle_8.csv)
    const startTime = new Date().toISOString();
    const res = await updatePrezzi(!!debug);
    const endTime = new Date().toISOString();

    // Calcola lastUpdatedAt come il massimo communicatedAt dell'ultimo giorno aggiornato
    const lastUpdatedRow = await prisma.price.findFirst({
      where: { day: new Date(`${res.day}T00:00:00.000Z`) },
      orderBy: { communicatedAt: 'desc' },
      select: { communicatedAt: true }
    });
    const lastUpdatedAt = lastUpdatedRow?.communicatedAt?.toISOString() || endTime;

    console.log(`[CRON] CSV update completed: inserted=${res.inserted}, updated=${res.updated}, day=${res.day}`);
    
    return NextResponse.json({
      ok: true,
      job: 'daily_price_update_csv',
      summary: {
        inserted: res.inserted,
        updated: res.updated,
        total: res.total,
        skippedUnknownDistributor: res.skippedUnknownDistributor,
        skippedNoPrice: res.skippedNoPrice,
        skippedBadDate: res.skippedBadDate,
        day: res.day,
        startTime,
        endTime,
        lastUpdatedAt,
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
