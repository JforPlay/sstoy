import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { combatTagHash } from '../core/combat-tags';
import { createHotaruRules, type HotaruScriptApi } from '../core/combat-hotaru';
import { createTiliaRules, type TiliaScriptApi } from '../core/combat-tilia';
import { addCombatBuff, combatBuffCount, removeCombatBuff, type CombatBuffState } from '../core/combat-buffs';
const rows = JSON.parse(readFileSync('public/data/BuffValue.json', 'utf8'));
describe('selected support character scripts', () => {
  it('routes each of Tilia breakthrough 1–5 to its actual event and recipient', () => {
    const added: [string, number, string?][] = [];
    const buffs = { add(owner: string, id: number, source?: string) { added.push([owner, id, source]); }, remove() {}, count() { return 0; } };
    const api: TiliaScriptApi = { time: 0, actor: 'tilia', main: 'main', buffs, parameter: () => 0, reduceSupportCooldown() {}, area() {}, projectile() {} };
    const rules = createTiliaRules({}, 5, ['main', 'hotaru', 'tilia']);
    rules.initialize(api);
    expect(added.filter(([, id]) => id === 10796511)).toHaveLength(3);
    rules.onMainUltimate(api);
    rules.onMarkedTargetHit(api, 'hotaru');
    rules.onOwnMarkApplied(buffs, 'tilia');
    rules.onLightMarkTriggered(api);
    expect(added).toContainEqual(['main', 10796211, 'tilia']);
    expect(added).toContainEqual(['hotaru', 10796111, 'tilia']);
    expect(added.filter(([, id]) => id === 10796311)).toHaveLength(3);
    expect(added).toContainEqual(['main', 10796411, 'tilia']);
  });
  it('hashes native damage tags identically to recovered table IDs', () => {
    expect(combatTagHash('162LightMarkTrigger')).toBe(-1219492980);
    expect(combatTagHash('115_P26')).toBe(-393780534);
  });
  it('does not grant Hotaru full-light volley or normal-attack variants to a mixed-element party',()=>{
    const rules=createHotaruRules({511521:1,511523:1},3012);
    expect(rules.flyingPattern(true,false)).toMatchObject({count:6,interval:.15});
    expect(rules.normalTag(0,false)).toBe('Support_Blade_Attack_1');
    expect(rules.normalTag(0,true)).toBe('Support_Blade_StrengthenAttack_1');
    expect(rules.areaTag(false)).toBe('Support_Blade_Skill');
  });
  it('carries stored mark counts into the next Hotaru stance and launches the eighth-normal extra skill',()=>{
    const rules=createHotaruRules({511524:1,511525:6,511528:6,511532:6},3012);
    let store:CombatBuffState={};let areas=0;
    const api:HotaruScriptApi={time:0,actor:'hotaru',party:['main','hotaru','fire'],lightActors:['main','hotaru'],mainLight:true,
      parameter:()=>1,flyingBatch(){},projectile(){},area(){},areaAttack(){areas++;},resetSupportCooldown(){},buffs:{
        add(owner,id,source=owner){store=addCombatBuff(store,rows[id],owner,source,api.time);},
        remove(owner,id){store=removeCombatBuff(store,owner,id);},count(owner,id){return combatBuffCount(store,owner,id,api.time);},
      }};
    let state=rules.initialize(api);
    rules.onMainMark(api,2,false);rules.onMainMark(api,1,false);
    expect(api.buffs.count('hotaru',11525011)).toBe(1);
    expect(api.buffs.count('hotaru',11525014)).toBe(2);
    state=rules.castSkill(state,api);
    expect(api.buffs.count('hotaru',11525013)).toBe(1);
    expect(api.buffs.count('hotaru',11525015)).toBe(2);
    expect(api.buffs.count('hotaru',11525014)).toBe(0);
    expect(api.buffs.count('fire',11532011)).toBe(0);
    state=rules.enterStance(state,api);
    for(let n=0;n<7;n++) state=rules.custom(state,api,'115_SupportAttack');
    expect(areas).toBe(0);
    state=rules.custom(state,api,'115_SupportAttack');
    expect(areas).toBe(1);expect(state.normalHits).toBe(0);
    api.time=1+1/60;state=rules.tick(state,api);
    expect(api.buffs.count('hotaru',11528011)).toBe(1);
    rules.leave(state,api);
    expect(api.buffs.count('hotaru',11525013)).toBe(0);
  });
  it('Hotaru retains team field bonus during ultimate and resets support CD at its end', () => {
    const rules = createHotaruRules({ 511521: 1, 511522: 1, 511526: 6, 511527: 1, 511531: 2, 511533: 6 }, 3012);
    let store: CombatBuffState = {};
    let resets = 0;
    const api: HotaruScriptApi = { time: 0, actor: 'hotaru', party: ['main', 'hotaru', 'tilia'], parameter: () => 3,
      flyingBatch() {}, projectile() {}, area() {}, shield() {}, resetSupportCooldown() { resets++; }, buffs: {
        add(owner, id, source = owner) { store = addCombatBuff(store, rows[id], owner, source, api.time); },
        remove(owner, id) { store = removeCombatBuff(store, owner, id); },
        count(owner, id) { return combatBuffCount(store, owner, id, api.time); },
      } };
    let state = rules.initialize(api);
    state = rules.enterField(state, api);
    state = rules.enterStance(state, api);
    expect(state.stanceUntil).toBe(16);
    state = rules.ultimate(state, api);
    expect(state.stanceUntil).toBe(0);
    expect(api.buffs.count('main', 11533012)).toBe(1);
    expect(resets).toBe(0);
    state = rules.ultimateEnd(state, api);
    expect(api.buffs.count('main', 11533012)).toBe(0);
    expect(resets).toBe(1);
    expect(state.onField).toBe(false);
    expect(rules.flyingPattern(true)).toMatchObject({ count: 10, interval: .1, delay: 1.3 });
  });
  it('Tilia bounces four times to main and three to boss, with capped per-cast CD reduction', () => {
    const rules = createTiliaRules({ 510722: 1, 510723: 1, 510725: 6, 510730: 1, 510733: 2, 510742: 2 });
    let reduced = 0;
    const api: TiliaScriptApi = { time: 1, actor: 'tilia', main: 'main',
      parameter: id => id === 10722012 ? 3 : id === 10722011 ? 1 : id === 10730001 ? 50 : 2,
      area() {}, projectile() {}, buffs: { add() {}, remove() {}, count() { return 0; } },
      reduceSupportCooldown(value) { reduced += value; },
    };
    let state = rules.initialize(api);
    expect(rules.shieldTargets()).toEqual(['main', 'boss', 'main', 'boss', 'main', 'boss', 'main']);
    for (const target of rules.shieldTargets()) state = rules.shieldHit(state, api, target, 1, true);
    expect(reduced).toBe(3);
    rules.shieldHit(state, api, 'boss', 1, true);
    expect(reduced).toBe(3);
    state = rules.castSkill(state);
    rules.shieldHit(state, api, 'boss', 1, true);
    expect(reduced).toBe(4);
  });
});
