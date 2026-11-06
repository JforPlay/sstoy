import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter} from './combat-support-adapter';
export interface FlameState extends Record<string,unknown>{generation:number;decayGeneration:number;strength:number;offField:boolean;loops:number}
const SKILL=combatTagHash('134_Support_Hurt'),ULT=combatTagHash('134_Ultra');
const P28=combatTagHash('134_P28'),MARK=combatTagHash('134_FireTag_Trigger');
export function createSupport134(potentials:Record<number,number>):SupportCombatAdapter<FlameState>{
  const has=(id:number)=>Boolean(potentials[id]);
  function attackTag(){
    if(has(513421))return has(513423)?'134_Support_Hurt_P21P23':'134_Support_Hurt_P21';
    if(has(513423)){
      if(has(513424))return has(513430)?'134_Support_Hurt_P24P30P23':'134_Support_Hurt_P24P23';
      return has(513430)?'134_Support_Hurt_P23P30':'134_Support_Hurt_P23';
    }
    if(has(513424))return has(513430)?'134_Support_Hurt_P24P30':'134_Support_Hurt_P24';
    return has(513430)?'134_Support_Hurt_P30':'134_Support_Hurt';
  }
  return {
    potentials:[513421,513422,513423,513424,513425,513426,513427,513428,513429,513430,513431,513432,513433,513441,513442,513443],
    actions(cinematics){
      const rush=has(513426)?has(513423)?'134_Support_Rush_P26P23':'134_Support_Rush_P26':'134_Support_Rush';
      return [{kind:'skill',skill:13432000,tag:rush,chain:[
        {tag:rush,until:'activation'},{tag:attackTag(),...(has(513422)?{until:'activation' as const}:{})},
        ...(has(513422)?[{tag:'134_Support_End_P22'}]:[]),
      ]},{kind:'ultimate',skill:13440000,tag:cinematics?'134_Ultra_TL':'134_Ultra_NoTL',loopCount:has(513442)?4:2}];
    },
    initialize(api){
      if(has(513433))for(const actor of api.actorsByElement(2))api.buffs.add(actor,13433011,api.actor);
      return {generation:0,decayGeneration:0,strength:0,offField:true,loops:0};
    },
    cast(state,api,key){
      const generation=state.generation+1;
      if(key==='skill'){
        if(has(513425))api.schedule('cast-buff',1/60,{generation});
        if(has(513424))api.schedule('strength',31/60,{generation});
        if(has(513429))api.schedule('field-buff',61/60,{generation});
      }
      return {...state,generation,strength:0,offField:false};
    },
    end(state,api,key){
      if(key==='skill'){
        api.stopAreasByTag?.('134_Support_Skill_Area');
        api.buffs.remove(api.actor,13427011);api.buffs.remove(api.actor,13429011);
      }
      if(key==='ultimate'){
        api.buffs.remove(api.actor,13441011);api.buffs.remove(api.actor,13443011);
      }
      const generation=state.generation+1;
      if(has(513427))api.schedule('off-field',61/60,{generation});
      return {...state,generation,strength:0,offField:true};
    },
    custom(state,api,name){
      if(name==='134_Ultra_Hurt')return {...state,loops:state.loops+1};
      if(name==='134_P43_Buff'&&has(513443)){
        for(let n=0;n<6;n++)api.buffs.add(api.actor,13443011,api.actor);
        const decayGeneration=state.decayGeneration+1;
        api.schedule('decay',61/60,{generation:state.generation,decayGeneration});
        return {...state,decayGeneration};
      }
      return state;
    },
    event(state,api,name,data){
      if(data.generation!==state.generation)return state;
      if(name==='cast-buff')api.buffs.add(api.actor,13425011,api.actor);
      if(name==='strength'&&!state.offField){
        api.schedule(name,31/60,data);return {...state,strength:state.strength+1};
      }
      if(name==='field-buff'&&!state.offField){api.buffs.add(api.actor,13429011,api.actor);api.schedule(name,61/60,data);}
      if(name==='off-field'&&state.offField){api.buffs.add(api.actor,13427011,api.actor);api.schedule(name,61/60,data);}
      if(name==='decay'&&data.decayGeneration===state.decayGeneration&&api.buffs.count(api.actor,13443011)){
        api.removeStacks(api.actor,13443011,1);api.schedule(name,61/60,data);
      }
      return state;
    },
    beforeHit(state,_api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(SKILL)){
        if(has(513423))once.push({id:13423011,count:1});
        if(has(513424)&&state.strength)once.push({id:13424011,count:state.strength});
        if(has(513430))once.push({id:13430001,count:1});
      }
      if(has(513431))once.push({id:13431001,count:1});
      if(has(513442)&&tags.includes(ULT))once.push({id:13442001,count:1});
      return once;
    },
    afterHit(state,api,tags){
      if(has(513428)&&tags.includes(P28))api.hit(134528001);
      // P32 requires a kill; the surviving raid target cannot trigger it.
      return state;
    },
    mark:tags=>tags.includes(MARK)?{element:2,variant:2,buffTag:'Fire',hit:134000001}:null,
    markTriggered(state,api,element,tags,source){
      if(source===api.actor&&element===2&&has(513441)&&tags.includes(ULT))api.buffs.add(api.actor,13441011,api.actor);
      return state;
    },
  };
}
