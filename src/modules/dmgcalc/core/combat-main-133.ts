import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter} from './combat-support-adapter';
export interface WindChannelState extends Record<string,unknown>{
  stage:number;lastNormal:number;started:number;generation:number;channeling:boolean;
  orbits:number;lastArea:string;channels:number;
}
const SKILL=hash('133_B1'),NORMAL=hash('133_Atk'),ULT=hash('133Ultra'),MARK=hash('133WindTagBoom');
const ORBIT='Bullet_13301_Ultra_TornadoRotate';
export function createMain133(potentials:Record<number,number>):SupportCombatAdapter<WindChannelState>{
  const has=(id:number)=>Boolean(potentials[id]);
  if([513301,513302,513303].every(has))throw new Error('이 캐릭터의 주력 전용 잠재력 세 개를 동시에 선택할 수 없습니다.');
  const loopTime=has(513302)?6:3;
  const skillTag=`133_B1${has(513301)?'P1':''}${has(513302)?'P2':''}${has(513303)?'P3':''}`;
  return {
    potentials:[513301,513302,513303,513304,513305,513306,513307,513308,513309,513310,513311,513312,513313,513341,513342,513343],
    actions:cinematics=>[
      {kind:'normal',skill:13310000,tag:'Atk1',normal:true,automatic:true},
      {kind:'skill',skill:13331001,tag:skillTag,loopSeconds:loopTime},
      ...(has(513313)?[{kind:'dodge',skill:13320000,tag:[3],flag:16,charges:2,automatic:true,spBudget:null}]:[]),
      {kind:'ultimate',skill:13340000,tag:`133_Ultra_${cinematics?'TL':'NoTL'}${has(513341)?'_P41':''}`},
    ],
    initialize(api){
      if(has(513311))api.buffs.add(api.actor,13351111,api.actor);
      if(has(513341))api.buffs.add(api.actor,13354111,api.actor);
      return {stage:0,lastNormal:0,started:0,generation:0,channeling:false,orbits:0,lastArea:'',channels:0};
    },
    automatic(_state,api){
      if(has(513313)&&!api.buffs.count(api.actor,13351311)&&api.skillReady?.('dodge'))return 'dodge';
      return 'normal';
    },
    comboTag:(state,_api,key)=>key==='normal'?`Atk${state.stage+1}`:null,
    cast(state,api,key){
      if(key==='normal'&&api.time>state.lastNormal+1)return {...state,stage:0};
      if(key==='skill'){
        if(has(513301))api.buffs.add(api.actor,13350111,api.actor);
        if(has(513306))api.buffs.add(api.actor,13350611,api.actor);
        if(has(513308))api.buffs.add(api.actor,13350811,api.actor);
        const generation=state.generation+1;
        api.schedule('recovery',loopTime,{generation});
        return {...state,started:api.time,generation,channeling:true,channels:state.channels+1};
      }
      if(key==='ultimate'&&has(513342))api.buffs.add(api.actor,13354211,api.actor);
      return state;
    },
    phase:(state,_api,key,phase)=>key==='normal'&&phase==='anticipation'?{...state,stage:(state.stage+1)%3}:state,
    end(state,api,key){
      if(key==='normal')return {...state,lastNormal:api.time};
      if(key==='dodge'&&has(513313))api.buffs.add(api.actor,13351311,api.actor);
      if(key!=='skill')return state;
      if(state.lastArea)api.stopWeapons(state.lastArea,true);
      if(has(513301))api.buffs.remove(api.actor,13350111);
      if(has(513306))api.buffs.remove(api.actor,13350611);
      if(has(513302)){
        const refund=loopTime-(Math.max(1,api.time-state.started)-1);
        if(refund>0)api.reduceCooldown(8*Math.round(refund)*.05,'skill');
      }
      return {...state,channeling:false,generation:state.generation+1,lastArea:''};
    },
    custom(state,api,name){
      const bezier:Record<string,string>={Bezier1:'Bullet_13301_Attack_3_Bezier1',Bezier2:'Bullet_13301_Attack_3_Bezier2',Bezier3:'Bullet_13301_Attack_3_Bezier3'};
      if(bezier[name])api.projectile(bezier[name]!);
      if(has(513304)&&['133_B1P4_Wind','133_B1P4_Wind2'].includes(name)){
        const area=name==='133_B1P4_Wind'?'AreaEffect_13301_B1P4_Wind':'AreaEffect_13301_B1P4_Wind2';
        api.area(area);return {...state,lastArea:area};
      }
      return state;
    },
    event(state,api,name,data){
      if(name==='recovery'&&state.channeling&&data.generation===state.generation&&has(513310))api.buffs.add(api.actor,13351011,api.actor);
      return state;
    },
    beforeHit(state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(SKILL)){
        if(has(513307))once.push({id:13350701,count:Math.max(1,Math.floor(api.time-state.started))});
        if(has(513305)){once.push({id:13350501,count:1});api.buffs.add('boss',13350511,api.actor);}
        // P9 requires two targets in this hit; a single raid boss is one.
      }
      if(has(513312)&&tags.includes(NORMAL)&&api.randomPercent()<api.parameter(13351211))api.buffs.add('boss',13351211,api.actor);
      return once;
    },
    afterHit(state,api,tags){
      if(has(513343)&&tags.includes(ULT))api.buffs.add('boss',13354311,api.actor);
      return state;
    },
    weaponDuration:(name,api)=>has(513342)&&name.startsWith(ORBIT)?api.parameter(13354211):undefined,
    weaponBegin(state,api,name){
      if(!name.startsWith(ORBIT))return state;
      const orbits=state.orbits+1;
      api.emitProc?.('qualified-ultra-tornado-spawned',{ultraTornadoCount:orbits});
      return {...state,orbits};
    },
    weaponEnd(state,api,name){
      if(!name.startsWith(ORBIT))return state;
      const orbits=Math.max(0,state.orbits-1);
      api.emitProc?.('qualified-ultra-tornado-finished',{ultraTornadoCount:orbits});
      return {...state,orbits};
    },
    mark:tags=>tags.includes(MARK)||has(513311)&&tags.includes(ULT)?{element:4,variant:2,area:'AreaEffect_133_WindMark1_Bloom'}:null,
  };
}
