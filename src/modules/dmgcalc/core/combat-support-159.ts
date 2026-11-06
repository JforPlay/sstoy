import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';

interface RoseState extends Record<string,unknown> {generation:number;total:number;roses:number;initialRoses:number;earthCount:number}
const A=combatTagHash('159_Sup_Rose'),A22=combatTagHash('159_Sup_Rose_P22'),B=combatTagHash('159_Sup_Withered');
const B_DAMAGE=combatTagHash('159_Sup_Withered_DMG'),P30=combatTagHash('159_Sup_P30'),MARK=combatTagHash('159_LandTagAdd');
const ULTRA=combatTagHash('159_Ultra'),COMMON=combatTagHash('159_Common'),TRIGGER=combatTagHash('159_LandTrigger');
const ROSE='AreaEffect_15901_SkillSup_Rose',WITHERED='AreaEffect_15901_SkillSup_Withered',INFECT='AreaEffect_15901_SkillSup_Infect_Perk23';
const ROSE22='AreaEffect_15901_SkillSup_Rose_Perk22';

/** ShootRose's seven-node graph and support/shared potential mechanics.
 * Positions use the scenario's stationary player at (0,0), facing its boss.
 * Each area is tested separately; seven spawned areas are not seven hits. */
export function createSupport159(potentials:Record<number,number>):SupportCombatAdapter<RoseState> {
  const has=(id:number)=>Boolean(potentials[id]);
  return {
    potentials:[515921,515922,515923,515924,515925,515926,515927,515928,515929,515930,515931,515932,515933,515941,515942,515943],
    actions:cinematics=>[{kind:'skill',skill:15932000,tag:'159_Skill_Sup'},
      {kind:'ultimate',skill:15940000,tag:cinematics?'159_Ultra_TL':'159_Ultra_NoTL'}],
    initialize(api){return {generation:0,total:0,roses:0,initialRoses:0,earthCount:api.actorsByElement(3).length};},
    cast(state,api,key){if(key==='skill'&&has(515921)) api.buffs.add(api.actor,15921011,api.actor);return state;},
    custom(state,api,name) {
      if(name!=='summonEvt') return state;
      for(const area of [ROSE,ROSE22,WITHERED,INFECT]) api.stopWeapons(area,true);
      const generation=state.generation+1;
      // All seven projectiles have their velocity/minimum duration set so
      // they land together: (3.8 - -0.5) / 6.5 against a boss.
      api.schedule('rose-land',Math.ceil(((3.8+.5)/6.5)*60)/60+1/60,{generation});
      return {...state,generation,total:0,roses:0,initialRoses:0};
    },
    event(state,api,name,data) {
      if(name!=='rose-land' || data.generation!==state.generation) return state;
      const remaining=[0,1,2,3,4,5,6],withered=new Set<number>();
      for(let n=0;n<(has(515923)?3:1);n++) {
        const at=Math.min(remaining.length-1,Math.floor(api.randomPercent()*remaining.length/100));
        withered.add(remaining.splice(at,1)[0]!);
      }
      const infected=new Set<number>();
      if(has(515923)) for(const node of withered) {
        const neighbors=node===0?[1,2,3,4,5,6]:[0,(node+4)%6+1,node%6+1];
        for(const other of neighbors) if(!withered.has(other)) infected.add(other);
      }
      const initialRoses=7-withered.size-infected.size;
      for(let n=0;n<7;n++) {
        const angle=(30+(n-1)*60)*Math.PI/180;
        const x=3.8+(n===0?0:Math.cos(angle)*5.2),z=n===0?0:Math.sin(angle)*5.2;
        const area=withered.has(n)?WITHERED:infected.has(n)?INFECT:has(515922)?ROSE22:ROSE;
        api.area(area,'boss',{x,z,...(has(515924)&&area!==ROSE22?{duration:9.2}:{})});
      }
      return {...state,total:7,roses:initialRoses,initialRoses};
    },
    attacked(state,api,tags) {
      if(tags.includes(MARK)) {
        api.buffs.add('boss',6011,api.actor);
        if(tags.includes(A)) {
          if(has(515926)) api.buffs.add('boss',15926011,api.actor);
          if(has(515927)) api.buffs.add('boss',15927011,api.actor);
        }
      }
      return state;
    },
    beforeHit(state,api,tags) {
      const result:{id:number;count:number}[]=[];
      if(tags.includes(A)) {
        if(has(515921)&&api.buffs.count(api.actor,15921011)) result.push({id:15921011,count:1});
        if(has(515922)) result.push({id:15922013,count:state.earthCount});
        if(has(515925)) result.push({id:15925001,count:state.initialRoses});
      }
      if(tags.includes(A22)&&has(515922)) result.push({id:has(515924)?15922012:15922011,count:1});
      if(tags.includes(B_DAMAGE)) {
        if(has(515923)) result.push({id:15923011,count:state.earthCount});
        if(has(515928)&&state.total>state.roses) result.push({id:15928001,count:state.total-state.roses});
      }
      if(tags.includes(P30)&&has(515930)) result.push({id:15930001,count:api.buffs.count('boss',15991012)});
      if(tags.includes(ULTRA)&&has(515941)) result.push({id:15941001,count:1});
      if(tags.includes(COMMON)&&has(515943)) result.push({id:15943001,count:api.buffs.count(api.actor,15943011)});
      return result.filter(row=>row.count>0);
    },
    beforePartyHit(state,api,hit) {
      if(api.actorInfo(hit.actor).element!==3) return [];
      const result:{id:number;count:number;source:string}[]=[];
      if(has(515929)&&state.total>0) result.push({id:15929001,count:1,source:hit.actor});
      if(has(515942)&&!api.ultimateReady()&&[1,2].includes(api.actorInfo(hit.actor).job)) result.push({id:15942001,count:1,source:hit.actor});
      return result;
    },
    afterHit(state,api,tags,hit) {
      if(tags.includes(B)) {
        const count=api.buffs.count('boss',15991012);
        api.buffs.add('boss',15991012,api.actor);
        if(count+1>=5) {
          api.buffs.add('boss',15991013,api.actor);
          api.hit(159320004,[{owner:'boss',id:15991012}]);
        } else if(has(515930)) {api.buffs.add('boss',15930011,api.actor);api.hit(159330101);}
      }
      if(has(515932)&&tags.includes(ULTRA)) api.buffs.add('boss',6011,api.actor);
      if(has(515933)&&state.earthCount>=3&&hit.damageType===2&&state.roses>0) {
        api.buffs.remove('boss',15933011);
        for(let n=0;n<state.roses;n++) api.buffs.add('boss',15933011,api.actor);
      }
      if(has(515943)&&tags.includes(ULTRA)) api.buffs.add(api.actor,15943011,api.actor);
      return state;
    },
    areaEnd(state,api,name,position) {
      if(![ROSE,ROSE22,WITHERED,INFECT].includes(name)) return state;
      const rose=name===ROSE||name===ROSE22;
      if(rose&&has(515921)) api.area('AreaEffect_15901_SkillSup_RoseEndExtra_Perk21','boss',position);
      return {...state,total:Math.max(0,state.total-1),roses:Math.max(0,state.roses-(rose?1:0))};
    },
    mark:tags=>tags.includes(TRIGGER)?{element:3,area:'AreaEffect_15901_LandTag1_Stone'}:null,
    markTriggered(state,api,element) {
      if(element===3&&has(515927)&&api.buffs.count('boss',15927011)) api.hit(159327101);
      return state;
    },
  };
}
