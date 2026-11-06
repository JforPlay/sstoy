import { getEnumIdFromAttrKey } from './enums';
import type { CombatAttributes } from './combat-attributes';
import {DISC_MAX_LIMIT_BREAK} from '../constants';
export interface CombatRecordSelection { id: number; level: number; limitBreak: number }
export interface CombatBaseTables {
  characters: Record<number, { AttributeId: string; Ammo?:number; EET?: number; Class?: number; Faction?: number; UltimateId?: number; AssistUltimateId?: number }>;
  attributes: Record<string, Record<string, unknown>>;
  discs: Record<number, { AttrBaseGroupId: number; AttrExtraGroupId: number }>;
  discExtra: Record<string, Record<string, unknown>>;
}
const flat = new Set([1, 2, 3, 9, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 41, 42, 44, 50, 52, 54]);
export function combatAttributesFromRows(rows: Record<string, unknown>[]): CombatAttributes {
  const totals: Record<number, number> = {};
  for (const row of rows) for (const [key, value] of Object.entries(row)) {
    const type = getEnumIdFromAttrKey(key);
    if (type !== null && typeof value === 'number') totals[type] = (totals[type] ?? 0) + value;
  }
  const result: CombatAttributes = {};
  const defaults = [41, 46, 47, 48, 43, 49, 51, 53, 56, 57, 58, 59, 60, 61, 62, 63,
    64, 65, 66, 67, 68, 69, 35, 36, 37, 38, 39, 40, 86, 87, 88, 96];
  for (const type of defaults) result[type] = { origin: 1, base: 0, percent: 0, absolute: 0 };
  for (const [id, value] of Object.entries(totals)) {
    const type = Number(id);
    result[type] = { origin: value / (flat.has(type) ? 1 : 10000), base: 0, percent: 0, absolute: 0 };
  }
  return result;
}
/** CalCharacterAttrBattle sums all six discs, including their breakthrough
 * attribute rows, into each actor's own base row. No potential/temporary buff
 * is included here; those are owned timed effects at runtime. */
export function createBaseCombatAttributes(characterId: number, level: number, ascension: number,
  records: CombatRecordSelection[], tables: CombatBaseTables, buildAttribute?: Record<string, unknown>): CombatAttributes {
  const character = tables.characters[characterId];
  if (!character) throw new Error(`Unknown character ${characterId}`);
  const attributeId = `${character.AttributeId}${String(ascension * 1000 + level).padStart(5, '0')}`;
  const row = tables.attributes[attributeId];
  if (!row) throw new Error(`Missing character attribute ${attributeId}`);
  const totals: Record<string, number> = {};
  const add = (row: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(row)) {
      if (getEnumIdFromAttrKey(key) !== null && typeof value === 'number') totals[key] = (totals[key] ?? 0) + value;
    }
  };
  add(row);
  for (const selection of records) {
    if(!Number.isInteger(selection.limitBreak)||selection.limitBreak<0||selection.limitBreak>DISC_MAX_LIMIT_BREAK)
      throw new Error(`레코드 ${selection.id}의 돌파는 0~${DISC_MAX_LIMIT_BREAK} 사이여야 합니다.`);
    const disc = tables.discs[selection.id];
    if (!disc) throw new Error(`Unknown record ${selection.id}`);
    const phase = Math.min(8, Math.floor(selection.level / 10));
    const attrId = String(disc.AttrBaseGroupId * 1000 + phase * 100 + selection.level);
    const attr = tables.attributes[attrId];
    if (!attr) throw new Error(`Missing record attribute ${attrId}`);
    add(attr);
    if (selection.limitBreak > 0 && disc.AttrExtraGroupId > 0) {
      const extraId = String(disc.AttrExtraGroupId * 10 + selection.limitBreak);
      const extra = tables.discExtra[extraId];
      if (!extra) throw new Error(`Missing record breakthrough attribute ${extraId}`);
      add(extra);
    }
  }
  if (buildAttribute) add(buildAttribute);
  return combatAttributesFromRows([totals]);
}
