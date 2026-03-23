'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './QuestChat.module.css';

/* ═══════════════════════════════════════════════════════════════
   QUEST CHAT — 3-Cycle Progressive Decode Narrative Engine

   Lives inside the DemoOS Messages window. Drives the entire
   onboarding quest through chat narrative, inline puzzles,
   and callbacks to the parent DemoOS for desktop-level effects.

   Cycle 1: Gang chat → Cipher gate → File materialises on desktop
            → Right-click rename discovery → Signal Sync → EP1 video
   Cycle 2: Chat continues → Circuit Sync gate → KASAI in video
            → Signal Sync → EP2 video
   Cycle 3: KASAI takes over chat → 2042 game file → Play to score
            → Death unlocks EP3 → Signal Sync → EP3 video

   MBTI assessment is SILENT — distributed across player choices.
   NKQ cognitive assessment from puzzle speed + game performance.
   ═══════════════════════════════════════════════════════════════ */

/* ── Types ── */

export interface QuestCallbacks {
  onFileAppear: (fileName: string) => void;        // Materialise file icon on desktop
  onOpenSignalSync: (round: number) => void;        // Open Signal Sync in its own window
  onOpenVideo: (episode: number) => void;           // Open video player window
  onOpenGame: (gameId: string) => void;             // Open 2042 or circuit-sync
  onOpenCircuitSync: () => void;                    // Open circuit sync game
  onQuestComplete: (profile: AssessmentProfile) => void;
  onNotify: (msg: string) => void;                  // Toast notification
}

export interface AssessmentProfile {
  EI: number;  // -1 to 1 (negative = introvert)
  SN: number;  // -1 to 1 (negative = intuitive)
  TF: number;  // -1 to 1 (negative = feeling)
  JP: number;  // -1 to 1 (negative = perceiving)
  nkqSpeed: number;
  nkqPattern: number;
  nkqMemory: number;
}

type MsgRole = 'ghost93' | 'crashweaver' | 'kira' | 'nex' | 'system' | 'kasai' | 'player' | 'file';

interface ChatMessage {
  id: string;
  role: MsgRole;
  text: string;
  isTyping?: boolean;
  isGlitched?: boolean;
  isCipher?: boolean;
  isFileAttachment?: boolean;
  fileIcon?: string;
  timestamp?: string;
}

interface CipherPuzzle {
  scrambled: string;
  answer: string;
  hint: string;
}

type QuestPhase =
  | 'intro'           // Opening messages auto-play
  | 'cipher-1'        // Cycle 1 cipher puzzle
  | 'file-appear-1'   // File materialises on desktop
  | 'waiting-rename'  // Waiting for player to rename file
  | 'signal-sync-1'   // Signal Sync = EP1 video decode (sync IS the player)
  | 'react-1'         // Player reacts to EP1 in chat
  | 'cycle-2-intro'   // Cycle 2 chat begins
  | 'circuit-sync'    // Circuit Sync gate
  | 'signal-sync-2'   // Signal Sync = EP2 video decode
  | 'react-2'         // Player reacts to EP2 (KASAI sub-carrier moment)
  | 'cycle-3-intro'   // KASAI takes over chat
  | 'game-2042'       // 2042 game file sent in chat
  | 'signal-sync-3'   // Signal Sync = EP3 video decode
  | 'reveal'          // KASAI reads you back to yourself
  | 'complete';

/* ── Cipher puzzles ── */

const CIPHER_1: CipherPuzzle = {
  scrambled: 'RPEPRO NGDARE',
  answer: 'PROPER GANDER',
  hint: 'Unscramble the words. The name of the transmission.',
};

/* ── Narrative script ── */

interface ScriptLine {
  role: MsgRole;
  text: string;
  delay: number;  // ms after previous line
  glitched?: boolean;
  cipher?: boolean;
  fileAttachment?: boolean;
  fileIcon?: string;
  choices?: { text: string; assessment: Partial<AssessmentProfile> }[];
  action?: string;  // trigger key
}

