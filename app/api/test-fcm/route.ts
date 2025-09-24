import { NextRequest, NextResponse } from "next/server";

// GET - Test FCM configuration
export async function GET(req: NextRequest) {
  try {
    const serverKey = process.env.FIREBASE_SERVER_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    
    // Check if we have the required environment variables
    const config = {
      hasServerKey: !!serverKey,
      hasProjectId: !!projectId,
      hasApiKey: !!apiKey,
      serverKeyLength: serverKey?.length || 0,
      serverKeyPrefix: serverKey?.substring(0, 10) || 'N/A',
      projectId: projectId || 'N/A',
      apiKey: apiKey?.substring(0, 20) + '...' || 'N/A'
    };
    
    // Test FCM API with a simple request
    if (serverKey && projectId) {
      try {
        const testPayload = {
          to: '/topics/test',
          notification: {
            title: 'Test Notification',
            body: 'This is a test notification'
          }
        };
        
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Authorization': `key=${serverKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testPayload)
        });
        
        const responseText = await response.text();
        
        config.fcmTest = {
          status: response.status,
          statusText: response.statusText,
          response: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : ''),
          success: response.ok
        };
      } catch (error: any) {
        config.fcmTest = {
          error: error.message,
          success: false
        };
      }
    }
    
    return NextResponse.json({
      ok: true,
      config,
      message: 'FCM configuration test completed'
    });
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 });
  }
}
