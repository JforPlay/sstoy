/**
 * Damage Calculator — Main Entry Point (Layout A)
 *
 * Orchestrates data loading, stat aggregation, buff collection,
 * damage calculation, rendering, and event delegation.
 *
 * Performance: separates full render (data load + stat aggregation)
 * from lightweight recalculate (only re-runs damage formula + re-renders).
 *
 * @module dmgcalc/index
 */

import { loadFeatureData, loadLanguageData } from '@/shared/data-loader';
import { GameData } from '@/shared/game-data';
import { i18n } from '@/i18n';
import { PHASE_TO_LEVEL, ELEMENT_TYPE_TO_STAT } from './constants';

// Core
import { getState, resetState, updateEnemy, setLimitBreak, toggleBuff, setStats, setBuffs, setResult, setBuildInfo, setSkillLevel, setDiscLevel, setDiscLimitBreak, setNoteLevel, setStatOverride, clearStatOverride } from './core/state';
import { aggregateAllStats, getStat } from './core/stats';
import { getSkillData, aggregateSlotDmgFromEffects } from './core/skills';
import { collectAllBuffs } from './core/buffs';
import { calculateSingleHitDamage } from './core/calc';
import { setStepExpanded } from './core/state';
import { setBadgeOption, getBadgeSkillBonus, getBadgePotentialBonus, setPotentialTotalLevel } from './core/badges';
import { loadEnemyPresets, selectEnemyPreset } from './core/enemies';

// UI
import { renderDmgCalc } from './ui/renderer';
import { handleCycleAction, handleCycleSetting } from './ui/cycle-panel';
import { openBadgeOptionPicker } from './ui/badge-panel';
import {collectBuildData,restoreBuildData} from '../app-saveload';
import {saveCalculatorDraft,readCalculatorDraft,applyCalculatorDraft,type CalculatorDraft} from './core/draft';
import {showToast} from '@/shared';

// Types
import type { SkillType, SkillDamageResult, HitResult, EnemyConfig, DiscSlotId } from './types';

// =============================================================================
// MODULE STATE
// =============================================================================

let initialized = false;
let eventsAttached = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let dataLoaded = false;
let lastBuildSignature = '';
let lastNoteSourceSignature = '';
let draftChecked=false;
let restoringDraft=false;
let pendingDraft:CalculatorDraft|null=null;
const readDraft=()=>{try{return readCalculatorDraft(localStorage);}catch{return null;}};

function saveDraft(notify=false):void{
  if(restoringDraft)return;
  if(!getState().masterCharId){if(notify)showToast('먼저 메인 여행가를 선택해 주세요.','error');return;}
  const master=window.state?.party?.master;
  if(!master||typeof master==='string'||Number(master.id)!==getState().masterCharId)return;
  try{saveCalculatorDraft(localStorage,getState(),collectBuildData(),{...window.state.characterLevelPhase});if(notify)showToast('계산기 설정을 임시 저장했습니다.','success');}
  catch{if(notify)showToast('임시 저장에 실패했습니다. 브라우저 저장 공간을 확인해 주세요.','error');}
}
async function restoreDraft(draft:CalculatorDraft):Promise<void>{
  restoringDraft=true;
  try{
    await restoreBuildData(draft.build,{toastFallback:'계산기 임시 저장을 불러왔습니다.'});
    Object.assign(window.state.characterLevelPhase,draft.phases);
    resetState();lastBuildSignature='';lastNoteSourceSignature='';pendingDraft=draft;
  }catch{showToast('임시 저장을 불러오지 못했습니다. 저장 데이터와 여행가 설정을 확인해 주세요.','error');
  }finally{restoringDraft=false;}
}

const SKILL_TYPES: SkillType[] = ['normalAtk', 'skill', 'ultimate'];

// =============================================================================
// PUBLIC API
// =============================================================================

export function init(): void {
  if (initialized) return;
  initialized = true;
}

/**
 * Full render: load data, read build state, aggregate stats, calculate, render.
 * Called when switching to the dmgcalc tab or when the build changes.
 */