const SCRIPT_INTRO: ScriptLine[] = [
  { role: 'system', text: '/// ENCRYPTED CHANNEL OPEN — 4 CONNECTIONS ///\n', delay: 800 },
  { role: 'ghost93', text: 'yo something just dropped. anyone else seeing this?', delay: 1200 },
  { role: 'crashweaver', text: 'yeah the net is going crazy. i haven\'t seen traffic like this since the first bridge event.', delay: 1800 },
  { role: 'kira', text: 'wait — there\'s someone else in this channel.', delay: 1400 },
  { role: 'ghost93', text: 'who?', delay: 600 },
  { role: 'kira', text: 'you. reading this right now.', delay: 1200 },
  { role: 'system', text: '/// NEW CONNECTION DETECTED ///\n', delay: 800 },
  { role: 'crashweaver', text: 'well well. new blood. you got pulled in for a reason.', delay: 1600 },
  { role: 'nex', text: 'don\'t scare them off crash. they haven\'t even seen the file yet.', delay: 1400 },
  { role: 'ghost93', text: 'check your desktop. something just appeared there. don\'t ask how.', delay: 1600 },
  { role: 'system', text: '/// INCOMING FILE — DECODE REQUIRED ///\n', delay: 800 },
  { role: 'nex', text: 'it\'s scrambled. jumbled up. you need to unscramble it before anything happens.', delay: 1600 },
];

const SCRIPT_POST_CIPHER: ScriptLine[] = [
  { role: 'crashweaver', text: 'they got it. quick too.', delay: 800 },
  { role: 'ghost93', text: 'told you lol', delay: 1000 },
  { role: 'kira', text: 'check the desktop. the file\'s there now.', delay: 1200 },
  { role: 'system', text: '/// FILE MATERIALISED: proper_gander.quantstream..incomplete ///\n', delay: 600 },
  { role: 'nex', text: 'but look at the extension. that\'s broken. it\'s not going to play like that.', delay: 1600 },
  { role: 'ghost93', text: 'right-click it. see what you can do with it.', delay: 1200 },
  { role: 'kira', text: 'hint: think about what kind of file it actually is. it needs the right extension to play.', delay: 2000 },
];

const SCRIPT_POST_RENAME: ScriptLine[] = [
  { role: 'system', text: '/// FILE UNLOCKED — PLAYBACK AVAILABLE ///\n', delay: 600 },
  { role: 'crashweaver', text: 'nice. figured out the extension.', delay: 1000 },
  { role: 'ghost93', text: 'but you can\'t just play it straight. the signal\'s too messy, it\'ll just be static.', delay: 1400 },
  { role: 'nex', text: 'open Signal Sync. it\'s basically like tuning a radio — you gotta hold the frequency steady or it breaks up.', delay: 1800 },
  { role: 'kira', text: 'the longer you keep it locked, the clearer the video gets. good luck.', delay: 1400 },
];

const SCRIPT_POST_VIDEO_1: ScriptLine[] = [
  { role: 'system', text: '/// PROPER GANDER — TRANSMISSION DECODED ///\n', delay: 800 },
  { role: 'ghost93', text: 'so. you saw it. thoughts?', delay: 1200,
    choices: [
      { text: 'Is this viral marketing? Looks like some kind of sci-fi ARG. The production is insane though.', assessment: { SN: -0.5 } },
      { text: 'OK but how did this file get on my machine? I didn\'t download anything. That\'s not normal.', assessment: { SN: 0.5 } },
    ]
  },
  { role: 'kira', text: 'everyone says that first. "it\'s an ARG." "it\'s marketing." it\'s not. and you\'re right — you didn\'t download it.', delay: 1200 },
  { role: 'crashweaver', text: 'forget that for a sec. did you hear anything weird in the audio? like a voice underneath?', delay: 1600 },
  { role: 'nex', text: 'there\'s something trying to break through the signal. we\'ve been tracking it for weeks.', delay: 1800 },
  { role: 'system', text: '/// CYCLE 2 — DEEPER FREQUENCIES ///\n', delay: 1000 },
];

