import {createSeinaRules,type SeinaScriptApi,type SeinaScriptState} from './combat-seina';
import {combatTagHash} from './combat-tags';
import type {SupportFactoryContext} from './combat-adapter-registry';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';

interface SeinaSupportState extends SeinaScriptState,Record<string,unknown>{
  playedForm:'claymore'|'rapier';fallIndex:number;
}
const QING=combatTagHash('Qing'),ZHONG=combatTagHash('Zhong');
const FALL_OFFSETS=[[0,2.5],[2.16,1.25],[2.16,-1.25],[0,-2.5],[-2.16,-1.25],[-2.16,1.25]] as const;
const SWORDS=['Heng','Shu','You','Zuo'] as const;
export function createSupport162(potentials:Record<number,number>,context:SupportFactoryContext):SupportCombatAdapter<SeinaSupportState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const common=createSeinaRules(potentials,context.breakthrough,context.glimmerId);
  const shared=(api:SupportCombatApi):SeinaScriptApi=>({
    time:api.time,actor:api.actor,balanceActors:api.party.filter(actor=>api.actorInfo(actor).job===2),
    lightActorCount:api.lightActors.length,buffs:api.buffs,parameter:api.parameter,
    startBurstRegen:generation=>api.schedule('burst-regen',api.parameter(16243011),{generation}),
    area:(name,forwardOffset)=>api.area(name,'boss',forwardOffset===undefined?{}:{x:forwardOffset,z:0}),
    sword(hitId){
      const huge=has(516228)&&api.randomPercent()<api.parameter(16228011);
      const suffix=huge?'Big':SWORDS[Math.floor(api.randomPercent()/25)]!;
      const angle=(api.randomPercent()/100*60-30)*Math.PI/180;
      api.directionalProjectile(`Bullet_162_JianQi_${suffix}`,{x:0,z:0,dx:Math.cos(angle),dz:Math.sin(angle),hitId});
    },
  });
  return {
    potentials:[516221,516222,516223,516224,516225,516226,516227,516228,516229,516230,516231,516232,516233,516241,516242,516243],
    actions:()=>[{kind:'skill',skill:16232000,tag:'Skill_Sup',loopCount:4+(has(516224)?Math.trunc(context.parameter(16224011)):0)},
      {kind:'ultimate',skill:16240000,tag:'Ultra_Zhong'}],
    initialize(api){
      if(has(516231))for(const actor of api.lightActors)for(const _member of api.lightActors)api.buffs.add(actor,16231011,api.actor);
      return {...common.initialize(shared(api)),playedForm:'claymore',fallIndex:0};
    },
    partySkillCast(state,api,source){
      if(api.actorInfo(source).element===5){
        if(source===api.main&&has(516232))api.buffs.add(api.actor,16232011,api.actor);
        if(has(516233))api.buffs.add(api.actor,16233011,api.actor);
      }
      return state;
    },
    cast(state,api,key){
      if(key==='skill')return {...state,fallIndex:0};
      if(key==='ultimate')return {...state,...common.cast(state,shared(api),'ultimate'),playedForm:state.form};
      return state;
    },
    comboTag:(state,_api,key)=>key==='ultimate'?(state.playedForm==='claymore'?'Ultra_Zhong':'Ultra_Qing'):null,
    custom(state,api,name){
      if(name==='P21'&&has(516221))api.area('AreaEffect_162_LeiDianArea_P21','boss',{x:1,z:0});
      if(name==='162P22ZhongJianFall'&&has(516222)){
        const [x,z]=FALL_OFFSETS[state.fallIndex]!;
        if(has(516225))api.buffs.add(api.actor,16225011,api.actor);
        api.area(has(516225)?'AreaEffect_162_LeiDianZhongJian_Fall_P22P25':'AreaEffect_162_LeiDianZhongJian_Fall_P22','boss',{x,z});
        return {...state,fallIndex:(state.fallIndex+1)%FALL_OFFSETS.length};
      }
      if(name==='162P23JianQi'&&has(516223))shared(api).sword(162320005);
      if(name==='162P26UltraZhong'&&has(516226))return {...state,form:'claymore'};
      if(name==='162P29UltraQing'&&has(516229))return {...state,form:'rapier'};
      if(name==='162UltraJianQi'||name==='162P42ZhongJianArea')common.custom(shared(api),name);
      return state;
    },
    beforeHit(_state,api,tags){
      const once=common.beforeHit(shared(api),tags);
      if(tags.includes(ZHONG)&&has(516227))once.push({id:16227001,count:1});
      if(tags.includes(QING)){
        if(has(516228))once.push({id:16228001,count:1});
        if(has(516230))once.push({id:16230001,count:1});
      }
      return once;
    },
    afterHit(state,api,tags){
      const next=common.afterHit(state,shared(api),tags);
      if(tags.includes(QING)&&has(516226))api.buffs.add(api.actor,16226011,api.actor);
      if(tags.includes(ZHONG)&&has(516229))api.buffs.add(api.actor,16229011,api.actor);
      return {...state,...next};
    },
    mark:tags=>common.canTriggerMark(tags)?{element:5,variant:2,buffTag:'Light',area:'AreaEffect_162_LightTrigger_Boom'}:null,
    markTriggered(state,api,element,_tags,source){
      if(element===5&&source===api.actor)common.onMarkTrigger(shared(api));
      return state;
    },
    event(state,api,name,data){
      if(name==='burst-regen'&&Number(data.generation)===state.burstGeneration&&api.buffs.count(api.actor,common.burstBuff)){
        api.directSp(api.actor,api.parameter(16243002)*10000);
        api.schedule(name,api.parameter(16243011),data);
      }
      return state;
    },
  };
}
