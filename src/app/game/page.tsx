'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy /game route — stubbed for now.
 *
 * This page will become the migration target for demoOS once everything
 * is stable, and will be served as games.strandsnation.xyz (new menu
 * item on the main strandsnation.xyz site).
 *
 * Full original implementation preserved in git history.
 */
export default function GameRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/demoOS');
  }, [router]);

  return (
    <div style={{
      background: '#030304',
      color: 'rgba(0,194,255,0.4)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Rajdhani', sans-serif",
      letterSpacing: '2px',
      fontSize: '14px',
    }}>
      REDIRECTING TO DEMOOS...
    </div>
  );
}
