import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { dryRun = true } = await req.json();

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
        error: "OneSignal not configured" 
      }, { status: 500 });
    }

    // Get all unique external IDs from subscriptions
    const subscriptions = await prisma.subscription.findMany({
      select: { externalId: true },
      distinct: ['externalId']
    });

    const externalIds = subscriptions.map(s => s.externalId).filter(Boolean);
    console.log(`Found ${externalIds.length} unique external IDs to check`);

    const invalidIds: string[] = [];
    const validIds: string[] = [];

    // Check each external ID in batches
    const batchSize = 10;
    for (let i = 0; i < externalIds.length; i += batchSize) {
      const batch = externalIds.slice(i, i + batchSize);
      
      for (const externalId of batch) {
        try {
          // Test with a dummy notification to see if external ID is valid
          const testResponse = await fetch('https://onesignal.com/api/v1/notifications', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'Authorization': `Basic ${apiKey}`,
            },
            body: JSON.stringify({
              app_id: appId,
              include_aliases: { external_id: [externalId] },
              channel_for_external_user_ids: 'push',
              target_channel: 'push',
              headings: { it: "Test", en: "Test" },
              contents: { it: "Test validation", en: "Test validation" },
              send_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Send tomorrow (won't actually send)
            })
          });

          const testResult = await testResponse.json();
          
          if (testResult.errors?.invalid_aliases?.external_id?.includes(externalId)) {
            invalidIds.push(externalId);
            console.log(`Invalid external ID: ${externalId}`);
          } else {
            validIds.push(externalId);
            console.log(`Valid external ID: ${externalId}`);
          }
        } catch (e) {
          console.error(`Error checking ${externalId}:`, e);
        }
      }
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    let deletedCount = 0;
    if (!dryRun && invalidIds.length > 0) {
      // Delete subscriptions with invalid external IDs
      const deleteResult = await prisma.subscription.deleteMany({
        where: {
          externalId: { in: invalidIds }
        }
      });
      deletedCount = deleteResult.count;
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      totalChecked: externalIds.length,
      validIds: validIds.length,
      invalidIds: invalidIds.length,
      invalidIdsList: invalidIds,
      deletedCount,
      message: dryRun 
        ? "Dry run completed - no changes made" 
        : `Deleted ${deletedCount} subscriptions with invalid external IDs`
    });

  } catch (e: any) {
    console.error('Cleanup error:', e);
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 });
  }
}
