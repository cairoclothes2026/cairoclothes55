import { NextResponse, type NextRequest } from 'next/server';
import { SOCIAL_AUTH_PROVIDERS } from '@/lib/auth-providers';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const requestedPath = request.nextUrl.searchParams.get('next');
  const allowedPaths = new Set([
    '/ar/join-store', '/en/join-store', '/ar/admin', '/en/admin',
    '/ar/store-dashboard', '/en/store-dashboard', '/ar/account', '/en/account',
    '/ar/reset-password', '/en/reset-password',
    '/ar/auth/continue', '/en/auth/continue',
  ]);
  let safePath = '/ar/login';
  if (requestedPath) {
    try {
      const requested = new URL(requestedPath, request.nextUrl.origin);
      const isContinue = requested.pathname === '/ar/auth/continue' || requested.pathname === '/en/auth/continue';
      const validContinueParams = [...requested.searchParams.keys()].every((key) => ['emailOtp', 'googleOtp', 'accountType', 'legalIntent'].includes(key));
      const validAccountType = !requested.searchParams.has('accountType') || ['customer', 'merchant'].includes(requested.searchParams.get('accountType') ?? '');
      const validGoogleOtp = !requested.searchParams.has('googleOtp') || requested.searchParams.get('googleOtp') === '1';
      const otpProvider = requested.searchParams.get('emailOtp');
      const validOtpProvider = otpProvider === null || SOCIAL_AUTH_PROVIDERS.some((provider) => provider.id === otpProvider && provider.emailOtpOnSignupFor?.length);
      if (requested.origin === request.nextUrl.origin && allowedPaths.has(requested.pathname) && !requested.hash) {
        const intent = requested.searchParams.get('legalIntent');
        const validIntent = intent === null || /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(intent);
        if (isContinue && validContinueParams && validAccountType && validGoogleOtp && validOtpProvider && validIntent) {
          safePath = `${requested.pathname}${requested.search}`;
        } else if (!isContinue && !requested.search) {
          safePath = requested.pathname;
        }
      }
    } catch {
      // Fall back to the safe login page for malformed or external redirect targets.
    }
  }
  const destination = new URL(safePath, request.url);

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const response = NextResponse.redirect(destination);
      if (safePath.endsWith('/reset-password') && 'redirectType' in data && data.redirectType === 'recovery' && data.user) {
        response.cookies.set('cc-recovery-account', data.user.id, {
          httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'lax',
          path: safePath, maxAge: 600,
        });
      }
      return response;
    }
  }

  destination.searchParams.set('auth', 'error');
  return NextResponse.redirect(destination);
}