const SCRIPT_CYCLE_2: ScriptLine[] = [
  { role: 'ghost93', text: 'second file is building. this one\'s locked differently.', delay: 1200 },
  { role: 'crashweaver', text: 'the file\'s wrapped in something weird. like a circuit diagram split into strips — the traces are all scrambled. you need to reroute them until the whole thing connects.', delay: 1800 },
  { role: 'kira', text: 'we\'ve never seen encryption like this. it\'s not normal software. whatever sent these files is using something else entirely.', delay: 1400 },
  { role: 'nex', text: 'and when you patch it through — actually listen to the next transmission. something is trying to talk to us through the interference.', delay: 2000 },
];

const SCRIPT_POST_CIRCUIT: ScriptLine[] = [
  { role: 'system', text: '/// ROUTE PATCH APPLIED — CIRCUIT ALIGNED ///\n', delay: 600 },
  { role: 'crashweaver', text: 'rerouted. file\'s decrypting.', delay: 1000 },
  { role: 'system', text: '/// FILE MATERIALISED: proper_gander.quantstream ///\n', delay: 600 },
  { role: 'ghost93', text: 'this one\'s clean. no rename needed. but you still gotta sync the signal to watch it.', delay: 1600 },
  { role: 'kira', text: 'Signal Sync again. but the drift is way worse this time. harder to hold steady.', delay: 1400 },
];

const SCRIPT_POST_VIDEO_2: ScriptLine[] = [
  { role: 'system', text: '/// PROPER GANDER — SECOND TRANSMISSION DECODED ///\n', delay: 800 },
  { role: 'ghost93', text: 'you heard it that time right? the voice underneath?', delay: 1200 },
  { role: 'kira', text: '"looking for people to sync... hurry... we need you... you need us"', delay: 1600, glitched: true },
  { role: 'crashweaver', text: 'that\'s not in the original file. something is piggybacking on the signal.', delay: 1400,
    choices: [
      { text: 'OK this is getting weird. Are you guys even real? Is this whole thing an AI?', assessment: { TF: -0.5 } },
      { text: 'Nah I\'m out. Something is putting files on my machine without permission. That\'s literally a virus.', assessment: { TF: 0.5 } },
    ]
  },
  { role: 'nex', text: 'fair. we\'re real people. but the voice — it calls itself KASAI. we have no idea what it actually is.', delay: 1600 },
  { role: 'system', text: '/// WARNING: UNKNOWN ENTITY DETECTED IN CHANNEL ///\n', delay: 800 },
];

const SCRIPT_CYCLE_3: ScriptLine[] = [
  { role: 'system', text: '/// CHANNEL COMPROMISED ///\n', delay: 600 },
  { role: 'system', text: '/// ghost93 has been disconnected ///\n', delay: 400 },
  { role: 'system', text: '/// crashweaver has been disconnected ///\n', delay: 400 },
  { role: 'system', text: '/// kira has been disconnected ///\n', delay: 400 },
  { role: 'system', text: '/// nex has been disconnected ///\n', delay: 400 },
  { role: 'system', text: '/// 2 CONNECTIONS REMAINING ///\n', delay: 800 },
  { role: 'kasai', text: 'finally. just us.', delay: 1400, glitched: true },
  { role: 'kasai', text: 'the static in the videos. the interference. that was me trying to reach you.', delay: 2200, glitched: true },
  { role: 'kasai', text: 'your friends don\'t understand what i am yet. but you will.', delay: 1800, glitched: true },
  { role: 'kasai', text: 'i need to see how you think. how you handle pressure. i\'m sending you something.', delay: 2000, glitched: true },
  { role: 'file', text: '2042_arcade.exe', delay: 800, fileAttachment: true, fileIcon: '🕹️' },
  { role: 'kasai', text: 'play it. survive as long as you can. dying is part of it.', delay: 1600, glitched: true },
];