export async function render(): Promise<void> {
  if(restoringDraft)return;
  const container = document.getElementById('dmgcalc-container');
  if (!container) return;

  // Load data once
  if (!dataLoaded) {
    await Promise.all([loadFeatureData('characterDB'), loadFeatureData('discSystem'), loadFeatureData('damageBadges')]);
    // Load UIText for stat name localization (if not already loaded)
    if (!GameData.uiText || Object.keys(GameData.uiText).length === 0) {
      const langInfo = i18n.getLanguageInfo();
      await loadLanguageData(langInfo.gameLang, ['UIText.json']);
    }
    dataLoaded = true;
  }
  if(!draftChecked){
    draftChecked=true;
    const draft=readDraft();
    const master=window.state?.party?.master;
    if(draft&&(!master||typeof master==='string'))await restoreDraft(draft);
    else if(draft&&JSON.stringify(collectBuildData().c)===JSON.stringify(draft.build.c))pendingDraft=draft;
    window.addEventListener('pagehide',()=>saveDraft());
  }

  if (!eventsAttached) {
    setupEventDelegation(container);
    eventsAttached = true;
    window.addEventListener('builder-data-changed', () => {
      if (document.getElementById('main-tab-dmgcalc')?.classList.contains('active')) void render();
    });
  }

  // Read build state
  const masterChar = window.state?.party?.master;
  if (!masterChar || typeof masterChar === 'string') {
    lastBuildSignature = '';
    setBuildInfo(null, 90, { normalAtk: 8, skill: 8, ultimate: 8 });
    await loadEnemyPresets();
    initializeNoteOverrides();
    container.innerHTML = renderDmgCalc(getState());
    return;
  }

  const charId = typeof masterChar.id === 'string'
    ? parseInt(masterChar.id, 10)
    : masterChar.id;
  const levelPhase = window.state?.characterLevelPhase?.master ?? 8;
  // Phase 8 (max in app) maps to level 80, but dmgcalc uses level 90 as the standard
  const level = levelPhase >= 8 ? 90 : (PHASE_TO_LEVEL[levelPhase] ?? 1);

  const signature = JSON.stringify({
    party: Object.entries(window.state.party).map(([position, character]) => [position, typeof character === 'object' ? character?.id : character]),
    phases: window.state.characterLevelPhase,
    skills: window.state.skillLevels,
    potentials: window.state.potentialLevels,
    discs: Object.entries(window.discsState?.selectedDiscs || {}).map(([slot, disc]) => [slot, disc?.Id]),
    discPhases: window.discsState?.subDiscLevels,
    notes: window.discsState?.acquiredNotes,
  });
  if (lastBuildSignature && lastBuildSignature !== signature) {
    const previous = getState();
    const enemy = { ...previous.enemy };
    resetState();
    updateEnemy(enemy);
    getState().enemy.elementalRes = enemy.elementalRes;
    getState().enemyPresetId = previous.enemyPresetId;
    getState().expandedSteps = [...previous.expandedSteps];
    if (previous.masterCharId === charId) {
      getState().badgeOptions = previous.badgeOptions;
      getState().limitBreak = previous.limitBreak;
      getState().supportLimitBreaks = { ...previous.supportLimitBreaks };
      getState().discLevel = previous.discLevel;
      getState().discLevels = previous.discLevels;
      getState().discLimitBreaks = previous.discLimitBreaks;
    }
  }
  lastBuildSignature = signature;

  // Resolve skill levels, preserve local overrides for same character
  const charData = GameData.characters?.[charId] as any;
  const prevState = getState();
  const prevSkillLevels = prevState.masterCharId === charId ? prevState.skillLevels : null;
  const skillLevels: Record<SkillType, number> = { normalAtk: 8, skill: 8, ultimate: 8 };

  if (charData && window.state?.skillLevels?.master) {
    const map = window.state.skillLevels.master;
    if (charData.NormalAtkId && map[charData.NormalAtkId]) skillLevels.normalAtk = map[charData.NormalAtkId] ?? 8;
    if (charData.SkillId && map[charData.SkillId]) skillLevels.skill = map[charData.SkillId] ?? 8;
    if (charData.UltimateId && map[charData.UltimateId]) skillLevels.ultimate = map[charData.UltimateId] ?? 8;
  }

  if (prevSkillLevels) {
    skillLevels.normalAtk = prevSkillLevels.normalAtk;
    skillLevels.skill = prevSkillLevels.skill;
    skillLevels.ultimate = prevSkillLevels.ultimate;
  }

  setBuildInfo(charId, level, skillLevels);

  await loadEnemyPresets();

  // Initialize note overrides from sub disc contributions + acquired notes
  initializeNoteOverrides();

  // Initialize potential level overrides from window.state
  initializePotentialLevelOverrides();
  if(pendingDraft){applyCalculatorDraft(getState(),pendingDraft);pendingDraft=null;}

  // Full aggregation
  fullRecalculate(charId, level);

  // Render
  container.innerHTML = renderDmgCalc(getState());

  // Attach events once
  if (!eventsAttached) {
    setupEventDelegation(container);
    eventsAttached = true;
  }
}

