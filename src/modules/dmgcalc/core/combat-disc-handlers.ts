import type {DiscContext,DiscHandler} from './combat-disc-runtime';
import {combatTagHash} from './combat-tags';

const is=(c:DiscContext,element:number,actor=c.event.actor)=>c.api.actorInfo(actor).element===element;
const mainIs=(c:DiscContext,element:number)=>is(c,element,c.main);
const player=(c:DiscContext)=>!c.event.entity&&c.api.party.includes(c.event.actor);
const cast=(c:DiscContext)=>c.event.kind==='cast'&&c.event.slot===2;
const buffTag=(c:DiscContext,tag:string)=>Boolean(c.event.buffTags?.includes(combatTagHash(tag)));
const hit=(c:DiscContext,type?:number,minions=false)=>c.event.kind==='hit'&&(minions||!c.event.entity)&&(type===undefined||c.event.hit?.damageType===type);
const before=(c:DiscContext,type?:number,minions=false)=>c.event.kind==='before'&&(minions||!c.event.entity)&&(type===undefined||c.event.hit?.damageType===type);
const max=(c:DiscContext,field:string,owner=c.main,lane=1)=>Boolean(c.value(field,lane))&&c.count(field,owner,lane)>=(c.api.buffLimit?.(c.value(field,lane))??Infinity);
const copy=(c:DiscContext,from:string,to:string,owner=c.event.actor)=>{
  const n=c.count(from,owner);c.remove(to,'boss');c.add(to,'boss',1,n);
};
const residentTick=(c:DiscContext,element:number,job:number,period:number,callback:(actor:string)=>void)=>{
  if(c.event.kind!=='tick')return;
  for(const actor of c.api.actorsByElement(element)){
    if(c.api.actorInfo(actor).job!==job)continue;
    const key=`resident:${actor}`,active=c.api.actorActive?.(actor)??actor===c.main;
    if(!active){c.set(key,0);continue;}
    const next=c.get(key);if(!next){c.set(key,c.api.time+period);continue;}
    if(c.api.time+1e-8>=next){callback(actor);c.set(key,next+period);}
  }
};
const fateRecord:DiscHandler=c=>{
  const id=c.record.id,extra=id===214023?'buff_1_extra':'buff_1_extraDmg';
  if(c.event.kind==='init'){
    c.group('buff_1_dmg',c.record.element);
    c.group(extra,c.record.element,1,Math.min(c.event.fateCards??0,id===214023?Infinity:c.value('maxCount_1')));
    if(id===214019&&c.level(2))c.group('buff_2_atk',2,2);
    if(id===214023&&c.level(3))c.group('buff_3_dmg',3,3);
  }
  if(id===214019&&c.level(2)&&(c.event.kind==='init'||c.event.kind==='tick'&&c.api.time>=c.get('period'))){
    c.group('buff_2_extraDmg',2,2);c.set('period',c.api.time+c.value('interval_2'));
  }
  if(c.event.kind==='kill'&&c.level(3)&&[214021,214023].includes(id)&&c.counter('kills')>=c.value(id===214021?'count_s3':'count_3',3)){
    c.group(id===214021?'buff_s3_extra':'buff_3_extra',c.record.element,3);c.set('kills',0);
  }
};

/** Explicit native script differences. Shared metadata effects are evaluated by
 * combat-disc-runtime; field names intentionally match the extracted client. */
