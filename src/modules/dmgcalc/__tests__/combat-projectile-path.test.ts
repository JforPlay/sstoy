import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {planStraightCombatProjectile} from '../core/combat-projectile-path';
const data=JSON.parse(readFileSync('public/data/combat/127.json','utf8'));
const weapon=data.weapons.find((weapon:any)=>weapon.name==='Bullet_127_Ultra_Branch');
describe('native directional projectile geometry',()=>{
  it('stops a nonpenetrating bullet at its first enemy, never at a friendly contact',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/143.json','utf8'));
    const bullet=data.weapons.find((weapon:any)=>weapon.name==='Bullet_143_SkillMain_Base');
    const plan=planStraightCombatProjectile(bullet,{x:0,z:0},{x:1,z:0},[
      {id:'friend',position:{x:0,z:0},friendly:true},{id:'boss',position:{x:3,z:0}}]);
    expect(plan.hits.map(hit=>hit.target)).toEqual(['boss']);
    expect(plan.duration).toBe(plan.hits[0]!.time);
    expect(plan.duration).toBeGreaterThan(1/60);
    expect(plan.duration).toBeLessThan(1);
    expect(plan.positionAt(plan.duration)).toEqual(plan.end);
  });
  it('turns toward the stationary boss during the native trace window and decelerates',()=>{
    const data=JSON.parse(readFileSync('public/data/combat/145.json','utf8'));
    const umbrella=data.weapons.find((weapon:any)=>weapon.name==='Bullet_145_Ultra_HuaSan_Out');
    const boss={x:0,z:4};
    const path=planStraightCombatProjectile(umbrella,{x:0,z:0},{x:1,z:0},[{id:'boss',position:boss}],60,{},boss);
    expect(path.positionAt(.3).z).toBeGreaterThan(1);
    const first=path.positionAt(1),next=path.positionAt(1+1/60);
    expect(Math.hypot(next.x-first.x,next.z-first.z)).toBeCloseTo(1/60);
  });
  it('sweeps the actual collider along a non-range projectile path instead of guaranteeing a target hit',()=>{
    const fishData=JSON.parse(readFileSync('public/data/combat/157.json','utf8'));
    const fish=fishData.weapons.find((weapon:any)=>weapon.name==='Bullet_157_Skill_Sup_Fish1');
    const plan=planStraightCombatProjectile(fish,{x:3,z:5},{x:0,z:-1},[
      {id:'contact',position:{x:3,z:0}},{id:'miss',position:{x:0,z:0}}]);
    expect(plan.hits.map(hit=>hit.target)).toEqual(['contact']);
    expect(plan.hits[0]!.time).toBeCloseTo(8/60);
  });
  it('uses the strict native per-target immunity clock for repeated overlap',()=>{
    const slow={...weapon,components:weapon.components.map((component:any)=>component.type==='AdventureBullet'
      ?{...component,data:{...component.data,shape:1,moveSpeed:0,lifeTime:2,damageImmuneDuration:.5}}:component)};
    const plan=planStraightCombatProjectile(slow,{x:0,z:0},{x:1,z:0},[{id:'boss',position:{x:0,z:0}}]);
    expect(plan.hits.map(hit=>Math.round(hit.time*60))).toEqual([1,32,63,94]);
  });
  it('uses the native wide rectangle of the sideways branch and preserves its finish position',()=>{
    const plan=planStraightCombatProjectile(weapon,{x:7.8,z:0},{x:0,z:1},[{id:'boss',position:{x:2,z:0}},{id:'main',position:{x:0,z:0}}]);
    expect(plan.hits.map(hit=>hit.target)).toEqual(['boss']);
    expect(plan.buffContacts.map(hit=>hit.target)).toEqual(['boss']);
    expect(plan.end.x).toBe(7.8);
    expect(plan.end.z).toBeCloseTo(7.8);
  });
  it('keeps a buff-trigger box separate from a circular damage shape',()=>{
    const circular={...weapon,components:weapon.components.map((component:any)=>component.type==='AdventureBullet'?{...component,data:{...component.data,shape:1}}:component)};
    const plan=planStraightCombatProjectile(circular,{x:7.8,z:0},{x:0,z:1},[{id:'near',position:{x:7.8,z:1}},{id:'wide',position:{x:2,z:1}}]);
    expect(plan.hits.map(hit=>hit.target)).toEqual(['near']);
    expect(plan.buffContacts.map(hit=>hit.target)).toEqual(['near','wide']);
  });
});
