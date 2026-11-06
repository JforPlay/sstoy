import type {CombatCooldownChange} from './combat-effects';
/** PlayerSkillCd.GetCurrentSectionResumeTime: slot modifiers add to a
 * multiplicative origin of one; the native lower bound is half script time. */
export function resolveCombatCooldown(seconds:number,slot:number,changes:readonly CombatCooldownChange[]):number{
  if(!Number.isFinite(seconds)||seconds<0)throw new Error('Invalid base cooldown');
  let percent=1,absolute=0;
  for(const change of changes)if(change.slot===slot){percent+=change.percent;absolute+=change.seconds;}
  return Math.max(seconds/2,seconds*percent+absolute);
}
