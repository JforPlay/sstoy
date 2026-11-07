import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi,SupportCombatAction} from './combat-support-adapter';
interface LaruState extends Record<string,unknown>{stage:number;normalAt:number;p4:number;p8:number;p9:number;p9Generation:number;p42:number;bossSeen:boolean;dotGeneration:number;rushStart:number;rushAt:number;rushEnabled:boolean}
const T=(s:string)=>hash(`150_${s}`);
export function createMain150(potentials:Record<number,number>):SupportCombatAdapter<LaruState>{
  const has=(n:number)=>Boolean(potentials[515000+n]);
  function boom(api:SupportCombatApi){const count=api.buffs.count('boss',15002012);if(count>0){api.buffs.remove('boss',15002012);api.area(count>=20?'AreaEffect_150_Main_Skill_P02_Boom_Big':'AreaEffect_150_Main_Skill_P02_Boom_Small','boss');}}
  return {
    potentials:[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>515000+n),
    actions:cinematics=>[
      {kind:'normal',skill:15010000,tag:'Attack_1',normal:true,automatic:true},
      ...Array.from({length:has(3)?3:1},(_,i):SupportCombatAction=>{
        const n=i+1,laser=has(4)&&n>=3?`150_Main_Skill_2_C${n}`:`150_Main_Skill_B${n}`;
        return {kind:n===1?'skill':`skill:${n}`,skill:15031000,cooldownKey:'skill',tag:has(6)?'150_Main_Skill_P06_A1':'150_Main_Skill_A1',
          chain:[...Array.from({length:n},(_,j)=>({tag:`150_Main_Skill_${has(6)?'P06_':''}A${j+1}`,until:'activation' as const,enterEvent:'laru-sweep'})),
            {tag:laser,enterEvent:'laru-laser'},...(has(4)&&n>=3?[{tag:laser,index:1,repeatSeconds:4},{tag:laser,index:2}]:[])]};
      }),
      {kind:'ultimate',skill:15040000,tag:cinematics?'150_Ultra_TL':'150_Ultra_NoTL'},
      {kind:'rush',skill:15070000,tag:[3,11],flag:8,automatic:true,loopSeconds:2,spBudget:null}],
    initialize:()=>({stage:0,normalAt:-10,p4:0,p8:0,p9:0,p9Generation:0,p42:-1,bossSeen:false,dotGeneration:0,rushStart:0,rushAt:-1,rushEnabled:false}),
    automatic:(s,api)=>'normal',comboTag:(s,api,key)=>key==='normal'?`Attack_${api.time-s.normalAt>1?1:s.stage+1}`:null,
    phase(s,api,key,phase){if(key==='normal'&&phase==='anticipation')return {...s,stage:(api.time-s.normalAt>1?1:s.stage+1)%5,normalAt:api.time};return s;},
    cast(s,api,key){
      if(key==='rush')return {...s,rushStart:api.time,rushEnabled:has(11)&&(s.rushAt<0||api.time-s.rushAt>api.parameter(15011011))};
      if(key.startsWith('skill')){const p8=api.buffs.count(api.actor,15008011);api.buffs.remove(api.actor,15008011);return {...s,stage:0,p4:0,p8};}
      if(key==='ultimate'){api.emitProc?.('own-ultimate-start');return {...s,stage:0};}return s;
    },
    custom(s,api,name){
      if(name==='laru-sweep'&&has(4)){api.buffs.add(api.actor,15004011,api.actor);return {...s,p4:api.buffs.count(api.actor,15004011)};}
      if(name==='laru-laser'&&has(4)){api.buffs.remove(api.actor,15004011);if(s.p4>=3)api.buffs.add(api.actor,15004012,api.actor);}
      if(name==='ElectricGrid_Start'&&has(1))api.area('AreaEffect_150_Main_Skill_P01_ElectricGrid','boss');
      if(name==='150_Ultra_Attack'){api.area('AreaEffect_150_Ultra',api.actor,{x:7,z:0});if(has(41))api.area('AreaEffect_150_Ultra_P41',api.actor,{x:7,z:0});}return s;
    },
    end(s,api,key){if(key.startsWith('skill')){api.buffs.remove(api.actor,15004012);if(has(5))api.buffs.add(api.actor,15005011,api.actor);return {...s,p4:0,p8:0};}
      if(key==='rush'&&s.rushEnabled&&api.time-s.rushStart>=2-1e-9){api.area('AreaEffect_150_Main_Skill_P11_Boom',api.actor,{x:0,z:0});return {...s,rushAt:api.time,rushEnabled:false};}return s;},
    attacked(s,api,tags){
      if(has(8)&&tags.includes(T('Attack'))&&api.hasBuffTag('boss','LightMark1'))api.buffs.add(api.actor,15008011,api.actor);
      if(has(43)&&tags.includes(T('Ultra')))api.buffs.add(api.actor,15043011,api.actor);
      if(has(13)&&!s.bossSeen){api.buffs.add(api.actor,15013011,api.actor);return {...s,bossSeen:true};}return s;
    },
    beforeHit(s,api,tags){const result:{id:number;count:number}[]=[];
      if(has(4)&&tags.includes(T('P04')))result.push({id:15004011,count:s.p4});if(has(7))result.push({id:15007001,count:api.buffs.count('boss',15007011)});
      if(has(8)&&tags.includes(T('Skill')))result.push({id:15008001,count:s.p8});if(has(10)&&tags.includes(T('P10_2')))result.push({id:15010001,count:api.buffs.count('boss',15010011)});
      if(has(42)&&tags.includes(T('Ultra_P42')))result.push({id:15042001,count:1});return result;
    },
    afterHit(s,api,tags){
      s={...s};
      if(has(2)){
        if(tags.includes(T('P02_Hurt_Trigger'))&&api.buffs.count('boss',15002011))api.hit(150310201,undefined,{buffIdsForTarget:[15002012]});
        if(tags.includes(T('P02_DoT_Trigger'))){api.buffs.add('boss',15002011,api.actor);s.dotGeneration++;api.schedule('dot-expire',api.buffDuration!(15002011)+1/60,{generation:s.dotGeneration});}
      }
      if(has(7)&&tags.includes(T('P07')))api.buffs.add('boss',15007011,api.actor);if(has(10)&&tags.includes(T('P10_1')))api.buffs.add('boss',15010011,api.actor);
      if(has(42)&&tags.includes(T('Ultra_P42'))&&(s.p42<0||api.time-s.p42>api.parameter(15042012))){api.directSp(api.actor,api.parameter(15042011)*10000);s.p42=api.time;}
      return s;
    },
    event(s,api,name,data){
      if(name==='dot-expire'&&data.generation===s.dotGeneration&&!api.buffs.count('boss',15002011))boom(api);
      if(name==='electric-check'&&api.buffs.count('boss',15002012)>=20){boom(api);api.buffs.remove('boss',15002011);}
      if(name==='p9')api.hit(150310901);if(name==='p9-reset'&&data.generation===s.p9Generation)return {...s,p9:0};return s;
    },
    partyHit(s,api,hit){if(has(2)&&hit.actor===api.actor&&hit.tags.includes(T('P02_Hurt_Trigger')))api.schedule('electric-check',0);return s;},
    mark:tags=>tags.includes(T('LightMark_Trigger'))?{element:5,variant:1,area:'AreaEffect_150_LightTag_Boom'}:null,
    markTriggered(s,api,element,tags,source){
      if(element!==5||source!==api.actor)return s;api.emitProc?.('own-light-mark-1');
      if(has(12)&&tags.includes(T('Skill')))api.buffs.add(api.actor,15012011,api.actor);
      if(has(9)&&tags.includes(T('P09'))&&s.p9<3){let generation=s.p9Generation;if(s.p9===0){generation++;api.schedule('p9-reset',1,{generation});}api.schedule('p9',.5);return {...s,p9:s.p9+1,p9Generation:generation};}return s;
    },
  };
}
