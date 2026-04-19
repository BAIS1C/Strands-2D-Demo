'use client';

import { useCallback, useRef } from 'react';
import type { ReactNode, PointerEvent as ReactPointerEvent, CSSProperties } from 'react';
import { TASKBAR_H, type WindowState } from '@/constants/appRegistry';
import styles from './Window.module.css';

/* ═══════════════════════════════════════════════════════════════
   WINDOW — floating panel with drag, 8-edge resize, min/max/close.
   Uses pointer capture on the title bar + resize handles so drag
   continues even if the pointer leaves the element. Title bar
   stays clamped inside the viewport so a window can't escape above.
   ═══════════════════════════════════════════════════════════════ */

export interface WindowProps {
  win: WindowState;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number, x?: number, y?: number) => void;
  children: ReactNode;
}

const RESIZE_EDGES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;

export default function Window({
  win,
  isActive,
  onFocus,
  onClose,
  onMinimize,
  onMaximize,
  onMove,
  onResize,
  children,
}: WindowProps) {
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeRef = useRef<{
    startX: number; startY: number;
    startW: number; startH: number;
    startWinX: number; startWinY: number;
    edges: string;
  } | null>(null);

  const handleDragStart = useCallback(
    (e: ReactPointerEvent) => {
      if (win.isMaximized) return;
      e.preventDefault();
      onFocus();
      dragRef.current = { startX: e.clientX, startY: e.clientY, winX: win.x, winY: win.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [win.x, win.y, win.isMaximized, onFocus],
  );

  const handleDragMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      onMove(
        Math.max(0, Math.min(window.innerWidth - 100, dragRef.current.winX + dx)),
        Math.max(0, Math.min(window.innerHeight - TASKBAR_H - 36, dragRef.current.winY + dy)),
      );
    },
    [onMove],
  );

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleResizeStart = useCallback(
    (e: ReactPointerEvent, edges: string) => {
      if (win.isMaximized) return;
      e.preventDefault();
      e.stopPropagation();
      onFocus();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startW: win.width,
        startH: win.height,
        startWinX: win.x,
        startWinY: win.y,
        edges,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [win.width, win.height, win.x, win.y, win.isMaximized, onFocus],
  );

  const handleResizeMove = useCallback(
    (e: ReactPointerEvent) => {
      if (!resizeRef.current) return;
      const r = resizeRef.current;
      const dx = e.clientX - r.startX;
      const dy = e.clientY - r.startY;
      let newW = r.startW, newH = r.startH, newX = r.startWinX, newY = r.startWinY;
      if (r.edges.includes('e')) newW = Math.max(win.minWidth, r.startW + dx);
      if (r.edges.includes('s')) newH = Math.max(win.minHeight, r.startH + dy);
      if (r.edges.includes('w')) {
        const d = Math.min(dx, r.startW - win.minWidth);
        newW = r.startW - d;
        newX = r.startWinX + d;
      }
      if (r.edges.includes('n')) {
        const d = Math.min(dy, r.startH - win.minHeight);
        newH = r.startH - d;
        newY = r.startWinY + d;
      }
      onResize(newW, newH, newX, newY);
    },
    [win.minWidth, win.minHeight, onResize],
  );

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null;
  }, []);

  // Clamp top so the title bar is ALWAYS visible: windows can't escape above the viewport.
  const clampedY = Math.max(0, win.y);
  const windowStyle: CSSProperties = win.isMinimized
    ? { display: 'none' }
    : win.isMaximized
    ? // Fill the .workspace parent exactly — workspace is absolute-positioned
      // to the area above the taskbar, so inset:0 meets the taskbar edge with
      // no calc drift and no bottom gap.
      { left: 0, top: 0, right: 0, bottom: 0, zIndex: win.zIndex }
    : { left: win.x, top: clampedY, width: win.width, height: win.height, zIndex: win.zIndex };

  return (
    <div
      className={`${styles.window} ${isActive ? styles.windowActive : ''}`}
      style={windowStyle}
      onPointerDown={onFocus}
    >
      {!win.isMaximized &&
        RESIZE_EDGES.map((edge) => (
          <div
            key={edge}
            className={`${styles.resizeHandle} ${styles[`resize_${edge}`]}`}
            onPointerDown={(e) => handleResizeStart(e, edge)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
          />
        ))}
      <div
        className={styles.titleBar}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onDoubleClick={onMaximize}
      >
        {/* Mac-style traffic lights — close (red), min (yellow), max (green) — leading the titlebar */}
        <div className={styles.windowControls}>
          <button
            className={`${styles.winBtn} ${styles.winBtnClose}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
          />
          <button
            className={`${styles.winBtn} ${styles.winBtnMin}`}
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            aria-label="Minimize"
          />
          <button
            className={`${styles.winBtn} ${styles.winBtnMax}`}
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            aria-label="Maximize"
          />
        </div>
        <span className={styles.titleIcon}>{win.icon}</span>
        <span className={styles.titleText}>{win.title}</span>
      </div>
      <div className={styles.windowContent}>{children}</div>
    </div>
  );
}
