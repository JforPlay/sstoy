import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadExampleCombatTables } from '../core/combat-data';
import { createExampleCombatModel } from '../core/combat-example-model';
import { prepareCombatBuild } from '../core/combat-build';
import { evaluateCombatPolicies } from '../core/combat-policy-search';
import { makeCyclePolicy } from '../core/combat-optimizer';
import type { LiveCombatInput } from '../core/combat-live-build';
const read = async (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, 'utf8'));
const fixture = JSON.parse(readFileSync('public/guides/rotation-example.json', 'utf8'));

describe('selected party composition on the shared combat clock', () => {
  it.each([[134,140],[140,157],[157,134],[140,134],[157,140],[134,157]])(
    'optimizes held skills with support order %s / %s and their actual potentials',async(first,second)=>{
      const tables=await loadExampleCombatTables(read,[162,first,second]);
      const live:LiveCombatInput={
        actors:[162,first,second].map(id=>({
          id,level:90,ascension:8,limitBreak:5,
          potentials:id===162?{}:Object.fromEntries([
            ...tables.potentialPools[id]!.AssistSpecificPotentialIds,...tables.potentialPools[id]!.AssistNormalPotentialIds,
            ...tables.potentialPools[id]!.CommonPotentialIds,
          ].map(potential=>[potential,Math.min(6,tables.potentials[potential]!.MaxLevel!)])),
          skillSlots:{1:8,2:8,4:8,5:8},
        })),
        records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0]),
      };
      const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:false});
      const policies=[0,2,5].map(hold=>makeCyclePolicy({
        hotaruHold:hold,tiliaHold:hold,ultimateHold:hold,mainHold:0,supportsFirst:true,
      },'162',[String(first),String(second)]));
      const results=evaluateCombatPolicies(profile.model,policies,180,60,profile.boss.switchRate);
      expect(results).toHaveLength(3);
      for(const result of results){
        expect(result.state.tick).toBe(10800);
        for(const id of [first,second]){
          expect(result.state.counts[`${id}:skill`]).toBeGreaterThan(0);
          expect(result.state.counts[`${id}:ultimate`]).toBeGreaterThan(0);
          expect(result.state.sp.ledger.pools[String(id)]!.value).toBeGreaterThanOrEqual(0);
        }
        expect(result.damage).toBeGreaterThan(0);
      }
    },120000);
  it.each([0,1,2,3,4,5])('replays all connected support pair orders at breakthrough %s without hard-coded party positions',async limitBreak=>{
    const supportIds=[107,108,115,149];
    const tables=await loadExampleCombatTables(read,[162,...supportIds]);
    for(const first of supportIds) for(const second of supportIds) {
      if(first===second) continue;
      const live:LiveCombatInput={actors:[162,first,second].map(id=>({id,level:90,ascension:8,limitBreak,potentials:{},skillSlots:{2:8,4:8,5:8}})),
        records:structuredClone(fixture.records),notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
      const profile=createExampleCombatModel({...fixture,live},tables,{boss:28,distance:2,cinematics:true});
      const policy=makeCyclePolicy({hotaruHold:2,tiliaHold:1,ultimateHold:2,mainHold:0,supportsFirst:true},'162',[String(first),String(second)]);
      const run=()=>evaluateCombatPolicies(profile.model,[policy],180,60,profile.boss.switchRate)[0]!;
      const result=run(),replay=run();
      expect(result.state.tick).toBe(10800);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.damage).toBe(replay.damage);
      expect(result.state.procs).toEqual(replay.state.procs);
      expect(result.trace).toEqual(replay.trace);
      expect(Object.keys(result.state.sp.ledger.pools).sort()).toEqual(['162',String(first),String(second)].sort());
      expect(profile.scenario.actors.map(actor=>actor.id)).toEqual(['162',String(first),String(second)]);
    }
  },120000);
  it('runs Gray and Kasimira together without either original support or all-light buffs', async () => {
    const tables = await loadExampleCombatTables(read, [162, 149, 108]);
    const baseline = prepareCombatBuild(fixture, tables);
    const main = baseline.actors[0]!;
    const live: LiveCombatInput = { actors: [
      { id: 162, level: 90, ascension: 8, limitBreak: 1, potentials: main.context.potentials, skillSlots: main.context.skillSlots },
      { id: 149, level: 90, ascension: 8, limitBreak: 5,
        potentials: {514921:1,514923:1,514924:1,514925:6,514926:6,514927:6,514928:6,514929:6,514930:6,514931:6,514932:6,514933:6,514941:6,514942:6,514943:6}, skillSlots: {2:8,4:8,5:8} },
      { id: 108, level: 90, ascension: 8, limitBreak: 5, potentials: {510824:1,510826:6,510832:6}, skillSlots: {2:8,4:8,5:8} },
    ], records: structuredClone(fixture.records), notes: baseline.notes, badgeOptions: Array.from({length:9}, () => [0,0,0,0]) };
    const profile = createExampleCombatModel({ ...fixture, live }, tables, {boss:29,distance:2,cinematics:true});
    const result = evaluateCombatPolicies(profile.model, [makeCyclePolicy({hotaruHold:2,tiliaHold:1,ultimateHold:2,mainHold:0,supportsFirst:true}, '162', ['149','108'])], 180, 60, profile.boss.switchRate)[0]!;
    expect(result.state.tick).toBe(10800);
    expect(result.damage).toBeGreaterThan(0);
    expect(result.state.counts['149:skill']).toBeGreaterThan(0);
    expect(result.state.counts['149:ultimate']).toBeGreaterThan(0);
    expect(result.state.counts['108:skill']).toBeGreaterThan(0);
    expect(result.state.sp.ledger.pools['115']).toBeUndefined();
    expect(result.state.sp.ledger.pools['107']).toBeUndefined();
  });
  it.each([107, 115])('runs Kasimira with support %s, all five breakthroughs and deterministic replay', async companion => {
    const tables = await loadExampleCombatTables(read, [162, 108, companion]);
    const baseline = prepareCombatBuild(fixture, tables);
    const actors: LiveCombatInput['actors'] = baseline.actors.filter(actor => [162, companion].includes(actor.id))
      .map(actor => ({ id: actor.id, level: 90, ascension: 8, limitBreak: 5,
        potentials: { ...actor.context.potentials }, skillSlots: { ...actor.context.skillSlots } }));
    actors.splice(1, 0, { id: 108, level: 90, ascension: 8, limitBreak: 5,
      potentials: { 510821: 1, 510822: 1, 510823: 1, 510824: 1, 510826: 6, 510828: 6, 510829: 6, 510831: 6, 510842: 6 },
      skillSlots: { 2: 8, 4: 8, 5: 8 } });
    const live: LiveCombatInput = { actors, records: structuredClone(fixture.records), notes: baseline.notes,
      badgeOptions: Array.from({ length: 9 }, () => [0, 0, 0, 0]) };
    const profile = createExampleCombatModel({ ...fixture, live }, tables, { boss: 28, distance: 2, cinematics: true });
    expect(profile.scenario.actors.map(actor => actor.id)).toEqual(['162', '108', String(companion)]);
    const policy = makeCyclePolicy({ hotaruHold: 2, tiliaHold: 1, ultimateHold: 2, mainHold: 0, supportsFirst: true }, '162', ['108', String(companion)]);
    const run = () => evaluateCombatPolicies(profile.model, [policy], 180, 60, profile.boss.switchRate)[0]!;
    const first = run(), replay = run();
    expect(first.state.tick).toBe(10800);
    expect(first.damage).toBeGreaterThan(0);
    expect(first.damage).toBe(replay.damage);
    expect(first.trace).toEqual(replay.trace);
    expect(first.state.counts['108:skill']).toBeGreaterThan(0);
    expect(first.state.counts['108:ultimate']).toBeGreaterThan(0);
    expect(first.state.counts[`${companion}:skill`]).toBeGreaterThan(0);
    expect(first.state.sp.ledger.pools['108']!.gained).toBeGreaterThan(0);
    const initialized = profile.model.initial();
    // Tilia/Hotaru's all-light condition must not be granted to this fire party.
    expect(Object.values(initialized.buffs).some((entry: any) => entry.id === 10796511 || entry.id === 11533011)).toBe(false);
  }, 120000);
});
