'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './SignalSync.module.css';

/* ═══════════════════════════════════════════════════════════════
   SIGNAL SYNC — Force-Based Cursor Stabilisation Game

   Canon: CANON_Signal_Sync.md V1.0
   "The player is not watching a video. The player is holding
   reality together long enough to extract meaning."

   The cursor has MASS. Mouse input applies FORCE, not position.
   Inertia, momentum, overshoot, recovery tension.
   The sync zone DRIFTS. Spikes disrupt. Stability is earned.

   Video clarity maps to stability meter:
   0.0–0.3 = noise (LOW)
   0.3–0.7 = fragments (MID)
   0.7–1.0 = clarity (HIGH)
   ═══════════════════════════════════════════════════════════════ */

interface SignalSyncProps {
  /** Difficulty scalar 0.3–1.0. Higher = harder. */
  difficulty: number;
  /** Cumulative seconds of in-sync needed to complete */
  targetHoldTime: number;
  /** Called with NKQ metrics on completion */
  onComplete: (metrics: SyncMetrics) => void;
  /** Called each frame with current stability (0–1) for video clarity */
  onStabilityChange?: (stability: number) => void;
  /** Episode label shown in header */
  label?: string;
  /** Which cycle (affects spike types) */
  round?: number;
  /** Video source URL — plays behind static, clarity driven by stability */
  videoSrc?: string;
}

export interface SyncMetrics {
  timeToFirstSync: number;
  cumulativeSyncRatio: number;
  recoverySpeed: number;
  totalTime: number;
  attempts: number;
}

// ═══ PHYSICS CONSTANTS ═══
const FORCE_MULTIPLIER = 0.0008;   // mouse → force conversion
const DAMPING = 0.94;              // velocity decay per frame (higher = more slippery)
const DRIFT_SPEED_BASE = 0.0003;   // base sync zone drift speed
const DRIFT_FREQ = 0.0008;         // drift oscillation frequency
const FILL_RATE = 0.008;           // stability fill per frame when in-sync
const DRAIN_RATE = 0.013;          // stability drain per frame when out-of-sync (asymmetric)
const SPIKE_SOFT_SPEED = 0.003;    // soft drift spike zone shift per frame
const SPIKE_JUMP_DIST = 0.25;      // spike event: zone jumps this far
const WAVE_AMP = 0.12;             // wave oscillation amplitude
const WAVE_FREQ = 0.04;            // wave oscillation frequency

