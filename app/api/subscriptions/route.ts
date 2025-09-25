import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoId = Number(searchParams.get("impiantoId"));
    const fuelType = searchParams.get("fuelType") || undefined;
    if (!impiantoId || !fuelType) {
      return NextResponse.json({ ok: false, error: "Missing impiantoId or fuelType" }, { status: 400 });
    }
    const subs = await (prisma as any).subscription.findMany({
      where: { impiantoId, fuelType },
      select: { externalId: true },
    });
    return NextResponse.json({ ok: true, externalIds: subs.map((s: { externalId: string }) => s.externalId) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body?.action || "add"); // add | remove
    const externalId = String(body?.externalId || "").trim();
    const impiantoId = Number(body?.impiantoId);
    const fuelType = String(body?.fuelType || "").trim();
    if (!externalId || !impiantoId || !fuelType) {
      return NextResponse.json({ ok: false, error: "Missing externalId|impiantoId|fuelType" }, { status: 400 });
    }

    if (action === "remove") {
      await (prisma as any).subscription.deleteMany({ where: { externalId, impiantoId, fuelType } });
      return NextResponse.json({ ok: true, removed: true });
    }
    await (prisma as any).subscription.upsert({
      where: { Subscription_unique: { externalId, impiantoId, fuelType } },
      update: {},
      create: { externalId, impiantoId, fuelType },
    });
    return NextResponse.json({ ok: true, saved: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


