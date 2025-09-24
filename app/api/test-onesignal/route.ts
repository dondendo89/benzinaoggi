import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Check if OneSignal is configured
    const hasAppId = !!process.env.ONESIGNAL_APP_ID;
    const hasApiKey = !!process.env.ONESIGNAL_API_KEY;
    const hasWordPressUrl = !!process.env.WORDPRESS_URL;

    return NextResponse.json({
      ok: true,
      configured: hasAppId && hasApiKey,
      details: {
        oneSignalAppId: hasAppId,
        oneSignalApiKey: hasApiKey,
        wordpressUrl: hasWordPressUrl,
        appId: process.env.ONESIGNAL_APP_ID ? 'Set' : 'Missing',
        apiKey: process.env.ONESIGNAL_API_KEY ? 'Set' : 'Missing',
        wordpressUrl: process.env.WORDPRESS_URL || 'Missing'
      }
    });

  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
