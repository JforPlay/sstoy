import {readCombatAttribute,type CombatAttributes,type CombatAttributeLimit} from './combat-attributes';
import {getCombatValue,type CombatLevelContext,type ValueMetadata} from './rotation-values';

export interface CombatShieldValue {Id:number;ReferenceTarget?:number;ReferenceAttrib?:number;ReferenceScale?:number;ReferenceLimit?:number;
  AbsorptionBase?:number;Time?:number;ShieldLaminatedNum?:number;TimeSuperposition?:number}
export interface CombatShieldInstance {id:number;valueId:number;owner:string;source:string;expires:number|null;segments:{maximum:number;remaining:number}[]}
export type CombatShieldState=Record<string,CombatShieldInstance>;
export interface CombatShieldContext {
  definitions:Record<number,ValueMetadata>;values:Record<number,CombatShieldValue>;levels:Record<string,CombatLevelContext>;
  attributes(actor:string):CombatAttributes;limits:Record<number,CombatAttributeLimit>;
  hp(actor:string):number;
}

/** ShieldEntity.GetRefValue, InitShieldValue. The referenced actor and source
 * shield strength stay separate from the recipient's shield efficiency. */
export function combatShieldAmount(row:CombatShieldValue,owner:string,source:string,context:CombatShieldContext):number {
  const actor=row.ReferenceTarget===1 ? source : row.ReferenceTarget===2 ? owner : null;
  let reference=0;
  if(actor) {
    const attributes=context.attributes(actor),ref=row.ReferenceAttrib ?? 0;
    const type:Record<number,number>={1:3,2:1,3:1,4:3,5:2,6:2,7:6,8:8,9:9,10:17,11:18,12:19,13:20,14:21,15:22,16:23,17:24,18:25,19:26,20:27,21:28};
    if(ref===22) reference=context.hp(actor);
    else if(type[ref]) {
      const entry=attributes[type[ref]!];
      reference=[3,4,6].includes(ref) ? (entry?.origin ?? 0)+(entry?.base ?? 0) : readCombatAttribute(attributes,type[ref]!,context.limits);
    }
  }
  let addition=Math.trunc(reference*(row.ReferenceScale ?? 0)/10000);
  if((row.ReferenceLimit ?? 0)>0) addition=Math.min(addition,row.ReferenceLimit!);
  const strength=Math.max(0,readCombatAttribute(context.attributes(source),87,context.limits));
  const efficiency=Math.max(0,readCombatAttribute(context.attributes(owner),88,context.limits));
  return Math.ceil(((row.AbsorptionBase ?? 0)+addition)*strength*efficiency);
}
export function expireCombatShields(state:CombatShieldState,time:number):CombatShieldState {
  return Object.fromEntries(Object.entries(state).filter(([,shield])=>(shield.expires===null || shield.expires>time) && shield.segments.length>0));
}
export function combatShieldTotal(state:CombatShieldState,owner:string,time:number):number {
  return Object.values(state).filter(shield=>shield.owner===owner && (shield.expires===null || shield.expires>time))
    .reduce((sum,shield)=>sum+shield.segments.reduce((total,segment)=>total+segment.remaining,0),0);
}
export function extendCombatShield(state:CombatShieldState,id:number,owner:string,seconds:number,time:number):CombatShieldState {
  if(!Number.isFinite(seconds)) throw new Error('Invalid shield time adjustment');
  const key=`${owner}:${id}`,shield=state[key];
  if(!shield || shield.expires===null || shield.expires<=time) return state;
  return {...state,[key]:{...shield,expires:shield.expires+seconds}};
}
export function hasCombatShieldTag(state:CombatShieldState,owner:string,tag:number,time:number,definitions:Record<number,ValueMetadata>):boolean {
  return Object.values(state).some(shield=>shield.owner===owner && (shield.expires===null || shield.expires>time)
    && Object.entries(definitions[shield.id] ?? {}).some(([key,value])=>key.startsWith('ShieldTag')&&value===tag));
}
export function addCombatShield(state:CombatShieldState,id:number,owner:string,source:string,time:number,context:CombatShieldContext):CombatShieldState {
  const result=expireCombatShields(state,time),key=`${owner}:${id}`,prior=result[key];
  const level=context.levels[source];
  if(!level) throw new Error(`Missing shield source ${source}`);
  const row=prior ? context.values[prior.valueId] : getCombatValue(id,context.definitions,context.values,level);
  if(!row) throw new Error(`Missing shield values ${id}`);
  const amount=combatShieldAmount(row,owner,source,context),segments=prior ? [...prior.segments] : [];
  if(segments.length>=Math.max(1,row.ShieldLaminatedNum ?? 1)) segments.shift();
  segments.push({maximum:amount,remaining:amount});
  const duration=(row.Time ?? 0)/10000;
  let expires=prior?.expires ?? (duration>0 ? time+duration : null);
  if(prior && duration>0) {
    if(row.TimeSuperposition===2) expires=time+duration;
    else if(row.TimeSuperposition===3) expires=(prior.expires ?? time)+duration;
  }
  return {...result,[key]:{id,valueId:row.Id,owner,source,expires,segments}};
}
