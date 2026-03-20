'use client';

import { useState, useCallback, useRef, useEffect, createContext, useContext, useMemo } from 'react';
import styles from './page.module.css';
import { playlist as generatedPlaylist } from '@/constants/playlist';

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
  // ── Standard OS — your normal desktop stuff (top of grid) ──
  { id: 'my-computer',   label: 'My Computer',         icon: '💻', minWidth: 400, minHeight: 360, defaultWidth: 480, defaultHeight: 420, state: 'available' },
  { id: 'documents',     label: 'Documents',            icon: '📄', minWidth: 360, minHeight: 440, defaultWidth: 420, defaultHeight: 480, state: 'available' },
  { id: 'my-pictures',   label: 'My Pictures',          icon: '🖼️', minWidth: 360, minHeight: 340, defaultWidth: 420, defaultHeight: 400, state: 'available' },
  { id: 'my-videos',     label: 'My Videos',            icon: '🎬', minWidth: 360, minHeight: 340, defaultWidth: 420, defaultHeight: 400, state: 'available' },
  { id: 'music-player',  label: 'Music Player',          icon: '🎶', minWidth: 300, minHeight: 360, defaultWidth: 380, defaultHeight: 520, state: 'available' },
  { id: 'soundwave',     label: 'SoundWave',             icon: '🎵', minWidth: 480, minHeight: 600, defaultWidth: 520, defaultHeight: 640, state: 'available' },

  // ── Strands installed apps — available ──
  { id: 'signal-reg',    label: 'Signal Reg',           icon: '📡', minWidth: 320, minHeight: 400, defaultWidth: 380, defaultHeight: 460, state: 'available' },
  { id: 'messages',      label: 'Messages',             icon: '💬', minWidth: 360, minHeight: 480, defaultWidth: 420, defaultHeight: 540, state: 'available', hasNotification: true },
  { id: 'bridge-app',    label: 'CPU-VPU Bridge',       icon: '🌉', minWidth: 400, minHeight: 480, defaultWidth: 440, defaultHeight: 520, state: 'available' },
  { id: 'codex',         label: 'The Codex',            icon: '📖', minWidth: 400, minHeight: 500, defaultWidth: 500, defaultHeight: 600, state: 'available' },
  { id: 'signal-monitor',label: 'Signal Monitor',       icon: '📺', minWidth: 440, minHeight: 500, defaultWidth: 480, defaultHeight: 540, state: 'available' },
  { id: 'mymories',      label: 'Mymories',             icon: '🧠', minWidth: 360, minHeight: 440, defaultWidth: 400, defaultHeight: 480, state: 'available' },
  { id: 'myconsent',     label: 'MyConsent',             icon: '🛡️', minWidth: 400, minHeight: 400, defaultWidth: 460, defaultHeight: 480, state: 'available' },

  // ── Sync-gated — show progress bar until threshold ──
  { id: 'signal-training', label: 'Signal Training',    icon: '🎯', minWidth: 640, minHeight: 480, defaultWidth: 800, defaultHeight: 600, state: 'available' },
  { id: 'arcade-2042',   label: 'Arcade 2042',          icon: '🕹️', minWidth: 480, minHeight: 620, defaultWidth: 500, defaultHeight: 680, state: 'available' },
  { id: 'holo-lock',     label: 'Holo-Lock',            icon: '🔓', minWidth: 520, minHeight: 500, defaultWidth: 540, defaultHeight: 540, state: 'available' },

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
          src="/stepstudio/"
          title="SoundWave — ACE Step Studio"
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
        STRANDS SOUNDWAVE
      </div>
      <div style={{ fontSize: '0.78rem', color: '#a0aec0', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
        AI Music Studio powered by ACE-Step 1.5. Create, remix, and generate tracks with text prompts.
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
          onClick={() => window.open('/stepstudio/', '_blank')}
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
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>DOCUMENTS</div>
          <div className={styles.fileList}>
            <div className={styles.fileItem}><span>📁</span> Personal</div>
            <div className={styles.fileItem}><span>📁</span> Work</div>
            <div className={styles.fileItem}><span>📁</span> Signal Transcripts</div>
            <div className={styles.fileItem}><span>📄</span> README_strands.txt</div>
            <div className={styles.fileItem}><span>📄</span> bridge_calibration_notes.txt</div>
            <div className={styles.fileItemDim}><span>📄</span> ▓▓▓_recovered_fragment_01.sig</div>
            <div className={styles.fileItemDim}><span>🔒</span> classified_sovcorp_memo.enc — <em>Decryption pending</em></div>
          </div>
        </div>
      );

    case 'music-player':
      return <MusicPlayerContent />;

    case 'soundwave':
      return <SoundWaveLauncher />;

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

    case 'messages':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>MESSAGES</div>
          <div className={styles.chatWindow}>
            <div className={styles.chatMsg}>
              <span className={styles.chatSender}>ghost93</span>
              <span className={styles.chatText}>you&apos;re not supposed to be here yet.</span>
            </div>
            <div className={styles.chatMsg}>
              <span className={styles.chatSender}>crashweaver</span>
              <span className={styles.chatText}>Ignore ghost. Signal&apos;s clean. You&apos;re building substrate — that&apos;s what matters.</span>
            </div>
            <div className={styles.chatMsg}>
              <span className={styles.chatSender}>kira</span>
              <span className={styles.chatText}>Check your Bridge App. Something moved.</span>
            </div>
            <div className={`${styles.chatMsg} ${styles.chatMsgSystem}`}>
              <span className={styles.chatText}>/// SIGNAL ANOMALY DETECTED — SOURCE UNATTRIBUTED ///</span>
            </div>
            <div className={styles.chatMsg}>
              <span className={styles.chatSender}>???</span>
              <span className={styles.chatText}>y̷o̷u̶ ̷b̸u̴i̴l̵t̶ ̵i̶t̷.̶ ̴I̸ ̸w̴a̵s̸n̸&apos;̷t̵ ̵s̶u̸r̸e̷ ̴y̸o̵u̵ ̸w̸o̷u̸l̶d̷.̷</span>
            </div>
          </div>
        </div>
      );

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

    case 'signal-training':
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <iframe
            src="/games/strands-tutorial-fps.html"
            title="Signal Training — StrandsNation Tutorial"
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

    case 'holo-lock':
      return (
        <div className={styles.appBody} style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
          <iframe
            src="/games/holo-lock.html"
            title="Holo-Lock — Signal Breach"
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

  const windowStyle: React.CSSProperties = win.isMinimized
    ? { display: 'none' }
    : win.isMaximized
    ? { left: 0, top: 0, width: '100%', height: `calc(100vh - ${TASKBAR_H}px)`, zIndex: win.zIndex }
    : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex };

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
      <div className={styles.iconGlyph}>
        {app.icon}
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
    const ox = (windowCounter.current % 8) * 30;
    const oy = (windowCounter.current % 6) * 30;
    const newWin: WindowState = {
      id, appId: app.id, title: app.label, icon: app.icon,
      x: 140 + ox, y: 30 + oy,
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
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'game-quit' && typeof e.data.id === 'string') {
        closeWindow(e.data.id);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [closeWindow]);

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
  const STANDARD_IDS = ['my-computer','documents','my-pictures','my-videos','music-player'];
  const standardApps = APP_REGISTRY.filter(a => STANDARD_IDS.includes(a.id));
  const strandsApps = APP_REGISTRY.filter(a => !STANDARD_IDS.includes(a.id) && a.state !== 'hidden');
  const hiddenApps = APP_REGISTRY.filter(a => a.state === 'hidden');

  return (
    <EvolutionContext.Provider value={evo}>
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
            {/* Standard OS apps — top left */}
            <div className={styles.iconGroup}>
              {standardApps.map(app => (
                <DesktopIcon key={app.id} app={app} onOpen={() => openWindow(app)} onLockedClick={showToast} />
              ))}
            </div>
            {/* Separator */}
            <div className={styles.iconSep} />
            {/* Strands apps */}
            <div className={styles.iconGroup}>
              {strandsApps.map(app => (
                <DesktopIcon key={app.id} app={app} onOpen={() => openWindow(app)} onLockedClick={showToast} />
              ))}
            </div>
            {/* Hidden row */}
            <div className={styles.iconSep} />
            <div className={styles.iconGroupHidden}>
              {hiddenApps.map(app => (
                <DesktopIcon key={app.id} app={app} onOpen={() => {}} onLockedClick={showToast} />
              ))}
            </div>
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

        {/* Toast notification */}
        {toast && <NotificationToast message={toast.msg} toastKey={toast.key} onDismiss={() => setToast(null)} />}

        {/* Taskbar — pinned bottom */}
        <Taskbar windows={windows} activeWindowId={activeWindowId}
          onWindowClick={handleTaskbarClick} evo={evo} onToggleEra={toggleEra} />
      </div>
    </EvolutionContext.Provider>
  );
}
