import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const resHeaders = new Headers();
  const origin = req.headers.get('origin') || '*';

  resHeaders.set('Access-Control-Allow-Origin', origin);
  resHeaders.set('Vary', 'Origin');
  resHeaders.set('Access-Control-Allow-Credentials', 'true');
  resHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  resHeaders.set('Access-Control-Allow-Headers', req.headers.get('access-control-request-headers') || 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: resHeaders });
  }

  // Bearer auth for protected API routes
  try {
    const pathname = req.nextUrl.pathname;
    const protectedPaths = new Set([
      '/api/update-anagrafica',
      '/api/update-prezzi',
      '/api/distributors-all',
      '/api/check-variation',
    ]);
    if (protectedPaths.has(pathname)) {
      const auth = req.headers.get('authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      const expected = process.env.API_SECRET || '';
      if (!expected || token !== expected) {
        const errorHeaders = new Headers();
        resHeaders.forEach((value, key) => errorHeaders.set(key, value));
        return new NextResponse(
          JSON.stringify({ ok: false, error: 'Unauthorized' }),
          { status: 401, headers: errorHeaders }
        );
      }
    }
  } catch {
    // fallthrough; default to next() which will likely 500 if misconfigured
  }

  const res = NextResponse.next();
  res.headers.set('Access-Control-Allow-Origin', origin);
  res.headers.set('Vary', 'Origin');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', req.headers.get('access-control-request-headers') || 'Content-Type, Authorization');
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};


