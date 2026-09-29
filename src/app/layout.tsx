import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getFaviconSetting } from '@/lib/site-settings';
import { getAbsoluteUrl } from '@/lib/urls';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from '@/lib/seo/site-metadata';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

import { CompareProvider } from '@/components/compare/CompareContext';
import { CompareTray } from '@/components/compare/CompareTray';
import { PropertyCompareProvider } from '@/components/compare/PropertyCompareContext';
import { PropertyCompareTray } from '@/components/compare/PropertyCompareTray';
import { OfferCenterProvider } from '@/components/offers/OfferCenter';

export async function generateMetadata(): Promise<Metadata> {
  const favicon = await getFaviconSetting();
  const iconUrl = favicon ? `${favicon.url}${favicon.url.includes('?') ? '&' : '?'}v=${encodeURIComponent(favicon.version)}` : '/favicon.ico';
  const canonical = getAbsoluteUrl('/');
  const shareImage = getAbsoluteUrl('/opengraph-image');
  return {
    metadataBase: new URL(canonical),
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    keywords: ['Sanboard', 'Los Santos', 'Araç İlanları', 'Mülk İlanları'],
    openGraph: {
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      url: canonical,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: shareImage, width: 1200, height: 630, alt: SITE_TITLE }],
    },
    twitter: {
      card: 'summary_large_image',
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: [shareImage],
    },
    icons: { icon: [{ url: iconUrl, type: favicon?.mimeType || 'image/x-icon' }], shortcut: iconUrl },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('sanboard-theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.remove('light');
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen flex flex-col antialiased bg-[var(--bg-app)] text-[var(--text-main)]`}
      >
        <AuthProvider><OfferCenterProvider>
          <CompareProvider>
            <PropertyCompareProvider>
              <Navbar />
              <main className="flex-1 w-full">{children}</main>
              <Footer />
              <CompareTray />
              <PropertyCompareTray />
            </PropertyCompareProvider>
          </CompareProvider>
        </OfferCenterProvider></AuthProvider>
      </body>
    </html>
  );
}
