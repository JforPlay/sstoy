import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareCombatBuild } from '../core/combat-build';
const read = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const tables = { characters: read('Character'), attributes: read('Attribute'), discs: read('Disc'), discExtra: read('DiscExtraAttribute'),
  potentialPools: read('CharPotential'), potentials: read('Potential'), secondarySkills: read('SecondarySkill'), notes: read('SubNoteSkill'),
  ranks: read('StarTowerBuildRank'), effects: read('Effect'), effectValues: read('EffectValue'), talentGroups: read('TalentGroup'), talents: read('Talent') };
const example = JSON.parse(readFileSync('public/guides/rotation-example.json', 'utf8'));
describe('confirmed example setup', () => {
  it('uses exactly the minimum notes for concertos 555331 and no badges', () => {
    const build = prepareCombatBuild(example, tables);
    expect(build.notes).toEqual({ 90012: 45, 90015: 15, 90016: 70, 90017: 15, 90022: 70 });
    expect(build.badgeOptions.flat()).toEqual(Array(36).fill(0));
    expect(build.actors.map(actor => actor.id)).toEqual([162, 115, 107]);
    expect(build.actors.map(actor => actor.context.limitBreak)).toEqual([1, 0, 0]);
    expect(build.actors[0]!.context.potentials[516243]).toBe(6);
    expect(build.actors[1]!.context.potentials[511533]).toBe(6);
    expect(build.duration).toBe(180);
    expect(build.actors[0]!.base.attributes[3]!.origin).toBeGreaterThan(94662);
  });
  it('preserves record order and keeps selected concertos keyed by name/group, not disc slot', () => {
    const build = prepareCombatBuild(example, tables);
    expect(build.actors[0]!.context.concertos).toEqual({ 40661: 5, 40391: 5, 40381: 5, 40662: 3, 40382: 3, 40392: 1 });
    expect(example.records.map((record: any) => record.limitBreak)).toEqual([5, 1, 1, 1, 1, 1]);
  });
});
