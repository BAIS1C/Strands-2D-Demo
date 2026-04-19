/* ═══════════════════════════════════════════════════════════════
   APP REGISTRY — Your Desktop in 2026
   Standard OS apps + installed Strands software.

   DEMO STAGING NOTE: This demoOS shows items UNLOCKED that would
   normally require completing the quest line to access. The point
   is wow factor — investors/visitors see the full capability without
   having to play through the onboarding. Gener8 (ACE Step) and
   other sync-gated/locked apps are set to 'available' here for demo.
   In the real game, these gate behind Bridge Levels and Sync thresholds.
   ═══════════════════════════════════════════════════════════════ */

export type AppState = 'available' | 'locked' | 'ghosted' | 'hidden';

export interface AppManifest {
  id: string;
  label: string;
  icon: string;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  state: AppState;
  lockMessage?: string;
  hasNotification?: boolean;
  syncGated?: number; // sync threshold to unlock
  /** S³ tier — triggers particle-style icon rendering */
  tier?: 'gener8' | 'daw' | 'vid' | 'styleforge';
}

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
  preMaxBounds?: { x: number; y: number; width: number; height: number };
}

/** Taskbar height in px — used for window placement calculations. */
export const TASKBAR_H = 48;

/** IDs classified as "Standard OS" apps (rendered in the top icon group). */
export const STANDARD_IDS: string[] = ['my-computer', 'my-pictures', 'my-videos', 'music-player'];

export const APP_REGISTRY: AppManifest[] = [
  // ── S³ Suite — particle-style branded icons (top of grid) ──
  { id: 'gener8',        label: 'Gener8',                icon: '🎵', minWidth: 480, minHeight: 600, defaultWidth: 520, defaultHeight: 640, state: 'available', tier: 'gener8' },
  { id: 's3-daw',        label: 'DAW',                   icon: '🎛️', minWidth: 480, minHeight: 600, defaultWidth: 520, defaultHeight: 640, state: 'locked', tier: 'daw', lockMessage: 'S³ DAW — Coming Soon to Everywear' },
  { id: 's3-vid',        label: 'Vid',                   icon: '🎬', minWidth: 480, minHeight: 600, defaultWidth: 520, defaultHeight: 640, state: 'locked', tier: 'vid', lockMessage: 'S³ Vid — Coming Soon to Everywear' },
  { id: 'library',       label: 'Strands Library',       icon: '📚', minWidth: 400, minHeight: 500, defaultWidth: 500, defaultHeight: 600, state: 'available' },

  // ── Standard OS ──
  { id: 'my-computer',   label: 'My Computer',         icon: '💻', minWidth: 400, minHeight: 360, defaultWidth: 480, defaultHeight: 420, state: 'available' },
  { id: 'my-pictures',   label: 'My Pictures',          icon: '🖼️', minWidth: 360, minHeight: 340, defaultWidth: 420, defaultHeight: 400, state: 'available' },
  { id: 'my-videos',     label: 'My Videos',            icon: '🎬', minWidth: 360, minHeight: 340, defaultWidth: 420, defaultHeight: 400, state: 'available' },
  { id: 'music-player',  label: 'Music Player',          icon: '🎶', minWidth: 300, minHeight: 360, defaultWidth: 380, defaultHeight: 520, state: 'available' },

  // ── Strands installed apps — available ──
  { id: 'signal-reg',    label: 'Signal Reg',           icon: '📡', minWidth: 320, minHeight: 400, defaultWidth: 380, defaultHeight: 460, state: 'available' },
  { id: 'messages',      label: 'Messages',             icon: '💬', minWidth: 400, minHeight: 500, defaultWidth: 500, defaultHeight: 700, state: 'available', hasNotification: true },
  { id: 'bridge-app',    label: 'CPU-VPU Bridge',       icon: '🌉', minWidth: 400, minHeight: 480, defaultWidth: 440, defaultHeight: 520, state: 'available' },
  { id: 'codex',         label: 'The Codex',            icon: '📖', minWidth: 400, minHeight: 500, defaultWidth: 500, defaultHeight: 600, state: 'available' },
  { id: 'signal-monitor',label: 'Signal Monitor',       icon: '📺', minWidth: 440, minHeight: 500, defaultWidth: 480, defaultHeight: 540, state: 'available' },
  { id: 'mymories',      label: 'Mymories',             icon: '🧠', minWidth: 360, minHeight: 440, defaultWidth: 400, defaultHeight: 480, state: 'available' },
  { id: 'myconsent',     label: 'MyConsent',             icon: '🛡️', minWidth: 400, minHeight: 400, defaultWidth: 460, defaultHeight: 480, state: 'available' },

  // ── Avatar Creator — Character Studio integration ──
  { id: 'avatar-creator', label: 'Avatar Creator', icon: '🧬', minWidth: 520, minHeight: 600, defaultWidth: 680, defaultHeight: 720, state: 'available' },

  // ── Sync-gated — show progress bar until threshold ──
  { id: 'signal-training', label: 'Signal Training',    icon: '🎯', minWidth: 640, minHeight: 480, defaultWidth: 800, defaultHeight: 600, state: 'locked', lockMessage: 'Signal Training — Coming Soon' },
  { id: 'arcade-2042',   label: 'Arcade 2042',          icon: '🕹️', minWidth: 480, minHeight: 620, defaultWidth: 500, defaultHeight: 680, state: 'available' },
  { id: 'holo-lock',     label: 'Circuit Sync',          icon: '🔓', minWidth: 520, minHeight: 500, defaultWidth: 540, defaultHeight: 540, state: 'available' },

  // ── Locked apps — visible but inaccessible ──
  { id: 'voice-sync',    label: 'Voice Sync',           icon: '🎙️', minWidth: 400, minHeight: 300, defaultWidth: 400, defaultHeight: 340, state: 'locked', lockMessage: 'Requires Signal Registration' },
  { id: 'cipher-tool',   label: 'Cipher Tool',          icon: '🔐', minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'locked', lockMessage: 'Requires Escalation Protocol' },
  { id: 'trading-post',  label: 'Trading Post',         icon: '💰', minWidth: 360, minHeight: 440, defaultWidth: 400, defaultHeight: 480, state: 'locked', lockMessage: 'Bridge Level 5 Required' },
  { id: 'signal-rush',   label: 'Signal Rush',          icon: '🚀', minWidth: 360, minHeight: 600, defaultWidth: 380, defaultHeight: 640, state: 'locked', lockMessage: 'Coming Soon' },

  // ── Hidden — dashed borders, glitch teasers ──
  { id: 'kasai-terminal', label: '???',                 icon: '?',  minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden' },
  { id: 'portal',         label: 'The Portal',          icon: '🌀', minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden' },
  // ACE Studio is now 'gener8' — promoted to available for demo wow factor
];
