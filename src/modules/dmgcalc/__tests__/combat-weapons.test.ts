import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planCombatWeapon, planCombatAreaBuffs, type ExtractedCombatWeapon } from '../core/combat-weapons';
const data = JSON.parse(readFileSync('public/data/CombatTimings.json', 'utf8'));
const weapons: ExtractedCombatWeapon[] = data.characters.flatMap((character: any) => character.weapons);
const weapon = (name: string) => weapons.find(weapon => weapon.name === name)!;
describe('extracted projectile and area timing', () => {
  it('retains a thrown tank shell finish explosion rather than only its non-damaging arrival hit',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/140.json','utf8'));
    const thrown=data.weapons.find((weapon:ExtractedCombatWeapon)=>weapon.name==='Bullet_140_Tank_Attack');
    const plan=planCombatWeapon(thrown,2,60,undefined,data.weapons,{Combat_MinJumpDuration:.1});
    expect(plan.finishArea).toBe('AreaEffect_14001_Tank_Attack_Boom');
    expect(()=>planCombatWeapon(thrown,2,60,undefined,[],{Combat_MinJumpDuration:.1})).toThrow(/Missing thrown-projectile finish area/);
  });
  it('retains a bezier bubble finish explosion after its native flight delay',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/157.json','utf8'));
    const bubble=data.weapons.find((w:ExtractedCombatWeapon)=>w.name==='Bullet_157_P42_ShuiPao');
    const plan=planCombatWeapon(bubble,2,60,undefined,data.weapons);
    expect(plan.finishArea).toBe('Bullet_157_P42_ShuiPao_Boom');
    expect(plan.duration).toBeGreaterThan(0);
    expect(plan.impacts[0]!.time).toBe(plan.duration);
    expect(()=>planCombatWeapon(bubble,2,60,undefined,[])).toThrow(/Missing bezier finish area/);
  });
  it('rechecks moving-area overlap for periodic buffs, entry, exit and cancellation cleanup',()=>{
    const owner={id:'owner',player:true,main:true,element:5,summoner:null,minion:false};
    const boss={id:'boss',player:false,main:false,element:4,monsterEpic:7,summoner:null,minion:false};
    const criteria={filterCriteriaList:[{targetType:16,elementType:254,monsterEpicType:30,operationType:0}],operationType:0};
    const area:ExtractedCombatWeapon={name:'moving',pathId:'1',components:[{type:'AreaEffectEntity',data:{duration:3}},
      {type:'AreaEffect_BuffComponent',data:{executeImmediately:true,addInterval:.5,removeInterval:0,addBuffIdList:[1],
        triggerEnter:true,addCriteriaInfo:criteria,triggerEnterCriteriaInfo:criteria}},
      {type:'AreaEffect_BuffComponent',data:{executeImmediately:false,addInterval:0,removeInterval:0,removeBuffIdList:[1],
        triggerExit:true,triggerExitCriteriaInfo:criteria}}]};
    const plan=planCombatAreaBuffs(area,60,{owner,candidates:[owner,boss],
      context:{actors:[owner,boss],relation:(_from,to)=>to==='boss'?'enemy':'friend'},moving:true,
      contains:(id,time)=>id==='boss' && ((time>=.75&&time<1.75)||(time>=2.75))});
    expect(plan.filter(change=>!change.tracking&&change.add.length).map(change=>change.time)).toEqual([.75,1,1.5,2.75]);
    expect(plan.filter(change=>!change.tracking&&change.remove.length).map(change=>change.time)).toEqual([1.75,3]);
    expect(plan.filter(change=>change.tracking).map(change=>[change.time,change.tracking,change.exitKey]))
      .toEqual([[.75,'enter','1:boss'],[1.75,'exit','1:boss'],[2.75,'enter','1:boss'],[3,'exit','1:boss']]);
  });
  it('rebounds through the main without awarding friendly-hit damage or spending a free main rebound',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/147.json','utf8'));
    const following=data.weapons.find((weapon:ExtractedCombatWeapon)=>weapon.name==='Bullet_147_Sup_YinBo_P23');
    const plan=planCombatWeapon(following,2,60,undefined,[],{SingleEnemyMainRebound:1});
    expect(plan.impacts).toHaveLength(3);
    expect(plan.impacts.map(hit=>hit.time)).toEqual([.2,.2+2*(.2+1/60),.2+4*(.2+1/60)]);
    expect(planCombatWeapon(following,10,60,undefined,[],{SingleEnemyMainRebound:1}).impacts).toHaveLength(1);
    expect(()=>planCombatWeapon(following,2,60)).toThrow(/rebound/);
  });
  it('uses the shared minimum jump time or the native per-projectile override for thrown projectiles',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/156.json','utf8'));
    const thrown=data.weapons.find((w:ExtractedCombatWeapon)=>w.name==='Bullet_156_Sup_Skill_PenguinStatueCalling_Fly');
    const plan=planCombatWeapon(thrown,0,60,undefined,[],{Combat_MinJumpDuration:.10000000149});
    expect(plan.duration).toBeCloseTo(7/60);
    expect(planCombatWeapon(thrown,10,60,undefined,[],{Combat_MinJumpDuration:.10000000149}).duration).toBe(.5);
    expect(()=>planCombatWeapon(thrown,0,60)).toThrow(/Combat_MinJumpDuration/);
  });
  it('finishes a non-rebounding following projectile at its target rather than its maximum life',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/156.json','utf8'));
    const following=data.weapons.find((w:ExtractedCombatWeapon)=>w.name==='Bullet_156_Sup_Skill_HeartArrow');
    const plan=planCombatWeapon(following,3,60);
    expect(plan.duration).toBeCloseTo(.2);
    expect(plan.impacts[0]!.time).toBeCloseTo(.2);
    expect(planCombatWeapon(following,30,60).impacts).toHaveLength(0);
  });
  it('waits for the configured Bezier flight and its arrival update, not distance divided by a guessed speed',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/132.json','utf8'));
    const curve=data.weapons.find((weapon:ExtractedCombatWeapon)=>weapon.name==='Bullet_132_Support_P28_1');
    const plan=planCombatWeapon(curve,2,60);
    expect(plan.duration).toBeCloseTo(26/60);
    expect(plan.impacts[0]!.hitId).toBe(132528001);
    expect(plan.impacts[0]!.time).toBe(plan.duration);
    expect(planCombatWeapon(curve,20,60).duration).toBe(plan.duration);
  });
  it('keeps repeating marks, enter debuffs, and exit cleanup as distinct area events', () => {
    const area = weapon('AreaEffect_107_Support_Skill_P21_LightTag');
    const plan = planCombatAreaBuffs(area,60);
    expect(plan.filter(change=>change.add.includes(3011)).map(change=>change.time)).toEqual([0,1,2,3,4,5,6,7]);
    expect(plan.filter(change=>change.add.includes(10721011)).map(change=>change.time)).toEqual([0]);
    expect(plan.filter(change=>change.remove.includes(10721011)).map(change=>change.time)).toEqual([8]);
  });
  it('waits for both the bomb timer and separate explosion delay', () => {
    const kasimira = JSON.parse(readFileSync('public/data/combat/108.json', 'utf8'));
    const bomb = kasimira.weapons.find((weapon: ExtractedCombatWeapon) => weapon.name === 'Bullet_108_B2_Skill');
    const plan = planCombatWeapon(bomb, 2, 60);
    expect(plan.duration).toBeCloseTo(1 + 1 / 60);
    expect(plan.impacts[0]!.time).toBe(plan.duration);
    expect(plan.impacts[0]!.hitId).toBe(108320001);
  });
  it('uses the shared target filter for explicit friendly area collision candidates',()=>{
    const main={id:'main',player:true,main:true,element:5,summoner:null,minion:false};
    const support={...main,id:'support',main:false,element:2};
    const boss={id:'boss',player:false,main:false,element:4,monsterEpic:7,summoner:null,minion:false};
    const actors=[main,support,boss];
    const area:ExtractedCombatWeapon={name:'friendly-area',pathId:'1',components:[
      {type:'AreaEffectEntity',data:{duration:3}},
      {type:'AreaEffect_BuffComponent',data:{addBuffIdList:[1],addInterval:1,removeInterval:0,executeImmediately:true,
        addCriteriaInfo:{filterCriteriaList:[{targetType:8,elementType:32,monsterEpicType:30,operationType:0}],operationType:0}}},
    ]};
    const plan=planCombatAreaBuffs(area,60,{owner:support,candidates:actors,context:{actors,relation:(_from,to)=>to==='boss' ? 'enemy' : 'friend'}});
    expect(plan).toEqual([0,1,2].map(time=>({time,add:[1],remove:[],target:'main'})));
    expect(()=>planCombatAreaBuffs(area,60)).toThrow(/target filter/);
  });
  it('the ten flying blades travel thirty units at their actual speed of one hundred', () => {
    const plan = planCombatWeapon(weapon('Bullet_11501_Support_Skill_Fly_Blade_P22_Strengthen'), 30, 60);
    expect(plan.impacts[0]!.time).toBe(.3);
    expect(plan.impacts[0]!.hitId).toBe(115120005);
    expect(plan.snapshot).toBe(true);
  });
  it('sword hit IDs are assigned by the character script, not zero from the prefab', () => {
    const plan = planCombatWeapon(weapon('Bullet_162_JianQi_Heng'), 2, 60, 162310005);
    expect(plan.impacts[0]!.hitId).toBe(162310005);
    expect(plan.duration).toBe(1);
  });
  it('does not count a projectile hit after its lifetime', () => {
    expect(planCombatWeapon(weapon('Bullet_162_JianQi_Heng'), 100, 60, 162310005).impacts).toHaveLength(0);
  });
  it('respects the original delayed ground strike and its independent lifetime', () => {
    const plan = planCombatWeapon(weapon('AreaEffect_162_LeiDianZhongJian_Fall_Skil_Main'), 0, 60);
    expect(plan.impacts).toHaveLength(1);
    expect(plan.impacts[0]!.time).toBeCloseTo(19 / 60);
    expect(plan.impacts[0]!.hitId).toBe(162310008);
  });
});
