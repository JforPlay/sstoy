/** AmmoEntry / AmmoInfo / ActorAttackReloadState, from the active client.
 * Value changes clamp to the amended maximum; changes to that maximum do not
 * retroactively change the stored value. SET_MAX_* affects the unused legacy
 * Max field, not AmendMax (AmmoInfo.useValued is false in this client). */
export interface CombatAmmoState {
  origin:number;baseAmend:number;percentAmend:number;absoluteAmend:number;
  legacyMax:number;value:number;noCost:boolean;reloadEnabled:boolean;
}
export type CombatAmmoChange='max-base'|'max-percent'|'max-absolute'|'set-max-percent'|'set-max-absolute'
  |'percent'|'absolute'|'set-percent'|'set-absolute';
export const combatAmmoMaximum=(state:CombatAmmoState)=>Math.max(0,
  Math.trunc((state.origin+state.baseAmend)*(1+state.percentAmend)+state.absoluteAmend));
export function createCombatAmmo(origin:number,ratio=1):CombatAmmoState {
  if(!Number.isInteger(origin)||origin<0||!Number.isFinite(ratio)||ratio<0) throw new Error('Invalid ammunition capacity');
  const maximum=Math.trunc(origin*ratio);
  return {origin:maximum,legacyMax:maximum,value:maximum,baseAmend:0,percentAmend:0,absoluteAmend:0,noCost:false,reloadEnabled:true};
}
export function changeCombatAmmo(state:CombatAmmoState,kind:CombatAmmoChange,value:number):CombatAmmoState {
  if(!Number.isFinite(value)) throw new Error('Invalid ammunition change');
  const next={...state},maximum=combatAmmoMaximum(state);
  switch(kind) {
    case 'max-base':next.baseAmend+=Math.trunc(value);break;
    case 'max-percent':next.percentAmend+=value;break;
    case 'max-absolute':next.absoluteAmend+=Math.trunc(value);break;
    case 'set-max-percent':next.legacyMax=Math.trunc(next.legacyMax*value);break;
    case 'set-max-absolute':next.legacyMax=Math.trunc(value);break;
    case 'percent':next.value+=Math.trunc(maximum*value);break;
    case 'absolute':next.value+=Math.trunc(value);break;
    case 'set-percent':next.value=Math.trunc(maximum*value);break;
    case 'set-absolute':next.value=Math.trunc(value);break;
    default:throw new Error(`Unknown ammunition change ${kind}`);
  }
  if(['percent','absolute','set-percent','set-absolute'].includes(kind)) next.value=Math.max(0,Math.min(maximum,next.value));
  return next;
}
export function consumeCombatAmmo(state:CombatAmmoState,count=1):CombatAmmoState {
  if(!Number.isInteger(count)||count<0) throw new Error('Invalid ammunition cost');
  return state.noCost?state:changeCombatAmmo(state,'absolute',-count);
}
export function finishCombatReload(state:CombatAmmoState):CombatAmmoState {
  return changeCombatAmmo(state,'set-absolute',combatAmmoMaximum(state));
}
/** Native reload completion uses anticipation / runtime play speed. Recovery
 * is interruptible only after the ammo-refill event; an earlier interruption
 * does not refill. Times are fixed-logic quantized, not wall-clock timers. */
export function combatReloadProgress(elapsed:number,anticipation:number,completed:boolean,fps=60) {
  if(![elapsed,anticipation,fps].every(Number.isFinite)||elapsed<0||anticipation<0||fps<=0) throw new Error('Invalid reload timing');
  const completionTick=Math.ceil((anticipation-1e-9)*fps);
  const elapsedTick=Math.round(elapsed*fps);
  const finish=!completed && elapsedTick>=Math.max(1,completionTick);
  return {progress:anticipation>0?Math.max(0,Math.min(1,elapsed/anticipation)):1,finish};
}
