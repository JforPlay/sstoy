/**
 * Build Panel — Left Sidebar
 *
 * Renders three stacked panels:
 * 1. Master Character Card (portrait, name, level, LB stepper, key stats)
 * 2. Disc Summary (equipped discs from window.discsState)
 * 3. Enemy Config (DEF, RES, toughness toggle)
 *
 * @module dmgcalc/ui/build-panel
 */

import { createResponsiveImage } from '@/shared/dom';
import { getCharacterName } from '@/shared/game-data';
import { formatStatValue, getStatDisplayName } from '../core/enums';
import { getState } from '../core/state';
import type { DmgCalcState, DiscSlotId } from '../types';

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Render the full build panel (character card + disc summary + enemy config).
 */
export function renderBuildPanel(state: DmgCalcState): string {
  return `
    ${renderCharacterCard(state)}
    ${renderDiscSummary()}
    ${renderEnemyConfig(state)}
  `;
}

// =============================================================================
// PANEL 1: MASTER CHARACTER CARD
// =============================================================================

function renderCharacterCard(state: DmgCalcState): string {
  const charId = state.masterCharId;
  if (!charId) return '';

  const charIdStr = String(charId);
  const charName = getCharacterName(charIdStr);
  const imagePath = `assets/char/avg1_${charIdStr}_002.png`;

  // Pull key stats from the aggregated stats map
  const atkStat = state.stats.get('Atk');
  const critRateStat = state.stats.get('CritRate');
  const critPowerStat = state.stats.get('CritPower');

  const atkDisplay = atkStat ? formatStatValue('Atk', atkStat.total) : '—';
  const critRateDisplay = critRateStat ? formatStatValue('CritRate', critRateStat.total) : '—';
  const critPowerDisplay = critPowerStat ? formatStatValue('CritPower', critPowerStat.total) : '—';

  return `
    <div class="dmgcalc-panel">
      <div class="dmgcalc-panel-title">Character</div>
      <div class="char-card">
        <div class="char-card-portrait">
          ${createResponsiveImage(imagePath, charName, 'char-card-image')}
        </div>
        <div class="char-card-info">
          <div class="char-card-name">${charName}</div>
          <div class="char-card-level">Lv.${state.masterLevel}</div>
          <div class="lb-stepper">
            <button data-action="lb-decrement" ${state.limitBreak <= 0 ? 'disabled' : ''}>&#8722;</button>
            <span class="lb-stepper-value">LB ${state.limitBreak}</span>
            <button data-action="lb-increment" ${state.limitBreak >= 5 ? 'disabled' : ''}>+</button>
          </div>
        </div>
      </div>
      <div class="char-card-stats">
        <div class="char-stat">
          <span class="char-stat-label">${getStatDisplayName('Atk')}</span>
          <span class="char-stat-value">${atkDisplay}</span>
        </div>
        <div class="char-stat">
          <span class="char-stat-label">${getStatDisplayName('CritRate')}</span>
          <span class="char-stat-value">${critRateDisplay}</span>
        </div>
        <div class="char-stat">
          <span class="char-stat-label">${getStatDisplayName('CritPower')}</span>
          <span class="char-stat-value">${critPowerDisplay}</span>
        </div>
      </div>
    </div>
  `;
}

// =============================================================================
// PANEL 2: DISC SUMMARY
// =============================================================================

function renderDiscSummary(): string {
  const discsState = (window as any).discsState;
  const dmgState = getState();

  if (!discsState) {
    return `
      <div class="dmgcalc-panel">
        <div class="dmgcalc-panel-title">Discs</div>
        <div class="disc-summary-empty">No discs equipped</div>
      </div>
    `;
  }

  const selectedDiscs = discsState.selectedDiscs || {};
  const discNames = discsState.discNames || {};
  const discLevel = dmgState.discLevel || 81;

  const slotIds: DiscSlotId[] = ['main1', 'main2', 'main3', 'sub1', 'sub2', 'sub3'];
  const slotLabels: Record<DiscSlotId, string> = {
    main1: 'M1', main2: 'M2', main3: 'M3',
    sub1: 'S1', sub2: 'S2', sub3: 'S3',
  };

  let hasAnyDisc = false;
  let rows = '';

  for (const slotId of slotIds) {
    const disc = selectedDiscs[slotId];
    if (!disc || !disc.Id) continue;

    hasAnyDisc = true;
    const name = discNames[disc.Id]?.toString() || `Disc ${disc.Id}`;
    const lb = dmgState.discLimitBreaks?.[slotId] ?? 1;

    rows += `
      <div class="disc-slot-row">
        <span class="disc-slot-label">${slotLabels[slotId]}</span>
        <span class="disc-slot-name">${name}</span>
        <span class="disc-slot-lb-ctrl">
          <button class="disc-ctrl-btn" data-action="disc-lb-down" data-slot="${slotId}" ${lb <= 0 ? 'disabled' : ''}>-</button>
          <span class="disc-slot-lb-value">LB${lb}</span>
          <button class="disc-ctrl-btn" data-action="disc-lb-up" data-slot="${slotId}" ${lb >= 6 ? 'disabled' : ''}>+</button>
        </span>
      </div>
    `;
  }

  if (!hasAnyDisc) {
    return `
      <div class="dmgcalc-panel">
        <div class="dmgcalc-panel-title">Discs</div>
        <div class="disc-summary-empty">No discs equipped</div>
      </div>
    `;
  }

  return `
    <div class="dmgcalc-panel">
      <div class="dmgcalc-panel-title">Discs</div>
      <div class="disc-level-ctrl">
        <span>Lv.</span>
        <button class="disc-ctrl-btn" data-action="disc-level-down" ${discLevel <= 1 ? 'disabled' : ''}>-</button>
        <input type="number" class="disc-level-input" data-action="disc-level-input" value="${discLevel}" min="1" max="90">
        <button class="disc-ctrl-btn" data-action="disc-level-up" ${discLevel >= 90 ? 'disabled' : ''}>+</button>
      </div>
      <div class="disc-summary">
        ${rows}
      </div>
    </div>
  `;
}

// =============================================================================
// PANEL 3: ENEMY CONFIG
// =============================================================================

function renderEnemyConfig(state: DmgCalcState): string {
  const t = (key: string, fallback: string) => window.i18n?.t(`dmgcalc.${key}`) || fallback;
  return `
    <div class="dmgcalc-panel">
      <div class="dmgcalc-panel-title">${t('enemy', 'Enemy')}</div>
      <div class="enemy-config">
        <div class="enemy-field">
          <label>${t('def', 'DEF')}</label>
          <input type="number" class="enemy-input" data-field="def" value="${state.enemy.def}">
        </div>
        <div class="enemy-field">
          <label>${t('res', 'RES')}</label>
          <input type="number" class="enemy-input" data-field="res" value="${state.enemy.res}">
        </div>
        <div class="toughness-toggle">
          <span>${t('toughnessBroken', 'Toughness Broken')}</span>
          <label class="toggle-switch">
            <input type="checkbox" data-action="toggle-toughness" ${state.enemy.toughnessBroken ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;
}
