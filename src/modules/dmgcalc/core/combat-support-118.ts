import {combatTagHash} from './combat-tags';
import type {SupportCombatAdapter} from './combat-support-adapter';
interface ChainState extends Record<string,unknown>{linked:boolean;firstHits:number;continued:boolean;lastToughness:number|null}
const FIRST=combatTagHash('118_Sup_HengZhan_Hit_1'),SECOND=combatTagHash('118_Sup_HengZhan_Hit_2');
const HENG=combatTagHash('118_Sup_HengZhan_Common'),SICKLE=combatTagHash('118_FeiLian_Atk');
const SUPPORT=combatTagHash('118_Sup_Atk'),ULTRA=combatTagHash('118_Ultra_Atk'),FINISH=combatTagHash('118_Ultra_Atk_2');
const ADD=combatTagHash('118_AddDarkMark1'),TRIGGER=combatTagHash('118DarkTagBoom');
/** Native support link/tear combo. P28's three-target gate cannot be satisfied
 * by a single raid boss. Forced displacement also leaves this boss stationary. */
export function createSupport118(potentials:Record<number,number>):SupportCombatAdapter<ChainState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const first=has(511821)?'Skill_Sup_ZhanHun_1_P21':'Skill_Sup_ZhanHun_1';
  return {
    potentials:[511821,511822,511823,511824,511825,511826,511827,511828,511829,511830,511831,511832,511833,511841,511842,511843],
    actions:cinematics=>[{kind:'skill',skill:11832000,tag:first,chain:[{tag:first,until:'activation'},
      {tag:has(511822)?'Skill_Sup_ZhanHun_2_P22':'Skill_Sup_ZhanHun_2'}]},
      {kind:'ultimate',skill:11840000,tag:cinematics?'Ultra_TimelineOn':'Ultra_TimelineOff',loopCount:2}],
    initialize(api){
      if(has(511831))api.buffs.add(api.actor,11831011,api.actor);
      if(has(511832))api.buffs.add(api.actor,11832011,api.actor);
      if(has(511833))for(const actor of api.actorsByElement(6))api.buffs.add(actor,11833011,api.actor);
      return {linked:false,firstHits:0,continued:false,lastToughness:null};
    },
    cast(state,api,key){
      if(key==='skill')return {...state,linked:false,firstHits:0,continued:false};
      if(key==='ultimate'){
        api.buffs.add(api.actor,11890002,api.actor);
        if(has(511842))api.buffs.add(api.main,11842011,api.actor);
      }
      return state;
    },
    continuation(state,_api,key){
      if(key==='skill'&&!state.continued&&state.firstHits===1&&has(511825))return {state:{...state,continued:true},
        tag:has(511821)?'Skill_Sup_P25_HuiKan_P21':'Skill_Sup_P25_HuiKan'};
      return null;
    },
    end(state,api,key){
      if(key==='ultimate'){api.stopWeapons('AreaEffect_118_Ultra_XiYin',true);api.buffs.remove(api.actor,11890002);}
      if(key==='skill'&&state.linked){api.hit(118000009);api.buffs.add('boss',5011,api.actor);}
      return key==='skill'?{...state,linked:false}:state;
    },
    phase(state,api,key,phase){
      if(key==='ultimate'){
        if(phase==='anticipation')api.area('AreaEffect_118_Ultra_XiYin',api.actor);
        else api.stopWeapons('AreaEffect_118_Ultra_XiYin',true);
      }
      return state;
    },
    prepareHit(state,api,tags){
      if(tags.includes(HENG)&&has(511827))api.buffs.add(api.actor,11827011,api.actor);
      if(tags.includes(SECOND)&&has(511830))api.buffs.add('boss',11830011,api.actor);
      if(tags.includes(SUPPORT)&&has(511832)&&(state.lastToughness===null||api.time-state.lastToughness>12)){
        api.randomPercent(); // native <= 100% roll still advances the random stream
        api.toughnessDamage(api.parameter(11832011));return {...state,lastToughness:api.time};
      }
      return state;
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(SICKLE)||tags.includes(HENG))for(const [potential,id] of [[511821,11821011],[511822,11822011],[511825,11825001]])
        if(has(potential!))once.push({id:id!,count:1});
      if(tags.includes(SECOND)&&has(511829))once.push({id:11829001,count:1});
      if(tags.includes(ULTRA)){
        if(has(511841))once.push({id:11841012,count:1});
        if(has(511843)&&api.bossHasToughness())once.push({id:11843001,count:1});
      }
      if(tags.includes(FINISH)&&has(511841)&&api.distance<6)once.push({id:11841001,count:1});
      return once;
    },
    afterHit(state,api,tags){
      if(tags.includes(FIRST))state={...state,linked:true,firstHits:state.firstHits+1};
      if(tags.includes(ADD)||(has(511831)&&tags.includes(ULTRA))){
        api.buffs.add('boss',5011,api.actor);
        if(has(511826))api.buffs.add(api.actor,11826011,api.actor);
      }
      if(tags.includes(HENG)&&has(511823)&&api.randomPercent()<=50)api.drop('Item_118_P23_YaoShui',{x:api.distance,z:0});
      if(tags.includes(SECOND)&&has(511824))api.schedule('p24-area',.5);
      return state;
    },
    custom(state,api,name){
      if(name==='118_Sup_CheDuan'&&state.linked){api.hit(118000009);api.buffs.add('boss',5011,api.actor);return {...state,linked:false};}
      return state;
    },
    event(state,api,name){if(name==='p24-area')api.area('AreaEffect_118_P24_YaoShui');return state;},
    mark:tags=>tags.includes(TRIGGER)?{element:6,variant:2,buffTag:'DarkMark1',hit:118000001,
      afterHitBuffs:[5031,5041],removeAfterHit:true}:null,
  };
}
