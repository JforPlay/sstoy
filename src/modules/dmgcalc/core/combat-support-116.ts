import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface ReisenState extends Record<string,unknown>{wave:number;generation:number;skillActive:boolean;explosions:number;windowGeneration:number;chains:number;ultraHits:number}
const T=(s:string)=>hash(`116_${s}`),FALL=T('B2_Seed_Fall'),BOOM=T('B2_Seed_AttachExplosion'),ULTRA=T('Ultra_AOE');
export function createSupport116(potentials:Record<number,number>):SupportCombatAdapter<ReisenState>{
  const has=(n:number)=>Boolean(potentials[511600+n]);let cinematic=true;
  function explosion(s:ReisenState,api:SupportCombatApi){
    if(has(24)){if(api.buffs.count('boss',11691014))return false;api.buffs.add('boss',11691014,api.actor);}
    api.area('AreaEffect_11601_Skill_Sup_AttachSeedBoom','boss',{scale:has(24)?1.5:1});
    // P30 excludes the struck boss and has no secondary enemy in this profile.
    return true;
  }
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>511600+n),
    actions(cinematics){cinematic=cinematics;const tag=has(22)?'B2_Skill_Perk22':'B2_Skill';return [{kind:'skill',skill:11632000,tag,...(has(21)?{chain:[{tag},{tag}]}:{})},{kind:'ultimate',skill:11640000,tag:cinematics?'116_Ultra_TL':'116_Ultra_NoTL'}];},
    initialize(api){if(has(33))for(const actor of api.party)for(const _ of api.actorsByElement(3))api.buffs.add(actor,11633011,api.actor);return {wave:0,generation:0,skillActive:false,explosions:0,windowGeneration:0,chains:0,ultraHits:0};},
    cast(s,api,key){
      if(key==='skill'){api.buffs.remove(api.actor,11625011);const generation=s.generation+1;if(has(25))api.schedule('p25',.5,{generation});return {...s,wave:0,chains:0,generation,skillActive:true};}
      if(key==='ultimate'){if(has(43))api.buffs.add(api.actor,11643011,api.actor);if(cinematic)api.area('AreaEffect_11601_Ultra_TL','boss');return {...s,ultraHits:0};}return s;
    },
    end:(s,_api,key)=>key==='skill'?{...s,skillActive:false}:s,
    custom(s,api,name){
      if(name==='SupSkill_SeedRain'){
        const suffix=has(22)?has(27)?'_Perk22_Perk27':'_Perk22':has(27)?'_Perk27':'';
        api.area(`AreaEffect_11601_Skill_Sup_Seed${suffix}`,'boss',{additionalAttributes:has(21)&&s.wave>0?[{id:11621001,count:1}]:[]});return {...s,wave:s.wave+1};
      }
      if(name==='116_Ultra_Area')api.area('AreaEffect_11601_Ultra','boss');return s;
    },
    beforeHit(s,api,tags){
      const result:{id:number;count:number}[]=[];
      for(const [n,tag,id] of [[22,FALL,11622001],[23,BOOM,11623001],[24,BOOM,11624001],[27,FALL,11627001],[30,BOOM,11630001],[41,T('Ultra_Final'),11641001]])if(has(n!)&&tags.includes(tag!))result.push({id:id!,count:1});
      if(has(25)&&tags.includes(FALL))result.push({id:11625001,count:api.buffs.count(api.actor,11625011)});
      if(has(28)&&api.hasBuffTag('boss','116_SupSkill_Seed_Attach'))result.push({id:11628001,count:1});
      if(has(42)&&tags.includes(ULTRA))result.push({id:11642001,count:Math.min(s.ultraHits,api.parameter(11642011))});return result;
    },
    afterHit(s,api,tags){
      s={...s};
      if(tags.includes(FALL)){
        api.buffs.add('boss',has(23)?11623011:11691011,api.actor);
        if(has(29))api.buffs.add('boss',has(23)?11629012:11629011,api.actor);
        if(has(26))api.buffs.add('boss',11626011,api.actor);
      }
      if(tags.includes(BOOM)){
        if(s.explosions===0){s.windowGeneration++;api.schedule('explosion-window',2,{generation:s.windowGeneration});}
        s.explosions++;
        if(s.explosions>=6){api.buffs.add('boss',11691013,api.actor);s.explosions=0;s.windowGeneration++;}
        if(has(23))api.buffs.add('boss',6011,api.actor);
        if(has(24)&&s.chains<10&&api.hasBuffTag('boss','116_SupSkill_Seed_Attach')&&explosion(s,api))s.chains++;
      }
      if(tags.includes(ULTRA)){if(has(42))s.ultraHits++;if(has(31))api.buffs.add('boss',6011,api.actor);}return s;
    },
    event(s,api,name,data){
      if(name==='p25'&&s.skillActive&&data.generation===s.generation){api.buffs.add(api.actor,11625011,api.actor);api.schedule(name,.5,data);}
      if(name==='explosion-window'&&data.generation===s.windowGeneration)return {...s,explosions:0};return s;
    },
    mark:tags=>tags.includes(T('LandTag_Trigger'))?{element:3,variant:1,area:'AreaEffect_11601_LandTag1_Stone'}:null,
    markTriggered(s,api,element){if(element===3){api.emitProc?.('earth-mark-triggered');if(api.hasBuffTag('boss','116_SupSkill_Seed_Attach'))explosion(s,api);}return s;},
  };
}
