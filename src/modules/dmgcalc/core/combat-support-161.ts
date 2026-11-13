import {combatTagHash as hash} from './combat-tags';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface Beacon {id:number;expires:number;weapons:number[]}
interface SuguhaState extends Record<string,unknown>{level:number;sequence:number;beacons:Beacon[];pending:{id:number;name:string}[];detonation:number;timer:boolean;lastMain:number|null}
const SOURCE='char_16101_combos_summon.unity3d';
const MAPPING=hash('16101_Camp_Sup_CeHui'),PROBE=hash('16101_Camp_Sup_TanCha'),STRONG=hash('16101_Camp_Sup_TanChaAddTag');
const MARK=hash('16101_FWB_Mark'),CHA=hash('16101_Camp_Sup_TanChaTag'),DAMAGE=hash('16101_Camp_Sup_TanChaTag_Damage'),ULT=hash('16101_Ultra');

export function createSupport161(potentials:Record<number,number>):SupportCombatAdapter<SuguhaState>{
  const has=(n:number)=>Boolean(potentials[516100+n]);
  const earth=(api:SupportCombatApi)=>api.actorsByElement(3);
  const allEarth=(api:SupportCombatApi)=>earth(api).length===api.party.length;
  const group=(api:SupportCombatApi,id:number,count=1)=>{for(const actor of api.party)for(let i=0;i<count;i++)api.buffs.add(actor,id,api.actor);};
  function detonate(s:SuguhaState,api:SupportCombatApi,remove=0){
    const stacks=api.buffs.count('boss',16123011),count=remove?Math.min(remove,stacks):stacks;
    for(let i=0;i<count;i++)api.hit(161320003);
    api.removeStacks('boss',16123011,count);
    return {...s,timer:false,detonation:s.detonation+1};
  }
  function attach(s:SuguhaState,api:SupportCombatApi,count=1):SuguhaState{
    for(let i=0;i<count;i++)api.buffs.add('boss',16123011,api.actor);
    if(has(24)&&api.buffs.count('boss',16123011)>=3)return detonate(s,api,3);
    if(!s.timer){const generation=s.detonation+1;api.schedule('detonate',3,{generation});return {...s,timer:true,detonation:generation};}
    return s;
  }
  function retire(s:SuguhaState,api:SupportCombatApi,id:number):SuguhaState{
    const beacon=s.beacons.find(b=>b.id===id);if(!beacon)return s;
    for(const weapon of beacon.weapons)api.stopWeapon?.(weapon);
    api.independentLease!(`beacon:${id}`,0);
    // Native death TanCe area attaches one aiming mark on enemy entry.
    if(has(23)&&Math.abs(api.distance-3)<=api.areaRadius('AreaEffect_161_Summon_Sup_P23'))s=attach(s,api);
    return {...s,beacons:s.beacons.filter(b=>b.id!==id),pending:s.pending.filter(p=>p.id!==id)};
  }
  function area(s:SuguhaState,api:SupportCombatApi,id:number,name:string,duration?:number,disableGeneratedAreas=false):SuguhaState{
    api.area(name,api.actor,{x:3,z:0,duration,disableGeneratedAreas});
    return {...s,pending:[...s.pending,{id,name}]};
  }
  function tier(s:SuguhaState){return s.level>=4?2:s.level>=2?1:0;}
  function spawnName(s:SuguhaState){const t=tier(s);return 'AreaEffect_161_Summon_Sup_Spawn'+
    (has(24)?t?`_P24P22Lv${t}`:'_P24':has(21)?t?`_P21P22_Lv${t}`:'_P21':t?`_P22_Lv${t}`:'');}
  function mappingName(s:SuguhaState){const t=tier(s);return 'AreaEffect_161_Summon_Sup_Area'+(has(21)?t?`_P21P22_Lv${t}`:'_P21':t?`_P22_Lv${t}`:'');}
  return {
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>516100+n),
    actions:cinematics=>[{kind:'skill',skill:16132000,tag:'161_Skill_Sup'},
      {kind:'ultimate',skill:16140000,tag:cinematics?'161_Ultra_TL':'161_Ultra_NoTL'}],
    comboArea:name=>name.startsWith('AreaEffect_161_Summon_Sup_Attack_')?{x:3,z:0}:undefined,
    initialize(api){
      if(has(33)){if(allEarth(api))group(api,16133011);else if(earth(api).length===1){const n=api.party.length-1;group(api,16133012,n);for(let i=0;i<n;i++)api.buffs.add(api.actor,16133013,api.actor);}}
      return {level:0,sequence:0,beacons:[],pending:[],detonation:0,timer:false,lastMain:null};
    },
    cast(s,_api,key){return key==='skill'&&has(22)?{...s,level:Math.min(4,s.level+(has(27)?2:1))}:s;},
    custom(s,api,name,data){
      if(name==='SummonEvt'){
        while(s.beacons.length>=(has(21)?2:1))s=retire(s,api,s.beacons[0]!.id);
        const id=s.sequence+1,life=has(23)?11.5:11.5+(has(21)?10:0),expires=api.time+life;
        api.independentLease!(`beacon:${id}`,expires);
        const birth=api.independentCombo!('Sup_Brith',{source:SOURCE,lease:`beacon:${id}`});
        // Spawn_FangWeiBiao starts Action only after birth; its controller
        // then waits another 0.5 seconds before attempting the first attack.
        api.schedule('expire',life,{id});if(has(23))api.schedule('probe',birth+.5+1/60,{id});
        return {...s,sequence:id,beacons:[...s.beacons,{id,expires,weapons:[]}]};
      }
      if(name==='Area'&&data?.independentLease){
        const id=Number(String(data.independentLease).split(':')[1]);
        if(!s.beacons.some(b=>b.id===id))return s;
        s=area(s,api,id,spawnName(s),undefined,true);
        if(!has(24))api.schedule('mapping',.5,{id});
      }
      if(name==='P25DebuffEvt'&&has(25)&&allEarth(api)&&s.beacons.length&&Math.abs(api.distance-3)<=6)api.buffs.add('boss',16125011,api.actor);
      if(name==='UltraArea'){
        api.area(has(42)?'AreaEffect_161_Ultra_P42':'AreaEffect_161_Ultra');
        if(has(43))api.area('AreaEffect_161_Ultra_P43');
      }
      return s;
    },
    event(s,api,name,data){
      const id=Number(data.id),beacon=s.beacons.find(b=>b.id===id);
      if(name==='detonate')return s.timer&&s.detonation===data.generation?detonate(s,api):s;
      if(!beacon)return s;
      if(name==='expire')return retire(s,api,id);
      if(name==='mapping')return area(s,api,id,mappingName(s),Math.max(0,beacon.expires-api.time));
      if(name==='probe'){
        const tag=has(24)?'Sup_Attack_P24':'Sup_Attack';
        const duration=api.independentCombo!(tag,{source:SOURCE,lease:`beacon:${id}`});
        api.schedule('probe',duration+1/60,{id});
        return {...s,pending:[...s.pending,{id,name:has(24)?'AreaEffect_161_Summon_Sup_Attack_P23P24':'AreaEffect_161_Summon_Sup_Attack_P23'}]};
      }
      return s;
    },
    weaponBegin(s,_api,name,id){
      const index=s.pending.findIndex(p=>p.name===name);if(index<0||id===undefined)return s;
      const owner=s.pending[index]!.id;
      return {...s,pending:s.pending.filter((_,i)=>i!==index),beacons:s.beacons.map(b=>b.id===owner?{...b,weapons:[...b.weapons,id]}:b)};
    },
    beforeHit(s,api,tags){
      const once:{id:number;count:number}[]=[];
      if(tags.includes(MAPPING)){
        if(has(22)&&s.level)once.push({id:16122011,count:s.level});
        if(has(26)&&s.level>=2)once.push({id:16126001,count:1});
        if(has(27))once.push({id:16127001,count:api.buffs.count(api.actor,16127011)});
      }
      if(tags.includes(DAMAGE))once.push({id:16123011,count:api.buffs.count(api.actor,16123012)});
      if(tags.includes(DAMAGE))for(const [n,id] of [[24,16124011],[28,16128001],[30,16130001]])if(has(n!))once.push({id:id!,count:1});
      if(has(42)&&tags.includes(ULT))once.push({id:16142001,count:1});
      return once;
    },
    afterHit(s,api,tags){
      if(tags.includes(MARK)||has(32)&&tags.includes(ULT))api.buffs.add('boss',6011,api.actor);
      if(tags.includes(MARK)&&has(31))api.buffs.add(api.actor,16131011,api.actor);
      if(tags.includes(MAPPING)){if(has(21)&&allEarth(api))api.buffs.add('boss',16121011,api.actor);if(has(27))api.buffs.add(api.actor,16127011,api.actor);}
      if(tags.includes(PROBE)&&has(23))api.buffs.add(api.actor,16123012,api.actor);
      if(tags.includes(STRONG)&&(has(24)||has(30)))s=attach(s,api,has(30)?2:1);
      if(tags.includes(CHA)&&has(29)){if(allEarth(api))api.buffs.add('boss',16129011,api.actor);else if(earth(api).length===1){group(api,16129012);api.buffs.add('boss',16129013,api.actor);}}
      if(tags.includes(ULT)){if(has(41))api.buffs.add(api.actor,16141011,api.actor);if(has(32))api.buffs.add(api.actor,16132011,api.actor);}
      return s;
    },
    partyHit(s,api,hit){
      if(has(28)&&hit.actor===api.main&&api.actorInfo(api.main).job===1&&api.buffs.count('boss',16123011)>0&&(s.lastMain===null||api.time-s.lastMain>1))
        return attach({...s,lastMain:api.time},api);
      return s;
    },
    tick(s,api){
      if(has(43))for(const actor of earth(api).filter(id=>[1,2].includes(api.actorInfo(id).job))){
        const notReady=!api.ultimateReady();
        if(notReady&&!api.buffs.count(actor,16143012))api.buffs.add(actor,16143012,api.actor);
        if(!notReady)api.buffs.remove(actor,16143012);
        const inside=api.areaContains?.('16101_Ultra_P43',api.main);
        if(inside&&!api.buffs.count(actor,16143011))api.buffs.add(actor,16143011,api.actor);
        if(!inside)api.buffs.remove(actor,16143011);
      }
      return s;
    },
  };
}
