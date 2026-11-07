import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadExampleCombatTables } from '../core/combat-data';
import { prepareCombatBuild } from '../core/combat-build';
import { prepareLiveCombatBuild, type LiveCombatInput } from '../core/combat-live-build';
import { createExampleCombatModel } from '../core/combat-example-model';
import { evaluateCombatPolicies } from '../core/combat-policy-search';
import { readCombatAttribute } from '../core/combat-attributes';
const read = async (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const fixture = JSON.parse(readFileSync('public/guides/rotation-example.json', 'utf8'));
const tables = await loadExampleCombatTables(read);
const baseline = prepareCombatBuild(fixture, tables);
const input = (): LiveCombatInput => ({ actors: baseline.actors.map(actor => ({ id: actor.id, level: actor.context.characterLevel,
  ascension: actor.context.ascension, limitBreak: actor.context.limitBreak, potentials: { ...actor.context.potentials }, skillSlots: { ...actor.context.skillSlots } })),
  records: structuredClone(fixture.records), notes: { ...baseline.notes }, badgeOptions: Array.from({ length: 9 }, () => [0, 0, 0, 0]) });
describe('live calculator input, not a fixed fixture', () => {
  it.each([0,1,2,3,4,5])('runs all Seina origin main potentials at close range and breakthrough %s',limitBreak=>{
    const live=input(),actor=live.actors[0]!;
    actor.limitBreak=limitBreak;
    actor.potentials=Object.fromEntries([...Array.from({length:13},(_,i)=>516201+i),516241,516242,516243]
      .map(id=>[id,tables.potentials[id]!.MaxLevel!]));
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:28,distance:1,cinematics:false});
    const result=evaluateCombatPolicies(profile.model,[{name:'ready',choose:(_state,legal)=>legal.find(id=>id.includes('ultimate')) ?? legal[0] ?? null}],180,60,profile.boss.switchRate)[0]!;
    expect(result.state.counts['162:skill']).toBeGreaterThan(0);
    expect(result.state.counts['162:super-normal']).toBeGreaterThan(0);
    expect(result.state.seina!.lastMarkSword).toBeGreaterThan(0);
  });
  it.each([.5,12])('collects a spawned lightning sword only within reach at distance %s',distance=>{
    const live=input();
    live.actors[0]!.potentials={516204:1,516209:1};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:28,distance,cinematics:false});
    const cast=profile.model.cast(profile.model.initial(),'162:skill',0).state;
    const result=profile.model.advance(cast,10).state;
    expect(profile.buffApi(result).count('162',16204011)).toBe(distance<1?1:0);
    expect(result.weaponSequence).toBeGreaterThanOrEqual(3); // fall, hold and P9 projectile
  });
  it('consumes collected sword stacks on the enhanced normal and switches to the claymore ultimate', () => {
    const live=input();
    live.actors[0]!.potentials={516204:1,516208:1,516210:1};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:28,distance:2,cinematics:false});
    const state=profile.model.initial();
    state.seina={...state.seina!,form:'rapier'};
    for(let n=0;n<11;n++)profile.buffApi(state).add('162',16204011,'162');
    const result=profile.model.advance(state,2).state;
    expect(result.counts['162:super-normal']).toBe(1);
    expect(profile.buffApi(result).count('162',16204011)).toBe(0);
    expect(result.seina!.form).toBe('claymore');
    expect(result.damage).toBeGreaterThan(0);
  });
  it('distinguishes Light-mark tags from glimmer and does not emit a proc for a refused buff addition',()=>{
    const live=input();live.actors.find(actor=>actor.id===115)!.limitBreak=5;
    const changedTables={...tables,buffValues:{...tables.buffValues,3011:{...tables.buffValues[3011]!,LaminatedNum:1,ReplaceType:false}}};
    const profile=createExampleCombatModel({...fixture,live},changedTables,{boss:28,distance:2,cinematics:true});
    const state=profile.model.initial();
    profile.buffApi(state).add('boss',3012,'162');
    expect(state.buffs['115:11596411']).toBeUndefined();
    profile.buffApi(state).add('boss',3011,'162');
    expect(state.buffs['115:11596411']?.expires).toBe(10);
    state.tick=60;
    profile.buffApi(state).add('boss',3011,'162');
    expect(state.buffs['115:11596411']?.expires).toBe(10);
    profile.buffApi(state).remove('boss',3011);
    profile.buffApi(state).add('boss',3011,'162');
    expect(state.buffs['115:11596411']?.expires).toBe(11);
  });
  it('executes the other Tilia support branches, including periodic mark areas and direct SP recovery', () => {
    const live = input();
    const actor = live.actors.find(actor => actor.id === 107)!;
    actor.limitBreak = 5;
    actor.potentials = {510721:1,510724:1,510726:6,510727:6,510728:6,510729:6,510731:6,510732:6,510733:6,510741:6,510743:6};
    const profile = createExampleCombatModel({ ...fixture, live }, tables, {boss:28,distance:2,cinematics:true});
    const result = evaluateCombatPolicies(profile.model, [{name:'ready',choose:(_state,legal)=>legal.find(id=>id.includes('ultimate')) ?? legal[0] ?? null}],180,60,profile.boss.switchRate)[0]!;
    expect(result.damage).toBeGreaterThan(0);
    expect(result.state.counts['107:skill']).toBeGreaterThan(0);
    expect(result.state.tilia!.lastMarkBonus).toBeGreaterThan(0);
    expect(result.state.tilia!.markAreaUntil).toBeGreaterThan(0);
    expect(Object.values(result.state.buffs).some(buff=>buff.id === 10795012)).toBe(true);
  });
  it.each([true,false])('executes expanded Hotaru support mechanics through 180 seconds (cinematics %s)',cinematics=>{
    const live=input(),actor=live.actors.find(actor=>actor.id===115)!;
    actor.limitBreak=5;
    actor.potentials=Object.fromEntries([511521,511523,511524,511525,511526,511527,511528,511529,511530,511531,511532,511533,511541,511542,511543]
      .map(id=>[id,Math.min(6,tables.potentials[id]!.BuildScore.length)]));
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:28,distance:2,cinematics});
    const policy={name:'ready',choose:(_state:any,legal:string[])=>legal.find(id=>id.includes('ultimate')) ?? legal[0] ?? null};
    const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
    const first=run(),replay=run();
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);
    expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['115:area']).toBeGreaterThan(0);
    expect(first.state.hotaru!.lastArea).toBeGreaterThan(0);
    expect(first.state.hotaru!.perk41Ready).toBeDefined();
  },120000);
  it('executes all three actors at breakthrough five without omitting their timed effects', () => {
    const live = input(); for (const actor of live.actors) actor.limitBreak = 5;
    const { model, boss } = createExampleCombatModel({ ...fixture, live }, tables, { boss: 28, distance: 2, cinematics: true });
    const result = evaluateCombatPolicies(model, [{ name: 'ready', choose: (_state, legal) => legal[0] ?? null }], 180, 60, boss.switchRate)[0]!;
    expect(result.damage).toBeGreaterThan(0);
    expect(result.state.counts['162:ultimate:rapier']).toBeGreaterThan(0);
  });
  it('uses entered notes, automatically lowering concertos when their requirements are no longer met', () => {
    const live = input();
    live.notes[90016] = 11;
    const result = prepareLiveCombatBuild(live, tables);
    expect(result.notes[90016]).toBe(11);
    expect(result.actors[0]!.context.concertos[40381]).not.toBe(5);
    expect(result.actors[0]!.context.concertos[40661]).not.toBe(5);
  });
  it('applies selected stats, SP, skill and potential badge options to their own actor only', () => {
    const live = input();
    live.actors[1]!.level = 90;
    live.badgeOptions[0] = [2704, 201, 0, 0];
    live.badgeOptions[3] = [2804, 0, 0, 0];
    const plain = prepareLiveCombatBuild({ ...live, badgeOptions: Array.from({ length: 9 }, () => [0, 0, 0, 0]) }, tables);
    const result = prepareLiveCombatBuild(live, tables);
    expect(result.actors[0]!.mainSpBonus).toBeCloseTo(.3);
    expect(result.actors[1]!.supportSpBonus).toBeCloseTo(.4);
    expect(result.actors[2]!.supportSpBonus).toBe(0);
    expect(readCombatAttribute(result.actors[0]!.base.attributes, 1, {}) - readCombatAttribute(plain.actors[0]!.base.attributes, 1, {})).toBe(70);
    const skillRow = Object.values(tables.badges!).find(row => row.AttrType === 7 && row.AttrTypeFirstSubtype === 3)!;
    const potentialRow = Object.values(tables.badges!).find(row => row.AttrType === 99 && row.AttrTypeFirstSubtype === 26 && Number(row.Value) === 1)!;
    live.badgeOptions[4]![0] = skillRow.Id;
    live.badgeOptions[5]![0] = potentialRow.Id;
    const updated = prepareLiveCombatBuild(live, tables);
    expect(updated.actors[1]!.context.skillSlots[4]).toBe(8 + Number(skillRow.Value));
    expect(updated.actors[1]!.context.potentials[511526]).toBe(7);
    expect(updated.actors[0]!.context.potentials[511526]).toBeUndefined();
  });
  it('reads main record positions and their real breakthroughs, not fixture slot numbers', () => {
    const live = input();
    [live.records[0], live.records[2]] = [live.records[2]!, live.records[0]!];
    live.records[0]!.limitBreak = 3;
    const profile = createExampleCombatModel({ ...fixture, live }, tables, { boss: 28, distance: 2, cinematics: true });
    expect(profile.rules.records.staticEffects('162')).toContain(4039006);
    expect(profile.build.actors[0]!.context.concertos[40661]).toBe(5);
  });
  it('changes the 180-second result and actual SP income when inputs change', () => {
    const run = (live: LiveCombatInput) => {
      const { model, boss } = createExampleCombatModel({ ...fixture, live }, tables, { boss: 28, distance: 2, cinematics: true });
      return evaluateCombatPolicies(model, [{ name: 'ready', choose: (_state, legal) => legal.find(id => id.includes('ultimate')) ?? legal[0] ?? null }], 180, 60, boss.switchRate)[0]!;
    };
    const live = input(), before = run(live);
    live.badgeOptions[0]![0] = 2704;
    live.notes[90012] = 99;
    const after = run(live);
    expect(after.damage).not.toBe(before.damage);
    expect(after.state.sp.ledger.pools['162']!.gained).toBeGreaterThan(before.state.sp.ledger.pools['162']!.gained);
  });
  it('does not substitute the example party for an unsupported selected character', () => {
    const live = input(); live.actors[0]!.id = 111;
    expect(() => createExampleCombatModel({ ...fixture, live }, tables, { boss: 28, distance: 2, cinematics: true })).toThrow(/예시 파티로 대체하지/);
  });
});
