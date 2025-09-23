import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET() {
  try {
    const distributors = await prisma.distributor.findMany({
      select: { id: true, impiantoId: true, gestore: true, bandiera: true, comune: true, provincia: true },
      orderBy: { id: 'asc' },
      take: 50000,
    });
    return NextResponse.json({ ok: true, count: distributors.length, distributors });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


