import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const destination = new URL(request.url);
  if (destination.hostname !== 'cairoclothes.com') return NextResponse.next();

  destination.protocol = 'https:';
  destination.port = '';
  return NextResponse.redirect(destination, 308);
}

export const config = {
  matcher: [{
    source: '/:path*',
    has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }],
  }],
};
