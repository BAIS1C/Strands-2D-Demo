'use client';

import { useState, useCallback, useRef, useEffect, createContext, useContext, useMemo } from 'react';
import styles from './page.module.css';
import { playlist as generatedPlaylist } from '@/constants/playlist';
import QuestChat from '@/components/QuestChat/QuestChat';
import type { QuestCallbacks, AssessmentProfile } from '@/components/QuestChat/QuestChat';
import DesktopContextMenu from '@/components/DesktopContextMenu/DesktopContextMenu';
import SignalSync from '@/components/SignalSync/SignalSync';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ═══════════════════════════════════════════════════════════════
   AUDIO TYPES — normalise the auto-generated playlist
   ═══════════════════════════════════════════════════════════════ */

type RawTrack = { src?: string; title?: string; artist?: string; ttl?: string; artst?: string; file?: string };
type NormTrack = { file: string; title: string; artist: string };

const normalizeTrack = (t: RawTrack): NormTrack => ({
  file: t.file ?? t.src ?? '',
  title: t.title ?? t.ttl ?? 'Unknown Track',
  artist: t.artist ?? t.artst ?? '',
});

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type AppState = 'available' | 'locked' | 'ghosted' | 'hidden';

interface AppManifest {
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

interface WindowState {
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

/* ═══════════════════════════════════════════════════════════════
   EVOLUTION CONTEXT — 2026 ↔ Year 555 (2589 CE)
   Canon: Year 0 = 2034, Game Present = Year 555 = 2589 CE
   ═══════════════════════════════════════════════════════════════ */

interface EvolutionState {
  era: '2026' | 'year555';
  syncValue: number;
  bridgeLevel: number;
}

const EvolutionContext = createContext<EvolutionState>({
  era: '2026', syncValue: 375, bridgeLevel: 3,
});

/* ═══════════════════════════════════════════════════════════════
   QUEST CONTEXT — Shared between DemoOS and QuestChat
   Allows AppContent to access quest callbacks and triggers
   without prop drilling through Window components.
   ═══════════════════════════════════════════════════════════════ */

interface QuestState {
  callbacks: QuestCallbacks;
  externalTrigger: string;
  questPhase: string;
  desktopFiles: { name: string; icon: string; renamed?: boolean }[];
}

const QuestContext = createContext<QuestState | null>(null);

/* ═══════════════════════════════════════════════════════════════
   AVATAR CONTEXT — Character Studio integration (replaced Avaturn)
   GLB blob URL is created from ArrayBuffer received via postMessage
   from the Character Studio iframe.
   ═══════════════════════════════════════════════════════════════ */

interface AvatarState {
  glbUrl: string | null;
  mode: 'create' | 'preview';
  setMode: (m: 'create' | 'preview') => void;
  onAvatarExported: (glbArrayBuffer: ArrayBuffer) => void;
}

const AvatarContext = createContext<AvatarState | null>(null);

/* ═══════════════════════════════════════════════════════════════
   APP REGISTRY — Your Desktop in 2026
   Standard OS apps + installed Strands software

   DEMO STAGING NOTE: This demoOS shows items UNLOCKED that would
   normally require completing the quest line to access. The point
   is wow factor — investors/visitors see the full capability without
   having to play through the onboarding. SoundWave (ACE Step) and
   other sync-gated/locked apps are set to 'available' here for demo.
   In the real game, these gate behind Bridge Levels and Sync thresholds.
   ═══════════════════════════════════════════════════════════════ */

const APP_REGISTRY: AppManifest[] = [
  // ── S³ Suite — particle-style branded icons (top of grid) ──
  { id: 'soundwave',     label: 'Gener8',                icon: '🎵', minWidth: 480, minHeight: 600, defaultWidth: 520, defaultHeight: 640, state: 'available', tier: 'gener8' },
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
  // ACE Studio is now 'soundwave' — promoted to available for demo wow factor
];

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION TOAST — pops up when clicking locked icons
   ═══════════════════════════════════════════════════════════════ */

function NotificationToast({ message, toastKey, onDismiss }: { message: string; toastKey: number; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [toastKey, onDismiss]);

  return (
    <div className={styles.toast} key={toastKey}>
      <span className={styles.toastIcon}>🔒</span>
      <span className={styles.toastMsg}>{message}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOUNDWAVE PLAYER — Real audio player using the Strands playlist
   Self-contained component with its own audio element.
   Audio persists when window is minimized (CSS hidden, not unmounted).
   ═══════════════════════════════════════════════════════════════ */

function MusicPlayerContent() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const tracks = useMemo<NormTrack[]>(
    () => (Array.isArray(generatedPlaylist) ? generatedPlaylist.map(normalizeTrack).filter(t => !!t.file) : []),
    [],
  );

  const [playing, setPlaying] = useState(false);
  const [trackIdx, setTrackIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);

  const track = tracks[trackIdx];

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Toggle play/pause
  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play().catch(() => {}); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  }, []);

  // Skip tracks
  const skip = useCallback((dir: 1 | -1) => {
    setTrackIdx(prev => {
      const next = prev + dir;
      if (next < 0) return tracks.length - 1;
      if (next >= tracks.length) return 0;
      return next;
    });
  }, [tracks.length]);

  // Select specific track
  const selectTrack = useCallback((idx: number) => {
    setTrackIdx(idx);
    setPlaying(true);
  }, []);

