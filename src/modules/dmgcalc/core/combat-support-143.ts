import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter} from './combat-support-adapter';
interface WindState extends Record<string,unknown> {lastLaser:number;lastTornado:number;domainUntil:number}
const ALL=combatTagHash('143SupSkillAllAtk'),SWORD=combatTagHash('143SupJianAtk'),GUN=combatTagHash('143SupQiangAtk');
const SKILL=combatTagHash('143SupSkillAtk'),MARK=combatTagHash('143WindTagTrigger');
const DOMAIN='AreaEffect_143_Ultra_WindDomain';
export function createSupport143(potentials:Record<number,number>):SupportCombatAdapter<WindState> {
  const has=(id:number)=>Boolean(potentials[id]);
  const first=has(514323)?'Skill_Sup_LianHuan_1_P23':'Skill_Sup_LianHuan_1';
  return {
    potentials:[514321,514322,514323,514324,514325,514326,514327,514328,514329,514330,514331,514332,514333,514341,514342,514343],
    actions:cinematics=>[{kind:'skill',skill:14332000,tag:first,chain:[{tag:first,until:'activation'},
      {tag:has(514324)?'Skill_Sup_LianHuan_2_P24':'Skill_Sup_LianHuan_2'}]},
      {kind:'ultimate',skill:14340000,tag:`Ultra_Timeline${cinematics?'On':'Off'}_T2${has(514341)?'P41':''}`,loopCount:1}],
    initialize(api){
      if(has(514333))for(const _actor of api.actorsByElement(4))api.buffs.add(api.actor,14333011,api.actor);
      return {lastLaser:0,lastTornado:0,domainUntil:0};
    },
    cast(state,api,key){
      if(key==='skill'&&has(514327))api.buffs.add(api.actor,14327011,api.actor);
      if(key==='ultimate'&&has(514342))api.buffs.add(api.actor,14342011,api.actor);
      return state;
    },
    end(state,api,key){if(key==='ultimate'){api.stopWeapons(DOMAIN,true);return {...state,domainUntil:0};}return state;},
    custom(state,api,name){
      if(name==='143_P21_DiLie'&&has(514322))api.area('AreaEffect_143_P22_DiLie','boss',{x:0,z:0});
      if(name==='143_P21_LongJuanFeng'&&has(514321))api.area('AreaEffect_143_P21_LongJuanFeng','boss',{x:has(514324)?7.5:5,z:0});
      if(name==='WindDomainOpen') {
        const duration=api.area(DOMAIN,'boss',{x:0,z:0});
        if(has(514343))api.area('AreaEffect_143_Ultra_WindDomain_P43_XiYin','boss',{x:0,z:0});
        return {...state,domainUntil:api.time+duration};
      }
      if(name==='WindDomainClose') {api.stopWeapons(DOMAIN,true);return {...state,domainUntil:0};}
      if(['WindDomainQuickAtk_1','WindDomainQuickAtk_2','WindDomainQuickAtk_3'].includes(name)&&state.domainUntil>api.time&&api.distance<api.areaRadius(DOMAIN))api.area('AreaEffect_143_Ultra_WindDomainQuickAtk');
      return state;
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      const count=api.buffs.count(api.actor,14328011);
      if(has(514328)&&tags.includes(GUN)&&count)once.push({id:14328001,count});
      if(has(514329)&&tags.includes(SKILL))once.push({id:14329001,count:1});
      if(has(514330)&&tags.includes(SWORD))once.push({id:14330002,count:1}); // one stationary enemy
      if(has(514331)&&tags.includes(ALL)&&api.hasBuffTag('boss','Wind'))once.push({id:14331001,count:1});
      return once;
    },
    afterHit(state,api,tags){
      if(has(514326)&&tags.includes(ALL))api.buffs.add(api.actor,14326011,api.actor);
      if(has(514328)&&tags.includes(SWORD))api.buffs.add(api.actor,14328011,api.actor);
      if(has(514325)&&tags.includes(ALL)&&(state.lastLaser<=0||api.time-state.lastLaser>api.parameter(14325012))&&api.randomPercent()<=api.parameter(14325011)) {
        const angle=api.randomPercent()/100*Math.PI*2,x=Math.cos(angle),z=Math.sin(angle);
        api.area('AreaEffect_143_P25_JiGuang','boss',{x,z,angle:Math.atan2(-z,api.distance-x)*180/Math.PI});
        return {...state,lastLaser:api.time};
      }
      return state;
    },
    mark:tags=>tags.includes(MARK)?{element:4,buffTag:'Wind',area:'AreaEffect_143_WindTagTrigger_QiXuan',radius:1.5}:null,
    markTriggered(state,api,element,_tags,source){
      if(source!==api.actor&&element===4&&has(514332)&&(state.lastTornado<=0||api.time-state.lastTornado>api.parameter(14332012))&&api.randomPercent()<=api.parameter(14332011)) {
        api.area('AreaEffect_143_P32_LongJuanFeng');return {...state,lastTornado:api.time};
      }
      return state;
    },
  };
}
