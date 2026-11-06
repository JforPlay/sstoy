import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';

interface LotteryState extends Record<string,unknown> {
  next:number;previous:number;result:number;hasTriple:boolean;generation:number;extra:boolean;
  shots:number;shotReset:number|null;
}
const SHOT_A=combatTagHash('Shot_Penguin'),SHOT_B=combatTagHash('Shot_Heart'),ALL_SHOTS=combatTagHash('156SupSkillAllShot');
const ULTRA=combatTagHash('156UltraAtk'),EARTH_MARK=combatTagHash('156AddLandMark1');
const triples=[2,256],groups=[[2],[4,8,16],[32,64,128],[256]];

/** Native five-draw support state machine. The fifth draw guarantees a triple
 * only if none of the preceding draws had one; an ultimate pauses, rather
 * than restarts, the outstanding draw sequence. No record/preset is embedded. */
export function createSupport156(potentials:Record<number,number>):SupportCombatAdapter<LotteryState> {
  const has=(id:number)=>Boolean(potentials[id]);
  const team=(api:SupportCombatApi,id:number)=>{for(const actor of api.party) api.buffs.add(actor,id,api.actor);};
  function raffle(state:LotteryState,api:SupportCombatApi):LotteryState {
    if(state.next<1 || state.next>5) return state;
    const weights=has(515622)!==has(515623) ? has(515622)?[50,50,0,0]:[0,0,50,50] : [25,25,25,25];
    const roll=api.randomPercent();let group=0,total=0;
    for(let n=0;n<weights.length;n++){total+=weights[n]!;if(roll<=total){group=n;break;}}
    const list=groups[group]!,choice=list[Math.min(list.length-1,Math.floor(api.randomPercent()*list.length/100))]!;
    let result=choice;
    if(state.next===5 && !state.hasTriple) result=has(515622)!==has(515623) ? has(515622)?2:256 : api.randomPercent()>50?2:256;
    if(has(515632)) api.buffs.add(api.actor,15632011,api.actor);
    if(has(515633) && triples.includes(state.previous) && triples.includes(result)) team(api,15633011);
    api.cast('raffle');
    return {...state,next:state.next+1,result,previous:result,hasTriple:state.hasTriple || triples.includes(result),extra:false};
  }
  function finish(state:LotteryState,api:SupportCombatApi):LotteryState {
    if(state.next<=5) api.schedule('raffle-next',1,{generation:state.generation});
    else {api.buffs.remove(api.actor,15691014);return {...state,next:0};}
    return state;
  }
  return {
    potentials:[515621,515622,515623,515624,515625,515626,515627,515628,515629,515630,515631,515632,515633,515641,515642,515643],
    actions:cinematics=>[
      {kind:'skill',skill:15632000,tag:'Skill_Sup_StartShow'},
      {kind:'ultimate',skill:15640000,tag:cinematics?'Ultra_TimelineOn':'Ultra_TimelineOff'},
      {kind:'raffle',skill:15632001,tag:'Skill_Sup_Raffle',automatic:true},
      {kind:'sculpture',skill:15632003,tag:'Skill_Sup_PenguinStatueCalling',automatic:true},
      {kind:'heart',skill:15632002,tag:'Skill_Sup_ShootHeartArrow',automatic:true},
      {kind:'strafe-a',skill:15632005,tag:'Skill_Sup_Shot_Penguin',automatic:true},
      {kind:'strafe-b',skill:15632004,tag:has(515628)?'Skill_Sup_Shot_Heart_P28':'Skill_Sup_Shot_Heart',automatic:true},
    ],
    initialize(api) {
      if(has(515631)) for(const actor of api.actorsByElement(3)) api.buffs.add(actor,15631011,api.actor);
      return {next:0,previous:0,result:0,hasTriple:false,generation:0,extra:false,shots:0,shotReset:null};
    },
    cast(state,api,key) {
      if(key==='skill') {
        api.buffs.remove(api.actor,15691014);
        return {...state,next:1,previous:0,result:0,hasTriple:false,generation:state.generation+1,extra:false};
      }
      if(key==='ultimate') {
        api.buffs.remove(api.actor,15691014);
        if(has(515641)) team(api,15641011);
        return {...state,generation:state.generation+1};
      }
      return state;
    },
    end(state,api,key,interrupted) {
      if(key==='ultimate') {
        if(state.next>0) {api.buffs.add(api.actor,15691014,api.actor);api.schedule('raffle-next',1,{generation:state.generation});}
        return state;
      }
      if(interrupted) return state;
      if(key==='skill') {api.buffs.add(api.actor,15691014,api.actor);return raffle(state,api);}
      if(key==='raffle') {
        const normal=[2,4,8,16].includes(state.result);
        team(api,normal ? has(515621)?15621011:15691011 : has(515624)?15624011:15691012);
        api.cast(state.result===2?'sculpture':state.result===256?'heart':normal?'strafe-a':'strafe-b');
        return state;
      }
      if(key==='sculpture' && has(515626)) {
        api.buffs.add(api.main,15626011,api.actor);api.cast('strafe-a');return {...state,extra:true};
      }
      if(key==='heart' && has(515629)) {
        api.buffs.add(api.main,15629011,api.actor);api.cast('strafe-b');return {...state,extra:true};
      }
      return finish(state,api);
    },
    event(state,api,name,data) {
      if(name==='raffle-next' && data.generation===state.generation) return raffle(state,api);
      if(name==='shot-reset') return {...state,shots:0,shotReset:null};
      if(name==='heart-friendly') {
        api.buffs.add(api.main,has(515630)?15630011:15691013,api.actor);
        api.area(has(515624)?'AreaEffect_156_Sup_Skill_HeartArrowBoom_P24':'AreaEffect_156_Sup_Skill_HeartArrowBoom',api.main);
      }
      if(name==='heart-enemy') api.area(has(515624)?'AreaEffect_156_Sup_Skill_HeartArrowBoom_P24':'AreaEffect_156_Sup_Skill_HeartArrowBoom');
      if(name==='statue-boom') api.area('AreaEffect_156_P27_PenguinStatueBoom');
      return state;
    },
    attacked(state,api,tags) {
      if(has(515625) && tags.includes(SHOT_A)) {
        if(state.shots<api.parameter(15625012)) {api.area('AreaEffect_156_P25_ShotBoom');state={...state,shots:state.shots+1};}
        if(state.shotReset===null) {
          const delay=api.parameter(15625011);api.schedule('shot-reset',delay);
          state={...state,shotReset:api.time+delay};
        }
      }
      return state;
    },
    beforeHit(_state,_api,tags){return has(515630)&&tags.includes(ALL_SHOTS)?[{id:15630001,count:1}]:[];},
    afterHit(state,api,tags) {
      if(has(515628) && tags.includes(SHOT_B)) api.buffs.add('boss',15628011,api.actor);
      if(has(515643) && tags.includes(ULTRA) && api.randomPercent()<=api.parameter(15643011)) api.buffs.add('boss',15643011,api.actor);
      if(tags.includes(EARTH_MARK)) api.buffs.add('boss',6011,api.actor);
      return state;
    },
    custom(state,api,name) {
      if(name==='PenguinStatueCalling') api.projectile('Bullet_156_Sup_Skill_PenguinStatueCalling_Fly');
      if(name==='ShootHeartArrow') api.projectile('Bullet_156_Sup_Skill_HeartArrow',api.main);
      if(name==='156UltraBoom') team(api,15694011);
      // P42 is a pull-only area. A stationary, all-hits scenario has no
      // movement to resolve and must not synthesize damage for this visual.
      return state;
    },
    projectileEnd(state,api,name,target) {
      if(name==='Bullet_156_Sup_Skill_PenguinStatueCalling_Fly') {
        const suffix=has(515621)?has(515622)?'_P22P21':'_P21':has(515622)?'_P22':'';
        api.area(`AreaEffect_156_Sup_Skill_PenguinStatue${suffix}`);
      }
      if(name==='Bullet_156_Sup_Skill_HeartArrow') {
        if(target===api.main && has(515623) && api.distance<15) api.projectile('Bullet_156_Sup_Skill_HeartArrow');
        api.schedule(target===api.main?'heart-friendly':'heart-enemy',.3);
      }
      return state;
    },
    areaEnd(state,api,name) {
      if(has(515627) && name.startsWith('AreaEffect_156_Sup_Skill_PenguinStatue')) api.schedule('statue-boom',.1);
      return state;
    },
  };
}
