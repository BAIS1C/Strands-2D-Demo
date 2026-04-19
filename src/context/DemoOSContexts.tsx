'use client';

import { createContext, type ReactNode } from 'react';
import type { QuestCallbacks } from '@/components/QuestChat/QuestChat';

/* ═══════════════════════════════════════════════════════════════
   EVOLUTION CONTEXT — 2026 ↔ Year 555 (2589 CE)
   Canon: Year 0 = 2034, Game Present = Year 555 = 2589 CE
   ═══════════════════════════════════════════════════════════════ */

export interface EvolutionState {
  era: '2026' | 'year555';
  syncValue: number;
  bridgeLevel: number;
}

export const EvolutionContext = createContext<EvolutionState>({
  era: '2026',
  syncValue: 375,
  bridgeLevel: 3,
});

/* ═══════════════════════════════════════════════════════════════
   QUEST CONTEXT — Shared between DemoOS and QuestChat.
   Allows AppContent to access quest callbacks and triggers
   without prop drilling through Window components.
   ═══════════════════════════════════════════════════════════════ */

export interface QuestState {
  callbacks: QuestCallbacks;
  externalTrigger: string;
  questPhase: string;
  desktopFiles: { name: string; icon: string; renamed?: boolean }[];
}

export const QuestContext = createContext<QuestState | null>(null);

/* ═══════════════════════════════════════════════════════════════
   AVATAR CONTEXT — Character Studio integration (replaced Avaturn).
   GLB blob URL is created from ArrayBuffer received via postMessage
   from the Character Studio iframe.
   ═══════════════════════════════════════════════════════════════ */

export interface AvatarState {
  glbUrl: string | null;
  mode: 'create' | 'preview';
  setMode: (m: 'create' | 'preview') => void;
  onAvatarExported: (glbArrayBuffer: ArrayBuffer) => void;
}

export const AvatarContext = createContext<AvatarState | null>(null);

/* ═══════════════════════════════════════════════════════════════
   PROVIDER COMPOSITION — single wrapper around all three contexts.
   The shell page builds the three values from local state and hands
   them in as props; this component is a composition-only shim.
   ═══════════════════════════════════════════════════════════════ */

interface DemoOSProvidersProps {
  evolution: EvolutionState;
  quest: QuestState;
  avatar: AvatarState;
  children: ReactNode;
}

export function DemoOSProviders({ evolution, quest, avatar, children }: DemoOSProvidersProps) {
  return (
    <EvolutionContext.Provider value={evolution}>
      <QuestContext.Provider value={quest}>
        <AvatarContext.Provider value={avatar}>
          {children}
        </AvatarContext.Provider>
      </QuestContext.Provider>
    </EvolutionContext.Provider>
  );
}
