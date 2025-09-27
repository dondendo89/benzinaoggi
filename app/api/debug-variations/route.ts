import { NextRequest, NextResponse } from "next/server";
import { checkVariation } from "@/src/services/mimit";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const verbose = searchParams.get('verbose') === 'true';
    
    // Get database stats
    const totalPrices = await prisma.price.count();
    const uniqueDays = await prisma.price.findMany({
      select: { day: true },
      distinct: ['day'],
      orderBy: { day: 'desc' },
      take: 10
    });
    
    const latestDay = uniqueDays[0]?.day;
    const pricesToday = latestDay ? await prisma.price.count({ where: { day: latestDay } }) : 0;
    
    // Get variations with verbose output
    const variations = await checkVariation({ verbose: true });
    
    return NextResponse.json({
      ok: true,
      debug: {
        totalPrices,
        uniqueDays: uniqueDays.map(d => d.day),
        latestDay,
        pricesToday,
        variations
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