  // Seek
  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !durationSec) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    a.currentTime = Math.max(0, Math.min(1, pct)) * durationSec;
  }, [durationSec]);

  // Volume sync
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = volume;
    a.muted = muted;
  }, [volume, muted]);

  // Load new track
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !track) return;
    setProgress(0);
    setDurationSec(0);
    a.load();
    if (playing) a.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIdx]);

  // Audio events
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setProgress(a.currentTime || 0);
    const onMeta = () => setDurationSec(a.duration || 0);
    const onEnd = () => skip(1);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, [skip]);

  if (!track || tracks.length === 0) {
    return (
      <div className={styles.appBody}>
        <div className={styles.appHeader}>STRANDS SOUND WAVE</div>
        <div className={styles.placeholderContent}>
          <div className={styles.placeholderIcon}>🎵</div>
          <div>No tracks found.</div>
        </div>
      </div>
    );
  }

  const pct = durationSec ? (progress / durationSec) * 100 : 0;

  return (
    <div className={styles.appBody}>
      <div className={styles.appHeader}>STRANDS SOUND WAVE</div>
      <audio ref={audioRef} preload="metadata">
        <source src={track.file} type="audio/mpeg" />
      </audio>
      <div className={styles.musicPlayer}>
        <div className={styles.trackInfo}>
          <div className={styles.trackTitle}>{track.title}</div>
          <div className={styles.trackArtist}>{track.artist}</div>
        </div>

        {/* Waveform visualiser — animated bars, highlight based on progress */}
        <div className={styles.waveform}>
          {Array.from({ length: 32 }).map((_, i) => {
            const barPct = (i / 32) * 100;
            const isPlayed = barPct <= pct;
            return (
              <div
                key={i}
                className={styles.waveBar}
                style={{
                  height: `${20 + Math.sin(i * 0.7) * 30 + Math.cos(i * 1.3) * 25}%`,
                  animationDelay: `${i * 0.05}s`,
                  opacity: isPlayed ? 1 : 0.35,
                  animationPlayState: playing ? 'running' : 'paused',
                }}
              />
            );
          })}
        </div>

        {/* Transport controls */}
        <div className={styles.playerControls}>
          <button className={styles.playerBtn} onClick={() => skip(-1)}>⏮</button>
          <button className={`${styles.playerBtn} ${styles.playerBtnPlay}`} onClick={toggle}>
            {playing ? '⏸' : '▶'}
          </button>
          <button className={styles.playerBtn} onClick={() => skip(1)}>⏭</button>
          <button className={styles.playerBtn} onClick={() => setMuted(m => !m)}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>

        {/* Seek bar */}
        <div className={styles.progressTrack} onClick={seekTo} style={{ cursor: 'pointer' }}>
          <div className={styles.progressFill} style={{ width: `${pct}%`, transition: 'width 0.1s linear' }} />
        </div>
        <div className={styles.trackTime}>{fmt(progress)} / {fmt(durationSec || 0)}</div>

        {/* Volume slider */}
        <input
          type="range"
          min={0}
          max={100}
          value={muted ? 0 : Math.round(volume * 100)}
          onChange={(e) => { const v = Number(e.target.value) / 100; setVolume(v); if (v > 0) setMuted(false); }}
          aria-label="Volume"
          style={{ width: '100%', height: '2px', accentColor: 'var(--c-accent, #00C2FF)' }}
        />

        {/* Playlist */}
        <div className={styles.playlist}>
          <div className={styles.playlistHeader}>SOUNDTRACK</div>
          {tracks.map((t, i) => (
            <div
              key={`${t.file}-${i}`}
              className={`${styles.playlistItem} ${i === trackIdx ? styles.playlistItemActive : ''}`}
              onClick={() => selectTrack(i)}
            >
              <span>{i === trackIdx && playing ? '▶' : '♫'}</span>
              {t.title} — {t.artist}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOUNDWAVE LAUNCHER — Preliminary screen: run in-window or new tab
   ═══════════════════════════════════════════════════════════════ */

function SoundWaveLauncher() {
  const [mode, setMode] = useState<'choose' | 'iframe'>('choose');

  if (mode === 'iframe') {
    return (
      <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 12px', background: 'rgba(0,194,255,0.06)',
            borderBottom: '1px solid rgba(0,194,255,0.12)', fontSize: '0.75rem',
            color: '#a0aec0', flexShrink: 0,
          }}
        >
          <span>🎵 Strands SoundWave — ACE Step Studio</span>
          <button
            onClick={() => setMode('choose')}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#a0aec0', padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
              fontSize: '0.7rem',
            }}
          >
            ← Back
          </button>
        </div>
        <iframe
          src="/stepstudio/app"
          title="S³ Gener8 — Music Studio"
          style={{ flex: 1, width: '100%', border: 'none', background: '#0a0a0f', borderRadius: '0 0 4px 4px' }}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    );
  }

  return (
    <div className={styles.appBody} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
      <div style={{ fontSize: '3rem', lineHeight: 1 }}>🎵</div>
      <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.1rem', color: '#00C2FF', textAlign: 'center', letterSpacing: 2 }}>
        S&#179; GENER8
      </div>
      <div style={{ fontSize: '0.78rem', color: '#a0aec0', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
        Your music. Your machine. Your rules. AI music generation powered by ACE-Step 1.5.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 280, marginTop: 8 }}>
        <button
          onClick={() => setMode('iframe')}
          style={{
            padding: '12px 16px', borderRadius: 6, border: '1px solid rgba(0,194,255,0.3)',
            background: 'linear-gradient(135deg, rgba(0,194,255,0.12), rgba(139,92,246,0.08))',
            color: '#00C2FF', cursor: 'pointer', fontFamily: "'Orbitron', sans-serif",
            fontSize: '0.8rem', letterSpacing: 1, transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,194,255,0.22), rgba(139,92,246,0.16))'; e.currentTarget.style.borderColor = 'rgba(0,194,255,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,194,255,0.12), rgba(139,92,246,0.08))'; e.currentTarget.style.borderColor = 'rgba(0,194,255,0.3)'; }}
        >
          ▶ RUN IN WINDOW
        </button>
        <button
          onClick={() => window.open('/stepstudio/app', '_blank')}
          style={{
            padding: '12px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)', color: '#a0aec0', cursor: 'pointer',
            fontFamily: "'Rajdhani', sans-serif", fontSize: '0.85rem', letterSpacing: 0.5,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#e2e8f0'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#a0aec0'; }}
        >
          ↗ OPEN IN NEW TAB
        </button>
      </div>
      <div style={{ fontSize: '0.65rem', color: 'rgba(160,174,192,0.5)', textAlign: 'center', marginTop: 8 }}>
        Demo mode · Max 30s tracks · 5 generations/hour
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CHARACTER STUDIO — Iframe embed for avatar creation
   Uses CharacterStudio-Strands (open source VRM/GLB avatar builder).
   Player creates and customises their avatar with trait-based parts,
   then clicks "USE IN GAME" which sends the optimised GLB via
   postMessage. The GLB becomes the player's in-game character model.

   CONFIGURATION: Set CHARACTER_STUDIO_URL below to wherever
   Character Studio is deployed (subdomain, Vercel, or localhost).
   ═══════════════════════════════════════════════════════════════ */

const CHARACTER_STUDIO_URL = process.env.NEXT_PUBLIC_CHARACTER_STUDIO_URL || '/studio';

function CharacterStudioCreator({ onExport }: { onExport: (glb: ArrayBuffer) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  // Listen for Character Studio export messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.source === 'character-studio' && e.data?.eventName === 'avatar.exported') {
        const glbData = e.data?.data?.glb;
        if (glbData instanceof ArrayBuffer) {
          onExport(glbData);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onExport]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Loading overlay */}
      {!loaded && !error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '12px',
          background: 'rgba(3,3,4,0.98)', zIndex: 2,
        }}>
          <div style={{
            width: '24px', height: '24px', border: '2px solid rgba(0,194,255,0.2)',
            borderTopColor: '#00C2FF', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{
            font: '500 11px var(--font-display, Orbitron, monospace)',
            color: 'var(--c-accent, #00C2FF)', letterSpacing: '1px',
          }}>LOADING CHARACTER STUDIO...</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Error / fallback state */}
      {error && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px',
        }}>
          <span style={{ fontSize: '36px' }}>🧬</span>
          <span style={{
            font: '600 13px var(--font-display, Orbitron, monospace)',
            color: 'var(--c-accent, #00C2FF)', letterSpacing: '1px', textAlign: 'center',
          }}>CHARACTER STUDIO</span>
          <span style={{
            font: '400 12px var(--font-body, Rajdhani, sans-serif)',
            color: 'var(--c-sub, #A0AEC0)', textAlign: 'center', maxWidth: '320px', lineHeight: '1.6',
          }}>
            Build your signal avatar from modular VRM parts.
            Your identity persists across the Strands metaverse — every game, every world, every interaction.
          </span>
          <button
            onClick={() => { setError(false); setLoaded(false); }}
            style={{
              padding: '8px 20px', background: 'rgba(0,194,255,0.1)',
              border: '1px solid var(--c-accent, #00C2FF)', borderRadius: '6px',
              font: '700 10px var(--font-display, Orbitron, monospace)',
              color: '#00C2FF', letterSpacing: '1px', cursor: 'pointer',
              marginTop: '8px',
            }}
          >RETRY</button>
        </div>
      )}

      {/* Character Studio iframe */}
      <iframe
        ref={iframeRef}
        src={CHARACTER_STUDIO_URL}
        title="Character Studio — Strands Avatar Creator"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        allow="camera; microphone; clipboard-write"
        style={{
          flex: 1, width: '100%', border: 'none',
          background: '#0A0B0D',
          display: error ? 'none' : 'block',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AVATAR PREVIEW — Three.js inline renderer for the exported GLB
   Shows a rotating view of the player's avatar with orbit controls.
   ═══════════════════════════════════════════════════════════════ */

function AvatarPreview({ glbUrl }: { glbUrl: string }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<{ cleanup: () => void } | null>(null);

  useEffect(() => {
    if (!mountRef.current || !glbUrl) return;

    // Dynamic import pattern — Three.js is already loaded globally
    // but GLTFLoader needs the module import
    let cancelled = false;

    const initScene = async () => {
      if (cancelled || !mountRef.current) return;

      const container = mountRef.current;
      const w = container.clientWidth;
      const h = container.clientHeight;

      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0A0B0D);
      scene.fog = new THREE.FogExp2(0x0A0B0D, 0.02);

      // Camera
      const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
      camera.position.set(0, 1.2, 3);
      camera.lookAt(0, 0.9, 0);

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.9;
      renderer.shadowMap.enabled = true;
      container.appendChild(renderer.domElement);

      // Lights
      const ambient = new THREE.AmbientLight(0x1a1a2e, 0.6);
      scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0x88bbff, 0.8);
      keyLight.position.set(2, 4, 3);
      keyLight.castShadow = true;
      scene.add(keyLight);

      const rimLight = new THREE.PointLight(0x00C2FF, 0.6, 10);
      rimLight.position.set(-2, 2, -1);
      scene.add(rimLight);

      const fillLight = new THREE.PointLight(0xF000B8, 0.3, 10);
      fillLight.position.set(1, 0.5, 2);
      scene.add(fillLight);

      // Ground disc
      const groundGeo = new THREE.CircleGeometry(2, 48);
      const groundMat = new THREE.MeshStandardMaterial({
        color: 0x0A0B0D, roughness: 0.8, metalness: 0.2,
      });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      // Ground ring glow
      const ringGeo = new THREE.RingGeometry(1.8, 2.0, 64);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00C2FF, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.01;
      scene.add(ring);

      // Grid helper
      const grid = new THREE.GridHelper(4, 20, 0x00C2FF, 0x00C2FF);
      (grid.material as THREE.Material).opacity = 0.06;
      (grid.material as THREE.Material).transparent = true;
      scene.add(grid);

      // Load avatar GLB
      let mixer: THREE.AnimationMixer | null = null;
      try {
        const loader = new GLTFLoader();
        const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
          loader.load(glbUrl, resolve, undefined, reject);
        });

        if (cancelled) return;

        const avatar = gltf.scene;
        avatar.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).castShadow = true;
            (child as THREE.Mesh).receiveShadow = true;
          }
        });

        // Center and scale avatar
        const box = new THREE.Box3().setFromObject(avatar);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.7 / maxDim; // Normalise to ~1.7m height
        avatar.scale.setScalar(scale);
        avatar.position.y = -(center.y * scale - size.y * scale / 2);
        avatar.position.x = -center.x * scale;
        avatar.position.z = -center.z * scale;

        scene.add(avatar);

        // Play animations if available
        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(avatar);
          const idle = gltf.animations[0];
          mixer.clipAction(idle).play();
        }
      } catch (err) {
        console.warn('[AvatarPreview] Failed to load GLB:', err);
        // Show fallback wireframe humanoid
        const bodyGeo = new THREE.CapsuleGeometry(0.25, 0.8, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00C2FF, wireframe: true, transparent: true, opacity: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.9;
        scene.add(body);

        const headGeo = new THREE.SphereGeometry(0.18, 12, 12);
        const head = new THREE.Mesh(headGeo, bodyMat);
        head.position.y = 1.55;
        scene.add(head);
      }

      // Mouse orbit
      let theta = 0;
      let phi = Math.PI / 6;
      let radius = 3;
      let isDragging = false;
      let lastX = 0;
      let lastY = 0;

      const onDown = (e: MouseEvent) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
      const onUp = () => { isDragging = false; };
      const onMove = (e: MouseEvent) => {
        if (!isDragging) return;
        theta -= (e.clientX - lastX) * 0.008;
        phi = Math.max(0.1, Math.min(Math.PI / 2.2, phi + (e.clientY - lastY) * 0.008));
        lastX = e.clientX;
        lastY = e.clientY;
      };
      const onWheel = (e: WheelEvent) => {
        radius = Math.max(1.5, Math.min(6, radius + e.deltaY * 0.003));
      };

      renderer.domElement.addEventListener('mousedown', onDown);
      window.addEventListener('mouseup', onUp);
      renderer.domElement.addEventListener('mousemove', onMove);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: true });

      // Animation loop
      const clock = new THREE.Clock();
      let animId: number;

      const animate = () => {
        animId = requestAnimationFrame(animate);
        const dt = clock.getDelta();

        // Auto-rotate slowly when not dragging
        if (!isDragging) theta += dt * 0.3;

        // Update camera orbit
        camera.position.x = Math.sin(theta) * Math.cos(phi) * radius;
        camera.position.y = Math.sin(phi) * radius + 0.5;
        camera.position.z = Math.cos(theta) * Math.cos(phi) * radius;
        camera.lookAt(0, 0.9, 0);

        // Animate ring glow
        ringMat.opacity = 0.1 + Math.sin(Date.now() * 0.002) * 0.05;

        if (mixer) mixer.update(dt);
        renderer.render(scene, camera);
      };
      animate();

      // Resize handler
      const onResize = () => {
        if (!container) return;
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
      };
      const resizeObs = new ResizeObserver(onResize);
      resizeObs.observe(container);

      // Store cleanup
      rendererRef.current = {
        cleanup: () => {
          cancelAnimationFrame(animId);
          resizeObs.disconnect();
          renderer.domElement.removeEventListener('mousedown', onDown);
          window.removeEventListener('mouseup', onUp);
          renderer.domElement.removeEventListener('mousemove', onMove);
          renderer.domElement.removeEventListener('wheel', onWheel);
          renderer.dispose();
          if (container.contains(renderer.domElement)) {
            container.removeChild(renderer.domElement);
          }
        }
      };
    };

    initScene();

    return () => {
      cancelled = true;
      rendererRef.current?.cleanup();
      rendererRef.current = null;
    };
  }, [glbUrl]);

  return (
    <div ref={mountRef} style={{
      flex: 1, width: '100%', cursor: 'grab', position: 'relative', overflow: 'hidden',
    }}>
      {/* HUD overlay */}
      <div style={{
        position: 'absolute', bottom: '12px', left: '14px', right: '14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        pointerEvents: 'none',
      }}>
        <span style={{
          font: '400 10px var(--font-display, Orbitron, monospace)',
          color: 'var(--c-dim, #4A5568)', letterSpacing: '0.5px',
        }}>DRAG TO ORBIT · SCROLL TO ZOOM</span>
        <span style={{
          font: '600 10px var(--font-display, Orbitron, monospace)',
          color: 'var(--c-accent, #00C2FF)', letterSpacing: '1px',
        }}>AVATAR LOADED</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   APP CONTENT — What each window shows when opened
   ═══════════════════════════════════════════════════════════════ */

function AppContent({ appId }: { appId: string }) {
  const evo = useContext(EvolutionContext);

  // Sync-gated apps show progress bar if below threshold
  const app = APP_REGISTRY.find(a => a.id === appId);
  if (app?.syncGated && evo.syncValue < app.syncGated) {
    const pct = Math.round((evo.syncValue / app.syncGated) * 100);
    return (
      <div className={styles.appBody}>
        <div className={styles.appHeader}>{app.label.toUpperCase()}</div>
        <div className={styles.syncGateContainer}>
          <div className={styles.syncGateIcon}>{app.icon}</div>
          <div className={styles.syncGateTitle}>CALIBRATING...</div>
          <div className={styles.syncGateText}>
            Sync {evo.syncValue} / {app.syncGated} required
          </div>
          <div className={styles.syncGateBar}>
            <div className={styles.syncGateFill} style={{ width: `${pct}%` }} />
          </div>
          <div className={styles.syncGatePct}>{pct}% — Substrate building</div>
        </div>
      </div>
    );
  }

  switch (appId) {
    case 'my-computer':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>MY COMPUTER</div>
          <div className={styles.fileList}>
            <div className={styles.fileItem}><span>💾</span> Local Disk (C:)</div>
            <div className={styles.fileItem}><span>💾</span> Data (D:)</div>
            <div className={styles.fileItem}><span>📡</span> Signal Substrate (S:)</div>
            <div className={styles.fileItem}><span>🌐</span> Network</div>
            <div className={styles.fileItemDim}><span>⚠️</span> Unknown Device (X:) — <em>requires Bridge Level 5</em></div>
          </div>
          <div className={styles.systemInfo}>
            <div className={styles.sysRow}><span>OS</span><span>Strands OS v2026.3</span></div>
            <div className={styles.sysRow}><span>Processor</span><span>CPU-VPU Hybrid Bridge</span></div>
            <div className={styles.sysRow}><span>Memory</span><span>Expanding... (substrate-linked)</span></div>
            <div className={styles.sysRow}><span>Sync Status</span><span>{evo.syncValue} / 1,200</span></div>
          </div>
        </div>
      );

    case 'my-pictures':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>MY PICTURES</div>
          <div className={styles.fileList}>
            <div className={styles.fileItem}><span>📁</span> Screenshots</div>
            <div className={styles.fileItem}><span>📁</span> Signal Captures</div>
            <div className={styles.fileItem}><span>📁</span> Wallpapers</div>
            <div className={styles.fileItemDim}><span>📁</span> ▓▓▓ CORRUPTED ▓▓▓</div>
          </div>
        </div>
      );

    case 'my-videos':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>MY VIDEOS</div>
          <div className={styles.fileList}>
            <div className={styles.fileItemDim}><span>🔒</span> Proper Gander S0 — <em>Locked · Signal reconstruction in progress</em></div>
          </div>
          <div style={{ marginTop: '16px', borderTop: '1px solid rgba(0,194,255,0.1)', paddingTop: '12px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#A0AEC0', marginBottom: '10px' }}>SIGNAL FEEDS</div>
            <a href="https://youtube.com/@strandsnation" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: '#00C2FF', textDecoration: 'none', fontSize: '13px', letterSpacing: '1px', borderBottom: '1px solid rgba(0,194,255,0.06)' }}>
              <span style={{ fontSize: '16px' }}>▶</span> @strandsnation
            </a>
            <a href="https://www.youtube.com/@B4SICAI" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: '#00C2FF', textDecoration: 'none', fontSize: '13px', letterSpacing: '1px', borderBottom: '1px solid rgba(0,194,255,0.06)' }}>
              <span style={{ fontSize: '16px' }}>▶</span> @B4SICAI
            </a>
            <a href="https://www.youtube.com/@spacemanthedj" target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: '#00C2FF', textDecoration: 'none', fontSize: '13px', letterSpacing: '1px' }}>
              <span style={{ fontSize: '16px' }}>▶</span> @spacemanthedj
            </a>
          </div>
        </div>
      );

    case 'documents':
    case 'library':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>STRANDS LIBRARY</div>
          <div style={{ padding: '8px 12px', fontSize: '10px', color: 'rgba(255,255,255,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            Songs, stems, videos — shared across all S³ apps
          </div>
          <div className={styles.fileList}>
            <div className={styles.fileItem}><span>🎵</span> Generated Songs</div>
            <div className={styles.fileItem}><span>🎛️</span> Stem Separations</div>
            <div className={styles.fileItem}><span>🎬</span> Music Videos</div>
            <div className={styles.fileItem}><span>📁</span> Style Patches</div>
            <div className={styles.fileItem}><span>📁</span> Signal Transcripts</div>
            <div className={styles.fileItemDim}><span>📄</span> ▓▓▓_recovered_fragment_01.sig</div>
            <div className={styles.fileItemDim}><span>🔒</span> classified_sovcorp_memo.enc — <em>Decryption pending</em></div>
          </div>
        </div>
      );

    case 'music-player':
      return <MusicPlayerContent />;

    case 'soundwave':
      return <SoundWaveLauncher />;

    case 'avatar-creator': {
      // eslint-disable-next-line react-hooks/rules-of-hooks, no-case-declarations
      const avatarCtx = useContext(AvatarContext);
      if (!avatarCtx) return <div className={styles.appBody}><div className={styles.appHeader}>AVATAR CREATOR</div></div>;

      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header bar with mode toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 14px',
            background: 'rgba(10,11,13,0.98)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            flexShrink: 0,
          }}>
            <span style={{
              font: '600 11px var(--font-display, Orbitron, monospace)',
              color: 'var(--c-accent, #00C2FF)',
              letterSpacing: '1px',
            }}>
              {avatarCtx.mode === 'create' ? '◈ CHARACTER STUDIO' : '◈ AVATAR PREVIEW'}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => avatarCtx.setMode('create')}
                style={{
                  padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  font: '600 9px var(--font-display, Orbitron, monospace)',
                  letterSpacing: '0.5px',
                  background: avatarCtx.mode === 'create' ? 'rgba(0,194,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: avatarCtx.mode === 'create' ? '#00C2FF' : '#4A5568',
                }}
              >CREATE</button>
              <button
                onClick={() => avatarCtx.setMode('preview')}
                style={{
                  padding: '4px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  font: '600 9px var(--font-display, Orbitron, monospace)',
                  letterSpacing: '0.5px',
                  background: avatarCtx.mode === 'preview' ? 'rgba(0,194,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: avatarCtx.mode === 'preview' ? '#00C2FF' : '#4A5568',
                  opacity: avatarCtx.glbUrl ? 1 : 0.3,
                }}
                disabled={!avatarCtx.glbUrl}
              >PREVIEW</button>
            </div>
          </div>

          {/* Character Studio iframe or 3D preview */}
          {avatarCtx.mode === 'create' ? (
            <CharacterStudioCreator onExport={avatarCtx.onAvatarExported} />
          ) : avatarCtx.glbUrl ? (
            <AvatarPreview glbUrl={avatarCtx.glbUrl} />
          ) : (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: '12px', color: 'var(--c-dim, #4A5568)',
            }}>
              <span style={{ fontSize: '40px' }}>🧬</span>
              <span style={{ font: '400 12px var(--font-body, Rajdhani, sans-serif)' }}>
                No avatar created yet. Switch to CREATE mode.
              </span>
            </div>
          )}
        </div>
      );
    }

    case 'signal-reg':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>SIGNAL REGISTRATION</div>
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>👤</div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>AGENT-7749</div>
              <div className={styles.profileSub}>Signal Class: LATENT</div>
              <div className={styles.profileSub}>Clearance: UNVERIFIED</div>
              <div className={styles.profileSub}>Sync: {evo.syncValue} / 1,200</div>
            </div>
          </div>
          <div className={styles.statusBar}>
            <div className={styles.statusFill} style={{ width: `${(evo.syncValue / 1200) * 100}%` }} />
          </div>
          <div className={styles.statusLabel}>SUBSTRATE CALIBRATION: {Math.round((evo.syncValue / 1200) * 100)}%</div>
        </div>
      );

    case 'messages': {
      // Quest narrative lives here — QuestChat drives the entire onboarding
      // eslint-disable-next-line react-hooks/rules-of-hooks, no-case-declarations
      const quest = useContext(QuestContext);
      if (!quest) return <div className={styles.appBody}><div className={styles.appHeader}>MESSAGES</div></div>;
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <QuestChat
            callbacks={quest.callbacks}
            externalTrigger={quest.externalTrigger}
            onPhaseChange={(p) => { /* phase tracked at DemoOS level */ }}
          />
        </div>
      );
    }

    case 'bridge-app':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>CPU-VPU BRIDGE</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,194,255,0.1)', marginBottom: '8px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '2px', color: '#A0AEC0' }}>BRIDGE LEVEL</div>
            <div style={{ fontSize: '16px', letterSpacing: '3px', color: '#00C2FF', fontWeight: 'bold' }}>BL-{evo.bridgeLevel}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', marginBottom: '6px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#A0AEC0', minWidth: '40px' }}>SYNC</div>
            <div style={{ flex: 1, height: '6px', background: 'rgba(0,194,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${(evo.syncValue / 1200) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #00C2FF, #F000B8)', borderRadius: '3px', transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: '12px', letterSpacing: '1px', color: '#00C2FF', minWidth: '70px', textAlign: 'right' }}>{evo.syncValue} / 1,200</div>
          </div>
          <div className={styles.bridgeVis}>
            <div className={styles.bridgeRow}>
              {[1,2,3,4,5].map(l => (
                <div key={l} className={`${styles.bridgeNode} ${l <= evo.bridgeLevel ? styles.bridgeLit : l === evo.bridgeLevel + 1 ? styles.bridgePulse : styles.bridgeDim}`}>
                  L{l}
                </div>
              ))}
            </div>
            <div className={styles.bridgeRow}>
              {[6,7,8,9,10].map(l => (
                <div key={l} className={`${styles.bridgeNode} ${l <= evo.bridgeLevel ? styles.bridgeLit : l === evo.bridgeLevel + 1 ? styles.bridgePulse : styles.bridgeDim}`}>
                  L{l}
                </div>
              ))}
            </div>
          </div>
          <div className={styles.syncBreakdown}>
            <div className={styles.syncCategory}><span>Identity</span><div className={styles.syncBar}><div className={styles.syncFill} style={{width:'42%'}}/></div><span>85/200</span></div>
            <div className={styles.syncCategory}><span>Skill Training</span><div className={styles.syncBar}><div className={styles.syncFill} style={{width:'60%'}}/></div><span>120/200</span></div>
            <div className={styles.syncCategory}><span>Arcade</span><div className={styles.syncBar}><div className={styles.syncFill} style={{width:'47%'}}/></div><span>95/200</span></div>
            <div className={styles.syncCategory}><span>Crafting</span><div className={styles.syncBar}><div className={styles.syncFill} style={{width:'15%'}}/></div><span>30/200</span></div>
            <div className={styles.syncCategory}><span>Generative</span><div className={styles.syncBar}><div className={styles.syncFill} style={{width:'0%'}}/></div><span>0/200</span></div>
            <div className={styles.syncCategory}><span>Social</span><div className={styles.syncBar}><div className={styles.syncFill} style={{width:'22%'}}/></div><span>45/200</span></div>
          </div>
          <div className={styles.syncTotal}>TOTAL SYNC: {evo.syncValue} / 1,200</div>
          <div className={styles.calendarGate}>Play games and complete activities to increase your Sync. Bridge levels unlock at milestones.</div>
        </div>
      );

    case 'codex':
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <div className={styles.appHeader} style={{ padding: '8px 12px' }}>THE CODEX</div>
          <iframe
            src="/codex"
            title="The Codex — StrandsNation"
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              background: 'var(--c-bg, #0A0B0D)',
              borderRadius: '0 0 4px 4px',
            }}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      );

    case 'signal-monitor':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>SIGNAL MONITOR</div>
          <div className={styles.monitorGlitch}>
            <div className={styles.monitorText}>RECONSTRUCTING SIGNAL...</div>
            <div className={styles.statusBar}>
              <div className={`${styles.statusFill} ${styles.statusFillAnimated}`} />
            </div>
            <div className={styles.monitorPreview}>
              <div className={styles.corruptedFrame}>
                <span>S0-03 // AURORA OMEGA — THE LESSON</span>
                <span className={styles.corrupt}>▓▓▒░░ SIGNAL JACK DETECTED ░░▒▓▓</span>
                <span className={styles.corrupt}>&quot;It didn&apos;t attack. It tried to negotiate.&quot;</span>
              </div>
            </div>
          </div>
        </div>
      );

    case 'mymories':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>MYMORIES // MEMORY SOVEREIGNTY</div>
          <div className={styles.mymoriesLanding}>
            <div className={styles.mymoriesHero}>
              <div className={styles.mymoriesIcon}>🧠</div>
              <div className={styles.mymoriesTagline}>Your AI Conversations. Your Knowledge. Your Data.</div>
            </div>
            <div className={styles.mymoriesDesc}>
              MyMories is a Chrome extension that captures, organises, and gives you ownership of your AI conversations across every LLM platform — ChatGPT, Claude, Gemini, and more.
            </div>
            <div className={styles.mymoriesFeatures}>
              <div className={styles.mymoriesFeature}><span>◆</span> Cross-LLM knowledge capture</div>
              <div className={styles.mymoriesFeature}><span>◆</span> Searchable conversation vault</div>
              <div className={styles.mymoriesFeature}><span>◆</span> Player-owned data sovereignty</div>
              <div className={styles.mymoriesFeature}><span>◆</span> Export, delete, control — your rules</div>
            </div>
            <div className={styles.mymoriesNarrative}>
              In the Strands universe, some tools exist both inside the fiction and outside it. MyMories is the first bridge between your game identity and your real-world AI footprint.
            </div>
            <a href="https://github.com/BAIS1C/MyMories-ChromeExtension" target="_blank" rel="noopener noreferrer" className={styles.mymoriesInstallBtn}>
              📥 INSTALL MYMORIES — GitHub
            </a>
            <a href="https://github.com/BAIS1C/MyMories-ChromeExtension#readme" target="_blank" rel="noopener noreferrer" className={styles.mymoriesDocsBtn}>
              📖 READ THE DOCS
            </a>
            <div className={styles.mymoriesQuote}>&ldquo;I am my own key.&rdquo; — §559</div>
          </div>
        </div>
      );

    case 'arcade-2042':
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <iframe
            src="/games/2042.html"
            title="Arcade 2042 — Signal Arcade"
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              background: '#030304',
              borderRadius: '0 0 4px 4px',
            }}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      );

    case 'circuit-sync-quest':
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <iframe
            src="/games/holo-lock.html"
            title="Circuit Sync — Node Alignment"
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              background: '#030304',
              borderRadius: '0 0 4px 4px',
            }}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      );

    case 'myconsent':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>MYCONSENT // DATA SOVEREIGNTY</div>
          <div className={styles.consentPanel}>
            <div className={styles.consentStatus}>
              <span className={styles.consentDot} />
              <span>Consent Protocol: ACTIVE</span>
            </div>
            <div className={styles.consentSection}>
              <div className={styles.consentLabel}>Identity Data</div>
              <div className={styles.consentRow}><span>Biometric Hash</span><span className={styles.consentGranted}>GRANTED</span></div>
              <div className={styles.consentRow}><span>Signal Fingerprint</span><span className={styles.consentGranted}>GRANTED</span></div>
              <div className={styles.consentRow}><span>Location Telemetry</span><span className={styles.consentGranted}>GRANTED</span></div>
            </div>
            <div className={styles.consentSection}>
              <div className={styles.consentLabel}>Behavioural Data</div>
              <div className={styles.consentRow}><span>Interaction Patterns</span><span className={styles.consentGranted}>GRANTED</span></div>
              <div className={styles.consentRow}><span>Game Sync</span><span className={styles.consentGranted}>GRANTED</span></div>
              <div className={styles.consentRow}><span>Emotional Mapping</span><span className={styles.consentGranted}>GRANTED</span></div>
            </div>
            <div className={styles.consentFooter}>Your data. Your rules. Consent protocol enforced.</div>
          </div>
        </div>
      );

    case 'signal-training': {
      // eslint-disable-next-line react-hooks/rules-of-hooks, no-case-declarations
      const avatarCtxForGame = useContext(AvatarContext);
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <iframe
            src="/games/strands-tutorial-fps.html"
            title="Signal Training — StrandsNation Tutorial"
            onLoad={(e) => {
              // Send the player's avatar GLB to the game iframe if available
              if (avatarCtxForGame?.glbUrl) {
                fetch(avatarCtxForGame.glbUrl)
                  .then(r => r.arrayBuffer())
                  .then(glb => {
                    const iframeWindow = (e.target as HTMLIFrameElement).contentWindow;
                    if (iframeWindow) {
                      iframeWindow.postMessage({
                        source: 'demoos',
                        eventName: 'load-avatar',
                        data: { glb }
                      }, '*');
                    }
                  })
                  .catch(err => console.warn('[DemoOS] Failed to send avatar to Signal Training:', err));
              }
            }}
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              background: '#0A0B0D',
              borderRadius: '0 0 4px 4px',
            }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-pointer-lock"
            allow="pointer-lock"
          />
        </div>
      );
    }

    case 'holo-lock':
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <iframe
            src="/games/holo-lock.html"
            title="Circuit Sync — Signal Breach"
            style={{
              flex: 1,
              width: '100%',
              border: 'none',
              background: '#030304',
              borderRadius: '0 0 4px 4px',
            }}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      );

    case 'quest-signal-sync': {
      // Signal Sync IS the video player. No separate video window.
      // The oscillating sync bar overlays the video field.
      // Keeping it balanced = video plays clearly. Lose it = static.
      // No play button. No timeline. Just the sync mechanic driving clarity.
      // eslint-disable-next-line react-hooks/rules-of-hooks, no-case-declarations
      const questCtx = useContext(QuestContext);
      // Determine round from quest phase
      const round = questCtx?.questPhase?.includes('3') ? 3 : questCtx?.questPhase?.includes('2') ? 2 : 1;
      const difficulty = round === 1 ? 0.3 : round === 2 ? 0.55 : 0.8;
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <SignalSync
            difficulty={difficulty}
            targetHoldTime={round === 1 ? 8 : round === 2 ? 12 : 16}
            round={round}
            label={`PROPER GANDER — EP${round}`}
            videoSrc="/video/pg-intro.mp4"
            onComplete={() => {
              questCtx?.callbacks.onNotify(`Signal Sync Round ${round} Complete!`);
            }}
            onStabilityChange={() => {}}
          />
        </div>
      );
    }

    default:
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>{appId.toUpperCase().replace(/-/g, ' ')}</div>
          <div className={styles.placeholderContent}>
            <div className={styles.placeholderIcon}>⬡</div>
            <div>Application loading...</div>
          </div>
        </div>
      );
  }
}

