import { combatAttributesFromRows } from './combat-base';
import { changeCombatAttributes, readCombatAttribute, type CombatAttributes, type CombatAttributeChange } from './combat-attributes';
import type { RecordRuleBuffs } from './combat-record-rules';
export interface RaidBossProfile {
  levelId: number; monsterId: number; ability: number; switchRate: number;
  base: CombatAttributes; maxLevel: number; modifyGroup: number;
  modifications: Record<number, Record<string, number>>;
  toughness: number; brokenDuration: number; recoverDuration: number; protectDuration: number; brokenBuff: number;
  weakElements?: number[];
}
export interface RaidBossState {
  level: number; hp: number; maxHp: number; attributes: CombatAttributes;
  damage: number; toughness: number; brokenUntil: number; protectedUntil: number;
  markTimes: number[]; lastMarkWindow: number;
}
const modifyTypes: Record<string, number> = { HpFix: 3, AtkFix: 1, ToughnessFix: 42, DefFix: 2,
  WERFix: 11, FERFix: 12, SERFix: 13, AERFix: 14, LERFix: 15, DERFix: 16, ENVAMENDFix: 96 };
function levelAttributes(profile: RaidBossProfile, attributes: CombatAttributes, level: number): CombatAttributes {
  const row = profile.modifications[profile.modifyGroup * 1000 + Math.min(level, profile.maxLevel)];
  if (!row) throw new Error(`Missing boss progression row Lv.${level}`);
  const changes: CombatAttributeChange[] = [];
  for (const [key, type] of Object.entries(modifyTypes)) if (row[key]) changes.push({ type, parameter: 3, value: row[key]! });
  return changeCombatAttributes(attributes, changes);
}
export function createRaidBossState(profile: RaidBossProfile): RaidBossState {
  const attributes = levelAttributes(profile, profile.base, 1);
  const hp = readCombatAttribute(attributes, 3, {}, false);
  if (hp <= 0) throw new Error('Invalid boss HP');
  return { level: 1, hp, maxHp: hp, attributes, damage: 0, toughness: profile.toughness,
    brokenUntil: 0, protectedUntil: 0, markTimes: [], lastMarkWindow: 0 };
}
/** Overkill carries through multiple levels. Each next level adds the table's
 * absolute delta and refills its new maximum HP before carrying the remainder. */
export function damageRaidBoss(original: RaidBossState, profile: RaidBossProfile, damage: number, toughnessRatio: number,
  time: number, buffs: RecordRuleBuffs): RaidBossState {
  if (!Number.isFinite(damage) || damage < 0) throw new Error('Invalid boss damage');
  const state = { ...original, attributes: original.attributes, hp: original.hp - damage, damage: original.damage + damage };
  while (state.hp <= 0) {
    state.level++;
    state.attributes = levelAttributes(profile, state.attributes, state.level);
    state.maxHp = readCombatAttribute(state.attributes, 3, {}, false);
    if (state.maxHp <= 0) throw new Error('Invalid progressed boss HP');
    state.hp += state.maxHp;
  }
  return damageRaidToughness(state,profile,damage*toughnessRatio,time,buffs);
}
/** Direct toughness effects share the same protection/break clock as damage-
 * derived toughness. They never add HP damage or raid damage score. */
