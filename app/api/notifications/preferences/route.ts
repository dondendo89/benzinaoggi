import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Get notification preferences for a user
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'anonymous';
    
    // For now, we'll return a simple structure
    // In a real implementation, you'd store preferences in the database
    return NextResponse.json({
      ok: true,
      preferences: {
        userId,
        enabled: true,
        distributors: [],
        fuels: []
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// POST - Save notification preferences and FCM token
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, preferences, fcmToken } = body;
    
    // Subscribe to FCM topics based on preferences
    if (fcmToken && preferences) {
      await subscribeToFCMTopics(fcmToken, preferences);
    }
    
    // For now, we'll just log the preferences
    // In a real implementation, you'd save to database
    console.log('Notification preferences saved:', { userId, preferences, fcmToken });
    
    return NextResponse.json({ ok: true, message: 'Preferences saved' });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

// Subscribe to FCM topics based on user preferences
async function subscribeToFCMTopics(fcmToken: string, preferences: any) {
  const serverKey = process.env.FIREBASE_SERVER_KEY;
  
  if (!serverKey) {
    console.warn('FIREBASE_SERVER_KEY not configured, skipping topic subscription');
    return;
  }
  
  const topics = ['price_drops']; // Base topic for all price drops
  
  // Add specific topics based on preferences
  if (preferences.type === 'fuel' && preferences.identifier) {
    topics.push(`fuel_${preferences.identifier.toLowerCase().replace(/\s+/g, '_')}`);
  }
  
  if (preferences.type === 'distributor' && preferences.identifier) {
    topics.push(`distributor_${preferences.identifier}`);
  }
  
  // Subscribe to each topic
  for (const topic of topics) {
    try {
      const response = await fetch(`https://iid.googleapis.com/iid/v1/${fcmToken}/rel/topics/${topic}`, {
        method: 'POST',
        headers: {
          'Authorization': `key=${serverKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log(`Successfully subscribed to topic: ${topic}`);
      } else {
        console.error(`Failed to subscribe to topic ${topic}:`, response.status);
      }
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
    }
  }
}