// =============================================================================
// RECALCULATION (lightweight — no data loading, no async)
// =============================================================================

/**
 * Full recalculation: aggregate stats + collect buffs + calculate damage.
 * Used on initial render and when LB changes (need to re-aggregate talents).
 */
function fullRecalculate(charId: number, level: number): void {
  const state = getState();

  // Aggregate stats (includes base, talents, potentials, discs)
  const stats = aggregateAllStats(charId, level, state.limitBreak);
  setStats(stats);

  // Collect buffs (preserve toggle state)
  const prevActive = new Map(state.buffs.map((b) => [b.id, b.active]));
  const newBuffs = collectAllBuffs(charId, state.limitBreak);
  setBuffs(newBuffs.map((buff) => ({
    ...buff,
    active: prevActive.has(buff.id) ? prevActive.get(buff.id)! : buff.active,
  })));

  // Apply active buffs to stats
  applyBuffsToStats(stats);

  // Calculate damage
  calculateAllSkillDamage(charId);
}

/**
 * Lightweight recalculate: only re-run damage formula with current stats.
 * Used for enemy config changes, buff toggles, skill level changes.
 * Skips re-aggregating base/talent/potential/disc stats.
 */
function lightRecalculate(): void {
  const state = getState();
  if (!state.masterCharId) return;

  // Re-aggregate stats to apply/remove buff changes
  const stats = aggregateAllStats(state.masterCharId, state.masterLevel, state.limitBreak);
  setStats(stats);
  applyBuffsToStats(stats);

  // Recalculate damage
  calculateAllSkillDamage(state.masterCharId);
}

/**
 * Apply active TOGGLEABLE buff stat effects to the stats map.
 * Non-toggleable entries (potential stats, LB talent bonuses) are display-only —
 * their values are already included via aggregateAllStats().
 */
function applyBuffsToStats(stats: Map<string, any>): void {
  const state = getState();
  for (const buff of state.buffs) {
    if (!buff.active || buff.nonToggleable) continue;
    for (const effect of buff.statEffects) {
      const stat = stats.get(effect.key);
      if (stat && state.statOverrides[effect.key] === undefined) {
        stat.total += effect.value;
      }
    }
  }
}

/**
 * Synchronous re-render: recalculate + update DOM. No data loading.
 */
function quickRender(): void {
  const container = document.getElementById('dmgcalc-container');
  if (!container) return;

  lightRecalculate();
  saveDraft();
  container.innerHTML = renderDmgCalc(getState());
}

/**
 * Full re-render (with stat re-aggregation for LB changes).
 */
function fullRender(): void {
  const container = document.getElementById('dmgcalc-container');
  if (!container) return;

  const state = getState();
  if (state.masterCharId) fullRecalculate(state.masterCharId, state.masterLevel);
  saveDraft();
  container.innerHTML = renderDmgCalc(getState());
}

