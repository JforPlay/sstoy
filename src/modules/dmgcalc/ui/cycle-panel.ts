import { createResponsiveImage } from '@/shared/dom';
import type { CycleSearchResult } from '../core/combat-optimizer';
import { getEnemyPresets } from '../core/enemies';
import { GameData, getCharacterName } from '@/shared/game-data';
import { getState } from '../core/state';
import { captureCombatInput } from '../core/combat-input';
import {combatActionName} from '../core/combat-action-labels';
import {startCycleSearchPool,searchWorkerCount} from '../core/combat-search-pool';
export {combatActionName} from '../core/combat-action-labels';

const escape = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const number = (value: number) => Math.floor(value).toLocaleString('ko-KR');
const ui = { busy: false, done: 0, total: 0, boss: 27, cinematics: true, candidate: 0, technicalCount: 0,
  searchDepth:'standard' as 'standard'|'deep',traceMode:'all' as 'all'|'skills',
  error: '', result: null as CycleSearchResult | null };
let searchJob:{cancel:()=>void}|null=null;
let lastInputSignature = '';
const currentInput = () => captureCombatInput(getState(), window.state, window.discsState, GameData.characters ?? {});

export function renderCyclePanel(): string {
  let input: ReturnType<typeof currentInput> | null = null;
  try { input = currentInput(); } catch { /* Empty parties are shown as empty, never replaced. */ }
  const signature = JSON.stringify(input);
  if (signature !== lastInputSignature) {
    searchJob?.cancel(); searchJob=null; ui.busy = false; ui.result = null; ui.error = '';
    lastInputSignature = signature;
  }
  const partyOrder = input?.actors.map(actor => String(actor.id)) ?? [];
  const actionName=(action:string)=>combatActionName(action,partyOrder[0]);
  const actorNames: Record<string, string> = Object.fromEntries(partyOrder.map(id => [id, getCharacterName(id)]));
  const currentTargets = getEnemyPresets();
  const targets = currentTargets.length ? currentTargets : [{ id: 26, name: '난폭한 헤비크랩' }, { id: 27, name: '심층의 주인' }];
  if (!targets.some(target => target.id === ui.boss)) { ui.boss = targets[0]!.id; ui.result = null; }
  const result = ui.result, candidate = result?.candidates[ui.candidate];
  const actions=candidate?.actions??[];
  const shownActions=ui.traceMode==='skills'?actions.filter(row=>!row.automatic):actions;
  const technical = result ? Math.min(result.technical.maximum, ui.technicalCount * result.technical.once) : 0;
  return `<section id="dmgcalc-cycle" class="dmgcalc-panel dmgcalc-cycle">
    <h3 class="dmgcalc-disc-group-title">180초 연합 토벌 사이클 <small>현재 설정 · 예측</small></h3>
    <p class="dmgcalc-help">현재 빌드로 180초 사이클을 비교합니다. 설정을 바꾸면 다시 계산하세요.</p>
    <div class="dmgcalc-cycle-party">${(input?.actors ?? []).map((actor, index) => `<span>${createResponsiveImage(`assets/char/avg1_${actor.id}_002.png`, escape(actorNames[actor.id]!), 'dmgcalc-cycle-portrait')}<span>${escape(actorNames[actor.id]!)}<small>${index ? '지원' : '메인'} · Lv.${actor.level} · 돌파 ${actor.limitBreak}</small></span></span>`).join('')}</div>
    <div class="dmgcalc-actions">
      <label>대상 <select data-cycle-setting="boss" ${ui.busy ? 'disabled' : ''}>${targets.map(target => `<option value="${target.id}" ${ui.boss === target.id ? 'selected' : ''}>${escape(target.name)}</option>`).join('')}</select></label>
      <label><input type="checkbox" data-cycle-setting="cinematics" ${ui.cinematics ? 'checked' : ''} ${ui.busy ? 'disabled' : ''}> 궁극기 연출 켬</label>
      <label>탐색 범위 <select data-cycle-setting="searchDepth" ${ui.busy?'disabled':''}><option value="standard" ${ui.searchDepth==='standard'?'selected':''}>확장 탐색</option><option value="deep" ${ui.searchDepth==='deep'?'selected':''}>정밀 탐색 · 오래 걸림</option></select></label>
      <button class="btn btn-primary" data-action="cycle-search" ${ui.busy || !input ? 'disabled' : ''}>${ui.busy ? ui.total?`비교 중 ${ui.done} / ${ui.total}`:'탐색 준비 중' : '180초 사이클 비교'}</button>
      ${ui.busy ? '<button class="btn btn-secondary" data-action="cycle-cancel">중지</button>' : ''}
      ${result ? '<button class="btn btn-secondary" data-action="cycle-download">계산 결과 저장</button>' : ''}
    </div>
    ${!currentTargets.length ? '<p class="dmgcalc-help">이전 시즌 보스로 계산합니다.</p>' : ''}
    <p class="dmgcalc-help">확장: 기본 90개 조합 · 정밀: 대기 시간을 더 세분화<br>파티에 따라 차지·변신·회피 캔슬을 비교하고 상위 5개를 표시합니다.</p>
    ${ui.busy ? `<progress max="${Math.max(1,ui.total)}" value="${ui.done}" aria-label="사이클 비교 진행률"></progress>` : ''}
    ${ui.error ? `<p role="alert" class="dmgcalc-scope-note">계산 오류: ${escape(ui.error)}</p>` : ''}
    ${candidate && result ? `<div class="dmgcalc-actions" aria-label="사이클 후보">${result.candidates.map((row, index) => `<button class="btn ${index === ui.candidate ? 'btn-primary' : 'btn-secondary'}" data-action="cycle-candidate" data-index="${index}" aria-pressed="${index === ui.candidate}">후보 ${index + 1} · ${number(row.damageScore)}점</button>`).join('')}</div>
      <div class="dmgcalc-key-stats"><div><span>딜 점수</span><strong>${number(candidate.damageScore)}</strong></div><div><span>즉시 사용 대비</span><strong>${candidate.improvement >= 0 ? '+' : ''}${number(candidate.improvement)}점</strong></div><div><span>기술 포함 예상 점수</span><strong>${number(candidate.damageScore + technical)}</strong></div></div>
      <div class="dmgcalc-actions"><label>기술 조건 성공 <select data-cycle-setting="technicalCount">${Array.from({ length: Math.floor(result.technical.maximum / result.technical.once) + 1 }, (_, n) => `<option value="${n}" ${n === ui.technicalCount ? 'selected' : ''}>${n}회 · ${number(n * result.technical.once)}점</option>`).join('')}</select></label><span class="dmgcalc-help">성공 횟수만큼 기술 점수를 더합니다.</span></div>
      <p class="dmgcalc-help">${escape(result.technical.description)}</p>
      <p class="dmgcalc-help">총 피해 ${number(candidate.damage)} · ${result.tested}개 조합 비교 · 보스 Lv.${candidate.bossLevel}<br>딜 점수 = 총 피해 ÷ ${number(result.switchRate)} (소수점 버림)</p>
      <p class="dmgcalc-help">${escape(candidate.name)}<br>대기 시간: 메인 스킬과 맞추기 위해 사용을 미루는 기준</p>
      <div class="dmgcalc-actions"><label>행동 표시 <select data-cycle-setting="traceMode"><option value="all" ${ui.traceMode==='all'?'selected':''}>평타·회피 포함 전체</option><option value="skills" ${ui.traceMode==='skills'?'selected':''}>직접 사용하는 스킬·궁</option></select></label><span class="dmgcalc-help">짧은 막대: 평타·자동 행동 / 긴 막대: 궁극기 / 분홍색: 회피</span></div>
      <div class="dmgcalc-cycle-timeline" aria-label="180초 전체 행동 시간표">${partyOrder.map(actor => `<div class="dmgcalc-cycle-lane"><span>${escape(actorNames[actor]!)}</span><div>${shownActions.filter(row=>row.action.startsWith(actor+':')).map(row=>`<i style="left:${row.time/result.duration*100}%" class="${row.flag===32?'is-ultimate':row.flag===16?'is-dodge':row.automatic?'is-automatic':''}" title="${row.time.toFixed(2)}초 · ${escape(actionName(row.action))} · ${(row.end-row.time).toFixed(2)}초${row.interrupted?' · 다음 행동으로 취소':''}"></i>`).join('')}</div></div>`).join('')}<div class="dmgcalc-cycle-scale"><span>0초</span><span>60초</span><span>120초</span><span>180초</span></div></div>
      <details open><summary>시간순 행동 · SP</summary><p class="dmgcalc-help">평타는 공격 동작 단위로 표시합니다. 소환물·장판의 개별 타격은 생략합니다.<br>취소: 다음 행동으로 전환</p><div class="dmgcalc-cycle-table"><table><thead><tr><th>시각</th><th>여행가</th><th>행동</th><th>동작 시간</th><th>종료</th><th>사용 전 SP</th><th>필요 SP</th></tr></thead><tbody>${shownActions.map(row=>`<tr><td>${row.time.toFixed(2)}초</td><td>${escape(actorNames[row.action.split(':')[0]!]??'')}</td><td>${escape(actionName(row.action))}</td><td>${Math.max(0,row.end-row.time).toFixed(2)}초</td><td>${row.interrupted?'취소':'종료'}</td><td>${row.sp.toFixed(2)}</td><td>${row.requiredSp||'—'}</td></tr>`).join('')}</tbody></table></div></details>
      <details><summary>행동별 사용 횟수</summary><p class="dmgcalc-help">${Object.entries(candidate.counts).filter(([action])=>partyOrder.includes(action.split(':')[0]!)).map(([action,count])=>`${escape(actorNames[action.split(':')[0]!]??'')} ${escape(actionName(action))} ${count}회`).join(' · ')}</p></details>
      <details><summary>계산 기준</summary>${result.assumptions.map(line => `<p class="dmgcalc-help">${escape(line)}</p>`).join('')}<p class="dmgcalc-help">빌드 등급 ${result.buildRank} · 적용 소리 ${Object.entries(result.notes).map(([id, count]) => `${id}: ${count}`).join(' / ')}</p></details>` : `${!input ? '<p class="dmgcalc-help">메인 여행가와 파티를 설정하세요.</p>' : ''}`}
  </section>`;
}