/* ═══════════════════════════════════════════════════════════════
   WINDOW COMPONENT
   ═══════════════════════════════════════════════════════════════ */

interface WindowProps {
  win: WindowState;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (w: number, h: number, x?: number, y?: number) => void;
  children: React.ReactNode;
}

const TASKBAR_H = 48;

function Window({ win, isActive, onFocus, onClose, onMinimize, onMaximize, onMove, onResize, children }: WindowProps) {
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startWinX: number; startWinY: number; edges: string } | null>(null);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (win.isMaximized) return;
    e.preventDefault();
    onFocus();
    dragRef.current = { startX: e.clientX, startY: e.clientY, winX: win.x, winY: win.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [win.x, win.y, win.isMaximized, onFocus]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    onMove(
      Math.max(0, Math.min(window.innerWidth - 100, dragRef.current.winX + dx)),
      Math.max(0, Math.min(window.innerHeight - TASKBAR_H - 36, dragRef.current.winY + dy)),
    );
  }, [onMove]);

  const handleDragEnd = useCallback(() => { dragRef.current = null; }, []);

  const handleResizeStart = useCallback((e: React.PointerEvent, edges: string) => {
    if (win.isMaximized) return;
    e.preventDefault(); e.stopPropagation(); onFocus();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: win.width, startH: win.height, startWinX: win.x, startWinY: win.y, edges };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [win.width, win.height, win.x, win.y, win.isMaximized, onFocus]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const r = resizeRef.current;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    let newW = r.startW, newH = r.startH, newX = r.startWinX, newY = r.startWinY;
    if (r.edges.includes('e')) newW = Math.max(win.minWidth, r.startW + dx);
    if (r.edges.includes('s')) newH = Math.max(win.minHeight, r.startH + dy);
    if (r.edges.includes('w')) { const d = Math.min(dx, r.startW - win.minWidth); newW = r.startW - d; newX = r.startWinX + d; }
    if (r.edges.includes('n')) { const d = Math.min(dy, r.startH - win.minHeight); newH = r.startH - d; newY = r.startWinY + d; }
    onResize(newW, newH, newX, newY);
  }, [win.minWidth, win.minHeight, onResize]);

  const handleResizeEnd = useCallback(() => { resizeRef.current = null; }, []);

  // Clamp top so the title bar is ALWAYS visible — never let a window escape above viewport
  const clampedY = Math.max(0, win.y);
  const windowStyle: React.CSSProperties = win.isMinimized
    ? { display: 'none' }
    : win.isMaximized
    ? { left: 0, top: 0, width: '100%', height: `calc(100vh - ${TASKBAR_H}px)`, zIndex: win.zIndex }
    : { left: win.x, top: clampedY, width: win.width, height: win.height, zIndex: win.zIndex };

  const edges = ['n','ne','e','se','s','sw','w','nw'];

  return (
    <div className={`${styles.window} ${isActive ? styles.windowActive : ''}`} style={windowStyle} onPointerDown={onFocus}>
      {!win.isMaximized && edges.map(edge => (
        <div key={edge} className={`${styles.resizeHandle} ${styles[`resize_${edge}`]}`}
          onPointerDown={(e) => handleResizeStart(e, edge)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd} />
      ))}
      <div className={styles.titleBar}
        onPointerDown={handleDragStart} onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd} onDoubleClick={onMaximize}>
        <span className={styles.titleIcon}>{win.icon}</span>
        <span className={styles.titleText}>{win.title}</span>
        <div className={styles.windowControls}>
          <button className={styles.winBtn} onClick={(e) => { e.stopPropagation(); onMinimize(); }}><span className={styles.winBtnMin}>─</span></button>
          <button className={styles.winBtn} onClick={(e) => { e.stopPropagation(); onMaximize(); }}><span className={styles.winBtnMax}>□</span></button>
          <button className={`${styles.winBtn} ${styles.winBtnClose}`} onClick={(e) => { e.stopPropagation(); onClose(); }}><span>×</span></button>
        </div>
      </div>
      <div className={styles.windowContent}>{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP ICON — with notification popup on locked
   ═══════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   PARTICLE ICON — Canvas-rendered 3D particle field
   S³ tier apps: show "S³" text with tier color
   All other apps: show emoji glyph with per-app color
   ═══════════════════════════════════════════════════════════════ */

const APP_ICON_COLORS: Record<string, [number, number, number]> = {
  // S³ Suite
  gener8:     [0, 194, 255],
  daw:        [168, 85, 247],
  vid:        [240, 0, 184],
  styleforge: [245, 158, 11],
  // Standard OS
  'my-computer':    [100, 160, 230],
  'my-pictures':    [220, 140, 60],
  'my-videos':      [200, 80, 160],
  'music-player':   [80, 200, 160],
  // Strands apps
  'library':        [0, 194, 255],
  'signal-reg':     [60, 180, 220],
  'messages':       [100, 220, 140],
  'bridge-app':     [160, 120, 240],
  'codex':          [200, 170, 80],
  'signal-monitor': [80, 200, 200],
  'mymories':       [220, 100, 200],
  'myconsent':      [100, 180, 100],
  'avatar-creator': [0, 220, 180],
  // Sync-gated / locked
  'signal-training':[220, 80, 80],
  'arcade-2042':    [255, 140, 0],
  'holo-lock':      [140, 200, 255],
  'voice-sync':     [180, 100, 220],
  'cipher-tool':    [200, 60, 60],
  'trading-post':   [240, 200, 60],
  'signal-rush':    [255, 100, 60],
};

function ParticleIcon({ appId, tier, emoji }: { appId: string; tier?: string; emoji: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SIZE = 112;
    canvas.width = SIZE;
    canvas.height = SIZE;

    const isS3 = !!tier;
    const rgb = (tier ? APP_ICON_COLORS[tier] : APP_ICON_COLORS[appId]) || [120, 140, 180];
    const particleCount = isS3 ? 40 : 28;

    interface P { x: number; y: number; s: number; a: number; vx: number; vy: number; d: number; }
    const particles: P[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * SIZE, y: Math.random() * SIZE,
        s: Math.random() * 1.5 + 0.4, a: Math.random() * 0.4 + 0.1,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
        d: Math.random() * Math.PI * 2,
      });
    }

    let t = 0;
    function animate() {
      t += 0.02;
      ctx!.clearRect(0, 0, SIZE, SIZE);
      ctx!.save();
      ctx!.beginPath();
      ctx!.roundRect(0, 0, SIZE, SIZE, 24);
      ctx!.clip();

      // Background
      ctx!.fillStyle = '#0a0a12';
      ctx!.fillRect(0, 0, SIZE, SIZE);

      // Radial glow
      const grad = ctx!.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE * 0.6);
      grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${isS3 ? 0.12 : 0.08})`);
      grad.addColorStop(1, 'transparent');
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, SIZE, SIZE);

      // Particles
      for (const p of particles) {
        p.x += p.vx + Math.sin(t + p.d) * 0.1;
        p.y += p.vy + Math.cos(t * 0.8 + p.d) * 0.1;
        if (p.x < 0) p.x = SIZE; if (p.x > SIZE) p.x = 0;
        if (p.y < 0) p.y = SIZE; if (p.y > SIZE) p.y = 0;
        const pa = p.a * (0.6 + 0.4 * Math.sin(t * 2 + p.d));
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.s * 3, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${pa * 0.2})`; ctx!.fill();
        ctx!.beginPath(); ctx!.arc(p.x, p.y, p.s, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${pa})`; ctx!.fill();
      }

      // Connection lines
      ctx!.lineWidth = 0.3;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          if (dx * dx + dy * dy < 900) {
            ctx!.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.06)`;
            ctx!.beginPath(); ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y); ctx!.stroke();
          }
        }
      }

      // Centre glyph
      if (isS3) {
        // S³ branded text
        ctx!.font = '700 32px "Inter", -apple-system, sans-serif';
        ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle';
        ctx!.shadowColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx!.shadowBlur = 12;
        ctx!.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.8)`;
        ctx!.fillText('S\u00B3', SIZE / 2, SIZE / 2);
        ctx!.shadowBlur = 0;
        ctx!.fillStyle = 'rgba(255,255,255,0.9)';
        ctx!.fillText('S\u00B3', SIZE / 2, SIZE / 2);
      } else {
        // Emoji glyph with glow
        ctx!.font = '36px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        ctx!.textAlign = 'center'; ctx!.textBaseline = 'middle';
        ctx!.shadowColor = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
        ctx!.shadowBlur = 10;
        ctx!.fillText(emoji, SIZE / 2, SIZE / 2);
        ctx!.shadowBlur = 0;
        ctx!.fillText(emoji, SIZE / 2, SIZE / 2);
      }

      // Border
      ctx!.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.15)`;
      ctx!.lineWidth = 1;
      ctx!.beginPath(); ctx!.roundRect(0.5, 0.5, SIZE - 1, SIZE - 1, 24); ctx!.stroke();
      ctx!.restore();

      animRef.current = requestAnimationFrame(animate);
    }
    animate();
    return () => cancelAnimationFrame(animRef.current);
  }, [appId, tier, emoji]);

  return <canvas ref={canvasRef} style={{ width: 56, height: 56, imageRendering: 'auto' }} />;
}

