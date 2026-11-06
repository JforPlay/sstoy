import { GameData } from '@/shared/game-data';
import { getAttrKeyFromEnumId } from './enums';
import { getState } from './state';
import type { StatSource } from '../types';
import { PHASE_TO_LEVEL } from '../constants';

export interface BadgeAttribute {
  Id: number;
  TypeId: number;
  AttrType: number;
  AttrTypeFirstSubtype?: number;
  AttrTypeSecondSubtype?: number;
  Value: string;
  Rarity: number;
  Level: number;
  OverlockCount?: number;
  Tag?: number;
}

const POSITIONS = ['master', 'assist1', 'assist2'] as const;
export function getBadgeOwner(slot: number) {
  return POSITIONS[Math.floor(slot / 3)]!;
}
export function getBadgeOwnerLevel(slot: number): number {
  const position = getBadgeOwner(slot);
  if (position === 'master') return getState().masterLevel;
  const phase = window.state?.characterLevelPhase?.[position] ?? 8;
  return phase >= 8 ? 90 : PHASE_TO_LEVEL[phase] ?? 1;
}
export function getBadgePotentialId(row: BadgeAttribute, slot: number): number | undefined {
  if (row.AttrType !== 99) return;
  const position = getBadgeOwner(slot);
  const char = window.state?.party?.[position];
  if (!char || typeof char === 'string') return;
  const pools = GameData.charPotentials?.[Number(char.id)];
  if (!pools) return;
  const ids = [...(pools[position === 'master' ? 'MasterNormalPotentialIds' : 'AssistNormalPotentialIds'] || []), ...(pools.CommonPotentialIds || [])];
  return ids.find(id => id % 100 === row.AttrTypeFirstSubtype);
}
export function getBadgeSkillBonus(position: typeof POSITIONS[number], subtype: number): number {
  const slot = POSITIONS.indexOf(position) * 3 + 1;
  if (getBadgeOwnerLevel(slot) < getBadgeUnlockLevel(slot)) return 0;
  return getState().badgeOptions[slot]!.reduce((sum, id) => {
    const row = GameData.charGemAttrValue[String(id)] as BadgeAttribute | undefined;
    return sum + (row?.AttrType === 7 && row.AttrTypeFirstSubtype === subtype ? Number(row.Value) : 0);
  }, 0);
}
export function getBadgePotentialBonus(position: typeof POSITIONS[number], potentialId: number): number {
  const slot = POSITIONS.indexOf(position) * 3 + 2;
  if (getBadgeOwnerLevel(slot) < getBadgeUnlockLevel(slot)) return 0;
  return getState().badgeOptions[slot]!.reduce((sum, id) => {
    const row = GameData.charGemAttrValue[String(id)] as BadgeAttribute | undefined;
    return sum + (row && getBadgePotentialId(row, slot) === potentialId ? Number(row.Value) : 0);
  }, 0);
}

/** Presets store the total level: levels above six belong to the owner's 90 badge. */
export function setPotentialTotalLevel(position: typeof POSITIONS[number], potentialId: number, total: number): boolean {
  const state = getState();
  const slot = POSITIONS.indexOf(position) * 3 + 2;
  const options = state.badgeOptions[slot]!;
  const level = Math.max(1, Math.min(9, total));
  const bonus = Math.max(0, level - 6);
  const matches = options.map((id, index) => {
    const row = GameData.charGemAttrValue[String(id)] as BadgeAttribute | undefined;
    return row && getBadgePotentialId(row, slot) === potentialId ? index : -1;
  }).filter(index => index >= 0);
  if (bonus) {
    const row = (Object.values(GameData.charGemAttrValue) as BadgeAttribute[]).find(row => row.AttrType === 99 && Number(row.Value) === bonus && getBadgePotentialId(row, slot) === potentialId);
    const index = matches[0] ?? options.findIndex(id => !id);
    if (!row || index < 0) return false;
    matches.forEach(index => { options[index] = 0; });
    options[index] = row.Id;
  } else matches.forEach(index => { options[index] = 0; });
  state.potentialLevelOverrides[potentialId] = Math.min(6, level);
  return true;
}

const FLAT_STATS = new Set(['Atk', 'Def', 'Hp', 'Penetrate', 'WEP', 'FEP', 'SEP', 'AEP', 'LEP', 'DEP']);

/** SP recovery is EffectType 37, not an EAT damage attribute. Keep it in its
 * own channel so it is selectable without being mistaken for toughness/HP. */
export function decodeBadgeSp(row: BadgeAttribute): { main: boolean; value: number } | null {
  const subtype = row.AttrTypeFirstSubtype ?? 0;
  const value = Number(row.Value);
  return row.AttrType === 37 && [0, 1].includes(subtype) && row.AttrTypeSecondSubtype === 1 && Number.isFinite(value)
    ? { main: subtype === 1, value } : null;
}

