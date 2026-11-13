import type {RecordRuleBuffs} from './combat-record-rules';
import type {CompiledCombo} from './combat-timeline';
export interface SupportAreaOptions {scalingActor?:string;disableGeneratedAreas?:boolean}
export interface SupportAreaOptions {entity?:number;duration?:number;x?:number;z?:number;angle?:number;scale?:number;growth?:{interval:number;step:number;maximum:number};disableBuffs?:boolean;hitInterval?:number;moveSpeed?:number;hitId?:number;enemyEnterBuffs?:number[];additionalAttributes?:{id:number;count:number}[]}
export interface SupportCombatHit {actor:string;damageType:number;element:number;slot:number;tags:number[];weapon?:string;weaponId?:number;tagUid?:number}
export interface CombatGameplayTrigger {normal:boolean;dodge:boolean;skill:boolean;ultimate:boolean}
export interface SupportProjectilePath {x:number;z:number;dx:number;dz:number;hitId?:number;enemyBuffs?:number[];friendBuffs?:number[];tagUid?:number}
export interface IndependentCombatComboOptions {maximumSeconds?:number;source?:string;speed?:number;lease?:string;index?:number;entity?:number}

/** Character adapters supply only their native differences. Clocks, cooldowns,
 * SP, hit resolution, proc dispatch and snapshots stay in the shared engine. */
