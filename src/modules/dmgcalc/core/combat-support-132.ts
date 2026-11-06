import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';

export interface Support132State extends Record<string,unknown> {starTick:number|null;mainStarTick:number|null;mainTriggerUntil:number;triggerUntil:number;lastCounterHit:number;castHits:number;canReduce:boolean}
const SKILL=combatTagHash('132_Support_Hurt'),SECTOR=combatTagHash('132_Support_SectorStar'),BOOM=combatTagHash('132_Support_StarBoom');
const ULTRA=combatTagHash('132_Ultra'),P28=combatTagHash('132_P28');

/** _13201 support controller on the shared area, drop and shield lifecycles. */
export function createSupport132(potentials:Record<number,number>):SupportCombatAdapter<Support132State> {
  const has=(id:number)=>Boolean(potentials[id]);
  const starCount=(api:SupportCombatApi)=>api.buffs.count('boss',13295011);
  const addStars=(state:Support132State,api:SupportCombatApi,count:number):Support132State=>{
    const before=starCount(api);
    for(let n=0;n<count && before+n<4;n++) api.buffs.add('boss',13295011,api.actor);
    return {...state,starTick:state.starTick ?? api.time+3+1/60};
  };
  const countCastHit=(state:Support132State,api:SupportCombatApi)=>{
    if(!has(513229) || !state.canReduce) return state;
    const castHits=state.castHits+1;
    if(castHits<3) return {...state,castHits};
    api.reduceCooldown(api.parameter(13229011));
    for(const actor of api.party) api.buffs.add(actor,13229011,api.actor);
    return {...state,castHits,canReduce:false};
  };
  return {
    potentials:[513221,513222,513223,513224,513225,513226,513227,513228,513229,513230,513231,513232,513233,513241,513242,513243],
    actions:cinematics=>[{kind:'skill',skill:13232000,tag:'132_Support_Skill'},
      {kind:'ultimate',skill:has(513241)?13244100:13240000,tag:cinematics?'132_Ultra_TL':'132_Ultra_NoTL'}],
    initialize(api) {
      if(has(513233)) for(const actor of api.party) for(const _light of api.lightActors) api.buffs.add(actor,13233011,api.actor);
      return {starTick:null,mainStarTick:null,mainTriggerUntil:0,triggerUntil:0,lastCounterHit:0,castHits:0,canReduce:false};
    },
    cast(state,api,slot) {
      if(slot!=='skill') return state;
      if(has(513231)) api.buffs.add(api.actor,13231011,api.actor);
      return {...state,castHits:0,canReduce:true};
    },
    end(state,api,slot,interrupted) {
      if(slot==='ultimate' && !interrupted && has(513231)) api.buffs.remove(api.actor,13231011);
      return state;
    },
    attacked(state,api,tags) {
      if(has(513231) && tags.includes(ULTRA)) api.buffs.add('boss',3011,api.actor);
      return tags.includes(SKILL) ? countCastHit(state,api) : state;
    },
    beforeHit(state,api,tags) {
      const once:{id:number;count:number}[]=[];
      if(has(513221) && tags.includes(SECTOR)) once.push({id:13221011,count:1});
      const count=starCount(api)+(state.triggerUntil>api.time?1:0);
      if(has(513225) && count) once.push({id:13225001,count});
      if(tags.includes(BOOM)) {
        if(has(513222)) once.push({id:13222011,count:1});
        const targets=Number(count>0)+Number(api.buffs.count(api.main,13295011)>0||state.mainTriggerUntil>api.time);
        if(has(513227) && targets) once.push({id:13227001,count:Math.min(targets,api.parameter(13227011))});
      }
      if(tags.includes(ULTRA)) {
        if(has(513241)) once.push({id:13241001,count:1});
        if(has(513242)) once.push({id:13242001,count:1});
      }
      return once;
    },
    afterHit(state,api,tags) {
      if(tags.includes(SKILL)) state=addStars(state,api,has(513221)?4:2);
      if(has(513228) && tags.includes(P28)) state=addStars(state,api,1);
      return state;
    },
    mainHit(state,api) {
      if(!has(513226) || (state.lastCounterHit>0 && api.time-state.lastCounterHit<=1)
        || !(starCount(api)>0 || state.triggerUntil>api.time)) return state;
      api.hit(132526001);
      return {...state,lastCounterHit:api.time};
    },
    tick(state,api) {
      const area=has(513222)?'AreaEffect_132_Support_StarBurst_P22_Big':'AreaEffect_132_Support_StarBurst';
      if(state.mainStarTick!==null){
        if(!api.buffs.count(api.main,13295011))state={...state,mainStarTick:null};
        else if(api.time>=state.mainStarTick){
          api.removeStacks(api.main,13295011,1);
          const duration=api.area(area,api.main);
          state={...state,mainStarTick:api.time+3+1/60,mainTriggerUntil:api.time+duration};
        }
      }
      if(state.starTick!==null){
        if(!starCount(api))state={...state,starTick:null};
        else if(api.time>=state.starTick){
          api.removeStacks('boss',13295011,1);
          const duration=api.area(area);
          state={...state,starTick:api.time+3+1/60,triggerUntil:api.time+duration};
        }
      }
      return state;
    },
    custom(state,api,name) {
      if(name==='StartArea') {
        api.area(has(513242)?'AreaEffect_132_Ultra_P42':'AreaEffect_132_Ultra');
        if(has(513243)) api.area('AreaEffect_132_Ultra_H6');
      }
      if(name==='132_P28_Shoot' && has(513228)) for(let n=1;n<=4;n++) api.projectile(`Bullet_132_Support_P28_${n}`);
      if(name==='132_P23_Shoot' && has(513223)) api.projectile('Bullet_132_Support_P23',api.main);
      return state;
    },
    projectileEnd(state,api,name,target) {
      if(name!=='Bullet_132_Support_P23' || !has(513223)) return state;
      api.shield(13223011,target);
      return countCastHit(state,api);
    },
    dropEnd(state,api,name,picked){
      if(name!=='Item_132_Support_P24_Star'||!picked||!has(513224))return state;
      if(api.buffs.count(api.main,13295011)<4)api.buffs.add(api.main,13295011,api.actor);
      if(has(513223))api.shield(13223011,api.main);
      return {...state,mainStarTick:state.mainStarTick ?? api.time+3+1/60};
    },
    areaEnd(state,api,name,position) {
      if(!name.startsWith('AreaEffect_132_Support_StarBurst'))return state;
      if(has(513230) && Math.hypot(position.x,position.z)<api.areaRadius(name)) api.buffs.add(api.main,13230011,api.actor);
      if(has(513224)&&position.center==='boss')api.drop('Item_132_Support_P24_Star',{...position,y:1});
      return state;
    },
  };
}