function refresh() {
  const current = document.getElementById('dmgcalc-cycle');
  if (current) current.outerHTML = renderCyclePanel();
}
export function handleCycleAction(action: string, element: HTMLElement): boolean {
  if (!action.startsWith('cycle-')) return false;
  if (action === 'cycle-search' && !ui.busy) {
    let input: ReturnType<typeof currentInput>;
    try { input = currentInput(); } catch (error) { ui.error = error instanceof Error ? error.message : String(error); refresh(); return true; }
    lastInputSignature = JSON.stringify(input);
    ui.busy = true; ui.done = 0; ui.total=0; ui.error = ''; ui.result = null; ui.candidate = 0; ui.technicalCount = 0;
    searchJob=startCycleSearchPool(()=>new Worker(new URL('../combat-worker.ts',import.meta.url),{type:'module'}),searchWorkerCount(navigator.hardwareConcurrency),
      {base:document.baseURI,input,options:{boss:ui.boss,distance:2,cinematics:ui.cinematics,searchDepth:ui.searchDepth}},
      {progress:(done,total)=>{ui.done=done;ui.total=total;refresh();},
        result:result=>{ui.result=result;ui.busy=false;searchJob=null;refresh();},
        error:message=>{ui.error=message;ui.busy=false;searchJob=null;refresh();}});
  } else if (action === 'cycle-cancel') { searchJob?.cancel(); searchJob=null; ui.busy = false; }
  else if (action === 'cycle-candidate') ui.candidate = Number(element.dataset.index);
  else if (action === 'cycle-download' && ui.result) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(ui.result, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = '연합토벌-180초-사이클.json'; link.click(); URL.revokeObjectURL(url);
  }
  refresh(); return true;
}
export function handleCycleSetting(target: HTMLElement): boolean {
  const setting = target.dataset.cycleSetting;
  if (!setting) return false;
  if (setting === 'technicalCount') ui.technicalCount = Number((target as HTMLSelectElement).value);
  else if(setting==='traceMode')ui.traceMode=(target as HTMLSelectElement).value==='skills'?'skills':'all';
  else if (!ui.busy) {
    if (setting === 'boss') ui.boss = Number((target as HTMLSelectElement).value);
    if (setting === 'cinematics') ui.cinematics = (target as HTMLInputElement).checked;
    if(setting==='searchDepth')ui.searchDepth=(target as HTMLSelectElement).value==='deep'?'deep':'standard';
    ui.result = null;
  }
  refresh(); return true;
}
