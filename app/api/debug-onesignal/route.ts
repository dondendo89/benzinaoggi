import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const appId = process.env.ONESIGNAL_APP_ID 
    || process.env.ONE_SIGNAL_APP_ID 
    || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY 
    || process.env.ONE_SIGNAL_REST_API_KEY 
    || process.env.ONESIGNAL_REST_API_KEY 
    || process.env.ONE_SIGNAL_API_KEY;

  return NextResponse.json({
    appIdPresent: !!appId,
    apiKeyPresent: !!apiKey,
    appIdLength: appId?.length || 0,
    apiKeyLength: apiKey?.length || 0,
    envVars: Object.keys(process.env).filter(k => 
      k.includes('ONESIGNAL') || k.includes('ONE_SIGNAL')
    )
  });
}
