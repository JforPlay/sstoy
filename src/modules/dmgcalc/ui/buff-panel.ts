/**
 * Buff Panel — Full-width section below main layout
 *
 * Three areas in a grid:
 *   1. Skill/Talent buffs (static, grouped by source character)
 *   2. Potentials (grouped by character, with level steppers)
 *   3. Notes (소리) compact grid with level steppers
 *
 * @module dmgcalc/ui/buff-panel
 */

import type { DmgCalcState, BuffSource } from '../types';
import { getStatDisplayName } from '../core/enums';
import { GameData, getCharacterName } from '@/shared/game-data';
import { createResponsiveImage } from '@/shared/dom';
import { getAttrKeyFromEnumId } from '../core/enums';
import { getBadgePotentialBonus } from '../core/badges';

/** i18n helper — falls back to provided default */
const t = (key: string, fallback: string) => window.i18n?.t(`dmgcalc.${key}`) || fallback;
const escapeAttribute = (value: string): string => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!));

// =============================================================================
// MAIN EXPORT
// =============================================================================

export function renderBuffPanel(state: DmgCalcState, options: { potentials?: boolean; notes?: boolean } = {}): string {
  const { buffs } = state;

  const skillBuffs = (buffs || []).filter(b => b.sourceType === 'assist-skill' || b.sourceType === 'assist-ult' || b.sourceType === 'talent');
  const potentialStats = (buffs || []).filter(b => b.sourceType === 'potential');
  const lbBonuses = (buffs || []).filter(b => b.sourceType === 'talent-bonus');

  const skillSection = renderSkillBuffArea(skillBuffs, lbBonuses);
  const potSection = options.potentials === false ? '' : renderPotentialArea(potentialStats);
  const notesSection = options.notes === false ? '' : renderNotesSection(state);

  return `
    <div class="dmgcalc-panel dmgcalc-buffs-panel">
      <div class="dmgcalc-panel-title">${t('buffs', 'BUFFS')}</div>
      <div class="buff-panel-grid">
        ${skillSection}
        ${potSection}
        ${notesSection}
      </div>
    </div>
  `;
}

// =============================================================================
// STAT SUMMARY (separate section)
// =============================================================================

