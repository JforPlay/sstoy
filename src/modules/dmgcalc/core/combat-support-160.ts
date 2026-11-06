import {combatTagHash as hash} from './combat-tags';
import {willowSupportSkill,willowDecibelState} from './combat-willow-support-state';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
import type {SupportFactoryContext} from './combat-adapter-registry';

interface WillowState extends Record<string,unknown>{
  resident:boolean;remaining:number;lastTick:number;paused:boolean;returning:boolean;decibels:number;mode:0|1|2;
  shots:number;canLine:boolean;link:number;field:boolean;fieldStarted:number;shieldTime:number;softNext:number;
  lastMark:number|null;lastMain:number|null;ultimateGeneration:number;talentNext:number;onField:boolean;
}
const FIELD='AreaEffect_160_SupArea_Tag',ULTRA=hash('160_Ultra'),BULLET=hash('160_B2_Bullet');
const RAY21=hash('160_B2_Ray21'),RAY22=hash('160_B2_Ray22'),P25=hash('160_B2_P25'),P26=hash('160_P26');

/** Resident support state, native action priority, resources and parallel effects. */
export function createSupport160(potentials:Record<number,number>,context:SupportFactoryContext):SupportCombatAdapter<WillowState>{
  const has=(n:number)=>Boolean(potentials[516000+n]);
  const group=(api:SupportCombatApi,id:number,count=1)=>{for(const actor of api.party)for(let n=0;n<count;n++)api.buffs.add(actor,id,api.actor);};
  const updateMode=(state:WillowState,api:SupportCombatApi):WillowState=>{
    const mode=willowDecibelState(state.resident,state.decibels);
    if(mode===state.mode)return state;
    for(const actor of api.party){
      if(mode)api.buffs.add(actor,16000008,api.actor);else api.buffs.remove(actor,16000008);
      if(mode===2||mode===1&&has(21))api.buffs.add(actor,16000009,api.actor);else api.buffs.remove(actor,16000009);
    }
    if(mode===1&&has(27))group(api,16027011);
    return {...state,mode,softNext:api.time+2+1/60};
  };
  const decibel=(state:WillowState,api:SupportCombatApi,amount:number):WillowState=>{
    if(amount>=0){for(let n=0;n<amount;n++)api.buffs.add(api.actor,16000001,api.actor);}
    else {api.removeStacks(api.actor,16000001,-amount);if(has(29))group(api,16029011);}
    return updateMode({...state,decibels:api.buffs.count(api.actor,16000001)},api);
  };
  const field=(state:WillowState,api:SupportCombatApi):WillowState=>{
    api.stopWeapons('AreaEffect_16001_SupArea');
    api.buffs.add(api.actor,16000011,api.actor);
    api.area(context.breakthrough>=2?'AreaEffect_16001_SupArea_T2':'AreaEffect_16001_SupArea',api.actor,
      {x:0,z:0,...(has(28)?{growth:{interval:.1,step:.005,maximum:60}}:{})});
    return {...state,field:true,fieldStarted:api.time};
  };
  const choose=(state:WillowState,api:SupportCombatApi)=>{
    const skill=willowSupportSkill({resident:state.resident,paused:state.paused,decibelState:state.mode,
      canRotate:state.decibels>=40,canLine:state.canLine,canTorrential:state.decibels>=(api.buffLimit?.(16000001) ?? 100)},potentials,16032003);
    return skill===16032005?'rotate':skill===16032004?'line':skill===16032006?'torrent':skill===16032003?'resident':null;
  };
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>516000+n),
    actions:cinematics=>[{kind:'skill',skill:16032000,tag:'160_Sup'},
      {kind:'ultimate',skill:16040000,tag:cinematics?'160_Ultra_TL':'160_Ultra_NoTL'},
      {kind:'resident',skill:16032003,tag:'160_Sup_Shoot',flag:64,automatic:true},
      ...(has(21)?[{kind:'line',skill:16032004,tag:'160_Sup_Perk21',flag:64,automatic:true}]:[]),
      ...(has(22)?[{kind:'rotate',skill:16032005,tag:'160_Sup_Perk22',flag:64,automatic:true}]:[]),
      ...(has(23)?[{kind:'torrent',skill:16032006,tag:has(24)?'160_Sup_Perk24Perk23':'160_Sup_Perk23',flag:64,automatic:true,scriptedLoop:true}]:[]),
      {kind:'return',skill:16032007,tag:'160_Sup_Back',flag:64,automatic:true},
      {kind:'exit',skill:16032001,tag:'160_Sup_Out',flag:64,automatic:true}],
    initialize(api){
      if(has(33))group(api,16033011,api.actorsByElement(1).length);
      return {resident:false,remaining:0,lastTick:api.time,paused:false,returning:false,decibels:0,mode:0,
        shots:0,canLine:false,link:0,field:false,fieldStarted:0,shieldTime:0,softNext:0,lastMark:null,lastMain:null,ultimateGeneration:0,talentNext:0,onField:false};
    },
    cast(state,api,key){
      state={...state,link:0};
      if(!state.onField&&['skill','ultimate'].includes(key)){
        state.onField=true;state.talentNext=api.time+api.parameter(16096411);
        if(has(32))group(api,16032011);
      }
      if(key==='skill'){
        api.buffs.remove(api.actor,16000001);
        state=updateMode({...state,decibels:0,remaining:17,lastTick:api.time,shots:0,field:false},api);
        if(has(23))state=decibel(state,api,70);
      }
      if(key==='ultimate'&&state.resident)state.paused=true;
      if(key==='line'){state.canLine=false;state=decibel(state,api,30);}
      if(key==='rotate')state=decibel(state,api,-40);
      if(key==='torrent')group(api,16023011);
      return state;
    },
    end(state,api,key,interrupted){
      state={...state,link:0};
      if(key==='skill'){
        if(!state.field)state=field(state,api); // OnSkillDisable also creates a missed field.
        if(!interrupted)state.resident=true;
      }
      if(key==='ultimate'){
        if(has(41)){
          state.ultimateGeneration++;
          api.schedule('ultimate-decibel',api.parameter(16041011),{generation:state.ultimateGeneration,left:api.parameter(16041013)});
        }
        if(state.resident&&!interrupted)state.returning=true;
      }
      if(key==='return'){state.returning=false;state.paused=false;}
      if(key==='exit'){
        api.stopWeapons('AreaEffect_16001_SupArea');api.buffs.remove(api.actor,16000011);
        api.buffs.remove(api.main,16028011);api.buffs.remove(api.main,16096411);
        state={...state,resident:false,field:false,onField:false,remaining:0};
      }
      if(!state.resident){
        state.onField=false;
        api.buffs.remove(api.main,16096411);
        if(state.field){
          api.stopWeapons('AreaEffect_16001_SupArea');api.buffs.remove(api.actor,16000011);
          api.buffs.remove(api.main,16028011);state.field=false;
        }
      }
      return updateMode(state,api);
    },
    comboTag:(state,_api,key)=>key==='resident'&&has(24)&&state.mode===2?'160_Sup_Perk24':null,
    continuation(state,_api,key){return key==='torrent'&&state.decibels>50&&state.remaining>0?
      {state,tag:has(24)?'160_Sup_Perk24Perk23':'160_Sup_Perk23',index:1}:null;},
    automatic:(state,api)=>state.returning?'return':state.resident&&!state.paused?(state.remaining<=0?'exit':choose(state,api)):null,
    canCast(state,api,key){
      if(['resident','line','rotate','torrent'].includes(key))return state.remaining>0&&choose(state,api)===key;
      if(key==='return')return state.returning;
      if(key==='exit')return state.resident&&state.remaining<=0;
      return true;
    },
    tick(state,api){
      const elapsed=api.time-state.lastTick;
      state=updateMode({...state,lastTick:api.time,remaining:state.resident&&!state.paused?Math.max(0,state.remaining-elapsed):state.remaining},api);
      if(state.link&&!api.buffs.count('boss',16021012))api.hit(state.link===21?160521001:160522001);
      if(has(27)&&state.mode===1&&api.time>=state.softNext){group(api,16027011);state={...state,softNext:api.time+2+1/60};}
      if(state.onField&&context.breakthrough>=4&&api.time>=state.talentNext){
        api.emitProc?.('own-onfield-talent-tick');state={...state,talentNext:api.time+api.parameter(16096411)+1/60};
      }
      if(state.field&&has(28)&&!api.buffs.count(api.main,16028011))api.buffs.add(api.main,16028011,api.actor);
      if(state.field&&has(31)){
        if(state.shieldTime>=5){api.shield(16031001,api.main);state={...state,shieldTime:state.shieldTime-5};}
        else state={...state,shieldTime:state.shieldTime+elapsed};
      }
      return state;
    },
    custom(state,api,name){
      if(name==='Event_160_Sup')state=field(state,api);
      if(name==='160_Ultra_Buff'&&has(42))group(api,16042011);
      if(name==='160_Sup_Perk21_BeginLink')state={...state,link:21};
      if(name==='160_Sup_Perk22_BeginLink')state={...state,link:22};
      if(name==='160_Sup_Perk21_StopLink'||name==='160_Sup_Perk22_StopLink')state={...state,link:0};
      if(name==='Event_160_Sup_Shoot'||name==='Event_160_Sup_P23'){
        state=decibel(state,api,name==='Event_160_Sup_P23'?-2:has(24)?4:2);
        state={...state,shots:state.shots+1};
        if(has(21)&&state.shots%10===0)state.canLine=true;
        if(has(30)&&state.field&&state.shots%8===0){
          const radius=api.areaRadius(context.breakthrough>=2?'AreaEffect_16001_SupArea_T2':'AreaEffect_16001_SupArea')*
            (has(28)?1+Math.min(60,Math.floor((api.time-state.fieldStarted)/.1))*.005:1);
          if(api.distance<radius){
            // One stationary boss; sample its inward semicircle as native P30 does.
            const angle=Math.PI/2+api.randomPercent()/100*Math.PI,r=Math.sqrt(api.randomPercent()/100);
            const x=api.distance+Math.cos(angle)*r,z=Math.sin(angle)*r;
            api.area(api.randomPercent()>50?'AreaEffect_16001_Sup_P30_Red':'AreaEffect_16001_Sup_P30_Blue','boss',{x,z});
          }
        }
        if(name==='Event_160_Sup_P23'&&state.decibels<=50)api.interrupt();
      }
      return state;
    },
    beforeHit(_state,_api,tags){return has(24)&&tags.includes(BULLET)?[{id:16024011,count:1}]:[];},
    beforePartyHit(_state,api,hit){
      const count=has(26)&&hit.tags.includes(P26)?api.buffTagCount?.('boss','160_P21') ?? 0:0;
      return count>0?[{id:16026001,count,source:api.actor}]:[];
    },
    afterHit(state,api,tags){
      if(tags.includes(hash('160_WaterMark'))){
        const marked=api.hasBuffTag('boss','Water');
        api.buffs.add('boss',4011,api.actor);
        // Shared party-hit dispatch precedes this adapter's damage-post hook.
        // Native ParallelScript adds its own mark before evaluating D3, so
        // include the first mark-applying hit without double-adding later hits.
        if(!marked&&context.breakthrough>=3)api.buffs.add(api.actor,16096311,api.actor);
      }
      if(tags.includes(ULTRA)){group(api,16094011);if(has(43))api.buffs.add('boss',16043011,api.actor);}
      if(has(21)&&tags.includes(RAY21)||has(22)&&tags.includes(RAY22)){
        api.buffs.add('boss',has(25)?16025001:16021011,api.actor);api.buffs.add('boss',16021012,api.actor);
      }
      if(has(24)&&tags.includes(BULLET))api.buffs.add('boss',16024011,api.actor);
      if(has(25)&&tags.includes(P25))api.buffs.add('boss',16025001,api.actor);
      return state;
    },
    mainHit(state,api){
      if(has(27)&&state.remaining>0&&state.mode===1&&(state.lastMain===null||api.time-state.lastMain>api.parameter(16027011))){
        state=decibel(state,api,8);return {...state,lastMain:api.time};
      }
      return state;
    },
    markTriggered(state,api,element,_tags,source){
      if(element===1&&has(26)&&api.hasBuffTag('boss','160_P21')&&(state.lastMark===null||api.time-state.lastMark>api.parameter(16026011))){
        api.hitAs?.(source,160526001);api.buffs.add('boss',4011,api.actor);return {...state,lastMark:api.time};
      }
      return state;
    },
    areaEnd(state,api,name){
      if(name.startsWith('AreaEffect_16001_SupArea'))return (api.activeAreas?.(FIELD) ?? 0)>0?state:{...state,field:false};
      if(has(30)&&name==='AreaEffect_16001_Sup_P30_Red'){group(api,16030012,2);api.buffs.add(api.main,16030011,api.actor);}
      if(has(30)&&name==='AreaEffect_16001_Sup_P30_Blue')group(api,16030012);
      return state;
    },
    event(state,api,name,data){
      if(name==='ultimate-decibel'&&data.generation===state.ultimateGeneration&&Number(data.left)>0){
        state=decibel(state,api,api.parameter(16041012));
        if(Number(data.left)>1)api.schedule(name,api.parameter(16041011),{...data,left:Number(data.left)-1});
      }
      return state;
    },
  };
}
