import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface Ghost {id:number;alive:boolean;born:number}
interface MistyState extends Record<string,unknown>{generation:number;doorUntil:number;doorAt:number;next:number;ghosts:Ghost[]}
const SOURCE='char_13501_combos_boomghost.unity3d',BOOM=hash('BoomGhostAtk'),ULT=hash('135UltraAtk'),DOOR=hash('135GhostDoorAtk');
export function createSupport135(potentials:Record<number,number>):SupportCombatAdapter<MistyState>{
  const has=(n:number)=>Boolean(potentials[513500+n]);
  const key=(api:SupportCombatApi,id:number)=>`${api.actor}#${id}`;
  function friends(s:MistyState,api:SupportCombatApi,buff:number){for(const actor of [...api.party,...s.ghosts.filter(g=>g.alive).map(g=>key(api,g.id))])api.buffs.add(actor,buff,api.actor);}
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>513500+n),
    actions:c=>[{kind:'skill',skill:13532000,tag:'Support_Skill_GhostDoor'},{kind:'ultimate',skill:13540000,tag:c?'135_Ultra_TL_T2':'135_Ultra_NoTL_T2'}],
    initialize(api){if(has(33))for(const actor of api.actorsByElement(6))api.buffs.add(actor,13553311,api.actor);return {generation:0,doorUntil:0,doorAt:0,next:0,ghosts:[]};},
    cast(s,api,slot){
      if(slot==='skill'&&has(42))api.buffs.add(api.actor,13554211,api.actor);
      if(slot==='ultimate'&&has(41))for(const ghost of s.ghosts)if(ghost.alive){api.schedule('ghost-boom',0,{id:ghost.id});api.buffs.add(api.actor,13554111,api.actor);}
      return s;
    },
    custom(s,api,name){
      if(name!=='GhostDoor'&&name!=='summonEvt')return s;
      const door=has(23)?'AreaEffect_135_GhostDoor_T23':'AreaEffect_135_GhostDoor';
      api.stopWeapons('AreaEffect_135_GhostDoor');
      const duration=api.weaponData!(door,'AreaEffectEntity').duration._serializedValue/4294967296+(has(21)?3:0);
      // The native support controller disables every prefab buff and attack
      // component before enabling only P28/P30. Do not inherit the main door.
      if(has(28))api.area(door,api.actor,{x:3.72,z:0,duration,disableBuffs:true});
      if(has(31))api.shield(13553101,api.main);
      if(has(30)&&Math.abs(api.distance-3.72)<api.areaRadius(door))api.buffs.add('boss',13553011,api.actor);
      const generation=s.generation+1,interval=Math.ceil(.5*(1-(has(25)?api.parameter(13552501):0)/100)*60)/60;
      api.schedule('ghost-spawn',interval,{generation,interval});api.schedule('door-end',duration,{generation});
      return {...s,generation,doorAt:api.time,doorUntil:api.time+duration};
    },
    beforeHit:(_s,_api,tags)=>has(32)&&tags.includes(ULT)?[{id:13532001,count:1}]:[],
    afterHit(s,api,tags){if(has(43)&&tags.includes(ULT))api.buffs.add(api.actor,13554311,api.actor);if((has(28)&&tags.includes(DOOR))||(has(32)&&tags.includes(ULT)))api.buffs.add('boss',5011,api.actor);return s;},
    prepareMinionHit(s,api,id,hit){if(hit.tags.includes(BOOM)){api.buffs.add('boss',5011,api.actor);api.emitProc?.('qualified-summon-attack',{}, {attacker:key(api,id)});}return s;},
    beforeMinionHit(s,api,_id,hit){if(!hit.tags.includes(BOOM))return [];
      const result:{id:number;count:number}[]=has(21)?[{id:13521011,count:1}]:[];
      const door=has(23)?'AreaEffect_135_GhostDoor_T23':'AreaEffect_135_GhostDoor';
      if(api.time<s.doorUntil&&(has(24)||Math.abs(api.distance-3.72)<api.areaRadius(door)))for(const n of [23,24])if(has(n))result.push({id:n===23?13523011:13524011,count:1});return result;
    },
    afterMinionHit(s,api,_id,hit){if(hit.tags.includes(BOOM))api.buffs.add('boss',5011,api.actor);return s;},
    event(s,api,name,data){
      if(name==='door-end'&&data.generation===s.generation){api.buffs.remove('boss',13553011);return {...s,doorUntil:0};}
      if(name==='ghost-spawn'&&data.generation===s.generation&&api.time<s.doorUntil){
        s={...s,ghosts:[...s.ghosts]};const count=1+(has(27)&&api.randomPercent()<api.parameter(13552701)?1:0);
        for(let i=0;i<count;i++){
          const id=++s.next,owner=key(api,id);api.summon!(id,[]);
          s.ghosts.push({id,alive:true,born:api.time});
          if(has(29)){api.buffs.add(api.actor,13552911,api.actor);for(let n=0;n<api.buffs.count(api.actor,13552911);n++)api.buffs.add(owner,13552911,api.actor);}
          if(has(26))api.buffs.add(owner,13552611,api.actor);
          if(has(22))for(let n=0;n<Math.min(10,Math.floor(api.time-s.doorAt));n++)api.buffs.add(owner,13552211,api.actor);
          api.emitProc?.('qualified-summon-spawned',{}, {target:owner});
          const born=api.independentCombo!('Birth',{source:SOURCE,entity:id});
          const radius=api.areaRadius(has(23)?'AreaEffect_135_GhostDoor_T23':'AreaEffect_135_GhostDoor'),angle=api.randomPercent()/100*2*Math.PI;
          const distance=Math.hypot(3.72+Math.cos(angle)*radius-api.distance,Math.sin(angle)*radius);
          api.schedule('ghost-boom',Math.min(8,born+Math.max(0,distance-2)/10+2/60),{id});
        }
        api.schedule('ghost-spawn',Number(data.interval),data);return s;
      }
      if(name==='ghost-boom'){
        const id=Number(data.id),ghost=s.ghosts.find(g=>g.id===id);if(!ghost?.alive)return s;
        if(has(29))for(let n=0;n<api.buffs.count(api.actor,13552911);n++)api.buffs.add(key(api,id),13552911,api.actor);
        api.emitProc?.('qualified-summon-died');
        const duration=api.independentCombo!('BoomGhostDead',{source:SOURCE,entity:id});api.schedule('ghost-end',duration,{id});
        return {...s,ghosts:s.ghosts.map(g=>g.id===id?{...g,alive:false}:g)};
      }
      if(name==='ghost-end')api.despawn!(Number(data.id));return s;
    },
    mark:tags=>tags.includes(hash('135DarkTagBoom'))?{element:6,buffTag:'Dark',hit:135000000,applyBuff:13590000}:null,
  };
}
