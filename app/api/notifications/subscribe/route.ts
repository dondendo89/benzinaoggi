import { NextRequest, NextResponse } from "next/server";

// POST - Subscribe FCM token to a topic
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, topic } = body;
    
    if (!token || !topic) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Token and topic are required' 
      }, { status: 400 });
    }
    
    const serverKey = process.env.FIREBASE_SERVER_KEY;
    
    if (!serverKey) {
      return NextResponse.json({ 
        ok: false, 
        error: 'FIREBASE_SERVER_KEY not configured' 
      }, { status: 500 });
    }
    
    // Subscribe to topic using FCM REST API
    const response = await fetch(`https://iid.googleapis.com/iid/v1/${token}/rel/topics/${topic}`, {
      method: 'POST',
      headers: {
        'Authorization': `key=${serverKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log(`Successfully subscribed token to topic: ${topic}`);
      return NextResponse.json({ 
        ok: true, 
        message: `Subscribed to topic: ${topic}` 
      });
    } else {
      const errorText = await response.text();
      console.error(`Failed to subscribe to topic ${topic}:`, response.status, errorText);
      return NextResponse.json({ 
        ok: false, 
        error: `Failed to subscribe to topic: ${response.status}` 
      }, { status: response.status });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
