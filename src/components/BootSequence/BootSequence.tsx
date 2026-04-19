'use client';

import { useEffect, useState } from 'react';
import styles from './BootSequence.module.css';

/* ═══════════════════════════════════════════════════════════════
   BOOT SEQUENCE — Strands OS cold-start animation. Streams a
   canned sequence of boot lines into a terminal, then calls
   onComplete to hand off to the desktop shell.
   ═══════════════════════════════════════════════════════════════ */

const BOOT_LINES = [
  'STRANDS OS v2026.3 — Initializing...',
  'Loading kernel modules...',
  'Signal substrate: DETECTED',
  'CPU-VPU Bridge: CALIBRATING',
  'Temporal alignment: LOCKED',
  'LARP Protocol: ACTIVE',
  'Desktop environment: LOADING',
  'Window manager: READY',
  '...',
  '◈ SIGNAL ACTIVE — Welcome, Agent.',
];

interface BootSequenceProps {
  onComplete: () => void;
}

export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setLines((prev) => [...prev, BOOT_LINES[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 600);
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.bootScreen}>
      <div className={styles.bootTerminal}>
        {lines.map((line, i) => (
          <div key={i} className={styles.bootLine}>
            <span className={styles.bootPrompt}>&gt;</span> {line}
          </div>
        ))}
        <div className={styles.bootCursor}>_</div>
      </div>
    </div>
  );
}
