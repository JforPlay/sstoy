import {combatFixed} from './combat-weapons';
import type {CompiledCombo} from './combat-timeline';

interface Fixed { _serializedValue:number }
interface CurveKey {m_Time:Fixed;m_Value:Fixed;m_InTangent:Fixed;m_OutTangent:Fixed}
interface Curve {m_keys:CurveKey[];m_preWrapMode:number;m_postWrapMode:number}
export interface CombatRootMotion {
  enableRootMotion?:number;enableRootMotionRotate?:number;
  rootMotionSides?:Curve;rootMotionForward?:Curve;rootMotionVertical?:Curve;
  rootMotionMultiplier?:{x:Fixed;y:Fixed;z:Fixed};
  rootMotionCheckDistance?:Fixed;rootMotionCheckDistanceLimitUp?:Fixed;
}

/** Sample the serialized, time-based keyframes, preserving their tangents.
 * This is the local clip translation, not a navmesh or collision simulation. */
export function evaluateCombatCurve(curve:Curve,time:number):number {
  if(!Number.isFinite(time))throw new Error('Invalid root-motion curve time');
  const keys=curve.m_keys;
  if(!keys.length)throw new Error('Missing root-motion keys');
  const start=combatFixed(keys[0]!.m_Time),end=combatFixed(keys.at(-1)!.m_Time),span=end-start;
  if(time<start||time>end){
    const mode=time<start?curve.m_preWrapMode:curve.m_postWrapMode;
    if(span>0&&(mode===2||mode===4)){
      const period=mode===2?span:2*span;
      const offset=((time-start)%period+period)%period;
      time=start+(mode===4&&offset>span?period-offset:offset);
    }else time=Math.max(start,Math.min(end,time));
  }
  let index=keys.findIndex(key=>combatFixed(key.m_Time)>=time);
  if(index<0)index=keys.length-1;
  const next=keys[index]!,nextTime=combatFixed(next.m_Time),nextValue=combatFixed(next.m_Value);
  if(index===0||time===nextTime)return nextValue;
  const previous=keys[index-1]!,previousTime=combatFixed(previous.m_Time),previousValue=combatFixed(previous.m_Value);
  const duration=nextTime-previousTime,t=(time-previousTime)/duration,t2=t*t,t3=t2*t;
  const outgoing=combatFixed(previous.m_OutTangent),incoming=combatFixed(next.m_InTangent);
  // TrueSync exports saturated FP tangents for stepped keys.
  if(Math.abs(outgoing)>=2147483647||Math.abs(incoming)>=2147483647)return previousValue;
  return (2*t3-3*t2+1)*previousValue+(t3-2*t2+t)*duration*outgoing
    +(-2*t3+3*t2)*nextValue+(t3-t2)*duration*incoming;
}

export function sampleCombatRootTranslation(motion:CombatRootMotion,clipTime:number,modelScale=1){
  if(!motion.enableRootMotion)return {side:0,forward:0,vertical:0};
  const {rootMotionSides:sides,rootMotionForward:forward,rootMotionVertical:vertical,rootMotionMultiplier:multiplier}=motion;
  if(!sides||!forward||!vertical||!multiplier)throw new Error('Missing native root-motion curve');
  if(!Number.isFinite(modelScale)||modelScale<=0)throw new Error('Invalid root-motion actor scale');
  const delta=(curve:Curve,scale:Fixed)=>(evaluateCombatCurve(curve,clipTime)-evaluateCombatCurve(curve,0))*combatFixed(scale)*modelScale;
  return {side:delta(sides,multiplier.x),forward:delta(forward,multiplier.z),vertical:delta(vertical,multiplier.y)};
}

/** Planar displacement on an unobstructed floor, with a fixed clip heading. */
export function sampleCombatComboTranslation(combo:CompiledCombo,elapsed:number,facing:number,modelScale=1){
  const result={x:0,z:0};
  const cos=Math.cos(facing),sin=Math.sin(facing);
  for(const {offset,duration,speed,motion} of combo.translation ?? []){
    if(elapsed<=offset)break;
    const {side,forward}=sampleCombatRootTranslation(motion,Math.min(duration,elapsed-offset)*speed,modelScale);
    result.x+=cos*forward-sin*side;
    result.z+=sin*forward+cos*side;
  }
  return result;
}
