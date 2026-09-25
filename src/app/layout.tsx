import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

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

export const metadata: Metadata = {
  title: 'Sanboard – Los Santos\'un İlan Platformu',
  description:
    'GTA World Los Santos araç ve mülk ilan platformu.',
  keywords: ['GTA World', 'Sanboard', 'Los Santos', 'Araç İlanları', 'Mülk İlanları'],
};

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
            <Navbar />
            <main className="flex-1 w-full">{children}</main>
            <Footer />
            <CompareTray />
          </CompareProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
