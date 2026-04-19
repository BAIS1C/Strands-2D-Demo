'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APP_REGISTRY,
  TASKBAR_H,
  type AppManifest,
  type WindowState,
} from '@/constants/appRegistry';

/* ═══════════════════════════════════════════════════════════════
   WINDOW MANAGER HOOK
   Owns window state and every action that mutates it. The shell
   consumes the returned actions; nothing about window state needs
   to leak out of this module.
   ═══════════════════════════════════════════════════════════════ */

interface UseWindowManagerOptions {
  /** Toast dispatch from the shell — called on game-complete postMessage. */
  showToast: (msg: string) => void;
}

export interface WindowManager {
  windows: WindowState[];
  activeWindowId: string | null;
  openWindow: (app: AppManifest) => void;
  spawnDynamicWindow: (appId: string, title: string, icon: string, width?: number, height?: number) => void;
  focusWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, width: number, height: number, x?: number, y?: number) => void;
  handleTaskbarClick: (id: string) => void;
}

/**
 * Maps game-iframe-emitted ids to appIds used in the window registry.
 * Games send their own id (e.g. 'holo-lock', '2042') which won't match
 * the window's generated id. Map known game ids → appIds, then find
 * the window by appId. Falls back to direct id match.
 */
const GAME_ID_TO_APP_ID: Record<string, string> = {
  'holo-lock': 'circuit-sync-quest',
  '2042': 'arcade-2042',
  'signal-training': 'signal-training',
};

/**
 * Apps that should auto-maximize on open. Everything else opens at its
 * default size at a cascaded position. Gener8 is the studio surface —
 * it earns the full workspace. Add 's3-daw' / 's3-vid' here when those
 * ship.
 */
const AUTO_MAXIMIZE_APP_IDS = new Set<string>(['gener8']);

