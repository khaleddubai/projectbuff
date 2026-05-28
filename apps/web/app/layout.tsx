import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'AEGIS | Director\'s Operating System',
  description:
    'AEGIS — Enterprise-grade AI agent orchestration platform. Mission control, monitoring, and management for autonomous AI agents.',
  keywords: ['AI', 'agents', 'orchestration', 'missions', 'automation'],
  authors: [{ name: 'AEGIS' }],
  openGraph: {
    title: 'AEGIS | Director\'s Operating System',
    description: 'Enterprise-grade AI agent orchestration platform',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-950 text-surface-200 antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
