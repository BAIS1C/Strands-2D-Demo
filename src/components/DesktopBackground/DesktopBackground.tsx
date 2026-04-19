'use client';

import { useEffect, useState } from 'react';
import styles from './DesktopBackground.module.css';

/* ═══════════════════════════════════════════════════════════════
   DESKTOP BACKGROUND — per-theme wallpaper stack.
   All three variant layers render; visibility is driven by the
   [data-theme] attribute on an ancestor (the OS root).

   A = live circuit grid + radial glows + scanline flicker
   B = kanji + hanko stamp + caption strips
   C = ASCII grid + giant terminal clock + HUD strips

   `evolved` still flips the A layer to the Year 555 palette.
   ═══════════════════════════════════════════════════════════════ */

interface DesktopBackgroundProps {
  evolved?: boolean;
}

export default function DesktopBackground({ evolved = false }: DesktopBackgroundProps) {
  const [clock, setClock] = useState('14:02');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const sgt = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
      const hh = String(sgt.getHours()).padStart(2, '0');
      const mm = String(sgt.getMinutes()).padStart(2, '0');
      setClock(`${hh}:${mm}`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`${styles.surface} ${evolved ? styles.evolved : ''}`}>
      {/* VARIANT A :: Live DesktopBackground (Cyberpunk v1.0) */}
      <div className={`${styles.wpLayer} ${styles.wpA}`}>
        <div className={styles.circuitPattern} />
        <div className={styles.radialCyan} />
        <div className={styles.radialPink} />
        <div className={styles.scanlineOverlay} />
      </div>

      {/* VARIANT B :: Refined Cyberpunk — kanji + hanko + captions */}
      <div className={`${styles.wpLayer} ${styles.wpB}`}>
        <div className={styles.gridLines} />
        <div className={styles.kanji}>層重</div>
        <div className={styles.hanko}>層</div>
        <div className={styles.captionStrip}>
          EVERYWEAR / 1.1<br />
          NODE · HOME.STRANDS.LOCAL<br />
          UPTIME · 14D 06:22<br />
          PEERS · 0 ONLINE<br />
          FRIENDS · <b>0 PRESENT</b>
        </div>
        <div className={styles.stationTag}>
          <b>SOMO KASANE</b><br />
          0x7A3F…C421<br />
          LINEAGE vB · 184d<br />
          SIGNAL 1,420
        </div>
      </div>

      {/* VARIANT C :: Industrial Terminal — ASCII grid + giant clock + HUD */}
      <div className={`${styles.wpLayer} ${styles.wpC}`}>
        <div className={styles.asciiGrid} />
        <div className={styles.cornerMark}>
          <b>EVERYWEAR/1.1</b> · home node · build 1.1.0
        </div>
        <div className={styles.terminalClock}>
          <span>{clock}</span>
          <small>LOCAL · HOME NODE · BUILD 1.1.0</small>
        </div>
        <div className={styles.hudStrip}>
          <div><b>NODE</b>home.strands.local<br />status: awake<br />uptime: 14d 06:22</div>
          <div><b>INFERENCE</b>suno-lx : idle<br />wan-img : loaded<br />vid-gen : standby</div>
          <div><b>NETWORK</b>peers: 0 online<br />friends: 0 present<br />latency: — ms</div>
        </div>
      </div>
    </div>
  );
}
