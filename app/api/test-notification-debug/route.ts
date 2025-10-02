import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { externalId, title, message } = await req.json();
    
    if (!externalId) {
      return NextResponse.json({ ok: false, error: "externalId required" }, { status: 400 });
    }

    // OneSignal configuration
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
        error: "OneSignal not configured",
        debug: {
          appIdPresent: !!appId,
          apiKeyPresent: !!apiKey,
          envVars: Object.keys(process.env).filter(k => k.includes('ONESIGNAL') || k.includes('ONE_SIGNAL'))
        }
      }, { status: 500 });
    }

    const testTitle = title || "🧪 Test Notifica BenzinaOggi";
    const testMessage = message || "Questa è una notifica di test per verificare il funzionamento";

    console.log(`Sending test notification to ${externalId}`);
    console.log(`Title: ${testTitle}`);
    console.log(`Message: ${testMessage}`);

    const payload = {
      app_id: appId,
      include_aliases: { external_id: [externalId] },
      channel_for_external_user_ids: 'push',
      target_channel: 'push',
      headings: { it: testTitle, en: testTitle },
      contents: { it: testMessage, en: testMessage },
      data: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    };

    console.log('OneSignal payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload)
    });

    const responseData = await response.json();
    
    console.log(`OneSignal response status: ${response.status}`);
    console.log('OneSignal response:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        error: `OneSignal HTTP ${response.status}`,
        oneSignalResponse: responseData,
        payload: payload
      }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      externalId,
      title: testTitle,
      message: testMessage,
      oneSignalResponse: responseData,
      payload: payload
    });

  } catch (e: any) {
    console.error('Test notification error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 });
  }
}
