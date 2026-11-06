import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';

export interface OtohaState extends Record<string,unknown>{
  openedAt:number|null;last21:number;last22:number;last25:number;grenadeBonus:number;skillGeneration:number;sniperGeneration:number;ringGeneration:number;readyBuff:boolean;
}
const RAIN=combatTagHash('145SkillSupRain'),ULT=combatTagHash('145UltraAtk');
const ADD_MARK=combatTagHash('145AddDarkMark1'),TRIGGER_MARK=combatTagHash('145DarkTagTrigger');
const STEEL='AreaEffect_145_SkilSup_SteelRain';
const origin={x:0,z:0,dx:1,dz:0};
export function createSupport145(potentials:Record<number,number>):SupportCombatAdapter<OtohaState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const umbrella=has(514541)?'Bullet_145_Ultra_HuaSan_Out_P41_XiYin':'Bullet_145_Ultra_HuaSan_Out';
  const allDark=(api:SupportCombatApi)=>api.actorsByElement(6).length===api.party.length;
  const speed=(api:SupportCombatApi)=>5*(has(514528)?1-api.parameter(14528001):1);
  return {
    potentials:[514521,514522,514523,514524,514525,514526,514527,514528,514529,514530,514531,514532,514533,514541,514542,514543],
    actions(cinematics){
      const tag=cinematics?'Ultra_1_TimelineOn':'Ultra_1_TimelineOff';
      return [{kind:'skill',skill:14532000,tag:'Skill_Sup'},{kind:'ultimate',skill:14540000,tag,
        chain:[{tag,until:'activation'},{tag:'Ultra_2'}]}];
    },
    initialize(api){
      const dark=api.actorsByElement(6);
      if(has(514531)&&allDark(api))for(const actor of api.party)api.buffs.add(actor,14531011,api.actor);
      if(has(514532))for(const actor of dark)for(const _member of dark)api.buffs.add(actor,14532011,api.actor);
      return {openedAt:null,last21:-Infinity,last22:-Infinity,last25:-Infinity,grenadeBonus:0,
        skillGeneration:0,sniperGeneration:0,ringGeneration:0,readyBuff:false};
    },
    cast(state,_api,key){return key==='skill'?{...state,skillGeneration:state.skillGeneration+1,grenadeBonus:0}:state;},
    partySkillCast(state,api,source){
      if(has(514527)&&api.actorInfo(source).element===6)api.buffs.add(api.actor,14527011,api.actor);
      return state;
    },
    partyUltimateCast(state,api){
      if(has(514543))api.buffs.add(api.actor,14543011,api.actor);
      return state;
    },
    tick(state,api){
      if(!has(514526))return state;
      const ready=api.skillReady?.('skill') ?? false;
      if(ready===state.readyBuff)return state;
      if(ready)api.buffs.add(api.actor,14526011,api.actor);else api.buffs.remove(api.actor,14526011);
      return {...state,readyBuff:ready};
    },
    custom(state,api,name){
      if(name==='SteelRain'){
        const duration=api.area(STEEL,'boss',{x:2,z:0,moveSpeed:speed(api)});
        if(has(514523))for(let i=0;i<10&&.2+i*.3<duration;i++)api.schedule('grenade',.2+i*.3,{elapsed:.2+i*.3});
        if(has(514524)&&allDark(api))api.schedule('second-rain',2,{generation:state.skillGeneration});
      }
      if(name==='HuaSan'){
        api.directionalProjectile(umbrella,origin);
        return {...state,openedAt:api.time};
      }
      if(name==='YinBaoHuaSan'){
        const pos=state.openedAt===null?null:api.projectilePosition?.(umbrella,origin,api.time-state.openedAt);
        if(pos){
          api.stopWeapons(umbrella,true);
          api.area('AreaEffect_145_Ultra_HuaSanBoom','boss',pos);
          api.schedule('ring',.6,{...pos,generation:state.ringGeneration+1});
        }
        api.interrupt();
        return {...state,openedAt:null,ringGeneration:state.ringGeneration+1};
      }
      return state;
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(RAIN)){
        if(has(514523))once.push({id:14523011,count:1});
        if(has(514524)&&(api.buffs.count('boss',5031)||api.hasBuffTag('boss','Dark')))once.push({id:14524011,count:1});
        if(has(514528))once.push({id:14528001,count:1});
        if(has(514530))once.push({id:14530001,count:1});
      }
      if(tags.includes(ULT)&&has(514542)&&api.hasBuffTag('boss','DarkAnSuo'))once.push({id:14542001,count:1});
      return once;
    },
    afterHit(state,api,tags,hit){
      if(tags.includes(RAIN)){
        const buff=has(514521)?14521011:14590011;
        if(!api.buffs.count('boss',buff)){
          api.buffs.add('boss',buff,api.actor);
          api.hit(145300007);
          api.schedule('dot',.5,{buff});
        }
        if(has(514529))api.buffs.add('boss',14529011,api.actor);
      }else if(tags.includes(ULT)&&has(514533))api.buffs.add('boss',5011,api.actor);
      if(tags.includes(ADD_MARK))api.buffs.add('boss',5011,api.actor);
      if(hit.damageType!==3)return state;
      if(has(514521)&&api.time-state.last21>api.parameter(14521012)){
        api.reduceCooldown(api.parameter(14521011),'ultimate');
        api.directSp(api.actor,api.parameter(14521013)*10000);
        state={...state,last21:api.time};
      }
      if(has(514525)&&api.randomPercent()/100<=api.parameter(14525012)&&api.time-state.last25>api.parameter(14525011)){
        const generation=state.sniperGeneration+1;
        for(let i=0;i<3;i++){
          const angle=(i*60-90+Math.floor(api.randomPercent()*.6))*Math.PI/180;
          const x=api.distance-5*Math.cos(angle),z=-5*Math.sin(angle);
          api.schedule('sniper',i*.2,{index:i+1,x,z,angle:angle*180/Math.PI,generation});
        }
        state={...state,last25:api.time,sniperGeneration:generation};
      }
      return state;
    },
    mainHit(state,api){
      if(!has(514522)||api.actorInfo(api.main).element!==6||!api.hasBuffTag('boss','145NinjaKill')||api.time-state.last22<=api.parameter(14522012))return state;
      api.area(`AreaEffect_145_AidSniper_${1+Math.floor(api.randomPercent()/25)}`,'boss',{hitId:145300010});
      api.directSp(api.actor,api.parameter(14522011)*10000);
      return {...state,last22:api.time};
    },
    mark:tags=>tags.includes(TRIGGER_MARK)?{element:6,variant:2,buffTag:'Dark',hit:145000001,applyBuff:[5031,5041]}:null,
    event(state,api,name,data){
      if(name==='dot'&&api.buffs.count('boss',Number(data.buff))){
        api.hit(145300007);api.schedule(name,.5,data);
      }
      if(name==='second-rain'&&Number(data.generation)===state.skillGeneration&&api.activeAction()==='skill')
        api.area(`${STEEL}_P24`,'boss',{x:2,z:0,moveSpeed:speed(api)});
      if(name==='grenade'){
        const x=2+speed(api)*(Number(data.elapsed)+.5)+(api.randomPercent()/100-.5)*.2;
        const z=(api.randomPercent()/100-.5)*7;
        const special=api.randomPercent()<api.parameter(14523011)+state.grenadeBonus;
        api.area(`AreaEffect_145_P23_LiuDan${special?'_Sp':''}`,'boss',{x,z});
        return {...state,grenadeBonus:state.grenadeBonus+api.parameter(14523012)};
      }
      if(name==='sniper'&&Number(data.generation)===state.sniperGeneration)
        api.area(`AreaEffect_145_P22_Sniper_${data.index}`,'boss',{x:Number(data.x),z:Number(data.z),angle:Number(data.angle)});
      if(name==='ring'&&Number(data.generation)===state.ringGeneration)
        api.area('AreaEffect_145_Ultra_RingBoom','boss',{x:Number(data.x),z:Number(data.z)});
      return state;
    },
  };
}
