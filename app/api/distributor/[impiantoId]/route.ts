import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest, { params }: { params: { impiantoId: string } }) {
  try {
    const impiantoId = Number(params.impiantoId);
    if (!Number.isFinite(impiantoId)) {
      return NextResponse.json({ ok: false, error: 'Invalid impiantoId' }, { status: 400 });
    }
    const distributor = await prisma.distributor.findUnique({ where: { impiantoId } });
    if (!distributor) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

    // latest day
    const lastDayRow = await prisma.price.findFirst({ select: { day: true }, orderBy: { day: 'desc' } });
    const day = lastDayRow?.day;
    const prices = day ? await prisma.price.findMany({ where: { distributorId: distributor.id, day } }) : [];

    return NextResponse.json({ ok: true, distributor, day, prices });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


