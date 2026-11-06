import {combatTagHash as hash} from './combat-tags';
import {createSupport157,type FishState} from './combat-support-157';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface HunterState extends FishState{
  hunting:boolean;huntGeneration:number;fishActive:boolean;normalTag:string;
  lastP1:number|null;lastP5:number|null;ultimateHits:number;fishAttacks:number;
}
const P1=hash('157P1Trigger'),FISH=hash('157FishAtk'),P9=hash('157P9Trigger');
export function createMain157(potentials:Record<number,number>):SupportCombatAdapter<HunterState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const common=createSupport157(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=515741)));
  const energy=(api:SupportCombatApi,count:number)=>{for(let n=0;n<count;n++)api.buffs.add(api.actor,15790011,api.actor);};
  const breakHunt=(state:HunterState,api:SupportCombatApi):HunterState=>{
    if(!state.hunting)return state;
    api.buffs.remove('boss',15790012);api.buffs.remove(api.actor,15790013);api.buffs.remove(api.actor,15703012);
    if(has(515708)){api.area('AreaEffect_157_P8_HuntBreak');api.buffs.add(api.actor,15708011,api.actor);}
    return {...state,hunting:false};
  };
  return {
    potentials:[515701,515702,515703,515704,515705,515706,515707,515708,515709,515710,515711,515712,515713,515741,515742,515743],
    actions:cinematics=>[
      {kind:'normal',skill:15710000,tag:'Atk1',normal:true,automatic:true},
      {kind:'hunt',skill:15710001,tag:'Atk_SuoLian',normal:true,automatic:true},
      {kind:'skill',skill:15731000,tag:'Skill_Main'},
      ...(has(515712)?[{kind:'dodge',skill:15720000,tag:[3],automatic:true,flag:16,charges:2,spBudget:null}]:[]),
      common.actions(cinematics)[1]!,
    ],
    initialize(api){
      energy(api,100);api.schedule('energy',61/60);
      if(has(515713)){
        const dark=api.actorsByElement(6);
        for(const _ of dark){
          api.buffs.add(api.actor,15713011,api.actor);
          for(const actor of api.party)api.buffs.add(actor,15713012,api.actor);
        }
      }
      return {...common.initialize(api),hunting:false,huntGeneration:0,fishActive:false,normalTag:'Atk1',
        lastP1:null,lastP5:null,ultimateHits:0,fishAttacks:0};
    },
    automatic(state,api){
      if(has(515712)&&!api.buffs.count(api.actor,15712011)&&api.skillReady?.('dodge'))return 'dodge';
      return api.buffs.count(api.actor,15790011)>=(api.buffLimit?.(15790011) ?? 100)?'hunt':'normal';
    },
    canCast:(_state,api,key)=>key!=='hunt'||api.buffs.count(api.actor,15790011)>=(api.buffLimit?.(15790011) ?? 100),
    comboTag:(state,_api,key)=>key==='normal'?state.normalTag:null,
    cast(state,api,key){
      if(key==='hunt'){
        api.buffs.remove(api.actor,15790011);
        if(has(515704))api.buffs.add(api.actor,15704011,api.actor);
      }
      if(key==='dodge')api.buffs.add(api.actor,15712011,api.actor);
      if(key==='normal')return {...state,normalTag:has(515703)&&state.hunting?'Atk_P3':api.randomPercent()<50?'Atk1':'Atk2'};
      if(key==='ultimate')return {...state,...common.cast!(state,api,key)};
      return state;
    },
    end(state,api,key){
      if(key==='skill'){
        api.buffs.remove(api.actor,1004);
        if(has(515702)){
          api.buffs.add(api.actor,15702011,api.actor);
          if(!state.fishActive){api.schedule('fish-attack',61/60);return {...state,fishActive:true};}
        }
      }
      return key==='ultimate'?{...state,...common.end!(state,api,key,false)}:state;
    },
    custom(state,api,name){
      if(name==='BaTiStart')api.buffs.add(api.actor,1004,api.actor);
      if(name==='BaTiEnd')api.buffs.remove(api.actor,1004);
      if(name==='154MainShot')api.schedule('skill-boom',.35);
      if(name==='157paosuolian'){
        state=breakHunt(state,api);
        api.buffs.add('boss',15790012,api.actor);
        if(has(515704))api.extendBuff?.('boss',15790012,api.parameter(15704011));
        if(api.distance<=10)api.buffs.add(api.actor,15790013,api.actor);
        const huntGeneration=state.huntGeneration+1;
        if(has(515704)&&api.distance<=10)api.schedule('hunt-link',61/60,{huntGeneration});
        if(has(515703)){
          for(let n=0;n<3;n++)api.buffs.add(api.actor,15703011,api.actor);
          api.buffs.add(api.actor,15703012,api.actor);
          api.schedule('p3-decay',api.parameter(15703011),{huntGeneration});
        }
        return {...state,hunting:true,huntGeneration};
      }
      if(name==='157pugong'){
        const stacks=has(515703)?api.buffs.count(api.actor,15703011):0;
        api.projectile(stacks>=1&&stacks<=3?`Bullet_157_NrmAtk_1_Num${stacks+1}`:'Bullet_157_NrmAtk_1');
      }
      if(name==='157diaoshe'&&has(515703)){
        const count=api.buffs.count(api.actor,15703011)+1;
        const bullets:Record<number,number[]>={1:[3],2:[2,4],3:[2,3,4],4:[1,2,3,4]};
        for(const index of bullets[count] ?? [])api.projectile(`Bullet_157_P3_DiaoShe${index}`);
      }
      return {...state,...common.custom!(state,api,name)};
    },
    event(state,api,name,data){
      if(name==='energy'){energy(api,10);api.schedule(name,1);return state;}
      if(name==='skill-boom'){api.area('AreaEffect_157_SkillMain_ShotBoom');return state;}
      if(name==='hunt-link'&&data.huntGeneration===state.huntGeneration&&state.hunting&&api.buffs.count('boss',15790012)){
        api.hit(157300005);energy(api,10);api.schedule(name,1,data);return state;
      }
      if(name==='p3-decay'&&data.huntGeneration===state.huntGeneration&&api.buffs.count(api.actor,15703011)){
        api.removeStacks(api.actor,15703011,1);api.schedule(name,api.parameter(15703011),data);return state;
      }
      if(name==='fish-attack'){
        if(!api.buffs.count(api.actor,15702011))return {...state,fishActive:false};
        // Once attacking, the native entity finishes its strike even when
        // the enabling buff expires. Its return path does not reset its timer.
        api.schedule('fish-area',1/60,{area:'AreaEffect_157_P2_FishAtk_Act1'});
        api.schedule('fish-area',25/60,{area:'AreaEffect_157_P2_FishAtk'});
        api.schedule('fish-area',.45,{area:'AreaEffect_157_P2_FishAtk_Act2'});
        api.schedule('fish-recover',38/60);
        return {...state,fishAttacks:state.fishAttacks+1};
      }
      if(name==='fish-area'){api.area(String(data.area));return state;}
      if(name==='fish-recover'){
        if(!api.buffs.count(api.actor,15702011))return {...state,fishActive:false};
        api.schedule('fish-attack',1);return state;
      }
      return {...state,...common.event!(state,api,name,data)};
    },
    tick(state,api){return state.hunting&&!api.buffs.count('boss',15790012)?breakHunt(state,api):state;},
    beforeHit(state,api,tags){
      const once=common.beforeHit!(state,api,tags),burning=api.hasBuffTag('boss','DarkAnZhuo');
      const allDark=api.actorsByElement(6).length===api.party.length;
      if(has(515701)&&burning)once.push({id:15701011,count:1});
      if(has(515707)&&allDark&&burning&&tags.includes(FISH))once.push({id:15707001,count:1});
      if(has(515709)&&allDark&&burning&&tags.includes(P9)&&api.skillReady?.('skill'))once.push({id:15709001,count:1});
      return once;
    },
    afterHit(state,api,tags,hit){
      if(has(515701)&&tags.includes(P1)&&(state.lastP1===null||api.time-state.lastP1>api.parameter(15701011))){
        api.area('AreaEffect_157_P1_FishAtk');state={...state,lastP1:api.time};
      }
      if(has(515705)&&hit.damageType===3&&(state.lastP5===null||api.time-state.lastP5>api.parameter(15705011))){
        const ultimateHits=state.ultimateHits+1;
        if(ultimateHits>=5){api.area('AreaEffect_157_P5_FishAtk');state={...state,lastP5:api.time,ultimateHits:0};}
        else state={...state,ultimateHits};
      }
      if(has(515706)&&tags.includes(FISH)){
        api.buffs.add(api.actor,15706011,api.actor);
        for(const actor of api.actorsByElement(6))if(actor!==api.actor&&api.actorInfo(actor).job===2)api.buffs.add(actor,15706012,api.actor);
      }
      return state;
    },
    mark:tags=>common.mark!(tags),
    markTriggered(state,api,element,_tags,source){
      if(element===6&&source===api.actor){
        if(has(515710)&&state.hunting)api.buffs.add(api.actor,15710011,api.actor);
        if(has(515711))api.buffs.add(api.actor,15711011,api.actor);
      }
      return state;
    },
  };
}
