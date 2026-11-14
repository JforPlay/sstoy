import { GameData } from '@/shared/game-data';
import { renderCharacterCard, renderDiscSummary, renderEnemyConfig } from './build-panel';
import { renderNotesSection, renderPotentialArea, renderBuffPanel, renderStatSummary } from './buff-panel';
import { renderSkillCards } from './skill-cards';
import { renderBadgePanel } from './badge-panel';
import { renderCyclePanel } from './cycle-panel';
import { getEnemyPresets, hasEnemyLoadError } from '../core/enemies';
import type { DmgCalcState } from '../types';
import {calculatorDraftStatus} from '../core/draft';

const t = (key: string) => window.i18n?.t(`dmgcalc.${key}`) || key;
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const STEPS = ['stepPotentials', 'stepDiscs', 'stepNotes', 'badges', 'stepEnemy', 'stepResults'];

function renderStep(state: DmgCalcState, step: number): string {
  switch (step) {
    case 1: return `<div class="dmgcalc-panel">
      <div class="dmgcalc-panel-title">${t('stepPotentials')}</div>
      <p class="dmgcalc-help">${t('potentialStepHelp')}</p>
      <div class="dmgcalc-actions">
        <button class="btn btn-primary" data-action="calc-ingame-preset">${t('ingamePreset')}</button>
        <button class="btn btn-secondary" data-action="calc-saved-preset">${t('savedPreset')}</button>
        <button class="btn btn-secondary" data-action="calc-builder-tab" data-tab="characters">${t('editParty')}</button>
        <button class="btn btn-secondary" data-action="calc-refresh">${t('refreshBuild')}</button>
      </div>
      ${renderCharacterCard(state)}
      <div class="buff-panel-grid dmgcalc-potential-grid">${renderPotentialArea(state.buffs.filter(buff => buff.sourceType === 'potential'))}</div>
    </div>`;
    case 2: return `<div class="dmgcalc-panel">
      <div class="dmgcalc-panel-title">${t('stepDiscs')}</div>
      <p class="dmgcalc-help">${t('discStepHelp')}</p>
      ${renderDiscSummary()}
    </div>`;
    case 3: return `<div class="dmgcalc-panel">
      <div class="dmgcalc-panel-title">${t('stepNotes')}</div>
      <p class="dmgcalc-help">${t('notesStepHelp')}</p>
      ${renderNotesSection(state) || `<p class="dmgcalc-help">${t('noNotes')}</p>`}
    </div>`;
    case 4: return renderBadgePanel(state);
    case 5: return `<div class="dmgcalc-panel">
      <div class="dmgcalc-panel-title">${t('stepEnemy')}</div>
      <p class="dmgcalc-help">${t('enemyStepHelp')}</p>
      <div class="dmgcalc-actions">
        ${getEnemyPresets().map(preset => `<button class="btn ${state.enemyPresetId === preset.id ? 'btn-primary' : 'btn-secondary'}" data-action="calc-enemy" data-enemy-id="${preset.id}" aria-pressed="${state.enemyPresetId === preset.id}">${escape(preset.name)}</button>`).join('')}
        <button class="btn ${state.enemyPresetId === null ? 'btn-primary' : 'btn-secondary'}" data-action="calc-enemy" aria-pressed="${state.enemyPresetId === null}">${t('manualEnemy')}</button>
      </div>
      ${!getEnemyPresets().length ? `<p class="dmgcalc-help">${t(hasEnemyLoadError() ? 'enemyLoadError' : 'noActiveRaid')}</p>` : ''}
      ${state.enemy.elementalRes ? `<div class="dmgcalc-party-summary">${Object.entries(state.enemy.elementalRes).map(([element, value]) => {
        const key = ['WER', 'FER', 'SER', 'AER', 'LER', 'DER'][Number(element) - 1]!;
        const label = GameData.gameEnums?.effectAttributeType?.[10 + Number(element)]?.name || key;
        return `<span>${escape(label)}: ${value}</span>`;
      }).join('')}</div>` : ''}
      ${renderEnemyConfig(state)}
    </div>`;
    default: return renderCyclePanel() + (!state.masterCharId ? `<p class="dmgcalc-help">${t('selectMasterFirst')}</p>` : `<p class="dmgcalc-scope-note">${t('calculationScope')}</p>
      ${renderSkillCards(state)}${renderBuffPanel(state, { potentials: false, notes: false })}
      <details class="dmgcalc-panel"><summary>${t('statSummary')}</summary>${renderStatSummary(state)}</details>`);
  }
}

export function renderWizard(state: DmgCalcState): string {
  return `<div class="dmgcalc-container-inner dmgcalc-wizard">
    <div class="dmgcalc-actions"><button class="btn btn-secondary" data-action="calc-draft-save"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> 임시 저장</button><button class="btn btn-secondary" data-action="calc-draft-restore">임시 저장 불러오기</button><span class="dmgcalc-help" role="status">${escape(calculatorDraftStatus())}</span></div>
    <div class="dmgcalc-sections" aria-label="${t('setupSteps')}">${STEPS.map((key, index) => {
      const step = index + 1;
      return `<details class="dmgcalc-section" data-calc-section="${step}" ${state.expandedSteps.includes(step) ? 'open' : ''}>
        <summary class="dmgcalc-section-heading">
          <span class="dmgcalc-step-number">${String(step).padStart(2, '0')}</span>
          <span class="dmgcalc-section-title">${t(key)}</span>
          <span class="dmgcalc-section-toggle" aria-hidden="true"><i class="fa-solid fa-chevron-down dmgcalc-section-chevron"></i></span>
        </summary>
        <div class="dmgcalc-section-content">${renderStep(state, step)}</div>
      </details>`;
    }).join('')}</div>
  </div>`;
}
