import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {createSupport133} from '../core/combat-support-133';
import {planCombatWeapon,type ExtractedCombatWeapon} from '../core/combat-weapons';
import type {SupportCombatApi} from '../core/combat-support-adapter';
const data=JSON.parse(readFileSync('public/data/combat/133.json','utf8'));
function fixture(){
  return {actor:'133',main:'wind-main',party:['wind-main','133','other'],time:0,
    actorsByElement:()=>[],actorInfo:()=>({element:4,job:1}),
    buffs:{add:vi.fn(),remove:vi.fn(),count:()=>0},schedule:vi.fn(),stopAreasByTag:vi.fn(),
    entityData:()=>data.entities.find((entity:any)=>entity.type==='FlowerEntity').data,
    weaponName:(path:string)=>data.weapons.find((weapon:ExtractedCombatWeapon)=>weapon.pathId===path).name,
    projectile:vi.fn(),area:vi.fn(),
  } as unknown as SupportCombatApi;
}
describe('133 flower serialized timings and shared area limits',()=>{
  it('uses the installed prefab values and quantizes each coroutine wait separately',()=>{
    const api=fixture(),rules=createSupport133({513321:1});
    let state=rules.cast!(rules.initialize(api),api,'skill');
    state=rules.event!(state,api,'flower-group',{flowerGeneration:state.flowerGeneration});
    const shots=vi.mocked(api.schedule).mock.calls.filter(([name])=>name==='flower-shot');
    expect(shots).toHaveLength(6);
    expect(shots[0]![1]).toBeCloseTo(49/60);
    expect(shots[1]![1]).toBeCloseTo(74/60);
    expect(shots[5]![1]).toBeCloseTo(174/60);
    expect(shots[0]![2]!.projectile).toBe('Bullet_13301_Skill2_Petal_Perk21_Bezier1');
    expect(state.flowers).toBe(1);
  });
  it('keeps the group interval paused between complete batches and does not cancel launched flower shots',()=>{
    const api=fixture(),rules=createSupport133({513321:1});
    let state=rules.cast!(rules.initialize(api),api,'skill');
    for(let n=0;n<3;n++)state=rules.event!(state,api,'flower-group',{flowerGeneration:state.flowerGeneration});
    expect(state.groupsLeft).toBe(0);
    api.time=12;state=rules.cast!(state,api,'skill');
    expect(vi.mocked(api.schedule).mock.calls.at(-1)![1]).toBe(2.5);
    rules.event!(state,api,'flower-shot',{projectile:'Bullet_13301_Skill2_Petal_Perk21_Bezier1'});
    expect(api.projectile).toHaveBeenCalledWith('Bullet_13301_Skill2_Petal_Perk21_Bezier1');
  });
  it('exports the native shared immunity group instead of treating overlapping regions as independent damage',()=>{
    const weapon=data.weapons.find((weapon:ExtractedCombatWeapon)=>weapon.name==='AreaEffect_13301_PetalRegion');
    const plan=planCombatWeapon(weapon,2,60);
    expect(plan.impacts.length).toBeGreaterThan(0);
    expect(plan.impacts[0]!.sharedImmunity?.group).toBe(735097488);
  });
  it('requires explicit first-contact handling for a 3D guided shot and waits for the native flight phase',()=>{
    const weapon=data.weapons.find((weapon:ExtractedCombatWeapon)=>weapon.name==='Bullet_13301_Skill2_Petal_Perk21_Bezier1');
    expect(()=>planCombatWeapon(weapon,2,60)).toThrow(/first-contact/);
    const plan=planCombatWeapon(weapon,2,60,undefined,[],{AssumeBezier3DFirstContact:1});
    expect(plan.impacts[0]!.time).toBeCloseTo(17/60);
  });
});
