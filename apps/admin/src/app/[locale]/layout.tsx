import { getTextDirection, SUPPORTED_LOCALES } from '@smart-city/shared';
import type { Metadata } from 'next';
import { IBM_Plex_Sans_Arabic, IBM_Plex_Sans_Hebrew } from 'next/font/google';

import { getLocale, getTranslator } from '@/lib/i18n/server';

import '../globals.css';

// IBM Plex Sans Hebrew provides Latin and Hebrew; IBM Plex Sans Arabic provides Arabic.
// One type family, designed together, for all three languages. These calls register the
// @font-face rules; globals.css names the families in its font stack (see the note there).
const plexHebrew = IBM_Plex_Sans_Hebrew({
  variable: '--font-plex-hebrew',
  subsets: ['latin', 'hebrew'],
  weight: ['400', '500', '600'],
  display: 'swap',
});

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: '--font-plex-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
  display: 'swap',
  // Loaded on demand: only Arabic text uses it.
  preload: false,
});

/** Each language is rendered ahead of time: /he, /ar and /en. */
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  return {
    title: { default: t('app.name'), template: `%s · ${t('app.name')}` },
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={getTextDirection(locale)}
      className={`${plexHebrew.variable} ${plexArabic.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
