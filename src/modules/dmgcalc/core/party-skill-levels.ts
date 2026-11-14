import {GameData} from '@/shared/game-data';
import {getState,setSkillLevel} from './state';
import {normalizeBaseSkillLevel} from '../constants';
import type {SkillType} from '../types';

export type SkillPosition='master'|'assist1'|'assist2';
function skillId(position:SkillPosition,type:SkillType):number{
  const selected=window.state?.party?.[position];
  const id=selected&&typeof selected==='object'?selected.id:position==='master'?getState().masterCharId:null;
  const character=id?GameData.characters?.[String(id)]:undefined;
  const field=type==='ultimate'?'UltimateId':type==='normalAtk'?(position==='master'?'NormalAtkId':'AssistNormalAtkId'):(position==='master'?'SkillId':'AssistSkillId');
  return Number(character?.[field]??0);
}
export function partySkillLevel(position:SkillPosition,type:SkillType):number{
  if(position==='master')return normalizeBaseSkillLevel(getState().skillLevels[type]);
  return normalizeBaseSkillLevel(window.state?.skillLevels?.[position]?.[skillId(position,type)]??8);
}
export function setPartySkillLevel(position:SkillPosition,type:SkillType,value:number):void{
  if(!Number.isFinite(value))return;
  const level=normalizeBaseSkillLevel(value),id=skillId(position,type);
  if(position==='master')setSkillLevel(type,level);
  if(id&&window.state){
    window.state.skillLevels??={master:{},assist1:{},assist2:{}};
    window.state.skillLevels[position]??={};
    window.state.skillLevels[position][id]=level;
  }
}