export function renderStatSummary(state: DmgCalcState): string {
  const stats = state.stats;
  if (!stats || stats.size === 0) return '';

  // Stats to exclude (not relevant to damage calculation)
  const EXCLUDE_STATS = new Set(['Def', 'Hp']);

  // Stats to always show even if 0
  const ALWAYS_SHOW = new Set(['Penetrate', 'DefIgnore', 'WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP', 'WEI', 'FEI', 'SEI', 'AEI', 'LEI', 'DEI']);

  // Flat stats (displayed as integer, not percentage)
  const FLAT_DISPLAY = new Set(['Atk', 'Penetrate', 'WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP']);

  // Flavor text for key stats
  const FLAVOR: Record<string, string> = {
    'Atk': '기본 공격력',
    'CritRate': '크리티컬 확률',
    'CritPower': '크리티컬 배율',
    'GENDMG': '모든 피해에 적용',
    'FINALDMG': '최종 피해 배율',
    'DMGPLUS': '고정 피해 추가',
    'NORMALDMG': '일반 공격에 적용',
    'SKILLDMG': '스킬에 적용',
    'ULTRADMG': '필살기에 적용',
    'WEP': '적 물 속성 저항을 감소', 'FEP': '적 불 속성 저항을 감소',
    'SEP': '적 땅 속성 저항을 감소', 'AEP': '적 바람 속성 저항을 감소',
    'LEP': '적 빛 속성 저항을 감소', 'DEP': '적 어둠 속성 저항을 감소',
    'WEI': '적 물 속성 저항 무시', 'FEI': '적 불 속성 저항 무시',
    'SEI': '적 땅 속성 저항 무시', 'AEI': '적 바람 속성 저항 무시',
    'LEI': '적 빛 속성 저항 무시', 'DEI': '적 어둠 속성 저항 무시',
  };

  const relevantStats: { key: string; label: string; total: number; calculatedTotal: number; sources: { name: string; value: number }[]; isFlat: boolean }[] = [];

  stats.forEach((stat) => {
    if (EXCLUDE_STATS.has(stat.key)) return;

    const alwaysShow = ALWAYS_SHOW.has(stat.key);
    if (!alwaysShow) {
      if (stat.sources.length === 0 && stat.total === 0) return;
      if (stat.sources.length <= 1 && stat.total === stat.baseValue) return;
    }

    const isFlat = FLAT_DISPLAY.has(stat.key);
    relevantStats.push({
      key: stat.key,
      label: getStatDisplayName(stat.key),
      total: stat.total,
      calculatedTotal: stat.calculatedTotal,
      sources: stat.sources.map(s => ({ name: s.name, value: s.value })),
      isFlat,
    });
  });

  if (relevantStats.length === 0) return '';

  const overrides = state.statOverrides || {};

  const rows = relevantStats.map(s => {
    // Calculated total (always the original, never overwritten)
    const calcDisplay = s.isFlat
      ? Math.round(s.calculatedTotal).toLocaleString()
      : `${(s.calculatedTotal / 100).toFixed(1)}%`;

    // Check if this stat has a manual override
    const hasOverride = s.key in overrides;
    const overrideVal = hasOverride ? overrides[s.key] : undefined;
    const overrideDisplay = hasOverride
      ? (s.isFlat ? Math.round(overrideVal!).toLocaleString() : `${(overrideVal! / 100).toFixed(1)}%`)
      : '';

    const breakdown = s.sources.map(src => {
      const val = s.isFlat
        ? `${src.value >= 0 ? '+' : ''}${Math.round(src.value).toLocaleString()}`
        : `${src.value >= 0 ? '+' : ''}${(src.value / 100).toFixed(1)}%`;
      return `<div class="stat-src-row"><span class="stat-src-name">${src.name}</span><span class="stat-src-val">${val}</span></div>`;
    }).join('');

    const overriddenClass = hasOverride ? ' stat-overridden' : '';

    return `
      <details class="stat-summary-row${overriddenClass}">
        <summary>
          <span class="stat-summary-label">${s.label}</span>
          <span class="stat-summary-calc" title="${t('calcTotal', '선택한 빌드 합산')}">${calcDisplay}</span>
          <span class="stat-summary-arrow">→</span>
          <input type="text" class="stat-override-input" data-stat-key="${s.key}" data-is-flat="${s.isFlat}" value="${hasOverride ? overrideDisplay : ''}" placeholder="${t('manualInput', '수동 입력')}" title="${t('manualInputHint', '수동 입력 (Enter로 적용, 빈값으로 초기화)')}">
          <span class="stat-summary-effective${hasOverride ? ' active' : ''}" title="${t('appliedValue', '적용값')}">${hasOverride ? `= ${overrideDisplay}` : ''}</span>
        </summary>
        <div class="stat-src-breakdown">${breakdown}</div>
      </details>
    `;
  }).join('');

  return `
    <div class="dmgcalc-panel dmgcalc-stat-summary">
      <div class="dmgcalc-panel-title">${t('statSummary', 'STAT SUMMARY')}</div>
      ${rows}
    </div>
  `;
}

// =============================================================================
// SKILL / TALENT BUFF AREA
// =============================================================================

function renderSkillBuffArea(skillBuffs: BuffSource[], lbBonuses: BuffSource[]): string {
  const groups = groupBuffsByCharacter(skillBuffs);
  const sections = groups.map(([, group]) => {
    const items = group.buffs.map(b => {
      const effectText = formatStatEffects(b.statEffects);
      const control = b.nonToggleable ? '' : `<input type="checkbox" data-action="toggle-buff" data-buff-id="${escapeAttribute(b.id)}" aria-label="${escapeAttribute(b.sourceName || b.name)}" ${b.active ? 'checked' : ''}>`;
      return `<label class="buff-row">${control}<span class="buff-row-name">${b.sourceName || b.name}</span><span class="buff-row-value">${effectText}</span></label>`;
    }).join('');

    return `
      <div class="buff-block">
        <div class="buff-block-header">
          <span class="buff-block-title">${group.charName}</span>
          <span class="buff-block-count">${group.buffs.length}</span>
        </div>
        ${items}
      </div>
    `;
  }).join('');

  // LB bonuses
  let lbSection = '';
  if (lbBonuses.length > 0) {
    const lbItems = lbBonuses.map(b => {
      const effectText = formatStatEffects(b.statEffects);
      return `<div class="buff-row"><span class="buff-row-name"><span class="buff-lb-icon">&#9733;</span>${b.sourceName || b.name}</span><span class="buff-row-value">${effectText}</span></div>`;
    }).join('');

    lbSection = `
      <div class="buff-block">
        <div class="buff-block-header">
          <span class="buff-block-title buff-lb-title">${t('lbBonus', '한계돌파 보너스')}</span>
        </div>
        ${lbItems}
      </div>
    `;
  }

  if (!sections && !lbSection) return '';
  return `${sections}${lbSection}`;
}

// =============================================================================
// POTENTIAL AREA
// =============================================================================

