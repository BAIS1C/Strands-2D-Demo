import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import CursorGlow from '@/components/CursorGlow/CursorGlow';
import Scanlines from '@/components/Scanlines/Scanlines';
import CircuitBg from '@/components/CircuitBg/CircuitBg';
import '@/styles/tokens.css';
import '@/styles/global.css';

export const metadata: Metadata = {
  title: 'Strands Demo',
  description: 'Strands: A Living World Inside Telegram. Interactive demo.',
  icons: {
    icon: [
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Scanlines />
        <CircuitBg />
        <CursorGlow />
        {children}
      </body>
    </html>
  );
}
