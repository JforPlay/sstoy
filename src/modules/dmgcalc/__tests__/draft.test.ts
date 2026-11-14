import {describe,it,expect,beforeEach} from 'vitest';
import {saveCalculatorDraft,readCalculatorDraft,applyCalculatorDraft} from '../core/draft';
import {getState,resetState} from '../core/state';
describe('계산기 임시 저장',()=>{
  const values=new Map<string,string>();
  const storage={setItem:(k:string,v:string)=>{values.set(k,v);},getItem:(k:string)=>values.get(k)??null};
  beforeEach(()=>{values.clear();resetState();getState().masterCharId=162;});
  const save=()=>saveCalculatorDraft(storage,getState(),{c:{m:{i:'162'}},d:{s:{main1:214039}}},{master:8,assist1:8,assist2:8});
  it('배지 36개와 레코드·소리·돌파·파티를 별도 복사해 복원',()=>{
    getState().badgeOptions[0]=[201,202,203,204];getState().supportLimitBreaks.assist1=3;getState().noteOverrides['1']=11;
    getState().discLevels.main1=81;save();getState().badgeOptions[0]![0]=999;
    const draft=readCalculatorDraft(storage)!;expect(draft.settings.badgeOptions[0]).toEqual([201,202,203,204]);
    resetState();applyCalculatorDraft(getState(),draft);
    expect(getState().badgeOptions[0]).toEqual([201,202,203,204]);expect(getState().noteOverrides['1']).toBe(11);
    expect(getState().supportLimitBreaks.assist1).toBe(3);expect(getState().stats).toBeInstanceOf(Map);
    getState().badgeOptions[0]![0]=777;expect(draft.settings.badgeOptions[0]![0]).toBe(201);
  });
  it('깨진 저장·다른 버전·잘못된 배지 데이터는 복원하지 않음',()=>{
    save();const key=[...values.keys()][0]!,valid=values.get(key)!;
    for(const raw of ['{',JSON.stringify({...JSON.parse(valid),version:2}),JSON.stringify({...JSON.parse(valid),settings:{badgeOptions:[]}})]){
      storage.setItem(key,raw);expect(readCalculatorDraft(storage)).toBeNull();
    }
  });
  it('저장 공간 오류를 숨기지 않고 호출자에게 전달',()=>{
    expect(()=>saveCalculatorDraft({setItem:()=>{throw new Error('quota');}},getState(),{},{})).toThrow('quota');
  });
});
