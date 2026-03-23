'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './DesktopContextMenu.module.css';

/* ═══════════════════════════════════════════════════════════════
   DESKTOP RENAME BOX — Right-click discovery mechanic

   Right-click on a quest file → immediately shows rename box
   with full filename. The broken extension flashes to draw
   attention — player figures out to change it to .mp4.

   Canon: proper_gander.quantstream..incomplete
   The double-dot + "incomplete" screams "fix me".
   ═══════════════════════════════════════════════════════════════ */

interface ContextMenuProps {
  x: number;
  y: number;
  fileName: string;
  onRename: (newName: string) => void;
  onClose: () => void;
}

export default function DesktopContextMenu({ x, y, fileName, onRename, onClose }: ContextMenuProps) {
  const [renameValue, setRenameValue] = useState(fileName);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Split filename into base and extension for display
  const lastDotIdx = fileName.lastIndexOf('.');
  const baseName = lastDotIdx > 0 ? fileName.slice(0, lastDotIdx) : fileName;
  const extension = lastDotIdx > 0 ? fileName.slice(lastDotIdx) : '';

  // Close on outside click (pointerdown so it fires before focus shifts)
  useEffect(() => {
    const handleOutside = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the originating right-click closing us immediately
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handleOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handleOutside);
    };
  }, [onClose]);

  // Focus + select input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== fileName) {
      onRename(trimmed);
    }
    onClose();
  };

  // Clamp position so box doesn't overflow viewport
  const boxWidth = 340;
  const clampedX = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - boxWidth - 16);
  const clampedY = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 768) - 180);

  return (
    <div ref={boxRef} className={styles.renameBox} style={{ left: Math.max(8, clampedX), top: Math.max(8, clampedY) }}>
      <div className={styles.renameLabel}>RENAME FILE</div>

      {/* Current filename display with flashing extension */}
      <div className={styles.fileDisplay}>
        <span className={styles.fileBase}>{baseName}</span>
        <span className={styles.fileExt}>{extension}</span>
      </div>

      {/* Editable input */}
      <input
        ref={inputRef}
        className={styles.renameInput}
        value={renameValue}
        onChange={e => setRenameValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onClose();
        }}
        spellCheck={false}
        autoComplete="off"
      />

      <div className={styles.renameActions}>
        <button className={styles.renameBtn} onClick={handleSubmit}>CONFIRM</button>
        <button className={styles.renameBtnCancel} onClick={onClose}>CANCEL</button>
      </div>
    </div>
  );
}
