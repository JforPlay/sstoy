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
import { GameData, getCharacterName } from '@/shared/game-data';
import { PHASE_TO_LEVEL,DISC_MAX_LIMIT_BREAK,normalizeDiscLimitBreak,normalizeBaseSkillLevel,SKILL_BASE_MAX_LEVEL } from '../constants';
import {getBadgeSkillBonus} from '../core/badges';
import { formatStatValue, getStatDisplayName } from '../core/enums';
import { getState } from '../core/state';
import type { DmgCalcState, DiscSlotId } from '../types';

const t = (key: string) => window.i18n?.t(`dmgcalc.${key}`) || key;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

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

export function renderCharacterCard(state: DmgCalcState): string {
  const positions = ['master', 'assist1', 'assist2'] as const;
  return `<div class="dmgcalc-party-grid">${positions.map(position => {
    const char = window.state?.party?.[position];
    const id = char && typeof char !== 'string' ? String(char.id) : position === 'master' && state.masterCharId ? String(state.masterCharId) : null;
    const role = t(position);
    const name = id ? getCharacterName(id) : t('emptyCharacter');
    const phase = window.state?.characterLevelPhase?.[position] ?? 8;
    const level = position === 'master' ? state.masterLevel : phase >= 8 ? 90 : PHASE_TO_LEVEL[phase] ?? 1;
    const character=id?GameData.characters?.[id]:undefined;
    const builderLevels=window.state?.skillLevels?.[position]??{};
    const skillLevels=position==='master'?state.skillLevels:{
      normalAtk:builderLevels[Number(character?.AssistNormalAtkId??0)]??8,
      skill:builderLevels[Number(character?.AssistSkillId??0)]??8,
      ultimate:builderLevels[Number(character?.UltimateId??0)]??8,
    };
    return `<article class="dmgcalc-party-card ${position === 'master' ? 'is-master' : ''} ${id ? '' : 'is-empty'}" data-position="${position}">
      <div class="dmgcalc-card-role"><i class="fa-solid ${position === 'master' ? 'fa-crown' : 'fa-user-group'}" aria-hidden="true"></i>${role}</div>
      <div class="dmgcalc-party-identity">
        <div class="dmgcalc-portrait" aria-label="${escape(role + ' · ' + name)}">
          ${id ? createResponsiveImage(`assets/char/avg1_${id}_002.png`, escape(name), 'dmgcalc-party-portrait') : '<i class="fa-solid fa-user" aria-hidden="true"></i>'}
        </div>
        <div class="dmgcalc-party-copy"><strong>${escape(name)}</strong><span>${id ? `Lv.${level}` : t('emptyCharacterHint')}</span>
        </div>
      </div>
      ${id ? (() => { const lb = position === 'master' ? state.limitBreak : state.supportLimitBreaks[position]; return `<div class="dmgcalc-card-controls"><span>${t('limitBreak')}</span><span class="lvl-stepper"><button class="disc-ctrl-btn" data-action="lb-decrement" data-position="${position}" ${lb <= 0 ? 'disabled' : ''}>−</button><span class="lvl-stepper-val">${lb}</span><button class="disc-ctrl-btn" data-action="lb-increment" data-position="${position}" ${lb >= 5 ? 'disabled' : ''}>+</button></span></div>`; })() : ''}
      ${id?`<div class="dmgcalc-skill-levels">${(['normalAtk','skill','ultimate'] as const).map(type=>{
        const base=normalizeBaseSkillLevel(Number(skillLevels[type]));
        const bonus=getBadgeSkillBonus(position,type==='normalAtk'?1:type==='ultimate'?4:position==='master'?2:3);
        const label=t(`skillLabel_${type}`);
        return `<div class="dmgcalc-card-controls" data-skill-level="${type}"><span>${label}</span><span class="lvl-stepper"><button class="disc-ctrl-btn" data-action="party-skill-down" data-position="${position}" data-skill-type="${type}" aria-label="${escape(role+' '+label+' 레벨 감소')}" ${base<=1?'disabled':''}>−</button><input class="dmgcalc-skill-input" type="number" min="1" max="${SKILL_BASE_MAX_LEVEL}" step="1" value="${base}" data-position="${position}" data-skill-type="${type}" aria-label="${escape(role+' '+label+' 기본 레벨')}"><button class="disc-ctrl-btn" data-action="party-skill-up" data-position="${position}" data-skill-type="${type}" aria-label="${escape(role+' '+label+' 레벨 증가')}" ${base>=SKILL_BASE_MAX_LEVEL?'disabled':''}>+</button></span></div><div class="dmgcalc-skill-total"><strong>Lv.${base+bonus}</strong>${bonus?` <small class="dmgcalc-skill-bonus">(${base} + 배지 ${bonus})</small>`:''}</div>`;
      }).join('')}</div>`:''}
    </article>`;
  }).join('')}</div>
  ${state.masterCharId ? `<div class="dmgcalc-key-stats">${['Atk', 'CritRate', 'CritPower'].map(key => `<div><span>${getStatDisplayName(key)}</span><strong>${formatStatValue(key, state.stats.get(key)?.total ?? 0)}</strong></div>`).join('')}</div>` : ''}`;
}

