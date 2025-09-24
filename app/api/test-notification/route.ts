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

    // Simulate notification (without actually sending)
    const notificationData = {
      title: `💰 Prezzo ${fuelType} sceso!`,
      message: `${distributorName || 'Distributore'}: ${fuelType} da €${oldPrice.toFixed(3)} a €${newPrice.toFixed(3)} (-${percentageDiff}%)`,
      fuelType,
      distributorId,
      oldPrice,
      newPrice,
      priceDiff,
      percentageDiff,
      url: `${process.env.WORDPRESS_URL}/distributore-${distributorId}`,
      timestamp: new Date().toISOString()
    };

    console.log('Test notification data:', notificationData);
    
    return NextResponse.json({
      ok: true,
      message: "Test notification prepared successfully",
      notification: notificationData,
      note: "This is a test - no actual notification was sent"
    });

  } catch (error: any) {
    console.error('Test notification error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
