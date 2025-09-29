import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function json(data: unknown, init?: number | ResponseInit) {
	return NextResponse.json(data as any, init as any);
}

async function handleUpdate(req: NextRequest) {
	const appId = process.env.ONE_SIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
	const restKey = process.env.ONE_SIGNAL_REST_API_KEY || process.env.ONESIGNAL_REST_API_KEY;
	if (!appId || !restKey) {
		return json({ ok: false, error: 'Missing OneSignal credentials' }, { status: 500 });
	}

	let payload: any;
	try {
		payload = await req.json();
	} catch {
		return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
	}

	const { externalId, subscriptionId, body } = payload || {};
	if (!externalId || !subscriptionId) {
		return json({ ok: false, error: 'Missing externalId or subscriptionId' }, { status: 400 });
	}

	// 1) Ensure the user exists and is aliased by external_id (idempotent upsert)
	const ensureUserUrl = `https://api.onesignal.com/apps/${encodeURIComponent(appId)}/users/by/external_id/${encodeURIComponent(externalId)}`;
	const ensureUserRes = await fetch(ensureUserUrl, {
		method: 'PUT',
		headers: {
			'Authorization': `Basic ${restKey}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		// Empty object is sufficient to upsert the user keyed by external_id
		body: JSON.stringify({})
	});

	// 2) Update the specific subscription for that user
	const url = `https://api.onesignal.com/apps/${encodeURIComponent(appId)}/users/by/external_id/${encodeURIComponent(externalId)}/subscriptions/${encodeURIComponent(subscriptionId)}`;

	const method = req.method === 'PATCH' ? 'PATCH' : 'PUT';
	const res = await fetch(url, {
		method,
		headers: {
			'Authorization': `Basic ${restKey}`,
			'Content-Type': 'application/json',
			'Accept': 'application/json'
		},
		body: JSON.stringify(body || {})
	});

	let data: any = {};
	let ensured: any = {};
	try { ensured = await ensureUserRes.json(); } catch { ensured = { statusText: ensureUserRes.statusText }; }
	try { data = await res.json(); } catch { data = { statusText: res.statusText }; }
	return json({ ok: res.ok, status: res.status, ensured: { ok: ensureUserRes.ok, status: ensureUserRes.status, data: ensured }, data });
}

export async function PUT(req: NextRequest) {
	return handleUpdate(req);
}

export async function PATCH(req: NextRequest) {
	return handleUpdate(req);
}