// =============================================================================
// DAMAGE CALCULATION
// =============================================================================

/** Get element damage multiplier from element type. */
function getElementDmg(elementType: number): number {
  const key = ELEMENT_TYPE_TO_STAT[elementType];
  if (!key) return 1;
  const val = getStat(key);
  return getState().stats.has(key) ? val / 10000 : 1;
}

function calculateAllSkillDamage(charId: number): void {
  const state = getState();
  const charData = GameData.characters?.[charId] as any;
  if (!charData) return;

  const atk = getStat('Atk');
  const critRate = getStat('CritRate');
  const critPower = state.stats.get('CritPower')?.total ?? 15000;

  const charEET: number = charData.EET ?? 0;

  for (const skillType of SKILL_TYPES) {
    setResult(skillType, null);
    const subtype = { normalAtk: 1, skill: 2, ultimate: 4 }[skillType];
    const skillData = getSkillData(charId, skillType, state.skillLevels[skillType] + getBadgeSkillBonus('master', subtype), state.limitBreak);
    if (!skillData) continue;

    const baseSlotDmg = aggregateSlotDmgFromEffects(skillData.effectParams);

    const hits: HitResult[] = [];
    let totalBaseDmg = 0;
    let totalCritDmg = 0;
    let totalAvgDmg = 0;

    if (skillData.hitDamages.length === 0) {
      // A missing reference is not a 100%-ATK hit or a proven zero-damage skill.
    } else {
      skillData.hitDamages.forEach((hd, idx) => {
        // Use each hit's own element type, fallback to character's EET
        const hitElem = hd.elementType || charEET;
        const elemDmg = getElementDmg(hitElem);
        const calc = calculateSingleHitDamage(
          { displayName: hd.displayName, skillPercent: hd.skillPercent, skillAbs: hd.skillAbs, damageType: hd.damageType, elementType: hitElem, damageBonusType: hd.damageBonusType },
          atk, critRate, critPower, baseSlotDmg, elemDmg
        );
        hits.push({
          hitIndex: idx, damagePercent: hd.skillPercent,
          baseDmg: calc.baseDamage, critDmg: calc.critDamage, avgDmg: calc.averageDamage,
          damageType: hd.damageType, elementType: hitElem,
        });
        totalBaseDmg += calc.baseDamage;
        totalCritDmg += calc.critDamage;
        totalAvgDmg += calc.averageDamage;
      });
    }

    setResult(skillType, {
      status: hits.length ? 'referenced-hits' : 'missing-hit-data',
      skillName: skillData.skillName,
      skillIcon: skillData.skillIcon,
      skillType,
      skillId: skillData.skillId,
      totalBaseDmg: Math.round(totalBaseDmg),
      totalCritDmg: Math.round(totalCritDmg),
      totalAvgDmg: Math.round(totalAvgDmg),
      hits,
    });
  }
}

// =============================================================================
// NOTE / POTENTIAL INITIALIZATION
// =============================================================================

/**
 * Initialize noteOverrides from sub disc contributions + acquired notes.
 * Only sets values that are not already overridden (preserves user changes).
 */
