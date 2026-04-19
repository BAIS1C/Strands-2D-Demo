'use client';

import { useSkin, SKIN_META, type Skin } from '@/context/SkinContext';
import styles from './SkinToggle.module.css';

/* ═══════════════════════════════════════════════════════════════
   SKIN TOGGLE — floating theme switcher for the OS shell.
   Positioned top-right by default; parent can override via class.
   ═══════════════════════════════════════════════════════════════ */

const ORDER: Skin[] = ['a', 'b', 'c'];

export default function SkinToggle() {
  const { skin, setSkin } = useSkin();

  return (
    <div className={styles.switcher} role="radiogroup" aria-label="OS theme">
      {ORDER.map((id) => {
        const meta = SKIN_META[id];
        const active = skin === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            className={`${styles.btn} ${active ? styles.active : ''}`}
            onClick={() => setSkin(id)}
            title={meta.tagline}
          >
            <span className={styles.dot}>{id.toUpperCase()}</span>
            <span className={styles.label}>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
