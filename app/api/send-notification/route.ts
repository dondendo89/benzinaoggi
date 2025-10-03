import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { fuelType, distributorId, oldPrice, newPrice, distributorName, externalIds } = await req.json();

    // Validate required fields
    if (!fuelType || !distributorId || oldPrice === undefined || newPrice === undefined) {
      return NextResponse.json(
        { ok: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Resolve OneSignal configuration with fallbacks
    const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '';
    const apiKey = process.env.ONESIGNAL_API_KEY || process.env.ONESIGNAL_REST_API_KEY || '';
    const wpUrl = process.env.WORDPRESS_URL || '';
    if (!appId || !apiKey) {
      console.error('OneSignal configuration missing:', {
        appIdPresent: !!appId,
        apiKeyPresent: !!apiKey,
      });
      return NextResponse.json(
        { ok: false, error: "OneSignal not configured" },
        { status: 500 }
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

    // Build OneSignal notification payload
    const notificationPayload: Record<string, any> = {
      app_id: appId,
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
      url: wpUrl ? `${wpUrl.replace(/\/$/, '')}/distributore-${distributorId}` : undefined,
      chrome_web_icon: "https://carburanti.mise.gov.it/favicon.ico"
    };

    // Targeting: usa SEMPRE external_id. Se non forniti, risolvi da DB per impianto+carburante
    let resolvedExternalIds: string[] = Array.isArray(externalIds) ? externalIds.filter(Boolean) : [];
    if (resolvedExternalIds.length === 0) {
      try {
        const impiantoId = Number(distributorId);
        const fuel = String(fuelType || "").trim().replace(/\s+/g, " ");
        const rows = await prisma.subscription.findMany({
          where: { impiantoId, fuelType: fuel },
          select: { externalId: true }
        });
        resolvedExternalIds = rows.map(r => r.externalId).filter(Boolean);
      } catch {}
    }

    if (resolvedExternalIds.length === 0) {
      return NextResponse.json({ ok: true, message: "Nessun destinatario (externalId)" });
    }

    notificationPayload.include_aliases = { external_id: resolvedExternalIds };
    notificationPayload.target_channel = 'push';

    // Send notification via OneSignal API
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${apiKey}`
      },
      body: JSON.stringify(notificationPayload)
    });

    let result: any = null;
    let resultText: string | null = null;
    try {
      result = await response.json();
    } catch {
      try {
        resultText = await response.text();
      } catch {
        resultText = null;
      }
    }

    if (!response.ok) {
      console.error('OneSignal API error:', {
        status: response.status,
        statusText: response.statusText,
        body: result || resultText
      });
      return NextResponse.json(
        { ok: false, status: response.status, statusText: response.statusText, onesignal: result || resultText },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Notification sent successfully",
      notificationId: result?.id,
      recipients: result?.recipients,
      onesignal: result
    });

  } catch (error: any) {
    console.error('Send notification error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

