import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface ClawState extends Record<string,unknown> {claws:number;lastToughness:number|null}
const SKILL=combatTagHash('142SkillSupAtk'),DARK=combatTagHash('142AddDarkMark1'),ULTRA=combatTagHash('142UltraAtk');
export function createSupport142(potentials:Record<number,number>):SupportCombatAdapter<ClawState> {
  const has=(id:number)=>Boolean(potentials[id]);
  const team=(api:SupportCombatApi,id:number)=>{for(const actor of api.party)api.buffs.add(actor,id,api.actor);};
  return {
    potentials:[514221,514222,514223,514224,514225,514226,514227,514228,514229,514230,514231,514232,514233,514241,514242,514243],
    actions:cinematics=>[{kind:'skill',skill:14232000,tag:has(514224)?'Skill_Sup_ZhuaJi_P24':'Skill_Sup_ZhuaJi',loopCount:has(514223)?3:2},
      {kind:'ultimate',skill:14240000,tag:cinematics?'Ultra_TimelineOn':'Ultra_TimelineOff'}],
    initialize(api){if(has(514233))for(const actor of api.actorsByElement(6))api.buffs.add(actor,14233011,api.actor);return {claws:0,lastToughness:null};},
    cast(state,api,key){
      if(has(514231))api.buffs.add(api.main,14231011,api.actor);
      if(has(514232))for(const actor of api.party.filter(actor=>actor!==api.actor))api.buffs.add(actor,14232011,api.actor);
      return key==='skill'?{...state,claws:0}:state;
    },
    end(state,api){
      if(has(514231))api.buffs.remove(api.main,14231011);
      if(has(514232))for(const actor of api.party.filter(actor=>actor!==api.actor))api.buffs.remove(actor,14232011);
      return state;
    },
    custom(state,api,name){
      if(name==='ZhuaJi_Zuo'||name==='ZhuaJi_You') {
        const area=has(514221)?'AreaEffect_142_SkillSup_ZhuaJi_P21':'AreaEffect_142_SkillSup_ZhuaJi';
        api.area(area,'boss',{x:api.distance,z:0,angle:name==='ZhuaJi_Zuo'?-45:225,disableBuffs:true,
          enemyEnterBuffs:[...(has(514221)?[14221011]:[]),...(has(514222)?[14222011]:[])]});
        const claws=state.claws+1;
        if(claws%4===0) {
          if(has(514223))team(api,14223011);
          if(has(514224))team(api,14224011);
        }
        if(has(514227))api.buffs.add(api.main,14227011,api.actor);
        return {...state,claws};
      }
      if(name==='ZhuaJi_ZhongJie') {
        if(has(514224)){api.area('AreaEffect_142_SkillSup_ZhuaJi_P24_ZhongJie');team(api,14224011);}
        if(has(514227))api.buffs.add(api.main,14227011,api.actor);
      }
      return state;
    },
    beforeHit(_state,api,tags){return tags.includes(ULTRA)&&has(514241)&&api.distance<api.parameter(14241011)?[{id:14241001,count:1}]:[];},
    afterHit(state,api,tags){
      if(tags.includes(ULTRA)) {
        if(has(514242))api.buffs.add('boss',14242011,api.actor);
        if(has(514243))api.buffs.add('boss',14243011,api.actor);
      }
      if(tags.includes(SKILL)) {
        api.buffs.add('boss',14293015,api.actor);
        if(has(514225))api.buffs.add('boss',14225011,api.actor);
        if(has(514228)&&api.randomPercent()<api.parameter(14228011)) {api.buffs.add('boss',14228011,api.actor);team(api,14228012);}
        if(has(514229)&&api.randomPercent()<api.parameter(14229011)&&(state.lastToughness===null||api.time-state.lastToughness>1)) {
          api.toughnessDamage(api.parameter(14229002));state={...state,lastToughness:api.time};
        }
      }
      if(tags.includes(DARK)) {
        const marked=api.hasBuffTag('boss','Dark');
        if(has(514226)&&!marked)team(api,14226011);
        if(has(514230)&&marked)for(const actor of api.actorsByElement(6).filter(actor=>actor!==api.actor))api.buffs.add(actor,14230011,api.actor);
        api.buffs.add('boss',5011,api.actor);
      }
      return state;
    },
  };
}
