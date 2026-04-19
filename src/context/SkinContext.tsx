'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

/* ═══════════════════════════════════════════════════════════════
   SKIN CONTEXT — EWDS theme state for the OS shell.
   Persists selection to localStorage so theme survives refresh.
   Three variants: a (Cyberpunk v1.0), b (Refined), c (Industrial Terminal).
   ═══════════════════════════════════════════════════════════════ */

export type Skin = 'a' | 'b' | 'c';

export const SKIN_META: Record<Skin, { id: Skin; label: string; tagline: string }> = {
  a: { id: 'a', label: 'Cyberpunk',  tagline: 'v1.0 · neon triad' },
  b: { id: 'b', label: 'Refined',    tagline: 'oklch · one primary' },
  c: { id: 'c', label: 'Terminal',   tagline: 'industrial · amber mono' },
};

interface SkinContextValue {
  skin: Skin;
  setSkin: (s: Skin) => void;
}

const SkinContext = createContext<SkinContextValue | null>(null);
const STORAGE_KEY = 'strands.demoOS.skin';

export function SkinProvider({ children }: { children: ReactNode }) {
  const [skin, setSkinState] = useState<Skin>('a');

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Skin | null;
      if (stored && (stored === 'a' || stored === 'b' || stored === 'c')) {
        setSkinState(stored);
      }
    } catch {
      /* no-op */
    }
  }, []);

  const setSkin = (s: Skin) => {
    setSkinState(s);
    try { localStorage.setItem(STORAGE_KEY, s); } catch { /* no-op */ }
  };

  return (
    <SkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </SkinContext.Provider>
  );
}

export function useSkin(): SkinContextValue {
  const ctx = useContext(SkinContext);
  if (!ctx) throw new Error('useSkin must be used within SkinProvider');
  return ctx;
}