export default function SignalSync({
  difficulty = 0.5,
  targetHoldTime = 10,
  onComplete,
  onStabilityChange,
  label = 'SIGNAL FRAGMENT',
  round = 1,
  videoSrc,
}: SignalSyncProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stability, setStability] = useState(0);
  const [syncTime, setSyncTime] = useState(0);
  const [complete, setComplete] = useState(false);
  const [inSync, setInSync] = useState(false);

  // Physics state (refs for animation loop)
  const cursorPos = useRef(0.5);
  const cursorVel = useRef(0);
  const syncZoneCenter = useRef(0.5);
  const syncZoneWidth = useRef(0.2);
  const stabilityMeter = useRef(0);
  const cumulativeSyncTime = useRef(0);
  const totalSyncFrames = useRef(0);
  const totalFrames = useRef(0);
  const firstSyncTime = useRef(-1);
  const lastOutSyncTime = useRef(0);
  const recoveryTimes = useRef<number[]>([]);
  const startTime = useRef(0);
  const frameRef = useRef(0);
  const mouseXRef = useRef(0);
  const lastMouseXRef = useRef(0);
  const isActiveRef = useRef(false);
  const completeRef = useRef(false);

  // Spike state
  const spikeActive = useRef<'none' | 'soft' | 'jump' | 'wave'>('none');
  const spikeTimer = useRef(0);
  const spikeDirection = useRef(1);
  const nextSpikeAt = useRef(0);
  const wavePhase = useRef(0);
  const waveBaseCenter = useRef(0.5);

  // ═══ DIFFICULTY-SCALED PARAMETERS ═══
  const scaledDamping = DAMPING + (1 - difficulty) * 0.03; // easier = more damping = less slippery
  const scaledDriftSpeed = DRIFT_SPEED_BASE * (0.5 + difficulty * 0.8);
  const scaledZoneWidth = Math.max(0.08, 0.25 - difficulty * 0.17);
  const scaledFillRate = FILL_RATE * (1.3 - difficulty * 0.5);
  const scaledDrainRate = DRAIN_RATE * (0.7 + difficulty * 0.5);

  // ═══ INIT ═══
  useEffect(() => {
    syncZoneWidth.current = scaledZoneWidth;
    startTime.current = performance.now();
    // Schedule first spike
    if (round >= 3) {
      nextSpikeAt.current = 4000 + Math.random() * 3000;
    } else {
      nextSpikeAt.current = Infinity; // no spikes in rounds 1-2
    }
  }, [scaledZoneWidth, round]);

  // ═══ MOUSE TRACKING ═══
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseXRef.current = (e.clientX - rect.left) / rect.width;
      if (!isActiveRef.current) isActiveRef.current = true;
    };

    const handleTouch = (e: TouchEvent) => {
      if (!containerRef.current || !e.touches[0]) return;
      const rect = containerRef.current.getBoundingClientRect();
      mouseXRef.current = (e.touches[0].clientX - rect.left) / rect.width;
      if (!isActiveRef.current) isActiveRef.current = true;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleTouch, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleTouch);
    };
  }, []);

  // ═══ GAME LOOP ═══
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      if (completeRef.current) return;
      animId = requestAnimationFrame(loop);

      const dt = Math.min(now - lastTime, 33); // cap at ~30fps minimum
      lastTime = now;
      const elapsed = now - startTime.current;
      totalFrames.current++;

      // ═══ FORCE-BASED INPUT ═══
      if (isActiveRef.current) {
        const mouseDelta = mouseXRef.current - lastMouseXRef.current;
        const force = mouseDelta * FORCE_MULTIPLIER * (60 * dt / 16.67);
        cursorVel.current += force;
      }
      lastMouseXRef.current = mouseXRef.current;

      // ═══ DAMPING ═══
      cursorVel.current *= scaledDamping;

      // ═══ UPDATE POSITION ═══
      cursorPos.current += cursorVel.current;
      cursorPos.current = Math.max(0, Math.min(1, cursorPos.current));

      // ═══ SYNC ZONE DRIFT ═══
      const driftOffset = Math.sin(elapsed * DRIFT_FREQ) * 0.15 * difficulty;
      const noiseOffset = Math.sin(elapsed * DRIFT_FREQ * 2.7) * 0.04 * difficulty;

      if (spikeActive.current === 'none') {
        syncZoneCenter.current = 0.5 + driftOffset + noiseOffset;
        syncZoneCenter.current = Math.max(syncZoneWidth.current / 2,
          Math.min(1 - syncZoneWidth.current / 2, syncZoneCenter.current));
      }

      // ═══ SPIKE SYSTEM ═══
      if (spikeActive.current === 'none' && elapsed > nextSpikeAt.current) {
        // Trigger a spike
        if (round >= 4 && Math.random() > 0.5) {
          spikeActive.current = 'wave';
          spikeTimer.current = 0;
          wavePhase.current = 0;
          waveBaseCenter.current = syncZoneCenter.current;
        } else if (round >= 3 && Math.random() > 0.3) {
          spikeActive.current = 'jump';
          const jumpDir = Math.random() > 0.5 ? 1 : -1;
          syncZoneCenter.current = Math.max(0.15, Math.min(0.85,
            syncZoneCenter.current + SPIKE_JUMP_DIST * jumpDir * difficulty));
        } else {
          spikeActive.current = 'soft';
          spikeDirection.current = Math.random() > 0.5 ? 1 : -1;
          spikeTimer.current = 0;
        }
        nextSpikeAt.current = elapsed + 5000 + Math.random() * 6000 / difficulty;
      }

      // Process active spikes
      if (spikeActive.current === 'soft') {
        spikeTimer.current += dt;
        syncZoneCenter.current += spikeDirection.current * SPIKE_SOFT_SPEED * difficulty * (dt / 16.67);
        syncZoneCenter.current = Math.max(0.15, Math.min(0.85, syncZoneCenter.current));
        if (spikeTimer.current > 2000) spikeActive.current = 'none';
      } else if (spikeActive.current === 'jump') {
        spikeActive.current = 'none'; // instant
      } else if (spikeActive.current === 'wave') {
        spikeTimer.current += dt;
        wavePhase.current += WAVE_FREQ * (dt / 16.67);
        syncZoneCenter.current = waveBaseCenter.current + Math.sin(wavePhase.current) * WAVE_AMP * difficulty;
        syncZoneCenter.current = Math.max(0.15, Math.min(0.85, syncZoneCenter.current));
        if (spikeTimer.current > 4000) spikeActive.current = 'none';
      }

      // ═══ SYNC CHECK ═══
      const dist = Math.abs(cursorPos.current - syncZoneCenter.current);
      const isInSync = dist < syncZoneWidth.current / 2;

      if (isInSync) {
        if (firstSyncTime.current < 0) {
          firstSyncTime.current = elapsed / 1000;
        }
        if (lastOutSyncTime.current > 0) {
          recoveryTimes.current.push(elapsed - lastOutSyncTime.current);
          lastOutSyncTime.current = 0;
        }
        totalSyncFrames.current++;
        stabilityMeter.current = Math.min(1, stabilityMeter.current + scaledFillRate * (dt / 16.67));
        cumulativeSyncTime.current += dt / 1000;
      } else {
        if (lastOutSyncTime.current === 0) {
          lastOutSyncTime.current = elapsed;
        }
        stabilityMeter.current = Math.max(0, stabilityMeter.current - scaledDrainRate * (dt / 16.67));
      }

      setInSync(isInSync);
      setStability(stabilityMeter.current);
      setSyncTime(cumulativeSyncTime.current);
      onStabilityChange?.(stabilityMeter.current);

      // ═══ COMPLETION CHECK ═══
      if (cumulativeSyncTime.current >= targetHoldTime) {
        completeRef.current = true;
        setComplete(true);
        const avgRecovery = recoveryTimes.current.length > 0
          ? recoveryTimes.current.reduce((a, b) => a + b, 0) / recoveryTimes.current.length / 1000
          : 0;
        onComplete({
          timeToFirstSync: firstSyncTime.current,
          cumulativeSyncRatio: totalSyncFrames.current / Math.max(1, totalFrames.current),
          recoverySpeed: avgRecovery,
          totalTime: elapsed / 1000,
          attempts: 1,
        });
        return;
      }

      // ═══ RENDER ═══
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background bar
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
        const x = (i / 20) * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }

      // Sync zone
      const zoneLeft = (syncZoneCenter.current - syncZoneWidth.current / 2) * w;
      const zoneRight = (syncZoneCenter.current + syncZoneWidth.current / 2) * w;
      const zoneGlow = isInSync ? 0.15 : 0.06;
      ctx.fillStyle = isInSync
        ? `rgba(0,194,255,${zoneGlow})`
        : `rgba(240,0,184,${zoneGlow})`;
      ctx.fillRect(zoneLeft, 0, zoneRight - zoneLeft, h);

      // Zone borders
      ctx.strokeStyle = isInSync ? 'rgba(0,194,255,0.5)' : 'rgba(240,0,184,0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(zoneLeft, 0); ctx.lineTo(zoneLeft, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(zoneRight, 0); ctx.lineTo(zoneRight, h); ctx.stroke();

      // Zone center marker
      const cx = syncZoneCenter.current * w;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.setLineDash([3, 6]);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
      ctx.setLineDash([]);

      // Cursor
      const curX = cursorPos.current * w;
      const cursorColor = isInSync ? '#00c2ff' : '#f000b8';

      // Cursor trail (velocity-based)
      const trailLen = Math.abs(cursorVel.current) * w * 8;
      const trailDir = cursorVel.current > 0 ? -1 : 1;
      const trailGrad = ctx.createLinearGradient(
        curX, 0, curX + trailDir * trailLen, 0
      );
      trailGrad.addColorStop(0, isInSync ? 'rgba(0,194,255,0.3)' : 'rgba(240,0,184,0.2)');
      trailGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = trailGrad;
      ctx.fillRect(Math.min(curX, curX + trailDir * trailLen), h * 0.25,
        Math.abs(trailLen), h * 0.5);

      // Cursor line
      ctx.strokeStyle = cursorColor;
      ctx.lineWidth = 3;
      ctx.shadowColor = cursorColor;
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(curX, 4); ctx.lineTo(curX, h - 4); ctx.stroke();
      ctx.shadowBlur = 0;

      // Cursor diamond
      ctx.fillStyle = cursorColor;
      ctx.beginPath();
      ctx.moveTo(curX, h / 2 - 8);
      ctx.lineTo(curX + 6, h / 2);
      ctx.lineTo(curX, h / 2 + 8);
      ctx.lineTo(curX - 6, h / 2);
      ctx.closePath();
      ctx.fill();

      // Stability meter fill at bottom
      const meterH = 3;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, h - meterH, w, meterH);
      const fillColor = stabilityMeter.current > 0.7 ? '#22c55e'
        : stabilityMeter.current > 0.3 ? '#00c2ff' : '#f000b8';
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, h - meterH, w * stabilityMeter.current, meterH);

      frameRef.current++;
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [difficulty, targetHoldTime, scaledDamping, scaledDriftSpeed, scaledZoneWidth,
      scaledFillRate, scaledDrainRate, onComplete, onStabilityChange, round]);

  const progress = Math.min(1, syncTime / targetHoldTime);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={`${styles.status} ${inSync ? styles.statusSync : styles.statusDrift}`}>
          {inSync ? '● IN SYNC' : '○ DRIFT'}
        </span>
      </div>

      {/* Static/Clarity field — visual feedback tied to stability */}
      <div className={styles.videoField}>
        {/* Video layer — sits behind all overlays, opacity & blur driven by stability */}
        {videoSrc && (
          <video
            ref={videoRef}
            className={styles.videoLayer}
            src={videoSrc}
            autoPlay
            loop
            muted
            playsInline
            style={{
              opacity: Math.min(1, stability * 1.4),
              filter: stability > 0.7
                ? 'blur(0px) saturate(1.2)'
                : stability > 0.3
                  ? `blur(${Math.round((0.7 - stability) * 8)}px) saturate(0.6)`
                  : `blur(8px) saturate(0.2) brightness(0.4)`,
            }}
          />
        )}
        <div
          className={styles.staticNoise}
          style={{ opacity: Math.max(0, 1 - stability * 1.3) }}
        />
        <div
          className={styles.clarityField}
          style={{ opacity: videoSrc ? 0 : Math.min(1, stability * 1.5) }}
        >
          {!videoSrc && stability > 0.7 && (
            <div className={styles.clarityText}>
              <div className={styles.clarityPulse}>SIGNAL COHERENT</div>
            </div>
          )}
          {!videoSrc && stability > 0.3 && stability <= 0.7 && (
            <div className={styles.clarityText}>
              <div style={{ opacity: 0.5 }}>signal resolving...</div>
            </div>
          )}
        </div>
        {/* Scanlines — persistent but fade as signal clears */}
        <div className={styles.scanlines} style={{ opacity: Math.max(0.05, 1 - stability) }} />
        {/* Glitch bar — horizontal displacement artifact when stability is low */}
        {videoSrc && stability < 0.5 && (
          <div
            className={styles.glitchBar}
            style={{
              top: `${Math.random() * 100}%`,
              opacity: Math.max(0, 0.5 - stability),
            }}
          />
        )}
      </div>

      {/* The sync bar */}
      <canvas
        ref={canvasRef}
        width={520}
        height={48}
        className={styles.syncBar}
      />

      {/* Progress */}
      <div className={styles.footer}>
        <div className={styles.progressWrap}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
          </div>
          <span className={styles.progressLabel}>
            {complete ? '✓ DECODED' : `${Math.floor(progress * 100)}%`}
          </span>
        </div>
        <span className={styles.timer}>{syncTime.toFixed(1)}s / {targetHoldTime}s</span>
      </div>

      {complete && (
        <div className={styles.completeOverlay}>
          <div className={styles.completeText}>FRAGMENT DECODED</div>
        </div>
      )}

      {!isActiveRef.current && !complete && (
        <div className={styles.instruction}>
          Move mouse to stabilise signal — hold cursor in the sync zone
        </div>
      )}
    </div>
  );
}
