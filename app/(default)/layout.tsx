import '../globals.css';
import { baseMetadata } from '@/lib/base-metadata';

export const metadata = baseMetadata('ar');

export default function DefaultRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar-u-nu-latn" dir="rtl">
      <head>
        <link rel="preload" href="/fonts/Impact.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Alyamama-Regular.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
