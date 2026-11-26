import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const data = await request.json().catch(() => null);
  if (!data || typeof data.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(data.id)) {
    return new NextResponse(null, { status: 400 });
  }
  const db = await createSupabaseServerClient();
  const { error } = await db.from('product_views').insert({ product_id: data.id });
  return new NextResponse(null, { status: error ? 400 : 204 });
}
