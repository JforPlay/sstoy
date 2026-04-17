// src/modules/bgm-player/bgm-types.ts

/**
 * A single playable slice of a wem file: play from `start` to `end` (seconds).
 * `start` and `end` are absolute offsets within the underlying wem file; a segment
 * may reuse the same wem as a previous segment with a different range.
 */
export interface BgmSegment {
  wem: number;
  start: number;
  end: number;
}

/**
 * A playable melody variant. Play segments in order. When the last segment ends,
 * jump back to segment `loopFrom` and continue from there indefinitely.
 *   segments[0..loopFrom-1]   — played once (intro)
 *   segments[loopFrom..end]   — looped
 */
export interface BgmVariant {
  segments: BgmSegment[];
  loopFrom: number;
}

/**
 * Shape of a single entry in public/data/disc_bgm_map.json.
 *
 * Each disc can have up to two melodies (either or both may be null):
 *   Main    = 메인 멜로디 (peaceful/exploration)
 *   Victory = 승리 멜로디 (post-battle fanfare)
 * 67 discs have Main, 92 have Victory, 7 are unmapped.
 */
export interface DiscBgmEntry {
  VoFile: string;
  StateId: number;
  StateIdInHeader: boolean;
  Main: BgmVariant | null;
  Victory: BgmVariant | null;
  VoName1?: string;
  VoName2?: string;
  CharId?: number[];
}

export type DiscBgmMap = Record<string, DiscBgmEntry>;

export type BgmMode = 'loop' | 'queue';

export type MelodyMode = 'main' | 'victory';

export interface BgmState {
  currentDiscId: string | null;
  isPlaying: boolean;
  mode: BgmMode;
  melodyMode: MelodyMode;
  hasMain: boolean;
  hasVictory: boolean;
  /** Cumulative playback time in seconds (across the full sequence + loop iterations). */
  currentTime: number;
  /** Total sequence duration in seconds (sum of all segment lengths). */
  totalDuration: number;
}

export type BgmEvent =
  | { type: 'loaded'; discId: string }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'stopped' }
  | { type: 'progress'; currentTime: number; totalDuration: number }
  | { type: 'naturalEnd'; discId: string }
  | { type: 'error'; message: string };

export type BgmEventListener = (e: BgmEvent) => void;
