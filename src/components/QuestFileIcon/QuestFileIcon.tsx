'use client';

import type { MouseEvent } from 'react';
import styles from './QuestFileIcon.module.css';

/* ═══════════════════════════════════════════════════════════════
   QUEST FILE ICON — tile for narrative-dropped desktop files.
   Pink pulse + label tint while un-renamed; cyan + steady once
   the player renames it. Delegates open / context-menu handling
   to the parent shell.
   ═══════════════════════════════════════════════════════════════ */

export interface QuestFile {
  name: string;
  icon: string;
  renamed?: boolean;
}

interface QuestFileIconProps {
  file: QuestFile;
  onOpen: (file: QuestFile) => void;
  onContextMenu: (e: MouseEvent, fileName: string) => void;
}

export default function QuestFileIcon({ file, onOpen, onContextMenu }: QuestFileIconProps) {
  const label = file.name.length > 20 ? file.name.slice(0, 18) + '...' : file.name;

  return (
    <div
      className={styles.tile}
      onDoubleClick={() => onOpen(file)}
      onContextMenu={(e) => onContextMenu(e, file.name)}
    >
      <span className={styles.glyph}>{file.icon}</span>
      <span className={`${styles.label} ${file.renamed ? styles.labelRenamed : ''}`}>
        {label}
      </span>
      {!file.renamed && <span className={styles.pulseDot} />}
    </div>
  );
}