export function renderPotentialArea(potentialStats: BuffSource[]): string {
  const groups = groupBuffsByCharacter(potentialStats, true);
  if (groups.length === 0) return '';

  return groups.map(([, group]) => {
    // Group by potentialId
    const potGroups = new Map<number, BuffSource[]>();
    for (const buff of group.buffs) {
      const pid = buff.potentialId || 0;
      if (!potGroups.has(pid)) potGroups.set(pid, []);
      potGroups.get(pid)!.push(buff);
    }

    const master = window.state?.party?.master;
    const isMaster = master && typeof master !== 'string' && String(master.id) === String(group.charId);
    const characterPotentials = GameData.charPotentials?.[group.charId];
    const order = [
      ...[...(characterPotentials?.[isMaster ? 'MasterSpecificPotentialIds' : 'AssistSpecificPotentialIds'] || [])].sort((a, b) => a - b),
      ...[...(characterPotentials?.[isMaster ? 'MasterNormalPotentialIds' : 'AssistNormalPotentialIds'] || [])].sort((a, b) => a - b),
      ...[...(characterPotentials?.CommonPotentialIds || [])].sort((a, b) => a - b),
    ];
    const rank = (id: number) => { const index = order.indexOf(id); return index < 0 ? 100000 : index; };
    let items = '';
    for (const [potId, potBuffs] of [...potGroups].sort(([a], [b]) => rank(a) - rank(b))) {
      if (potBuffs.length === 0) continue;
      const first = potBuffs[0]!;
      const effectiveLevel = first.level || 1;
      const position = (['master', 'assist1', 'assist2'] as const).find(pos => {
        const char = window.state?.party?.[pos];
        return char && typeof char !== 'string' && Number(char.id) === group.charId;
      });
      const badgeBonus = position && potId ? getBadgePotentialBonus(position, potId) : 0;
      const level = effectiveLevel;
      const potName = (first.sourceName || first.name).replace(/^.*-\s*/, '');
      const allEffects = potBuffs.flatMap(b => b.statEffects);
      const effectText = formatStatEffects(allEffects);

      const stepper = potId > 0
        ? (() => {
            const pot = GameData.potentials?.[potId] as any;
            const maxLv = 6 + (pot?.MaxLevel || 0);
            return `<span class="lvl-stepper"><button class="disc-ctrl-btn" data-action="pot-level-down" data-pot-id="${potId}" ${level <= 1 ? 'disabled' : ''}>-</button><span class="lvl-stepper-val">Lv.${level}</span><button class="disc-ctrl-btn" data-action="pot-level-up" data-pot-id="${potId}" ${level >= maxLv ? 'disabled' : ''}>+</button></span>`;
          })()
        : '';

      const iconName = GameData.items?.[potId]?.Icon?.split('/').pop();
      const icon = iconName ? createResponsiveImage(`assets/skill_icons/${iconName}_A.png`, escapeAttribute(potName), 'dmgcalc-potential-icon') : '<i class="fa-solid fa-sparkles" aria-hidden="true"></i>';
      items += `<div class="buff-row dmgcalc-potential-row"><span class="dmgcalc-potential-art">${icon}</span><span class="buff-row-name">${escapeAttribute(potName)}${badgeBonus ? ` <small>배지 +${badgeBonus} · 적용 Lv.${effectiveLevel}</small>` : ''}</span>${stepper}<span class="buff-row-value">${effectText}</span></div>`;
    }

    return `
      <div class="buff-block">
        <div class="buff-block-header">
          <span class="buff-block-title">${group.charName} ${t('potential', '잠재력')}</span>
          <span class="buff-block-count">${potGroups.size}</span>
        </div>
        ${items || `<p class="dmgcalc-help">${t('emptyPotentials', '선택된 잠재력이 없습니다.')}</p>`}
      </div>
    `;
  }).join('');
}

// =============================================================================
// NOTES (소리) — compact 2-column grid
// =============================================================================