export function getBadgeSpBonus(position: typeof POSITIONS[number], main: boolean): number {
  const start = POSITIONS.indexOf(position) * 3;
  return getState().badgeOptions.slice(start, start + 3).reduce((sum, options, index) => {
    if (getBadgeOwnerLevel(start + index) < getBadgeUnlockLevel(start + index)) return sum;
    return sum + options.reduce((value, id) => {
      const row = GameData.charGemAttrValue[String(id)] as BadgeAttribute | undefined;
      const sp = row && decodeBadgeSp(row);
      return value + (sp && sp.main === main ? sp.value : 0);
    }, 0);
  }, 0);
}

/** Only attribute effects with a known target and unit are applied. */
export function decodeBadgeAttribute(row: BadgeAttribute): { key: string; value: number; isPercentage: boolean } | null {
  if (row.AttrType !== 12 || ![1, 2].includes(row.AttrTypeSecondSubtype ?? 0)) return null;
  const key = getAttrKeyFromEnumId(row.AttrTypeFirstSubtype ?? -1);
  const raw = Number(row.Value);
  if (!key || !Number.isFinite(raw)) return null;
  const isFlat = FLAT_STATS.has(key);
  // Subtype 2 is a percentage modifier, only supported for flat attributes.
  if (!isFlat && row.AttrTypeSecondSubtype !== 1) return null;
  return { key, value: isFlat && row.AttrTypeSecondSubtype === 1 ? raw : Math.round(raw * 10000), isPercentage: isFlat && row.AttrTypeSecondSubtype === 2 };
}

export function badgeGroupKey(row: BadgeAttribute): string {
  return `${row.AttrType}:${row.AttrTypeFirstSubtype}:${row.AttrTypeSecondSubtype}`;
}

export function getBadgeGroups(slot?: number): Map<string, BadgeAttribute[]> {
  const groups = new Map<string, BadgeAttribute[]>();
  for (const row of Object.values(GameData.charGemAttrValue) as BadgeAttribute[]) {
    const skill = row.AttrType === 7 && [1, 2, 3, 4].includes(row.AttrTypeFirstSubtype ?? 0);
    const potential = row.AttrType === 99 && slot !== undefined && getBadgePotentialId(row, slot) !== undefined;
    if (!decodeBadgeAttribute(row) && !decodeBadgeSp(row) && !skill && !potential) continue;
    if (slot !== undefined && ((skill && slot % 3 !== 1) || (potential && slot % 3 !== 2))) continue;
    const key = badgeGroupKey(row);
    const rows = groups.get(key) ?? [];
    // Different badge pools repeat identical options; keep their original IDs,
    // but avoid duplicate choices for the same value/rarity/overlock count.
    if (!rows.some(r => r.Value === row.Value && r.Rarity === row.Rarity && r.OverlockCount === row.OverlockCount)) rows.push(row);
    groups.set(key, rows);
  }
  return groups;
}

export function getBadgeUnlockLevel(slot: number): number {
  return GameData.charGemSlotControl[String(slot % 3 + 1)]?.UnlockLevel ?? [70, 80, 90][slot % 3] ?? 90;
}

export function setBadgeOption(slot: number, index: number, id: number): boolean {
  const state = getState();
  const options = state.badgeOptions[slot];
  const row = GameData.charGemAttrValue[String(id)] as BadgeAttribute | undefined;
  if (!options || !Number.isInteger(index) || index < 0 || index >= 4 || getBadgeOwnerLevel(slot) < getBadgeUnlockLevel(slot)) return false;
  if (!row || !getBadgeGroups(slot).get(badgeGroupKey(row))?.some(value => value.Id === id || (value.Value === row.Value && value.Rarity === row.Rarity))) return false;
  options[index] = id;
  return true;
}

export function getBadgeStatSources(): { key: string; source: StatSource }[] {
  const state = getState();
  return state.badgeOptions.slice(0, 3).flatMap((ids, slot) => {
    if (state.masterLevel < getBadgeUnlockLevel(slot)) return [];
    return ids.flatMap(id => {
      const row = GameData.charGemAttrValue[String(id)] as BadgeAttribute | undefined;
      const decoded = row ? decodeBadgeAttribute(row) : null;
      if (!decoded) return [];
      const label = window.i18n?.t('dmgcalc.badges') || '배지';
      return [{ key: decoded.key, source: { name: `${label} ${slot + 1} · #${id}`, value: decoded.value, isPercentage: decoded.isPercentage, active: true } }];
    });
  });
}
