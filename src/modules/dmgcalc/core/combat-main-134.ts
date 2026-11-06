import {combatTagHash as hash} from './combat-tags';
import {createSupport134,type FlameState} from './combat-support-134';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface MainFlameState extends FlameState{
  ammo:number;normalStage:number;strongStage:number;specialStage:number;
  specialReady:boolean;mode:'normal'|'strong'|'special';
  lastNormalEnd:number;
}
const STRONG=hash('134_Strengthen_Attack'),NORMAL=hash('134_Normal_Attack'),SKILL=hash('134_Main_Hurt');
const P5=hash('134_P05'),P9=hash('134_P09');
export function createMain134(potentials:Record<number,number>):SupportCombatAdapter<MainFlameState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const common=createSupport134(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=513441)));
  const refresh=(state:MainFlameState,api:SupportCombatApi)=>{
    if(has(513404)){
      if(state.ammo>0)api.buffs.remove(api.actor,13404011);
      else if(!api.buffs.count(api.actor,13404011))api.buffs.add(api.actor,13404011,api.actor);
    }
    return state;
  };
  function normalTag(state:MainFlameState){
    if(state.mode==='normal')return `Attack_${state.normalStage+1}`;
    const stage=state.mode==='special'?state.specialStage:state.strongStage;
    if(state.mode==='special')return has(513402)?has(513406)&&stage===2?'Attack_Strengthen_P02P04P06':'Attack_Strengthen_P02P04'
      :has(513406)&&stage===2?'Attack_Strengthen_P04P06':'Attack_Strengthen_P04';
    if(has(513402))return has(513406)&&stage===2?'Attack_Strengthen_P02P06_3':`Attack_Strengthen_P02_${stage+1}`;
    return has(513406)&&stage===2?'Attack_Strengthen_P06_3':`Attack_Strengthen_${stage+1}`;
  }
  return {
    potentials:[513401,513402,513403,513404,513405,513406,513407,513408,513409,513410,513411,513412,513413,513441,513442,513443],
    actions:cinematics=>[
      {kind:'normal',skill:13410000,tag:'Attack_1',normal:true,automatic:true},
      {kind:'skill',skill:13431000,tag:has(513401)?'134_Main_Skill_P01':'134_Main_Skill'},
      common.actions(cinematics)[1]!,
    ],
    initialize(api){
      if(has(513410))api.schedule('p10',8+1/60);
      if(has(513411)&&api.actorsByElement(2).length===api.party.length)api.buffs.add(api.actor,13411011,api.actor);
      return refresh({...common.initialize(api),ammo:0,normalStage:0,strongStage:0,specialStage:0,specialReady:false,mode:'normal',lastNormalEnd:0},api);
    },
    automatic:()=> 'normal',
    comboTag:(state,_api,key)=>key==='normal'?normalTag(state):null,
    cast(state,api,key){
      if(key==='normal')return {...state,normalStage:api.time-state.lastNormalEnd>2?0:state.normalStage,
        mode:state.ammo>0?state.specialReady?'special':'strong':'normal'};
      if(key==='skill'&&has(513407))api.buffs.remove(api.actor,13407011);
      return key==='skill'?{...state,normalStage:0,strongStage:0}:key==='ultimate'?{...state,normalStage:0}:state;
    },
    end(state,api,key,interrupted){
      if(key==='ultimate')return {...state,...common.end!(state,api,key,interrupted)};
      if(key==='skill'&&has(513404))return {...state,specialReady:true};
      if(key==='normal')return {...state,lastNormalEnd:api.time,specialReady:state.mode==='special'?false:state.specialReady};
      return state;
    },
    custom(state,api,name){
      if(name==='Add_Ammo_End'){
        if(has(513408)){api.buffs.add(api.actor,13408011,api.actor);api.buffs.add(api.actor,13408012,api.actor);}
        return refresh({...state,ammo:has(513401)?9:3},api);
      }
      if(name==='Use_Bullet')return refresh({...state,ammo:Math.max(0,state.ammo-(state.mode==='special'?3:1))},api);
      if(name==='Attack_End'){
        if(state.mode!=='normal'){
          if(has(513407))api.buffs.add(api.actor,13407011,api.actor);
          if(has(513410))api.buffs.remove(api.actor,13410011);
        }
        return state.mode==='normal'?{...state,normalStage:(state.normalStage+1)%5}
          :state.mode==='special'?{...state,specialStage:(state.specialStage+1)%3}:{...state,strongStage:(state.strongStage+1)%3};
      }
      return {...state,...common.custom!(state,api,name)};
    },
    event(state,api,name,data){
      if(name==='p10'){api.buffs.add(api.actor,13410011,api.actor);api.schedule(name,8+1/60);return state;}
      if(name==='p9-boom'){api.area('AreaEffect_13401_Main_Skill_P09_Boom');return state;}
      return {...state,...common.event!(state,api,name,data)};
    },
    beforeHit(state,api,tags){
      const once=common.beforeHit!(state,api,tags);
      if(tags.includes(STRONG)){
        if(has(513405))once.push({id:13405001,count:1});
        if(has(513407))once.push({id:13407001,count:api.buffs.count(api.actor,13407011)});
        if(has(513410)&&api.buffs.count(api.actor,13410011))once.push({id:13410001,count:1});
      }
      if(has(513413)&&(api.bossHpPercent?.() ?? 1)<api.parameter(13413011)/100)once.push({id:13413001,count:1});
      return once.filter(effect=>effect.count>0);
    },
    afterHit(state,api,tags){
      if(has(513403)&&tags.includes(SKILL))api.buffs.add('boss',13403011,api.actor);
      if(has(513403)&&tags.includes(NORMAL)&&api.buffs.count('boss',13403011))api.hit(134503001);
      if(has(513409)&&tags.includes(P9)){
        const buffs=[13409011,13409012,13409013,13409014];
        const at=buffs.findIndex(id=>api.buffs.count('boss',id)>0);
        if(at<0)api.buffs.add('boss',buffs[0]!,api.actor);
        else if(at<3){
          api.buffs.remove('boss',buffs[at]!);api.buffs.add('boss',buffs[at+1]!,api.actor);
          if(at===2)api.schedule('p9-boom',1);
        }
      }
      // Attack_Sector starts beyond the struck enemy and faces away from
      // it. In a single-boss profile it is splash, not a second boss hit.
      return state;
    },
    crit(state,api){if(has(513412))api.buffs.add(api.actor,13412011,api.actor);return state;},
    areaEnd(state,api,name){
      if(name==='AreaEffect_13401_Main_Skill_P09_Boom')api.buffs.remove('boss',13409014);
      return state;
    },
    mark:tags=>common.mark!(tags) ?? (has(513405)&&tags.includes(P5)?{element:2,variant:2,buffTag:'Fire',hit:134000001}:null),
    markTriggered:(state,api,element,tags,source)=>({...state,...common.markTriggered!(state,api,element,tags,source)}),
  };
}