function DesktopIcon({ app, onOpen, onLockedClick }: { app: AppManifest; onOpen: () => void; onLockedClick: (msg: string) => void }) {
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
        if (isLocked) {
          onLockedClick(app.lockMessage || 'Access denied');
        } else {
          onOpen();
        }
      }}
      onClick={() => {
        if (isLocked) onLockedClick(app.lockMessage || 'Access denied');
      }}
    >
      <div className={styles.iconGlyph} style={{ background: 'none', border: 'none' }}>
        <ParticleIcon appId={app.id} tier={app.tier} emoji={app.icon} />
        {isLocked && <div className={styles.lockOverlay}>🔒</div>}
      </div>
      <div className={styles.iconLabel}>{app.label}</div>
      {app.hasNotification && <div className={styles.notificationDot} />}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TASKBAR — with real date + time (SGT), narrative date shift
   ═══════════════════════════════════════════════════════════════ */

function Taskbar({
  windows, activeWindowId, onWindowClick, evo, onToggleEra,
}: {
  windows: WindowState[];
  activeWindowId: string | null;
  onWindowClick: (id: string) => void;
  evo: EvolutionState;
  onToggleEra: () => void;
}) {
  const [dateTime, setDateTime] = useState({ time: '', date: '' });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      if (evo.era === '2026') {
        setDateTime({
          time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' }),
          date: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Singapore' }),
        });
      } else {
        // Year 555 — same time, year + 563
        const sgNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
        const futureYear = sgNow.getFullYear() + 563;
        setDateTime({
          time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore' }),
          date: `Year ${futureYear - 2034} · ${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Singapore' })} · ${futureYear} CE`,
        });
      }
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [evo.era]);

  return (
    <div className={`${styles.taskbar} ${evo.era === 'year555' ? styles.taskbarEvolved : ''}`}>
      <button className={styles.startBtn} onClick={onToggleEra} title="Toggle Era (Demo)">
        <span className={styles.startLogo}>◈</span>
      </button>

      <div className={styles.taskbarWindows}>
        {windows.map(w => (
          <button key={w.id}
            className={`${styles.taskbarApp} ${w.id === activeWindowId ? styles.taskbarAppActive : ''} ${w.isMinimized ? styles.taskbarAppMinimized : ''}`}
            onClick={() => onWindowClick(w.id)}>
            <span className={styles.taskbarAppIcon}>{w.icon}</span>
            <span className={styles.taskbarAppLabel}>{w.title}</span>
          </button>
        ))}
      </div>

      <div className={styles.systemTray}>
        <div className={styles.anomalyIndicator}><span className={styles.anomalyPulse}>◉</span></div>
        <div className={styles.taskbarDateTime}>
          <div className={styles.taskbarTime}>{dateTime.time}</div>
          <div className={styles.taskbarDate}>{dateTime.date}</div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BOOT SEQUENCE
   ═══════════════════════════════════════════════════════════════ */

function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [lines, setLines] = useState<string[]>([]);
  const bootLines = [
    'STRANDS OS v2026.3 — Initializing...',
    'Loading kernel modules...',
    'Signal substrate: DETECTED',
    'CPU-VPU Bridge: CALIBRATING',
    'Temporal alignment: LOCKED',
    'LARP Protocol: ACTIVE',
    'Desktop environment: LOADING',
    'Window manager: READY',
    '...',
    '◈ SIGNAL ACTIVE — Welcome, Agent.',
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < bootLines.length) {
        setLines(prev => [...prev, bootLines[i]]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 600);
      }
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.bootScreen}>
      <div className={styles.bootTerminal}>
        {lines.map((line, i) => (
          <div key={i} className={styles.bootLine}><span className={styles.bootPrompt}>&gt;</span> {line}</div>
        ))}
        <div className={styles.bootCursor}>_</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DESKTOP OS PAGE
   ═══════════════════════════════════════════════════════════════ */

