import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface SimiaoState extends Record<string,unknown>{stage:number;followUntil:number;followGeneration:number;next:boolean;seen:boolean;p9:number;p10:number;trailGeneration:number;loops:number}
const NA=hash('NA'),MC=hash('MC'),S1=hash('Main_S1'),S2=hash('Main_S2'),ULT=hash('US');
export function createMain113(potentials:Record<number,number>):SupportCombatAdapter<SimiaoState>{
  const has=(n:number)=>Boolean(potentials[511300+n]),count=has(1)?6:3;
  const s1=`Main_S1${has(2)&&has(3)?'_P02&03':has(2)?'_P02':has(3)?'_P03':''}`;
  const s2=(n:number)=>has(2)?has(3)?'Main_S2_P02&03':'Main_S2_P02':`Main_S2_${n}${has(3)?'_P03':''}`;
  const cold=(api:SupportCombatApi)=>api.hasBuffTag('boss','Cold')||api.hasBuffTag('boss','Frozen');
  return {
    potentials:[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>511300+n),
    actions:cinematics=>[{kind:'normal',skill:11310000,tag:'A1',normal:true,automatic:true},
      {kind:'skill',skill:11331001,tag:s1,cooldownTiming:'end',chain:Array.from({length:count},(_,i)=>({tag:s1,enterEvent:'s1-segment',...(i<count-1?{until:'activation' as const}:{})}))},
      {kind:'skill-follow',skill:11331002,tag:s2(1),chain:[{tag:s2(1),until:'activation'},{tag:s2(2)}]},
      {kind:'ultimate',skill:11340000,tag:cinematics?'UltraTimelineOn':'UltraTimelineOff',chain:[{tag:cinematics?'UltraTimelineOn':'UltraTimelineOff',until:'activation'},
        {tag:has(41)?'Ultra_S1_P41':'Ultra_S1',until:'activation'},{tag:has(41)?'Ultra_S1_1_P41':'Ultra_S1_1',until:'activation'},
        {tag:'UltraEndLanding',enterEvent:'trigger-p43'}]},
      {kind:'dodge',skill:11320000,tag:[3],group:'-2502791292039550585',flag:16,automatic:true,spBudget:null}],
    initialize:()=>({stage:0,followUntil:0,followGeneration:0,next:false,seen:false,p9:-1,p10:-1,trailGeneration:0,loops:0}),
    automatic:()=> 'normal',comboTag:(s,api,key)=>key==='normal'?`A${s.stage+1}${has(11)&&api.buffs.count(api.actor,11311011)?'_P11':''}`:null,
    canCast:(s,api,key)=>key==='skill'?api.time>=s.followUntil:key==='skill-follow'?api.time<s.followUntil:true,
    cast(s,api,key){
      s={...s};
      if(key==='skill'||key==='skill-follow'||key==='ultimate')api.buffs.remove(api.actor,11312011);
      if(key==='skill'){s.seen=false;s.loops=0;if(has(5))api.buffs.add(api.actor,11305011,api.actor);}
      if(key==='skill-follow'){s.followUntil=0;s.followGeneration++;s.seen=false;if(has(1))api.buffs.remove(api.actor,11301011);}
      if(key==='ultimate'){s.followUntil=0;s.followGeneration++;}
      if(has(10)&&(key.startsWith('skill')||key==='dodge')&&(s.p10<0||api.time-s.p10>10)){
        s.p10=api.time;s.trailGeneration++;for(let i=0;i<10;i++)api.schedule('trail',i*.3,{generation:s.trailGeneration});
      }return s;
    },
    phase(s,api,key,phase){
      if(key==='skill'&&phase==='activation'&&s.loops>=count){const followGeneration=s.followGeneration+1,seconds=3;api.schedule('follow-expire',seconds,{generation:followGeneration});return {...s,followGeneration,followUntil:api.time+seconds};}
      return s;
    },
    end(s,api,key){
      if(key==='normal')return {...s,stage:(s.stage+1)%3};
      if(key==='skill'){api.buffs.remove(api.actor,11305011);return {...s,next:false};}
      if(key==='skill-follow'){if(has(11))api.buffs.add(api.actor,11311011,api.actor);return {...s,followUntil:0};}return s;
    },
    custom(s,api,name){
      if(name==='s1-segment')return {...s,loops:s.loops+1};
      if(name==='P04'&&has(4))api.area(has(3)?'AreaEffect_11301_Skill_Main_P04_Wave_Ex':'AreaEffect_11301_Skill_Main_P04_Wave',api.actor,{x:0,z:0});
      if(name==='trigger-p43'&&has(43)&&api.distance>=2&&api.distance<=11)for(let i=0;i<3;i++)api.schedule('p43',.5+i*.1);
      return s;
    },
    beforeHit(s,api,tags){const result:{id:number;count:number}[]=[];
      if(has(2)&&tags.includes(MC))result.push({id:11302011,count:1});if(has(3)&&tags.includes(S2))result.push({id:11303011,count:1});if(has(6)&&tags.includes(S1)&&s.next)result.push({id:11306002,count:1});
      const hp=Math.min(9,Math.max(0,Math.floor((1-(api.bossHpPercent?.()??1))*10)));
      if(has(7)&&tags.includes(S2)&&cold(api))result.push({id:11307001+Math.min(8,hp),count:1});
      if(has(11)&&tags.includes(NA)&&api.buffs.count(api.actor,11311011))result.push({id:11311001,count:1});
      if(has(13)&&tags.includes(MC)){if(api.hasBuffTag('boss','Cold'))result.push({id:11313001,count:1});if(api.bossBroken?.())result.push({id:11313002,count:1});}
      if(tags.includes(ULT)){if(has(41)&&(cold(api)||api.hasBuffTag('boss','WaterMark1')))result.push({id:11341001,count:1});if(has(42)&&hp>0&&cold(api))result.push({id:11342000+hp,count:1});}return result;
    },
    afterHit(s,api,tags){s={...s};
      if(has(1)&&tags.includes(S1))api.buffs.add(api.actor,11301011,api.actor);
      if(has(3)&&tags.includes(S1)&&!s.seen){api.buffs.add(api.actor,11303011,api.actor);s.seen=true;}
      if(has(9)&&Math.floor(api.randomPercent())<15&&(s.p9<0||api.time-s.p9>5)){api.area('AreaEffect_11301_Skill_Main_P09_Wave',api.actor,{x:0,z:0});s.p9=api.time;}
      if(has(12)&&tags.includes(NA)&&cold(api))api.buffs.add(api.actor,11312011,api.actor);return s;
    },
    event(s,api,name,data){
      if(name==='follow-expire'&&data.generation===s.followGeneration){if(has(6))api.reduceCooldown(api.parameter(11306001));return {...s,followUntil:0,next:has(6)};}
      if(name==='trail'&&data.generation===s.trailGeneration)api.area('AreaEffect_11301_Skill_Main_P10_Puddle',api.actor,{x:0,z:0});
      if(name==='p43')api.area('AreaEffect_11301_Ultra_P43_PuddleBoom','boss');
      if(name==='main-hurt'&&has(5)&&api.activeAction()==='skill')api.buffs.add(api.actor,11305012,api.actor);return s;
    },
    mark:tags=>tags.includes(hash('Cold'))?{element:1,variant:1,area:'AreaEffect_113_WaterTag1_Boom',applyBuff:4021}:null,
    markTriggered(s,api,element,_tags,source){if(element===1&&source===api.actor){api.emitProc?.('own-water-mark-1');if((api.buffTagCount?.('boss','Cold')??0)>=3){api.removeBuffTag?.('boss','Cold');api.buffs.add('boss',4100,api.actor);}}return s;},
  };
}
