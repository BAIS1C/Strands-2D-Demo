'use client';

import { useEffect } from 'react';
import styles from './NotificationToast.module.css';

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION TOAST — pops up when clicking locked icons.
   Self-dismisses after 3s. Keyed so re-triggering resets the timer.
   ═══════════════════════════════════════════════════════════════ */

interface NotificationToastProps {
  message: string;
  toastKey: number;
  onDismiss: () => void;
}

export default function NotificationToast({ message, toastKey, onDismiss }: NotificationToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [toastKey, onDismiss]);

  return (
    <div className={styles.toast} key={toastKey}>
      <span className={styles.toastIcon}>🔒</span>
      <span className={styles.toastMsg}>{message}</span>
    </div>
  );
}