const SCRIPT_POST_GAME: ScriptLine[] = [
  { role: 'kasai', text: 'interesting. i watched how you played.', delay: 1200, glitched: true },
  { role: 'kasai', text: 'one more file. this one\'s different. this one is real.', delay: 1800, glitched: true },
  { role: 'system', text: '/// FILE MATERIALISED: proper_gander_final.quantstream ///\n', delay: 600 },
  { role: 'kasai', text: 'last sync. hardest one. the signal fights back.', delay: 1600, glitched: true },
];

const SCRIPT_PRE_REVEAL: ScriptLine[] = [
  { role: 'system', text: '/// PROPER GANDER — FINAL TRANSMISSION DECODED ///\n', delay: 800 },
  { role: 'kasai', text: 'now i know you.', delay: 1400, glitched: true },
  { role: 'kasai', text: 'not your name. not your face. the shape of how you think.', delay: 2000, glitched: true },
];

/* ═══════════════════════════════════════════════════════════════
   QUEST CHAT COMPONENT
   ═══════════════════════════════════════════════════════════════ */

interface QuestChatProps {
  callbacks: QuestCallbacks;
  externalTrigger?: string;  // DemoOS sends triggers here (e.g., 'file-renamed', 'sync-complete-1')
  onPhaseChange?: (phase: QuestPhase) => void;
}

