import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
import type {MainFactoryContext} from './combat-adapter-registry';
import {createCommon137} from './combat-common-137';
interface AlertState extends Record<string,unknown>{stage:number;lastNormal:number;lastEnergy:number;special:boolean;
  lastNormalProc:number;alert:boolean;generation:number;alertHits:number;lastSpread:number}
const NORMAL=hash('137NrmAtk'),CROSS=hash('137ShiZiZhanAtk'),ALERT=hash('137MainUavAtk');
const SELF=hash('137Self'),END=hash('137NrmAktEnd'),ULT=hash('137UltraAtk'),MARK=hash('137WindTagTrigger');
export function createMain137(potentials:Record<number,number>,context:MainFactoryContext):SupportCombatAdapter<AlertState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const common=createCommon137(potentials);
  const out=(follow=true)=>`AreaEffect_137_MainSkill_Ring_OutAtk${follow
    ?has(513703)&&has(513708)?'_P3P8':has(513703)?'_P3':has(513708)?'_P8':''
    :has(513708)?has(513703)?'_P3P8_P4':'_P8_P4':'_P4'}`;
  const inside=has(513703)?'AreaEffect_137_MainSkill_Ring_In_P3':'AreaEffect_137_MainSkill_Ring_In';
  const grenade=(api:SupportCombatApi)=>{if(has(513702)){api.randomPercent();api.randomPercent();api.projectile('Bullet_137_P2_ShouLei');}};
  const stop=(api:SupportCombatApi)=>{api.stopWeapons(out(),true);api.stopWeapons(inside,true);};
  const windSkill=(state:AlertState,api:SupportCombatApi,source:string)=>{
    common.skill(api,source);
    return state;
  };
  return {
    potentials:[513701,513702,513703,513704,513705,513706,513707,513708,513709,513710,513711,513712,513713,513741,513742,513743],
    actions:cinematics=>[
      {kind:'normal',skill:13710000,tag:'Atk1',normal:true,automatic:true},
      {kind:'skill',skill:13731000,tag:'Skill_Main'},
      common.ultimate(cinematics),
      // No incoming attacks in this profile: dodge has no automatic damage
      // trigger. Keep its native P12 recovery for explicit future policies.
      {kind:'dodge',skill:13720000,tag:[3],flag:16,automatic:true,spBudget:null,
        cooldown:context.skillCooldown(13720000)*(has(513712)?Math.max(0,1-context.parameter(13712011)/100):1)},
    ],
    initialize:()=>({stage:0,lastNormal:0,lastEnergy:0,special:false,lastNormalProc:0,alert:false,generation:0,alertHits:0,lastSpread:0}),
    automatic:()=> 'normal',
    cast(state,api,key){
      common.cast(api,key);
      if(key==='normal'){
        const cost=10-(has(513702)?api.parameter(13702011):0);
        const special=api.buffs.count(api.actor,13700012)>=cost;
        if(special){
          api.removeStacks(api.actor,13700012,cost);
          if(has(513703))api.buffs.add(api.actor,13703011,api.actor);
          if(has(513706))api.buffs.add(api.actor,13706011,api.actor);
          grenade(api);
        }
        return {...state,special,stage:api.time>state.lastNormal+2?0:state.stage};
      }
      if(key==='skill'){
        if(has(513704))api.buffs.add(api.actor,13704011,api.actor);
        if(has(513709)&&api.distance<=4)api.buffs.add(api.actor,13709011,api.actor);
      }
      return state;
    },
    partySkillCast:windSkill,
    partySkillChargeConsumed:windSkill,
    comboTag:(state,_api,key)=>key==='normal'?state.special
      ?has(513701)?has(513705)?'Atk_Sp_P1_P5':'Atk_Sp_P1':has(513705)?'Atk_Sp_P5':'Atk_Sp'
      :`Atk${state.stage+1}`:null,
    phase:(state,_api,key,phase)=>key==='normal'&&phase==='anticipation'&&!state.special?{...state,stage:(state.stage+1)%5}:state,
    end(state,api,key,interrupted){
      if(key==='normal'){
        if(interrupted&&state.special)api.buffs.remove(api.actor,13700012);
        return {...state,lastNormal:api.time};
      }
      return state;
    },
    custom(state,api,name){
      if(name==='137AddJingJieBuff'){
        api.buffs.add(api.actor,13700011,api.actor);
        if(has(513707))api.buffs.add(api.actor,13707011,api.actor);
        if(!state.alert){
          const generation=state.generation+1;api.schedule('alert-out',1/60,{generation});
          return {...state,alert:true,generation,alertHits:0,lastSpread:0};
        }
        return {...state,alertHits:0,lastSpread:0};
      }
      common.custom(api,name);
      return state;
    },
    tick(state,api){
      if(state.alert&&!api.buffs.count(api.actor,13700011)){
        stop(api);if(has(513707))api.buffs.remove(api.actor,13707011);
        return {...state,alert:false,generation:state.generation+1};
      }
      return state;
    },
    event(state,api,name,data){
      if(!name.startsWith('alert-')||data.generation!==state.generation||!api.buffs.count(api.actor,13700011))return state;
      stop(api);
      api.area(name==='alert-out'?out():inside,api.actor,{x:0,z:0});
      api.schedule(name==='alert-out'?'alert-in':'alert-out',has(513703)?.66:1,data);
      return state;
    },
    beforeHit(_state,api,tags){
      const once=common.beforeHit(api,tags);
      if(tags.includes(CROSS)){
        if(has(513701))once.push({id:13701011,count:1});
        if(has(513705))once.push({id:13705001,count:1});
      }
      if(has(513708)&&tags.includes(ALERT))once.push({id:13708001,count:1});
      return once;
    },
    afterHit(state,api,tags){
      common.afterHit(api,tags);
      if(tags.includes(NORMAL)){
        const cd=2-(has(513701)&&api.buffs.count(api.actor,13700011)?api.parameter(13701011):0);
        if((state.lastEnergy<=0||api.time>state.lastEnergy+cd)&&api.randomPercent()<=80){
          for(let i=0;i<2;i++)api.buffs.add(api.actor,13700012,api.actor);
          grenade(api);state={...state,lastEnergy:api.time};
        }
        if(has(513710)&&(state.lastNormalProc<=0||api.time>state.lastNormalProc+1)){
          api.buffs.add(api.actor,13710011,api.actor);state={...state,lastNormalProc:api.time};
        }
      }
      if(has(513704)&&tags.includes(ALERT)&&tags.includes(SELF)&&api.buffs.count(api.actor,13700011)){
        const alertHits=state.alertHits+1;
        if(alertHits>=2&&(state.lastSpread<=0||api.time>state.lastSpread+.5)){
          api.area(out(false));state={...state,alertHits:0,lastSpread:api.time};
        }else state={...state,alertHits};
      }
      return state;
    },
    mark:tags=>tags.includes(MARK)||has(513707)&&tags.includes(END)||has(513711)&&tags.includes(ULT)
      ?{element:4,variant:2,area:'AreaEffect_137_WindMark1_Bloom',radius:1.5}:null,
    markTriggered(state,api,element,_tags,source){
      if(has(513713)&&element===4&&api.actorInfo(source).element===4)for(const actor of api.actorsByElement(4))api.buffs.add(actor,13713011,api.actor);
      return state;
    },
  };
}
