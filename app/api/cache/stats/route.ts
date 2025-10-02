import { NextRequest, NextResponse } from 'next/server';
import { cache } from '@/src/lib/cache';

export async function GET(req: NextRequest) {
  try {
    // Check if authorized (optional - you can remove this if you want public stats)
    const authHeader = req.headers.get('authorization');
    const isAuthorized = !process.env.API_SECRET || authHeader?.includes(process.env.API_SECRET);
    
    const stats = cache.getStats();
    const health = cache.isHealthy();
    
    // Basic stats for everyone
    const publicStats = {
      enabled: stats.enabled,
      hitRate: stats.hitRate,
      size: stats.size,
      healthy: health
    };
    
    // Detailed stats only for authorized requests
    const detailedStats = isAuthorized ? {
      ...stats,
      healthy: health,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    } : publicStats;
    
    return NextResponse.json({
      ok: true,
      cache: detailedStats,
      actions: isAuthorized ? {
        clear_cache: `POST ${req.nextUrl.origin}/api/cache/clear`,
        toggle_cache: `POST ${req.nextUrl.origin}/api/cache/toggle`,
        cleanup_cache: `POST ${req.nextUrl.origin}/api/cache/cleanup`
      } : undefined
    });
    
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to get cache stats'
    }, { status: 500 });
  }
}

// POST endpoints for cache management
export async function POST(req: NextRequest) {
  try {
    // Require authorization for cache management
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.API_SECRET;
    
    if (!expectedToken || !authHeader || !authHeader.includes(expectedToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    
    switch (action) {
      case 'clear':
        cache.clear();
        return NextResponse.json({
          ok: true,
          message: 'Cache cleared successfully',
          stats: cache.getStats()
        });
        
      case 'cleanup':
        const cleaned = cache.cleanup();
        return NextResponse.json({
          ok: true,
          message: `Cleaned up ${cleaned} expired items`,
          cleaned,
          stats: cache.getStats()
        });
        
      case 'toggle':
        const enabled = body.enabled ?? !cache.getStats().enabled;
        cache.setEnabled(enabled);
        return NextResponse.json({
          ok: true,
          message: `Cache ${enabled ? 'enabled' : 'disabled'}`,
          enabled,
          stats: cache.getStats()
        });
        
      case 'delete_pattern':
        const pattern = body.pattern;
        if (!pattern) {
          return NextResponse.json({ error: 'Pattern required' }, { status: 400 });
        }
        const deleted = cache.deletePattern(pattern);
        return NextResponse.json({
          ok: true,
          message: `Deleted ${deleted} items matching pattern: ${pattern}`,
          deleted,
          stats: cache.getStats()
        });
        
      default:
        return NextResponse.json({
          error: 'Invalid action. Use: clear, cleanup, toggle, delete_pattern'
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error managing cache:', error);
    return NextResponse.json({
      ok: false,
      error: 'Failed to manage cache'
    }, { status: 500 });
  }
}
