import {describe,it,expect} from 'vitest';
import {initialCombatProcs,runCombatProcs,type CombatProcContext,type CombatProcRule} from '../core/combat-procs';
import {kasimiraBreakthroughRules,reviewedBreakthroughRules,character116BreakthroughRules,character111BreakthroughRules} from '../core/combat-breakthrough-rules';
import {combatTagHash} from '../core/combat-tags';
import {readFileSync} from 'node:fs';
function setup() {
  const added:string[]=[],removed:string[]=[];
    const context:CombatProcContext={event:'own-hit',actor:'108',attacker:'108',target:'boss',main:'main',party:['108','main','support'],time:1,breakthrough:5,
    tags:[combatTagHash('108_Skill')],facts:{},parameter:id=>id===10896411?2:30,randomPercent:()=>20,
    buffs:{add:(owner,id)=>{added.push(`${owner}:${id}`);},remove:(owner,id)=>{removed.push(`${owner}:${id}`);},count:()=>1}};
  return {context,added,removed};
}
describe('shared character proc interpreter',()=>{
  it('uses native end events for 147 breakthroughs rather than prematurely granting them at cast time',()=>{
    const {context,added,removed}=setup();context.actor='147';context.attacker='147';
    context.event='own-ultimate-cast';
    runCombatProcs(reviewedBreakthroughRules[147]!,initialCombatProcs(),context);
    expect(added).not.toContain('147:14796211');
    expect(removed).not.toContain('147:14796311');
    context.event='own-ultimate-end';
    runCombatProcs(reviewedBreakthroughRules[147]!,initialCombatProcs(),context);
    expect(added).toContain('147:14796211');expect(removed).toContain('147:14796311');
    context.event='own-skill-end';runCombatProcs(reviewedBreakthroughRules[147]!,initialCombatProcs(),context);
    expect(added).toContain('147:14796511');
  });
  it('lets another party member trigger the native party-wide ultimate listener of 145',()=>{
    const {context,added}=setup();context.actor='145';context.attacker='107';context.event='party-ultimate-cast';
    runCombatProcs(reviewedBreakthroughRules[145]!,initialCombatProcs(),context);
    expect(added).toContain('145:14596211');
  });
  it.each(Object.entries(reviewedBreakthroughRules))('profile %s has explicit mappings for all five breakthroughs and valid effect references',(id,rules)=>{
    const buffs=JSON.parse(readFileSync('public/data/Buff.json','utf8'));
    const once=JSON.parse(readFileSync('public/data/OnceAdditionalAttribute.json','utf8'));
    expect([...new Set(rules.map(rule=>rule.breakthrough))].sort()).toEqual([1,2,3,4,5]);
    for (const rule of rules) for (const effect of rule.effects) {
      expect((effect.kind==='once' ? once : buffs)[effect.id],`${id}/${rule.id}/${effect.id}`).toBeDefined();
    }
  });
  it('reuses all five breakthrough rules with independent clocks and replay-safe state',()=>{
    const {context,added,removed}=setup(), original=initialCombatProcs();
    let result=runCombatProcs(kasimiraBreakthroughRules,original,context);
    expect(added).toContain('108:10896411');
    expect(added.filter(item=>item.endsWith(':10896311'))).toHaveLength(3);
    expect(original.last).toEqual({});
    context.time=3;
    added.length=0;
    result=runCombatProcs(kasimiraBreakthroughRules,result.state,context);
    expect(added).not.toContain('108:10896411');
    context.time=3.01;
    result=runCombatProcs(kasimiraBreakthroughRules,result.state,context);
    expect(added).toContain('108:10896411');
    context.event='before-own-hit';
    expect(runCombatProcs(kasimiraBreakthroughRules,result.state,context).once).toEqual([{id:10896211,count:1,source:'108'}]);
    context.event='other-ultimate';
    runCombatProcs(kasimiraBreakthroughRules,result.state,context);
    expect(added).toContain('108:10896511');
    context.event='own-ultimate-end';
    runCombatProcs(kasimiraBreakthroughRules,result.state,context);
    expect(removed).toEqual(['108:10896511']);
  });
  it('distinguishes strict and inclusive random thresholds and keeps counters per rule',()=>{
    const {context,added}=setup();
    context.randomPercent=()=>30;
    const rules:CombatProcRule[]=[{id:'a',event:'own-hit',probability:{percent:30,inclusive:false},effects:[{kind:'add-buff',id:1}]},
      {id:'b',event:'own-hit',probability:{percent:30},every:2,effects:[{kind:'add-buff',id:2,recipient:'main'}]}];
    let result=runCombatProcs(rules,initialCombatProcs(),context);
    expect(added).toEqual([]);
    result=runCombatProcs(rules,result.state,context);
    expect(added).toEqual(['main:2']);
    expect(result.state.counters.b).toBe(0);
  });
  it('tracks targets independently and resets only at the specified cast event',()=>{
    const {context,added}=setup();
    const rules:CombatProcRule[]=[{id:'unique',event:'own-hit',uniqueBy:'target',resetOn:'own-ultimate-cast',effects:[{kind:'add-buff',id:3}]}];
    let state=initialCombatProcs();
    state=runCombatProcs(rules,state,context).state;
    state=runCombatProcs(rules,state,context).state;
    expect(added).toHaveLength(1);
    context.target='other';
    state=runCombatProcs(rules,state,context).state;
    expect(added).toHaveLength(2);
    context.event='own-ultimate-cast';
    state=runCombatProcs(rules,state,context).state;
    context.event='own-hit';
    runCombatProcs(rules,state,context);
    expect(added).toHaveLength(3);
  });
  it('counts all party ultimate hits, and grants the twentieth-hit effect only once per group',()=>{
    const {context,added}=setup();
    context.actor='116';context.event='party-hit';context.facts={slot:4};
    let state=initialCombatProcs();
    for(let n=0;n<19;n++) state=runCombatProcs(character116BreakthroughRules,state,context).state;
    expect(added).toHaveLength(0);
    state=runCombatProcs(character116BreakthroughRules,state,context).state;
    expect(added).toHaveLength(3);
    expect(state.counters['116:lb3']).toBe(0);
  });
  it('uses the original strict probability boundary and refuses absent conditional facts',()=>{
    const {context,added}=setup();
    context.actor='111';context.tags=[combatTagHash('Skill')];context.parameter=()=>30;context.randomPercent=()=>30;
    runCombatProcs(character111BreakthroughRules,initialCombatProcs(),context);
    expect(added).toHaveLength(0);
    context.randomPercent=()=>29.99;
    runCombatProcs(character111BreakthroughRules,initialCombatProcs(),context);
    expect(added).toHaveLength(3);
    context.event='before-own-hit';
    expect(()=>runCombatProcs(character111BreakthroughRules,initialCombatProcs(),context)).toThrow(/Missing proc fact/);
  });
  it('uses the native attribute source rather than the owner of a party-wide listener',()=>{
    const {context}=setup();
    context.actor='126';context.attacker=context.main;context.event='before-party-hit';context.facts={mainHpFraction:0.5};
    expect(runCombatProcs(reviewedBreakthroughRules[126]!,initialCombatProcs(),context).once)
      .toEqual([{id:12696211,count:1,source:'main'}]);
    context.facts.mainHpFraction=0.4999;
    expect(runCombatProcs(reviewedBreakthroughRules[126]!,initialCombatProcs(),context).once).toEqual([]);
    context.actor='127';context.attacker='support';context.event='before-other-party-hit';context.facts={waterMark1OrColdOrFrozen:true};
    expect(runCombatProcs(reviewedBreakthroughRules[127]!,initialCombatProcs(),context).once)
      .toEqual([{id:12796111,count:1,source:'support'}]);
    context.event='before-own-hit';
    expect(runCombatProcs(reviewedBreakthroughRules[127]!,initialCombatProcs(),context).once)
      .toEqual([{id:12796111,count:1,source:'127'}]);
  });
  it('refuses to choose an arbitrary source from a group for a once attribute',()=>{
    const {context}=setup();
    expect(()=>runCombatProcs([{id:'bad-source',event:'own-hit',effects:[{kind:'once',id:1,source:'party'}]}],initialCombatProcs(),context))
      .toThrow(/exactly one source/);
  });
  it('covers the released roster without synthesizing rules from numeric prefixes',()=>{
    const characters=JSON.parse(readFileSync('public/data/Character.json','utf8'));
    const released=Object.values(characters).filter((c:any)=>c.Visible && c.Available).map((c:any)=>c.Id).sort((a,b)=>a-b);
    expect(Object.keys(reviewedBreakthroughRules).map(Number).sort((a,b)=>a-b)).toEqual(released);
  });
  it('keeps accumulated skill hits through cooldown, then resets only on a successful cast proc',()=>{
    const {context,added}=setup();
    context.actor='133';context.tags=[combatTagHash('133_TalentSkill')];context.parameter=id=>id===13396212 ? 2 : 5;
    let state=initialCombatProcs();
    for(let n=0;n<2;n++) state=runCombatProcs(reviewedBreakthroughRules[133]!,state,context).state;
    context.event='own-skill-cast';
    state=runCombatProcs(reviewedBreakthroughRules[133]!,state,context).state;
    expect(added).toContain('133:13396211');
    expect(state.counters['133:skill-hits']).toBe(0);
    context.event='own-hit';context.time=2;
    for(let n=0;n<3;n++) state=runCombatProcs(reviewedBreakthroughRules[133]!,state,context).state;
    context.event='own-skill-cast';context.time=6;
    state=runCombatProcs(reviewedBreakthroughRules[133]!,state,context).state;
    expect(state.counters['133:skill-hits']).toBe(3);
    context.time=6.01;
    state=runCombatProcs(reviewedBreakthroughRules[133]!,state,context).state;
    expect(state.counters['133:skill-hits']).toBe(0);
    expect(added.filter(x=>x==='133:13396211')).toHaveLength(2);
  });
});
