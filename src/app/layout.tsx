import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/features/auth/AuthContext';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getServerSession } from '@/lib/auth/session';
import { getUserRepository } from '@/lib/db/repositories';
import { User, CharacterProfile } from '@/types';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Sanboard – Los Santos\'un İlan Platformu',
  description:
    'GTA World Los Santos araç ve mülk ilan platformu. En güncel otomobil, SUV, motosiklet ve gayrimenkul ilanları.',
  keywords: ['GTA World', 'Sanboard', 'Los Santos', 'Araç İlanları', 'Mülk İlanları'],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let initialUser: User | null = null;
  let initialProfile: CharacterProfile | null = null;
  let session = null;

  try {
    session = await getServerSession();
    if (session?.userId && session?.profileId) {
      const userRepo = getUserRepository();
      const [u, p] = await Promise.all([
        userRepo.getUserById(session.userId),
        userRepo.getProfileById(session.profileId),
      ]);
      if (u) initialUser = u;
      if (p) initialProfile = p;
    }
  } catch {
    // Non-blocking fallback
  }

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
        <AuthProvider
          initialUser={initialUser}
          initialProfile={initialProfile}
          initialStatus={session ? 'authenticated' : 'unauthenticated'}
        >
          <Navbar />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
