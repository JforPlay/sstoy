import { combatTagHash } from './combat-tags';
import type { RecordRuleBuffs } from './combat-record-rules';
import {runCombatProcs,initialCombatProcs,combatProcContext} from './combat-procs';
import {hotaruBreakthroughRules} from './combat-breakthrough-rules';
export interface HotaruScriptState { stanceUntil: number; lastDagger: number; stage: number; onField: boolean; stanceGeneration: number;
  lastArea?:number|null;normalHits?:number;nextStackAt?:number|null;perk41Ready?:boolean }
export interface HotaruScriptApi {
  time: number; actor: string; party: string[]; allLight?: boolean; buffs: RecordRuleBuffs;
  parameter(id: number): number;
  flyingBatch(first: boolean): void;
  projectile(name: string): void;
  area(name: string): void;
  resetSupportCooldown(): void;
  lightActors?:string[];mainLight?:boolean;bossHpFraction?:number;distance?:number;
  areaAttack?():void;
  shield?(id:number):void;
}
const FLY = combatTagHash('115_FlyBlade'), P22 = combatTagHash('115_P22'), P26 = combatTagHash('115_P26'), P27 = combatTagHash('115_P27');
const LIGHT_ADD = combatTagHash('115_LightTag_Add'), ULTRA = combatTagHash('115_Ultra');
export function createHotaruRules(potentials: Record<number, number>, glimmerId: number, breakthrough = 0) {
  const has = (id: number) => (potentials[id] ?? 0) > 0;
  const run = (api:Pick<HotaruScriptApi,'actor'|'buffs'> & Partial<HotaruScriptApi>,event:string,tags:number[]=[]) =>
    runCombatProcs(hotaruBreakthroughRules,initialCombatProcs(),combatProcContext(api,event,breakthrough,api.party ?? [api.actor],api.party?.[0] ?? api.actor,tags,{eliteOrBoss:true}));
  const team = (api: HotaruScriptApi, buff: number, add: boolean) => {
    for (const actor of api.party) if (add) api.buffs.add(actor, buff, api.actor); else api.buffs.remove(actor, buff);
  };
  return {
    initialize(api: HotaruScriptApi): HotaruScriptState {
      if (has(511533) && api.allLight !== false) team(api, 11533011, true);
      return { stanceUntil: 0, lastDagger: 0, stage: 0, onField: false, stanceGeneration: 0,lastArea:null,normalHits:0,nextStackAt:null,perk41Ready:false };
    },
    castSkill(state:HotaruScriptState,api:HotaruScriptApi):HotaruScriptState {
      if(has(511525)) for(const [from,to] of [[11525011,11525013],[11525014,11525015]]) {
        const count=api.buffs.count(api.actor,from!);
        for(let n=0;n<count;n++) api.buffs.add(api.actor,to!,api.actor);
        api.buffs.remove(api.actor,from!);
      }
      if(has(511528)) {api.buffs.remove(api.actor,11528011);api.buffs.remove(api.actor,11528012);}
      if(has(511532)) {
        if(!api.lightActors) throw new Error('Hotaru P32 requires party element facts');
        for(const actor of api.lightActors) api.buffs.add(actor,11532011,api.actor);
      }
      if(has(511541) && state.perk41Ready) api.buffs.add(api.actor,11541011,api.actor);
      return {...state,normalHits:0,perk41Ready:false};
    },
    enterField(state: HotaruScriptState, api: HotaruScriptApi): HotaruScriptState {
      if (!state.onField && has(511533) && api.allLight !== false) team(api, 11533012, true);
      return { ...state, onField: true };
    },
    enterStance(state: HotaruScriptState, api: HotaruScriptApi): HotaruScriptState {
      if (has(511521)) api.buffs.remove(api.actor, 11521011);
      return { ...state, stanceUntil: api.time + 16, stanceGeneration: state.stanceGeneration + 1, stage: 0,
        nextStackAt:has(511528) ? api.time+api.parameter(11528011)+1/60 : null };
    },
    ultimate(state: HotaruScriptState, api: HotaruScriptApi): HotaruScriptState {
      // Force-exiting stance skips the natural P27 exit attack. Field presence
      // remains until the ultimate itself ends.
      if(has(511525)) {api.buffs.remove(api.actor,11525013);api.buffs.remove(api.actor,11525015);}
      if(has(511531) && api.mainLight!==false) {
        if(!api.shield) throw new Error('Hotaru P31 requires shield resolution');
        api.shield(11531001);
      }
      return { ...this.enterField(state, api), stanceUntil: 0, stanceGeneration: state.stanceGeneration + 1,nextStackAt:null };
    },
    leave(state: HotaruScriptState, api: HotaruScriptApi): HotaruScriptState {
      if (has(511533)) team(api, 11533012, false);
      if(has(511525)) {api.buffs.remove(api.actor,11525013);api.buffs.remove(api.actor,11525015);}
      return { ...state, stanceUntil: 0, onField: false,nextStackAt:null };
    },
    ultimateEnd(state: HotaruScriptState, api: HotaruScriptApi): HotaruScriptState {
      api.resetSupportCooldown();
      return {...this.leave(state, api),perk41Ready:true};
    },
    custom(state:HotaruScriptState,api: HotaruScriptApi, name: string): HotaruScriptState {
      if(name==='FlyBlade') api.flyingBatch(true);
      if(name!=='115_SupportAttack' || !has(511524)) return state;
      const count=(state.normalHits ?? 0)+1;
      if(count<8) return {...state,normalHits:count};
      if(!api.areaAttack) throw new Error('Hotaru P24 requires a forced skill action');
      // Commit the counter before the caller executes the queued skill.
      api.areaAttack();
      return {...state,normalHits:0};
    },
    tick(state:HotaruScriptState,api:HotaruScriptApi):HotaruScriptState {
      if(state.nextStackAt==null || api.time<state.nextStackAt || api.time>=state.stanceUntil) return state;
      api.buffs.add(api.actor,11528011,api.actor);
      return {...state,nextStackAt:api.time+api.parameter(11528011)+1/60};
    },
    onEntryEnd(api: HotaruScriptApi): void { run(api,'entry-end'); },
    onMarkApplied(buffs: RecordRuleBuffs, actor: string): void { run({actor,buffs},'player-light-buff'); },
    onLightMarkTriggered(api: HotaruScriptApi): void { run(api,'light-mark-triggered'); },
    flyingPattern(first: boolean,allLight=true) { const strengthened=has(511521) && allLight;return { delay: first ? 1.3 : 1, count: strengthened ? 10 : 6, interval: strengthened ? .1 : .15,
      projectile: has(511522) ? 'Bullet_11501_Support_Skill_Fly_Blade_P22_Strengthen' : 'Bullet_11501_Support_Skill_Fly_Blade_Base' }; },
    beforeHit(api: HotaruScriptApi, tags: number[]): { id: number; count: number }[] {
      const result: { id: number; count: number }[] = [];
      result.push(...run(api,'before-own-hit',tags).once.map(({id,count})=>({id,count})));
      if (tags.includes(FLY)) {
        const stacks = api.buffs.count(api.actor, 11521011);
        if (has(511521) && stacks) result.push({ id: 11521011, count: stacks });
        if (has(511522)) result.push({ id: 11522011, count: 1 });
        if(has(511525)) for(const [buff,id] of [[11525013,11525001],[11525015,11525002]]) {
          const count=api.buffs.count(api.actor,buff!);
          if(count) result.push({id:id!,count});
        }
      }
      if(tags.includes(combatTagHash('115_SupportAttack'))) {
        if(has(511523) && api.allLight!==false) result.push({id:11523011,count:1});
        const count=api.buffs.count(api.actor,11528011);
        if(has(511528) && count) result.push({id:11528001,count});
      }
      if(tags.includes(ULTRA)) {
        if(has(511542)) result.push({id:11542001,count:1});
        if(has(511543)) {
          if(api.bossHpFraction===undefined) throw new Error('Hotaru P43 requires current target HP');
          if(api.bossHpFraction*100<=api.parameter(11543011)) result.push({id:11543001,count:1});
        }
      }
      return result;
    },
    onMainHit(state: HotaruScriptState, api: HotaruScriptApi, damageType: number): HotaruScriptState {
      if (damageType !== 2 || api.mainLight===false || !has(511526) || (state.lastDagger > 0 && api.time - state.lastDagger <= api.parameter(11526011))) return state;
      api.projectile(has(511522) ? 'Bullet_11501_Support_Skill_P26P21_Boom_Strengthen' : 'Bullet_11501_Support_Skill_P26_Boom');
      return { ...state, lastDagger: api.time };
    },
    afterHit(state:HotaruScriptState,api: HotaruScriptApi, tags: number[]): HotaruScriptState {
      run(api,'own-hit',tags);
      if (has(511521) && tags.includes(FLY)) api.buffs.add(api.actor, 11521011, api.actor);
      if (has(511522) && tags.includes(P22)) api.area('AreaEffect_11501_Support_Skill_P22_Boom');
      if (has(511526) && tags.includes(P26)) {
        const stacks = api.buffs.count('boss', glimmerId);
        for (let n = 0; n < stacks; n++) api.buffs.add('boss', 11526011, api.actor);
      }
      if (has(511527) && tags.includes(P27)) api.buffs.add(api.actor, 11527011, api.actor);
      if(has(511530) && tags.includes(combatTagHash('115_SupportAttack')) && (state.lastArea==null || state.lastArea<=0 || api.time-state.lastArea>api.parameter(11530011))) {
        api.area('AreaEffect_11501_Support_Skill_P30_Aoe');
        return {...state,lastArea:api.time};
      }
      return state;
    },
    onMainMark(api:HotaruScriptApi,kind:1|2,onFieldAction:boolean):void {
      if(api.mainLight===false) return;
      if(has(511525)) {
        if(kind===2) api.buffs.add(api.actor,11525011,api.actor);
        api.buffs.add(api.actor,11525014,api.actor);
      }
      if(has(511529) && kind===1 && onFieldAction) {
        if(api.distance===undefined) throw new Error('Hotaru P29 requires target distance');
        if(api.distance<=api.parameter(11529011)) api.buffs.add('boss',11529011,api.actor);
        api.buffs.add(api.actor,11529012,api.actor);
      }
    },
    canApplyMark(tags: number[]): boolean { return tags.includes(LIGHT_ADD) || (has(511531) && tags.includes(ULTRA)); },
    normalTag(stage: number,allLight=true): string { return `Support_Blade_${has(511523)&&allLight ? 'StrengthenAttack' : 'Attack'}_${stage + 1}`; },
    areaTag(allLight=true):string {return has(511523)&&allLight ? 'Support_Blade_StrengthenSkill' : 'Support_Blade_Skill';},
    exitTag: has(511527) ? (has(511521) ? 'Support_Blade_Exit_P27P21' : 'Support_Blade_Exit_P27') : 'Support_Blade_Exit',
  };
}
