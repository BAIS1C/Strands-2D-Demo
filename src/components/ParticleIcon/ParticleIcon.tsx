'use client';

import { useEffect, useRef } from 'react';

/* ═══════════════════════════════════════════════════════════════
   PARTICLE ICON — Canvas-rendered particle field icon.
   S³ tier apps render the "S³" glyph with tier color.
   Standard apps render their emoji glyph with per-app color.
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

interface ParticleIconProps {
  appId: string;
  tier?: string;
  emoji: string;
}

export default function ParticleIcon({ appId, tier, emoji }: ParticleIconProps) {
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