export const combatDiscHandlers:Record<number,DiscHandler>={
  214048(c){
    if(c.event.kind==='remove'){
      if(buffTag(c,'Carol')){c.api.removeStacks('boss',c.value('buff_s1'),1);if(c.level(3))c.api.removeStacks('boss',c.value('buffId_s3',3),1);}
      if(c.event.buff===c.value('buffId_s1_2')&&c.level(2))c.remove('buffId_s2_1','boss',2);
      return;
    }
    const owner=c.event.owner??c.event.actor,index=c.api.party.indexOf(owner);
    if(index<0||!is(c,2,owner))return;
    const field=`dicBuff_s1_${index}`;
    if(before(c)&&!c.event.entity&&c.level(3)&&c.api.hasBuffTag('boss','Carol'))c.once('once_s3',3);
    if(hit(c,2)&&!c.event.entity){
      if(!c.count(field,'boss')){c.add('buff_s1','boss');if(c.level(3))c.add('buffId_s3','boss',3);}
      c.add(field,'boss');
    }
    if(hit(c,7,true)&&c.event.entity&&c.count(field,'boss')){
      c.remove(field,'boss');
      c.add('buffId_s1_2','boss');if(c.level(2)){c.add('buffId_s2_1','boss',2);c.group('buffId_s2_2',2,2);}
    }
  },
  214004(c){
    if(c.event.kind==='summon'&&c.event.entity&&is(c,6,c.event.owner??c.event.actor)){
      if(mainIs(c,6)){c.add('buffId_s1');if(c.level(3))c.add('buffId_s3',c.main,3);}
      if((c.event.owner??c.event.actor)===c.main)c.add('buffId_s1_Dmg',c.event.entity,1,c.count('buffId_s1'));
    }
    if(hit(c,undefined,true)&&c.event.entity&&mainIs(c,6)&&is(c,6,c.event.owner??c.event.actor)&&c.count('buffId_s1'))c.add('buffId_s1_Hurt','boss');
    if(c.event.kind==='tick'&&c.level(2)){
      const active=Number(c.count('buffId_s1')>0);
      if(active!==c.get('group')){
        for(const actor of c.api.actorsByElement(6)){if(active)c.add('buffId_s2',actor,2);else c.remove('buffId_s2',actor,2);}
        c.set('group',active);
      }
    }
  },
  214041(c){
    if(!['summon','despawn'].includes(c.event.kind)||!is(c,2,c.event.owner??c.event.actor))return;
    const delta=c.event.kind==='summon'?1:-1;
    if((c.event.owner??c.event.actor)!==c.main)c.counter('support-minions',delta);
    const count=c.counter('fire-minions',delta);
    for(const [id,minion] of Object.entries(c.state.summons??{}))if(minion.alive&&is(c,2,minion.owner)){
      if(c.get('support-minions')>0)c.add('buffId_s1',id);else c.remove('buffId_s1',id);
    }
    if(c.level(3))for(const actor of c.api.actorsByElement(2)){
      if(count>=c.value('count_s3'))c.add('buffId_s3',actor,3);else c.remove('buffId_s3',actor,3);
    }
  },
  214043(c){
    if(c.event.kind==='summon'&&c.event.entity&&(c.event.owner??c.event.actor)===c.main&&mainIs(c,6))c.add('buffId_s1',c.event.entity);
    if(c.level(2)&&c.event.kind==='mark'&&c.event.element===6&&c.event.variant===1&&is(c,6))for(const [id,minion] of Object.entries(c.state.summons??{}))if(minion.alive&&minion.owner===c.event.actor)c.add('buffId_s2',id,2);
    if(c.level(3)&&before(c,undefined,true)&&mainIs(c,6)&&c.api.hasBuffTag('boss','DarkAnZhuo')){
      if(!c.event.entity&&c.event.actor===c.main&&c.event.hit?.damageType===2)c.once('once_s3',3);
      if(c.event.entity&&(c.event.owner??c.event.actor)===c.main)c.once('once_s3_1',3);
    }
  },
  214055(c){
    const grant=()=>{for(const actor of c.api.party){
      c.add('buffId_1',actor);if(c.level(3)){c.add('buffId_3_1',actor,3);if(is(c,1,actor)&&c.api.actorInfo(actor).job===3)c.add('buffId_3_2',actor,3);}
    }};
    if(c.level(1))residentTick(c,1,3,c.value('interval_OnStage'),grant);
    if(c.level(1)&&cast(c)&&is(c,1)&&c.api.actorInfo(c.event.actor).job===3)grant();
    if(c.event.kind==='buff'&&c.event.owner==='boss'&&buffTag(c,'Water')&&c.count('buffId_1',c.event.actor))c.add('debuffId_1','boss');
    if(c.event.kind==='mark'&&c.event.element===1&&c.level(2)&&c.count('buffId_1',c.event.actor))c.add('debuffId_2','boss',2);
    if(c.event.kind==='end'&&c.event.slot===4&&c.level(3)&&is(c,1)&&c.api.actorInfo(c.event.actor).job===3){
      const n=c.count('buffId_1',c.event.actor);
      c.api.directSp(c.event.actor,Math.min((c.event.spCapacity??0)*c.api.parameter(c.value('energyPercent_3',3))*n,c.api.parameter(c.value('energyCap_3',3))));
    }
  },
  214058(c){
    if(cast(c)&&c.event.actor===c.main&&mainIs(c,6)){c.add('buffId_1');if(c.level(3))c.add('buffId_3',c.main,3);}
    if(hit(c,3)&&c.count('buffId_1',c.event.actor)){
      c.group('buffId_1_darkDmg',6);
      for(const [id,minion] of Object.entries(c.state.summons??{}))if(minion.alive&&is(c,6,minion.owner))c.add('buffId_1_darkDmg',id);
    }
    if(c.event.kind==='mark'&&c.level(2)&&c.event.actor===c.main&&mainIs(c,6)&&c.event.variant===1)c.add('buffId_2_1',c.main,2);
    if(before(c,undefined,true)&&is(c,6,c.event.owner??c.event.actor)){
      if(c.count('buffId_1_darkDmg',c.event.entity??c.event.actor))c.once('onceId_1_darkDmg');
      if(c.level(2)&&max(c,'buffId_1'))c.once('onceId_2_2',2);
    }
  },
  214018:fateRecord,214019:fateRecord,214020:fateRecord,214021:fateRecord,214022:fateRecord,214023:fateRecord,
  214012(c){
    if(!c.level(3)||c.event.kind!=='buff'||!mainIs(c,6)||!['Dark','DarkMark1','DarkMark2'].some(tag=>buffTag(c,tag)))return;
    if(!(player(c)&&c.event.actor!==c.main&&is(c,6))&&!c.event.entity)return;
    if(!c.get('shield-used')||c.api.time>c.get('shield-ready')){
      c.api.shield(c.value('shield_s3',3),c.main);c.set('shield-used',1);c.set('shield-ready',c.api.time+c.value('cd_s3'));
    }
  },
  214024(c){
    if(!c.level(3)||!is(c,4)||c.event.actor===c.main)return;
    if(c.event.kind==='buff'&&buffTag(c,'Wind'))c.add('buff_s3',c.event.actor,3);
    if(before(c)&&c.count('buff_s3',c.event.actor,3))c.once('once_s3',3);
  },
  214040(c){
    if(c.event.actor===c.main&&mainIs(c,2)){
      if(hit(c,3))c.add('buffId_s1');
      if(before(c,3))c.once('once_s1',1,c.count('buffId_s1'));
    }
    if(c.event.kind==='tick'){
      const n=c.count('buffId_s1'),old=c.get('last-stacks');
      if(!n&&old&&c.level(3))c.add('buffId_s3',c.main,3,old);c.set('last-stacks',n);
    }
  },
  214049(c){
    if(c.event.kind==='tick'&&(c.event.hpFraction??1)<c.value('hpPercet')&&c.api.time>=c.get('shield-ready')){
      c.api.shield(c.value('shiledId'),c.main);c.set('shield-ready',c.api.time+c.value('cd'));
    }
  },
  214050(c){
    if(c.event.kind==='init'&&c.level(2))for(const actor of c.api.actorsByElement(6))if(c.api.actorInfo(actor).job===2)c.add('buffId_2',actor,2);
    if(hit(c,undefined,true)&&is(c,6,c.event.owner??c.event.actor)&&c.api.actorInfo(c.event.owner??c.event.actor).job===2&&mainIs(c,6)){
      c.add('buffId_1');if(c.level(2))c.add('buffId_2_1',c.main,2);
    }
    if(before(c,2)&&is(c,6)&&mainIs(c,6)&&max(c,'buffId_1'))c.once('onceId_1');
    if(c.event.kind==='mark'&&c.event.actor===c.main&&mainIs(c,6)&&c.level(3)&&max(c,'buffId_1'))c.add(c.event.variant===2?'buffId_3_2':'buffId_3_1',c.main,3);
  },
  214053(c){
    if(cast(c)&&c.event.actor===c.main&&mainIs(c,2)){
      c.add('buffId_1_skillDmg');c.add('buffId_1_mark');if(c.level(2))c.add('buffId_2_skillDmg',c.main,2);
    }
    if(before(c)&&c.event.actor===c.main&&mainIs(c,2)&&c.level(3)&&max(c,'buffId_1_mark'))c.once('once_3_ultDmg',3);
    if(hit(c,2)&&c.event.actor===c.main&&mainIs(c,2)&&(!c.get('shield-used')||c.api.time>c.get('shield-ready'))){
      const id=c.value('shieldId_1');c.api.removeShield?.(id,c.main);
      for(let i=0;i<c.count('buffId_1_mark');i++)c.api.shield(id,c.main);
      c.set('shield-used',1);c.set('shield-ready',c.api.time+c.value('shieldCD'));
    }
  },
  214003(c){
    if(c.level(1))residentTick(c,5,2,1,actor=>{
      c.add('buffId_1',actor);if(c.level(2))c.add('buffId_2',actor,2);
      if(max(c,'buffId_1',actor)&&mainIs(c,5))c.add('buffId_1_extra');
    });
    if(c.event.kind==='mark'&&c.event.actor===c.main&&mainIs(c,5)&&c.level(3)&&c.count('buffId_1_extra'))c.add(c.event.variant===2?'buffId_3_2':'buffId_3_1',c.main,3);
  },
  214045(c){
    if(c.event.kind==='init'&&c.level(2))for(const actor of c.api.actorsByElement(6))if(c.api.actorInfo(actor).job===2)c.add('buffId_2',actor,2);
    if(hit(c)&&is(c,6)&&c.api.actorInfo(c.event.actor).job===2){
      if(c.event.hit?.damageType===2){c.add('buffId_1','boss');if(c.level(2))c.add('buffId_2_1','boss',2);}
      if(c.level(3)&&c.event.hit?.damageType===3&&mainIs(c,6)&&max(c,'buffId_1','boss'))c.add('buffId_3',c.main,3);
    }
    if(before(c,undefined,true)&&max(c,'buffId_1','boss'))c.once('onceId_1',1,1,true);
    if(c.event.kind==='mark'&&c.event.actor===c.main&&mainIs(c,6)&&c.level(3)&&c.count('buffId_3',c.main,3))c.add(c.event.variant===2?'buffId_3_2':'buffId_3_1',c.main,3);
  },
  214046(c){
    if(hit(c,3)&&c.event.actor===c.main&&mainIs(c,4)){
      c.add('buffId_1');if(c.level(2))c.add('buffId_2',c.main,2);if(c.level(3))c.add('buffId_3',c.main,3);
    }
  },
  214047(c){
    if(hit(c,2)&&is(c,1)&&c.api.actorInfo(c.event.actor).job===2&&mainIs(c,1))c.add('buffId_1');
    if(!before(c,undefined,true))return;
    const n=c.count('buffId_1');
    if(n>=c.value('count_1')&&c.event.hit?.element===1)c.once('onceId_1');
    if(n>=c.value('count_1_2')&&is(c,1)&&c.event.hit?.damageType===2)c.once('onceId_1_2');
    if(c.event.actor===c.main){if(c.level(2))c.once('onceId_2',2,n);if(c.level(3))c.once('onceId_3',3,n);}
  },
  214051(c){
    if(c.level(1))residentTick(c,5,2,1,actor=>{c.add('buffId_1',actor);if(c.level(2))c.add('buffId_2',actor,2);});
    if(hit(c)&&is(c,5)&&c.api.actorInfo(c.event.actor).job===2&&max(c,'buffId_1',c.event.actor))c.add('debuffId_1','boss');
    if(c.event.kind==='mark'&&c.event.actor===c.main&&mainIs(c,5)&&c.level(3)&&c.count('debuffId_1','boss'))c.add(c.event.variant===2?'buffId_3_2':'buffId_3_1',c.main,3);
  },
  214056(c){
    const grant=()=>{for(const actor of c.api.party){c.add('buffId_1_1',actor);if(c.level(2))c.add('buffId_2',actor,2);}};
    if(c.level(1))residentTick(c,1,3,c.value('interval_OnStage'),grant);
    if(c.level(1)&&cast(c)&&is(c,1)&&c.api.actorInfo(c.event.actor).job===3)grant();
    if(c.event.kind==='mark'&&c.event.element===1&&c.count('buffId_1_1',c.event.actor))c.add('buffId_1_2',c.event.actor);
    if(before(c)&&c.level(3)&&c.event.hit?.slot===2&&max(c,'buffId_1_1',c.event.actor))c.once('attrId_3',3);
  },
  214059(c){
    if(c.level(1))residentTick(c,4,2,1,()=>c.add('buffId_1'));
    if(hit(c)){
      const n=c.count('buffId_1',c.event.actor);
      if(n>=5)c.add('debuffId_1_normal','boss');if(n>=10)c.add('debuffId_1_all','boss');
    }
    if(before(c)&&c.level(2)){
      if(is(c,4)&&c.api.actorInfo(c.event.actor).job===2&&[1,2].includes(c.event.hit!.damageType))c.once('onceId_2_1',2);
      if(c.event.hit?.damageType===2)c.once('onceId_2_2',2,c.count('buffId_1',c.event.actor));
    }
    if(c.event.kind==='mark'&&c.event.element===4&&c.level(3)&&c.count('buffId_1',c.event.actor))for(const actor of c.api.party)c.add(c.event.variant===2?'buffId_3_2':'buffId_3_1',actor,3);
  },
  214067(c){
    const field=c.level(3)?'buffId_1_eternal20':'buffId_1_eternal10';
    const grant=()=>{c.add(field);if(c.level(2))c.add('buffId_2_eternalExtra',c.main,2);if(c.level(3)&&max(c,field))c.add('buffId_3_full',c.main,3);};
    if(c.level(2))residentTick(c,5,2,c.value('inSceneInterval'),grant);
    if(hit(c)&&c.event.actor===c.main&&mainIs(c,5)&&[1,2].includes(c.event.hit!.damageType)&&c.counter('hits')>=c.value('hitCountThreshold')){c.set('hits',0);grant();}
    if(cast(c)&&c.level(3)&&is(c,5)&&c.api.actorInfo(c.event.actor).job===3)grant();
    if(before(c)&&is(c,5)&&c.count(field))c.once('onceId_1_teamLightDmg');
    if(c.event.kind==='tick'&&c.level(2)&&c.count('buffId_2_eternalExtra',c.main,2)!==c.count(field)){
      c.remove('buffId_2_eternalExtra',c.main,2);c.add('buffId_2_eternalExtra',c.main,2,c.count(field));
    }
  },
  214029(c){
    if(cast(c)&&c.event.actor===c.main&&mainIs(c,2)){
      c.add('buffId_1_skillDmg');c.add('buffId_1_mark');if(c.level(2))c.add('buffId_2_crit',c.main,2);
    }
    if(before(c)&&c.event.actor===c.main&&mainIs(c,2)&&c.level(3)&&max(c,'buffId_1_mark'))c.once('once_3_fireDmg',3);
    if(hit(c,2)&&c.event.actor===c.main&&mainIs(c,2))copy(c,'buffId_1_mark','buffId_1_debuff');
  },
  214033(c){
    if(c.event.kind==='init')c.group('buff_1_dmg',3);
    if(before(c,2)&&is(c,3)&&mainIs(c,3))c.once('once_1_skill');
    if(c.event.kind==='init'&&mainIs(c,3)){
      c.group('buff_1_dehurt',3);if(c.level(2))c.group('buff_2_atk',3,2);
    }
  },
  214037(c){
    if(c.event.kind==='mark'&&c.event.element===3&&player(c)&&is(c,3))c.add('buff_1_dmg','boss');
    if(c.event.kind==='heal'&&c.level(2)&&is(c,3))c.group('buff_2_dmg',3,2);
  },
  214042(c){
    if(c.event.kind==='init'&&c.level(2))for(const actor of c.api.actorsByElement(3))if(c.api.actorInfo(actor).job===2)c.add('buffId_s2',actor,2);
    if(hit(c,2)&&is(c,3)&&c.api.actorInfo(c.event.actor).job===2)c.group('buffId_s1',3);
    if(hit(c)&&c.level(3)&&c.event.actor===c.main&&mainIs(c,3)&&c.counter('hits')>=c.value('count_s3',3)){
      c.add('buffId_s3',c.main,3);c.set('hits',0);
    }
  },
  214044(c){
    if(c.event.kind==='init'&&c.level(2))for(const actor of c.api.actorsByElement(3))if(c.api.actorInfo(actor).job===2)c.add('buffId_s2',actor,2);
    if(hit(c,2)&&is(c,3)&&c.api.actorInfo(c.event.actor).job===2)c.add('buffId_s1','boss');
    if(before(c,2)&&is(c,3)){
      if(c.level(2)&&c.event.actor===c.main&&c.count('buffId_s1','boss'))c.once('once_s2',2);
      if(c.level(3)&&c.count('buffId_s3',c.event.actor,3))c.once('once_s3',3);
    }
    if(hit(c,2)&&c.level(3)&&c.event.actor===c.main&&mainIs(c,3)&&c.count('buffId_s1','boss')&&c.counter('hits')>=c.value('count_s3',3)){
      c.group('buffId_s3',3,3);c.set('hits',0);
    }
  },
  214052(c){
    if(!is(c,3)||c.api.actorInfo(c.event.actor).job!==1)return;
    const field=c.level(3)?'buffId_3_kla':'buffId_1';
    if(cast(c)){
      c.add(field,c.event.actor);if(c.level(2))c.add(c.level(3)?'buffId_2_2':'buffId_2_1',c.event.actor,2);
      if(c.count(field,c.event.actor)>=2)c.add('buffId_1_atk',c.event.actor);
    }
    if(before(c,2)&&c.count(field,c.event.actor)>=1)c.once('onceId_1');
    if(before(c,3)&&c.level(3)&&c.count(field,c.event.actor)>=3)c.once('onceId_3',3);
  },
  214054(c){
    if(!is(c,3)||c.api.actorInfo(c.event.actor).job!==1)return;
    const field=c.level(3)?'buffId_3_spa':'buffId_1';
    if(c.event.kind==='end'&&c.event.slot===2){
      c.add(field,c.event.actor);if(c.level(2))c.add(c.level(3)?'buffId_2_2':'buffId_2_1',c.event.actor,2);
      if(c.level(3)&&c.count(field,c.event.actor)>=3)c.add('buffId_3_atk',c.event.actor,3);
    }
    if(hit(c,2)&&c.count(field,c.event.actor)>=1)c.add('debuffId_1','boss');
    if(before(c,2)&&c.count(field,c.event.actor)>=2)c.once('onceId_1');
  },
  214068(c){
    if(hit(c)&&is(c,3)&&c.api.actorInfo(c.event.actor).job===2){
      if(c.event.hit?.damageType===1&&c.count('buffId_1_you','boss'))c.add('buffId_1_youNormal','boss');
      c.add('buffId_1_you','boss');
    }
    if(hit(c,1)&&c.level(3)&&c.event.actor!==c.main)c.add('buffId_3_leaf',c.event.actor,3);
    if(before(c)&&c.count('buffId_1_you','boss')){
      if(c.level(2)&&is(c,3)&&[1,2].includes(c.event.hit!.damageType))c.once('onceId_2_dmg',2);
      if(c.level(3)&&c.event.actor===c.main&&mainIs(c,3)&&c.event.hit?.damageType===2)c.once('onceId_3_skill',3);
    }
  },
  214069(c){
    if(before(c,1)&&is(c,3)&&c.event.actor!==c.main)c.once('onceId_1_assistNormal');
    if(cast(c)&&is(c,3)&&c.api.actorInfo(c.event.actor).job===2)c.add('buffId_1_youyou');
    if(c.event.kind==='mark'&&c.event.element===3&&c.level(2))c.group('buffId_2_ultimate',3,2);
    if(c.event.kind==='tick'&&c.level(3))for(const actor of c.api.actorsByElement(3)){
      if(max(c,'buffId_1_youyou')){if(!c.count('buffId_3_atk',actor,3))c.add('buffId_3_atk',actor,3);}
      else c.remove('buffId_3_atk',actor,3);
    }
  },
  214008(c){
    if(hit(c,2)&&player(c)&&is(c,1)&&c.api.actorInfo(c.event.actor).job===2)c.add('buffId_1','boss');
    if(!before(c))return;
    const n=c.count('buffId_1','boss');
    if(n>=c.value('count_1'))c.once('onceId_1',1,1,true);
    if(n>=c.value('count_1_2'))c.once('onceId_1_2',1,1,true);
    if(player(c)&&mainIs(c,1)){
      if(c.event.actor===c.main&&c.level(2))c.once('onceId_2',2,n);
      if(c.level(3))c.once('onceId_3',3,n);
    }
  },
  214015(c){
    if(cast(c)&&is(c,4)&&c.level(2))c.add('buffId_s2',c.event.actor,2);
    if(hit(c,2)&&is(c,4)&&c.event.actor!==c.main){
      c.add('buffId_s1','boss');
      if(c.count('buffId_s1','boss')>=c.value('maxCount_s1')){c.remove('buffId_s1','boss');c.add('buffId_s1_skill','boss');}
    }
    if(before(c)&&mainIs(c,4)&&c.event.actor===c.main&&c.level(3)&&c.count('buffId_s1','boss'))c.once('once_s3',3);
  },
  214016(c){
    if((cast(c)||c.event.kind==='charge')&&c.event.actor===c.main&&mainIs(c,4)){
      c.add('buffId_1');if(c.level(2))c.add('buffId_2',c.main,2);if(c.level(3))c.add('buffId_3',c.main,3);
    }
    if(hit(c,1)&&c.count('buffId_1',c.event.actor))copy(c,'buffId_1','buffId_1_atk');
    if(hit(c,2)&&c.count('buffId_1',c.event.actor))copy(c,'buffId_1','buffId_1_skill');
  },
  214017(c){
    if(c.event.kind==='remove'&&c.event.buff===c.value('buffId_s1_burn')){c.remove('buffId_s1_atk',c.event.owner);if(c.level(3))c.remove('buffId_s3_crit1',c.event.owner,3);}
    if(c.event.actor===c.main&&mainIs(c,2)&&(cast(c)||c.event.kind==='ammo')){
      const n=cast(c)?c.value('count_s1_1'):(c.event.count??1)*c.value('count_s1_2');
      c.add('buffId_s1_atk',c.main,1,n);if(c.level(3))c.add('buffId_s3_crit1',c.main,3,n);
      if(c.count('buffId_s1_atk')>=c.value('maxCount_s1'))c.add('buffId_s1_burn');
    }
    if(hit(c,1)&&c.count('buffId_s1_burn',c.event.actor))c.add('buffId_s1_hurt','boss');
  },
  214026(c){
    if(!c.level(2)||!hit(c)||c.event.actor!==c.main||c.count('buff_2_atk',c.main,2))return;
    if(c.counter('hits')>=c.value('count_2',2)){
      for(const actor of c.api.party)c.add('buff_2_atk',actor,2);c.set('hits',0);
    }
  },
  214028(c){
    if(!c.level(3)||!hit(c)||!player(c)||c.count('buffId_3','boss',3))return;
    if(c.counter('hits')>=c.value('count_3',3)&&c.api.time>c.get('ready')){
      c.add('buffId_3','boss',3);c.set('hits',0);c.set('ready',c.api.time+c.value('cd_3',3));
    }
  },
  214032(c){
    if(!hit(c)||!player(c)||!is(c,6)||c.event.hit?.slot===5||c.api.randomPercent()>=c.value('prob_l'))return;
    c.add('buffId_1','boss');if(c.level(2))c.group('buffId_2',6,2);
  },
  214057(c){
    if(hit(c,3)&&c.event.actor===c.main&&mainIs(c,6)){
      c.add('buffId_1');if(c.level(2))c.add('buffId_2',c.main,2);
    }
    if(hit(c,1))copy(c,'buffId_1','debuffId_1');
    if(hit(c,3))copy(c,'buffId_1','debuffId_2');
    if(before(c)&&is(c,6)){
      if(c.level(2)&&c.event.hit?.damageType===3&&c.api.hasBuffTag('boss','DarkAnZhuo'))c.once('onceId_2',2);
      if(c.level(3)&&c.event.hit?.damageType===1)c.once('onceId_3',3);
    }
  },
  214060(c){
    if(hit(c)&&[1,2].includes(c.event.hit!.damageType)&&is(c,4)&&c.api.actorInfo(c.event.actor).job===2&&mainIs(c,4))c.add('buffId_1');
    if(!before(c)||!player(c))return;
    const n=mainIs(c,4)?c.count('buffId_1'):0;
    if(n>=10)c.once('onceId_1_wind');
    if(n>=20&&is(c,4)&&c.event.hit?.damageType===1)c.once('onceId_1_normal');
    if(c.level(2)&&c.event.actor===c.main&&c.event.hit?.damageType===2)c.once('onceId_2',2,n);
    if(c.level(3)&&is(c,4)&&mainIs(c,4)&&max(c,'buffId_1'))c.once('onceId_3',3);
  },
  214061(c){
    if(c.event.kind==='cast'&&[2,4].includes(c.event.slot??0)&&c.event.actor===c.main&&mainIs(c,1))c.add('buffId_1');
    if(hit(c)&&c.count('buffId_1',c.event.actor)){
      c.add('debuffId_1_skillDmg','boss');c.add('debuffId_1_markDmg','boss');
    }
    if(c.level(2)&&c.event.kind==='mark'&&c.event.element===1&&c.event.actor===c.main&&mainIs(c,1))c.add('buffId_2_memory',c.main,2,c.count('buffId_1'));
    if(c.level(3)&&c.level(2)){
      if(c.event.kind==='buff'&&c.event.buff===c.value('buffId_2_memory',2)&&mainIs(c,1)){
        c.group('buffId_3_teamSkillDmg',1,3);
        if(max(c,'buffId_2_memory',c.main,2))c.add('buffId_3_markDmg',c.main,3);
      }
      if(c.event.kind==='tick'&&!max(c,'buffId_2_memory',c.main,2))c.remove('buffId_3_markDmg',c.main,3);
    }
  },
  214062(c){
    if((c.event.kind==='mark'&&c.event.element===1||c.event.kind==='hurt')&&c.event.actor===c.main&&mainIs(c,1)){
      c.add('buffId_1_jueze');
      if(max(c,'buffId_1_jueze')){c.add('buffId_1_markDmg');if(c.level(2))c.add('buffId_2_atk',c.main,2);}
    }
    if(c.level(2)&&hit(c)&&c.event.actor===c.main&&mainIs(c,1)&&max(c,'buffId_1_jueze'))c.add('debuffId_2_tomorrow','boss',2);
    if(before(c)){
      if(is(c,1)&&c.count('buffId_1_jueze')>=3)c.once('onceId_1_teamWaterDmg');
      if(c.level(2)&&c.event.hit?.damageType===2&&c.count('debuffId_2_tomorrow','boss',2))c.once('onceId_2_waterSkillDmg',2);
    }
    if(c.level(3)&&c.level(2)&&c.event.kind==='buff'&&c.event.buff===c.value('debuffId_2_tomorrow',2)&&c.event.actor===c.main&&mainIs(c,1))for(const actor of c.api.party)c.add('buffId_3_teamAtk',actor,3);
    if(c.event.kind==='tick'&&!max(c,'buffId_1_jueze')){
      c.remove('buffId_1_markDmg');if(c.level(2))c.remove('buffId_2_atk',c.main,2);
    }
  },
};
