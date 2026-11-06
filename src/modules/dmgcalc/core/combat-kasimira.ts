/** Port of _10801/ParallelScript_Support's launch coroutine. Impacts are
 * scheduled separately from launches using the extracted projectile prefab.
 * Offsets/random landing positions must not be treated as guaranteed hits. */
import { combatTagHash } from './combat-tags';
import type { RecordRuleBuffs } from './combat-record-rules';
import {runCombatProcs,initialCombatProcs,type CombatProcState,type CombatProcContext} from './combat-procs';
import {kasimiraBreakthroughRules} from './combat-breakthrough-rules';

export interface KasimiraLaunch {
  time: number; round: number; shot: number; targetIndex: number;
  offset: [number, number]; randomRadius: number; projectile: string;
}

export interface KasimiraSupportState { lastCast: number; lastDeathExplosion: number; lastUltimateMark: number }
export interface KasimiraSupportApi {
  actor: string; time: number; buffs: RecordRuleBuffs;
  parameter(id: number): number; randomPercent(): number;
  resetSupportCooldown(): void;
  area(name: string): void;
  deathExplosion(hitId: number, radius: number, targetBuff: number): void;
}
const SUPPORT = combatTagHash('108_Support_Skill'), BULLET = combatTagHash('108_B2');
const ULTRA = combatTagHash('108_Ultra'), SKILL = combatTagHash('108_Skill');

export function createKasimiraSharedRules(potentials: Record<number, number>, breakthrough: number, party: string[]) {
  const has = (id: number) => Boolean(potentials[id]);
  const context = (api:KasimiraSupportApi,event:string,tags:number[]=[]):CombatProcContext => ({
    event,actor:api.actor,attacker:api.actor,target:'boss',main:party[0] ?? api.actor,party,time:api.time,breakthrough,tags,
    buffs:api.buffs,facts:{},parameter:api.parameter,randomPercent:api.randomPercent,
  });
  return {
    initial() { return { lastBreakthroughFour: 0,procs:initialCombatProcs() }; },
    otherActorUltimate(api: KasimiraSupportApi) { runCombatProcs(kasimiraBreakthroughRules,initialCombatProcs(),context(api,'other-ultimate')); },
    ownUltimateEnd(api: KasimiraSupportApi) { runCombatProcs(kasimiraBreakthroughRules,initialCombatProcs(),context(api,'own-ultimate-end')); },
    beforeSelfHit(api:KasimiraSupportApi,tags: number[]): number[] {
      const result: number[] = [];
      if (has(510842) && tags.includes(combatTagHash('108_Ultra_Last'))) result.push(10854201);
      result.push(...runCombatProcs(kasimiraBreakthroughRules,initialCombatProcs(),context(api,'before-own-hit',tags)).once.map(value=>value.id));
      return result;
    },
    attacked(api: KasimiraSupportApi, tags: number[], target: string) {
      if (has(510841) && tags.includes(ULTRA)) api.buffs.add(target, 10854101, api.actor);
    },
    afterSelfHit(state: { lastBreakthroughFour: number;procs?:CombatProcState }, api: KasimiraSupportApi, tags: number[]) {
      const previous=state.procs ?? {last:{'108:lb4':state.lastBreakthroughFour},counters:{}};
      const result=runCombatProcs(kasimiraBreakthroughRules,previous,context(api,'own-hit',tags));
      return {lastBreakthroughFour:result.state.last['108:lb4'] ?? state.lastBreakthroughFour,procs:result.state};
    },
    ownUltimateKilled(api: KasimiraSupportApi) { if (has(510843)) api.buffs.add(api.actor, 10854301, api.actor); },
    canTriggerFireMark(tags: number[]) { return tags.includes(combatTagHash('FireTag1_Trigger')); },
    fireMarkHit: { hitId: 108000001, radius: 6 },
  };
}
/** Support-specific event hooks. The shared elemental/ultimate/duplicate rules
 * are a separate layer; this module does not claim to replace those hooks. */
