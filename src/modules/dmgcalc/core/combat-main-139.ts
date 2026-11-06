import {combatTagHash as hash} from './combat-tags';
import {createSupport139} from './combat-support-139';
import type {SupportCombatAdapter,SupportCombatAction,SupportCombatApi} from './combat-support-adapter';
import type {MainFactoryContext} from './combat-adapter-registry';
interface SoulState extends Record<string,unknown>{stage:number;lastNormalEnd:number;gotSoul:boolean;lastP2:number;lastP7:number;
  secondUntil:number;hadFirst:boolean;tides:number;rushGeneration:number}
const B=hash('139_B1'),P2=hash('139_P02'),P6=hash('139_P06'),P10=hash('139_P10');
const WATER=hash('139_WaterTrigger'),WATER10=hash('139_WaterTrigger_P10'),U1=hash('139_Ultra_1'),U2=hash('139_Ultra_2');
const NORMAL_MAPPING=Object.fromEntries(Array.from({length:9},(_,i)=>[139100001+i,139100101+i]));
const P8_MAPPING=Object.fromEntries(Array.from({length:9},(_,i)=>[139100001+i,139100201+i]));
export function createMain139(potentials:Record<number,number>,context:MainFactoryContext):SupportCombatAdapter<SoulState>{
  const has=(id:number)=>Boolean(potentials[id]),water=context.partyElements?.every(element=>element===1) ?? false;
  const p1=has(513901)&&water,soulId=p1?13900002:13900001;
  const common=createSupport139(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=513941)),context);
  const first=(api:SupportCombatApi)=>api.hasBuffTag(api.actor,'139_Ultra_Buff');
  const souls=(api:SupportCombatApi)=>api.buffs.count(api.actor,13900001)+api.buffs.count(api.actor,13900002);
  const full=(api:SupportCombatApi)=>souls(api)>=(api.buffLimit!(soulId));
  const free=(api:SupportCombatApi)=>full(api)&&(has(513903)||p1);
  function addSoul(api:SupportCombatApi,count:number){
    for(let i=0;i<count;i++){
      const before=souls(api);
      if(p1)api.removeStacks(api.actor,13900003,1);
      api.buffs.add(api.actor,soulId,api.actor);
      if(has(513906)&&souls(api)>before)api.buffs.add(api.actor,13906011,api.actor);
    }
  }
  function takeSoul(api:SupportCombatApi,dark=false){
    const count=souls(api);api.buffs.remove(api.actor,13900001);api.buffs.remove(api.actor,13900002);
    if(dark)for(let i=0;i<count;i++)api.buffs.add(api.actor,13900003,api.actor);
  }
  return {
    potentials:[513901,513902,513903,513904,513905,513906,513907,513908,513909,513910,513911,513912,513913,513941,513942,513943],
    actions(cinematics){
      const tag=cinematics?'139_Ultra_TL':'139_Ultra_NoTL';
      const second=[{tag:'139_Ultra2_Start',until:'activation' as const},{tag:has(513943)?'139_Ultra2_Atk_P43':'139_Ultra2_Atk'}];
      const actions:SupportCombatAction[]=[{kind:'normal',skill:13910000,tag:'Atk1',normal:true,automatic:true},
        {kind:'skill',skill:13931000,tag:'139_Skill_Main_1',chain:[{tag:'139_Skill_Main_1',until:'activation'},
          {tag:'139_Skill_Main_2',until:'activation'},{tag:'139_Skill_Main_3'}]},
        {kind:'ultimate',skill:13940000,tag,cooldownTiming:'end'},
        {kind:'ultimate-second',skill:13940001,tag:'139_Ultra2_Start',chain:second,flag:32,spCost:0}];
      if(has(513903)||p1)actions.push(has(513903)
        ?{kind:'soul-ultimate',skill:13931001,tag,flag:32,cooldown:0,spCost:0}
        :{kind:'soul-ultimate',skill:13931002,tag:'139_Ultra2_Start',chain:second,flag:32,cooldown:0,spCost:0});
      if(has(513911))actions.push({kind:'dodge',skill:13920000,tag:[3],flag:16,automatic:true});
      if(has(513913))actions.push({kind:'rush',skill:13970000,tag:[3,11],flag:8,
        loopSeconds:Math.max(1,context.parameter(13913011)+1/60)});
      return actions;
    },
    comboArea:common.comboArea,
    initialize(api){
      if(has(513907)&&water)api.buffs.add(api.actor,13907012,api.actor);
      if(has(513913))for(const _actor of api.actorsByElement(1))api.buffs.add(api.actor,13913011,api.actor);
      return {stage:0,lastNormalEnd:0,gotSoul:false,lastP2:0,lastP7:0,secondUntil:0,hadFirst:false,tides:0,rushGeneration:0};
    },
    automatic(_state,api){return has(513911)&&!api.buffs.count(api.actor,13911011)&&api.skillReady!('dodge')?'dodge':'normal';},
    canCast(state,api,key){
      if(key==='ultimate')return state.secondUntil<=api.time;
      if(key==='ultimate-second')return state.secondUntil>api.time;
      if(key==='soul-ultimate')return free(api)&&!(has(513903)&&water&&first(api));
      if(key==='skill')return !free(api)&&!(has(513903)&&water&&first(api));
      if(key==='rush')return (api.activeAction()===null||api.activeAction()==='normal')&&!full(api)
        &&!api.buffs.count(api.actor,13913012)&&!(has(513903)&&first(api));
      return true;
    },
    comboTag:(state,api,key)=>key==='normal'?`Atk${state.stage+1}${has(513910)&&water&&first(api)?'_P10':''}`:null,
    cast(state,api,key){
      if(key==='normal')return api.time-state.lastNormalEnd>2?{...state,stage:0}:state;
      if(key==='dodge'){api.buffs.add(api.actor,13911011,api.actor);return state;}
      const second=key==='ultimate-second'||key==='soul-ultimate'&&!has(513903);
      if(has(513905)&&(key==='skill'||second))api.buffs.add(api.actor,13905011,api.actor);
      if(key==='ultimate'||key==='soul-ultimate'&&has(513903))api.emitProc!('own-ultimate-first-stage-start');
      if(second)api.emitProc!('own-ultimate-second-stage-start');
      if(key==='rush'){
        const rushGeneration=state.rushGeneration+1;
        api.schedule('rush-soul',(Math.floor(api.parameter(13913011)*60)+1)/60,{rushGeneration});
        return {...state,rushGeneration};
      }
      return {...state,gotSoul:key==='skill'?false:state.gotSoul,secondUntil:key==='ultimate-second'?0:state.secondUntil};
    },
    phase(state,api,key,phase){
      if(key==='normal'&&phase==='anticipation')return {...state,stage:(state.stage+1)%5};
      if(key==='ultimate'&&phase==='activation')return {...state,secondUntil:api.time+6};
      return state;
    },
    end(state,api,key){
      if(key==='normal')return {...state,lastNormalEnd:api.time};
      if(key==='ultimate-second'||key==='soul-ultimate'&&!has(513903)){
        if(has(513907)&&water&&(state.lastP7<=0||api.time-state.lastP7>api.parameter(13907013))){
          api.buffs.add(api.actor,13907001,api.actor);return {...state,lastP7:api.time};
        }
      }
      return key==='rush'?{...state,rushGeneration:state.rushGeneration+1}:state;
    },
    tick(state,api){
      const hadFirst=first(api);
      if(state.hadFirst&&!hadFirst){
        api.buffs.remove(api.actor,13903011);api.buffs.remove(api.actor,13903012);
        if(has(513909)){const count=api.buffs.count(api.actor,13909011);api.buffs.remove(api.actor,13909011);addSoul(api,count);}
        return {...state,hadFirst,tides:0};
      }
      return hadFirst!==state.hadFirst?{...state,hadFirst}:state;
    },
    custom(state,api,name){
      if(name==='Event_P02'&&has(513902)&&(api.activeAction()==='normal'||souls(api)>0)){
        const id=has(513907)&&water&&api.buffs.count(api.actor,13907001)?13907002:13902011;
        if(state.lastP2<=0||api.time-state.lastP2>api.parameter(id)){
          if(!has(513903)||!first(api))addSoul(api,1);
          const index=Math.min(2,Math.floor(api.randomPercent()/100*3)),suffix=['A','B','C'][index];
          const angle=api.randomPercent()/100*Math.PI*2,radius=Math.sqrt(api.randomPercent()/100);
          api.area(`AreaEffect_13901_Main_${has(513905)?'P07':'P02'}_${suffix}`,'boss',
            {x:api.distance+Math.cos(angle)*radius,z:Math.sin(angle)*radius});
          return {...state,lastP2:api.time};
        }
      }
      if(name==='139_Ultra1_AddBuff'){
        if(has(513903)){takeSoul(api);api.buffs.add(api.actor,p1?13903012:13903011,api.actor);}
        api.buffs.add(api.actor,has(513904)?13904011:13994011,api.actor);
        if(has(513941))api.buffs.add(api.actor,13941011,api.actor);
        return {...state,hadFirst:true};
      }
      if(name==='Event_139_Ultra1_Area')api.area('AreaEffect_13901_Ultra1','boss',
        {x:0,z:0,scale:has(513942)?1+api.parameter(13942001):1});
      if(name==='139_Ultra2_AddBuff'){
        if(api.activeAction()==='soul-ultimate'&&p1&&!has(513903))takeSoul(api,true);
        if(has(513941))api.buffs.add(api.actor,13941011,api.actor);
      }
      return state;
    },
    replaceNoDamageHit(id){
      if(has(513905)&&[139400002,139543002].includes(id))return id===139400002?139400302:139543302;
      if(has(513908)&&water&&(P8_MAPPING[id]||id===139400001))return id===139400001?139400201:P8_MAPPING[id];
      return NORMAL_MAPPING[id]??({139400001:139400101,139400002:139400102,139543002:139543102} as Record<number,number>)[id];
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(has(513902)&&tags.includes(P2)&&souls(api))once.push({id:13902011,count:souls(api)});
      if(has(513906)&&tags.includes(P6)&&api.buffs.count(api.actor,13906011))once.push({id:13906001,count:api.buffs.count(api.actor,13906011)});
      if(has(513910)&&water&&first(api)&&tags.includes(P10))once.push({id:13910001,count:1});
      if(has(513942)&&tags.includes(U1))once.push({id:13942001,count:1});
      if(has(513943)&&tags.includes(U2))once.push({id:13943001,count:1});
      return once;
    },
    afterHit(state,api,tags,hit){
      if(has(513912)&&hit.damageType===5)api.buffs.add(api.actor,13912011,api.actor);
      if(tags.includes(B)&&!state.gotSoul&&(!has(513903)||!first(api))){addSoul(api,1);return {...state,gotSoul:true};}
      return state;
    },
    shieldChanged(state,api,shield,added){if(has(513911)&&added&&shield.owner===api.actor)api.buffs.add(api.actor,13911011,api.actor);return state;},
    mark:(tags,_state,api)=>tags.includes(WATER)||has(513910)&&water&&Boolean(api&&first(api))&&tags.includes(WATER10)
      ?{element:1,variant:2,buffTag:'Water',hit:139000001,afterHitBuffs:[4031]}:null,
    markTriggered(state,api,element,_tags,source){
      if(element!==1||source!==api.actor)return state;
      const count=api.buffs.count('boss',4031),maximum=api.buffLimit!(4031);
      const special=has(513904)&&first(api),trigger=special?count%api.parameter(13904011)===0:count>=maximum;
      if(count>=maximum)api.buffs.remove('boss',4031);
      if(!trigger)return state;
      api.area(special?'AreaEffect_13901_WaterTrigger_P04':'AreaEffect_13901_WaterTrigger');
      if(has(513909)&&first(api)){
        const tides=state.tides+1;
        if(tides>=api.parameter(13909001)){
          api.buffs.add(api.actor,13909011,api.actor);api.buffs.add(api.actor,13909012,api.actor);return {...state,tides:0};
        }
        return {...state,tides};
      }
      return state;
    },
    event(state,api,name,data){
      if(name==='rush-soul'&&Number(data.rushGeneration)===state.rushGeneration&&api.activeAction()==='rush'
        &&!full(api)&&!api.buffs.count(api.actor,13913012)&&!(has(513903)&&first(api))){
        api.buffs.add(api.actor,13913012,api.actor);addSoul(api,3);
      }
      return state;
    },
  };
}
