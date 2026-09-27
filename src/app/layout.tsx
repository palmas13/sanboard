import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getFaviconSetting } from '@/lib/site-settings';

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

export async function generateMetadata(): Promise<Metadata> {
  const favicon = await getFaviconSetting();
  const iconUrl = favicon ? `${favicon.url}${favicon.url.includes('?') ? '&' : '?'}v=${encodeURIComponent(favicon.version)}` : '/favicon.ico';
  return {
    title: 'Sanboard – Los Santos\'un İlan Platformu',
    description: 'GTA World Los Santos araç ve mülk ilan platformu.',
    keywords: ['GTA World', 'Sanboard', 'Los Santos', 'Araç İlanları', 'Mülk İlanları'],
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
        <AuthProvider>
          <CompareProvider>
            <PropertyCompareProvider>
              <Navbar />
              <main className="flex-1 w-full">{children}</main>
              <Footer />
              <CompareTray />
              <PropertyCompareTray />
            </PropertyCompareProvider>
          </CompareProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
