import {combatTagHash as hash} from './combat-tags';
import {tonaSupportCombo} from './combat-tona-variants';
import type {SupportCombatAdapter} from './combat-support-adapter';

interface TonaState extends Record<string,unknown>{rains:number;arrows:number;arrowHistory:boolean;penetrations:number;waterHit:boolean;extensions:number}
const WATER=hash('130_B2_Water'),PENETRATE=hash('130_B2_Penetrate'),ULTRA=hash('130_Ultra');
/** Native support and shared scripts, against the scenario's single raid boss. */
export function createSupport130(potentials:Record<number,number>={}):SupportCombatAdapter<TonaState>{
  const has=(n:number)=>Boolean(potentials[513000+n]);
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>513000+n),
    actions:cinematics=>[{kind:'skill',skill:13032000,tag:'B2_Skill'},
      {kind:'ultimate',skill:13040000,tag:cinematics?'Ultra_TL':'Ultra_NoTL'}],
    initialize(api){
      if(has(33))for(const actor of api.actorsByElement(1))api.buffs.add(actor,13033011,api.actor);
      return {rains:0,arrows:0,arrowHistory:false,penetrations:0,waterHit:false,extensions:0};
    },
    comboTag:(_state,api,key)=>key==='skill'?tonaSupportCombo(potentials,api.actorsByElement(1).length):null,
    cast(state,api,key){
      if(key==='ultimate')return {...state,extensions:0};
      if(key!=='skill')return state;
      if(has(29))api.buffs.remove(api.actor,13029012);
      if(has(31)&&api.actorInfo(api.main).element===1)api.drop('Item_130_B2P24_Letter',{x:0,z:0},13031011);
      return {...state,waterHit:false};
    },
    end(state,api){
      if(has(22)&&state.arrowHistory){
        api.hit(130522001,[{owner:'boss',id:13022011},{owner:'boss',id:13022012}]);
        return {...state,arrowHistory:false,arrows:0};
      }
      return state;
    },
    custom(state,api,name){
      if(name==='StartIceRain'){
        for(let i=0;i<20;i++)api.schedule('rain',i*.05,{x:1.5*(i+1)});
        return {...state,rains:state.rains+1};
      }
      if(name==='B2P24_Shoot'&&has(24))for(let n=1;n<=3;n++)
        api.projectile(`Bullet_130_B2P30_Attack_${n}${has(23)?'_Big':''}`,'boss',Math.max(0,api.distance-1),{additionalAttributes:[{id:13024011,count:1}]});
      if(name==='130_Ultra_Area')api.area(has(41)?'AreaEffect_130_Ultra_Perk41':'AreaEffect_130_Ultra');
      return state;
    },
    beforeHit(state,api,tags){
      const once:{id:number;count:number}[]=[];
      if(has(22)&&tags.includes(hash('130_P22')))once.push({id:13022011,count:api.buffs.count('boss',13022011)});
      if(tags.includes(WATER))for(const [perk,id] of [[23,13023011],[28,13028001],[30,13030001]])if(has(perk!))once.push({id:id!,count:1});
      if(tags.includes(PENETRATE)){
        if(has(25))once.push({id:13025001,count:1});
        if(has(27)&&(api.bossHpPercent?.() ?? 1)<api.parameter(13027011)/100)once.push({id:13027001,count:1});
      }
      if(tags.includes(ULTRA)){
        if(has(41))once.push({id:13041001,count:1});
        if(has(43))once.push({id:13043001,count:state.extensions});
      }
      return once.filter(row=>row.count>0);
    },
    afterHit(state,api,tags){
      state={...state};
      if(has(22)&&tags.includes(hash('130_P22_2'))&&api.activeAction()){
        if(api.buffs.count('boss',13022011))api.hit(130522002);
        // The attached hit settles against the old stack count, then native
        // OnSelfDamaged adds the next arrow. Keep that ordering in the queue.
        api.schedule('arrow-add',0);
      }
      if(tags.includes(PENETRATE)){
        if(has(25)){
          if(api.buffs.count('boss',13025012)){
            api.buffs.remove('boss',13025012);api.buffs.add('boss',13025013,api.actor);api.schedule('penetrate-burst',.2);
          }else if(api.buffs.count('boss',13025011)){
            api.buffs.remove('boss',13025011);api.buffs.add('boss',13025012,api.actor);
          }else api.buffs.add('boss',13025011,api.actor);
        }
        if(has(26)&&++state.penetrations>=3){api.buffs.add('boss',13026011,api.actor);state.penetrations=0;}
      }
      if(has(29)&&tags.includes(WATER)&&!state.waterHit){api.buffs.add(api.actor,13029012,api.actor);state.waterHit=true;}
      if(tags.includes(ULTRA)){
        if(has(32))api.buffs.add('boss',4011,api.actor);
        if(has(43)&&api.hasBuffTag('boss','Frozen')&&state.extensions<api.parameter(13043013)){
          api.extendAreas?.('130_Ultra_Area',api.parameter(13043011));state.extensions++;
        }
      }
      return state;
    },
    crit(state,api,hit){if(has(28)&&hit.tags.includes(WATER))for(const actor of api.actorsByElement(1))api.buffs.add(actor,13028011,api.actor);return state;},
    tick(state,api){
      if(has(42))for(const actor of api.actorsByElement(1)){
        const inside=api.areaContains?.('130_Ultra_Area',actor) ?? false;
        if(inside&&!api.buffs.count(actor,13042011))api.buffs.add(actor,13042011,api.actor);
        if(!inside)api.buffs.remove(actor,13042011);
      }
      return state;
    },
    event(state,api,name,data){
      if(name==='arrow-add'){
        api.buffs.add('boss',13022011,api.actor);
        const count=api.buffs.count('boss',13022011),threshold=count<=10?1:count<=20?2:count<=30?3:0;
        const arrows=state.arrows+1;
        if(threshold>0&&arrows===threshold){api.buffs.add('boss',13022012,api.actor);return {...state,arrows:0,arrowHistory:true};}
        return {...state,arrows,arrowHistory:true};
      }
      if(name==='rain')api.area('AreaEffect_130_Support_Skill_P22_IceRain','boss',{x:Number(data.x),z:0});
      if(name==='penetrate-burst'){api.buffs.remove('boss',13025013);api.hit(130525001);}
      return state;
    },
    mark:tags=>tags.includes(hash('130_WaterTagTrigger'))?{element:1,area:'AreaEffect_130_WaterTag1_Boom',applyBuff:4021}:null,
    markTriggered(state,api,element,_tags,source){
      if(element===1){
        if(source===api.actor&&(api.buffTagCount?.('boss','Cold') ?? api.buffs.count('boss',4021))>=3){
          api.removeBuffTag?.('boss','Cold');api.buffs.add('boss',4100,api.actor);
        }
        if(has(32)&&(api.activeAreas?.('130_Ultra_Area') ?? 0)>0)api.buffs.add(api.actor,13032011,api.actor);
      }
      return state;
    },
  };
}