export function createKasimiraSupportRules(potentials: Record<number, number>, ultimateTag: number) {
  const has = (id: number) => Boolean(potentials[id]);
  return {
    initial(): KasimiraSupportState { return { lastCast: 0, lastDeathExplosion: 0, lastUltimateMark: 0 }; },
    cast(state: KasimiraSupportState, api: KasimiraSupportApi): KasimiraSupportState {
      if (has(510828) && api.randomPercent() <= api.parameter(10852801)) api.resetSupportCooldown();
      return { ...state, lastCast: api.time };
    },
    bulletFinished(api: KasimiraSupportApi, own: boolean, tag: string): void {
      if (own && tag === 'Bullet108B2Skill' && has(510821)) api.area('AreaEffect_108_B2P21_Skill_FirePit');
    },
    beforeSelfHit(tags: number[], element: number, stunnedOrBroken: boolean): number[] {
      const result: number[] = [];
      if (tags.includes(SUPPORT)) for (const [perk, once] of [[510822, 10852211], [510823, 10852311], [510824, 10852411], [510828, 10852801], [510829, 10852901]]) {
        if (has(perk!)) result.push(once!);
      }
      if (has(510830) && element === 2 && stunnedOrBroken && tags.includes(BULLET)) result.push(10853001);
      if (has(510831) && tags.includes(ultimateTag)) result.push(10853101);
      return result;
    },
    beforePartyHit(state: KasimiraSupportState, api: KasimiraSupportApi, element: number, slot: number, stunnedOrBroken: boolean): number[] {
      const result: number[] = [];
      if (has(510827) && state.lastCast > 0 && api.time - state.lastCast <= api.parameter(10852711) && stunnedOrBroken) result.push(10852701);
      if (has(510833) && element === 2 && slot === 2) result.push(10853301);
      return result;
    },
    attacked(state: KasimiraSupportState, api: KasimiraSupportApi, tags: number[], target: string): KasimiraSupportState {
      if (has(510826) && tags.includes(BULLET)) api.buffs.add(target, 10852601, api.actor);
      if (has(510831) && (state.lastUltimateMark <= 0 || api.time - state.lastUltimateMark > 1)
        && tags.includes(ultimateTag) && api.randomPercent() <= api.parameter(10853101)) {
        api.buffs.add(target, 1011, api.actor);
        return { ...state, lastUltimateMark: api.time };
      }
      return state;
    },
    afterSelfHit(api: KasimiraSupportApi, tags: number[], target: string): void {
      if (has(510823) && tags.includes(BULLET)) api.buffs.add(target, 10852311, api.actor);
    },
    markedEnemyDied(state: KasimiraSupportState, api: KasimiraSupportApi, ownFireMark: boolean): KasimiraSupportState {
      if (!has(510825) || !ownFireMark || (state.lastDeathExplosion > 0 && api.time - state.lastDeathExplosion <= .5)) return state;
      api.deathExplosion(108525001, 5, 1011);
      return { ...state, lastDeathExplosion: api.time };
    },
  };
}
export function planKasimiraSupportVolley(potentials: Record<number, number>, secondRoundChance: number,
  randomPercent: number, targetCount = 1): KasimiraLaunch[] {
  if (![secondRoundChance, randomPercent].every(Number.isFinite) || randomPercent < 0 || randomPercent > 100
    || !Number.isInteger(targetCount) || targetCount < 1) throw new Error('Invalid Kasimira volley context');
  const count = potentials[510822] ? 5 : 3;
  const rounds = potentials[510829] && randomPercent <= secondRoundChance ? 2 : 1;
  const seeking = Boolean(potentials[510824]);
  const offsets: [number, number][] = [[0, 0], [-2, 0], [2, 0], [0, -2], [0, 2]];
  const launches: KasimiraLaunch[] = [];
  let time = 0;
  for (let round = 0; round < rounds; round++) {
    if (round) time += 1;
    for (let shot = 0; shot < count; shot++) {
      if (shot) time += .1;
      launches.push({ time: Math.round(time * 60) / 60, round, shot,
        targetIndex: seeking ? shot % targetCount : 0, offset: seeking ? [0, 0] : offsets[shot % 5]!,
        randomRadius: seeking ? 0 : 2, projectile: 'Bullet_108_B2_Skill' });
    }
  }
  return launches;
}
