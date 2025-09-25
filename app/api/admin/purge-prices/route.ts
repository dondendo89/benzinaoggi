import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

function assertBearer(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const secret = process.env.API_SECRET || process.env.NEXT_PUBLIC_API_SECRET || "";
  if (!secret || token !== secret) {
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  if (!assertBearer(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get("days");
    const days = Math.max(1, Math.min(3650, parseInt(daysParam || "60", 10)));
    const hard = (searchParams.get("hard") || "false").toLowerCase() === "true"; // optional VACUUM FULL

    // Delete old price rows
    const deletedPrices = await prisma.$executeRawUnsafe(
      `DELETE FROM "Price" WHERE day < (CURRENT_DATE - INTERVAL '${days} days')`
    );

    // Delete orphan distributors (no prices at all)
    const deletedOrphans = await prisma.$executeRawUnsafe(
      `DELETE FROM "Distributor" d WHERE NOT EXISTS (SELECT 1 FROM "Price" p WHERE p."distributorId" = d.id)`
    );

    // Run a light VACUUM ANALYZE (safe)
    await prisma.$executeRawUnsafe(`VACUUM (ANALYZE) "Price"`);
    await prisma.$executeRawUnsafe(`VACUUM (ANALYZE) "Distributor"`);

    // Optional: VACUUM FULL (blocks table); use only when requested
    if (hard) {
      await prisma.$executeRawUnsafe(`VACUUM FULL "Price"`);
      await prisma.$executeRawUnsafe(`VACUUM FULL "Distributor"`);
    }

    return NextResponse.json({ ok: true, deletedPrices, deletedOrphans, days, hard });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


