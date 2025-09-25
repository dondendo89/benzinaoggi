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
    const hasModel = !!(prisma as any).subscription;
    if (hasModel) {
      const rows = await (prisma as any).subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
      });
      return NextResponse.json({ ok: true, count: rows.length, rows });
    }
    // Fallback with raw SQL if client lacks model
    const clauses: string[] = [];
    const params: any[] = [];
    if (typeof where.impiantoId === 'number') { clauses.push('"impiantoId" = $1'); params.push(where.impiantoId); }
    if (typeof where.fuelType === 'string') { clauses.push(`"fuelType" = $${params.length+1}`); params.push(where.fuelType); }
    const whereSql = clauses.length ? ('WHERE ' + clauses.join(' AND ')) : '';
    const limitSql = `LIMIT ${Number.isFinite(take) ? take : 100}`;
    const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Subscription" ${whereSql} ORDER BY "createdAt" DESC ${limitSql}`, ...params);
    return NextResponse.json({ ok: true, count: (rows?.length || 0), rows: rows || [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


