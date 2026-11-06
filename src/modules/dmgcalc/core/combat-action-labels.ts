/** Labels follow the selected role, never a particular example character. */
export function combatActionName(action:string,mainActor?:string):string{
  const [actor,kind,detail]=action.split(':');
  if(detail==='continuation')return '스킬 연속 동작';
  if(detail==='charge-consumed')return '추가 충전 사용';
  if(kind==='ultimate')return `궁극기${detail==='rapier'?' · 세검':detail==='claymore'?' · 대검':''}`;
  if(kind==='ultimate-second')return '궁극기 2단계';
  if(kind==='soul-ultimate')return '영혼 소모 · 추가 궁극기';
  if(kind==='skill')return mainActor?actor===mainActor?'메인 스킬':'지원 스킬':'스킬';
  const transformed:Record<string,string>={'skill-tank':'탱크 변신','skill-cannon':'기관포 변신',
    'tank-normal':'탱크 일반 공격','cannon-normal':'기관포 일반 공격','tank-skill':'탱크 스킬',
    'cannon-skill':'기관포 스킬','tank-dodge':'탱크 회피','cannon-dodge':'기관포 회피',return:'변신 해제'};
  if(transformed[kind ?? ''])return transformed[kind!]!;
  if(kind?.startsWith('skill2')||kind?.startsWith('skill3'))return `스킬 ${kind.startsWith('skill2')?2:3}단계${kind.includes('enhanced')?' · 강화':''}${kind.endsWith('-hold')?' · 길게 유지':''}`;
  if(kind==='phase2'||kind==='phase3')return `스킬 ${kind.slice(-1)}단계`;
  if(kind==='normal'||kind==='resident')return `${kind==='resident'?'지원 ':''}일반 공격${detail!==undefined&&Number.isInteger(Number(detail))?` ${Number(detail)+1}`:''}`;
  const labels:Record<string,string>={extra:'추가 스킬',exit:'퇴장 공격',reload:'재장전',dodge:'회피',rush:'질주 · 영혼 수집',
    'after-reload':'재장전 후 추가 공격',raffle:'추첨',sculpture:'펭귄 조각상',heart:'하트 화살',
    'strafe-a':'펭귄 사격','strafe-b':'하트 사격','super-normal':'강화 일반 공격',area:'추가 범위 공격'};
  return labels[kind ?? ''] ?? '추가 행동';
}