// Six visible slots: image selection above independent level / limit-break inputs.
export function renderDiscSummary(): string {
  const state = getState();
  const discs = window.discsState;
  return `<div class="dmgcalc-disc-groups">${(['main', 'sub'] as const).map(group => {
    const groupLabel = t(group === 'main' ? 'mainDisc' : 'subDisc');
    const slots = [1, 2, 3].map(number => `${group}${number}` as DiscSlotId);
    return `<section class="dmgcalc-disc-group"><h3 class="dmgcalc-disc-group-title">${groupLabel}</h3><div class="dmgcalc-disc-grid">${slots.map(slot => {
    const disc = discs?.selectedDiscs?.[slot];
    const name = disc ? String(discs?.discNames?.[disc.Id] || disc.Id) : t('chooseDisc');
    const label = `${t(slot.startsWith('main') ? 'mainDisc' : 'subDisc')} ${slot.slice(-1)}`;
    const icon = disc ? GameData.items?.[disc.Id]?.Icon?.split('/').pop() : null;
    const level = state.discLevels[slot];
    const lb = normalizeDiscLimitBreak(state.discLimitBreaks[slot]);
    return `<article class="dmgcalc-disc-card ${disc ? '' : 'is-empty'}">
      <span class="dmgcalc-disc-slot-number">${slot.slice(-1)}</span>
      <button class="dmgcalc-disc-select" data-action="calc-select-disc" data-slot="${slot}" aria-label="${escape(label + ' · ' + name)}">
        <span class="dmgcalc-disc-art">${icon ? createResponsiveImage(`assets/disc_icons/${icon}.png`, escape(name), 'dmgcalc-disc-image') : '<i class="fa-solid fa-plus" aria-hidden="true"></i>'}</span>
        <strong>${escape(name)}</strong>
      </button>
      <div class="dmgcalc-disc-settings">
        <label><span>${t('level')}</span><input type="number" class="disc-level-input" data-slot="${slot}" value="${level}" min="1" max="90" ${disc ? '' : 'disabled'} aria-label="${escape(label + ' · ' + t('level'))}"></label>
        <div class="dmgcalc-card-controls"><span>${t('limitBreak')}</span><span class="lvl-stepper"><button class="disc-ctrl-btn" data-action="disc-lb-down" data-slot="${slot}" ${!disc || lb <= 0 ? 'disabled' : ''}>−</button><span class="lvl-stepper-val">${lb}</span><button class="disc-ctrl-btn" data-action="disc-lb-up" data-slot="${slot}" ${!disc || lb >= DISC_MAX_LIMIT_BREAK ? 'disabled' : ''}>+</button></span></div>
      </div>
    </article>`;
    }).join('')}</div></section>`;
  }).join('')}</div>`;
}

// =============================================================================
// PANEL 3: ENEMY CONFIG
// =============================================================================

export function renderEnemyConfig(state: DmgCalcState): string {
  const t = (key: string, fallback: string) => window.i18n?.t(`dmgcalc.${key}`) || fallback;
  return `
    <div class="dmgcalc-panel">
      <div class="dmgcalc-panel-title">${t('enemy', 'Enemy')}</div>
      <div class="enemy-config">
        <div class="enemy-field">
          <label for="dmgcalc-enemy-def">${t('def', 'DEF')}</label>
          <input id="dmgcalc-enemy-def" type="number" class="enemy-input" data-field="def" value="${state.enemy.def}" min="0" ${state.enemyPresetId !== null ? 'disabled' : ''}>
        </div>
        <div class="enemy-field">
          <label for="dmgcalc-enemy-res">${t('res', 'RES')}</label>
          ${state.enemyPresetId !== null
            ? `<input id="dmgcalc-enemy-res" type="text" value="${t('automaticRes', '속성별 자동 적용')}" disabled>`
            : `<input id="dmgcalc-enemy-res" type="number" class="enemy-input" data-field="res" value="${state.enemy.res}">`}
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
