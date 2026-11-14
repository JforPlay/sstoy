import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {optimizeExampleCycles} from '../core/combat-optimizer';
import {mergeCycleSearchResults} from '../core/combat-search-results';

it('runs ten actual optimizer partitions and matches an undivided search',async()=>{
  const tables=await loadExampleCombatTables(async name=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8')));
  const example=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
  example.durationSeconds=1;
  const options={boss:27,distance:2,cinematics:false};
  const serial=optimizeExampleCycles(example,tables,options);
  const parts=Array.from({length:10},(_,index)=>optimizeExampleCycles(example,tables,options,undefined,{index,count:10}));
  const merged=mergeCycleSearchResults(parts);
  expect(parts.every(part=>part.tested>0)).toBe(true);
  expect(merged.tested).toBe(serial.tested);
  expect(merged.baseline).toBe(serial.baseline);
  expect(merged.candidates.map(row=>[row.strategyIndex,row.damage])).toEqual(serial.candidates.map(row=>[row.strategyIndex,row.damage]));
},60000);
