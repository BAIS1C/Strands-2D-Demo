# DemoOS Changelog

## 2026-03-20 — DemoOS Applet Integration Pass (Cosmetic / UI Shell)

### Added
- **Music Player applet** (🎶 `music-player`) — New Standard OS icon. Real audio player using the Strands soundtrack from `playlist.ts`. Full playback: play/pause, skip, seek, volume, mute, animated waveform visualiser, scrollable playlist with all 15 tracks. Audio persists when window is minimized.
- **SoundWave / ACE Step Studio applet** (🎵 `soundwave`) — Promoted from hidden Row 4 teaser to available Strands app. Opens a generation UI shell with prompt textarea, lyrics textarea, duration/BPM/language controls, and Generate button. UI-only for now — no API backend wired. Ready for tunnel/HF integration.
- **Mymories landing page** (🧠 `mymories`) — Replaced placeholder shard grid with branded landing view: concept explanation, feature list, narrative framing, Install button (→ GitHub), Read the Docs button (→ GitHub README), lore quote.
- **ACE Step CSS** — Full styled form for the SoundWave generation UI (`.aceStudio`, `.acePrompt`, `.aceLyrics`, `.aceControls`, `.aceGenerateBtn`).
- **Mymories CSS** — Styled landing view (`.mymoriesLanding`, `.mymoriesHero`, `.mymoriesInstallBtn`, `.mymoriesDocsBtn`, etc.).
- **Architecture document** — `ARCH_ACEStep_DemoOS_Integration.md` added to Game Canon 2026. Covers two deployment options (local tunnel vs HuggingFace Space), naming corrections, Mymories spec, corrected app registry.

### Changed
- **SoundWave applet** — Replaced custom ACE Step form with iframe embedding the actual StepStudio UI (`/stepstudio/`). The real Project Ace StepStudio React app renders inside the DemoOS window, preserving all existing controls, theming, and functionality. Requires StepStudio to be built and served at `/stepstudio/`.
- **Codex applet** — Fixed iframe URL from `https://demo.strandsnation.xyz/#codex` (loaded full game page) to `/codex` (same-origin relative path, loads actual Codex section).
- **Icon grid layout** — Changed `.iconGroup` and `.iconGroupHidden` to `display: contents` so individual icons participate directly in parent flex column-first flow. Fixes half-empty first column bug. Applied `opacity: 0.5` directly on `.iconSlotHidden` (child selector broke with `display: contents`).
- **Window minimize behaviour** — Changed from unmounting (`return null`) to CSS `display: none`. Audio and all component state now persists when windows are minimized. Affects all applets.
- **SoundWave naming** — Corrected: SoundWave = ACE Step Studio (AI music generation). Was previously used for the soundtrack player.
- **Progress bar hover** — `.progressTrack` now expands from 4px to 6px on hover, with cursor pointer.

### Removed
- **Sync gates** — Removed `syncGated` from Arcade 2042 (was 500), Holo-Lock (was 700), and MyConsent (was 600). All apps now open directly in demo mode.
- **Hidden ACE Studio** — Removed `ace-studio` from hidden apps row (now `soundwave` in the available Strands group).

### Fixed
- **Mymories component mismatch** — Was mapped to `LockedApp` despite `state: 'available'`. Now uses dedicated `MymoriesApp` landing view.
- **Codex iframe target** — Was loading full game page (`/#codex`) instead of the Codex route (`/codex`). Nav.tsx confirmed `/codex` is the correct path.
- **Icon grid column fill** — Icons were filling row-by-row with first column half-empty. `.iconGroup` wrapper divs were breaking flex column wrapping. `display: contents` fix lets icons flow as flat flex children.
- **`display: contents` child selector breakage** — `.iconGroupHidden .iconSlotHidden` opacity rule stopped working when parent became `display: contents`. Moved opacity directly to `.iconSlotHidden`.

---

## Pre-2026-03-20 — Initial DemoOS Build

- Boot sequence animation
- Window manager (drag, resize, stack, minimize, maximize, close)
- Icon grid with available/locked/hidden/ghosted states
- Taskbar with open apps, Sync meter, Bridge Level, SGT clock, era toggle
- Desktop surface with circuit pattern, radial gradients, scanline overlay
- App content for: My Computer, Documents, My Pictures, My Videos, Signal Reg, Messages, Bridge App, Signal Monitor, MyConsent, Arcade 2042, Holo-Lock
- Notification toast system for locked icons
- Evolution context (2026 ↔ Year 555) with era toggle
