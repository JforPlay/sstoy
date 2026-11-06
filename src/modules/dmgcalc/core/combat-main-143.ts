import {combatTagHash as hash} from './combat-tags';
import {createSupport143} from './combat-support-143';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface SwordGunState extends Record<string,unknown>{
  stage:number;meleeStage:number;rangeStage:number;range:boolean;lastMelee:number;lastRange:number;loops:number;finishing:boolean;shootIndex:number;
  lastProc:number;lastLaser:number;domainUntil:number;lastTornado:number;charges:number;
}
const BULLET=hash('143BulletAtk'),SWORD=hash('143SkillMainSwordAtk'),GUN=hash('143SkillMainBulletAtk');
const NORMAL=hash('143NrmJianAtk'),MARK=hash('143WindTagTrigger');
/** Native 143 main: three stored B charges, one invocation with charge-funded
 * loop continuations; melee/ranged normal stages remain independent. */
export function createMain143(potentials:Record<number,number>):SupportCombatAdapter<SwordGunState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const common=createSupport143(Object.fromEntries(Object.entries(potentials).filter(([id])=>Number(id)>=514341)));
  const skillTag=has(514305)?'Skill_Mian_SheZhan_P5':'Skill_Mian_SheZhan';
  function sections(state:SwordGunState,api:SupportCombatApi):SwordGunState{
    const charges=api.chargeCount?.('skill') ?? 3;
    if(charges===state.charges)return state;
    const old=api.buffs.count(api.actor,14300013);
    if(charges>0){
      api.buffs.remove(api.actor,14300012);
      if(old>charges)api.removeStacks(api.actor,14300013,old-charges);
      for(let i=old;i<charges;i++)api.buffs.add(api.actor,14300013,api.actor);
    }else{
      api.buffs.remove(api.actor,14300013);
      api.buffs.add(api.actor,14300012,api.actor);
    }
    return {...state,charges};
  }
  function tornado(api:SupportCombatApi,name:string){
    const angle=api.randomPercent()/100*Math.PI*2;
    api.area(name,'boss',{x:Math.cos(angle)*3,z:Math.sin(angle)*3});
  }
  return {
    potentials:[514301,514302,514303,514304,514305,514306,514307,514308,514309,514310,514311,514312,514313,514341,514342,514343],
    actions:cinematics=>[
      {kind:'normal',skill:14310000,tag:'Atk_Jian_1',normal:true,automatic:true},
      {kind:'skill',skill:14331000,tag:skillTag,charges:3,
        chain:[{tag:skillTag,index:0},{tag:skillTag,index:1}]},
      ...(has(514311)?[{kind:'dodge',skill:14320000,tag:[3],flag:16,charges:2,automatic:true,spBudget:null}]:[]),
      ...common.actions(cinematics).filter(action=>action.kind==='ultimate'),
    ],
    initialize(api){
      const shared=common.initialize(api);
      api.buffs.add(api.actor,14300011,api.actor);
      if(has(514312))for(const _actor of api.actorsByElement(4))api.buffs.add(api.actor,14312011,api.actor);
      return sections({...shared,stage:0,meleeStage:0,rangeStage:0,range:false,lastMelee:0,lastRange:0,loops:0,finishing:false,
        shootIndex:0,lastProc:0,lastLaser:0,charges:-1},api);
    },
    tick:sections,
    automatic(_state,api){
      if(has(514311)&&!api.buffs.count(api.actor,14311011)&&api.skillReady?.('dodge'))return 'dodge';
      return 'normal';
    },
    cast(state,api,key){
      if(key==='normal'){
        const range=api.distance>3.3,last=range?state.lastRange:state.lastMelee;
        return {...state,range,stage:api.time>last+2?0:range?state.rangeStage:state.meleeStage};
      }
      if(key==='skill'){
        if(has(514308))api.buffs.add(api.actor,14308011,api.actor);
        return sections({...state,loops:0,finishing:false,shootIndex:0},api);
      }
      if(key==='dodge'&&has(514311))api.buffs.add(api.actor,14311011,api.actor);
      return {...state,...common.cast?.(state,api,key)};
    },
    comboTag:(state,_api,key)=>key==='normal'?`Atk_${state.range?'Qiang':'Jian'}_${state.stage+1}`:null,
    phase:(state,_api,key,phase)=>key==='normal'&&phase==='anticipation'
      ?{...state,[state.range?'rangeStage':'meleeStage']:(state.stage+1)%(state.range?4:6)}:state,
    continuation(state,api,key){
      if(key!=='skill'||state.finishing)return null;
      const loops=state.loops+1;
      if(api.consumeCharge?.('skill')){
        if(has(514308))api.buffs.add(api.actor,14308011,api.actor);
        return {state:sections({...state,loops},api),tag:skillTag,index:1};
      }
      return {state:{...state,loops,finishing:true},tag:skillTag,index:2};
    },
    end(state,api,key,interrupted){
      if(key==='normal')return {...state,[state.range?'lastRange':'lastMelee']:api.time};
      if(key==='skill'){
        if(has(514301))api.buffs.add(api.actor,14301011,api.actor);
        if(has(514309))api.buffs.remove(api.actor,14309011);
        if(has(514310)){
          api.buffs.add(api.actor,14310011,api.actor);
          if(state.loops>1)api.extendBuff?.(api.actor,14310011,3*(state.loops-1));
        }
        return {...state,loops:0,finishing:false,shootIndex:0};
      }
      return {...state,...common.end?.(state,api,key,interrupted)};
    },
    custom(state,api,name){
      if(name==='143SkillMainShot'){
        const offsets=has(514304)?state.loops>=2?[0,2,4]:state.loops===1?[0,3]:[0]:[0];
        for(const offset of offsets){
          const angle=-(90+60*((state.shootIndex+offset)%6))*Math.PI/180;
          const dx=Math.cos(angle),dz=Math.sin(angle),x=dx*2.7,z=dz*2.7;
          if(has(514303))api.area('AreaEffect_143_P3_JiGuang','boss',{x,z,angle:Math.atan2(-z,api.distance-x)*180/Math.PI});
          else api.directionalProjectile('Bullet_143_SkillMain_Base',{x,z,dx,dz});
        }
        return {...state,shootIndex:(state.shootIndex+1)%6};
      }
      if(name==='143P2LongJuanFeng'&&has(514302))for(let i=0;i<2;i++)tornado(api,has(514301)?'AreaEffect_143_P1_LongJuanFeng_P2':'AreaEffect_143_P2_LongJuanFeng');
      if(name==='143NrmQiangAtkEvent'&&has(514310)&&api.buffs.count(api.actor,14310011)&&(state.lastLaser<=0||api.time-state.lastLaser>1)){
        const z=api.randomPercent()<50?1:-1;
        api.area('AreaEffect_143_P10_JiGuang','boss',{x:0,z,angle:Math.atan2(-z,api.distance)*180/Math.PI});
        return {...state,lastLaser:api.time};
      }
      return {...state,...common.custom?.(state,api,name)};
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(BULLET)){
        if(has(514303))once.push({id:14303011,count:1});
        if(has(514304))once.push({id:14304011,count:1});
      }
      if(has(514305)&&api.distance<=3)once.push({id:14305001,count:1});
      if(has(514306)&&tags.includes(SWORD))once.push({id:14306001,count:1});
      if(has(514308)&&tags.includes(GUN)){
        const count=api.buffs.count(api.actor,14308011);
        if(count)once.push({id:14308001,count});
      }
      return once;
    },
    afterHit(state,api,tags){
      if(has(514301)&&tags.includes(NORMAL)&&api.activeAction()==='normal'&&api.buffs.count(api.actor,14301011)){
        tornado(api,has(514302)?'AreaEffect_143_P1_LongJuanFeng_P2':'AreaEffect_143_P1_LongJuanFeng');
        api.buffs.remove(api.actor,14301011);
      }
      if(has(514307)&&tags.includes(SWORD))api.buffs.add(api.actor,14307011,api.actor);
      if(has(514309)&&tags.includes(BULLET)&&(state.lastProc<=0||api.time-state.lastProc>api.parameter(14309011))){
        api.buffs.add(api.actor,14309011,api.actor);return {...state,lastProc:api.time};
      }
      return state;
    },
    mark:tags=>tags.includes(MARK)||has(514304)&&tags.includes(BULLET)?{element:4,buffTag:'Wind',area:'AreaEffect_143_WindTagTrigger_QiXuan',radius:1.5}:null,
    markTriggered(state,api,_element,_tags,source){
      if(source===api.actor&&has(514313))api.buffs.add(api.actor,14313011,api.actor);
      return state;
    },
  };
}
