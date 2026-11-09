import { DEFAULT_LOCALE, getTextDirection } from '@smart-city/shared';
import { translate } from '@smart-city/shared/i18n';
import type { Metadata } from 'next';
import { Rubik } from 'next/font/google';

import { THEME_SCRIPT } from '@/lib/theme';

import './globals.css';

// Rubik covers Hebrew, Arabic and Latin, so all three languages share one typeface.
const rubik = Rubik({
  variable: '--font-rubik',
  subsets: ['latin', 'hebrew', 'arabic'],
});

// The admin locale is fixed to the default (Hebrew) until per-user language
// preferences arrive with authentication in Phase 2.
const locale = DEFAULT_LOCALE;

export const metadata: Metadata = {
  title: {
    default: translate(locale, 'app.name'),
    template: `%s · ${translate(locale, 'app.name')}`,
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // suppressHydrationWarning: the theme script below may set data-theme before React hydrates.
    <html
      lang={locale}
      dir={getTextDirection(locale)}
      className={`${rubik.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved theme before the first paint, so the page never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