// Standard OS app IDs for filtering (stable constant)
const STANDARD_IDS: string[] = ['my-computer','my-pictures','my-videos','music-player'];

export default function DemoOSPage() {
  const [booted, setBooted] = useState(false);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const [nextZ, setNextZ] = useState(100);
  const [activeWindowId, setActiveWindowId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);
  const toastCounter = useRef(0);
  const showToast = useCallback((msg: string) => {
    toastCounter.current++;
    setToast({ msg, key: toastCounter.current });
  }, []);
  const [evo, setEvo] = useState<EvolutionState>({ era: '2026', syncValue: 375, bridgeLevel: 3 });
  const windowCounter = useRef(0);

  /* ── Quest State ── */
  const [questPhase, setQuestPhase] = useState('intro');
  const [questTrigger, setQuestTrigger] = useState('');
  const [desktopFiles, setDesktopFiles] = useState<{ name: string; icon: string; renamed?: boolean }[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileName: string } | null>(null);

  /* ── Avatar State ── */
  const [avatarGlbUrl, setAvatarGlbUrl] = useState<string | null>(null);
  const [avatarCreatorMode, setAvatarCreatorMode] = useState<'create' | 'preview'>('create');

  // Spawn a dynamic window (for quest-triggered windows like Signal Sync, Video)
  const spawnDynamicWindow = useCallback((appId: string, title: string, icon: string, width = 520, height = 500) => {
    // Check if already open
    const existing = windows.find(w => w.appId === appId);
    if (existing) {
      setNextZ(z => z + 1);
      setWindows(prev => prev.map(w => w.id === existing.id ? { ...w, zIndex: nextZ + 1, isMinimized: false } : w));
      setActiveWindowId(existing.id);
      return;
    }
    windowCounter.current++;
    const id = `win-${windowCounter.current}`;
    const ox = (windowCounter.current % 6) * 40;
    const oy = (windowCounter.current % 4) * 40;
    const newWin: WindowState = {
      id, appId, title, icon,
      x: 200 + ox, y: 60 + oy,
      width, height,
      minWidth: 400, minHeight: 360,
      zIndex: nextZ + 1, isMinimized: false, isMaximized: false,
    };
    setNextZ(z => z + 1);
    setWindows(prev => [...prev, newWin]);
    setActiveWindowId(id);
  }, [windows, nextZ]);

  // Quest callbacks — these bridge the QuestChat to the DemoOS desktop
  const questCallbacks = useMemo<QuestCallbacks>(() => ({
    onFileAppear: (fileName: string) => {
      // Determine icon based on file type
      let icon = '📦';
      if (fileName.includes('gander')) icon = '🎬';
      else if (fileName.includes('arcade') || fileName.includes('2042') || fileName.endsWith('.exe')) icon = '🕹️';
      else if (fileName.endsWith('.mp4') || fileName.endsWith('.quantstream')) icon = '🎬';
      setDesktopFiles(prev => [...prev, { name: fileName, icon }]);
      showToast(`File appeared: ${fileName}`);
    },
    onOpenSignalSync: (round: number) => {
      // Signal Sync IS the video player — one window, not two.
      // The sync overlay drives video clarity. No separate video window.
      spawnDynamicWindow('quest-signal-sync', `Proper Gander — Signal ${round}`, '📺', 580, 520);
    },
    onOpenVideo: () => {
      // No-op: video is already playing through Signal Sync.
      // The sync mechanic IS the playback interface.
    },
    onOpenGame: (gameId: string) => {
      const gameApp = APP_REGISTRY.find(a => a.id === gameId);
      if (gameApp) {
        const existing = windows.find(w => w.appId === gameId);
        if (existing) {
          setNextZ(z => z + 1);
          setWindows(prev => prev.map(w => w.id === existing.id ? { ...w, zIndex: nextZ + 1, isMinimized: false } : w));
          setActiveWindowId(existing.id);
        } else {
          spawnDynamicWindow(gameId, gameApp.label, gameApp.icon, gameApp.defaultWidth, gameApp.defaultHeight);
        }
      }
    },
    onOpenCircuitSync: () => {
      spawnDynamicWindow('circuit-sync-quest', 'Circuit Reroute', '🔓', 560, 540);
    },
    onQuestComplete: (profile: AssessmentProfile) => {
      showToast('QUEST COMPLETE — Welcome to Strands, Agent.');
      console.log('[Quest] Assessment profile:', profile);
    },
    onNotify: (msg: string) => {
      showToast(msg);
      // Signal Sync IS the video player. Completion = video decoded + watched.
      // Trigger video-complete directly (skipping the separate video step).
      if (msg.includes('Signal Sync Round 1')) {
        setQuestTrigger('sync-complete-1');
        setTimeout(() => setQuestTrigger('video-complete-1'), 1500);
      } else if (msg.includes('Signal Sync Round 2')) {
        setQuestTrigger('sync-complete-2');
        setTimeout(() => setQuestTrigger('video-complete-2'), 1500);
      } else if (msg.includes('Signal Sync Round 3')) {
        setQuestTrigger('sync-complete-3');
        setTimeout(() => setQuestTrigger('video-complete-3'), 1500);
      }
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [showToast, spawnDynamicWindow, windows, nextZ]);

  // Quest context value
  const questContextValue = useMemo<QuestState>(() => ({
    callbacks: questCallbacks,
    externalTrigger: questTrigger,
    questPhase,
    desktopFiles,
  }), [questCallbacks, questTrigger, questPhase, desktopFiles]);

  // Avatar context value
  const avatarContextValue = useMemo<AvatarState>(() => ({
    glbUrl: avatarGlbUrl,
    mode: avatarCreatorMode,
    setMode: setAvatarCreatorMode,
    onAvatarExported: (glbArrayBuffer: ArrayBuffer) => {
      // Revoke previous blob URL to prevent memory leaks
      if (avatarGlbUrl && avatarGlbUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarGlbUrl);
      }
      const blob = new Blob([glbArrayBuffer], { type: 'model/gltf-binary' });
      const blobUrl = URL.createObjectURL(blob);
      setAvatarGlbUrl(blobUrl);
      setAvatarCreatorMode('preview');
      showToast('AVATAR SYNCED — Signal identity locked.');
      console.log('[Avatar] GLB received from Character Studio, blob URL:', blobUrl);
    },
  }), [avatarGlbUrl, avatarCreatorMode, showToast]);

  // Handle rename from context menu
  const handleFileRename = useCallback((newName: string) => {
    setDesktopFiles(prev => prev.map(f =>
      f.name === contextMenu?.fileName ? { ...f, name: newName, renamed: true } : f
    ));
    setContextMenu(null);
    // If renamed to .mp4, trigger quest advancement
    if (newName.endsWith('.mp4')) {
      setQuestTrigger('file-renamed');
      showToast(`File renamed to: ${newName}`);
    }
  }, [contextMenu, showToast]);

  // Handle right-click on desktop files
  const handleFileContextMenu = useCallback((e: React.MouseEvent, fileName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, fileName });
  }, []);

  const toggleEra = useCallback(() => {
    setEvo(prev => prev.era === '2026'
      ? { era: 'year555', syncValue: 1200, bridgeLevel: 10 }
      : { era: '2026', syncValue: 375, bridgeLevel: 3 }
    );
  }, []);

  const openWindow = useCallback((app: AppManifest) => {
    const existing = windows.find(w => w.appId === app.id);
    if (existing) {
      setNextZ(z => z + 1);
      setWindows(prev => prev.map(w => w.id === existing.id ? { ...w, zIndex: nextZ + 1, isMinimized: false } : w));
      setActiveWindowId(existing.id);
      return;
    }
    windowCounter.current++;
    const id = `win-${windowCounter.current}`;

    // Calculate position - center for Messages app, cascade for others
    let x: number, y: number;
    if (app.id === 'messages') {
      // Center Messages window in viewport
      const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
      x = Math.max(20, (viewportWidth - app.defaultWidth) / 2);
      y = Math.max(20, (viewportHeight - TASKBAR_H - app.defaultHeight) / 2);
    } else {
      // Cascade other windows from top-left
      const ox = (windowCounter.current % 8) * 30;
      const oy = (windowCounter.current % 6) * 30;
      x = 140 + ox;
      y = 30 + oy;
    }

    const newWin: WindowState = {
      id, appId: app.id, title: app.label, icon: app.icon,
      x, y,
      width: app.defaultWidth, height: app.defaultHeight,
      minWidth: app.minWidth, minHeight: app.minHeight,
      zIndex: nextZ + 1, isMinimized: false, isMaximized: false,
    };
    setNextZ(z => z + 1);
    setWindows(prev => [...prev, newWin]);
    setActiveWindowId(id);
  }, [windows, nextZ]);

  const focusWindow = useCallback((id: string) => {
    setNextZ(z => { setWindows(prev => prev.map(w => w.id === id ? { ...w, zIndex: z + 1 } : w)); return z + 1; });
    setActiveWindowId(id);
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) setActiveWindowId(null);
  }, [activeWindowId]);

  /* ── Listen for game-quit postMessages from iframed games ── */
  /* Games send their own id (e.g. 'holo-lock', '2042') which won't match
     the window's generated id. Map known game ids → appIds, then find
     the window by appId. Falls back to direct id match. */
  const gameIdToAppId: Record<string, string> = {
    'holo-lock': 'circuit-sync-quest',
    '2042': 'arcade-2042',
    'signal-training': 'signal-training',
  };
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'game-quit' && typeof e.data.id === 'string') {
        const appId = gameIdToAppId[e.data.id] || e.data.id;
        const win = windows.find(w => w.appId === appId);
        if (win) {
          setWindows(prev => prev.filter(w => w.appId !== appId));
        } else {
          closeWindow(e.data.id);
        }
      }
      // Handle game completion — feeds into quest system
      if (e.data?.type === 'game-complete' && typeof e.data.id === 'string') {
        const score = e.data.score || 0;
        console.log(`[DemoOS] Game "${e.data.id}" completed with score: ${score}`);
        showToast(`SIGNAL TRAINING COMPLETE — Sync score: ${score}`);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [closeWindow, windows, showToast]);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: true } : w));
    if (activeWindowId === id) setActiveWindowId(null);
  }, [activeWindowId]);

  const maximizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      if (w.isMaximized) return { ...w, isMaximized: false, x: w.preMaxBounds?.x ?? w.x, y: w.preMaxBounds?.y ?? w.y, width: w.preMaxBounds?.width ?? w.width, height: w.preMaxBounds?.height ?? w.height, preMaxBounds: undefined };
      return { ...w, isMaximized: true, preMaxBounds: { x: w.x, y: w.y, width: w.width, height: w.height } };
    }));
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, x, y } : w));
  }, []);

  const resizeWindow = useCallback((id: string, width: number, height: number, x?: number, y?: number) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      const u: Partial<WindowState> = { width, height };
      if (x !== undefined) u.x = x;
      if (y !== undefined) u.y = y;
      return { ...w, ...u };
    }));
  }, []);

  const handleTaskbarClick = useCallback((id: string) => {
    const win = windows.find(w => w.id === id);
    if (!win) return;
    if (win.isMinimized) { setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: false } : w)); focusWindow(id); }
    else if (activeWindowId === id) minimizeWindow(id);
    else focusWindow(id);
  }, [windows, activeWindowId, focusWindow, minimizeWindow]);

  if (!booted) return <BootSequence onComplete={() => setBooted(true)} />;

  // Separate apps into visible groups
  const standardApps = APP_REGISTRY.filter(a => STANDARD_IDS.includes(a.id));
  const strandsApps = APP_REGISTRY.filter(a => !STANDARD_IDS.includes(a.id) && a.state !== 'hidden');
  const hiddenApps = APP_REGISTRY.filter(a => a.state === 'hidden');

  return (
    <EvolutionContext.Provider value={evo}>
      <QuestContext.Provider value={questContextValue}>
      <AvatarContext.Provider value={avatarContextValue}>
        <div className={`${styles.desktopOS} ${evo.era === 'year555' ? styles.desktopEvolved : ''}`}>
          {/* Desktop Surface */}
          <div className={styles.desktopSurface}>
            <div className={styles.circuitPattern} />
            <div className={styles.radialCyan} />
            <div className={styles.radialPink} />
            <div className={styles.scanlineOverlay} />
          </div>

          {/* Workspace — fills space above taskbar */}
          <div className={styles.workspace}>
            {/* Icon Grid — free-form desktop layout */}
            <div className={styles.iconGrid}>
              {/* Standard OS apps */}
              {standardApps.map(app => (
                <DesktopIcon key={app.id} app={app} onOpen={() => openWindow(app)} onLockedClick={showToast} />
              ))}
              {/* Strands apps */}
              {strandsApps.map(app => (
                <DesktopIcon key={app.id} app={app} onOpen={() => openWindow(app)} onLockedClick={showToast} />
              ))}
              {/* Hidden apps */}
              {hiddenApps.map(app => (
                <DesktopIcon key={app.id} app={app} onOpen={() => {}} onLockedClick={showToast} />
              ))}

              {/* Quest dynamic files — materialise during narrative */}
              {desktopFiles.length > 0 && (
                <>
                  <div className={styles.iconGroup}>
                    {desktopFiles.map((file, i) => (
                      <div
                        key={`quest-file-${i}`}
                        className={styles.desktopIcon}
                        style={{ animation: 'fadeIn 0.5s ease both' }}
                        onDoubleClick={() => {
                          if (file.renamed && file.name.endsWith('.mp4')) {
                            showToast('Signal unstable — use Signal Sync to stabilise playback');
                          } else {
                            showToast('File format not recognised. Try renaming it.');
                          }
                        }}
                        onContextMenu={(e) => handleFileContextMenu(e, file.name)}
                      >
                        <span className={styles.iconGlyph}>{file.icon}</span>
                        <span className={styles.iconLabel} style={{
                          fontSize: '7px',
                          color: file.renamed ? 'var(--c-accent)' : 'var(--c-pink)',
                          textShadow: file.renamed ? 'none' : '0 0 6px rgba(240,0,184,0.4)',
                        }}>
                          {file.name.length > 20 ? file.name.slice(0, 18) + '...' : file.name}
                        </span>
                        {!file.renamed && (
                          <span style={{
                            position: 'absolute', top: '4px', right: '4px',
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: 'var(--c-pink)', boxShadow: '0 0 6px rgba(240,0,184,0.6)',
                            animation: 'pinkPulse 2s ease-in-out infinite',
                          }} />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Windows */}
            {windows.map(win => (
              <Window key={win.id} win={win} isActive={win.id === activeWindowId}
                onFocus={() => focusWindow(win.id)}
                onClose={() => closeWindow(win.id)}
                onMinimize={() => minimizeWindow(win.id)}
                onMaximize={() => maximizeWindow(win.id)}
                onMove={(x, y) => moveWindow(win.id, x, y)}
                onResize={(w, h, x, y) => resizeWindow(win.id, w, h, x, y)}>
                <AppContent appId={win.appId} />
              </Window>
            ))}
          </div>

          {/* Context Menu — for right-click rename on quest files */}
          {contextMenu && (
            <DesktopContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              fileName={contextMenu.fileName}
              onRename={handleFileRename}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Toast notification */}
          {toast && <NotificationToast message={toast.msg} toastKey={toast.key} onDismiss={() => setToast(null)} />}

          {/* Taskbar — pinned bottom */}
          <Taskbar windows={windows} activeWindowId={activeWindowId}
            onWindowClick={handleTaskbarClick} evo={evo} onToggleEra={toggleEra} />
        </div>
      </AvatarContext.Provider>
      </QuestContext.Provider>
    </EvolutionContext.Provider>
  );
}
