import { describe, expect, it } from 'vitest';
import { planKasimiraSupportVolley, createKasimiraSharedRules, createKasimiraSupportRules, type KasimiraSupportApi } from '../core/combat-kasimira';
import { combatTagHash } from '../core/combat-tags';
describe('Kasimira support launch coroutine', () => {
  it('preserves the five breakthrough event conditions, probability and strict cooldown boundary', () => {
    const added: [string, number][] = [], removed: number[] = [];
    let roll = 20;
    const api: KasimiraSupportApi = { actor: '108', time: 1, parameter: id => id === 10896411 ? 2 : 30, randomPercent: () => roll,
      buffs: { add(actor, id) { added.push([actor, id]); }, remove(_actor, id) { removed.push(id); }, count() { return 0; } },
      resetSupportCooldown() {}, area() {}, deathExplosion() {} };
    const rules = createKasimiraSharedRules({}, 5, ['108', 'main', 'support']);
    let state = rules.initial();
    rules.afterSelfHit(state, api, [combatTagHash('108_Ultra')]);
    expect(added.filter(([, id]) => id === 10896111)).toHaveLength(3);
    expect(added.filter(([, id]) => id === 10896311)).toHaveLength(3);
    expect(rules.beforeSelfHit(api,[combatTagHash('108_Skill')])).toEqual([]);
    api.buffs.count=()=>1;
    expect(rules.beforeSelfHit(api,[combatTagHash('108_Skill')])).toEqual([10896211]);
    roll = 99;
    const before = added.length;
    state = rules.afterSelfHit(state, api, [combatTagHash('108_Skill')]);
    expect(added.length).toBe(before + 1);
    api.time = 3;
    rules.afterSelfHit(state, api, [combatTagHash('108_Skill')]);
    expect(added.length).toBe(before + 1);
    api.time = 3.01;
    rules.afterSelfHit(state, api, [combatTagHash('108_Skill')]);
    expect(added.length).toBe(before + 2);
    rules.otherActorUltimate(api);
    expect(added.at(-1)).toEqual(['108', 10896511]);
    rules.ownUltimateEnd(api);
    expect(removed).toEqual([10896511]);
  });
  it('does not turn probability-based cooldown resets into guaranteed resets', () => {
    let resets = 0, roll = 51;
    const api: KasimiraSupportApi = { actor: '108', time: 1, parameter: () => 50, randomPercent: () => roll,
      buffs: { add() {}, remove() {}, count() { return 0; } }, resetSupportCooldown() { resets++; }, area() {}, deathExplosion() {} };
    const rules = createKasimiraSupportRules({ 510828: 6 }, combatTagHash('108_Ultra'));
    rules.cast(rules.initial(), api);
    expect(resets).toBe(0);
    roll = 50;
    rules.cast(rules.initial(), api);
    expect(resets).toBe(1);
  });
  it('launches the base three shots, retaining their spread instead of assuming direct hits', () => {
    const shots = planKasimiraSupportVolley({}, 0, 50);
    expect(shots.map(shot => shot.time)).toEqual([0, .1, .2]);
    expect(shots.map(shot => shot.offset)).toEqual([[0, 0], [-2, 0], [2, 0]]);
    expect(shots.every(shot => shot.randomRadius === 2)).toBe(true);
  });
  it('waits a full second AFTER the first volley ends before the probabilistic second volley', () => {
    const shots = planKasimiraSupportVolley({ 510822: 1, 510829: 6 }, 50, 50);
    expect(shots).toHaveLength(10);
    expect(shots[4]!.time).toBe(.4);
    expect(shots[5]!.time).toBe(1.4);
    expect(planKasimiraSupportVolley({ 510829: 6 }, 50, 51)).toHaveLength(3);
  });
  it('P24 cycles actual target positions without the normal random spread', () => {
    const shots = planKasimiraSupportVolley({ 510822: 1, 510824: 1 }, 0, 50, 2);
    expect(shots.map(shot => shot.targetIndex)).toEqual([0, 1, 0, 1, 0]);
    expect(shots.every(shot => shot.randomRadius === 0)).toBe(true);
  });
});
