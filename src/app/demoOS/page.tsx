'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import styles from './page.module.css';

/* ═══════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════ */

type AppState = 'available' | 'locked' | 'ghosted' | 'hidden';
type AppCategory = 'identity' | 'skill' | 'crafting' | 'generative' | 'network' | 'base';

interface AppManifest {
  id: string;
  label: string;
  icon: string;
  category: AppCategory;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  state: AppState;
  lockMessage?: string;
  gridPosition: { row: number; col: number };
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
   APP REGISTRY — From ARCH_DemoOS_Desktop_Architecture_V3 §3.4
   ═══════════════════════════════════════════════════════════════ */

const APP_REGISTRY: AppManifest[] = [
  // Row 0
  { id: 'signal-reg',   label: 'Signal Reg',   icon: '📡', category: 'identity',   minWidth: 320, minHeight: 400, defaultWidth: 360,  defaultHeight: 440, state: 'available', gridPosition: { row: 0, col: 0 } },
  { id: 'messages',     label: 'Messages',      icon: '💬', category: 'identity',   minWidth: 360, minHeight: 480, defaultWidth: 420,  defaultHeight: 540, state: 'available', gridPosition: { row: 0, col: 1 } },
  { id: 'voice-sync',   label: 'Voice Sync',    icon: '🎙️', category: 'identity',   minWidth: 400, minHeight: 300, defaultWidth: 400,  defaultHeight: 340, state: 'locked', lockMessage: 'Requires Signal Registration', gridPosition: { row: 0, col: 2 } },
  { id: 'documents',    label: 'Documents',     icon: '📄', category: 'identity',   minWidth: 360, minHeight: 440, defaultWidth: 400,  defaultHeight: 480, state: 'locked', lockMessage: 'Requires Signal Recovery', gridPosition: { row: 0, col: 3 } },
  { id: 'cipher-tool',  label: 'Cipher Tool',   icon: '🔐', category: 'skill',      minWidth: 400, minHeight: 400, defaultWidth: 440,  defaultHeight: 440, state: 'locked', lockMessage: 'Requires Escalation Protocol', gridPosition: { row: 0, col: 4 } },

  // Row 1
  { id: 'soundwave',    label: 'SoundWave',     icon: '🎵', category: 'generative', minWidth: 280, minHeight: 180, defaultWidth: 340,  defaultHeight: 260, state: 'available', gridPosition: { row: 1, col: 0 } },
  { id: 'arcade-2042',  label: 'Arcade 2042',   icon: '🕹️', category: 'skill',      minWidth: 480, minHeight: 620, defaultWidth: 500,  defaultHeight: 680, state: 'available', gridPosition: { row: 1, col: 1 } },
  { id: 'circuit-sync', label: 'Circuit Sync',  icon: '⚡', category: 'skill',      minWidth: 500, minHeight: 400, defaultWidth: 520,  defaultHeight: 440, state: 'available', gridPosition: { row: 1, col: 2 } },
  { id: 'holo-lock',    label: 'Holo-Lock',     icon: '🔓', category: 'skill',      minWidth: 520, minHeight: 500, defaultWidth: 540,  defaultHeight: 540, state: 'available', gridPosition: { row: 1, col: 3 } },
  { id: 'signal-rush',  label: 'Signal Rush',   icon: '🚀', category: 'skill',      minWidth: 360, minHeight: 600, defaultWidth: 380,  defaultHeight: 640, state: 'locked', lockMessage: 'Coming Soon', gridPosition: { row: 1, col: 4 } },

  // Row 2
  { id: 'signal-monitor', label: 'Signal Monitor', icon: '📺', category: 'network',  minWidth: 440, minHeight: 500, defaultWidth: 480, defaultHeight: 540, state: 'available', gridPosition: { row: 2, col: 0 } },
  { id: 'mymories',     label: 'Mymories',      icon: '🧠', category: 'network',    minWidth: 360, minHeight: 440, defaultWidth: 400,  defaultHeight: 480, state: 'available', gridPosition: { row: 2, col: 1 } },
  { id: 'bridge-app',   label: 'CPU-VPU Bridge', icon: '🌉', category: 'base',      minWidth: 400, minHeight: 480, defaultWidth: 440,  defaultHeight: 520, state: 'available', gridPosition: { row: 2, col: 2 } },
  { id: 'codex',        label: 'The Codex',     icon: '📖', category: 'identity',   minWidth: 400, minHeight: 500, defaultWidth: 440,  defaultHeight: 540, state: 'available', gridPosition: { row: 2, col: 3 } },
  { id: 'trading-post', label: 'Trading Post',  icon: '💰', category: 'network',    minWidth: 360, minHeight: 440, defaultWidth: 400,  defaultHeight: 480, state: 'locked', lockMessage: 'Bridge Level 5 Required', gridPosition: { row: 2, col: 4 } },

  // Row 3 — Hidden
  { id: 'kasai-terminal', label: '???',           icon: '?',  category: 'network',    minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden', gridPosition: { row: 3, col: 0 } },
  { id: 'portal',        label: 'The Portal',    icon: '🌀', category: 'base',       minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden', gridPosition: { row: 3, col: 1 } },
  { id: 'ace-studio',    label: 'ACE Studio',    icon: '🎹', category: 'generative', minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden', gridPosition: { row: 3, col: 2 } },
  { id: 'texture-lab',   label: 'Texture Lab',   icon: '🎨', category: 'generative', minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden', gridPosition: { row: 3, col: 3 } },
  { id: 'everywear',     label: 'EveryWear',     icon: '🌐', category: 'network',    minWidth: 400, minHeight: 400, defaultWidth: 440, defaultHeight: 440, state: 'hidden', gridPosition: { row: 3, col: 4 } },
];

/* ═══════════════════════════════════════════════════════════════
   DEMO APP CONTENT — Placeholder content per app
   ═══════════════════════════════════════════════════════════════ */

function AppContent({ appId, lockMessage }: { appId: string; lockMessage?: string }) {
  if (lockMessage) {
    return (
      <div className={styles.lockedContent}>
        <div className={styles.lockIcon}>🔒</div>
        <div className={styles.lockMsg}>{lockMessage}</div>
        <div className={styles.lockSub}>Continue progressing to unlock</div>
      </div>
    );
  }

  switch (appId) {
    case 'signal-reg':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>SIGNAL REGISTRATION</div>
          <div className={styles.demoTag}>DEMO MODE — Auth Bypassed</div>
          <div className={styles.profileCard}>
            <div className={styles.profileAvatar}>👤</div>
            <div className={styles.profileInfo}>
              <div className={styles.profileName}>AGENT-7749</div>
              <div className={styles.profileSub}>Signal Class: LATENT</div>
              <div className={styles.profileSub}>Clearance: UNVERIFIED</div>
              <div className={styles.profileSub}>Sync: 375 / 1,200</div>
            </div>
          </div>
          <div className={styles.statusBar}>
            <div className={styles.statusFill} style={{ width: '31%' }} />
          </div>
          <div className={styles.statusLabel}>SUBSTRATE CALIBRATION: 31%</div>
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

    case 'signal-monitor':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>SIGNAL MONITOR</div>
          <div className={styles.monitorScreen}>
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
        </div>
      );

    case 'bridge-app':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>CPU-VPU BRIDGE</div>
          <div className={styles.bridgeVis}>
            <div className={styles.bridgeRow}>
              {[1,2,3,4,5].map(l => (
                <div key={l} className={`${styles.bridgeNode} ${l <= 3 ? styles.bridgeLit : l === 4 ? styles.bridgePulse : styles.bridgeDim}`}>
                  L{l}
                </div>
              ))}
            </div>
            <div className={styles.bridgeRow}>
              {[6,7,8,9,10].map(l => (
                <div key={l} className={`${styles.bridgeNode} ${styles.bridgeDim}`}>
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
          <div className={styles.syncTotal}>TOTAL SYNC: 375 / 1,200</div>
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
              <div className={styles.codexBody}>Year 0. The event that ended the old world. Records fragmented. Official SOVcorp narrative: &quot;From ruin, structure.&quot; Signal jack S0-01 suggests premeditation — a cityscape that doesn&apos;t match MetaXity1.</div>
            </div>
            <div className={styles.codexEntry}>
              <div className={styles.codexTitle}>MetaXity1 — The Cracks</div>
              <div className={styles.codexBody}>The SE Asia corridor. A pyramid civilisation of vertical strata. The embodiment gradient made architecture. Something grows in the cracks between official tiers.</div>
            </div>
            <div className={styles.codexEntry}>
              <div className={styles.codexTitle}>KASAI — Unverified</div>
              <div className={styles.codexBody}>Signal anomalies suggest a presence in the substrate. Not SOVcorp. Not a Mait. Classification: UNKNOWN. Status: WATCHING.</div>
            </div>
            <div className={`${styles.codexEntry} ${styles.codexCorrupted}`}>
              <div className={styles.codexTitle}>T̸h̶e̵ ̷F̸o̷u̶n̵d̸e̴r̶s̶ ̸E̵t̷e̵r̷n̸a̵l̸</div>
              <div className={styles.codexBody}>▓▓▓ ENTRY CORRUPTED ▓▓▓ — Bridge Level 6 required for signal reconstruction</div>
            </div>
          </div>
        </div>
      );

    case 'mymories':
      return (
        <div className={styles.appBody}>
          <div className={styles.appHeader}>MYMORIES</div>
          <div className={styles.shardGrid}>
            <div className={styles.shard}>
              <div className={styles.shardIcon}>◆</div>
              <div className={styles.shardLabel}>First Signal</div>
            </div>
            <div className={styles.shard}>
              <div className={styles.shardIcon}>◆</div>
              <div className={styles.shardLabel}>Ghost Contact</div>
            </div>
            <div className={`${styles.shard} ${styles.shardLocked}`}>
              <div className={styles.shardIcon}>◇</div>
              <div className={styles.shardLabel}>???</div>
            </div>
            <div className={`${styles.shard} ${styles.shardLocked}`}>
              <div className={styles.shardIcon}>◇</div>
              <div className={styles.shardLabel}>???</div>
            </div>
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
   WINDOW COMPONENT — Drag, Resize, Minimize, Maximize, Close
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

function Window({ win, isActive, onFocus, onClose, onMinimize, onMaximize, onMove, onResize, children }: WindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; winX: number; winY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number; startWinX: number; startWinY: number; edges: string } | null>(null);

  // Drag handler
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
    const newX = Math.max(0, Math.min(window.innerWidth - 100, dragRef.current.winX + dx));
    const newY = Math.max(0, Math.min(window.innerHeight - 100, dragRef.current.winY + dy));
    onMove(newX, newY);
  }, [onMove]);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Resize handler
  const handleResizeStart = useCallback((e: React.PointerEvent, edges: string) => {
    if (win.isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    resizeRef.current = {
      startX: e.clientX, startY: e.clientY,
      startW: win.width, startH: win.height,
      startWinX: win.x, startWinY: win.y,
      edges,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [win.width, win.height, win.x, win.y, win.isMaximized, onFocus]);

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const r = resizeRef.current;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    let newW = r.startW;
    let newH = r.startH;
    let newX = r.startWinX;
    let newY = r.startWinY;

    if (r.edges.includes('e')) newW = Math.max(win.minWidth, r.startW + dx);
    if (r.edges.includes('s')) newH = Math.max(win.minHeight, r.startH + dy);
    if (r.edges.includes('w')) {
      const delta = Math.min(dx, r.startW - win.minWidth);
      newW = r.startW - delta;
      newX = r.startWinX + delta;
    }
    if (r.edges.includes('n')) {
      const delta = Math.min(dy, r.startH - win.minHeight);
      newH = r.startH - delta;
      newY = r.startWinY + delta;
    }
    onResize(newW, newH, newX, newY);
  }, [win.minWidth, win.minHeight, onResize]);

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null;
  }, []);

  if (win.isMinimized) return null;

  const TASKBAR_H = 52;
  const windowStyle: React.CSSProperties = win.isMaximized
    ? { left: 0, top: 0, width: '100%', height: `calc(100vh - ${TASKBAR_H}px)`, zIndex: win.zIndex }
    : { left: win.x, top: win.y, width: win.width, height: win.height, zIndex: win.zIndex };

  const resizeEdges = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];

  return (
    <div
      ref={windowRef}
      className={`${styles.window} ${isActive ? styles.windowActive : ''}`}
      style={windowStyle}
      onPointerDown={onFocus}
    >
      {/* Resize handles */}
      {!win.isMaximized && resizeEdges.map(edge => (
        <div
          key={edge}
          className={`${styles.resizeHandle} ${styles[`resize_${edge}`]}`}
          onPointerDown={(e) => handleResizeStart(e, edge)}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
        />
      ))}

      {/* Title bar */}
      <div
        className={styles.titleBar}
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onDoubleClick={onMaximize}
      >
        <span className={styles.titleIcon}>{win.icon}</span>
        <span className={styles.titleText}>{win.title}</span>
        <div className={styles.windowControls}>
          <button className={styles.winBtn} onClick={(e) => { e.stopPropagation(); onMinimize(); }} title="Minimize">
            <span className={styles.winBtnMin}>─</span>
          </button>
          <button className={styles.winBtn} onClick={(e) => { e.stopPropagation(); onMaximize(); }} title="Maximize">
            <span className={styles.winBtnMax}>□</span>
          </button>
          <button className={`${styles.winBtn} ${styles.winBtnClose}`} onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close">
            <span>×</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={styles.windowContent}>
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP ICON
   ═══════════════════════════════════════════════════════════════ */

function DesktopIcon({ app, onOpen }: { app: AppManifest; onOpen: () => void }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (app.state === 'hidden') {
    return (
      <div className={styles.iconSlotHidden}>
        <div className={styles.hiddenGlitch}>
          {app.id === 'kasai-terminal' && <span className={styles.glitchChar}>?</span>}
        </div>
      </div>
    );
  }

  const isLocked = app.state === 'locked';
  const isGhosted = app.state === 'ghosted';

  return (
    <button
      className={`${styles.desktopIcon} ${isLocked ? styles.desktopIconLocked : ''} ${isGhosted ? styles.desktopIconGhosted : ''}`}
      onDoubleClick={() => !isLocked && !isGhosted && onOpen()}
      onClick={() => isLocked && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      title={isLocked ? app.lockMessage : app.label}
    >
      <div className={styles.iconGlyph}>
        {app.icon}
        {isLocked && <div className={styles.lockOverlay}>🔒</div>}
      </div>
      <div className={styles.iconLabel}>{app.label}</div>
      {app.state === 'available' && app.id === 'messages' && (
        <div className={styles.notificationDot} />
      )}
      {showTooltip && isLocked && (
        <div className={styles.tooltip}>{app.lockMessage}</div>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TASKBAR
   ═══════════════════════════════════════════════════════════════ */

function Taskbar({
  windows,
  activeWindowId,
  onWindowClick,
  syncValue,
  bridgeLevel,
}: {
  windows: WindowState[];
  activeWindowId: string | null;
  onWindowClick: (id: string) => void;
  syncValue: number;
  bridgeLevel: number;
}) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'Asia/Singapore',
      }));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className={styles.taskbar}>
      {/* Start button */}
      <button className={styles.startBtn}>
        <span className={styles.startLogo}>◈</span>
      </button>

      {/* Open windows */}
      <div className={styles.taskbarWindows}>
        {windows.map(w => (
          <button
            key={w.id}
            className={`${styles.taskbarApp} ${w.id === activeWindowId ? styles.taskbarAppActive : ''} ${w.isMinimized ? styles.taskbarAppMinimized : ''}`}
            onClick={() => onWindowClick(w.id)}
          >
            <span className={styles.taskbarAppIcon}>{w.icon}</span>
            <span className={styles.taskbarAppLabel}>{w.title}</span>
          </button>
        ))}
      </div>

      {/* System tray */}
      <div className={styles.systemTray}>
        <div className={styles.syncMeter}>
          <div className={styles.syncMeterLabel}>SYNC</div>
          <div className={styles.syncMeterBar}>
            <div className={styles.syncMeterFill} style={{ width: `${(syncValue / 1200) * 100}%` }} />
          </div>
          <div className={styles.syncMeterValue}>{syncValue}</div>
        </div>
        <div className={styles.bridgeBadge}>BL-{bridgeLevel}</div>
        <div className={styles.anomalyIndicator} title="Signal anomaly detected">
          <span className={styles.anomalyPulse}>◉</span>
        </div>
        <div className={styles.taskbarClock}>{time}</div>
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
        setTimeout(onComplete, 800);
      }
    }, 300);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.bootScreen}>
      <div className={styles.bootTerminal}>
        {lines.map((line, i) => (
          <div key={i} className={styles.bootLine}>
            <span className={styles.bootPrompt}>&gt;</span> {line}
          </div>
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
  const windowCounter = useRef(0);

  // Open a new window
  const openWindow = useCallback((app: AppManifest) => {
    // Check if already open
    const existing = windows.find(w => w.appId === app.id);
    if (existing) {
      // Focus existing
      setNextZ(z => z + 1);
      setWindows(prev => prev.map(w =>
        w.id === existing.id
          ? { ...w, zIndex: nextZ + 1, isMinimized: false }
          : w
      ));
      setActiveWindowId(existing.id);
      return;
    }

    windowCounter.current++;
    const id = `win-${windowCounter.current}`;
    const offsetX = (windowCounter.current % 8) * 30;
    const offsetY = (windowCounter.current % 6) * 30;
    const newWin: WindowState = {
      id,
      appId: app.id,
      title: app.label,
      icon: app.icon,
      x: 120 + offsetX,
      y: 40 + offsetY,
      width: app.defaultWidth,
      height: app.defaultHeight,
      minWidth: app.minWidth,
      minHeight: app.minHeight,
      zIndex: nextZ + 1,
      isMinimized: false,
      isMaximized: false,
    };
    setNextZ(z => z + 1);
    setWindows(prev => [...prev, newWin]);
    setActiveWindowId(id);
  }, [windows, nextZ]);

  const focusWindow = useCallback((id: string) => {
    setNextZ(z => {
      setWindows(prev => prev.map(w =>
        w.id === id ? { ...w, zIndex: z + 1 } : w
      ));
      return z + 1;
    });
    setActiveWindowId(id);
  }, []);

  const closeWindow = useCallback((id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
    if (activeWindowId === id) setActiveWindowId(null);
  }, [activeWindowId]);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w =>
      w.id === id ? { ...w, isMinimized: true } : w
    ));
    if (activeWindowId === id) setActiveWindowId(null);
  }, [activeWindowId]);

  const maximizeWindow = useCallback((id: string) => {
    setWindows(prev => prev.map(w => {
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
    }));
  }, []);

  const moveWindow = useCallback((id: string, x: number, y: number) => {
    setWindows(prev => prev.map(w => w.id === id ? { ...w, x, y } : w));
  }, []);

  const resizeWindow = useCallback((id: string, width: number, height: number, x?: number, y?: number) => {
    setWindows(prev => prev.map(w => {
      if (w.id !== id) return w;
      const update: Partial<WindowState> = { width, height };
      if (x !== undefined) update.x = x;
      if (y !== undefined) update.y = y;
      return { ...w, ...update };
    }));
  }, []);

  const handleTaskbarClick = useCallback((id: string) => {
    const win = windows.find(w => w.id === id);
    if (!win) return;
    if (win.isMinimized) {
      setWindows(prev => prev.map(w => w.id === id ? { ...w, isMinimized: false } : w));
      focusWindow(id);
    } else if (activeWindowId === id) {
      minimizeWindow(id);
    } else {
      focusWindow(id);
    }
  }, [windows, activeWindowId, focusWindow, minimizeWindow]);

  // Build the 5×4 grid
  const grid: (AppManifest | null)[][] = [[], [], [], []];
  APP_REGISTRY.forEach(app => {
    grid[app.gridPosition.row][app.gridPosition.col] = app;
  });

  if (!booted) {
    return <BootSequence onComplete={() => setBooted(true)} />;
  }

  return (
    <div className={styles.desktopOS}>
      {/* Desktop Surface */}
      <div className={styles.desktopSurface}>
        <div className={styles.circuitPattern} />
        <div className={styles.radialCyan} />
        <div className={styles.radialPink} />
        <div className={styles.gridLines} />
        <div className={styles.scanlineOverlay} />
      </div>

      {/* Icon Grid */}
      <div className={styles.iconGrid}>
        {grid.map((row, ri) => (
          <div key={ri} className={styles.iconRow}>
            {row.map((app, ci) => (
              app ? (
                <DesktopIcon
                  key={app.id}
                  app={app}
                  onOpen={() => openWindow(app)}
                />
              ) : (
                <div key={`empty-${ri}-${ci}`} className={styles.iconSlotEmpty} />
              )
            ))}
          </div>
        ))}
      </div>

      {/* Windows */}
      {windows.map(win => {
        const app = APP_REGISTRY.find(a => a.id === win.appId);
        return (
          <Window
            key={win.id}
            win={win}
            isActive={win.id === activeWindowId}
            onFocus={() => focusWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onMaximize={() => maximizeWindow(win.id)}
            onMove={(x, y) => moveWindow(win.id, x, y)}
            onResize={(w, h, x, y) => resizeWindow(win.id, w, h, x, y)}
          >
            <AppContent appId={win.appId} lockMessage={app?.lockMessage} />
          </Window>
        );
      })}

      {/* Taskbar */}
      <Taskbar
        windows={windows}
        activeWindowId={activeWindowId}
        onWindowClick={handleTaskbarClick}
        syncValue={375}
        bridgeLevel={3}
      />
    </div>
  );
}
