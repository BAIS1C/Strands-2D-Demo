'use client';

import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react';
import styles from './page.module.css';

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
   ═══════════════════════════════════════════════════════════════ */

const APP_REGISTRY: AppManifest[] = [
  // Standard OS — your normal desktop stuff
  { id: 'my-computer',   label: 'My Computer',    icon: '💻', minWidth: 400, minHeight: 360, defaultWidth: 480, defaultHeight: 420, state: 'available' },
  { id: 'my-pictures',   label: 'My Pictures',    icon: '🖼️', minWidth: 360, minHeight: 340, defaultWidth: 420, defaultHeight: 400, state: 'available' },
  { id: 'my-videos',     label: 'My Videos',      icon: '🎬', minWidth: 360, minHeight: 340, defaultWidth: 420, defaultHeight: 400, state: 'available' },
  { id: 'soundwave',     label: 'SoundWave',      icon: '🎵', minWidth: 300, minHeight: 200, defaultWidth: 340, defaultHeight: 280, state: 'available' },

  // Strands installed apps — available
  { id: 'signal-reg',    label: 'Signal Reg',     icon: '📡', minWidth: 320, minHeight: 400, defaultWidth: 380, defaultHeight: 460, state: 'available' },
  { id: 'messages',      label: 'Messages',       icon: '💬', minWidth: 360, minHeight: 480, defaultWidth: 420, defaultHeight: 540, state: 'available', hasNotification: true },
  { id: 'bridge-app',    label: 'CPU-VPU Bridge', icon: '🌉', minWidth: 400, minHeight: 480, defaultWidth: 440, defaultHeight: 520, state: 'available' },
  { id: 'codex',         label: 'The Codex',      icon: '📖', minWidth: 400, minHeight: 500, defaultWidth: 440, defaultHeight: 540, state: 'available' },
  { id: 'signal-monitor',label: 'Signal Monitor', icon: '📺', minWidth: 440, minHeight: 500, defaultWidth: 480, defaultHeight: 540, state: 'available' },
  { id: 'mymories',      label: 'Mymories',       icon: '🧠', minWidth: 360, minHeight: 440, defaultWidth: 400, defaultHeight: 480, state: 'available' },

  // Sync-gated — show progress bar until threshold
  { id: 'arcade-2042',   label: 'Arcade 2042',    icon: '🕹️', minWidth: 480, minHeight: 620, defaultWidth: 500, defaultHeight: 680, state: 'available', syncGated: 500 },
  { id: 'circuit-sync',  label: 'Circuit Sync',   icon: '⚡', minWidth: 500, minHeight: 400, defaultWidth: 520, defaultHeight: 440, state: 'available', syncGated: 600 },
  { id: 'holo-lock',     label: 'Holo-Lock',      icon: '🔓', minWidth: 520, minHeight: 500, defaultWidth: 540, defaultHeight: 540, state: 'available', syncGated: 700 },

  // Locked apps — visible but inaccessible
  { id: 'voice-sync',    label: 'Voice Sync',     icon: '🎙️', minWidth: 400, minHeight: 300, defaultWidth: 400, defaultHeight: 340, state: 'locked', lockMessage: 'Requires Signal Registration' },
  { id: 'documents',     label: 'Documents',      icon: '📄', minWidth: 360, minHeight: 440, defaultWidth: 400, defaultHeight: 480, state: 'locked', lockMessage: 'Requires Signal Recovery' },
  { id: 'cipher-tool',   label: 'Cipher Tool',    icon: '🔐', minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'locked', lockMessage: 'Requires Escalation Protocol' },
  { id: 'trading-post',  label: 'Trading Post',   icon: '💰', minWidth: 360, minHeight: 440, defaultWidth: 400, defaultHeight: 480, state: 'locked', lockMessage: 'Bridge Level 5 Required' },
  { id: 'signal-rush',   label: 'Signal Rush',    icon: '🚀', minWidth: 360, minHeight: 600, defaultWidth: 380, defaultHeight: 640, state: 'locked', lockMessage: 'Coming Soon' },

  // Hidden — dashed borders, glitch teasers
  { id: 'kasai-terminal', label: '???',           icon: '?',  minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden' },
  { id: 'portal',         label: 'The Portal',    icon: '🌀', minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden' },
  { id: 'ace-studio',     label: 'ACE Studio',    icon: '🎹', minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden' },
];

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION TOAST — pops up when clicking locked icons
   ═══════════════════════════════════════════════════════════════ */

function NotificationToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={styles.toast}>
      <span className={styles.toastIcon}>🔒</span>
      <span className={styles.toastMsg}>{message}</span>
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
            <div className={styles.fileItem}><span>🎬</span> Proper Gander S0-01.sig</div>
            <div className={styles.fileItem}><span>🎬</span> Proper Gander S0-02.sig</div>
            <div className={styles.fileItemDim}><span>🎬</span> S0-03.sig — <em>Signal reconstruction: 47%</em></div>
            <div className={styles.fileItemDim}><span>🔒</span> S0-04 through S0-08 — <em>Locked</em></div>
          </div>
        </div>
      );

    case 'soundwave':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>SOUNDWAVE</div>
          <div className={styles.musicPlayer}>
            <div className={styles.trackInfo}>
              <div className={styles.trackTitle}>Orbit Foreshadowing (Remix)</div>
              <div className={styles.trackArtist}>SpacemanTheDJ</div>
            </div>
            <div className={styles.waveform}>
              {Array.from({ length: 32 }).map((_, i) => (
                <div key={i} className={styles.waveBar} style={{ height: `${20 + Math.random() * 60}%`, animationDelay: `${i * 0.05}s` }} />
              ))}
            </div>
            <div className={styles.playerControls}>
              <button className={styles.playerBtn}>⏮</button>
              <button className={`${styles.playerBtn} ${styles.playerBtnPlay}`}>▶</button>
              <button className={styles.playerBtn}>⏭</button>
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: '35%' }} />
            </div>
            <div className={styles.trackTime}>1:12 / 3:28</div>
          </div>
        </div>
      );

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
          <div className={styles.calendarGate}>Day 7 / 14 minimum — Temporal calibration cannot be rushed.</div>
        </div>
      );

    case 'codex':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>THE CODEX</div>
          <div className={styles.codexEntries}>
            <div className={styles.codexEntry}>
              <div className={styles.codexTitle}>The Conflagrations</div>
              <div className={styles.codexBody}>Year 0. The event that ended the old world. Records fragmented. Official SOVcorp narrative: &quot;From ruin, structure.&quot; Signal jack S0-01 suggests premeditation.</div>
            </div>
            <div className={styles.codexEntry}>
              <div className={styles.codexTitle}>MetaXity1 — The Cracks</div>
              <div className={styles.codexBody}>The SE Asia corridor. A pyramid civilisation of vertical strata. The embodiment gradient made architecture.</div>
            </div>
            <div className={styles.codexEntry}>
              <div className={styles.codexTitle}>KASAI — Unverified</div>
              <div className={styles.codexBody}>Signal anomalies suggest a presence in the substrate. Not SOVcorp. Not a Mait. Classification: UNKNOWN.</div>
            </div>
            <div className={`${styles.codexEntry} ${styles.codexCorrupted}`}>
              <div className={styles.codexTitle}>T̸h̶e̵ ̷F̸o̷u̶n̵d̸e̴r̶s̶ ̸E̵t̷e̵r̷n̸a̵l̸</div>
              <div className={styles.codexBody}>▓▓▓ ENTRY CORRUPTED ▓▓▓ — Bridge Level 6 required</div>
            </div>
          </div>
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
          <div className={styles.appHeader}>MYMORIES</div>
          <div className={styles.shardGrid}>
            <div className={styles.shard}><div className={styles.shardIcon}>◆</div><div className={styles.shardLabel}>First Signal</div></div>
            <div className={styles.shard}><div className={styles.shardIcon}>◆</div><div className={styles.shardLabel}>Ghost Contact</div></div>
            <div className={`${styles.shard} ${styles.shardLocked}`}><div className={styles.shardIcon}>◇</div><div className={styles.shardLabel}>???</div></div>
            <div className={`${styles.shard} ${styles.shardLocked}`}><div className={styles.shardIcon}>◇</div><div className={styles.shardLabel}>???</div></div>
          </div>
        </div>
      );

    case 'arcade-2042':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>ARCADE 2042 // SIGNAL ARCADE</div>
          <div className={styles.placeholderContent}>
            <div className={styles.placeholderIcon}>🕹️</div>
            <div>Game loaded. Press START.</div>
          </div>
        </div>
      );

    case 'circuit-sync':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>CIRCUIT SYNC // SIGNAL PATTERN</div>
          <div className={styles.placeholderContent}>
            <div className={styles.placeholderIcon}>⚡</div>
            <div>Initialising pattern matrix...</div>
          </div>
        </div>
      );

    case 'holo-lock':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>HOLO-LOCK // SIGNAL BREACH</div>
          <div className={styles.placeholderContent}>
            <div className={styles.placeholderIcon}>🔓</div>
            <div>Lock sequence ready.</div>
          </div>
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

  if (win.isMinimized) return null;

  const windowStyle: React.CSSProperties = win.isMaximized
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
        <div className={styles.syncMeter}>
          <div className={styles.syncMeterLabel}>SYNC</div>
          <div className={styles.syncMeterBar}>
            <div className={styles.syncMeterFill} style={{ width: `${(evo.syncValue / 1200) * 100}%` }} />
          </div>
          <div className={styles.syncMeterValue}>{evo.syncValue}</div>
        </div>
        <div className={styles.bridgeBadge}>BL-{evo.bridgeLevel}</div>
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
  const [toastMsg, setToastMsg] = useState<string | null>(null);
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
  const standardApps = APP_REGISTRY.filter(a => ['my-computer','my-pictures','my-videos','soundwave'].includes(a.id));
  const strandsApps = APP_REGISTRY.filter(a => !['my-computer','my-pictures','my-videos','soundwave'].includes(a.id) && a.state !== 'hidden');
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
                <DesktopIcon key={app.id} app={app} onOpen={() => openWindow(app)} onLockedClick={setToastMsg} />
              ))}
            </div>
            {/* Separator */}
            <div className={styles.iconSep} />
            {/* Strands apps */}
            <div className={styles.iconGroup}>
              {strandsApps.map(app => (
                <DesktopIcon key={app.id} app={app} onOpen={() => openWindow(app)} onLockedClick={setToastMsg} />
              ))}
            </div>
            {/* Hidden row */}
            <div className={styles.iconSep} />
            <div className={styles.iconGroupHidden}>
              {hiddenApps.map(app => (
                <DesktopIcon key={app.id} app={app} onOpen={() => {}} onLockedClick={setToastMsg} />
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
        {toastMsg && <NotificationToast message={toastMsg} onDismiss={() => setToastMsg(null)} />}

        {/* Taskbar — pinned bottom */}
        <Taskbar windows={windows} activeWindowId={activeWindowId}
          onWindowClick={handleTaskbarClick} evo={evo} onToggleEra={toggleEra} />
      </div>
    </EvolutionContext.Provider>
  );
}
