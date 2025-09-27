import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'setup';
    
    if (action === 'setup') {
      // Istruzioni per configurare il cron job
      return NextResponse.json({
        ok: true,
        message: 'Cron job configuration instructions',
        instructions: {
          platform: 'Vercel Cron Jobs',
          steps: [
            '1. Go to Vercel Dashboard > Project Settings > Functions',
            '2. Add environment variable: CRON_SECRET=your-secret-key',
            '3. Create vercel.json with cron configuration',
            '4. Deploy the project'
          ],
          vercelJson: {
            "crons": [
              {
                "path": "/api/cron/update-prices-daily",
                "schedule": "0 6 * * *"
              }
            ]
          },
          webhookUrl: `${process.env.VERCEL_URL || 'https://your-domain.vercel.app'}/api/cron/update-prices-daily`,
          schedule: 'Every day at 6:00 AM UTC',
          parameters: {
            limit: '1000',
            force: 'false',
            dryRun: 'false'
          }
        }
      });
    }
    
    if (action === 'test') {
      // Test del cron job
      const testUrl = `${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/update-prices-daily?limit=10&dryRun=true`;
      
      return NextResponse.json({
        ok: true,
        message: 'Test cron job configuration',
        testUrl,
        instructions: [
          '1. Run this URL to test the cron job',
          '2. Check the response for any errors',
          '3. Verify that prices are being updated correctly'
        ]
      });
    }
    
    if (action === 'status') {
      // Status del cron job
      return NextResponse.json({
        ok: true,
        message: 'Cron job status',
        status: 'configured',
        schedule: '0 6 * * * (Every day at 6:00 AM UTC)',
        endpoint: '/api/cron/update-prices-daily',
        lastRun: 'Not available (check Vercel logs)',
        nextRun: 'Next scheduled run at 6:00 AM UTC tomorrow'
      });
    }
    
    return NextResponse.json({
      ok: false,
      error: 'Invalid action. Use: setup, test, or status'
    });
    
  } catch (e: any) {
    return NextResponse.json({ 
      ok: false, 
      error: String(e?.message || e) 
    }, { status: 500 });
  }
}
