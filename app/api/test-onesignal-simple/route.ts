import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { externalId } = await req.json();
    
    if (!externalId) {
      return NextResponse.json({ ok: false, error: "externalId required" }, { status: 400 });
    }

    const appId = process.env.ONESIGNAL_APP_ID 
      || process.env.ONE_SIGNAL_APP_ID 
      || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
    const apiKey = process.env.ONESIGNAL_API_KEY 
      || process.env.ONE_SIGNAL_REST_API_KEY 
      || process.env.ONESIGNAL_REST_API_KEY 
      || process.env.ONE_SIGNAL_API_KEY;

    if (!appId || !apiKey) {
      return NextResponse.json({ 
        ok: false, 
        error: "OneSignal not configured" 
      }, { status: 500 });
    }

    console.log(`Testing notification to external ID: ${externalId}`);

    // Test con include_external_user_ids (v1 API)
    const payload1 = {
      app_id: appId,
      include_external_user_ids: [externalId],
      headings: { it: "🧪 Test v1 API", en: "🧪 Test v1 API" },
      contents: { it: "Test con include_external_user_ids", en: "Test con include_external_user_ids" },
      data: { test: "v1_api", timestamp: new Date().toISOString() },
    };

    console.log('Testing v1 API payload:', JSON.stringify(payload1, null, 2));

    const response1 = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload1)
    });

    const result1 = await response1.json();
    console.log('v1 API response:', JSON.stringify(result1, null, 2));

    // Test con include_aliases (v2 API)
    const payload2 = {
      app_id: appId,
      include_aliases: { external_id: [externalId] },
      channel_for_external_user_ids: 'push',
      target_channel: 'push',
      headings: { it: "🧪 Test v2 API", en: "🧪 Test v2 API" },
      contents: { it: "Test con include_aliases", en: "Test con include_aliases" },
      data: { test: "v2_api", timestamp: new Date().toISOString() },
    };

    console.log('Testing v2 API payload:', JSON.stringify(payload2, null, 2));

    const response2 = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload2)
    });

    const result2 = await response2.json();
    console.log('v2 API response:', JSON.stringify(result2, null, 2));

    return NextResponse.json({
      ok: true,
      externalId,
      tests: {
        v1_api: {
          status: response1.status,
          success: response1.ok,
          result: result1
        },
        v2_api: {
          status: response2.status,
          success: response2.ok,
          result: result2
        }
      }
    });

  } catch (e: any) {
    console.error('Test error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 });
  }
}
