import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
import type {SupportFactoryContext} from './combat-adapter-registry';
export interface FireworksState extends Record<string,unknown>{
  generation:number;residentUntil:number;normalStage:number;rushed:boolean;missiles:number;lastFollow:number|null;
}
const SKILL=hash('140_Support_Hurt'),P23=hash('140_P23'),P24=hash('140_P24'),P27=hash('140_P27'),P28=hash('140_P28');
const P42=hash('140_P42'),ULTRA=hash('140_Ultra'),MARK=hash('140_LandTag_Trigger');
/** Native volley counts and resident support attacks, with the raid
 * all-hits assumption rather than a spatial missile-landing search. */
export function createSupport140(potentials:Record<number,number>,context:SupportFactoryContext):SupportCombatAdapter<FireworksState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const enhanced=has(514021)&&Boolean(context.partyElements?.length&&context.partyElements.every(element=>element===3));
  const rush=(state:FireworksState,api:SupportCombatApi):FireworksState=>{
    if(!has(514022)||state.rushed)return state;
    for(let n=api.buffs.count(api.actor,14022011);n>0;n--)api.buffs.add(api.actor,14022012,api.actor);
    api.buffs.remove(api.actor,14022011);api.projectile('Bullet_140_Support_Skill_P22_Rush');
    return {...state,rushed:true};
  };
  return {
    potentials:[514021,514022,514023,514024,514025,514026,514027,514028,514029,514030,514031,514032,514033,514041,514042,514043],
    actions(cinematics){
      const skill=enhanced?has(514025)?'140_Support_Skill_Fireworks_P25P21':'140_Support_Skill_Fireworks_P21'
        :has(514025)?'140_Support_Skill_Fireworks_P25':'140_Support_Skill_Fireworks';
      const ultimate=has(514042)?'140_Ultra_NoTL_P42':'140_Ultra_NoTL';
      return [
        {kind:'skill',skill:14032000,tag:skill,loopCount:13,...(has(514022)?{loopFinishTag:'140_Support_Skill_Fireworks_P22_Rush'}:{})},
        {kind:'ultimate',skill:14040000,tag:cinematics?'140_Ultra_TL1':ultimate,
          ...(cinematics?{chain:[{tag:'140_Ultra_TL1'},{tag:has(514042)?'140_Ultra_TL2_P42':'140_Ultra_TL2'}]}:{})},
        ...(has(514023)?Array.from({length:3},(_,index)=>({
          kind:`resident:${index}`,skill:14010000,tag:`140_Attack_${index+1}_Support_${has(514028)?'P23P28':'P23'}`,
          automatic:true,normal:true,flag:2,
        })):[]),
      ];
    },
    initialize(api){
      if(has(514031))api.buffs.add(api.actor,14031011,api.actor);
      if(has(514032))api.buffs.add(api.actor,14032011,api.actor);
      if(has(514033))for(const actor of api.actorsByElement(3))api.buffs.add(actor,14033011,api.actor);
      return {generation:0,residentUntil:0,normalStage:0,rushed:false,missiles:0,lastFollow:null};
    },
    cast(state,api,key){
      if(key.startsWith('resident:'))return state;
      const generation=state.generation+1;
      if(key==='skill'){
        if(has(514026))api.buffs.add(api.actor,14026011,api.actor);
        if(has(514024))api.schedule('periodic-missile',0,{generation});
        if(has(514029))api.schedule('on-field-stack',api.parameter(14029011)+1/60,{generation});
      }
      if(key==='ultimate'&&has(514043))api.buffs.remove(api.actor,14043011);
      return {...state,generation,residentUntil:0,rushed:false};
    },
    end(state,api,key,interrupted){
      if(key==='skill'){
        state=rush(state,api);
        if(has(514030))api.buffs.add(api.actor,14030011,api.actor);
        if(!interrupted&&has(514023)&&api.actorInfo(api.main).element===3)
          return {...state,residentUntil:api.time+api.parameter(14023011)};
      }
      if(key==='ultimate'){
        if(has(514032))api.buffs.add(api.actor,14032012,api.actor);
        if(has(514041))for(let n=0;n<3;n++)api.drop('Item_140_Ultra_P41',{x:0,z:0});
      }
      if(key.startsWith('resident:'))return state;
      api.buffs.remove(api.actor,14029011);
      return {...state,generation:state.generation+1,residentUntil:0};
    },
    custom(state,api,name){
      if(name==='140_Support_Shoot'){
        for(let n=0;n<(enhanced?3:2);n++)api.schedule('missile',.5+n*.1);
        return {...state,missiles:state.missiles+(enhanced?3:2)};
      }
      if(name==='140_P22_Rage'&&has(514022))api.buffs.add(api.actor,14022011,api.actor);
      if(name==='140_P22_Rush')return rush(state,api);
      if(name==='140_P25'&&has(514025)){
        // A single target receives one aimed shell plus one distributed
        // shell per round in the all-hits profile.
        for(let round=0;round<(enhanced?4:2);round++)api.schedule('extra-missiles',1+round*3);
      }
      if(name==='140_Ultra_Area')api.area('AreaEffect_14001_Ultra');
      if(name==='140_Ultra_Shoot')api.area(has(514042)?'AreaEffect_14001_Ultra_Boom_P42':'AreaEffect_14001_Ultra_Boom');
      return state;
    },
    event(state,api,name,data){
      // ParallelScript's already-launched volleys survive skill end.
      if(name==='missile')api.projectile('Bullet_140_Support_Skill_Boom');
      if(name==='extra-missiles')for(let n=0;n<2;n++)api.projectile('Bullet_140_Support_Skill_P25_Boom');
      if(data.generation!==state.generation)return state;
      if(name==='periodic-missile'){
        api.projectile('Bullet_140_Support_Skill_P24_Boom');api.schedule(name,3.5+1/60,data);
      }
      if(name==='on-field-stack'){
        api.buffs.add(api.actor,14029011,api.actor);api.schedule(name,api.parameter(14029011)+1/60,data);
      }
      return state;
    },
    tick(state,api){
      if(state.residentUntil>0&&api.time>state.residentUntil&&!api.activeAction()){
        api.buffs.remove(api.actor,14029011);
        return {...state,residentUntil:0,generation:state.generation+1};
      }
      return state;
    },
    automatic:(state,api)=>state.residentUntil>api.time&&!api.activeAction()?`resident:${state.normalStage}`:null,
    phase(state,_api,key,phase){
      return key.startsWith('resident:')&&phase==='anticipation'?{...state,normalStage:(state.normalStage+1)%3}:state;
    },
    canCast:(state,api,key)=>!key.startsWith('resident:')||state.residentUntil>api.time,
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(has(514021)&&tags.includes(SKILL))once.push({id:14021011,count:1});
      if(has(514023)&&tags.includes(P23))once.push({id:14023011,count:1});
      if(has(514024)&&tags.includes(P24))once.push({id:14024011,count:api.actorsByElement(3).length});
      if(has(514028)&&tags.includes(P28))once.push({id:14028001,count:1});
      return once.filter(effect=>effect.count>0);
    },
    afterHit(state,api,tags){
      if(has(514042)&&tags.includes(P42))api.buffs.add('boss',14042011,api.actor);
      return state;
    },
    partyHit(state,api,hit){
      if(has(514041)&&hit.actor===api.main&&api.actorInfo(api.main).element===3&&hit.damageType===1
        &&api.buffs.count(api.main,14041011)>=3&&(state.lastFollow===null||api.time-state.lastFollow>api.parameter(14041011))){
        api.hit(140541001);return {...state,lastFollow:api.time};
      }
      return state;
    },
    mark:tags=>tags.includes(MARK)?{element:3,area:'AreaEffect_14001_LandTag1_Boom'}:null,
    markTriggered(state,api,element,tags,source){
      if(source===api.actor&&element===3){
        if(has(514027)&&tags.includes(P27))api.buffs.add(api.actor,14027011,api.actor);
        if(has(514043)&&tags.includes(ULTRA))api.buffs.add(api.actor,14043011,api.actor);
      }
      return state;
    },
  };
}
