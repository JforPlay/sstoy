import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {planStraightCombatProjectile} from '../core/combat-projectile-path';
import {planCombatProjectileGeneration} from '../core/combat-projectile-generation';
const data=JSON.parse(readFileSync('public/data/combat/157.json','utf8'));
describe('native intermittent projectile areas',()=>{
  it('uses the serialized delay, interval, projectile position and binding',()=>{
    const fish=data.weapons.find((weapon:any)=>weapon.name==='Bullet_157_Skill_Sup_Fish1_P25');
    const path=planStraightCombatProjectile(fish,{x:0,z:0},{x:1,z:0},[]);
    const generated=planCombatProjectileGeneration(fish,data.weapons,path.duration,path.positionAt);
    expect(generated.map(area=>Math.round(area.time*60))).toEqual([7,26]);
    expect(generated[0]!.position.x).toBeCloseTo(2);
    expect(generated.every(area=>area.bound)).toBe(true);
    expect(generated.every(area=>data.weapons.some((weapon:any)=>weapon.name===area.name))).toBe(true);
  });
});
