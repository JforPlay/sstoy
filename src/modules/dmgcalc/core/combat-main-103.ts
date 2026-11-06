import {combatTagHash} from './combat-tags';
import {createCombatAmmo,consumeCombatAmmo,finishCombatReload,type CombatAmmoState} from './combat-ammo';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';

interface KohakuState extends Record<string,unknown> {
  ammo:CombatAmmoState;strong:boolean;phase:number;pending:string|null;extraUntil:number;
  normalHits:number;critCount:number;lastRefill:number|null;lastBossBuff:number|null;
  explosions:number[];ultimateEnded:number;
}
const NORMAL=combatTagHash('Normal'),SKILL=combatTagHash('Skill'),ULTRA=combatTagHash('Ultra');
const P3=combatTagHash('103_P3'),P9=combatTagHash('103_P9'),TRIGGER=combatTagHash('FireTag1_Trigger');
/** _10301 main role. Reload and ammunition use the shared native helpers;
 * the three B phases and P3's temporary binding remain actor-specific.
 * This standing, immortal raid-target profile has no movement/killing procs. */
export function createMain103(potentials:Record<number,number>,originAmmo:number):SupportCombatAdapter<KohakuState> {
  const has=(id:number)=>Boolean(potentials[id]);
  const isB=(key:string)=>['skill','phase2','phase3','extra'].includes(key);
  const refill=(state:KohakuState,api:SupportCombatApi)=>{
    const ammo=finishCombatReload({...state.ammo,origin:has(510301)?36:originAmmo,reloadEnabled:false});
    return {...state,ammo};
  };
  return {
    potentials:[510301,510302,510303,510304,510305,510306,510307,510308,510309,510310,510311,510312,510313,510341,510342,510343],
    actions:cinematics=>[
      {kind:'normal',skill:10310000,tag:'Attack_1',normal:true,automatic:true},
      {kind:'reload',skill:10310000,tag:'Attack_1',reload:true,automatic:true,spBudget:null},
      {kind:'skill',skill:10331000,tag:has(510309)?'B1P09_Skill':'B1_Skill',cooldownTiming:'end'},
      {kind:'phase2',skill:10331000,tag:has(510309)?'B1P09_Skill_S2':'B1_Skill_S2',automatic:true,flag:4,cooldown:0},
      {kind:'phase3',skill:10331000,tag:has(510309)?'B1P09_Skill_S3':'B1_Skill_S3',automatic:true,flag:4,cooldown:0},
      {kind:'extra',skill:10331030,tag:'B1_Skill_P03_Base',cooldownTiming:'end'},
      {kind:'ultimate',skill:10340000,tag:cinematics?'Ultra_TL':'Ultra_NoTL'},
    ],
    initialize(){return {ammo:createCombatAmmo(originAmmo),strong:false,phase:0,pending:null,extraUntil:0,normalHits:0,critCount:0,
      lastRefill:null,lastBossBuff:null,explosions:[],ultimateEnded:0};},
    automatic(state,api){
      if(api.activeAction()!==null) return state.ammo.value>0 && state.pending===null?'normal':null;
      if(state.pending!==null) return state.extraUntil>api.time?'extra':state.pending;
      if(state.ammo.value<=0) return state.ammo.reloadEnabled?'reload':null;
      return 'normal';
    },
    canCast(state,api,key){
      if(key==='skill') return state.phase===0 && state.pending===null && state.extraUntil<=api.time;
      if(key==='extra') return has(510303) && state.extraUntil>api.time;
      if(key==='phase2'||key==='phase3') return state.pending===key && api.activeAction()===null;
      if(key==='normal') return state.ammo.value>0 && state.pending===null && state.phase===0;
      if(key==='reload') return state.ammo.reloadEnabled && state.ammo.value===0 && api.activeAction()===null;
      return true;
    },
    comboTag(state,api,key){
      if(key==='normal') return state.strong?'Attack_P02_AOE':'Attack_1';
      if(key==='extra') return has(510303)&&api.buffs.count(api.actor,10303011)>0?'B1_Skill_P03':'B1_Skill_P03_Base';
      return null;
    },
    cast(state,api,key){
      if(key==='ultimate' && state.phase!==0) {
        api.resumeCooldown();
        state={...state,phase:0,pending:null};
      }
      if(!isB(key)) return state;
      if(has(510307)) api.buffs.add(api.actor,10350701,api.actor);
      if(key!=='extra') {
        api.buffs.remove(api.actor,10303011);
        if(has(510301)||has(510302)) {
          state=refill(state,api);
          if(has(510301)) api.buffs.add(api.actor,10350101,api.actor);
          state={...state,strong:has(510302),normalHits:0};
        }
      }
      return {...state,extraUntil:0,pending:null};
    },
    custom(state,api,name){
      if(name==='Shoot1' && state.ammo.value>0) {
        const ammo=consumeCombatAmmo(state.ammo);
        if(state.strong && ammo.value===0) api.interrupt();
        return {...state,ammo};
      }
      if(name==='shoot') return {...state,phase:(state.phase+1)%3};
      return state;
    },
    phase(state,api,key,phase){
      if(key==='reload'&&phase==='anticipation') return {...state,ammo:finishCombatReload(state.ammo),normalHits:0};
      if(key==='ultimate'&&phase==='anticipation'&&has(510342)) api.resetCooldown();
      if(phase!=='activation') return state;
      if(['skill','phase2','phase3'].includes(key)&&has(510303)) return {...state,extraUntil:api.time+2};
      if(key==='extra') return {...state,extraUntil:0};
      return state;
    },
    end(state,api,key){
      if(key==='normal'&&state.ammo.value===0) {
        api.buffs.remove(api.actor,10350101);
        return {...state,strong:false,ammo:{...state.ammo,origin:originAmmo,reloadEnabled:true}};
      }
      if(key==='ultimate') {
        if(has(510341)) api.buffs.add(api.actor,10354101,api.actor);
        if(has(510342)) api.buffs.add(api.actor,10354201,api.actor);
        return {...state,ultimateEnded:api.time};
      }
      if(!isB(key)) return state;
      if(has(510308)) api.buffs.add(api.actor,10350801,api.actor);
      if(has(510342)&&state.ultimateEnded>0&&api.time-state.ultimateEnded<api.parameter(10354201)) api.retainCooldownPercent(50);
      if(key==='extra') api.buffs.remove(api.actor,10303011);
      if(state.phase!==0) {
        if(key==='skill') api.pauseCooldown();
        return {...state,pending:state.phase===1?'phase2':'phase3'};
      }
      api.resumeCooldown();
      return {...state,pending:null};
    },
    attacked(state,api,tags){
      if(tags.includes(ULTRA)&&has(510343)) api.buffs.add('boss',10354311,api.actor);
      let explosions=state.explosions;
      if(tags.includes(SKILL)&&has(510304)) {
        explosions=explosions.filter(time=>time>=api.time-1);
        if(explosions.length<5){api.area('AreaEffect_10301_P04_Boom');explosions=[...explosions,api.time];}
      }
      return {...state,explosions,normalHits:state.normalHits+(tags.includes(NORMAL)&&has(510306)?1:0)};
    },
    beforeHit(state,api,tags){
      const result:{id:number;count:number}[]=[];
      if(tags.includes(NORMAL)&&has(510306)) result.push({id:10350601,count:Math.min(state.normalHits,api.parameter(10306011))});
      if(tags.includes(P3)&&has(510303)) result.push({id:10303011,count:1});
      if(tags.includes(P9)&&has(510309)) result.push({id:10350901,count:1});
      if(has(510343)&&api.buffs.count('boss',10354311)>0) result.push({id:10354301,count:1});
      // P10 requires a killed, fire-marked enemy; P12 requires movement.
      // Neither is true for the stationary, continuously levelling raid boss.
      return result;
    },
    afterHit(state,api,tags){
      if(tags.includes(SKILL)&&has(510303)&&api.hasBuffTag('boss','FireMark1')) api.buffs.add(api.actor,10303011,api.actor);
      if(has(510311)&&(state.lastBossBuff===null||api.time-state.lastBossBuff>api.parameter(10351111))) {
        api.buffs.add(api.actor,10351101,api.actor);
        return {...state,lastBossBuff:api.time};
      }
      return state;
    },
    crit(state,api){
      if(has(510313)&&api.hasBuffTag('boss','FireMark1')) api.buffs.add(api.actor,10351301,api.actor);
      if(!has(510305)) return state;
      const critCount=state.critCount+1;
      if(critCount>api.parameter(10350512)&&(state.lastRefill===null||api.time-state.lastRefill>api.parameter(10350511))) {
        state=refill(state,api);
        api.buffs.add(api.actor,10350501,api.actor);
        return {...state,critCount:0,lastRefill:api.time};
      }
      return {...state,critCount};
    },
    mark:tags=>tags.includes(TRIGGER)&&(tags.includes(SKILL)||tags.includes(ULTRA))?{element:2,buffTag:'FireMark1',hit:103000001}:null,
  };
}
