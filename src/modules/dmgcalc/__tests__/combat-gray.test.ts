import { describe, expect, it } from 'vitest';
import { createGraySupportRules, type GrayApi } from '../core/combat-gray';
import { combatTagHash } from '../core/combat-tags';

function context() {
  const buffs = new Map<string, number>(), areas: string[] = [];
  const api: GrayApi = { actor: '149', time: 0, distance: 2, earthActors: 2,
    parameter: () => 50, area: name => { areas.push(name); },
    buffs: { add(owner, id) { const key = `${owner}:${id}`; buffs.set(key, (buffs.get(key) ?? 0) + 1); },
      remove(owner, id) { buffs.delete(`${owner}:${id}`); }, count(owner, id) { return buffs.get(`${owner}:${id}`) ?? 0; } } };
  return { api, buffs, areas };
}
describe('Gray shared and support scripts', () => {
  it('preserves all five breakthrough conditions including the strict one-second interval', () => {
    const { api, buffs } = context(), rules = createGraySupportRules({}, 5);
    let state = rules.initialize(api);
    state = rules.afterHit(state, api, [combatTagHash('149_Skill')]);
    expect(buffs.get('149:14996111')).toBe(1);
    api.time = 1;
    state = rules.afterHit(state, api, [combatTagHash('149_Skill')]);
    expect(buffs.get('149:14996111')).toBe(1);
    api.time = 1.01;
    state = rules.afterHit(state, api, [combatTagHash('149_Skill'), combatTagHash('149_Ultra')]);
    expect(buffs.get('149:14996111')).toBe(2);
    expect(buffs.get('149:14996311')).toBe(1);
    rules.ownEarthMarkTriggered(api);
    rules.earthBuffAdded(api);
    expect(buffs.get('149:14996211')).toBe(1);
    expect(buffs.get('149:14996411')).toBe(1);
    expect(rules.beforeHit(state, api, [], 1)).toEqual([{ id: 14996511, count: 1 }]);
  });
  it('uses six loops, three separate ground areas and main-party cast triggers', () => {
    const { api, areas, buffs } = context(), rules = createGraySupportRules({514921:1,514923:1,514925:6,514928:6,514930:6,514932:6,514933:6}, 0);
    let state = rules.initialize(api);
    expect(buffs.get('149:14933011')).toBe(2);
    expect(rules.skillTag).toBe('149_B2P21P23');
    expect(rules.loopCount).toBe(6);
    api.time = 3;
    state = rules.cast(state, api, '149', 'skill');
    rules.cast(state, api, '162', 'skill');
    expect(buffs.get('149:14925011')).toBe(1);
    expect(buffs.get('149:14932011')).toBe(1);
    api.time = 6.9;
    expect(rules.beforeHit(state, api, [combatTagHash('149_B2')], 1)).toEqual([{ id:14928001, count:3 }]);
    rules.custom(api, '149_Earthquake_Enemy');
    expect(areas).toEqual(Array(3).fill('AreaEffect_14901_B2P30_Skill_Earthquake'));
  });
  it('only schedules chain end hits on natural expiration and does not stack an already present second chain', () => {
    const { api, buffs } = context(), rules = createGraySupportRules({514927:6}, 0);
    const state = rules.initialize(api), tags = [combatTagHash('149_B2_Chain')];
    for (let i = 0; i < 4; i++) rules.afterHit(state, api, tags);
    expect(buffs.get('boss:14927011')).toBe(1);
    expect(buffs.get('boss:14927012')).toBe(1);
    expect(rules.naturalExpiryHit(14927011)).toBe(149327101);
    expect(rules.naturalExpiryHit(1011)).toBeNull();
  });
});
