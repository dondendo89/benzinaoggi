import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const impiantoId = Number(searchParams.get("impiantoId"));
    const fuelType = searchParams.get("fuelType") || undefined;
    const externalIdFilter = (searchParams.get("externalId") || '').trim();
    if (!impiantoId || !fuelType) {
      return NextResponse.json({ ok: false, error: "Missing impiantoId or fuelType" }, { status: 400 });
    }
    const hasModel = !!(prisma as any).subscription;
    if (hasModel) {
      const subs = await (prisma as any).subscription.findMany({
        where: { impiantoId, fuelType },
        select: { externalId: true },
      });
      const externalIds = subs.map((s: { externalId: string }) => s.externalId);
      const isSubscribed = externalIdFilter ? externalIds.includes(externalIdFilter) : undefined;
      return NextResponse.json({ ok: true, externalIds, isSubscribed });
    }
    // Fallback: raw SQL (when generated client lacks Subscription model)
    const rows = await prisma.$queryRaw<{ externalId: string }[]>`SELECT "externalId" FROM "Subscription" WHERE "impiantoId" = ${impiantoId} AND "fuelType" = ${fuelType} ORDER BY "createdAt" DESC`;
    const externalIds = rows.map(r => r.externalId);
    let isSubscribed: boolean | undefined = undefined;
    if (externalIdFilter) {
      const existRows = await prisma.$queryRaw<{ exists: boolean }[]>`SELECT EXISTS(SELECT 1 FROM "Subscription" WHERE "impiantoId" = ${impiantoId} AND "fuelType" = ${fuelType} AND "externalId" = ${externalIdFilter}) as exists`;
      isSubscribed = !!(existRows && existRows[0] && (existRows[0] as any).exists);
    }
    return NextResponse.json({ ok: true, externalIds, isSubscribed });
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

    const hasModel = !!(prisma as any).subscription;
    if (action === "remove") {
      if (hasModel) {
        await (prisma as any).subscription.deleteMany({ where: { externalId, impiantoId, fuelType } });
      } else {
        await prisma.$executeRaw`DELETE FROM "Subscription" WHERE "externalId" = ${externalId} AND "impiantoId" = ${impiantoId} AND "fuelType" = ${fuelType}`;
      }
      return NextResponse.json({ ok: true, removed: true });
    }
    if (hasModel) {
      await (prisma as any).subscription.upsert({
        where: { Subscription_unique: { externalId, impiantoId, fuelType } },
        update: {},
        create: { externalId, impiantoId, fuelType },
      });
    } else {
      await prisma.$executeRaw`INSERT INTO "Subscription" ("externalId", "impiantoId", "fuelType") VALUES (${externalId}, ${impiantoId}, ${fuelType}) ON CONFLICT ("externalId", "impiantoId", "fuelType") DO NOTHING`;
    }
    // Also upsert OneSignal user by externalId to ensure alias exists
    try {
      const appId = process.env.ONE_SIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      const restKey = process.env.ONE_SIGNAL_REST_API_KEY || process.env.ONESIGNAL_REST_API_KEY;
      if (appId && restKey) {
        const url = `https://api.onesignal.com/apps/${encodeURIComponent(appId)}/users/by/external_id/${encodeURIComponent(externalId)}`;
        const r = await fetch(url, {
          method: 'PUT',
          headers: { 'Authorization': `Basic ${restKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({})
        });
        // If not found, try to CREATE the user explicitly with identity.external_id
        if (r.status === 404) {
          const createUrl = `https://api.onesignal.com/apps/${encodeURIComponent(appId)}/users`;
          const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${restKey}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ identity: { external_id: externalId } })
          });
          const created = await (async () => { try { return await createRes.json(); } catch { return { statusText: createRes.statusText }; } })();
          return NextResponse.json({ ok: true, saved: true, onesignal: { ok: createRes.ok, status: createRes.status, created } });
        }
        const ensured = await (async () => { try { return await r.json(); } catch { return { statusText: r.statusText }; } })();
        return NextResponse.json({ ok: true, saved: true, onesignal: { ok: r.ok, status: r.status, ensured } });
      }
    } catch(_e) {
      // swallow OneSignal errors to not block DB save
    }
    return NextResponse.json({ ok: true, saved: true, onesignal: { ok: false, skipped: true } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}