export interface SupportCombatApi {
  actor:string;main:string;party:string[];lightActors:string[];time:number;distance:number;
  buffs:RecordRuleBuffs;
  parameter(id:number):number;
  area(name:string,target?:string,options?:SupportAreaOptions):number;
  stopWeapons(prefix:string,exact?:boolean):void;
  stopWeapon?(id:number):void;
  stopAreasByTag?(tag:string):void;
  areaRadius(name:string):number;
  projectile(name:string,target?:string,travelDistance?:number,options?:SupportAreaOptions):void;
  projectileAs?(source:string,name:string,distance?:number):void;
  projectileAt?(name:string,target:{x:number;z:number},origin?:{x:number;z:number}):void;
  drop(name:string,position:{x:number;z:number;y?:number},buffId?:number):void;
  activeAreas?(tag:string):number;
  areaContains?(tag:string,target:string):boolean;
  extendAreas?(tag:string,seconds:number):void;
  buffTagCount?(owner:string,tag:string):number;
  removeBuffTag?(owner:string,tag:string):void;
  hitAs?(actor:string,id:number):void;
  directionalProjectile(name:string,path:SupportProjectilePath):void;
  projectilePosition?(name:string,path:SupportProjectilePath,elapsed:number):{x:number;z:number}|null;
  skillReady?(key:string):boolean;
  chargeCount?(key:string):number;
  consumeCharge?(key:string):boolean;
  shield(id:number,target:string,extraSeconds?:number):void;
  removeShield?(id:number,target:string):void;
  hasShieldTag(owner:string,tag:string):boolean;
  hit(id:number,removeBuffsAfterHit?:{owner:string;id:number}[],feature?:Record<string,unknown>):void;
  toughnessDamage(percent:number):void;
  bossHasToughness():boolean;
  bossBroken?():boolean;
  bossHpPercent?():number;
  actorActive?(actor:string):boolean;
  buffLimit?(id:number):number;
  buffDuration?(id:number):number;
  extendBuff?(owner:string,id:number,seconds:number):void;
  directSp(actor:string,rawAmount:number):void;
  onceDot?(buff:number,hit:number,period:number):void;
  removeStacks(owner:string,id:number,count:number):void;
  reduceCooldown(seconds:number,key?:string):void;
  randomPercent():number;
  actorsByElement(element:number):string[];
  actorInfo(actor:string):{element:number;job:number};
  ultimateReady():boolean;
  ultimateCooling?(actor:string):boolean;
  cast(key:string):void;
  hasBuffTag(owner:string,tag:string):boolean;
  activeAction():string|null;
  interrupt():void;
  resetCooldown(key?:string):void;
  restartCooldown?(key?:string):void;
  pauseCooldown(key?:string):void;
  resumeCooldown(key?:string):void;
  retainCooldownPercent(percent:number,key?:string):void;
  schedule(name:string,seconds:number,data?:Record<string,number|string>):void;
  emitProc?(name:string,facts?:Record<string,number|boolean|string>,participants?:{target?:string;attacker?:string}):void;
  entityData?(name:string):Record<string,any>;
  weaponName?(pathId:string):string;
  weaponData?(name:string,type:string):Record<string,any>;
  independentCombo?(tag:string|number[],options?:IndependentCombatComboOptions):number;
  independentLease?(key:string,until:number):void;
  summon?(entity:number,buffs:number[]):void;
  despawn?(entity:number):void;
  summonAttribute?(entity:number,type:number):number;
  minionHit?(entity:number,id:number):void;
  independentAllowed?(tag:string,elapsed:number,skill:number,source:string,speed?:number):boolean;
  attribute?(type:number):number;
  initialAttribute?(type:number):number;
  buffAttribute?(id:number,type:number):{base:number;percent:number;absolute:number};
  summonAi?(id:number):{source:string;thinkSeconds:number;normalCooldown:number;initialCooldown:number;customController?:string};
}
export interface SupportCombatAction {
  group?:string;
  kind:string;skill:number;tag:string|number[];cooldownTiming?:'start'|'end';automatic?:boolean;
  normal?:boolean;
  flag?:number;cooldown?:number;spBudget?:number|null;reload?:boolean;reloadIndex?:number;
  charges?:number;
  spCost?:number;
  cooldownKey?:string;
  loopSeconds?:number;loopCount?:number;loopBodySeconds?:number;loopBodyIndex?:number;
  loopFinishTag?:string;
  scriptedLoop?:boolean;
  chain?:{tag:string;until?:'activation';index?:number;enterEvent?:string;repeatSeconds?:number}[];
}
export interface SupportCombatAdapter<State> {
  procFacts?(state:State):Record<string,number|boolean|string>;
  actions(cinematics:boolean):SupportCombatAction[];
  potentials:readonly number[];
  initialize(api:SupportCombatApi):State;
  cast?(state:State,api:SupportCombatApi,slot:string):State;
  partySkillCast?(state:State,api:SupportCombatApi,source:string):State;
  partySkillChargeConsumed?(state:State,api:SupportCombatApi,source:string):State;
  partyUltimateCast?(state:State,api:SupportCombatApi,source:string):State;
  end?(state:State,api:SupportCombatApi,slot:string,interrupted:boolean):State;
  continuation?(state:State,api:SupportCombatApi,slot:string):{state:State;tag:string;index?:number}|null;
  attacked?(state:State,api:SupportCombatApi,tags:number[],hit?:SupportCombatHit):State;
  gameplayTrigger?(state:State,api:SupportCombatApi,flags:CombatGameplayTrigger):State;
  prepareHit?(state:State,api:SupportCombatApi,tags:number[]):State;
  beforeHit?(state:State,api:SupportCombatApi,tags:number[]):{id:number;count:number}[];
  replaceNoDamageHit?(id:number):number|undefined;
  afterHit?(state:State,api:SupportCombatApi,tags:number[],hit:SupportCombatHit):State;
  afterMinionHit?(state:State,api:SupportCombatApi,entity:number,hit:SupportCombatHit,crit:boolean):State;
  prepareMinionHit?(state:State,api:SupportCombatApi,entity:number,hit:SupportCombatHit):State;
  beforeMinionHit?(state:State,api:SupportCombatApi,entity:number,hit:SupportCombatHit):{id:number;count:number;source?:string}[];
  partyHit?(state:State,api:SupportCombatApi,hit:SupportCombatHit):State;
  beforePartyHit?(state:State,api:SupportCombatApi,hit:SupportCombatHit):{id:number;count:number;source?:string}[];
  preparePartyHit?(state:State,api:SupportCombatApi,hit:SupportCombatHit):State;
  beforePartySettlement?(state:State,api:SupportCombatApi,hit:SupportCombatHit):State;
  partyCrit?(state:State,api:SupportCombatApi,hit:SupportCombatHit):State;
  projectileModifiers?(state:State,api:SupportCombatApi,source:string,name:string,distance:number):{attributes:{id:number;count:number;source:string}[];speedMultiplier:number};
  mainHit?(state:State,api:SupportCombatApi):State;
  tick?(state:State,api:SupportCombatApi):State;
  custom?(state:State,api:SupportCombatApi,name:string,data?:Record<string,number|string>):State;
  comboArea?(name:string,combo:CompiledCombo,elapsed:number,distance:number):SupportAreaOptions|undefined;
  weaponDuration?(name:string,api:SupportCombatApi):number|undefined;
  weaponBegin?(state:State,api:SupportCombatApi,name:string,id?:number):State;
  weaponEnd?(state:State,api:SupportCombatApi,name:string,id?:number):State;
  areaEnd?(state:State,api:SupportCombatApi,name:string,position:{x:number;z:number;center?:string}):State;
  mark?(tags:number[],state?:State,api?:SupportCombatApi):{element:number;variant?:1|2;area?:string;hit?:number;buffTag?:string;applyBuff?:number|number[];radius?:number;
    afterHitBuffs?:number[];removeAfterHit?:boolean}|null;
  markTriggered?(state:State,api:SupportCombatApi,element:number,tags:number[],source:string):State;
  beforeMark?(state:State,api:SupportCombatApi,tags:number[]):State;
  projectileEnd?(state:State,api:SupportCombatApi,name:string,target:string,position?:{x:number;z:number}):State;
  dropEnd?(state:State,api:SupportCombatApi,name:string,picked:boolean):State;
  event?(state:State,api:SupportCombatApi,name:string,data:Record<string,number|string>):State;
  automatic?(state:State,api:SupportCombatApi):string|null;
  canCast?(state:State,api:SupportCombatApi,key:string):boolean;
  comboTag?(state:State,api:SupportCombatApi,key:string):string|null;
  phase?(state:State,api:SupportCombatApi,key:string,phase:'anticipation'|'activation'):State;
  shot?(state:State,api:SupportCombatApi,ammoCost:number):State;
  crit?(state:State,api:SupportCombatApi,hit:SupportCombatHit):State;
  shieldChanged?(state:State,api:SupportCombatApi,shield:{id:number;owner:string;source:string;tags:number[]},added:boolean):State;
}