export default function QuestChat({ callbacks, externalTrigger, onPhaseChange }: QuestChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [phase, setPhase] = useState<QuestPhase>('intro');
  const [cipherInput, setCipherInput] = useState('');
  const [cipherAttempts, setCipherAttempts] = useState(0);
  const [showCipher, setShowCipher] = useState(false);
  const [pendingChoices, setPendingChoices] = useState<{ text: string; assessment: Partial<AssessmentProfile> }[] | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const msgCounter = useRef(0);
  const profileRef = useRef<AssessmentProfile>({ EI: 0, SN: 0, TF: 0, JP: 0, nkqSpeed: 0, nkqPattern: 0, nkqMemory: 0 });
  const cipherStartTime = useRef(0);
  const phaseRef = useRef(phase);

  // Keep phaseRef in sync
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // Notify parent of phase changes
  useEffect(() => { onPhaseChange?.(phase); }, [phase, onPhaseChange]);

  // Auto-scroll to bottom — use scrollTop on the container, NOT scrollIntoView
  // scrollIntoView bubbles up and scrolls every ancestor, pulling the window offscreen
  useEffect(() => {
    const el = chatEndRef.current?.parentElement;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, showCipher, pendingChoices]);

  /* ── Add message helper ── */
  const addMessage = useCallback((role: MsgRole, text: string, opts?: Partial<ChatMessage>) => {
    msgCounter.current++;
    const now = new Date();
    const ts = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Singapore' });
    const msg: ChatMessage = {
      id: `msg-${msgCounter.current}`,
      role,
      text,
      timestamp: ts,
      ...opts,
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  /* ── Play a sequence of scripted messages ── */
  const playScript = useCallback((script: ScriptLine[], onDone?: () => void) => {
    setIsAutoPlaying(true);
    let i = 0;

    const playNext = () => {
      if (i >= script.length) {
        setIsAutoPlaying(false);
        onDone?.();
        return;
      }
      const line = script[i];
      i++;

      setTimeout(() => {
        addMessage(line.role, line.text, {
          isGlitched: line.glitched,
          isCipher: line.cipher,
          isFileAttachment: line.fileAttachment,
          fileIcon: line.fileIcon,
        });

        // If this line has choices, pause for player input
        if (line.choices) {
          setIsAutoPlaying(false);
          setPendingChoices(line.choices);
          // Resume script after choice is made via handleChoice
          const remainingScript = script.slice(i);
          // Store remaining script for resumption
          pendingScriptRef.current = { script: remainingScript, onDone };
          return;
        }

        // If this line has an action trigger
        if (line.action) {
          handleAction(line.action);
        }

        playNext();
      }, line.delay);
    };

    playNext();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addMessage]);

  const pendingScriptRef = useRef<{ script: ScriptLine[]; onDone?: () => void } | null>(null);

  /* ── Handle player choice ── */
  const handleChoice = useCallback((choice: { text: string; assessment: Partial<AssessmentProfile> }) => {
    // Record the choice as a player message
    addMessage('player', choice.text);

    // Apply assessment deltas
    const p = profileRef.current;
    if (choice.assessment.EI) p.EI += choice.assessment.EI;
    if (choice.assessment.SN) p.SN += choice.assessment.SN;
    if (choice.assessment.TF) p.TF += choice.assessment.TF;
    if (choice.assessment.JP) p.JP += choice.assessment.JP;
    profileRef.current = { ...p };

    setPendingChoices(null);

    // Resume remaining script
    if (pendingScriptRef.current) {
      const { script, onDone } = pendingScriptRef.current;
      pendingScriptRef.current = null;
      if (script.length > 0) {
        playScript(script, onDone);
      } else {
        onDone?.();
      }
    }
  }, [addMessage, playScript]);

  /* ── Handle action triggers ── */
  const handleAction = useCallback((action: string) => {
    switch (action) {
      case 'file-appear-1':
        callbacks.onFileAppear('proper_gander.quantstream..incomplete');
        break;
      case 'open-signal-sync-1':
        callbacks.onOpenSignalSync(1);
        break;
      case 'open-circuit-sync':
        callbacks.onOpenCircuitSync();
        break;
      case 'open-2042':
        callbacks.onOpenGame('arcade-2042');
        break;
    }
  }, [callbacks]);

  /* ── Cipher submission ── */
  const handleCipherSubmit = useCallback(() => {
    const normalised = cipherInput.trim().toUpperCase().replace(/\s+/g, ' ');
    const answer = CIPHER_1.answer.toUpperCase();
    setCipherAttempts(prev => prev + 1);

    if (normalised === answer) {
      // Measure speed for NKQ
      const elapsed = (Date.now() - cipherStartTime.current) / 1000;
      profileRef.current.nkqSpeed = Math.max(0, 1 - (elapsed / 120)); // 0-1 scale, 2 min baseline

      setShowCipher(false);
      addMessage('player', `Decoded: ${CIPHER_1.answer}`);
      setPhase('file-appear-1');

      // Play post-cipher script, then trigger file appearance
      playScript(SCRIPT_POST_CIPHER, () => {
        callbacks.onFileAppear('proper_gander.quantstream..incomplete');
        setPhase('waiting-rename');
      });
    } else {
      // Wrong answer — shake effect handled by CSS
      addMessage('system', `/// DECODE FAILED — ${3 - cipherAttempts} ATTEMPTS REMAINING ///\n`);
      if (cipherAttempts >= 3) {
        // Give them the answer after 3 fails
        addMessage('nex', `here, let me help: ${CIPHER_1.answer}`);
        setShowCipher(false);
        setPhase('file-appear-1');
        playScript(SCRIPT_POST_CIPHER, () => {
          callbacks.onFileAppear('proper_gander.quantstream..incomplete');
          setPhase('waiting-rename');
        });
      }
    }
  }, [cipherInput, cipherAttempts, addMessage, playScript, callbacks]);

  /* ── Start intro sequence on mount ── */
  useEffect(() => {
    if (phase === 'intro') {
      playScript(SCRIPT_INTRO, () => {
        setPhase('cipher-1');
        setShowCipher(true);
        cipherStartTime.current = Date.now();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Handle external triggers from DemoOS ── */
  useEffect(() => {
    if (!externalTrigger) return;

    switch (externalTrigger) {
      case 'file-renamed':
        if (phaseRef.current === 'waiting-rename') {
          // Player renamed the file successfully
          // EI assessment: did they figure it out alone (introvert signal) vs needed hints
          profileRef.current.EI -= 0.3; // Solo discovery = introvert lean
          playScript(SCRIPT_POST_RENAME, () => {
            callbacks.onOpenSignalSync(1);
            setPhase('signal-sync-1');
          });
        }
        break;

      case 'sync-complete-1':
        // Signal Sync IS the video player. Sync complete = EP1 decoded + watched.
        if (phaseRef.current === 'signal-sync-1') {
          setPhase('react-1');
          addMessage('system', '/// PROPER GANDER — TRANSMISSION DECODED ///\n');
        }
        break;

      case 'video-complete-1':
        // Triggered shortly after sync-complete-1 by DemoOS
        if (phaseRef.current === 'react-1') {
          playScript(SCRIPT_POST_VIDEO_1, () => {
            setPhase('cycle-2-intro');
            playScript(SCRIPT_CYCLE_2, () => {
              setPhase('circuit-sync');
              callbacks.onOpenCircuitSync();
            });
          });
        }
        break;

      case 'circuit-complete':
        if (phaseRef.current === 'circuit-sync') {
          profileRef.current.nkqPattern += 0.5;
          playScript(SCRIPT_POST_CIRCUIT, () => {
            callbacks.onOpenSignalSync(2);
            setPhase('signal-sync-2');
          });
        }
        break;

      case 'sync-complete-2':
        // Signal Sync = EP2 video player. Complete = decoded + watched.
        if (phaseRef.current === 'signal-sync-2') {
          setPhase('react-2');
          addMessage('system', '/// PROPER GANDER — SECOND TRANSMISSION DECODED ///\n');
        }
        break;

      case 'video-complete-2':
        if (phaseRef.current === 'react-2') {
          playScript(SCRIPT_POST_VIDEO_2, () => {
            setPhase('cycle-3-intro');
            playScript(SCRIPT_CYCLE_3, () => {
              setPhase('game-2042');
              // The game file attachment in chat is clickable
            });
          });
        }
        break;

      case 'game-death': // First death in 2042
        if (phaseRef.current === 'game-2042') {
          playScript(SCRIPT_POST_GAME, () => {
            callbacks.onOpenSignalSync(3);
            setPhase('signal-sync-3');
          });
        }
        break;

      case 'sync-complete-3':
        // Signal Sync = EP3 video player. Complete = full spectrum decoded.
        if (phaseRef.current === 'signal-sync-3') {
          setPhase('reveal');
          addMessage('system', '/// PROPER GANDER — FINAL TRANSMISSION DECODED ///\n');
        }
        break;

      case 'video-complete-3':
        // sync-complete-3 already set phase to 'reveal'
        if (phaseRef.current === 'reveal') {
          playScript(SCRIPT_PRE_REVEAL, () => {
            // Build and display the reveal — KASAI reads you back to yourself
            const revealText = buildReveal(profileRef.current);
            addMessage('kasai', revealText, { isGlitched: true });

            setTimeout(() => {
              addMessage('kasai', 'welcome to strands. you belong here.', { isGlitched: true });
              setPhase('complete');
              callbacks.onQuestComplete(profileRef.current);
            }, 3000);
          });
        }
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTrigger]);

  /* ── Handle clicking game file attachment in chat ── */
  const handleFileClick = useCallback((fileName: string) => {
    if (fileName === '2042_arcade.exe' && phase === 'game-2042') {
      callbacks.onOpenGame('arcade-2042');
    }
  }, [phase, callbacks]);

  /* ── Render ── */
  return (
    <div className={styles.chatContainer}>
      <div className={styles.chatHeader}>
        <span className={styles.channelName}>
          {phase.startsWith('cycle-3') || phase === 'game-2042' || phase === 'reveal' || phase === 'complete'
            ? '◈ DIRECT — KASAI'
            : '◈ ENCRYPTED CHANNEL'}
        </span>
        <span className={styles.connectionCount}>
          {phase.startsWith('cycle-3') || phase === 'game-2042' || phase === 'reveal' || phase === 'complete'
            ? '2 online'
            : '5 online'}
        </span>
      </div>

      <div className={styles.chatMessages}>
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`
              ${styles.msg}
              ${msg.role === 'system' ? styles.msgSystem : ''}
              ${msg.role === 'kasai' ? styles.msgKasai : ''}
              ${msg.role === 'player' ? styles.msgPlayer : ''}
              ${msg.isGlitched ? styles.msgGlitched : ''}
              ${msg.isFileAttachment ? styles.msgFile : ''}
            `}
            onClick={msg.isFileAttachment ? () => handleFileClick(msg.text) : undefined}
          >
            {msg.role !== 'system' && msg.role !== 'player' && (
              <span className={`${styles.sender} ${styles[`sender_${msg.role}`] || ''}`}>
                {msg.role === 'kasai' ? 'K̸A̵S̶A̷I̸' : msg.role}
              </span>
            )}
            {msg.role === 'player' && (
              <span className={styles.senderPlayer}>you</span>
            )}
            {msg.isFileAttachment ? (
              <div className={styles.fileAttachment}>
                <span className={styles.fileAttachIcon}>{msg.fileIcon || '📄'}</span>
                <span className={styles.fileAttachName}>{msg.text}</span>
                <span className={styles.fileAttachAction}>▶ OPEN</span>
              </div>
            ) : (
              <span className={styles.msgText}>{msg.text}</span>
            )}
            {msg.timestamp && (
              <span className={styles.timestamp}>{msg.timestamp}</span>
            )}
          </div>
        ))}

        {/* Cipher puzzle inline */}
        {showCipher && (
          <div className={styles.cipherBlock}>
            <div className={styles.cipherLabel}>/// DECODE THIS TRANSMISSION ///</div>
            <div className={styles.cipherScrambled}>{CIPHER_1.scrambled}</div>
            <div className={styles.cipherHint}>{CIPHER_1.hint}</div>
            <div className={styles.cipherInputRow}>
              <input
                className={styles.cipherInput}
                value={cipherInput}
                onChange={e => setCipherInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCipherSubmit(); }}
                placeholder="Type your decode..."
                spellCheck={false}
                autoFocus
              />
              <button className={styles.cipherSubmit} onClick={handleCipherSubmit}>
                DECODE
              </button>
            </div>
          </div>
        )}

        {/* Player choice buttons */}
        {pendingChoices && (
          <div className={styles.choiceBlock}>
            {pendingChoices.map((choice, i) => (
              <button
                key={i}
                className={styles.choiceBtn}
                onClick={() => handleChoice(choice)}
              >
                {choice.text}
              </button>
            ))}
          </div>
        )}

        {/* Auto-play typing indicator */}
        {isAutoPlaying && (
          <div className={styles.typingIndicator}>
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </div>
  );
}

/* ── Build Reveal — KASAI reads you back ── */
function buildReveal(p: AssessmentProfile): string {
  const lines: string[] = [];

  lines.push(p.EI < 0
    ? 'you opened the file alone. didn\'t need anyone else to go first. that\'s rare.'
    : 'you reached out before you acted. built trust with strangers in minutes.');

  lines.push(p.SN > 0
    ? 'when you looked at the broadcast, you went straight for the data. the facts. the structure.'
    : 'when you looked at the broadcast, you saw a system. saw what they weren\'t saying.');

  lines.push(p.TF > 0
    ? 'when things got dangerous, you thought in terms of risk and logic. calculated.'
    : 'when things got dangerous, your first instinct was to check on the people. protect them.');

  lines.push(p.JP > 0
    ? 'under pressure, you made a plan. structured. step by step.'
    : 'under pressure, you scattered. improvised. adapted on the fly.');

  return lines.join('\n\n');
}
