import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveCombatHit } from '../core/combat-hit';
import type { CombatLevelContext } from '../core/rotation-values';
const hits = JSON.parse(readFileSync('public/data/HitDamage.json', 'utf8'));
const context: CombatLevelContext = { characterLevel: 90, ascension: 8, limitBreak: 1,
  potentials: { 516205: 6, 516241: 6 }, skillSlots: { 2: 8, 4: 8, 5: 8 }, concertos: {}, notes: {}, buildLevel: 1 };
describe('resolved original hit coefficients', () => {
  it('normal and main skills use their skill slot, not a potential level', () => {
    expect(resolveCombatHit(hits[162100001], context)).toMatchObject({ percentRaw: 1080000, scalingAttribute: 3, energy: 23500 });
    expect(resolveCombatHit(hits[162310005], context)).toMatchObject({ percentRaw: 520000, scalingAttribute: 3 });
  });
  it('returning swords use their own potential level', () => {
    expect(resolveCombatHit(hits[162310006], context)).toMatchObject({ percentRaw: 630000, scalingAttribute: 3, energy: 0 });
    expect(resolveCombatHit(hits[162400006], context)).toMatchObject({ percentRaw: 1200000 });
  });
  it('light mark uses advancement phase eight even with only one duplicate breakthrough', () => {
    expect(resolveCombatHit(hits[162000001], context)).toMatchObject({ percentRaw: 700000, damageType: 5 });
  });
});
