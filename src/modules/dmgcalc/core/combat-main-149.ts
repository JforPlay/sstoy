import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface MaidenState extends Record<string,unknown>{
  stage:number;lastNormal:number;concUntil:number;summonUntil:number;summonGeneration:number;
  lastChain:number|null;chainGeneration:number;summons:number;
}
const NORMAL=hash('149_NormalAtk'),IRON=hash('149_IronMaiden'),ULT=hash('149_Ultra'),GRAY=hash('149_Gray');
const MARK=hash('149_LandTagTrigger'),P2=hash('149_AtkP02_LandTrigger');
/** The native summon is configured with useSummonHit=true: AdventureActor
 * redirects its hit source and live attributes to its summoner. Its link
 * lease can therefore share the actor hit pipeline, not a copied attack stat. */
export function createMain149(potentials:Record<number,number>):SupportCombatAdapter<MaidenState>{
  const has=(id:number)=>Boolean(potentials[id]);
  const concentrated=(state:MaidenState,api:SupportCombatApi)=>api.time<state.concUntil;
  return {
    potentials:[514901,514902,514903,514904,514905,514906,514907,514908,514909,514910,514911,514912,514913,514941,514942,514943],
    actions:cinematics=>[
      {kind:'normal',skill:14910000,tag:'Atk1',normal:true,automatic:true},
      {kind:'skill',skill:14931000,tag:'149_Skill_Main'},
      ...(has(514911)?[{kind:'dodge',skill:14920000,tag:[3],flag:16,charges:2,automatic:true,spBudget:null}]:[]),
      {kind:'ultimate',skill:14940000,tag:`149_Ultra_${has(514941)?'P41_':''}${cinematics?'TL':'NoTL'}`},
    ],
    initialize(api){
      if(has(514913))for(const _ of api.actorsByElement(3))api.buffs.add(api.actor,14913011,api.actor);
      return {stage:0,lastNormal:0,concUntil:0,summonUntil:0,summonGeneration:0,lastChain:null,chainGeneration:0,summons:0};
    },
    automatic(state,api){
      if(has(514911)&&!api.buffs.count(api.actor,14911011)&&api.skillReady?.('dodge'))return 'dodge';
      return 'normal';
    },
    comboTag:(state,api,key)=>key==='normal'?`Atk${state.stage+1}${has(514902)&&concentrated(state,api)?'_Strength':''}`:null,
    cast(state,api,key){
      if(key==='normal'&&api.time-state.lastNormal>1)return {...state,stage:0};
      if(key==='dodge')api.buffs.add(api.actor,14911011,api.actor);
      if(key==='ultimate'&&has(514943)&&api.distance<=10)api.buffs.add('boss',14943011,api.actor);
      return state;
    },
    phase(state,_api,key,phase){return key==='normal'&&phase==='anticipation'?{...state,stage:(state.stage+1)%5}:state;},
    end:(state,api,key)=>key==='normal'?{...state,lastNormal:api.time}:state,
    partySkillCast(state,api,source){
      if(has(514909)&&source!==api.actor)api.buffs.add(api.actor,14909011,api.actor);
      return state;
    },
    custom(state,api,name){
      if(name==='149_Summon_IronMaiden')api.schedule('summon',.66);
      return state;
    },
    event(state,api,name,data){
      if(name==='summon'){
        const summonGeneration=state.summonGeneration+1,summonUntil=api.time+(has(514910)?12:8.3);
        api.schedule('link',2/60,{summonGeneration});
        if(has(514908))api.buffs.add('boss',14908011,api.actor);
        return {...state,summonUntil,concUntil:summonUntil+(has(514907)?4:0),summonGeneration,lastChain:null,summons:state.summons+1};
      }
      if(name==='link'&&data.summonGeneration===state.summonGeneration&&api.time<state.summonUntil){
        api.hit(149310002);api.schedule(name,1,data);return state;
      }
      if(name==='chain'&&data.summonGeneration===state.summonGeneration&&data.chainGeneration===state.chainGeneration&&api.time<state.summonUntil)
        api.hit(149310401);
      return state;
    },
    tick(state,api){
      for(const id of [14900001,...(has(514901)?[14901011]:[])]){
        if(concentrated(state,api)){if(!api.buffs.count(api.actor,id))api.buffs.add(api.actor,id,api.actor);}
        else if(api.buffs.count(api.actor,id))api.buffs.remove(api.actor,id);
      }
      return state;
    },
    beforeHit(_state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(has(514906)&&tags.includes(NORMAL)&&api.bossBroken?.())once.push({id:14906001,count:1});
      if(has(514908)&&api.hasBuffTag('boss','Slow'))once.push({id:14908001,count:1});
      if(tags.includes(IRON)){
        if(has(514910))once.push({id:14910001,count:1});
        if(has(514912))once.push({id:14912001,count:1});
      }
      if(has(514942)&&tags.includes(ULT)&&api.buffs.count('boss',14942011))once.push({id:14942001,count:1});
      if(has(514943)&&tags.includes(GRAY)&&api.buffs.count('boss',14943011))once.push({id:14943001,count:1});
      return once;
    },
    afterHit(state,api,tags){
      if(tags.includes(NORMAL)){
        if(has(514905))api.buffs.add(api.actor,14905011,api.actor);
        if(has(514904)&&api.time<state.summonUntil&&(state.lastChain===null||api.time-state.lastChain>api.parameter(14904011))){
          const chainGeneration=state.chainGeneration+1;
          api.schedule('chain',.3,{summonGeneration:state.summonGeneration,chainGeneration});
          return {...state,lastChain:api.time,chainGeneration};
        }
      }
      return state;
    },
    mark:(tags,state,api)=>tags.includes(MARK)||Boolean(has(514902)&&state&&api&&concentrated(state,api)&&tags.includes(P2))
      ?{element:3,area:'AreaEffect_149_LandTag1_Stone'}:null,
    markTriggered(state,api,element,_tags,source){
      if(element===3&&source===api.actor&&has(514942))api.buffs.add('boss',14942011,api.actor);
      return state;
    },
  };
}
