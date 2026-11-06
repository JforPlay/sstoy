import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {loadExampleCombatTables} from '../core/combat-data';
import {createExampleCombatModel} from '../core/combat-example-model';
import {evaluateCombatPolicies} from '../core/combat-policy-search';
import {describe} from 'vitest';
const fixture=JSON.parse(readFileSync('public/guides/rotation-example.json','utf8'));
const tables=await loadExampleCombatTables(async name=>JSON.parse(readFileSync(`public/data/${name}.json`,'utf8')),[139,130,160]);
it('runs Tona and summer Willow together for 180 seconds using the selected party',()=>{
  const live={actors:[139,130,160].map(id=>({id,level:90,ascension:8,limitBreak:0,potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),
    records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
  const p=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
  const result=evaluateCombatPolicies(p.model,[{name:'ready',choose:(_s,legal)=>legal.find(key=>key.includes('ultimate'))??legal[0]??null}],180,60,p.boss.switchRate)[0]!;
  expect(result.damage).toBeGreaterThan(0);
  for(const actor of [130,160])expect(result.state.counts[`${actor}:skill`]).toBeGreaterThan(0);
  expect(result.state.counts['160:resident']).toBeGreaterThan(0);
  expect(result.state.counts['160:ultimate']).toBeGreaterThan(0);
});

describe('connected support potential and breakthrough paths',()=>{
  it('extends the actual ultimate child-area cadence on frozen targets, not just the parent expiry',()=>{
    const replay=(enabled:boolean)=>{
      const live={actors:[139,130,160].map(id=>({id,level:90,ascension:8,limitBreak:0,
        potentials:id===130&&enabled?{513043:6}:{},skillSlots:{1:8,2:8,4:8,5:8}})),
        records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
      const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:false});
      let state=profile.model.initial();
      state.sp.ledger.pools['130']!.value=state.sp.ledger.pools['130']!.capacity;
      state.buffs['boss:4100']={id:4100,owner:'boss',source:'130',stacks:1,expires:100};
      state=profile.model.cast(state,'130:ultimate',0).state;
      for(let frame=0;frame<=1200;frame++)state=profile.model.advance(state,frame/60).state;
      return state;
    };
    const baseline=replay(false),extended=replay(true);
    const hits=(s:typeof baseline)=>Object.entries(s.hitCounts ?? {}).filter(([key])=>key.startsWith('130:')).reduce((n,[,count])=>n+count,0);
    expect(Number(extended.supportScripts!['130']!.extensions)).toBeGreaterThan(0);
    expect(hits(extended)).toBeGreaterThan(hits(baseline));
  });
  const perks=[21,22,23,24,25,26,27,28,29,30,31,32,33,41,42,43];
  for(let lb=0;lb<=5;lb++)it(`runs both complete support paths in a water party at breakthrough ${lb}`,()=>{
    const live={actors:[139,130,160].map(id=>({id,level:90,ascension:8,limitBreak:lb,
      potentials:id===139?{}:Object.fromEntries(perks.map(n=>{
        const perk=500000+id*100+n;return [perk,Math.min(6,(tables.potentials[perk] as any).MaxLevel)];
      })),skillSlots:{1:8,2:8,4:8,5:8}})),records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    const profile=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
    const result=evaluateCombatPolicies(profile.model,[{name:'ready',choose:(_s,legal)=>legal.find(key=>key.includes('ultimate'))??legal[0]??null}],180,60,profile.boss.switchRate)[0]!;
    expect(result.damage).toBeGreaterThan(0);
    expect(result.state.counts['drop:Item_130_B2P24_Letter:generated']).toBeGreaterThan(0);
    expect(result.state.counts['160:rotate']).toBeGreaterThan(0);
    expect(Object.entries(result.state.hitCounts ?? {}).filter(([key])=>key.endsWith(':160526001')).reduce((n,[,count])=>n+count,0)).toBeGreaterThan(0);
  });
  const run=(selected:number,perksToUse:number[],limitBreak:number)=>{
    const live={actors:[139,130,160].map(id=>({id,level:90,ascension:8,limitBreak:id===selected?limitBreak:0,
      potentials:{},skillSlots:{1:8,2:8,4:8,5:8}})),
      records:fixture.records,notes:{},badgeOptions:Array.from({length:9},()=>[0,0,0,0])};
    // Potential IDs use the native 513xxx / 516xxx namespace.
    live.actors.find(a=>a.id===selected)!.potentials=Object.fromEntries(perksToUse.map(n=>{
      const id=500000+selected*100+n;
      return [id,Math.min(6,(tables.potentials[id] as any).MaxLevel)];
    }));
    const p=createExampleCombatModel({...fixture,live},tables,{boss:29,distance:2,cinematics:true});
    return evaluateCombatPolicies(p.model,[{name:'ready',choose:(_s,legal)=>legal.find(key=>key.includes('ultimate'))??legal[0]??null}],180,60,p.boss.switchRate)[0]!;
  };
  for(const actor of [130,160]){
    for(const perk of perks)it(`${actor} P${perk} participates in the real 180s model`,()=>{
      const result=run(actor,[perk],0);
      expect(Number.isFinite(result.damage)).toBe(true);
      expect(result.state.counts[`${actor}:skill`]).toBeGreaterThan(0);
      if(actor===160&&[21,22,23].includes(perk))expect(result.state.counts[`160:${({21:'line',22:'rotate',23:'torrent'} as Record<number,string>)[perk]}`]).toBeGreaterThan(0);
    });
    for(let lb=0;lb<=5;lb++)it(`${actor} all support potentials with breakthrough ${lb}`,()=>{
      const result=run(actor,perks,lb);
      expect(result.damage).toBeGreaterThan(0);
      expect(result.state.counts[`${actor}:ultimate`]).toBeGreaterThan(0);
    });
  }
});