export function useWindowManager({ showToast }: UseWindowManagerOptions): WindowManager {
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZ, setNextZ] = useState(100);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const windowCounter = useRef(0);

  /* ─── spawn a dynamic window (for quest-triggered windows) ─── */
  const spawnDynamicWindow = useCallback(
    (appId: string, title: string, icon: string, width = 520, height = 500) => {
      const existing = windows.find((w) => w.appId === appId);
      if (existing) {
        setNextZ((z) => z + 1);
        setWindows((prev) =>
          prev.map((w) => (w.id === existing.id ? { ...w, zIndex: nextZ + 1, isMinimized: false } : w)),
        );
        setActiveWindowId(existing.id);
        return;
      }
      windowCounter.current++;
      const id = `win-${windowCounter.current}`;
      const ox = (windowCounter.current % 6) * 40;
      const oy = (windowCounter.current % 4) * 40;
      const shouldMax = AUTO_MAXIMIZE_APP_IDS.has(appId);
      const newWin: WindowState = {
        id,
        appId,
        title,
        icon,
        x: 200 + ox,
        y: 60 + oy,
        width,
        height,
        minWidth: 400,
        minHeight: 360,
        zIndex: nextZ + 1,
        isMinimized: false,
        // Default: open at stashed floating bounds. Studio apps (Gener8) auto-max.
        isMaximized: shouldMax,
        preMaxBounds: shouldMax ? { x: 200 + ox, y: 60 + oy, width, height } : undefined,
      };
      setNextZ((z) => z + 1);
      setWindows((prev) => [...prev, newWin]);
      setActiveWindowId(id);
    },
    [windows, nextZ],
  );

  /* ─── open a window from an AppManifest (centers Messages, cascades others) ─── */
  const openWindow = useCallback(
    (app: AppManifest) => {
      const existing = windows.find((w) => w.appId === app.id);
      if (existing) {
        setNextZ((z) => z + 1);
        setWindows((prev) =>
          prev.map((w) => (w.id === existing.id ? { ...w, zIndex: nextZ + 1, isMinimized: false } : w)),
        );
        setActiveWindowId(existing.id);
        return;
      }
      windowCounter.current++;
      const id = `win-${windowCounter.current}`;

      let x: number, y: number;
      if (app.id === 'messages') {
        const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
        x = Math.max(20, (viewportWidth - app.defaultWidth) / 2);
        y = Math.max(20, (viewportHeight - TASKBAR_H - app.defaultHeight) / 2);
      } else {
        const ox = (windowCounter.current % 8) * 30;
        const oy = (windowCounter.current % 6) * 30;
        x = 140 + ox;
        y = 30 + oy;
      }

      const shouldMax = AUTO_MAXIMIZE_APP_IDS.has(app.id);
      const newWin: WindowState = {
        id,
        appId: app.id,
        title: app.label,
        icon: app.icon,
        x,
        y,
        width: app.defaultWidth,
        height: app.defaultHeight,
        minWidth: app.minWidth,
        minHeight: app.minHeight,
        zIndex: nextZ + 1,
        isMinimized: false,
        // Default: open at default size at cascaded/centered position.
        // Studio apps (Gener8) earn the full workspace — auto-max.
        isMaximized: shouldMax,
        preMaxBounds: shouldMax ? { x, y, width: app.defaultWidth, height: app.defaultHeight } : undefined,
      };
      setNextZ((z) => z + 1);
      setWindows((prev) => [...prev, newWin]);
      setActiveWindowId(id);
    },
    [windows, nextZ],
  );

  const focusWindow = useCallback((id: string) => {
    setNextZ((z) => {
      setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, zIndex: z + 1 } : w)));
      return z + 1;
    });
    setActiveWindowId(id);
  }, []);

  const closeWindow = useCallback(
    (id: string) => {
      setWindows((prev) => prev.filter((w) => w.id !== id));
      if (activeWindowId === id) setActiveWindowId(null);
    },
    [activeWindowId],
  );

  const minimizeWindow = useCallback(
    (id: string) => {
      setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isMinimized: true } : w)));
      if (activeWindowId === id) setActiveWindowId(null);
    },
    [activeWindowId],
  );

  const maximizeWindow = useCallback((id: string) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        if (w.isMaximized) {
          return {
            ...w,
            isMaximized: false,
            x: w.preMaxBounds?.x ?? w.x,
            y: w.preMaxBounds?.y ?? w.y,
            width: w.preMaxBounds?.width ?? w.width,
            height: w.preMaxBounds?.height ?? w.height,
            preMaxBounds: undefined,
          };
        }
        return {
          ...w,
          isMaximized: true,
          preMaxBounds: { x: w.x, y: w.y, width: w.width, height: w.height },
        };
      }),
    );
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, x, y } : w)));
  }, []);

  const resizeWindow = useCallback((id: string, width: number, height: number, x?: number, y?: number) => {
    setWindows((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const u: Partial<WindowState> = { width, height };
        if (x !== undefined) u.x = x;
        if (y !== undefined) u.y = y;
        return { ...w, ...u };
      }),
    );
  }, []);

  const handleTaskbarClick = useCallback(
    (id: string) => {
      const win = windows.find((w) => w.id === id);
      if (!win) return;
      if (win.isMinimized) {
        setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, isMinimized: false } : w)));
        focusWindow(id);
      } else if (activeWindowId === id) {
        minimizeWindow(id);
      } else {
        focusWindow(id);
      }
    },
    [windows, activeWindowId, focusWindow, minimizeWindow],
  );

  /* ─── Listen for game-quit / game-complete postMessages from iframed games ─── */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'game-quit' && typeof e.data.id === 'string') {
        const appId = GAME_ID_TO_APP_ID[e.data.id] || e.data.id;
        const win = windows.find((w) => w.appId === appId);
        if (win) {
          setWindows((prev) => prev.filter((w) => w.appId !== appId));
        } else {
          closeWindow(e.data.id);
        }
      }
      if (e.data?.type === 'game-complete' && typeof e.data.id === 'string') {
        const score = e.data.score || 0;
        console.log(`[DemoOS] Game "${e.data.id}" completed with score: ${score}`);
        showToast(`SIGNAL TRAINING COMPLETE — Sync score: ${score}`);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [closeWindow, windows, showToast]);

  return {
    windows,
    activeWindowId,
    openWindow,
    spawnDynamicWindow,
    focusWindow,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    moveWindow,
    resizeWindow,
    handleTaskbarClick,
  };
}

/** Convenience re-export so the shell only imports from one place when it needs the registry. */
export { APP_REGISTRY };
