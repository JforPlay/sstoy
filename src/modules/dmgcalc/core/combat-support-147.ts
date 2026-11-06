import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter} from './combat-support-adapter';
interface SoundState extends Record<string,unknown> {times:number[]}
const SWEEP=combatTagHash('147SkillSupHengSao'),SOUND=combatTagHash('147SkillSupYinBo');
const ULTRA=combatTagHash('147UltraAtk'),DARK=combatTagHash('147DarkTagTrigger');
export function createSupport147(potentials:Record<number,number>):SupportCombatAdapter<SoundState> {
  const has=(id:number)=>Boolean(potentials[id]);
  const sweep=`Skill_Sup_HengSao${has(514721)&&has(514726)?'_P21P26':has(514721)?'_P21':has(514726)?'_P26':''}`;
  return {
    potentials:[514721,514722,514723,514724,514725,514726,514727,514728,514729,514730,514731,514732,514733,514741,514742,514743],
    actions:cinematics=>[{kind:'skill',skill:14732000,tag:sweep,chain:[{tag:sweep,until:'activation'},
      {tag:has(514724)?'Skill_Sup_TanQin_P24':'Skill_Sup_TanQin'}]},
      {kind:'ultimate',skill:14740000,tag:cinematics?'Ultra_TimelineOn':'Ultra_TimelineOff'}],
    initialize(api){
      if(has(514733)) for(const actor of api.actorsByElement(6)) api.buffs.add(actor,14733011,api.actor);
      return {times:[]};
    },
    cast(state,api,key){if(key==='ultimate'&&has(514742)) api.buffs.add(api.actor,14742011,api.actor);return state;},
    custom(state,api,name){
      if(name==='147SkillSupTanQun' && (has(514729)||api.distance<10)) {
        if(has(514728)) api.buffs.add(api.actor,14728011,api.actor);
        api.projectile(has(514723)?'Bullet_147_Sup_YinBo_P23':'Bullet_147_Sup_YinBo');
      }
      return state;
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(SWEEP)) {
        for(const [potential,id] of [[514721,14721011],[514725,14725001],[514726,14726001]]) if(has(potential!)) once.push({id:id!,count:1});
        if(has(514727)&&api.distance<3) once.push({id:14727001,count:1});
      } else if(tags.includes(SOUND)) {
        const count=api.buffs.count('boss',14729011);
        if(has(514729)&&count) once.push({id:14729001,count});
        if(has(514730)) once.push({id:14730001,count:1});
      }
      if((tags.includes(SWEEP)||tags.includes(SOUND))&&has(514732)&&api.buffs.count('boss',14790000)>0) once.push({id:14732001,count:1});
      if(tags.includes(ULTRA)&&has(514741)&&api.buffs.count('boss',14790000)>0) once.push({id:14741001,count:1});
      return once;
    },
    afterHit(state,api,tags){
      if(tags.includes(ULTRA)&&has(514743)) api.buffs.add(api.actor,14743011,api.actor);
      if(tags.includes(SOUND)&&has(514729)) api.buffs.add('boss',14729011,api.actor);
      if(!tags.includes(SWEEP)||!has(514722)) return state;
      const times=state.times.filter(time=>time>=api.time-api.parameter(14722011));
      if(times.length>=4) return {...state,times};
      api.reduceCooldown(-api.parameter(14722012));
      api.area('AreaEffect_147_P22_AOE');
      return {...state,times:[...times,api.time]};
    },
    mark:tags=>tags.includes(DARK)?{element:6,buffTag:'DarkMark1',hit:147100000,applyBuff:14790000}:null,
    markTriggered(state,api,element,tags,source){
      if(source===api.actor&&element===6&&has(514731)&&(tags.includes(SWEEP)||tags.includes(SOUND))) api.buffs.add(api.actor,14731011,api.actor);
      return state;
    },
  };
}
