/** Native Config_Support.DecibelState values. */
export type WillowDecibelState=0|1|2;
export function willowDecibelState(resident:boolean,count:number):WillowDecibelState {
  return !resident?0:count>40?2:1;
}
export interface WillowSupportDecision {
  resident:boolean;paused:boolean;decibelState:WillowDecibelState;
  canRotate:boolean;canLine:boolean;canTorrential:boolean;
}
/** ActionScript_Support.CastSkill is an ordered else-if chain. A higher
 * priority request is not replaced by a lower one just because its cooldown
 * is unavailable: the shared runtime checks the requested skill's legality. */
export function willowSupportSkill(state:WillowSupportDecision,potentials:Record<number,number>,normalSkill:number):number|null {
  if(!state.resident||state.paused)return null;
  if(potentials[516022]&&state.canRotate)return 16032005;
  if(potentials[516021]&&state.canLine&&state.decibelState===1)return 16032004;
  if(potentials[516023]&&state.canTorrential)return 16032006;
  return normalSkill;
}
