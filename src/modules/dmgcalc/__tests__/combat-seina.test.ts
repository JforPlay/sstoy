import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createSeinaRules, type SeinaScriptApi } from '../core/combat-seina';
import { combatTagHash } from '../core/combat-tags';
import { addCombatBuff, combatBuffCount, removeCombatBuff, type CombatBuffState } from '../core/combat-buffs';
const rows = JSON.parse(readFileSync('public/data/BuffValue.json', 'utf8'));
const make = () => {
  const rules = createSeinaRules({ 516201: 1, 516202: 1, 516205: 6, 516206: 6, 516207: 6, 516211: 3, 516212: 6, 516241: 6, 516243: 6 }, 1, 3012);
  let store: CombatBuffState = {};
  const swords: number[] = [], regen: number[] = [];
  const api: SeinaScriptApi = { time: 0, actor: 'main', balanceActors: ['hotaru'], lightActorCount: 3,
    parameter: id => id === 16202011 ? 8 : id === 16201011 ? 29.375 : 0,
    sword: id => { swords.push(id); }, area() {}, startBurstRegen: generation => { regen.push(generation); },
    buffs: {
      add(owner, id, source = owner) { store = addCombatBuff(store, rows[id], owner, source, api.time); },
      remove(owner, id) { store = removeCombatBuff(store, owner, id); },
      count(owner, id) { return combatBuffCount(store, owner, id, api.time); },
    },
  };
  return { rules, api, swords, regen };
};
describe('selected Seina origin scripts', () => {
  it('keeps the mark-triggered sword cooldown separate from the skill event', () => {
    const {api}=make();
    api.parameter=()=>5;
    const rules=createSeinaRules({516203:1},0,3012);
    const areas:string[]=[];
    api.area=name=>{areas.push(name);};
    let state=rules.initialize(api);
    state=rules.onMarkSword(state,api);
    api.time=5;
    state=rules.onMarkSword(state,api);
    rules.custom(api,'162P3','162:skill');
    expect(areas).toHaveLength(2);
    api.time=5.1;
    rules.onMarkSword(state,api);
    expect(areas).toHaveLength(3);
  });
  it('places the P42 ultimate area five units forward only with the potential enabled', () => {
    const { api } = make();
    const areas: [string, number | undefined][] = [];
    api.area = (name, offset) => { areas.push([name, offset]); };
    createSeinaRules({}, 0, 3012).custom(api, '162P42ZhongJianArea');
    expect(areas).toEqual([]);
    createSeinaRules({516242: 1}, 0, 3012).custom(api, '162P42ZhongJianArea');
    expect(areas).toEqual([['AreaEffect_162_LeiDianArea_P42', 5]]);
  });
  it('applies all five breakthrough branches with their actual hit/HP conditions', () => {
    const { api } = make();
    const rules = createSeinaRules({}, 5, 3012);
    rules.initialize(api);
    expect(api.buffs.count('main', 16296211)).toBe(1);
    api.buffs.add('boss', 3012, 'main');
    const ids = rules.beforeHit(api, [combatTagHash('QingSuper'), combatTagHash('QingAndQi')], .2).map(row => row.id);
    expect(ids).toEqual([16296211, 16296311, 16296511]);
    expect(rules.beforeHit(api, [combatTagHash('Zhong')], .19).map(row => row.id)).not.toContain(16296521);
    expect(rules.beforeHit(api, [combatTagHash('Zhong')], .2).map(row => row.id)).toContain(16296521);
    rules.onMarkTrigger(api);
    expect(api.buffs.count('main', 16296411)).toBe(1);
    api.time = 8;
    expect(api.buffs.count('main', 16296411)).toBe(0);
    const zero = createSeinaRules({}, 0, 3012);
    expect(zero.beforeHit(api, [combatTagHash('QingSuper'), combatTagHash('QingAndQi')])).toEqual([]);
  });
  it('waits for the rapier segment to finish before binding the earned extra skill', () => {
    const { rules, api, swords } = make();
    let state = rules.initialize(api);
    state = rules.cast(state, api, 'main', 2.7);
    for (let n = 0; n < 17; n++) rules.custom(api, '162SkillMainJianQi');
    expect(swords).toHaveLength(17);
    expect(rules.tick(state, api, 17, 10).extraBoundAt).toBeNull();
    api.time = 2.7;
    state = rules.tick(state, api, 17, 10);
    expect(state.extraBoundAt).toBe(2.7);
    state = rules.cast(state, api, 'extra');
    expect(state.form).toBe('rapier');
    expect(api.buffs.count('main', 16202011)).toBe(0);
    expect(rules.cast(state, api, 'ultimate').form).toBe('claymore');
  });
  it('first damage activates thirty-second burst once, while ultimate refresh restarts the SP coroutine', () => {
    const { rules, api, regen } = make();
    let state = rules.initialize(api);
    state = rules.afterHit(state, api, []);
    expect(api.buffs.count('main', 16243011)).toBe(1);
    state = rules.afterHit(state, api, []);
    expect(regen).toEqual([1]);
    state = rules.cast(state, api, 'ultimate');
    expect(regen).toEqual([1, 2]);
    expect(state.burstGeneration).toBe(2);
  });
  it('conditional attributes are per-hit and depend on the target glimmer stacks', () => {
    const { rules, api } = make();
    expect(rules.beforeHit(api, [-460925555])).toEqual([{ id: 16205001, count: 1 }]);
    api.buffs.add('boss', 3012, 'main');
    api.buffs.add('boss', 3012, 'main');
    expect(rules.beforeHit(api, [1014643206, -460925555])).toEqual([
      { id: 16290001, count: 2 }, { id: 16205001, count: 1 }, { id: 16206001, count: 1 }, { id: 16211001, count: 1 },
    ]);
    expect(rules.returningSword()).toBe(162310006);
  });
});