export function renderNotesSection(state: DmgCalcState): string {
  const noteOverrides = state.noteOverrides;
  const noteIds = Object.keys(noteOverrides);
  if (noteIds.length === 0) return '';

  const subNoteSkills = GameData.subNoteSkills;
  const effectValues = GameData.effectValue;

  const items = noteIds.map((noteId) => {
    const level = noteOverrides[noteId] || 0;

    const noteKRKey = `SubNoteSkill.${noteId}.1`;
    const noteName = GameData.subNoteSkillsKR?.[noteKRKey]
      || window.discsState?.subNoteSkillKRData?.[noteKRKey]
      || `Note ${noteId}`;

    let effectDesc = '';
    if (subNoteSkills && effectValues) {
      const noteData = subNoteSkills[noteId] as any;
      if (noteData?.Param2) {
        const parts = noteData.Param2.split(',').map((p: string) => p.trim());
        if (parts.length >= 3 && parts[0] === 'Effect' && parts[1] === 'LevelUp') {
          const baseId = parseInt(parts[2], 10);
          if (!isNaN(baseId)) {
            const lookupLevel = level > 0 ? level : 1;
            const actualId = baseId + lookupLevel * 10;
            const effectData = effectValues[actualId] as any;
            if (effectData) {
              const subtype = effectData.EffectTypeFirstSubtype;
              const statKey = subtype !== undefined ? getAttrKeyFromEnumId(subtype) : null;
              if (statKey) {
                const statLabel = getStatDisplayName(statKey);
                if (level === 0) {
                  effectDesc = `<span style="opacity:0.4">${statLabel}</span>`;
                } else {
                  let rawParam = effectData.EffectTypeParam1;
                  rawParam = typeof rawParam === 'string' ? parseFloat(rawParam) : rawParam;
                  if (!isNaN(rawParam) && rawParam !== 0) {
                    const NON_INT_FLOAT_STATS = new Set(['Atk', 'Def', 'Hp', 'WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP']);
                    const secondSub = effectData.EffectTypeSecondSubtype || 0;
                    if (!NON_INT_FLOAT_STATS.has(statKey) || secondSub === 2) {
                      // bIntFloat stat or percentage on flat stat → show as %
                      effectDesc = `+${(rawParam * 100).toFixed(1)}% ${statLabel}`;
                    } else {
                      effectDesc = `+${Math.round(rawParam)} ${statLabel}`;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    return `
      <div class="note-row dmgcalc-note-card ${level > 0 ? 'is-active' : ''}">
        <span class="dmgcalc-note-art">${subNoteSkills?.[noteId]?.Icon ? createResponsiveImage(`assets/common/${subNoteSkills[noteId].Icon.split('/').pop()}_S.png`, escapeAttribute(noteName), 'dmgcalc-note-icon') : '<i class="fa-solid fa-music" aria-hidden="true"></i>'}</span>
        <span class="note-row-name">${escapeAttribute(noteName)}</span>
        <span class="lvl-stepper">
          <button class="disc-ctrl-btn" data-action="note-level-down" data-note-id="${noteId}" ${level <= 0 ? 'disabled' : ''}>-</button>
          <input type="number" class="lvl-stepper-val dmgcalc-note-level ${level === 0 ? 'lvl-zero' : ''}" data-note-id="${noteId}" value="${level}" min="0" max="99" step="1" inputmode="numeric" aria-label="${escapeAttribute(noteName)} 레벨">
          <button class="disc-ctrl-btn" data-action="note-level-up" data-note-id="${noteId}" ${level >= 99 ? 'disabled' : ''}>+</button>
        </span>
        <span class="note-row-effect">${effectDesc}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="buff-block buff-notes-block">
      <div class="buff-block-header">
        <span class="buff-block-title notes-title">${t('notes', '소리 (Notes)')}</span>
        <span class="buff-block-count">${noteIds.length}</span>
      </div>
      <div class="notes-grid">${items}</div>
    </div>
  `;
}

// =============================================================================
// HELPERS
// =============================================================================

interface BuffGroup {
  charId: number;
  charName: string;
  buffs: BuffSource[];
}

function groupBuffsByCharacter(buffs: BuffSource[], includeEmpty = false): [number, BuffGroup][] {
  const map = new Map<number, BuffGroup>();
  for (const buff of buffs) {
    let group = map.get(buff.sourceCharId);
    if (!group) {
      group = { charId: buff.sourceCharId, charName: buff.sourceCharName, buffs: [] };
      map.set(buff.sourceCharId, group);
    }
    group.buffs.push(buff);
  }
  const positions = ['master', 'assist1', 'assist2'] as const;
  const ids = positions.flatMap(position => {
    const char = window.state?.party?.[position];
    if (!char || typeof char === 'string') return [];
    const id = Number(char.id);
    if (includeEmpty && !map.has(id)) map.set(id, { charId: id, charName: getCharacterName(String(id)), buffs: [] });
    return [String(id)];
  });
  const rank = (id: number) => { const index = ids.indexOf(String(id)); return index < 0 ? 100000 : index; };
  return Array.from(map.entries()).sort(([a], [b]) => rank(a) - rank(b));
}

function formatStatEffects(effects: { key: string; value: number; isFlat?: boolean }[]): string {
  if (!effects || effects.length === 0) return '';
  return effects
    .map((e) => {
      const label = getStatDisplayName(e.key);
      if (e.isFlat) {
        const sign = e.value >= 0 ? '+' : '';
        return `${sign}${Math.round(e.value).toLocaleString()} ${label}`;
      }
      const pct = e.value / 100;
      const sign = pct >= 0 ? '+' : '';
      return `${sign}${pct.toFixed(1)}% ${label}`;
    })
    .join(', ');
}
