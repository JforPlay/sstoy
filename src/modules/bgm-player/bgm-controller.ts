// src/modules/bgm-player/bgm-controller.ts

import type {
  DiscBgmMap,
  BgmMode,
  BgmState,
  BgmEvent,
  BgmEventListener,
  BgmVariant,
  MelodyMode,
} from './bgm-types';
import { nextInQueue } from './bgm-queue';

const LEAD_TIME_SEC = 0.05; // proactive advance lookahead — avoids the browser's `ended` race

function soundtrackUrl(wemId: number): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '/');
  return `${base}soundtracks/${wemId}.ogg`.replace(/([^:]\/)\/+/g, '$1');
}

export interface BgmControllerDeps {
  bgmMap: DiscBgmMap;
  getFavorites: () => string[];
}

export interface BgmController {
  getState(): BgmState;
  setMode(mode: BgmMode): void;
  playDisc(discId: string, melodyMode?: MelodyMode): Promise<void>;
  setMelodyMode(melodyMode: MelodyMode): Promise<void>;
  toggle(): Promise<void>;
  stop(): void;
  subscribe(listener: BgmEventListener): () => void;
  hasBgm(discId: string): boolean;
  hasMain(discId: string): boolean;
  hasVictory(discId: string): boolean;
  setVolume(v: number): void;
  getVolume(): number;
  destroy(): void;
}

interface LoadedTrack {
  discId: string;
  melodyMode: MelodyMode;
  variant: BgmVariant;
  /** Index into variant.segments of the segment currently playing. */
  segIndex: number;
  /** cumulative total duration of the variant (sum of all segment lengths). */
  totalDur: number;
  /** sum of segment lengths before segments[segIndex]; used for progress bar continuity. */
  cumulativeBefore: number;
  naturalEndReady: boolean;
  /** Wall-clock elapsed time banked from previous pause cycles. */
  accumulatedTime: number;
  /** performance.now() of the most recent playback start, or null if paused. */
  playStartedAt: number | null;
}

