import type {DmgCalcState} from '../types';
const KEY='sstoy-dmgcalc-draft-v1';
const fields=['expandedSteps','badgeOptions','enemyPresetId','masterCharId','masterLevel','limitBreak','supportLimitBreaks',
  'skillLevels','discLevel','discLevels','discLimitBreaks','noteOverrides','potentialLevelOverrides','statOverrides','enemy'] as const;
type Settings=Pick<DmgCalcState,typeof fields[number]>;
export interface CalculatorDraft {version:1;savedAt:number;settings:Settings;build:any;phases:Record<string,number>}
export function saveCalculatorDraft(storage:Pick<Storage,'setItem'>,state:DmgCalcState,build:any,phases:Record<string,number>):CalculatorDraft{
  const settings=Object.fromEntries(fields.map(field=>[field,state[field]])) as Settings;
  const draft:CalculatorDraft={version:1,savedAt:Date.now(),settings,build,phases};
  storage.setItem(KEY,JSON.stringify(draft));return draft;
}
export function readCalculatorDraft(storage:Pick<Storage,'getItem'>):CalculatorDraft|null{
  try{
    const draft=JSON.parse(storage.getItem(KEY)??'null') as CalculatorDraft|null;
    if(!draft||draft.version!==1||!Number.isFinite(draft.savedAt)||!draft.build?.c||!draft.settings)return null;
    const s=draft.settings;
    if(fields.some(field=>!(field in s))||!Array.isArray(s.badgeOptions)||s.badgeOptions.length!==9||
      !s.badgeOptions.every(row=>Array.isArray(row)&&row.length===4&&row.every(id=>Number.isSafeInteger(id)&&id>=0)))return null;
    if(!Number.isInteger(s.masterCharId)||Number(draft.build.c.m?.i)!==s.masterCharId||!s.enemy||!s.skillLevels||!s.discLevels||!s.supportLimitBreaks)return null;
    const finiteMap=(value:unknown)=>Boolean(value&&typeof value==='object'&&!Array.isArray(value)&&Object.values(value).every(n=>typeof n==='number'&&Number.isFinite(n)));
    if(![s.skillLevels,s.discLevels,s.discLimitBreaks,s.supportLimitBreaks,s.noteOverrides,s.potentialLevelOverrides,s.statOverrides,draft.phases].every(finiteMap))return null;
    // JSON clones keep subsequent edits from mutating the stored snapshot.
    return draft;
  }catch{return null;}
}
export function applyCalculatorDraft(state:DmgCalcState,draft:CalculatorDraft):void{
  const values=JSON.parse(JSON.stringify(draft.settings)) as Settings;
  for(const field of fields)(state as any)[field]=values[field];
}
export function calculatorDraftStatus():string{
  try {const draft=readCalculatorDraft(localStorage);return draft?`임시 저장됨 · ${new Date(draft.savedAt).toLocaleTimeString('ko-KR')}`:'설정을 바꾸면 이 브라우저에 자동 저장됩니다.';}
  catch{return '브라우저 저장 공간을 사용할 수 없습니다.';}
}
