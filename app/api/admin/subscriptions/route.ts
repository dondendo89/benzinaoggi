import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const expected = process.env.API_SECRET || '';
    if (!expected || token !== expected) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const impiantoId = searchParams.get('impiantoId');
    const fuelType = searchParams.get('fuelType');
    const take = Math.min(Number(searchParams.get('take') || '100'), 500);
    const where: any = {};
    if (impiantoId) where.impiantoId = Number(impiantoId);
    if (fuelType) where.fuelType = String(fuelType);
    const rows = await (prisma as any).subscription.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
    return NextResponse.json({ ok: true, count: rows.length, rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


