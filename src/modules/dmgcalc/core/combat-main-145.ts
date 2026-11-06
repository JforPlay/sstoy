import {combatTagHash as hash} from './combat-tags';
import {createSupport145,type OtohaState} from './combat-support-145';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface UmbrellaState extends OtohaState {stage:number;normalIndex:number;normalHits:number;lastSniper:number;lastEnergy:number;
  areaGeneration:number;recoveryGeneration:number;recovering:boolean}
const NORMAL=hash('145NrmAtk'),MAIN=hash('145SkillMainAtk'),SHOT=hash('145SkillMainShot'),ULT=hash('145UltraAtk');
const ADD_MARK=hash('145AddDarkMark1'),MARK=hash('145DarkTagTrigger'),SHIELD=hash('145P2HuDun');
export function createMain145(potentials:Record<number,number>):SupportCombatAdapter<UmbrellaState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const common=createSupport145(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=514541)));
  function energy(state:UmbrellaState,api:SupportCombatApi):UmbrellaState{
    // Unlike CheckPerkCd, this controller initializes the timestamp to zero
    // and strictly waits one second even for its first refund.
    if(!has(514501)||api.time-state.lastEnergy<=1)return state;
    api.reduceCooldown(api.parameter(14501011),'ultimate');api.directSp(api.actor,api.parameter(14501012)*10000);
    return {...state,lastEnergy:api.time};
  }
  const sniper=(api:SupportCombatApi,index:number,hitId=145300002)=>api.area(`AreaEffect_145_AidSniper_${index+1}`,'boss',{hitId});
  return {
    potentials:[514501,514502,514503,514504,514505,514506,514507,514508,514509,514510,514511,514512,514513,514541,514542,514543],
    actions:cinematics=>[{kind:'normal',skill:14510000,tag:'Atk_1',normal:true,automatic:true},
      {kind:'skill',skill:14531000,tag:'Skill_Mian_Move',cooldownTiming:'end',charges:has(514508)?2:1,
        chain:[{tag:'Skill_Mian_Move',until:'activation'},{tag:'Skill_Mian_Shot'}]},
      ...(has(514511)?[{kind:'dodge',skill:14520000,tag:[3],flag:16,charges:2,automatic:true}]:[]),
      ...common.actions(cinematics).filter(action=>action.kind==='ultimate')],
    initialize:api=>({...common.initialize(api),stage:0,normalIndex:0,normalHits:0,lastSniper:-1,lastEnergy:0,
      areaGeneration:0,recoveryGeneration:0,recovering:false}),
    automatic(_state,api){return has(514511)&&api.activeAction()===null&&!api.buffs.count(api.actor,14511011)&&api.skillReady!('dodge')?'dodge':'normal';},
    comboTag:(state,_api,key)=>key==='normal'?`Atk_${state.normalIndex+1}`:null,
    cast(state,api,key){
      if(key==='normal')return {...state,normalIndex:state.stage,stage:(state.stage+1)%3};
      if(key==='skill'){
        if(has(514507))api.buffs.add(api.actor,14507011,api.actor);
        if(has(514508))api.buffs.add(api.actor,14508011,api.actor);
      }
      if(key==='dodge'&&has(514511))api.buffs.add(api.actor,14511011,api.actor);
      return key==='ultimate'?{...state,stage:0}:state;
    },
    end(state,api,key){if(key==='skill')api.buffs.remove(api.actor,14510011);return state;},
    gameplayTrigger(state,api,flags){if(has(514506)&&flags.normal)api.buffs.add(api.actor,14506011,api.actor);return state;},
    partyUltimateCast:(state,api,source)=>({...state,...common.partyUltimateCast!(state,api,source)}),
    custom(state,api,name){
      if(name==='P2HuDun'&&has(514502)){api.shield(14502001,api.actor);api.area('AreaEffect_145_P2_TakeBack',api.actor,{x:0,z:0});}
      if(name==='P10WuDi'&&has(514510))api.buffs.add(api.actor,14510011,api.actor);
      if(name==='Shot'){
        api.projectile(has(514503)?'Bullet_145_SkillMain_Shot_P3':'Bullet_145_SkillMain_Shot');
        if(has(514501))for(let i=0;i<3;i++){sniper(api,i);state=energy(state,api);}
      }
      return {...state,...common.custom!(state,api,name)};
    },
    attacked(state,api,tags,hit){
      if(!tags.includes(SHOT))return state;
      if(has(514504))for(let i=0;i<8;i++){
        const angle=i*Math.PI/4;
        api.directionalProjectile('Bullet_145_P4_SplitBullet',{x:api.distance,z:0,dx:Math.cos(angle),dz:Math.sin(angle)});
      }
      if(hit?.weapon){
        const areaGeneration=state.areaGeneration+1;
        api.schedule('main-shot-area',1/60,{areaGeneration});return {...state,areaGeneration};
      }
      return state;
    },
    beforeHit(state,api,tags){
      const once=common.beforeHit!(state,api,tags);
      if(has(514509)&&tags.includes(MAIN)&&api.hasBuffTag('boss','DarkAnSuo'))once.push({id:14509001,count:1});
      return once;
    },
    afterHit(state,api,tags){
      if(tags.includes(ADD_MARK))api.buffs.add('boss',5011,api.actor);
      if(tags.includes(NORMAL)&&has(514505)){
        const normalHits=state.normalHits+1;
        if(normalHits>=api.parameter(14505011)&&(state.lastSniper<0||api.time-state.lastSniper>2)){
          const index=Math.min(3,Math.floor(api.randomPercent()/25));sniper(api,index,145300005);
          return energy({...state,normalHits:0,lastSniper:api.time},api);
        }
        return {...state,normalHits};
      }
      return state;
    },
    mark:tags=>tags.includes(MARK)||has(514512)&&tags.includes(ULT)
      ?{element:6,variant:2,buffTag:'Dark',hit:145000001,applyBuff:[5031,5041]}:null,
    markTriggered(state,api,element,_tags,source){
      if(has(514513)&&element===6&&source===api.actor)api.buffs.add(api.actor,14513011,api.actor);
      return state;
    },
    shieldChanged(state,api,shield,added){
      if(!shield.tags.includes(SHIELD))return state;
      const recoveryGeneration=state.recoveryGeneration+1;
      if(added)api.schedule('shield-energy',0,{recoveryGeneration});
      return {...state,recoveryGeneration,recovering:added};
    },
    event(state,api,name,data){
      if(name==='main-shot-area'&&data.areaGeneration===state.areaGeneration)api.area('AreaEffect_145_SkillMain_ShotBoom');
      if(name==='shield-energy'&&data.recoveryGeneration===state.recoveryGeneration&&state.recovering){
        api.directSp(api.actor,api.parameter(14502011)*10000);
        sniper(api,Math.min(3,Math.floor(api.randomPercent()/25)));state=energy(state,api);
        api.schedule(name,1,data);
      }
      return {...state,...common.event!(state,api,name,data)};
    },
  };
}
