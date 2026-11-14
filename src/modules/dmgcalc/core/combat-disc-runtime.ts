import type {CombatRecordSelection} from './combat-base';
import type {CombatRuntimeState} from './combat-runtime';
import type {SupportCombatApi,SupportCombatHit} from './combat-support-adapter';
import {combatConditionTargets,matchCombatEffectConditions,type CombatConditionContext} from './combat-conditions';
import type {CombatEffectValue} from './combat-effects';
export interface NativeRecordData {id:number;element:number;fields:Record<string,number|number[]>;main:{Id:number;Level:number;EffectId?:number[]}[];secondary:{Id:number;GroupId:number;Level:number;EffectId?:number[]}[];source:{type:string;sha256:string}|null}
export interface DiscEvent {kind:'init'|'tick'|'cast'|'end'|'hit'|'before'|'mark'|'buff'|'remove'|'summon'|'despawn'|'ammo'|'charge'|'kill'|'heal'|'hurt'|'shield';actor:string;slot?:number;hit?:SupportCombatHit;buff?:number;buffTags?:number[];owner?:string;element?:number;variant?:number;entity?:string;count?:number;hpFraction?:number;fateCards?:number;spCapacity?:number}
export interface DiscOnce {id:number;count:number;source:string;target?:boolean}
export interface DiscContext {record:NativeRecordData;state:CombatRuntimeState;api:SupportCombatApi;event:DiscEvent;main:string;
  level:(lane?:number)=>number;value:(field:string,lane?:number)=>number;add:(field:string,owner?:string,lane?:number,count?:number)=>void;
  count:(field:string,owner?:string,lane?:number)=>number;remove:(field:string,owner?:string,lane?:number)=>void;
  group:(field:string,element:number,lane?:number,count?:number)=>void;once:(field:string,lane?:number,count?:number,target?:boolean)=>void;
  counter:(key:string,increment?:number)=>number;set:(key:string,value:number)=>void;get:(key:string)=>number;
}
export type DiscHandler=(context:DiscContext)=>void;
export function createCombatDiscRuntime(data:Record<number,NativeRecordData>,selections:CombatRecordSelection[],concertos:Record<number,number>,handlers:Record<number,DiscHandler>,legacy:number[]){
  const active=selections.map((selection,index)=>({selection,index})).filter(({selection})=>selection.id&&!legacy.includes(selection.id)).map(({selection,index})=>{
    const record=data[selection.id];if(!record)throw new Error(`레코드 ${selection.id}의 원본 전투 데이터가 없습니다.`);
    if(record.source&&!handlers[record.id])throw new Error(`레코드 ${selection.id} 고유 규칙 연결이 필요합니다.`);
    const main=record.main.find(row=>row.Level===selection.limitBreak+1);if(!main)throw new Error(`레코드 ${record.id} 돌파 데이터 누락`);
    const skills=[...(index<3?[main]:[]),...record.secondary.filter(row=>concertos[row.GroupId]===row.Level)];
    return {record,skills,effects:skills.flatMap(skill=>skill.EffectId??[])};
  });
  return {
    enabled:active.length>0,
    staticEffects(actor:string,conditions:CombatConditionContext,effects:Record<number,any>,values:Record<number,CombatEffectValue>):number[]{
      const recipient=conditions.actors.find(row=>row.id===actor)!;
      return active.flatMap(entry=>entry.effects.filter(id=>{
        const metadata=effects[id],value=values[id];
        return metadata?.Trigger===1&&value!==undefined&&[12,52,53,56,57].includes(value.EffectType)&&combatConditionTargets(Number(metadata.Target1??1),conditions).some(target=>target.id===actor)&&matchCombatEffectConditions(metadata,'TakeEffect',conditions)&&matchCombatEffectConditions(metadata,'Target',conditions,recipient);
      }));
    },
    process(state:CombatRuntimeState,event:DiscEvent,api:SupportCombatApi,conditions?:CombatConditionContext,effects?:Record<number,any>,values?:Record<number,CombatEffectValue>):{once:DiscOnce[];attributes:{id:number;target:string}[]}{
      const once:DiscOnce[]=[],attributes:{id:number;target:string}[]=[];
      for(const entry of active){
        const {record,skills}=entry,key=`disc:${record.id}:`;
        const stages=[1,2,3].map(lane=>{
          const ids=record.fields[`skillId_s${lane}`] as number[]|undefined;
          return ids?ids.findIndex(id=>skills.some(skill=>skill.Id===id)):-1;
        });
        const value=(field:string,lane=1)=>{
          const row=record.fields[field];if(row===undefined)throw new Error(`Missing native disc field ${record.id}/${field}`);
          if(typeof row==='number')return row;
          const stage=stages[lane-1]??-1;return stage<0?0:row[stage]??0;
        };
        const level=(lane=1)=>(stages[lane-1]??-1)+1;
        const add=(field:string,owner=api.main,lane=1,count=1)=>{const id=value(field,lane);if(id)for(let i=0;i<count;i++)api.buffs.add(owner,id,event.actor);};
        const count=(field:string,owner=api.main,lane=1)=>{const id=value(field,lane);return id?api.buffs.count(owner,id):0;};
        const remove=(field:string,owner=api.main,lane=1)=>{const id=value(field,lane);if(id)api.buffs.remove(owner,id);};
        const get=(name:string)=>Number(state.script[key+name]??0),set=(name:string,n:number)=>{state.script[key+name]=n;};
        handlers[record.id]?.({record,state,api,event,main:api.main,value,level,add,count,remove,get,set,
          group:(field,element,lane=1,n=1)=>{for(const actor of api.actorsByElement(element))add(field,actor,lane,n);},
          once:(field,lane=1,n=1,target=false)=>{const id=value(field,lane);if(id&&n>0)once.push({id,count:n,source:api.main,target});},
          counter:(name,increment=1)=>{const n=get(name)+increment;set(name,n);return n;}});
        if(!conditions||!effects||!values)continue;
        const triggers:Partial<Record<DiscEvent['kind'],number[]>>={cast:[6],end:[20],hit:[2],before:[2],mark:[32,41],buff:[7],remove:[8],summon:[37],tick:[19],kill:[4],hurt:[3],shield:[39]};
        for(const id of entry.effects){
          const metadata=effects[id],effect=values[id];if(!metadata||!effect||!triggers[event.kind]?.includes(metadata.Trigger))continue;
          const numeric=[12,45,52,53,54,55,56,57,58,59].includes(effect.EffectType);
          if(event.kind==='before'?!numeric:numeric)continue;
          const context={...conditions,owner:event.actor,source:event.actor};
          if(!matchCombatEffectConditions(metadata,'Trigger',context)||!matchCombatEffectConditions(metadata,'TakeEffect',context))continue;
          if(effect.EffectRate!==undefined&&effect.EffectRate<100&&api.randomPercent()>effect.EffectRate)continue;
          const cooldown=Number((metadata as any).CD??0)/10000;
          if(cooldown&&get(`effect:${id}`)>api.time)continue;
          if(event.kind==='tick'){
            const period=Number(metadata.TriggerParam1||0);
            if(!period)continue;
            if(!get(`tick:${id}`)){set(`tick:${id}`,api.time+period);continue;}
            if(get(`tick:${id}`)>api.time)continue;set(`tick:${id}`,api.time+period);
          }
          for(const target of combatConditionTargets(Number(metadata.Target1??1),context).filter(target=>matchCombatEffectConditions(metadata,'Target',context,target))){
            if(numeric)attributes.push({id,target:target.id});
            else if(effect.EffectType===6)api.buffs.add(target.id,Number(effect.EffectTypeParam1),event.actor);
            else if(effect.EffectType===42)api.shield(Number(effect.EffectTypeParam1),target.id);
            else throw new Error(`Unsupported native record effect ${id}/${effect.EffectType}`);
          }
          if(cooldown)set(`effect:${id}`,api.time+cooldown);
        }
      }
      return {once,attributes};
    },
  };
}
