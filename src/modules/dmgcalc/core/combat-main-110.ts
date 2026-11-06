import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface Avatar {id:number;expires:number;generation:number;lease:string;command:string;busyUntil:number}
interface FirenState extends Record<string,unknown>{stage:number;lastNormal:number;sequence:number;avatars:Avatar[];skillHits:number;pulseAt:number;procCount:number;procAt:number|null}
const SOURCE='char_11001_combos_monster.unity3d',NORMAL=hash('110_Atk'),SKILL=hash('110MainSanDuanZhanAtk'),DARK=hash('110DarkTagBoom');
/** Native _11001 and _11000001DarkFs; avatars are not owner hits. */
export function createMain110(potentials:Record<number,number>):SupportCombatAdapter<FirenState>{
  const has=(n:number)=>Boolean(potentials[511000+n]);
  const die=(avatar:Avatar,api:SupportCombatApi)=>{
    if(avatar.lease)api.independentLease!(avatar.lease,0);
    if(has(4))api.area('AreaEffect_110_Main_FenShen_DieBoom','boss',{entity:avatar.id});
    api.despawn!(avatar.id);
  };
  const spawn=(state:FirenState,api:SupportCombatApi):FirenState=>{
    const maximum=api.parameter(11000011)+(has(4)?Math.max(0,api.actorsByElement(6).length-1)*api.parameter(11040011):0)+(has(8)?api.parameter(11080011):0);
    const avatars=[...state.avatars];
    if(avatars.length>=maximum&&avatars.length)die(avatars.shift()!,api);
    const id=state.sequence+1,life=api.parameter(11000012)+(has(9)?api.parameter(11050901):0);
    const buffs=([[8,11050811],[9,11050911],[10,11051011],[12,11051211]] as const).filter(([n])=>has(n)).map(([,buff])=>buff);
    api.summon!(id,buffs);api.emitProc?.('own-avatar-spawned');api.schedule('avatar-expire',life,{id});
    return {...state,sequence:id,avatars:[...avatars,{id,expires:api.time+life,generation:0,lease:'',command:'',busyUntil:api.time+1/60}]};
  };
  const command=(state:FirenState,api:SupportCombatApi,tag:string):FirenState=>({...state,avatars:state.avatars.map(avatar=>{
    if(avatar.expires<=api.time||avatar.command===tag&&avatar.busyUntil>api.time)return avatar;
    if(avatar.lease)api.independentLease!(avatar.lease,0);
    const generation=avatar.generation+1,lease=`avatar:${avatar.id}:${generation}`;
    api.independentLease!(lease,avatar.expires);
    // Native summon phase masks allow new skill IDs; replace, never overlap.
    const duration=api.independentCombo!(tag,{source:SOURCE,entity:avatar.id,lease});
    return {...avatar,generation,lease,command:tag,busyUntil:api.time+duration};
  })});
  return {
    potentials:[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>511000+n),
    actions:cinematics=>[
      ...Array.from({length:4},(_,n)=>({kind:`normal:${n}`,skill:11010000,tag:`Atk${n+1}`,normal:true,automatic:true})),
      {kind:'skill',skill:11031000,tag:has(1)?'110_Mian_Skill_SanLianZhan_T1':'110_Mian_Skill_SanLianZhan'},
      {kind:'ultimate',skill:11040000,tag:cinematics?'110_Ultra_TL':'110_Ultra_NoTL'},
      {kind:'dodge',skill:11020000,tag:[3],flag:16,automatic:true,charges:has(13)?3:2,spBudget:null}],
    initialize(api){
      if(has(11))for(const _ of api.actorsByElement(6))api.buffs.add(api.actor,11051111,api.actor);
      if(has(3))api.schedule('periodic-avatar',5);
      return {stage:0,lastNormal:0,sequence:0,avatars:[],skillHits:0,pulseAt:0,procCount:0,procAt:null};
    },
    automatic(state,api){
      if(has(13)&&!api.buffs.count(api.actor,11051311)&&api.skillReady?.('dodge'))return 'dodge';
      return `normal:${api.time-state.lastNormal>3?0:state.stage}`;
    },
    canCast:(state,api,key)=>!key.startsWith('normal:')||key===`normal:${api.time-state.lastNormal>3?0:state.stage}`,
    cast(state,api,key){
      if(key==='dodge'&&has(13))api.buffs.add(api.actor,11051311,api.actor);
      if(key==='ultimate'&&has(41)){
        for(const _ of state.avatars)api.buffs.add(api.actor,11054111,api.actor);
        for(const avatar of state.avatars)die(avatar,api);
        return {...state,avatars:[]};
      }
      return state;
    },
    phase(state,_api,key,phase){return key.startsWith('normal:')&&phase==='anticipation'?{...state,stage:(Number(key.split(':')[1])+1)%4}:state;},
    end(state,api,key){
      if(key.startsWith('normal:'))return {...state,lastNormal:api.time};
      if(key==='skill'){
        if(has(7))api.buffs.remove(api.actor,11050711);
        if(has(10))return {...state,stage:3,lastNormal:api.time};
      }
      if(key==='ultimate'){
        if(has(41))api.buffs.remove(api.actor,11054111);
        if(has(43))api.buffs.remove(api.actor,11043011);
      }
      return state;
    },
    custom(state,api,name){
      if(name==='110_NrmAtk_ZhaoHuanFenShen'&&!state.avatars.length)return spawn(state,api);
      if(name==='110_Main_Skill_ZhaoHuanFenShen'){
        for(let n=0;n<1+(has(3)?api.parameter(11030011):0);n++)state=spawn(state,api);
        return state;
      }
      if(name==='110_FenShen_ChongCi')return command(state,api,'Main_ChongCi');
      if(name==='110_FenShen_SanLianZhan'||name==='110_FenShen_SanLianZhan_T1')return command(state,api,'SanLianZhan');
      return state;
    },
    afterHit(state,api,tags,hit){
      state={...state};
      if(has(42))api.buffs.add(api.actor,11042011,api.actor);
      if(has(2)&&tags.includes(SKILL)&&++state.skillHits>=6){state.skillHits=0;api.buffs.add(api.actor,11002011,api.actor);}
      if(has(7)&&tags.includes(NORMAL))api.buffs.add(api.actor,11050711,api.actor);
      if(has(5)&&hit.damageType===2){
        const allDark=api.actorsByElement(6).length===api.party.length;
        if(Math.floor(api.randomPercent())<api.parameter(allDark?11005012:11005011)){
          state.procCount++;
          const count=api.parameter(11005014);
          if(state.procCount>=count&&(state.procAt===null||api.time-state.procAt>api.parameter(11005013))){state.procCount=0;state.procAt=api.time;}
          if(state.procCount<count)api.hit(110300003);
        }
      }
      return state;
    },
    tick(state,api){
      if(has(2)&&api.time>=state.pulseAt&&api.buffs.count(api.actor,11002011)){
        if(api.distance<=4)api.hit(110300002);
        return {...state,pulseAt:api.time+.5};
      }
      return state;
    },
    event(state,api,name,data){
      if(name==='periodic-avatar'){state=spawn(state,api);api.schedule(name,5);return state;}
      if(name==='avatar-expire'){
        const avatar=state.avatars.find(a=>a.id===data.id);if(avatar)die(avatar,api);
        return {...state,avatars:state.avatars.filter(a=>a.id!==data.id)};
      }
      return state;
    },
    mark:tags=>tags.includes(DARK)?{element:6,hit:110000000,afterHitBuffs:[11090000]}:null,
    beforeMark(state,api){
      if(has(6))api.buffs.add(api.actor,11050611,api.actor);
      if(has(43))api.buffs.add(api.actor,11043011,api.actor);
      return state;
    },
  };
}
