import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createRecordRules } from '../core/combat-record-rules';
import { addCombatBuff, combatBuffCount, removeCombatBuff, type CombatBuffState } from '../core/combat-buffs';
const rows = JSON.parse(readFileSync('public/data/BuffValue.json', 'utf8'));
const make = () => {
  const rules = createRecordRules({ summer: 6, waves: 2, star: 2, flash: 5, sky: 5, dance: 5, tomorrow: 3, footsteps: 3, sunlight: 1 },
    [{ id: 'main', light: true, job: 'dealer' }, { id: 'hotaru', light: true, job: 'balance' }, { id: 'tilia', light: true, job: 'support' }], 'main');
  let store: CombatBuffState = {};
  const buffs = {
    add(owner: string, id: number, source = owner) { if (!rows[id]) throw new Error(`Missing buff ${id}`); store = addCombatBuff(store, rows[id], owner, source, 0); },
    remove(owner: string, id: number) { store = removeCombatBuff(store, owner, id); },
    count(owner: string, id: number) { return combatBuffCount(store, owner, id, 0); },
  };
  return { rules, buffs };
};
describe('original main record scripts', () => {
  it('gains one wish from each of main trigger, balance application and support application, only once each', () => {
    const { rules, buffs } = make();
    let state = rules.initial(buffs);
    for (let n = 0; n < 2; n++) {
      state = rules.applyLightMark(state, buffs, 'hotaru');
      state = rules.applyLightMark(state, buffs, 'tilia');
      state = rules.triggerLightMark(state, buffs, 'main', true);
    }
    expect(buffs.count('main', 4066000)).toBe(3);
    expect(buffs.count('main', 4066115)).toBe(3);
    expect(buffs.count('main', 4066213)).toBe(3);
    expect(buffs.count('main', 4066022)).toBe(1);
  });
  it('footsteps uses the actual script threshold and stops counting while active', () => {
    const { rules, buffs } = make();
    let state = rules.initial(buffs);
    for (let n = 0; n < 30; n++) state = rules.hit(state, buffs, 'main', 'boss', 2, 2);
    expect(buffs.count('main', 4038203)).toBe(0);
    state = rules.hit(state, buffs, 'main', 'boss', 2, 2);
    expect(buffs.count('main', 4038203)).toBe(1);
    state = rules.hit(state, buffs, 'main', 'boss', 2, 2);
    expect(state.mainSkillHits).toBe(0);
  });
  it('transfers stored refraction to team skill damage on a main skill cast', () => {
    const { rules, buffs } = make();
    let state = rules.initial(buffs);
    for (let n = 0; n < 9; n++) state = rules.hit(state, buffs, 'hotaru', 'boss', 2, 5);
    expect(buffs.count('main', 4039200)).toBe(6);
    rules.cast(state, buffs, 'main', 'skill');
    expect(buffs.count('main', 4039200)).toBe(0);
    expect(buffs.count('hotaru', 4039201)).toBe(6);
    expect(buffs.count('tilia', 4039201)).toBe(6);
  });
  it('summer mark bonuses only trigger during the main ultimate action, not throughout a thirty-second character buff', () => {
    const { rules, buffs } = make();
    let state = rules.initial(buffs);
    state = rules.triggerLightMark(state, buffs, 'main', true);
    expect(buffs.count('main', 4039046)).toBe(0);
    state = rules.cast(state, buffs, 'main', 'ultimate');
    state = rules.triggerLightMark(state, buffs, 'main', true);
    expect(buffs.count('main', 4039046)).toBe(1);
    state = rules.end(state, 'main', 'ultimate');
    rules.triggerLightMark(state, buffs, 'main', true);
    expect(buffs.count('main', 4039046)).toBe(1);
  });
});
