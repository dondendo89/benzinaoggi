import { NextRequest, NextResponse } from 'next/server';

// Deletes OneSignal users (players) in batches using REST API v1
// Safety:
// - Requires ADMIN token via Authorization: Bearer <token> or ?token=...
// - Supports dryRun (no deletions) and offset for pagination

const ONESIGNAL_API_BASE = 'https://api.onesignal.com';

function json(data: unknown, init?: number | ResponseInit) {
  return NextResponse.json(data as any, init as any);
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const tokenFromHeader = req.headers.get('authorization');
    const tokenFromQuery = url.searchParams.get('token') || undefined;
    const dryRun = (url.searchParams.get('dryRun') || 'false').toLowerCase() === 'true';
    const offsetParam = url.searchParams.get('offset');
    const limitParam = url.searchParams.get('limit');

    const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.BENZINAOGGI_ADMIN_TOKEN;
    const ONE_SIGNAL_APP_ID = process.env.ONE_SIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    const ONE_SIGNAL_REST_API_KEY = process.env.ONE_SIGNAL_REST_API_KEY || process.env.ONESIGNAL_REST_API_KEY;

    // Auth check
    const bearer = tokenFromHeader && tokenFromHeader.toLowerCase().startsWith('bearer ')
      ? tokenFromHeader.slice(7)
      : undefined;
    if (!ADMIN_TOKEN || (bearer !== ADMIN_TOKEN && tokenFromQuery !== ADMIN_TOKEN)) {
      return json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!ONE_SIGNAL_APP_ID || !ONE_SIGNAL_REST_API_KEY) {
      return json({ ok: false, error: 'Missing OneSignal credentials' }, { status: 500 });
    }

    const limit = Math.min(Math.max(Number(limitParam) || 300, 50), 300); // OneSignal max 300
    const offset = Math.max(Number(offsetParam) || 0, 0);

    // Fetch a page of players
    const listUrl = `${ONESIGNAL_API_BASE}/players?app_id=${encodeURIComponent(ONE_SIGNAL_APP_ID)}&limit=${limit}&offset=${offset}`;
    const listRes = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    if (!listRes.ok) {
      const errBody = await safeJson(listRes);
      return json({ ok: false, step: 'list', status: listRes.status, onesignal: errBody }, { status: 502 });
    }

    const listJson = await listRes.json() as { players?: Array<{ id: string }>, total_count?: number };
    const players = Array.isArray(listJson.players) ? listJson.players : [];
    const totalCount = typeof listJson.total_count === 'number' ? listJson.total_count : undefined;

    let deleted = 0;
    const errors: Array<{ id: string; status: number; error?: unknown }> = [];

    if (!dryRun) {
      // Delete all in this page sequentially to avoid rate limits; you can parallelize with care if needed
      for (const p of players) {
        if (!p || !p.id) continue;
        const delUrl = `${ONESIGNAL_API_BASE}/players/${encodeURIComponent(p.id)}?app_id=${encodeURIComponent(ONE_SIGNAL_APP_ID)}`;
        const delRes = await fetch(delUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${ONE_SIGNAL_REST_API_KEY}`,
            'Accept': 'application/json'
          }
        });
        if (delRes.ok) {
          deleted += 1;
        } else {
          const e = await safeJson(delRes);
          errors.push({ id: p.id, status: delRes.status, error: e });
        }
      }
    }

    const nextOffset = offset + players.length;
    const hasMore = players.length === limit;

    return json({
      ok: true,
      dryRun,
      limit,
      offset,
      processed: players.length,
      deleted,
      errorsCount: errors.length,
      errors,
      nextOffset,
      hasMore,
      totalCount
    });
  } catch (err: any) {
    return json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}

async function safeJson(res: Response) {
  try { return await res.json(); } catch { return { statusText: res.statusText }; }
}


