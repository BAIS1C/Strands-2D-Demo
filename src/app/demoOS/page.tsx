'use client';

import { useState, useCallback, useRef, useEffect, useContext, useMemo } from 'react';
import styles from './page.module.css';
import { playlist as generatedPlaylist } from '@/constants/playlist';
import QuestChat from '@/components/QuestChat/QuestChat';
import type { QuestCallbacks, AssessmentProfile } from '@/components/QuestChat/QuestChat';
import DesktopContextMenu from '@/components/DesktopContextMenu/DesktopContextMenu';
import SignalSync from '@/components/SignalSync/SignalSync';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  APP_REGISTRY,
  STANDARD_IDS,
  TASKBAR_H,
  type WindowState,
} from '@/constants/appRegistry';
import {
  DemoOSProviders,
  EvolutionContext,
  QuestContext,
  AvatarContext,
  type EvolutionState,
  type QuestState,
  type AvatarState,
} from '@/context/DemoOSContexts';
import { useWindowManager } from '@/hooks/useWindowManager';
import NotificationToast from '@/components/NotificationToast/NotificationToast';
import BootSequence from '@/components/BootSequence/BootSequence';
import DesktopBackground from '@/components/DesktopBackground/DesktopBackground';
import DesktopIcon from '@/components/DesktopIcon/DesktopIcon';
import QuestFileIcon, { type QuestFile } from '@/components/QuestFileIcon/QuestFileIcon';
import Window from '@/components/Window/Window';
import SkinToggle from '@/components/SkinToggle/SkinToggle';
import { SkinProvider, useSkin } from '@/context/SkinContext';

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
   MUSIC PLAYER — Real audio player using the Strands playlist.
   Self-contained component with its own audio element.
   Audio persists when window is minimized (CSS hidden, not unmounted).
   Distinct from Gener8 (which is the AI music *generator* studio).
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
        <div className={styles.appHeader}>STRANDS MUSIC</div>
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
      <div className={styles.appHeader}>STRANDS MUSIC</div>
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
   GENER8 LAUNCHER — Preliminary screen: run in-window or new tab
   ═══════════════════════════════════════════════════════════════ */

function Gener8Launcher() {
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
          <span>🎵 S³ Gener8 — AI Music Studio</span>
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
          src="/stepstudio/app?embed=gener8"
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
          onClick={() => window.open('/stepstudio/app?embed=gener8', '_blank')}
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

    case 'gener8':
      return <Gener8Launcher />;

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
   MAIN DESKTOP OS PAGE
   ═══════════════════════════════════════════════════════════════ */

// Standard OS app IDs for filtering (stable constant)
function DemoOSBody() {
  const { skin } = useSkin();
  const [booted, setBooted] = useState(false);
  const [toast, setToast] = useState<{ msg: string; key: number } | null>(null);
  const toastCounter = useRef(0);
  const showToast = useCallback((msg: string) => {
    toastCounter.current++;
    setToast({ msg, key: toastCounter.current });
  }, []);
  const [evo, setEvo] = useState<EvolutionState>({ era: '2026', syncValue: 375, bridgeLevel: 3 });

  /* ── Window manager — owns windows, zIndex, drag/resize/min/max/close/taskbar ── */
  const {
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
  } = useWindowManager({ showToast });

  /* ── Quest State ── */
  const [questPhase, setQuestPhase] = useState('intro');
  const [questTrigger, setQuestTrigger] = useState('');
  const [desktopFiles, setDesktopFiles] = useState<{ name: string; icon: string; renamed?: boolean }[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileName: string } | null>(null);

  /* ── Avatar State ── */
  const [avatarGlbUrl, setAvatarGlbUrl] = useState<string | null>(null);
  const [avatarCreatorMode, setAvatarCreatorMode] = useState<'create' | 'preview'>('create');

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
        // spawnDynamicWindow handles the existing-window case internally (focuses + un-minimises).
        spawnDynamicWindow(gameId, gameApp.label, gameApp.icon, gameApp.defaultWidth, gameApp.defaultHeight);
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
  }), [showToast, spawnDynamicWindow]);

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

  if (!booted) return <BootSequence onComplete={() => setBooted(true)} />;

  // Separate apps into visible groups
  const standardApps = APP_REGISTRY.filter(a => STANDARD_IDS.includes(a.id));
  const strandsApps = APP_REGISTRY.filter(a => !STANDARD_IDS.includes(a.id) && a.state !== 'hidden');
  const hiddenApps = APP_REGISTRY.filter(a => a.state === 'hidden');

  return (
    <DemoOSProviders evolution={evo} quest={questContextValue} avatar={avatarContextValue}>
      <>
        <div
          className={`${styles.desktopOS} ${evo.era === 'year555' ? styles.desktopEvolved : ''}`}
          data-theme={skin}
        >
          {/* Skin toggle — floats top-right above all chrome */}
          <div className={styles.skinToggleSlot}>
            <SkinToggle />
          </div>
          {/* Desktop Surface */}
          <DesktopBackground evolved={evo.era === 'year555'} />

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
                <div className={styles.iconGroup}>
                  {desktopFiles.map((file, i) => (
                    <QuestFileIcon
                      key={`quest-file-${i}`}
                      file={file}
                      onOpen={(f: QuestFile) => {
                        if (f.renamed && f.name.endsWith('.mp4')) {
                          showToast('Signal unstable — use Signal Sync to stabilise playback');
                        } else {
                          showToast('File format not recognised. Try renaming it.');
                        }
                      }}
                      onContextMenu={(e, fileName) => handleFileContextMenu(e, fileName)}
                    />
                  ))}
                </div>
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
      </>
    </DemoOSProviders>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DEFAULT EXPORT — wraps the OS body in SkinProvider so the
   [data-theme] attribute and skin toggle can drive EWDS variants.
   ═══════════════════════════════════════════════════════════════ */
export default function DemoOSPage() {
  return (
    <SkinProvider>
      <DemoOSBody />
    </SkinProvider>
  );
}
