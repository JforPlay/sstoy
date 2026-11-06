import {combatTagHash as hash} from './combat-tags';
import type {MainFactoryContext} from './combat-adapter-registry';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface ChitoseState extends Record<string,unknown>{stage:number;normalIndex:number;lastNormal:number;normalTag:string;strength:boolean;castStrength:boolean;uses:number;skip:boolean;shadowStacks:number;p5:number;p6:number;p7:number;p7Until:number;waterSupport:boolean}
const SOURCE='char_14401_combos_monster.unity3d';
const tag=(name:string)=>hash(`144_${name}`);
const replacements:Record<number,number>={144311111:144311101,144311112:144311102,144310211:144310201,144310212:144310202,144310213:144310203,144310218:144310208,144310214:144310204,144310215:144310205,144310219:144310209,144310216:144310206,144310217:144310207,144310411:144310401,144310412:144310402,144310413:144310403,144320012:144320002,144322311:144322301};
/** Shadows use their own native timeline, then NO_DAMAGE synchronously credits
 * a fresh player hit. They must not deal ordinary minion damage as well. */
export function createMain144(potentials:Record<number,number>,context:MainFactoryContext):SupportCombatAdapter<ChitoseState>{
  const has=(n:number)=>Boolean(potentials[514400+n]);
  function snakes(state:ChitoseState,api:SupportCombatApi,tags:number[]):ChitoseState{
    if(!has(7)||!tags.includes(tag('SnakeAtk_07')))return state;
    let count=api.time>=state.p7Until?0:state.p7;
    const until=api.time>=state.p7Until?api.time+api.parameter(14407012):state.p7Until;
    if(count<api.parameter(14407013)&&api.randomPercent()<=api.parameter(14407011)){
      api.area(`AreaEffect_14401_B1P7_Snake${Math.min(3,Math.floor(api.randomPercent()/25))+1}`);count++;
    }
    return {...state,p7:count,p7Until:until};
  }
  function cold(api:SupportCombatApi){
    api.buffs.add('boss',4021,api.actor);
    if((api.buffTagCount?.('boss','Cold')??api.buffs.count('boss',4021))>=3){
      api.removeBuffTag?.('boss','Cold');api.buffs.add('boss',4100,api.actor);
    }
  }
  return {
    potentials:[1,2,3,4,5,6,7,8,9,10,11,12,13,41,42,43].map(n=>514400+n),
    actions:cinematics=>[
      {kind:'normal',skill:14410000,tag:'Atk1',normal:true,automatic:true},
      {kind:'skill',skill:14431000,tag:'144_B1',cooldownKey:'skill',charges:has(10)?3:2,cooldown:context.skillCooldown(14431000)-(has(4)?4:0)},
      {kind:'skill-strength',skill:14431001,tag:has(3)?'144_B1P3_Strength':'144_B1_Strength',cooldownKey:'skill',charges:has(10)?3:2,cooldown:context.skillCooldown(14431000)-(has(4)?4:0)},
      {kind:'ultimate',skill:14440000,tag:cinematics?'144_Ultra_TL':'144_Ultra_NoTL'},
      ...((has(5)||has(11))?[{kind:'dodge',skill:14420000,tag:[3],flag:16,automatic:true,charges:has(5)?3:2}]:[])],
    initialize:()=>({stage:0,normalIndex:0,lastNormal:0,normalTag:'Atk1',strength:false,castStrength:false,uses:0,skip:false,shadowStacks:0,p5:-1,p6:-1,p7:0,p7Until:0,waterSupport:false}),
    automatic(state,api){
      return has(11)&&!api.buffs.count(api.actor,14411011)&&api.skillReady?.('dodge')?'dodge':'normal';
    },
    canCast:(state,_api,key)=>key==='skill'?!state.strength:key==='skill-strength'?state.strength:true,
    comboTag:(state,_api,key)=>key==='normal'?state.normalTag:null,
    cast(state,api,key){
      if(key==='normal'){
        const index=has(5)&&state.skip?5:api.time-state.lastNormal>=.5?0:state.stage;
        return {...state,normalIndex:index,normalTag:`Atk${index+1}${has(1)&&api.buffs.count(api.actor,14401011)?'_P01':''}`,skip:false};
      }
      if(key==='dodge'&&has(11))api.buffs.add(api.actor,14411011,api.actor);
      if(key==='ultimate'&&has(42))api.buffs.add(api.actor,14442011,api.actor);
      if(key==='skill'||key==='skill-strength'){
        api.buffs.add(api.actor,14493001,api.actor);
        if(has(1))api.buffs.add(api.actor,14401011,api.actor);
        if(has(2))api.buffs.add(api.actor,14401011,api.actor);
        if(has(8))api.buffs.add(api.actor,14408011,api.actor);
        if(has(12))api.buffs.add(api.actor,14412011,api.actor);
        const strong=key==='skill-strength',combo=strong?(has(3)?'144_B1P3_Strength':'144_B1_Strength'):'144_B1';
        if(has(4))api.schedule('shadow-skill',.25,{tag:combo});
        const uses=strong?0:state.uses+1;
        return {...state,castStrength:strong,uses,strength:strong?false:uses>=(has(3)?1:2)};
      }
      return state;
    },
    phase:(state,_api,key,phase)=>key==='normal'&&phase==='anticipation'?{...state,stage:(state.normalIndex+1)%6}:state,
    end(state,api,key){
      api.buffs.remove(api.actor,14400001);
      if(key==='normal'){
        if(has(5)&&state.normalIndex!==5)api.removeStacks(api.actor,14405011,1);
        if(has(6)&&state.normalIndex===5)api.buffs.remove(api.actor,14406012);
        return {...state,lastNormal:api.time};
      }
      if(key==='skill'||key==='skill-strength')api.buffs.remove(api.actor,14493001);
      return has(5)&&(key==='skill'||key==='skill-strength'||key==='dodge')?{...state,skip:true}:state;
    },
    custom(state,api,name){
      if(name==='144_AtkInvincibleAdd'||name==='144_B1_InvincibleAdd')api.buffs.add(api.actor,14400001,api.actor);
      if(name==='144_AtkInvincibleRemove'||name==='144_B1_InvincibleRemove')api.buffs.remove(api.actor,14400001);
      if(name==='144_Shadow_Atk'&&has(2)&&api.buffs.count(api.actor,14401011)){
        api.independentCombo!(state.normalTag,{source:SOURCE,speed:api.initialAttribute?.(47)??1});
        return has(5)?{...state,shadowStacks:state.normalIndex===5?api.buffs.count(api.actor,14406012):0}:state;
      }
      return state;
    },
    event(state,api,name,data){if(name==='shadow-skill')api.independentCombo!(String(data.tag),{source:SOURCE});return state;},
    replaceNoDamageHit:id=>replacements[id],
    attacked(state,api,tags){state=snakes(state,api,tags);return has(9)&&tags.includes(tag('B1Strength'))?{...state,strength:true,uses:0}:state;},
    beforeHit(state,api,tags){
      const once:{id:number;count:number}[]=[];
      const add=(n:number,t:string,id:number,count=1)=>{if(has(n)&&tags.includes(tag(t))&&count>0)once.push({id,count});};
      add(2,'B1P2_Shadow',14402011);add(4,'B1P4_Shadow',14404011);
      add(5,'Atk5bf',14405001,api.buffs.count(api.actor,14405011)?1:0);
      add(6,'Atk6',14406001,api.buffs.count(api.actor,14406012));
      add(6,'Atk6_Shadow',14406001,api.buffs.count(api.actor,14406012)||state.shadowStacks);
      add(8,'B1',14408001,api.buffs.count(api.actor,14408011));add(9,'B1',14409001);add(10,'B1',14410001);
      add(41,'Ultra',14441001);
      if(api.hasBuffTag('boss','Frozen')||api.hasBuffTag('boss','Cold'))add(43,'Ultra',14443001);
      return once;
    },
    afterHit(state,api,tags){
      if(has(5)&&tags.includes(tag('Atk6'))&&(state.p5<0||api.time-state.p5>1)){
        for(let i=0;i<5;i++)api.buffs.add(api.actor,14405011,api.actor);state={...state,p5:api.time};
      }
      if(has(6)&&tags.includes(tag('SnakeAtk_06'))){
        api.buffs.add(api.actor,14406011,api.actor);
        if(state.p6<0||api.time-state.p6>api.parameter(14406011)){
          api.buffs.add(api.actor,14406012,api.actor);state={...state,p6:api.time};
        }
      }
      return state;
    },
    mark:tags=>tags.includes(tag('WaterTag_Trigger'))?{element:1,variant:1,area:'AreaEffect_144_WaterTag1_Boom',buffTag:'Water'}:null,
    beforeMark(state,api,tags){cold(api);if(has(41)&&tags.includes(tag('Ultra'))&&api.randomPercent()<=api.parameter(14441011))cold(api);return state;},
    tick(state,api){
      if(!has(13))return state;
      const active=api.actorsByElement(1).some(actor=>actor!==api.main&&api.actorActive?.(actor));
      if(active!==state.waterSupport){if(active)api.buffs.add(api.actor,14413011,api.actor);else api.buffs.remove(api.actor,14413011);return {...state,waterSupport:active};}
      return state;
    },
  };
}
