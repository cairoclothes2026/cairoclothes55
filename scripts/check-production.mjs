import { loadEnv } from 'vite';

const env = { ...loadEnv('production', process.cwd(), 'NEXT_PUBLIC_'), ...process.env };
if (env.NEXT_PUBLIC_SITE_URL !== 'https://cairoclothes.com' ||
    env.NEXT_PUBLIC_SUPABASE_URL !== 'https://njngevsrmxecrpwfhzdx.supabase.co' ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()) {
  throw new Error('Set the canonical production site URL and both public catalog settings before release.');
}
