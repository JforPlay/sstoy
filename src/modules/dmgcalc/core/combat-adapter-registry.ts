import type {SupportCombatAdapter} from './combat-support-adapter';
import {createSupport112} from './combat-support-112';
import {createSupport118} from './combat-support-118';
import {createSupport127} from './combat-support-127';
import {createSupport132} from './combat-support-132';
import {createSupport133} from './combat-support-133';
import {createSupport134} from './combat-support-134';
import {createSupport137} from './combat-support-137';
import {createSupport139} from './combat-support-139';
import {createSupport140} from './combat-support-140';
import {createSupport142} from './combat-support-142';
import {createSupport143} from './combat-support-143';
import {createSupport145} from './combat-support-145';
import {createSupport147} from './combat-support-147';
import {createSupport156} from './combat-support-156';
import {createSupport157} from './combat-support-157';
import {createSupport159} from './combat-support-159';
import {createSupport162} from './combat-support-162';
import {createMain134} from './combat-main-134';
import {createMain157} from './combat-main-157';
import {createMain149} from './combat-main-149';
import {createMain133} from './combat-main-133';
import {createMain143} from './combat-main-143';
import {createMain132} from './combat-main-132';
import {createMain156} from './combat-main-156';
import {createMain137} from './combat-main-137';
import {createMain139} from './combat-main-139';
import {createMain140} from './combat-main-140';
import {createMain145} from './combat-main-145';
import {createSupport130} from './combat-support-130';
import {createSupport160} from './combat-support-160';
import {createSupport161} from './combat-support-161';
import {createMain110} from './combat-main-110';
import {createSupport158} from './combat-support-158';
import {createMain144} from './combat-main-144';
import {createMain114} from './combat-main-114';
import {createSupport126} from './combat-support-126';
import {createSupport123} from './combat-support-123';
import {createSupport125} from './combat-support-125';
import {createMain119} from './combat-main-119';
import {createMain155} from './combat-main-155';
import {createMain111} from './combat-main-111';
import {createSupport116} from './combat-support-116';
import {createSupport117} from './combat-support-117';
import {createSupport120} from './combat-support-120';
import {createMain150} from './combat-main-150';
import {createMain113} from './combat-main-113';
import {createSupport135} from './combat-support-135';
import {createSupport141} from './combat-support-141';

/** Runtime registration and coverage audits use the same inventory. Presence
 * here means a connected adapter, not a claim of whole-game accuracy. */
export interface SupportFactoryContext {parameter:(id:number)=>number;breakthrough:number;glimmerId:number;partyElements?:number[]}
export interface MainFactoryContext extends SupportFactoryContext {ammo?:number;skillCooldown:(id:number)=>number}
export const combatSupportFactories:Record<number,(potentials:Record<number,number>,context:SupportFactoryContext)=>SupportCombatAdapter<Record<string,unknown>>>={
  161:createSupport161,
  112:createSupport112,116:createSupport116,117:createSupport117,118:createSupport118,120:createSupport120,123:createSupport123,125:createSupport125,126:createSupport126,127:createSupport127,130:createSupport130,158:createSupport158,160:createSupport160,132:createSupport132,133:createSupport133,134:createSupport134,135:createSupport135,137:createSupport137,139:createSupport139,140:createSupport140,
  141:createSupport141,142:createSupport142,143:createSupport143,145:createSupport145,147:createSupport147,156:createSupport156,157:createSupport157,159:createSupport159,162:createSupport162,
};
export const legacyCombatSupports:readonly number[]=[107,108,115,149];
export const combatMainFactories:Record<number,(potentials:Record<number,number>,context:MainFactoryContext)=>SupportCombatAdapter<Record<string,unknown>>>={110:createMain110,111:createMain111,113:createMain113,114:createMain114,119:createMain119,132:createMain132,133:createMain133,134:createMain134,137:createMain137,139:createMain139,140:createMain140,143:createMain143,144:createMain144,145:createMain145,149:createMain149,150:createMain150,155:createMain155,156:createMain156,157:createMain157};
export const connectedCombatMains:readonly number[]=[103,162,...Object.keys(combatMainFactories).map(Number)].sort((a,b)=>a-b);
export const connectedCombatSupports:readonly number[]=[...legacyCombatSupports,...Object.keys(combatSupportFactories).map(Number)].sort((a,b)=>a-b);
