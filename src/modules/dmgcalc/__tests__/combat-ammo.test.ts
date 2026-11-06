import {describe,it,expect} from 'vitest';
import {createCombatAmmo,combatAmmoMaximum,changeCombatAmmo,consumeCombatAmmo,finishCombatReload,combatReloadProgress} from '../core/combat-ammo';

describe('native ammunition and reload rules',()=>{
  it('amends capacity in native order and truncates only at integer boundaries',()=>{
    let state=createCombatAmmo(12,1.25);
    state=changeCombatAmmo(state,'max-base',2.9);
    state=changeCombatAmmo(state,'max-percent',.5);
    state=changeCombatAmmo(state,'max-absolute',1.9);
    expect(combatAmmoMaximum(state)).toBe(26);
    expect(state.value).toBe(15);
    expect(finishCombatReload(state).value).toBe(26);
  });
  it('does not confuse legacy max with effective capacity',()=>{
    const state=changeCombatAmmo(createCombatAmmo(12),'set-max-absolute',36);
    expect(state.legacyMax).toBe(36);
    expect(combatAmmoMaximum(state)).toBe(12);
  });
  it('does not refill on capacity changes or consume no-cost ammunition',()=>{
    let state=consumeCombatAmmo(createCombatAmmo(12),11);
    state=changeCombatAmmo(state,'max-base',-10);
    expect(state.value).toBe(1);
    expect(consumeCombatAmmo({...state,noCost:true},4).value).toBe(1);
    expect(consumeCombatAmmo(state,4).value).toBe(0);
    expect(state.value).toBe(1);
  });
  it('clamps percentage changes and preserves native per-change truncation',()=>{
    let state=changeCombatAmmo(createCombatAmmo(12),'set-percent',.49);
    expect(state.value).toBe(5);
    state=changeCombatAmmo(state,'percent',.49);
    expect(state.value).toBe(10);
    expect(changeCombatAmmo(state,'absolute',99).value).toBe(12);
  });
  it('refills once at anticipation completion, never at an interrupted earlier time',()=>{
    expect(combatReloadProgress(29/60,.5,false).finish).toBe(false);
    expect(combatReloadProgress(.5,.5,false)).toEqual({progress:1,finish:true});
    expect(combatReloadProgress(.6,.5,true).finish).toBe(false);
    expect(combatReloadProgress(0,0,false).finish).toBe(false);
    expect(combatReloadProgress(1/60,0,false).finish).toBe(true);
  });
});
