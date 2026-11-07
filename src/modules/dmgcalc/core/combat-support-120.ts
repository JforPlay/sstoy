import {combatTagHash as hash} from './combat-tags';
import {combatFixed} from './combat-weapons';
import type {SupportCombatAdapter,SupportCombatApi} from './combat-support-adapter';
interface KanacheState extends Record<string,unknown>{rings:{id:number;name:string}[];generation:number;turns:number;hits:number;hitAt:number;bossBroken:boolean;ultTarget:boolean}
const SKILL=hash('120_B2'),RING=hash('120_B2_Skill'),ULT=hash('120_UltraHitTag'),DELIVERY='Bullet_12001_B2_Skill_Projectile';
export function createSupport120(potentials:Record<number,number>):SupportCombatAdapter<KanacheState>{
  const has=(n:number)=>Boolean(potentials[512000+n]);
  const ring=()=>has(21)?has(22)?'Bullet_12001_B2P21P22_Skill_Corolla_Strength':'Bullet_12001_B2P21_Skill_Corolla_Strength':has(22)?'Bullet_12001_B2P22_Skill_Corolla':'Bullet_12001_B2_Skill_Corolla';
  return {
    procFacts:s=>({huaWeaponCount:s.rings.length}),
    potentials:[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43].map(n=>512000+n),
    actions:cinematics=>[{kind:'skill',skill:12032000,tag:'120_B2'},{kind:'ultimate',skill:12040000,tag:`120_Ultra_${cinematics?'TL':'NoTL'}${has(41)?'_41':''}`,loopSeconds:361/60}],
    initialize(api){if(has(33))for(const _ of api.actorsByElement(4))api.buffs.add(api.actor,12033011,api.actor);return {rings:[],generation:0,turns:0,hits:0,hitAt:-1,bossBroken:false,ultTarget:false};},
    cast(s,api,key){if(key==='skill'){for(const r of s.rings)api.stopWeapon?.(r.id);return {...s,rings:[],generation:s.generation+1,turns:0,hits:0};}
      if(key==='ultimate'){api.buffs.add(api.actor,12000011,api.actor);if(has(43))api.buffs.add(api.actor,12043011,api.actor);return {...s,ultTarget:false};}return s;},
    end(s,api,key){if(key==='ultimate')api.buffs.remove(api.actor,12000011);return s;},
    custom(s,api,name){if(name==='120_ShootEvent')api.projectile(DELIVERY,api.main,1);return s;},
    weaponEnd(s,api,name,id){
      return {...s,rings:s.rings.filter(r=>r.id!==id)};
    },
    projectileEnd(s,api,name){if(name===DELIVERY){api.projectile(ring());if(has(24))api.projectile(has(23)?'Bullet_12001_B2P24P23_Wreath':'Bullet_12001_B2P24_Wreath');}return s;},
    weaponBegin(s,api,name,id){if(!name.startsWith('Bullet_12001_B2')||name===DELIVERY)return s;
      const rings=[...s.rings,{id:id!,name}];
      if(name===ring()){
        const data=api.weaponData!(name,'AdventureRotateWeapon'),speed=has(23)?360:Math.abs(combatFixed(data.rotateSpeed));
        api.schedule('ring-turn',Math.floor(360/speed*60)/60+1/60,{generation:s.generation,period:360/speed});
      }return {...s,rings};
    },
    beforePartyHit(s,_api,hit){const result:{id:number;count:number;source?:string}[]=[];
      if(hit.tags.includes(RING)){
        if(has(23))result.push({id:12052311,count:1});if(has(28)&&s.hits>0)result.push({id:12052801,count:s.hits});if(has(29)&&s.turns>0)result.push({id:12052901,count:s.turns});
      }
      if(hit.tags.includes(SKILL))for(const [n,id] of [[21,12052111],[22,12052211],[26,12052601],[27,12052701]])if(has(n!))result.push({id:id!,count:1});
      return result.map(x=>({...x,source:x.source??hit.actor}));
    },
    beforeHit:(_s,_api,tags)=>has(31)&&tags.includes(ULT)?[{id:12053101,count:1}]:[],
    prepareHit(s,api,tags){if(tags.includes(ULT)&&!s.ultTarget){api.emitProc?.('own-ultimate-new-target');return {...s,ultTarget:true};}return s;},
    partyHit(s,api,hit){
      if(hit.actor!==api.actor&&hit.actor!==api.main)return s;
      s={...s};
      if(hit.tags.includes(ULT)){if(has(31))api.buffs.add('boss',2011,api.actor);if(has(42))api.buffs.add(api.actor,12042011,api.actor);}
      if(hit.tags.includes(SKILL)){if(has(25))api.buffs.add('boss',12025011,api.actor);if(has(28)&&(s.hitAt<0||api.time-s.hitAt>1)){s.hits++;s.hitAt=api.time;}
        const broken=api.bossBroken?.()??false;if(has(27)&&broken&&!s.bossBroken)api.buffs.add('boss',12027011,hit.actor);s.bossBroken=broken;
      }return s;
    },
    event(s,api,name,data){if(name==='ring-turn'&&data.generation===s.generation&&s.rings.some(r=>r.name===ring())){
      if(has(30))api.buffs.add(api.main,12030011,api.actor);if(has(24))api.area('AreaEffect_12001_B2P24_Wreath',api.main,{x:0,z:0});api.schedule(name,Number(data.period),data);return {...s,turns:s.turns+1};}return s;},
    mark:tags=>tags.includes(hash('120WindTagBoom'))?{element:4,variant:2,area:'AreaEffect_120_WindMark1_Bloom'}:null,
    markTriggered(s,api,element){if(element===4)api.emitProc?.('wind-mark-triggered');return s;},
  };
}