export function damageRaidToughness(original:RaidBossState,profile:RaidBossProfile,amount:number,time:number,buffs:RecordRuleBuffs):RaidBossState {
  if(!Number.isFinite(amount)||amount<0) throw new Error('Invalid direct toughness damage');
  const state={...original};
  if (profile.toughness > 0 && time >= state.protectedUntil && time >= state.brokenUntil) {
    state.toughness -= Math.max(0, Math.trunc(amount));
    if (state.toughness <= 0) {
      state.brokenUntil = time + profile.brokenDuration;
      state.protectedUntil = state.brokenUntil + Math.max(profile.recoverDuration, profile.protectDuration);
      buffs.add('boss', profile.brokenBuff, 'boss');
    }
  }
  return state;
}
export function tickRaidBoss(original: RaidBossState, profile: RaidBossProfile, time: number, buffs: RecordRuleBuffs): RaidBossState {
  if (original.brokenUntil > 0 && time >= original.brokenUntil) {
    buffs.remove('boss', profile.brokenBuff);
    return { ...original, brokenUntil: 0, toughness: readCombatAttribute(original.attributes, 42, {}, false) || profile.toughness };
  }
  return original;
}
export function initializeRaidAbility(profile: RaidBossProfile, main: string, buffs: RecordRuleBuffs): void {
  if (profile.ability === 100024) { buffs.add(main, 631025010, main); buffs.add(main, 631025020, main); }
  if (profile.ability === 100025) { buffs.add(main, 631027020, main); buffs.add(main, 631027030, main); }
}
/** DaGuanZi's current-season stack is triggered by the main actor's element
 * mark event, not by every mark-damage hit or by support applications. */
export function raidAbilityMark(profile: RaidBossProfile, main: string, buffs: RecordRuleBuffs): void {
  if (profile.ability === 100025) buffs.add('boss', 631027010, main);
}
export function raidAbilityCast(profile: RaidBossProfile, mainUltimate: boolean, main: string, buffs: RecordRuleBuffs): void {
  if (profile.ability === 100023 && mainUltimate) { buffs.add('boss', 631025040, main); buffs.add('boss', 631025050, main); }
}
export function raidAbilityHit(original: RaidBossState, profile: RaidBossProfile, damageType: number, time: number, buffs: RecordRuleBuffs): RaidBossState {
  if (profile.ability === 100026) {
    if (damageType === 3) buffs.add('boss', 631028010, 'boss');
    else if (damageType === 2) buffs.add('boss', 631028020, 'boss');
  }
  if (profile.ability !== 100024 || damageType !== 5 || (original.lastMarkWindow > 0 && time - original.lastMarkWindow <= 15)) return original;
  const times = [...original.markTimes, time].filter(value => value >= time - 5);
  if (times.length < 3) return { ...original, markTimes: times };
  buffs.add('boss', 631025030, 'boss');
  return { ...original, markTimes: [], lastMarkWindow: time };
}
/** Resolve the exact raid template and adjustment. No assumptions about names
 * or images are involved in choosing combat stats. */
export function raidBossProfile(levelId: number, tables: Record<string, any>, rules: Record<string, number>): RaidBossProfile {
  const level = tables.levels[levelId];
  const monster = tables.monsters[level?.MonsterId];
  const adjust = tables.adjustments[monster?.Templete];
  const template = Object.values(tables.templates).filter((row: any) => row.TemplateId === adjust?.TemplateId).sort((a: any, b: any) => a.Lv - b.Lv)[0] as Record<string, number> | undefined;
  const contact = tables.contacts[monster?.Id];
  const score = tables.scoreSwitches[level?.ScoreGetSwitchGroup * 1000 + 1];
  if (!level || !monster || !adjust || !template || !contact || !score) throw new Error(`Incomplete raid profile ${levelId}`);
  const row: Record<string, number | undefined> = { ...template, ToughnessMax: template.Toughness };
  for (const key of ['Hp', 'Atk', 'WER', 'FER', 'SER', 'AER', 'LER', 'DER']) row[key] = (template[key] ?? 0) * (1 + (adjust[`${key}Ratio`] ?? 0) / 10000) + (adjust[`${key}Fix`] ?? 0);
  return { levelId, monsterId: monster.Id, ability: level.ScoreBossAbility, switchRate: score.SwitchRate,
    base: combatAttributesFromRows([row]), maxLevel: contact.MaxLevel, modifyGroup: contact.GroupId, modifications: tables.modifications,
    toughness: template.Toughness ?? 0, weakElements: adjust.WeakEET ?? [], brokenDuration: monster.ToughnessBrokenTime / 10000,
    recoverDuration: rules.ToughnessBroken_RecoverTime!, protectDuration: rules.ToughnessProtectTime!, brokenBuff: rules.ToughnessBrokenState_BuffId! };
}
