import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter} from './combat-support-adapter';
interface WindBladeState extends Record<string,unknown>{lastOtherSp:number|null}
const LIGHT=combatTagHash('LightWBlade'),HEAVY=combatTagHash('HeavyWBlade'),BLADE=combatTagHash('FengRen');
const ULTRA=combatTagHash('UltraAtk'),TRIGGER=combatTagHash('112WindTagBoom');
/** Native light-blade loop followed immediately by the heavy-blade combo.
 * P30/P41 are killing-hit effects, inactive against this immortal raid target.
 * The source P27 uses a zero-duration per-target counter; separate hit updates
 * reset its count rather than granting its unreachable follow-up debuff. */
export function createSupport112(potentials:Record<number,number>):SupportCombatAdapter<WindBladeState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const small=`Skill2_Small2Loop${has(511223)?has(511229)?'_P23P29':'_P23':has(511229)?'_P29':''}`;
  const suffix=[511221,511222,511226].filter(has).map(id=>`P${id%100}`).join('');
  const big=`Skill2_Big${suffix?'_'+suffix:''}`;
  return {
    potentials:[511221,511222,511223,511224,511225,511226,511227,511228,511229,511230,511231,511232,511233,511241,511242,511243],
    actions:cinematics=>[{kind:'skill',skill:11232000,tag:small,loopCount:has(511224)?4:2,loopFinishTag:big},
      {kind:'ultimate',skill:11240000,tag:cinematics?'Ultra_TL_ErLianZhan':'Ultra_NoTL_ErLianZhan'}],
    initialize:()=>({lastOtherSp:null}),
    cast(state,api,key){
      if(key==='ultimate'&&has(511242))for(const actor of api.party)api.buffs.add(actor,11254211,api.actor);
      return state;
    },
    prepareHit(state,api,tags){if(has(511243)&&tags.includes(ULTRA))api.buffs.add(api.actor,11254311,api.actor);return state;},
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(has(511225)&&tags.includes(HEAVY)&&api.hasBuffTag('boss','WindMark1'))once.push({id:11252501,count:1});
      if(has(511226))once.push({id:11252601,count:1});
      if(has(511227)&&tags.includes(HEAVY))once.push({id:11252701,count:1});
      if(has(511228)&&tags.includes(LIGHT))once.push({id:11252801,count:1});
      if(has(511229)&&tags.includes(BLADE))once.push({id:11252901,count:1});
      if(has(511232)&&tags.includes(BLADE))once.push({id:11253201,count:1});
      return once;
    },
    mark:tags=>tags.includes(TRIGGER)||has(511228)&&tags.includes(LIGHT)?{element:4,variant:1,buffTag:'WindMark1',
      area:'AreaEffect_112_WindTagTrigger_XuanFeng',radius:1.5}:null,
    markTriggered(state,api,element,_tags,source){
      if(element!==4)return state;
      if(has(511231))api.buffs.add(api.actor,11253111,api.actor);
      if(source===api.actor&&has(511233)&&(state.lastOtherSp===null||api.time-state.lastOtherSp>7)){
        const other=api.party.find(actor=>actor!==api.main&&actor!==api.actor);
        if(other)api.directSp(other,api.parameter(11253301)*10000);
        return {...state,lastOtherSp:api.time};
      }
      return state;
    },
  };
}
