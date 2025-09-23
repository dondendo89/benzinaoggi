import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { fuelType, distributorId, oldPrice, newPrice, distributorName } = await req.json();

    // Validate required fields
    if (!fuelType || !distributorId || oldPrice === undefined || newPrice === undefined) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if price actually decreased
    if (newPrice >= oldPrice) {
      return NextResponse.json(
        { ok: false, error: "Price did not decrease" },
        { status: 400 }
      );
    }

    const priceDiff = oldPrice - newPrice;
    const percentageDiff = ((priceDiff / oldPrice) * 100).toFixed(1);

    // Create notification message
    const title = `💰 Prezzo ${fuelType} sceso!`;
    const message = `${distributorName || 'Distributore'}: ${fuelType} da €${oldPrice.toFixed(3)} a €${newPrice.toFixed(3)} (-${percentageDiff}%)`;

    // OneSignal notification payload
    const notificationPayload = {
      app_id: process.env.ONESIGNAL_APP_ID,
      included_segments: ["Subscribed Users"],
      filters: [
        { field: "tag", key: "price_drop_notifications", relation: "=", value: "1" },
        { field: "tag", key: "fuel_type", relation: "=", value: fuelType }
      ],
      headings: { en: title, it: title },
      contents: { en: message, it: message },
      data: {
        fuelType,
        distributorId,
        oldPrice,
        newPrice,
        priceDiff,
        percentageDiff
      },
      url: `${process.env.WORDPRESS_URL}/distributore-${distributorId}`,
      chrome_web_icon: "https://carburanti.mise.gov.it/favicon.ico"
    };

    // Send notification via OneSignal API
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`
      },
      body: JSON.stringify(notificationPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OneSignal API error:', errorText);
      return NextResponse.json(
        { ok: false, error: "Failed to send notification" },
        { status: 500 }
      );
    }

    const result = await response.json();
    
    return NextResponse.json({
      ok: true,
      notificationId: result.id,
      recipients: result.recipients,
      message: "Notification sent successfully"
    });

  } catch (error: any) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
