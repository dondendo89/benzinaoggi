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