function variantTotalDuration(v: BgmVariant): number {
  return v.segments.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

function segOffset(v: BgmVariant, idx: number): number {
  let sum = 0;
  for (let i = 0; i < idx; i++) {
    const s = v.segments[i]!;
    sum += Math.max(0, s.end - s.start);
  }
  return sum;
}

export function createBgmController(deps: BgmControllerDeps): BgmController {
  const audio: HTMLAudioElement = new Audio();
  audio.preload = 'auto';
  audio.loop = false;

  let loaded: LoadedTrack | null = null;
  let mode: BgmMode = 'loop';
  const listeners = new Set<BgmEventListener>();
  let rafId: number | null = null;
  let seeking = false; // suppress duplicate advance during an in-flight seek

  const emit = (e: BgmEvent) => listeners.forEach((l) => l(e));

  const hasMain = (discId: string): boolean => {
    const entry = deps.bgmMap[discId];
    return !!entry?.Main && entry.Main.segments.length > 0;
  };
  const hasVictory = (discId: string): boolean => {
    const entry = deps.bgmMap[discId];
    return !!entry?.Victory && entry.Victory.segments.length > 0;
  };
  const hasBgm = (discId: string): boolean => hasMain(discId) || hasVictory(discId);

  const pickVariant = (discId: string, melodyMode: MelodyMode): { variant: BgmVariant; resolvedMode: MelodyMode } | null => {
    const entry = deps.bgmMap[discId];
    if (!entry) return null;
    if (melodyMode === 'main' && entry.Main) return { variant: entry.Main, resolvedMode: 'main' };
    if (melodyMode === 'victory' && entry.Victory) return { variant: entry.Victory, resolvedMode: 'victory' };
    if (entry.Main) return { variant: entry.Main, resolvedMode: 'main' };
    if (entry.Victory) return { variant: entry.Victory, resolvedMode: 'victory' };
    return null;
  };

  const currentElapsed = (): number => {
    if (!loaded) return 0;
    let elapsed = loaded.accumulatedTime;
    if (loaded.playStartedAt != null) {
      elapsed += (performance.now() - loaded.playStartedAt) / 1000;
    }
    return elapsed;
  };

  const currentSegment = () => loaded?.variant.segments[loaded.segIndex] ?? null;

  const getState = (): BgmState => ({
    currentDiscId: loaded?.discId ?? null,
    isPlaying: !audio.paused && loaded != null,
    mode,
    melodyMode: loaded?.melodyMode ?? 'main',
    hasMain: loaded ? hasMain(loaded.discId) : false,
    hasVictory: loaded ? hasVictory(loaded.discId) : false,
    currentTime: loaded ? Math.min(currentElapsed(), loaded.totalDur || Infinity) : 0,
    totalDuration: loaded?.totalDur ?? 0,
  });

  /** Start a specific segment: load the right wem (if changed), seek to start, play. */
  const playSegment = async (idx: number) => {
    if (!loaded) return;
    const seg = loaded.variant.segments[idx];
    if (!seg) return;
    loaded.segIndex = idx;
    loaded.cumulativeBefore = segOffset(loaded.variant, idx);

    const neededUrl = soundtrackUrl(seg.wem);
    const currentUrl = audio.src;
    const sameSource = currentUrl.endsWith(`/${seg.wem}.ogg`);
    seeking = true;
    try {
      if (!sameSource) {
        audio.src = neededUrl;
      }
      audio.currentTime = seg.start;
      await audio.play();
    } catch (err) {
      emit({ type: 'error', message: String(err) });
    } finally {
      seeking = false;
    }
  };

  const advance = () => {
    if (!loaded) return;
    const nextIdx = loaded.segIndex + 1;
    if (nextIdx < loaded.variant.segments.length) {
      void playSegment(nextIdx);
      return;
    }
    // End of sequence — loop back to loopFrom.
    void playSegment(loaded.variant.loopFrom);
  };

  const pumpProgress = () => {
    if (!loaded) {
      rafId = null;
      return;
    }
    const elapsed = currentElapsed();
    emit({ type: 'progress', currentTime: Math.min(elapsed, loaded.totalDur || Infinity), totalDuration: loaded.totalDur });

    if (!seeking) {
      const seg = currentSegment();
      if (seg) {
        // Proactive segment-end detection — don't wait for `ended` because the ogg's granule
        // metadata is often missing and `audio.duration` isn't reliable.
        if (audio.currentTime >= seg.end - LEAD_TIME_SEC) {
          advance();
        }
      }
    }

    if (mode === 'queue' && !loaded.naturalEndReady && loaded.totalDur > 0 && elapsed >= loaded.totalDur) {
      loaded.naturalEndReady = true;
      emit({ type: 'naturalEnd', discId: loaded.discId });
      tryAdvance();
    }

    rafId = requestAnimationFrame(pumpProgress);
  };

  const startPumping = () => {
    if (rafId == null) rafId = requestAnimationFrame(pumpProgress);
  };
  const stopPumping = () => {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  };

  const handleAudioEnd = () => {
    // Fallback — RAF normally advances before this fires.
    if (!loaded || seeking) return;
    advance();
  };

  const handleError = (e: Event) => {
    const target = e.target as HTMLAudioElement;
    emit({ type: 'error', message: `Audio error on ${target.currentSrc}` });
  };

  audio.addEventListener('ended', handleAudioEnd);
  audio.addEventListener('error', handleError);

  const tryAdvance = () => {
    const favs = deps.getFavorites();
    const next = nextInQueue(favs, loaded?.discId ?? null);
    if (next) {
      void playDisc(next);
    } else if (loaded) {
      loaded.accumulatedTime = 0;
      loaded.playStartedAt = performance.now();
      loaded.naturalEndReady = false;
    }
  };

  const stop = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    loaded = null;
    stopPumping();
    emit({ type: 'stopped' });
  };

  const playDisc = async (discId: string, melodyMode: MelodyMode = 'main'): Promise<void> => {
    const pick = pickVariant(discId, melodyMode);
    if (!pick) {
      emit({ type: 'error', message: `No BGM for disc ${discId}` });
      return;
    }
    const { variant, resolvedMode } = pick;
    audio.pause();

    loaded = {
      discId,
      melodyMode: resolvedMode,
      variant,
      segIndex: 0,
      totalDur: variantTotalDuration(variant),
      cumulativeBefore: 0,
      naturalEndReady: false,
      accumulatedTime: 0,
      playStartedAt: null,
    };

    emit({ type: 'loaded', discId });

    // Load and start the first segment.
    const first = variant.segments[0]!;
    audio.src = soundtrackUrl(first.wem);
    audio.currentTime = first.start;
    try {
      await audio.play();
      loaded.playStartedAt = performance.now();
      emit({ type: 'play' });
      startPumping();
    } catch (err) {
      emit({ type: 'error', message: String(err) });
    }
  };

  const setMelodyMode = async (melodyMode: MelodyMode): Promise<void> => {
    if (!loaded) return;
    if (loaded.melodyMode === melodyMode) return;
    if (melodyMode === 'main' && !hasMain(loaded.discId)) return;
    if (melodyMode === 'victory' && !hasVictory(loaded.discId)) return;
    await playDisc(loaded.discId, melodyMode);
  };

  const toggle = async (): Promise<void> => {
    if (!loaded) return;
    if (audio.paused) {
      try {
        await audio.play();
        loaded.playStartedAt = performance.now();
        emit({ type: 'play' });
        startPumping();
      } catch (err) {
        emit({ type: 'error', message: String(err) });
      }
    } else {
      if (loaded.playStartedAt != null) {
        loaded.accumulatedTime += (performance.now() - loaded.playStartedAt) / 1000;
        loaded.playStartedAt = null;
      }
      audio.pause();
      stopPumping();
      emit({ type: 'pause' });
    }
  };

  const setMode = (m: BgmMode) => {
    mode = m;
    if (loaded) loaded.naturalEndReady = false;
  };

  const setVolume = (v: number) => {
    audio.volume = Math.max(0, Math.min(1, v));
  };
  const getVolume = (): number => audio.volume;

  const destroy = () => {
    stop();
    audio.removeEventListener('ended', handleAudioEnd);
    audio.removeEventListener('error', handleError);
    listeners.clear();
  };

  return {
    getState,
    setMode,
    playDisc,
    setMelodyMode,
    toggle,
    stop,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    hasBgm,
    hasMain,
    hasVictory,
    setVolume,
    getVolume,
    destroy,
  };
}

export function canPlayOgg(): boolean {
  const a = document.createElement('audio');
  return !!a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"') !== '';
}
