import type { RecordRuleBuffs } from './combat-record-rules';
import { combatTagHash } from './combat-tags';
import {runCombatProcs,initialCombatProcs,combatProcContext} from './combat-procs';
import {tiliaBreakthroughRules} from './combat-breakthrough-rules';
export interface TiliaScriptState { shieldCdReductions: number; lastLowHp: number; markAreaUntil?: number; lastMarkBonus?: number | null }
export interface TiliaScriptApi {
  time: number; actor: string; main: string; buffs: RecordRuleBuffs;
  parameter(id: number): number;
  reduceSupportCooldown(seconds: number): void;
  area(name: string, delayFrames?: number): void;
  projectile(name: string): void;
  areaDuration?(name: string): number;
  directSp?(raw: number): void;
}
export function createTiliaRules(potentials: Record<number, number>, breakthrough = 0, party: string[] = [], lightCount = party.length) {
  const has = (id: number) => (potentials[id] ?? 0) > 0;
  const run = (api:Pick<TiliaScriptApi,'actor'|'buffs'> & Partial<TiliaScriptApi>,event:string,attacker=api.actor) => {
    const context=combatProcContext(api,event,breakthrough,party,api.main ?? party[0] ?? api.actor,[],{lightCount});
    context.attacker=attacker;
    return runCombatProcs(tiliaBreakthroughRules,initialCombatProcs(),context);
  };
  return {
    initialize(api: TiliaScriptApi): TiliaScriptState {
      if (has(510733)) api.buffs.add(api.main, 10733011, api.actor);
      run(api,'initialize');
      return { shieldCdReductions: 0, lastLowHp: 0, markAreaUntil: 0, lastMarkBonus: null };
    },
    castSkill(state: TiliaScriptState): TiliaScriptState { return { ...state, shieldCdReductions: 0, markAreaUntil: 0 }; },
    enterField(api: TiliaScriptApi): void { if (has(510731)) api.buffs.add(api.main, 10731011, api.actor); },
    castUltimate(api: TiliaScriptApi): void { if (has(510743)) for (const actor of party) api.buffs.add(actor, 10743011, api.actor); },
    onMainUltimate(api: TiliaScriptApi): void { run(api,'main-ultimate'); },
    onMarkedTargetHit(api: TiliaScriptApi, actor: string): void { run(api,'marked-target-hit',actor); },
    onOwnMarkApplied(buffs: RecordRuleBuffs, source: string): void {
      if (has(510726)) buffs.add('boss', 10726011, source);
      run({actor:source,buffs},'own-light-mark-applied');
    },
    onLightMarkTriggered(api: TiliaScriptApi): void { run(api,'light-mark-triggered'); },
    lightMarkTriggered(state: TiliaScriptState, api: TiliaScriptApi): TiliaScriptState {
      this.onLightMarkTriggered(api);
      if (!has(510727) || (state.lastMarkBonus != null && api.time - state.lastMarkBonus <= api.parameter(10727012))) return state;
      if (!api.directSp) throw new Error('Tilia P27 requires direct SP routing');
      api.directSp(api.parameter(10727011) * 10000);
      for (const actor of party) api.buffs.add(actor, 10727011, api.actor);
      return { ...state, lastMarkBonus: api.time };
    },
    beforeHit(api: TiliaScriptApi, tags: number[]): { id: number; count: number }[] {
      if (!has(510741) || !tags.includes(combatTagHash('107_Ultra'))) return [];
      api.buffs.add('boss', 10741011, api.actor);
      return [{ id: 10741001, count: 1 }];
    },
    afterHit(api: TiliaScriptApi, tags: number[]): void {
      if (tags.includes(combatTagHash('107_Support_Skill'))) for (const actor of party) api.buffs.add(actor, 10795012, api.actor);
    },
    custom(api: TiliaScriptApi, name: string): void {
      if (name === 'ThrowShield') {
        if (has(510724)) api.projectile('Bullet_107_Support_Skill_ThrowShield_P24');
        if (!has(510724) || has(510723)) api.projectile('Bullet_107_Support_Skill_ThrowShield');
      }
      else if (name === '107_HeartStone_06') api.area('AreaEffect_107_Ultra_HeartStone_06');
    },
    shieldHit(state: TiliaScriptState, api: TiliaScriptApi, target: 'main' | 'boss', bossHpFraction: number, stunImmune: boolean, reboundCount = 0): TiliaScriptState {
      const result = { ...state };
      if (has(510729) && reboundCount > 0) for (const actor of party) api.buffs.add(actor, 10729011, api.actor);
      if (target === 'main') {
        if (has(510723)) api.area('AreaEffect_107_Support_Skill_P23_Boom');
        if (has(510728)) api.buffs.add(api.main, 10728011, api.actor);
        return result;
      }
      if (has(510721) && (result.markAreaUntil ?? 0) <= api.time) {
        const name = 'AreaEffect_107_Support_Skill_P21_LightTag';
        if (!api.areaDuration) throw new Error('Tilia P21 requires extracted area duration');
        result.markAreaUntil = api.time + api.areaDuration(name);
        api.area(name);
      }
      if (has(510722) && result.shieldCdReductions < api.parameter(10722012)) {
        result.shieldCdReductions++;
        api.reduceSupportCooldown(api.parameter(10722011));
      }
      // Native Parallel buffers P25 targets across two OnUpdate passes before
      // spawning the bonus area/debuff; its area then uses its configured delay.
      if (has(510725) && stunImmune) api.area('AreaEffect_107_Support_Skill_P25_Boom', 2);
      if (has(510730) && bossHpFraction * 100 < api.parameter(10730001)
        && (result.lastLowHp <= 0 || api.time - result.lastLowHp > api.parameter(10730012))) {
        result.lastLowHp = api.time;
        api.area('AreaEffect_107_Support_Skill_P23_Boom');
      }
      return result;
    },
    /** AdventureFlyShield starts with _reboundTime-- when P23 targets main.
     * Six rebounds therefore produce four main contacts and three boss hits. */
    shieldTargets(rebounds = 6, firstMain = has(510723)): ('main' | 'boss')[] {
      const targets: ('main' | 'boss')[] = Array.from({ length: rebounds + 1 }, (_, index) => Boolean(index % 2) === firstMain ? 'boss' : 'main');
      if (targets.at(-1) !== 'main') targets.push('main');
      return targets;
    },
    activateP25(api: TiliaScriptApi): void { api.buffs.add('boss', 10725011, api.actor); },
  };
}
