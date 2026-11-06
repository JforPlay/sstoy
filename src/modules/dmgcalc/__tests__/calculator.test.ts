import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameData } from '../../../shared/game-data';
import { calculateSingleHitDamage } from '../core/calc';
import { getSkillData } from '../core/skills';
import { getState, resetState, setBuildInfo, setNoteLevel, setResult, setStatOverride, setStats, updateEnemy } from '../core/state';
import { renderSkillCards } from '../ui/skill-cards';
import type { AggregatedStat, SkillDamageResult } from '../types';

const json = (name: string) => JSON.parse(readFileSync(new URL(`../../../../public/data/${name}.json`, import.meta.url), 'utf8'));
function stat(key: string, total: number): AggregatedStat {
  return { key, displayName: key, total, calculatedTotal: total, baseValue: total, sources: [] };
}
function setValues(values: Record<string, number>): void {
  setStats(new Map(Object.entries(values).map(([key, value]) => [key, stat(key, value)])));
}
beforeEach(() => {
  resetState(); updateEnemy({ def: 0, res: 0 });
  vi.stubGlobal('window', { state: { party: { master: { id: 103 } }, skillLevels: { master: {} } }, GameData });
});
afterEach(() => vi.unstubAllGlobals());

describe('single-hit arithmetic (current formula)', () => {
  it('uses maximum HP, not ATK, for Seina Origin hits', () => {
    setValues({ Hp: 20000 });
    const hit = { displayName: 'HP hit', skillPercent: 45, skillAbs: 0, damageType: 1, elementType: 5, damageBonusType: 3 };
    expect(calculateSingleHitDamage(hit, 1000, 0, 15000, 1, 1).baseDamage).toBe(9000);
    expect(calculateSingleHitDamage({ ...hit, damageBonusType: 1 }, 1000, 0, 15000, 1, 1).baseDamage).toBe(450);
  });
  const hit = { displayName: 'test', skillPercent: 200, skillAbs: 50, damageType: 1, elementType: 1 };
  it('computes base, critical and expected values with the same units', () => {
    const result = calculateSingleHitDamage(hit, 1000, 5000, 15000, 1, 1);
    expect(result.baseDamage).toBe(2050);
    expect(result.critDamage).toBe(3075);
    expect(result.averageDamage).toBe(2563);
  });
  it('preserves an explicit zero multiplier instead of substituting 100%', () => {
    setValues({ GENDMGRCD: 0 });
    expect(calculateSingleHitDamage(hit, 1000, 0, 15000, 1, 1).baseDamage).toBe(0);
    setValues({ FINALDMG: 0 });
    expect(calculateSingleHitDamage(hit, 1000, 0, 15000, 1, 1).baseDamage).toBe(0);
  });
  it('uses the hit damage category for bonuses and critical damage', () => {
    setValues({ SKILLDMG: 15000, SKILLCRITPOWER: 2500, NORMALDMG: 10000 });
    const result = calculateSingleHitDamage({ ...hit, damageType: 2 }, 1000, 10000, 15000, 1, 1);
    expect(result.baseDamage).toBe(3075);
    expect(result.critDamage).toBe(Math.round(3075 * 1.75));
    expect(result.averageDamage).toBe(result.critDamage);
  });
  it('clamps critical probability to zero through one', () => {
    expect(calculateSingleHitDamage(hit, 1000, -1000, 15000, 1, 1).averageDamage).toBe(2050);
    expect(calculateSingleHitDamage(hit, 1000, 15000, 15000, 1, 1).averageDamage).toBe(3075);
  });
});

describe('build and input state', () => {
  it('clears character-specific overrides and old results on a character switch', () => {
    setBuildInfo(103, 90, { normalAtk: 8, skill: 8, ultimate: 8 });
    setNoteLevel('1', 9); setStatOverride('Atk', 99999);
    getState().potentialLevelOverrides['test'] = 4;
    setResult('normalAtk', { skillName: 'old' } as SkillDamageResult);
    updateEnemy({ def: 400 });
    setBuildInfo(107, 90, { normalAtk: 8, skill: 8, ultimate: 8 });
    expect(getState().statOverrides).toEqual({});
    expect(getState().noteOverrides).toEqual({});
    expect(getState().potentialLevelOverrides).toEqual({});
    expect(getState().results.normalAtk).toBeNull();
    expect(getState().enemy.def).toBe(400);
  });
  it('preserves local adjustments when opening the same character again', () => {
    setBuildInfo(103, 90, { normalAtk: 8, skill: 8, ultimate: 8 });
    setStatOverride('Atk', 4321);
    setBuildInfo(103, 90, { normalAtk: 8, skill: 8, ultimate: 8 });
    expect(getState().statOverrides.Atk).toBe(4321);
  });
  it('rejects non-finite values and negative defense', () => {
    updateEnemy({ def: -200, res: -100, level: NaN });
    setStatOverride('Atk', Infinity);
    expect(getState().enemy).toMatchObject({ def: 0, res: -100, level: 80 });
    expect(getState().statOverrides).toEqual({});
  });
});

describe('real Kohaku data and missing references', () => {
  it('resolves the actual attack damage coefficient for level 8', () => {
    GameData.characters = json('Character'); GameData.skills = json('Skill'); GameData.hitDamage = json('HitDamage');
    const skill = getSkillData(103, 'normalAtk', 8);
    expect(skill?.hitDamages.length).toBeGreaterThan(0);
    for (const hit of skill!.hitDamages) {
      const source = GameData.hitDamage![hit.id] as any;
      const index = source.levelTypeData === 3 ? 7 : 0;
      const raw = Array.isArray(source.SkillPercentAmend) ? source.SkillPercentAmend[Math.min(index, source.SkillPercentAmend.length - 1)] : source.SkillPercentAmend;
      expect(hit.skillPercent).toBe((raw || 0) / 10000);
    }
  });
  it('shows an unresolved state instead of invented damage', () => {
    setResult('skill', { status: 'missing-hit-data', skillName: 'Missing skill', skillIcon: '', skillType: 'skill', skillId: 999, totalBaseDmg: 0, totalCritDmg: 0, totalAvgDmg: 0, hits: [] });
    const html = renderSkillCards(getState());
    expect(html).toContain('Missing skill');
    expect(html).toContain('no estimate is substituted');
    expect(html).not.toContain('Fallback Hit');
  });
});
