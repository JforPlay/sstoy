import { combatTagHash } from './combat-tags';
import type { RecordRuleBuffs } from './combat-record-rules';
import {runCombatProcs,initialCombatProcs,combatProcContext,type CombatProcState} from './combat-procs';
import {grayBreakthroughRules} from './combat-breakthrough-rules';

export interface GrayState { skillStarted: number; lastSkillBuff: number | null; procs?:CombatProcState }
export interface GrayApi {
  actor: string; time: number; distance: number; earthActors: number; buffs: RecordRuleBuffs;
  parameter(id: number): number;
  area(name: string): void;
}
const ULTRA = combatTagHash('149_Ultra'), GRAY = combatTagHash('149_Gray'), SKILL = combatTagHash('149_Skill');
const CHAIN = combatTagHash('149_B2_Chain'), EARTHQUAKE = combatTagHash('149_B2_Earthquake'), B2 = combatTagHash('149_B2');

/** _14901 shared + support parallel scripts. Main-control summon rules are
 * separate and must not be substituted by these support hooks. */
export function createGraySupportRules(potentials: Record<number, number>, breakthrough: number) {
  const has = (id: number) => Boolean(potentials[id]);
  const run = (api:GrayApi,event:string,tags:number[]=[],state=initialCombatProcs()) => runCombatProcs(grayBreakthroughRules,state,
    combatProcContext(api,event,breakthrough,[api.actor],api.actor,tags,{eliteOrBoss:true}));
  const skillTag = `149_B2${has(514921) ? 'P21' : ''}${has(514922) ? 'P22' : ''}${has(514923) ? 'P23' : ''}`;
  if (has(514921) && has(514922) && has(514923)) throw new Error('그레이 지원 전용 잠재력 세 개를 동시에 선택할 수 없습니다.');
  return {
    skillTag,
    loopCount: has(514923) ? 6 : 1,
    ultimateTag(cinematics: boolean) { return `149_Ultra_${has(514941) ? 'P41_' : ''}${cinematics ? 'TL' : 'NoTL'}`; },
    initialize(api: GrayApi): GrayState {
      if (has(514933)) for (let n = 0; n < api.earthActors; n++) api.buffs.add(api.actor, 14933011, api.actor);
      return { skillStarted: 0, lastSkillBuff: null,procs:initialCombatProcs() };
    },
    cast(state: GrayState, api: GrayApi, actor: string, slot: 'skill' | 'ultimate'): GrayState {
      if (actor !== api.actor) {
        if (has(514932)) api.buffs.add(api.actor, 14932011, api.actor);
        return state;
      }
      if (slot === 'skill') {
        if (has(514925)) api.buffs.add(api.actor, 14925011, api.actor);
        return { ...state, skillStarted: api.time };
      }
      if (has(514943) && api.distance <= 10) api.buffs.add('boss', 14943011, api.actor);
      return state;
    },
    earthBuffAdded(api: GrayApi) { run(api,'earth-buff-added'); },
    ownEarthMarkTriggered(api: GrayApi) {
      if (has(514931)) api.buffs.add(api.actor, 14931011, api.actor);
      if (has(514942)) api.buffs.add('boss', 14942011, api.actor);
      run(api,'own-earth-mark');
    },
    beforeHit(state: GrayState, api: GrayApi, tags: number[], hp: number): { id: number; count: number }[] {
      const result: { id: number; count: number }[] = [];
      const add = (id: number, count = 1) => result.push({ id, count });
      for (const once of run(api,'before-own-hit',tags).once) add(once.id,once.count);
      if (has(514942) && tags.includes(ULTRA) && api.buffs.count('boss', 14942011)) add(14942001);
      if (has(514943) && tags.includes(GRAY) && api.buffs.count('boss', 14943011)) add(14943001);
      if (tags.includes(CHAIN)) {
        if (has(514921)) add(14921011);
        if (has(514922)) add(14922011);
        if (has(514926) && hp * 100 < api.parameter(14926011)) add(14926001);
      }
      if (tags.includes(EARTHQUAKE)) {
        if (has(514924)) add(14924011);
        if (has(514929)) add(14929001);
      }
      if (has(514928) && tags.includes(B2)) add(14928001, Math.max(1, Math.trunc(api.time - state.skillStarted)));
      return result;
    },
    afterHit(state: GrayState, api: GrayApi, tags: number[]): GrayState {
      const procs=run(api,'own-hit',tags,state.procs ?? initialCombatProcs()).state;
      const result = {...state,procs,lastSkillBuff:procs.last['149:lb1'] ?? state.lastSkillBuff};
      if (has(514927) && tags.includes(CHAIN)) {
        if (!api.buffs.count('boss', 14927011)) api.buffs.add('boss', 14927011, api.actor);
        else if (!api.buffs.count('boss', 14927012)) api.buffs.add('boss', 14927012, api.actor);
      }
      return result;
    },
    naturalExpiryHit(id: number) { return has(514927) && [14927011,14927012].includes(id) ? 149327101 : null; },
    canTriggerEarthMark(tags: number[]) { return tags.includes(combatTagHash('149_LandTagTrigger')); },
    custom(api: GrayApi, name: string) {
      const suffix: Record<string, string> = { '149_Earthquake_Enemy_Start': '_Start', '149_Earthquake_Enemy': '', '149_Earthquake_Self': '_Self' };
      if (!(name in suffix)) return;
      const count = name !== '149_Earthquake_Self' && has(514921) ? 3 : 1;
      for (let n = 0; n < count; n++) api.area(`AreaEffect_14901_B2${has(514930) ? 'P30' : ''}_Skill_Earthquake${suffix[name]}`);
    },
    markArea: 'AreaEffect_149_LandTag1_Stone',
  };
}
