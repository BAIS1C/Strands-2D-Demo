'use client';

import type { AppManifest } from '@/constants/appRegistry';
import ParticleIcon from '@/components/ParticleIcon/ParticleIcon';
import styles from './DesktopIcon.module.css';

/* ═══════════════════════════════════════════════════════════════
   DESKTOP ICON — renders a single app tile on the desktop grid.
   Delegates the icon glyph to ParticleIcon (canvas particle field).
   Handles four visual states: available, locked, hidden, notifying.
   ═══════════════════════════════════════════════════════════════ */

interface DesktopIconProps {
  app: AppManifest;
  onOpen: () => void;
  onLockedClick: (msg: string) => void;
}

export default function DesktopIcon({ app, onOpen, onLockedClick }: DesktopIconProps) {
  if (app.state === 'hidden') {
    return (
      <div className={styles.iconSlotHidden}>
        {app.id === 'kasai-terminal' && <span className={styles.glitchChar}>?</span>}
      </div>
    );
  }

  const isLocked = app.state === 'locked';

  return (
    <button
      className={`${styles.desktopIcon} ${isLocked ? styles.desktopIconLocked : ''}`}
      onDoubleClick={() => {
        if (isLocked) onLockedClick(app.lockMessage || 'Access denied');
        else onOpen();
      }}
      onClick={() => {
        if (isLocked) onLockedClick(app.lockMessage || 'Access denied');
      }}
    >
      <div className={styles.iconGlyph}>
        <ParticleIcon appId={app.id} tier={app.tier} emoji={app.icon} />
        {isLocked && <div className={styles.lockOverlay}>🔒</div>}
      </div>
      <div className={styles.iconLabel}>{app.label}</div>
      {app.hasNotification && <div className={styles.notificationDot} />}
    </button>
  );
}
