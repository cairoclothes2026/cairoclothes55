import { notFound } from 'next/navigation';
import { HomePage, homeMetadata } from '@/components/HomePage';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  if (locale !== 'en') notFound();
  return homeMetadata(locale);
}

export default async function Home({ params }: PageProps) {
  const { locale } = await params;
  if (locale !== 'en') notFound();
  return <HomePage locale={locale} />;
}