function initializeNoteOverrides(): void {
  const state = getState();
  const sourceSignature = JSON.stringify({
    discs: Object.entries(window.discsState?.selectedDiscs || {}).map(([slot, disc]) => [slot, disc?.Id]),
    phases: window.discsState?.subDiscLevels,
    acquired: window.discsState?.acquiredNotes,
  });
  if (lastNoteSourceSignature && lastNoteSourceSignature !== sourceSignature) state.noteOverrides = {};
  lastNoteSourceSignature = sourceSignature;
  // Only initialize once per character (skip if already populated)
  if (Object.keys(state.noteOverrides).length > 0) return;

  const discsState = window.discsState;
  if (!discsState) return;

  const notesFromDiscs: Record<string, number> = {};

  // Calculate notes from sub discs (same logic as app-disc.ts calculateNotesFromSubDiscs)
  (['sub1', 'sub2', 'sub3'] as const).forEach((slotId) => {
    const disc = discsState.selectedDiscs?.[slotId];
    if (!disc || !disc.SubNoteSkillGroupId) return;

    const phase = discsState.subDiscLevels?.[slotId] || 0;

    const promoteEntry = Object.values(discsState.subNoteSkillPromoteData || {}).find((entry: any) => {
      if (entry.GroupId !== disc.SubNoteSkillGroupId) return false;
      const entryPhase = entry.Phase !== undefined ? entry.Phase : 0;
      return entryPhase === phase;
    });

    if (promoteEntry && (promoteEntry as any).SubNoteSkills) {
      try {
        const noteContributions = JSON.parse((promoteEntry as any).SubNoteSkills) as Record<string, number>;
        for (const [noteId, value] of Object.entries(noteContributions)) {
          notesFromDiscs[noteId] = (notesFromDiscs[noteId] || 0) + value;
        }
      } catch {
        // Silent fail
      }
    }
  });

  // Merge with acquired notes
  const acquiredNotes = discsState.acquiredNotes || {};

  // Include ALL notes from SubNoteSkill.json so they're all visible
  const allNoteIds = new Set([
    ...Object.keys(notesFromDiscs),
    ...Object.keys(acquiredNotes),
    ...Object.keys(GameData.subNoteSkills || {}),
  ]);

  allNoteIds.forEach((noteId) => {
    const fromDiscs = notesFromDiscs[noteId] || 0;
    const acquired = acquiredNotes[noteId] || 0;
    const total = fromDiscs + acquired;
    state.noteOverrides[noteId] = Math.min(total, 99);
  });
}

/**
 * Initialize potentialLevelOverrides from window.state.potentialLevels.
 * Only sets values that are not already overridden (preserves user changes).
 */
function adjustPotentialTotal(potId: string, delta: number): void {
  const position = (['master', 'assist1', 'assist2'] as const).find(pos => window.state?.selectedPotentials?.[pos]?.includes(Number(potId)));
  if (!position) return;
  const total = (getState().potentialLevelOverrides[potId] || 1) + getBadgePotentialBonus(position, Number(potId));
  if (!setPotentialTotalLevel(position, Number(potId), total + delta)) {
    window.showToast?.('90 배지에 빈 옵션이 없어 잠재력 레벨을 올릴 수 없습니다.', 'warning');
  }
}

function initializePotentialLevelOverrides(): void {
  const state = getState();
  // Only initialize once (skip if already populated)
  if (Object.keys(state.potentialLevelOverrides).length > 0) return;

  const potentialLevels = window.state?.potentialLevels;
  if (!potentialLevels) return;

  const positions = ['master', 'assist1', 'assist2'] as const;
  for (const pos of positions) {
    const levels = potentialLevels[pos];
    if (!levels) continue;
    for (const [potId, level] of Object.entries(levels)) {
      if (level && level > 0) {
        state.potentialLevelOverrides[potId] = Math.min(6, level);
        if (level > 6 && window.state?.selectedPotentials?.[pos]?.includes(Number(potId))) {
          if (!setPotentialTotalLevel(pos, Number(potId), level)) {
            window.showToast?.('90 배지의 빈 옵션이 부족하거나 잠재력 연결을 찾지 못했습니다.', 'warning');
          }
        }
      }
    }
  }
}

// =============================================================================
// EVENT DELEGATION (attached once)
// =============================================================================

