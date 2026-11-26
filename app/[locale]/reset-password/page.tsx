import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { PasswordRecovery } from '@/components/PasswordRecovery';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export default async function ResetPassword({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const marker = (await cookies()).get('cc-recovery-account')?.value;
  const client = await createSupabaseServerClient();
  const user = marker ? (await client.auth.getUser()).data.user : null;
  return <PasswordRecovery locale={locale} accountId={user?.id} mode={user && user.id === marker ? 'reset' : 'invalid'} />;
}
