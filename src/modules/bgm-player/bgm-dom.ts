// src/modules/bgm-player/bgm-dom.ts

import type { BgmController } from './bgm-controller';
import type { FavoritesStore } from './bgm-favorites';
import type { BgmEvent } from './bgm-types';

export interface BgmDomDeps {
  panelEl: HTMLElement;
  controller: BgmController;
  favorites: FavoritesStore;
  getDiscName: (discId: string) => string;
  getDiscIconPath: (discId: string) => string | null;
  t: (key: string) => string;
  initialVolume: number;
  onVolumeChange: (v: number) => void;
}

const ICON_PLAY = '<i class="fa-solid fa-play"></i>';
const ICON_PAUSE = '<i class="fa-solid fa-pause"></i>';
const ICON_ARROW_RIGHT = '<i class="fa-solid fa-arrow-right"></i>';
const ICON_XMARK = '<i class="fa-solid fa-xmark"></i>';
const ICON_MUSIC = '<i class="fa-solid fa-music"></i>';
const ICON_VOL_HIGH = '<i class="fa-solid fa-volume-high"></i>';
const ICON_VOL_OFF = '<i class="fa-solid fa-volume-xmark"></i>';

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

export function mountBgmPanel(deps: BgmDomDeps): () => void {
  const { panelEl, controller, favorites, getDiscName, getDiscIconPath, t, initialVolume, onVolumeChange } = deps;

  panelEl.classList.add('bgm-panel');
  panelEl.innerHTML = `
    <div class="bgm-header">
      <div class="bgm-label">${ICON_MUSIC} ${escapeHtml(t('discdb.bgm.panelTitle'))}</div>
      <div class="bgm-mode-toggle" role="group">
        <button type="button" class="bgm-mode-btn" data-mode="loop">${escapeHtml(t('discdb.bgm.modeLoop'))}</button>
        <button type="button" class="bgm-mode-btn" data-mode="queue">${escapeHtml(t('discdb.bgm.modeQueue'))}</button>
      </div>
    </div>

    <div class="bgm-now-playing">
      <div class="bgm-np-icon"><img alt="" /></div>
      <div class="bgm-np-body">
        <div class="bgm-np-track"></div>
        <div class="bgm-np-sub"></div>
      </div>
      <button type="button" class="bgm-np-play" aria-label="${escapeHtml(t('discdb.bgm.rowPlayTooltip'))}">${ICON_PLAY}</button>
    </div>

    <canvas class="bgm-visualizer" aria-hidden="true"></canvas>

    <div class="bgm-progress"><div class="bgm-progress-fill"></div></div>
    <div class="bgm-time-row"><span class="bgm-time-elapsed">0:00</span><span class="bgm-time-total">0:00</span></div>

    <div class="bgm-controls-row">
      <div class="bgm-melody-toggle" role="group" hidden>
        <button type="button" class="bgm-melody-btn active" data-melody="main">${escapeHtml(t('discdb.bgm.melodyMain'))}</button>
        <button type="button" class="bgm-melody-btn" data-melody="victory">${escapeHtml(t('discdb.bgm.melodyVictory'))}</button>
      </div>
      <div class="bgm-volume">
        <button type="button" class="bgm-vol-btn" aria-label="${escapeHtml(t('discdb.bgm.muteTooltip'))}">${ICON_VOL_HIGH}</button>
        <input type="range" class="bgm-vol-slider" min="0" max="100" step="1" aria-label="${escapeHtml(t('discdb.bgm.volumeTooltip'))}" />
      </div>
    </div>

    <div class="bgm-divider"></div>
    <div class="bgm-fav-header">
      <span>${escapeHtml(t('discdb.bgm.favoritesHeader'))}</span>
      <span class="bgm-fav-count">0</span>
    </div>
    <div class="bgm-fav-list" role="list"></div>
  `;

  const npTrackEl = panelEl.querySelector<HTMLElement>('.bgm-np-track')!;
  const npSubEl = panelEl.querySelector<HTMLElement>('.bgm-np-sub')!;
  const npIconImg = panelEl.querySelector<HTMLImageElement>('.bgm-np-icon img')!;
  const npPlayBtn = panelEl.querySelector<HTMLButtonElement>('.bgm-np-play')!;
  const progressFill = panelEl.querySelector<HTMLElement>('.bgm-progress-fill')!;
  const timeElapsedEl = panelEl.querySelector<HTMLElement>('.bgm-time-elapsed')!;
  const timeTotalEl = panelEl.querySelector<HTMLElement>('.bgm-time-total')!;
  const favListEl = panelEl.querySelector<HTMLElement>('.bgm-fav-list')!;
  const favCountEl = panelEl.querySelector<HTMLElement>('.bgm-fav-count')!;
  const modeBtns = panelEl.querySelectorAll<HTMLButtonElement>('.bgm-mode-btn');
  const melodyToggleEl = panelEl.querySelector<HTMLElement>('.bgm-melody-toggle')!;
  const melodyBtns = panelEl.querySelectorAll<HTMLButtonElement>('.bgm-melody-btn');
  const volBtn = panelEl.querySelector<HTMLButtonElement>('.bgm-vol-btn')!;
  const volSlider = panelEl.querySelector<HTMLInputElement>('.bgm-vol-slider')!;
  const canvas = panelEl.querySelector<HTMLCanvasElement>('.bgm-visualizer')!;

  controller.setVolume(initialVolume);
  volSlider.value = String(Math.round(initialVolume * 100));
  let lastNonZeroVolume = initialVolume > 0 ? initialVolume : 0.3;

  const renderVolume = () => {
    const v = controller.getVolume();
    volSlider.value = String(Math.round(v * 100));
    volBtn.innerHTML = v === 0 ? ICON_VOL_OFF : ICON_VOL_HIGH;
    volBtn.classList.toggle('muted', v === 0);
  };

  volSlider.addEventListener('input', () => {
    const v = parseInt(volSlider.value, 10) / 100;
    controller.setVolume(v);
    if (v > 0) lastNonZeroVolume = v;
    onVolumeChange(v);
    renderVolume();
  });
  volBtn.addEventListener('click', () => {
    const cur = controller.getVolume();
    if (cur === 0) {
      controller.setVolume(lastNonZeroVolume);
      onVolumeChange(lastNonZeroVolume);
    } else {
      lastNonZeroVolume = cur;
      controller.setVolume(0);
      onVolumeChange(0);
    }
    renderVolume();
  });

  const renderProgress = (currentTime?: number, totalDuration?: number) => {
    const s = controller.getState();
    const curT = currentTime ?? s.currentTime;
    const dur = totalDuration ?? s.totalDuration;
    if (!s.currentDiscId) {
      progressFill.style.width = '0%';
      timeElapsedEl.textContent = '0:00';
      timeTotalEl.textContent = '0:00';
      return;
    }
    const pct = dur > 0 ? (curT / dur) * 100 : 0;
    progressFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    timeElapsedEl.textContent = formatTime(curT);
    timeTotalEl.textContent = formatTime(dur);
  };

  const renderNowPlaying = () => {
    const s = controller.getState();
    if (!s.currentDiscId) {
      npTrackEl.textContent = t('discdb.bgm.nowPlayingNone');
      npSubEl.textContent = '';
      npIconImg.src = '';
      npIconImg.style.visibility = 'hidden';
      npPlayBtn.innerHTML = ICON_PLAY;
      panelEl.classList.remove('is-playing');
      melodyToggleEl.hidden = true;
      renderProgress();
      return;
    }
    npTrackEl.textContent = getDiscName(s.currentDiscId);
    const melodyLabel = t(s.melodyMode === 'victory' ? 'discdb.bgm.melodyVictory' : 'discdb.bgm.melodyMain');
    npSubEl.textContent = `#${s.currentDiscId} · ${melodyLabel}`;
    const icon = getDiscIconPath(s.currentDiscId);
    if (icon) {
      npIconImg.src = icon;
      npIconImg.style.visibility = 'visible';
    } else {
      npIconImg.style.visibility = 'hidden';
    }
    npPlayBtn.innerHTML = s.isPlaying ? ICON_PAUSE : ICON_PLAY;
    panelEl.classList.toggle('is-playing', s.isPlaying);

    // Show the toggle when at least one melody mode could be chosen alongside another.
    melodyToggleEl.hidden = !(s.hasMain && s.hasVictory);
    melodyBtns.forEach((b) => {
      const m = b.dataset.melody;
      const available = m === 'main' ? s.hasMain : s.hasVictory;
      b.hidden = !available;
      b.classList.toggle('active', m === s.melodyMode);
    });

    renderProgress();
  };

  const renderModeToggle = () => {
    const s = controller.getState();
    modeBtns.forEach((b) => b.classList.toggle('active', b.dataset.mode === s.mode));
  };

  const renderFavorites = () => {
    const list = favorites.list();
    const s = controller.getState();
    favCountEl.textContent = String(list.length);

    if (list.length === 0) {
      favListEl.innerHTML = `<div class="bgm-fav-empty">${escapeHtml(t('discdb.bgm.favoritesEmpty'))}</div>`;
      return;
    }

    favListEl.innerHTML = list.map((id) => {
      const isPlaying = s.currentDiscId === id && s.isPlaying;
      const playIcon = isPlaying ? ICON_PAUSE : ICON_PLAY;
      const name = escapeHtml(getDiscName(id));
      const icon = getDiscIconPath(id);
      const iconHtml = icon ? `<img src="${escapeHtml(icon)}" alt="" />` : '';
      return `
        <div class="bgm-fav-item${isPlaying ? ' playing' : ''}" data-id="${escapeHtml(id)}" role="listitem">
          <div class="bgm-fav-icon">${iconHtml}</div>
          <div class="bgm-fav-title" title="${name}">${name}</div>
          <span class="bgm-fav-id">${escapeHtml(id)}</span>
          <button type="button" class="bgm-row-btn bgm-row-play" data-action="play" title="${escapeHtml(t(isPlaying ? 'discdb.bgm.rowPauseTooltip' : 'discdb.bgm.rowPlayTooltip'))}">${playIcon}</button>
          <button type="button" class="bgm-row-btn bgm-row-nav"  data-action="nav"  title="${escapeHtml(t('discdb.bgm.rowNavTooltip'))}">${ICON_ARROW_RIGHT}</button>
          <button type="button" class="bgm-row-btn bgm-row-remove" data-action="remove" title="${escapeHtml(t('discdb.bgm.rowRemoveTooltip'))}">${ICON_XMARK}</button>
        </div>`;
    }).join('');
  };

  const renderAll = () => {
    renderNowPlaying();
    renderModeToggle();
    renderFavorites();
  };

  modeBtns.forEach((b) => {
    b.addEventListener('click', () => {
      controller.setMode(b.dataset.mode === 'queue' ? 'queue' : 'loop');
      renderModeToggle();
    });
  });

  melodyBtns.forEach((b) => {
    b.addEventListener('click', () => {
      const m = b.dataset.melody === 'victory' ? 'victory' : 'main';
      void controller.setMelodyMode(m);
    });
  });

  npPlayBtn.addEventListener('click', () => {
    void controller.toggle();
  });

  favListEl.addEventListener('click', (ev) => {
    const target = ev.target as HTMLElement;
    const row = target.closest<HTMLElement>('.bgm-fav-item');
    if (!row) return;
    const id = row.dataset.id;
    if (!id) return;
    const btn = target.closest<HTMLElement>('[data-action]');
    const action = btn?.dataset.action;

    if (action === 'play') {
      const s = controller.getState();
      if (s.currentDiscId === id) {
        void controller.toggle();
      } else {
        void controller.playDisc(id);
      }
    } else if (action === 'nav') {
      row.dispatchEvent(new CustomEvent('bgm:navigate', { bubbles: true, detail: { discId: id } }));
    } else if (action === 'remove') {
      favorites.remove(id);
    }
  });

  // Cosmetic canvas visualizer (sine-wave, not Web Audio analysis)
  let animId: number | null = null;
  let ctx: CanvasRenderingContext2D | null = canvas.getContext('2d');

  const resizeCanvas = () => {
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  };

  const drawFrame = () => {
    if (!ctx) return;
    const s = controller.getState();
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const styles = getComputedStyle(panelEl);
    const primary = styles.getPropertyValue('--primary-color').trim() || '#6b8caf';
    const accent = '#b8d4ff';

    const barCount = Math.max(24, Math.floor(w / 8));
    const barGap = 2;
    const barWidth = (w - barGap * (barCount - 1)) / barCount;
    const time = performance.now() / 1000;
    const amplitudeScale = s.isPlaying ? 1 : 0.15;

    for (let i = 0; i < barCount; i++) {
      const wave1 = Math.sin(time * 2 + i * 0.15) * 0.3;
      const wave2 = Math.sin(time * 3 - i * 0.1) * 0.2;
      const wave3 = Math.sin(time * 1.5 + i * 0.2) * 0.25;
      const amp = ((wave1 + wave2 + wave3 + 1) / 2) * amplitudeScale;
      const barHeight = Math.max(2, amp * h * 0.85);
      const x = i * (barWidth + barGap);
      const y = h - barHeight;

      const grad = ctx.createLinearGradient(x, y, x, h);
      grad.addColorStop(0, accent);
      grad.addColorStop(1, primary);
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barWidth, barHeight);
    }
    animId = requestAnimationFrame(drawFrame);
  };

  const startVisualizer = () => {
    if (animId != null) return;
    resizeCanvas();
    animId = requestAnimationFrame(drawFrame);
  };
  const stopVisualizer = () => {
    if (animId != null) cancelAnimationFrame(animId);
    animId = null;
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const onResize = () => resizeCanvas();
  window.addEventListener('resize', onResize);
  const onVisibility = () => {
    if (document.hidden) stopVisualizer();
    else startVisualizer();
  };
  document.addEventListener('visibilitychange', onVisibility);

  startVisualizer();

  const unsubController = controller.subscribe((ev: BgmEvent) => {
    if (ev.type === 'progress') {
      renderProgress(ev.currentTime, ev.totalDuration);
    } else if (ev.type === 'loaded' || ev.type === 'play' || ev.type === 'pause' || ev.type === 'stopped' || ev.type === 'naturalEnd') {
      renderNowPlaying();
      renderFavorites();
    }
  });
  const unsubFavorites = favorites.subscribe(() => {
    renderFavorites();
    renderNowPlaying();
  });

  renderAll();
  renderVolume();

  return () => {
    unsubController();
    unsubFavorites();
    stopVisualizer();
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    ctx = null;
    panelEl.innerHTML = '';
  };
}