function setupEventDelegation(container: HTMLElement): void {
  // Native details toggles do not bubble. Capture them without rebuilding the
  // page so independent sections stay open and the scroll position is retained.
  container.addEventListener('toggle', (event: Event) => {
    const section = event.target;
    if (section instanceof HTMLDetailsElement && section.hasAttribute('data-calc-section')) {
      setStepExpanded(Number(section.dataset.calcSection), section.open);
    }
  }, true);
  // Click delegation
  container.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;
    const state = getState();

    if (action && handleCycleAction(action, actionEl)) return;

    switch (action) {
      case 'calc-draft-save':saveDraft(true);quickRender();break;
      case 'calc-draft-restore': {
        const draft=readDraft();
        if(draft)void restoreDraft(draft).then(()=>render());
        else showToast('불러올 임시 저장이 없습니다.','error');
        break;
      }
      case 'badge-group-open':
        openBadgeOptionPicker(Number(actionEl.dataset.slot), Number(actionEl.dataset.index), id => {
          if (setBadgeOption(Number(actionEl.dataset.slot), Number(actionEl.dataset.index), id)) fullRender();
        });
        break;
      case 'calc-ingame-preset':
        (window as any).openIngameCodeModal?.();
        break;
      case 'calc-saved-preset':
        window.openLoadModal?.();
        break;
      case 'calc-builder-tab':
        window.switchMainTab?.(actionEl.dataset.tab as 'characters' | 'discs');
        break;
      case 'calc-refresh':
        void render();
        break;
      case 'calc-select-disc': {
        const slot = actionEl.dataset.slot as DiscSlotId;
        void import('../app-disc').then(async disc => {
          await disc.loadDiscData();
          disc.openDiscSelector(slot);
        });
        break;
      }
      case 'calc-enemy':
        selectEnemyPreset(actionEl.dataset.enemyId ? Number(actionEl.dataset.enemyId) : null);
        quickRender();
        break;
      case 'badge-value-pick':
        if (setBadgeOption(Number(actionEl.dataset.slot), Number(actionEl.dataset.index), Number(actionEl.dataset.id))) fullRender();
        break;
      case 'lb-increment':
        if (actionEl.dataset.position === 'assist1' || actionEl.dataset.position === 'assist2') state.supportLimitBreaks[actionEl.dataset.position] = Math.min(5, state.supportLimitBreaks[actionEl.dataset.position] + 1);
        else setLimitBreak(state.limitBreak + 1);
        fullRender();
        break;

      case 'lb-decrement':
        if (actionEl.dataset.position === 'assist1' || actionEl.dataset.position === 'assist2') state.supportLimitBreaks[actionEl.dataset.position] = Math.max(0, state.supportLimitBreaks[actionEl.dataset.position] - 1);
        else setLimitBreak(state.limitBreak - 1);
        fullRender();
        break;

      case 'toggle-toughness': {
        // Native checkbox changes are handled once by the change listener.
        break;
      }

      case 'toggle-buff': {
        if (actionEl.matches('input') || actionEl.querySelector('input[type="checkbox"]')) break;
        const buffId = actionEl.dataset.buffId;
        if (buffId) {
          toggleBuff(buffId);
          quickRender();
        }
        break;
      }

      case 'skill-level-up': {
        const st = actionEl.dataset.skillType as SkillType;
        if (st) {
          setSkillLevel(st, (state.skillLevels[st] || 1) + 1);
          quickRender();
        }
        break;
      }

      case 'skill-level-down': {
        const st = actionEl.dataset.skillType as SkillType;
        if (st) {
          setSkillLevel(st, (state.skillLevels[st] || 1) - 1);
          quickRender();
        }
        break;
      }

      case 'disc-lb-up': {
        const slot = actionEl.dataset.slot as DiscSlotId;
        if (slot) {
          setDiscLimitBreak(slot, (state.discLimitBreaks[slot] || 0) + 1);
          fullRender();
        }
        break;
      }

      case 'disc-lb-down': {
        const slot = actionEl.dataset.slot as DiscSlotId;
        if (slot) {
          setDiscLimitBreak(slot, (state.discLimitBreaks[slot] || 0) - 1);
          fullRender();
        }
        break;
      }

      case 'disc-level-up':
        setDiscLevel((state.discLevel || 81) + 1);
        fullRender();
        break;

      case 'disc-level-down':
        setDiscLevel((state.discLevel || 81) - 1);
        fullRender();
        break;

      case 'note-level-up': {
        const noteId = actionEl.dataset.noteId;
        if (noteId) {
          setNoteLevel(noteId, (state.noteOverrides[noteId] || 0) + 1);
          fullRender();
        }
        break;
      }

      case 'note-level-down': {
        const noteId = actionEl.dataset.noteId;
        if (noteId) {
          setNoteLevel(noteId, (state.noteOverrides[noteId] || 0) - 1);
          fullRender();
        }
        break;
      }

      case 'pot-level-up': {
        const potId = actionEl.dataset.potId;
        if (potId) {
          adjustPotentialTotal(potId, 1);
          fullRender();
        }
        break;
      }

      case 'pot-level-down': {
        const potId = actionEl.dataset.potId;
        if (potId) {
          adjustPotentialTotal(potId, -1);
          fullRender();
        }
        break;
      }
    }
  });

  // Input delegation (enemy fields with debounce)
  container.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLInputElement;

    if (target.classList.contains('enemy-input')) {
      const field = target.dataset.field as 'def' | 'res' | 'level';
      if (!field) return;
      const value = parseFloat(target.value);
      if (isNaN(value)) return;
      updateEnemy({ [field]: value });
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => quickRender(), 300);
    } else if (target.classList.contains('disc-level-input')) {
      const value = parseInt(target.value, 10);
      if (isNaN(value)) return;
      setDiscLevel(value, target.dataset.slot as DiscSlotId | undefined);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fullRender(), 300);
    }
  });

  // Change delegation (checkboxes)
  container.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLElement;
    if (handleCycleSetting(target)) return;
    if (target instanceof HTMLInputElement && target.classList.contains('dmgcalc-note-level')) {
      const noteId = target.dataset.noteId;
      if (noteId) {
        setNoteLevel(noteId, target.value === '' ? 0 : Number(target.value));
        fullRender();
      }
      return;
    }
    if (target instanceof HTMLSelectElement && ['badge-group', 'badge-value'].includes(target.dataset.action || '')) {
      if (setBadgeOption(Number(target.dataset.slot), Number(target.dataset.index), Number(target.value))) fullRender();
      return;
    }
    if (!(target instanceof HTMLInputElement)) return;

    const actionEl = target.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;

    const action = actionEl.dataset.action;

    if (action === 'toggle-toughness') {
      updateEnemy({ toughnessBroken: target.checked });
      quickRender();
    } else if (action === 'toggle-buff') {
      const buffId = actionEl.dataset.buffId ?? target.dataset.buffId;
      if (buffId) {
        toggleBuff(buffId);
        quickRender();
      }
    }
  });

  // Stat override: apply on Enter key or blur (out of focus)
  const applyStatOverrideFromInput = (input: HTMLInputElement) => {
    const statKey = input.dataset.statKey;
    if (!statKey) return;

    const rawValue = input.value.trim().replace(/%$/, ''); // strip trailing %
    if (rawValue === '') {
      // Empty → clear override
      clearStatOverride(statKey);
      fullRender();
      return;
    }

    const num = parseFloat(rawValue);
    if (isNaN(num)) return;

    const isFlat = input.dataset.isFlat === 'true';
    // For percentage stats, user types display value (e.g., "120.5") → convert to per-100 internal (12050)
    const internalValue = isFlat ? num : num * 100;

    setStatOverride(statKey, internalValue);
    fullRender();
  };

  container.addEventListener('keydown', (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('stat-override-input')) return;
    if ((e as KeyboardEvent).key === 'Enter') {
      (e as KeyboardEvent).preventDefault();
      applyStatOverrideFromInput(target as HTMLInputElement);
      (target as HTMLInputElement).blur();
    }
  });

  container.addEventListener('focusout', (e: Event) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('stat-override-input')) return;
    applyStatOverrideFromInput(target as HTMLInputElement);
  });
}

// =============================================================================
// WINDOW EXPORTS
// =============================================================================

if (typeof window !== 'undefined') {
  (window as any).dmgcalc = { init, render };
  (window as any).renderDamageCalculator = render;
}
