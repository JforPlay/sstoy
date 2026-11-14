import type {CycleSearchResult} from './combat-optimizer';
/** Local top five per partition are sufficient for the global top five.
 * Global strategy indices keep tied results identical to serial execution. */
export function mergeCycleSearchResults(parts:CycleSearchResult[]):CycleSearchResult{
  const first=parts[0];if(!first)throw new Error('No search results');
  for(const part of parts)if(part.baseline!==first.baseline||part.duration!==first.duration||part.switchRate!==first.switchRate||JSON.stringify(part.input)!==JSON.stringify(first.input)||JSON.stringify(part.options)!==JSON.stringify(first.options))throw new Error('Incompatible search results');
  const seen=new Set<string>();
  const candidates=parts.flatMap(part=>part.candidates).sort((a,b)=>b.damage-a.damage||a.strategyIndex-b.strategyIndex).filter(candidate=>{
    const key=JSON.stringify([candidate.casts.map(({time,action})=>({time,action})),candidate.damage]);
    if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,5);
  return {...first,candidates,tested:parts.reduce((sum,part)=>sum+part.tested,0)};
}
