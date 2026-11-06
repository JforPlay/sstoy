import {combatTagHash as hash} from './combat-tags';
import {createCommon137} from './combat-common-137';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface Drone {id:number;until:number;speed:number}
interface DroneState extends Record<string,unknown>{jumps:number;stack:number;x:number;z:number;nextX:number;nextZ:number;dx:number;dz:number;
  droneSequence:number;drones:Drone[];droneHits:number;lastDroneProc:number;thirdDroneTime:number}
const JUMP=hash('137SkillSupZaDi'),DRONE=hash('137UAVAllAtk'),BULLET=hash('137UAVBulletAtk'),ULT=hash('137UltraAtk');
const LAND='AreaEffect_137_SkillSup_JumpAtk_Boom',EXTRA='AreaEffect_137_SkillSup_JumpAtk_Boom_P21';
export function createSupport137(potentials:Record<number,number>):SupportCombatAdapter<DroneState>{
  const has=(id:number)=>Boolean(potentials[id]),common=createCommon137(potentials);
  function boom(state:DroneState,api:SupportCombatApi,name:string,x:number,z:number,index:number):DroneState{
    const stack=state.stack+(has(513722)?1:0),count=Math.min(stack,9);
    const soloSupport=api.party.filter(actor=>api.actorInfo(actor).job===3).length===1;
    const additionalAttributes=has(513722)?[...(soloSupport?[{id:13722011,count}]:[]),{id:13722021,count:1}]:[];
    api.area(name,'boss',{x,z,additionalAttributes,
      ...(has(513722)&&soloSupport&&index>0?{scale:1+api.parameter(13721011)*index/100}:{})});
    return {...state,stack};
  }
  const windSkill=(state:DroneState,api:SupportCombatApi,source:string)=>{common.skill(api,source);return state;};
  return {
    potentials:[513721,513722,513723,513724,513725,513726,513727,513728,513729,513730,513731,513732,513733,513741,513742,513743],
    actions:cinematics=>[{kind:'skill',skill:13732000,tag:'Skill_Sup'},common.ultimate(cinematics)],
    initialize:()=>({jumps:0,stack:0,x:0,z:0,nextX:0,nextZ:0,dx:1,dz:0,droneSequence:0,drones:[],droneHits:0,lastDroneProc:0,thirdDroneTime:-1}),
    cast(state,api,key){common.cast(api,key);return key==='skill'?{...state,jumps:0,stack:0}:state;},
    end:(state,_api,key)=>key==='skill'?{...state,jumps:0,stack:0}:state,
    partySkillCast:windSkill,partySkillChargeConsumed:windSkill,
    custom(state,api,name){
      common.custom(api,name);
      if(/^137SkillSupJumpStart[1-9]$/.test(name)){
        // Same point-target geometry used by the raid profile. The native
        // fan chooses a point two units from the boss, +/- 60 degrees from
        // the current boss-to-player direction; it is not nine guaranteed
        // overlapping extra explosions.
        const angle=Math.atan2(state.z,state.x-api.distance)+(api.randomPercent()/100*120-60)*Math.PI/180;
        const nextX=api.distance+Math.cos(angle)*2,nextZ=Math.sin(angle)*2;
        const length=Math.hypot(nextX-state.x,nextZ-state.z)||1;
        return {...state,nextX,nextZ,dx:(nextX-state.x)/length,dz:(nextZ-state.z)/length};
      }
      if(name!=='137SkillSupJumpAtk')return state;
      const x=state.nextX,z=state.nextZ,index=state.jumps;
      if(has(513723))api.buffs.add(api.actor,13723011,api.actor);
      state=boom(state,api,LAND,x,z,index);
      if(has(513721))for(let k=0;k<index;k++){
        const offset=3*(1<<Math.floor(k/4)),direction=k%4;
        const vectors=[[state.dx,state.dz],[state.dz,-state.dx],[-state.dx,-state.dz],[-state.dz,state.dx]];
        const [dx,dz]=vectors[direction]!;
        api.schedule('extra-boom',(k+1)/60,{x:x+dx!*offset,z:z+dz!*offset,index});
      }
      const jumps=index+1;
      if(jumps%3===0){
        // Uniform disk flight distance is separate from the hit assumption.
        const distance=Math.sqrt(api.randomPercent()/100)*5;api.randomPercent();
        api.projectile('Bullet_137_UAV_BirthFly','boss',distance);
      }
      return {...state,x,z,jumps};
    },
    projectileEnd(state,api,name){
      if(name!=='Bullet_137_UAV_BirthFly')return state;
      let drones=[...state.drones];
      if(drones.length>=3){
        const oldest=[...drones].sort((a,b)=>a.until-b.until)[0]!;
        api.independentLease!(`drone-${oldest.id}`,0);drones=drones.filter(drone=>drone.id!==oldest.id);
      }
      if(has(513723))drones=drones.map(drone=>({...drone,until:api.time+3}));
      const id=state.droneSequence+1;
      // SummonCfg.InheritByInitialSnapshot does not copy temporary owner
      // buffs at spawn; only the drone's own P24 amendment changes its speed.
      const drone={id,until:api.time+3,speed:api.initialAttribute!(47)};drones.push(drone);
      for(const drone of drones){api.independentLease!(`drone-${drone.id}`,drone.until);api.schedule('drone-expire',Math.max(0,drone.until-api.time),{id:drone.id});}
      const ai=api.summonAi!(13700011),birth=api.independentCombo!('Birth',{source:ai.source,lease:`drone-${id}`});
      api.schedule('drone-attack',birth+ai.thinkSeconds+ai.initialCooldown,{id});
      return {...state,drones,droneSequence:id,thirdDroneTime:has(513730)&&drones.length>=3?api.time:state.thirdDroneTime};
    },
    event(state,api,name,data){
      if(name==='extra-boom')return boom(state,api,EXTRA,Number(data.x),Number(data.z),Number(data.index));
      const drone=state.drones.find(drone=>drone.id===data.id);
      if(!drone)return state;
      if(name==='drone-expire'){
        if(drone.until>api.time)return state;
        api.independentLease!(`drone-${drone.id}`,0);
        return {...state,drones:state.drones.filter(other=>other.id!==drone.id)};
      }
      if(name==='drone-attack'&&drone.until>api.time){
        const ai=api.summonAi!(13700011);
        const modifiers=has(513724)?api.buffAttribute!(13724011,47):{base:0,percent:0,absolute:0};
        const count=state.drones.length,speed=(drone.speed+modifiers.base*count)*(1+modifiers.percent*count)+modifiers.absolute*count;
        const duration=api.independentCombo!(has(513728)?'Atk1_P28':'Atk1',{source:ai.source,speed,lease:`drone-${drone.id}`});
        api.schedule(name,Math.max(duration+1/60+ai.thinkSeconds,ai.normalCooldown),data);
      }
      return state;
    },
    beforeHit(_state,api,tags){
      const once=common.beforeHit(api,tags);
      if(tags.includes(JUMP)){
        if(has(513721))once.push({id:13721011,count:1});
        if(has(513725))once.push({id:13725001,count:1},{id:13725012,count:1});
        if(has(513727))once.push({id:13727001,count:1},{id:13727002,count:1});
      }
      if(tags.includes(DRONE)){
        if(has(513723)){
          const count=api.buffs.count(api.actor,13723011);
          if(count)once.push({id:13723011,count});once.push({id:13723021,count:1});
        }
        if(has(513728))once.push({id:13728001,count:1});
        if(has(513729))once.push({id:13729001,count:1});
        if(has(513730))once.push({id:13730001,count:1});
      }
      return once;
    },
    beforePartyHit(state,api,hit){
      return has(513730)&&hit.actor===api.main&&hit.slot===5&&api.actorInfo(api.main).element===4&&api.actorInfo(api.main).job===1
        &&state.thirdDroneTime>=0&&api.time<=state.thirdDroneTime+10?[{id:13730002,count:1,source:api.main}]:[];
    },
    afterHit(state,api,tags){
      common.afterHit(api,tags);
      if(tags.includes(JUMP))api.buffs.add('boss',2011,api.actor);
      if(has(513732)){
        api.buffs.add('boss',13732011,api.actor);
        if(tags.includes(ULT))api.buffs.add('boss',2011,api.actor);
      }
      if(has(513733))for(const actor of api.actorsByElement(4))api.buffs.add(actor,13733011,api.actor);
      if(has(513726)&&tags.includes(JUMP)){
        api.buffs.add(api.actor,13726011,api.actor);
        if(api.actorInfo(api.main).element===4&&api.actorInfo(api.main).job===1)api.buffs.add(api.main,13726021,api.actor);
      }
      if(has(513724)&&tags.includes(BULLET)){
        const droneHits=state.droneHits+1;
        if(droneHits>=3&&(state.lastDroneProc<=0||api.time>state.lastDroneProc+.5)){
          api.area('AreaEffect_137_P24_UAV_AtkAoe');return {...state,droneHits:0,lastDroneProc:api.time};
        }
        return {...state,droneHits};
      }
      return state;
    },
    mark:common.mark,
    markTriggered(state,api,element,_tags,source){
      if(has(513731)&&element===4&&api.actorInfo(source).element===4)api.buffs.add(api.actor,13731011,api.actor);
      return state;
    },
  };
}
