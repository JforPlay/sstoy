# 배지·데미지 계산 조사

조사일: 2026-11-01. 데이터와 공개 계산기 구현을 조사한 기록이며, 한국 서버 인게임 검증 완료를 뜻하지 않는다.

후속 적용: 확인된 속성 변경 배지 옵션, 종류별 치명타율, 방어 무시·관통을 계산기에 연결했다. 단계형 설정 UI와 현재 연토 보스의 기초 방어·속성별 저항 선택도 추가했다. 미확인 효과와 VUL 처리는 제외했다. 아래의 '현재 계산기와 대조한 차이'는 적용 전 조사 시점의 기록이다.

## 배지: 원본 데이터로 확인

원본: [Hiro420/StellaSoraData KR/bin](https://github.com/Hiro420/StellaSoraData/tree/main/KR/bin)

- [CharGem.json](https://github.com/Hiro420/StellaSoraData/blob/main/KR/bin/CharGem.json): 배지 기본 정보, 이미지, 제작·변경 재료 참조. 현재 사이트도 이 기본 목록은 로드한다.
- [CharGemAttrValue.json](https://github.com/Hiro420/StellaSoraData/blob/main/KR/bin/CharGemAttrValue.json): 423행, TypeId 112종. 행마다 효과 유형·하위 유형·수치·희귀도·레벨·OverlockCount 등이 있다. 423개의 서로 다른 옵션이라는 뜻은 아니다. 현재 사이트에는 이 테이블이 없다.
- [CharGemSlotControl.json](https://github.com/Hiro420/StellaSoraData/blob/main/KR/bin/CharGemSlotControl.json): 슬롯 3개, UnlockLevel 70/80/90. LockableNum=2, MaxAlterNum=4. 필드 이름만으로 실제 옵션 개수나 변경 규칙을 확정하지 않는다.

CharGemAttrValue의 효과 분류:

| AttrType | 행 수 | 확인한 의미 |
| --- | ---: | --- |
| 12 | 332 | 속성 변경. FirstSubtype을 effectAttributeType과 연결 |
| 7 | 12 | 스킬 레벨 증가. 값 1/2/3 |
| 37 | 16 | 플레이어 속성 변경. 에너지 수급 계열 |
| 99 | 63 | 현 사이트 effectType 사전에 없음. 잠재력 관련으로 추정되지만 의미·대상 연결은 추가 확인 필요 |

확인한 옵션 예시(같은 TypeId 안의 원본 Value 목록; 희귀도·레벨 등을 함께 선택해야 한다):

- TypeId 2: 공격력 고정값 70 / 88 / 105 / 210
- TypeId 5: 공격력 비율 0.04 / 0.05 / 0.06 / 0.12
- TypeId 7: 치명타 피해 0.08 / 0.10 / 0.12 / 0.24
- TypeId 8: 치명타율 0.05 / 0.063 / 0.075 / 0.15
- TypeId 24: 표식 피해 0.27 / 0.33 / 0.40 / 0.80
- TypeId 32: 표식 치명타율 0.05 / 0.063 / 0.075 / 0.15

주의: 고정값과 소수 비율이 혼재한다. 계산기 내부의 10000배 정수 단위로 일괄 해석하면 안 된다. 한국어 UIText에는 `배지 효과로 {0}레벨 상승 포함` 문구도 있다. 다만 이 문구만으로 AttrType 99의 정확한 처리를 확정하지 않는다.

## 표식 피해

사이트의 `GameEnums.damageType`에서 5는 MARK(표식)이다. 현재 로컬 `HitDamage.json`에는 DamageType=5인 행이 52개 있다.

예: HitDamage 103000001은 ElementType=2, SkillPercentAmend가 540000부터 1420000까지 9개 값이다. 기존 계수 해석대로라면 54%부터 142%이지만, 실제 선택 레벨과 발동 조건·횟수는 별도로 연결해야 한다.

표식 관련 속성 ID도 존재한다: MARKDMG=64, RCDMARKDMG=65, MARKCRITRATE=73, MARKCRITPOWER=80. 따라서 모든 표식을 하나의 고정 계수나 일반 치명타율만으로 계산하는 방식은 불충분하다.

## 공개 계산식 구현

작성자 dayutips, 데이터 인용 autumnvnchino:

- [계산기](https://stellasora-calculator.pages.dev/)
- [실제 JavaScript](https://stellasora-calculator.pages.dev/script.js)

원본에서 확인한 계산 순서:

1. 공격력 × (스킬 계수 + 추가 계수) + 고정 피해
2. 스킬 위력 × 특성 위력 × 피해 종류 증가 × 속성 피해 증가 × 가하는 피해 증가, 이후 고정 가산
3. 치명타일 때 일반 치명타 피해 + 피해 종류별 치명타 피해
4. 속성 저항 × 방어 × 종류별/속성별/일반 받는 피해 × 강인도 파괴 보정
5. 받는 고정 피해 가산 → 최종 피해 배율 → 최종 고정 피해 가산
6. 마지막 내림 및 최소 피해 1 처리

방어 계산 원본:

```text
D = DEF × (1 - 방어 무시 비율) - 방어 관통
D <= 0: 방어 배율 = 1
D > 0: 방어 배율 = 1 - (D × 40) / (D × 32 + 24000)
```

저항은 저항 무시·관통 후 0~250, 251~750, 751~2000 구간별 제곱 보간을 사용한다. 0 이하에는 별도의 VUL 처리 식이 있다. 구간 경계가 불연속이므로 보간을 임의로 매끈하게 바꾸지 않는다. VUL의 정확한 게임 속성 연결과 기본값은 추가 확인 대상이다.

이 구현은 주석에서 `5.fulldamage.txt`를 참조하지만, 해당 원본 파일과 현재 한국 서버에서의 동일성은 확인하지 못했다. 공개 계산기를 게임 공식 확정본으로 취급하지 않는다.

추가 연구 자료: [Mistique's Field Reports](https://stelladb.pages.dev/infodoc/welcome)의 Damage Formula Related에 soh2960의 문서·단일 계산기·팀 계산기가 연결되어 있다. [연구 원문 링크](https://docs.google.com/document/d/18NrprCI7NJvOeBswQw6Y3xcG0bXW6HXjj5pLHzCehHY)는 이번 조회에서 접근 실패(텍스트 export 401)하여 내용을 검증하지 못했다. 게임 운영사의 공식 문서는 아니다.

## 현재 계산기와 대조한 차이

- 배지 기본 목록은 있으나 옵션 테이블과 장착 옵션의 계산 연결이 없다.
- 기대값에 사용하는 치명타율은 일반 CritRate이며 종류별 치명타율 합산이 빠져 있다.
- 방어 배율에 방어 무시·관통이 연결되어 있지 않다.
- 저항 0 이하를 1로 처리하여 공개 구현의 VUL 처리가 없다.
- 스킬 위력·특성 위력·추가 계수·고정 피해 보정 중 일부는 자리표시 값이다. 입력 데이터부터 연결해야 한다.
- 적중 데이터의 단순 합은 실제 전투 사이클 피해가 아니다. 발동 조건·반복 횟수·잠재력 레벨·배지 레벨 상승을 구분해야 한다.

`ScoreBossBattleThreshold.json`의 수치는 이름만 보고 인게임 상한이나 점수 환산식으로 사용하지 않는다. 검증용 임계값일 가능성이 있으며, 실제 용도는 코드 근거가 필요하다.

다음 구현 순서: 배지 옵션 데이터 연결 및 단위 변환 → 종류별 치명타율/피해 합산 → 방어 무시·관통 → 표식의 레벨·조건·횟수 연결 → 인게임 표본 대조. 연합토벌 점수 환산은 별도 식과 표본 확인이 필요하다.
