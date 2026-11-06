import {compileCombo,type CombatTimeline,type CompiledCombo} from './combat-timeline';
export interface CombatComboAlias {
  tag:string;keys:number[];skillType:number;clips:string[];source?:string;group?:string;clipMode?:number;eventGroups?:string[];
}
export interface CombatComboSource {id:number;comboAliases:CombatComboAlias[];timelines:CombatTimeline[]}
/** Summon and character archives can both name an action Atk1. Selection is
 * scoped to its real bundle/group; no cross-actor animation substitution. */
export function resolveCombatCombo(source:CombatComboSource,tag:string|number[],index:number,attackSpeed:number,
  fps:number,defaultHitInterval:number,selector:{source?:string;group?:string}={}):CompiledCombo{
  let aliases=source.comboAliases.filter(alias=>(typeof tag==='string'?alias.tag===tag:JSON.stringify(alias.keys)===JSON.stringify(tag))
    &&(!selector.source||alias.source===selector.source)&&(!selector.group||alias.group===selector.group));
  if(!selector.source&&!selector.group&&aliases.length>1){
    const main=aliases.filter(alias=>alias.source===`char_${source.id}01_combos.unity3d`);
    if(main.length)aliases=main;
    // Older three-character fixtures did not preserve bundle provenance.
    else if(aliases.every(alias=>!alias.source))aliases=aliases.slice(0,1);
  }
  if(aliases.length!==1)throw new Error(`${aliases.length?'Ambiguous':'Missing'} combat combo ${source.id}/${JSON.stringify(tag)}/${index}`);
  const alias=aliases[0]!,timeline=source.timelines.find(timeline=>timeline.pathId===alias.clips[index]);
  if(!timeline)throw new Error(`Missing combat clip ${source.id}/${JSON.stringify(tag)}/${index}`);
  const eventGroup=Number(alias.eventGroups?.[index]?.split(':')[0] ?? 0);
  const combo=compileCombo(timeline,alias.skillType===1,attackSpeed,source.id*100+1,defaultHitInterval,fps,1,eventGroup);
  combo.loop=alias.clipMode===1;
  return combo;
}
