import { getTextDirection, SUPPORTED_LOCALES } from '@smart-city/shared';
import type { Metadata } from 'next';
import { Geist, Geist_Mono, Heebo, Noto_Sans_Arabic } from 'next/font/google';

import { getLocale, getTranslator } from '@/lib/i18n/server';
import { SIDEBAR_SCRIPT } from '@/lib/sidebar';
import { THEME_SCRIPT } from '@/lib/theme';

import '../globals.css';

// Geist sets Latin text and numbers, Heebo Hebrew, Noto Sans Arabic Arabic: one voice with a
// face drawn for each script. These calls register the @font-face rules; globals.css names the
// families in its font stack (see the note there).
const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
});

const heebo = Heebo({
  variable: '--font-heebo',
  subsets: ['hebrew'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const notoArabic = Noto_Sans_Arabic({
  variable: '--font-noto-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
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
    // The theme script sets `data-theme` before React hydrates, so <html> differs on purpose.
    <html
      lang={locale}
      dir={getTextDirection(locale)}
      data-theme="light"
      className={`${geist.variable} ${geistMono.variable} ${heebo.variable} ${notoArabic.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: `${THEME_SCRIPT};${SIDEBAR_SCRIPT}` }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
