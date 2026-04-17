// src/modules/bgm-player/index.ts

import { createBgmController, canPlayOgg } from './bgm-controller';
import { createFavoritesStore } from './bgm-favorites';
import { mountBgmPanel } from './bgm-dom';
import type { DiscBgmMap, MelodyMode } from './bgm-types';

export type { DiscBgmMap, DiscBgmEntry, BgmMode, BgmState, MelodyMode } from './bgm-types';

export interface BgmPlayerHandle {
  hasBgm(discId: string): boolean;
  hasMain(discId: string): boolean;
  hasVictory(discId: string): boolean;
  isFavorite(discId: string): boolean;
  toggleFavorite(discId: string): boolean;
  playDisc(discId: string, melodyMode?: MelodyMode): Promise<void>;
  destroy(): void;
}

export interface InitBgmPlayerOptions {
  panelEl: HTMLElement;
  bgmMap: DiscBgmMap;
  getDiscName: (discId: string) => string;
  getDiscIconPath: (discId: string) => string | null;
  t: (key: string) => string;
}

const MODE_KEY = 'sstoy:bgm:mode';
const VOLUME_KEY = 'sstoy:bgm:volume';

export function initBgmPlayer(opts: InitBgmPlayerOptions): BgmPlayerHandle | null {
  if (!canPlayOgg()) {
    opts.panelEl.classList.add('bgm-panel', 'bgm-unsupported');
    opts.panelEl.innerHTML = `<div class="bgm-unsupported-msg">${opts.t('discdb.bgm.browserUnsupported')}</div>`;
    return null;
  }

  const favorites = createFavoritesStore();
  const controller = createBgmController({
    bgmMap: opts.bgmMap,
    getFavorites: () => favorites.list(),
  });

  // Restore persisted mode
  try {
    const savedMode = localStorage.getItem(MODE_KEY);
    if (savedMode === 'loop' || savedMode === 'queue') controller.setMode(savedMode);
  } catch { /* ignore */ }

  // Persist mode on change by wrapping setMode
  const originalSetMode = controller.setMode.bind(controller);
  controller.setMode = (m) => {
    originalSetMode(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* ignore */ }
  };

  // Restore + persist volume
  const getInitialVolume = (): number => {
    try {
      const raw = localStorage.getItem(VOLUME_KEY);
      if (raw != null) {
        const v = parseFloat(raw);
        if (isFinite(v) && v >= 0 && v <= 1) return v;
      }
    } catch { /* ignore */ }
    return 0.3;
  };
  const persistVolume = (v: number) => {
    try { localStorage.setItem(VOLUME_KEY, String(v)); } catch { /* ignore */ }
  };

  const unmount = mountBgmPanel({
    panelEl: opts.panelEl,
    controller,
    favorites,
    getDiscName: opts.getDiscName,
    getDiscIconPath: opts.getDiscIconPath,
    t: opts.t,
    initialVolume: getInitialVolume(),
    onVolumeChange: persistVolume,
  });

  return {
    hasBgm(discId) { return controller.hasBgm(discId); },
    hasMain(discId) { return controller.hasMain(discId); },
    hasVictory(discId) { return controller.hasVictory(discId); },
    isFavorite(discId) { return favorites.has(discId); },
    toggleFavorite(discId) { return favorites.toggle(discId); },
    playDisc(discId, melodyMode) { return controller.playDisc(discId, melodyMode); },
    destroy() {
      unmount();
      controller.destroy();
    },
  };
}
