import { NextRequest, NextResponse } from "next/server";

// POST - Send simple notification (browser native + localStorage)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      impiantoId, 
      distributorId, 
      fuelType, 
      distributorName, 
      oldPrice, 
      newPrice, 
      direction 
    } = body;
    
    // Only send notifications for price drops
    if (direction !== 'down') {
      return NextResponse.json({ 
        ok: true, 
        message: 'Skipped notification (price went up)' 
      });
    }
    
    const priceDiff = oldPrice - newPrice;
    const percentageDiff = oldPrice > 0 ? (priceDiff / oldPrice) * 100 : 0;
    
    const title = `💰 Prezzo ${fuelType} sceso!`;
    const message = `${distributorName}: ${fuelType} da €${oldPrice.toFixed(3)} a €${newPrice.toFixed(3)} (-${percentageDiff.toFixed(1)}%)`;
    
    // For now, we'll just log the notification
    // In a real implementation, you would:
    // 1. Store the notification in a database
    // 2. Send it via WebSocket to connected clients
    // 3. Or use a different push service
    
    console.log('📱 Notification would be sent:', {
      title,
      message,
      target: { impiantoId, distributorId, fuelType },
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Notification logged (FCM not configured)',
      notification: {
        title,
        message,
        target: { impiantoId, distributorId, fuelType },
        timestamp: new Date().toISOString()
      }
    });
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 });
  }
}
