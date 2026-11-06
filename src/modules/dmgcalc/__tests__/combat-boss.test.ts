import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRaidBossState, damageRaidBoss, raidAbilityHit, raidBossProfile, raidAbilityMark, initializeRaidAbility } from '../core/combat-boss';
import { readCombatAttribute } from '../core/combat-attributes';
const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const tables = { levels: read('ScoreBossLevel'), monsters: read('Monster'), adjustments: read('MonsterValueTempleteAdjust'), templates: read('MonsterValueTemplete'),
  contacts: read('MonsterAttributeContact'), modifications: read('MonsterValueTempleteModify'), scoreSwitches: read('ScoreGetSwitch') };
const rules = read('CombatTimings').rules;
const emptyBuffs = { add() {}, remove() {}, count() { return 0; } };
describe('example raid boss profiles', () => {
  it('uses November conversion and dispatches the two new season mechanics', () => {
    const baron = raidBossProfile(28, tables, rules), beauty = raidBossProfile(29, tables, rules);
    expect(baron.switchRate).toBe(27000);
    expect(beauty.switchRate).toBe(27000);
    const added: number[] = [];
    const buffs = { ...emptyBuffs, add(_owner: string, id: number) { added.push(id); } };
    initializeRaidAbility(baron, '162', buffs);
    expect(added).toEqual([631027020, 631027030]);
    raidAbilityMark(baron, '162', buffs);
    expect(added.at(-1)).toBe(631027010);
    raidAbilityHit(createRaidBossState(beauty), beauty, 3, 1, buffs);
    expect(added.at(-1)).toBe(631028010);
    raidAbilityHit(createRaidBossState(beauty), beauty, 2, 2, buffs);
    expect(added.at(-1)).toBe(631028020);
  });
  it('resolves the two distinct resistance profiles and real score conversion', () => {
    const crab = raidBossProfile(26, tables, rules), shark = raidBossProfile(27, tables, rules);
    expect(readCombatAttribute(crab.base, 15, {}, false)).toBe(750);
    expect(readCombatAttribute(shark.base, 15, {}, false)).toBe(250);
    expect(crab.switchRate).toBe(25000);
    expect(shark.ability).toBe(100024);
  });
  it('carries a single overkill hit through multiple growing HP bars without discarding damage', () => {
    const profile = raidBossProfile(27, tables, rules);
    const original = createRaidBossState(profile);
    const amount = 2111509 + 2322660 + 100;
    const state = damageRaidBoss(original, profile, amount, 1, 0, emptyBuffs);
    expect(state.level).toBe(3);
    expect(state.maxHp).toBe(2533811);
    expect(state.hp).toBe(2533711);
    expect(state.damage).toBe(amount);
    expect(original.level).toBe(1);
  });
  it('shark debuff needs three mark hits within five seconds and has a strict fifteen-second cooldown', () => {
    const profile = raidBossProfile(27, tables, rules);
    const added: number[] = [];
    const buffs = { ...emptyBuffs, add(_owner: string, id: number) { added.push(id); } };
    let state = createRaidBossState(profile);
    for (const time of [1, 3, 5]) state = raidAbilityHit(state, profile, 5, time, buffs);
    expect(added).toEqual([631025030]);
    for (const time of [6, 7, 8, 20]) state = raidAbilityHit(state, profile, 5, time, buffs);
    expect(added).toHaveLength(1);
    for (const time of [20.01, 21, 22]) state = raidAbilityHit(state, profile, 5, time, buffs);
    expect(added).toHaveLength(2);
  });
});
