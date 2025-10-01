import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { updatePrezzi } from "@/src/services/mimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const debug = searchParams.get('debug') === 'true';

    // Esegue l'aggiornamento prezzi utilizzando il CSV MIMIT
    const startTime = new Date().toISOString();
    const res = await updatePrezzi(!!debug);
    const endTime = new Date().toISOString();

    // Calcola lastUpdatedAt come massimo communicatedAt del giorno aggiornato
    const lastUpdatedRow = await prisma.price.findFirst({
      where: { day: new Date(`${res.day}T00:00:00.000Z`) },
      orderBy: { communicatedAt: 'desc' },
      select: { communicatedAt: true }
    });
    const lastUpdatedAt = lastUpdatedRow?.communicatedAt?.toISOString() || endTime;

    return NextResponse.json({
      ok: true,
      job: 'sync_price_update_csv',
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
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e),
      stack: e?.stack 
    }, { status: 500 });
  }
}
